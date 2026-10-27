var NEPA_SUBMISSION_SPREADSHEET_ID = "";
var NEPA_SUBMISSION_SHEET_NAME = "";
var NEPA_SUBMISSION_HEADER_ROW = 1;
var NEPA_SUBMISSION_TRIGGER_HANDLER = "nepaScreeningOnEdit";

function installNepaScreeningOnEditTrigger() {
  var spreadsheet = getNepaSubmissionSpreadsheet();
  if (NEPA_SUBMISSION_SHEET_NAME &&
      !spreadsheet.getSheetByName(NEPA_SUBMISSION_SHEET_NAME)) {
    throw new Error("Submission sheet \"" + NEPA_SUBMISSION_SHEET_NAME +
      "\" was not found in the configured spreadsheet.");
  }
  ScriptApp.getProjectTriggers().forEach(function(trigger) {
    var sameSpreadsheet = !trigger.getTriggerSourceId ||
      trigger.getTriggerSourceId() === spreadsheet.getId();
    if (trigger.getHandlerFunction() === NEPA_SUBMISSION_TRIGGER_HANDLER &&
        sameSpreadsheet) {
      ScriptApp.deleteTrigger(trigger);
    }
  });
  var trigger = ScriptApp.newTrigger(NEPA_SUBMISSION_TRIGGER_HANDLER)
    .forSpreadsheet(spreadsheet)
    .onEdit()
    .create();
  Logger.log("Installed NEPA submission edit trigger for spreadsheet " +
    spreadsheet.getId() + ".");
  return trigger.getUniqueId();
}

async function nepaScreeningOnEdit(event) {
  if (!event || !event.range || typeof event.range.getSheet !== "function") {
    throw new Error("The NEPA edit handler requires an installable onEdit event.");
  }
  var sheet = event.range.getSheet();
  if (NEPA_SUBMISSION_SHEET_NAME &&
      sheet.getName() !== NEPA_SUBMISSION_SHEET_NAME) return;
  if (!NEPA_SUBMISSION_SHEET_NAME && !isNepaSubmissionSheet_(sheet)) return;

  var firstRow = Math.max(
    NEPA_SUBMISSION_HEADER_ROW + 1,
    event.range.getRow()
  );
  var lastRow = event.range.getRow() + event.range.getNumRows() - 1;
  var errors = [];
  for (var rowNumber = firstRow; rowNumber <= lastRow; rowNumber++) {
    try {
      await processNepaSubmissionRow_(sheet, rowNumber, false);
    } catch (error) {
      var message = error && error.message ? error.message : String(error);
      errors.push("Row " + rowNumber + ": " + message);
      Logger.log("NEPA submission row failed (" + rowNumber + "): " + message);
    }
  }
  if (errors.length) {
    throw new Error("NEPA screening failed for " + errors.length +
      " edited row(s). " + errors.join(" | "));
  }
}

async function processNepaScreeningSubmissionRow(
  spreadsheetId, sheetName, rowNumber
) {
  var spreadsheet = spreadsheetId
    ? SpreadsheetApp.openById(String(spreadsheetId))
    : getNepaSubmissionSpreadsheet();
  var targetSheetName = sheetName || NEPA_SUBMISSION_SHEET_NAME;
  var sheet = targetSheetName
    ? spreadsheet.getSheetByName(targetSheetName)
    : spreadsheet.getActiveSheet();
  if (!sheet) {
    throw new Error("The requested NEPA submission sheet was not found.");
  }
  return processNepaSubmissionRow_(sheet, Number(rowNumber), false);
}

async function retryNepaScreeningSubmissionRow(rowNumber, sheetName) {
  var spreadsheet = getNepaSubmissionSpreadsheet();
  var targetSheetName = sheetName || NEPA_SUBMISSION_SHEET_NAME;
  var sheet = targetSheetName
    ? spreadsheet.getSheetByName(targetSheetName)
    : spreadsheet.getActiveSheet();
  if (!sheet) {
    throw new Error("The requested NEPA submission sheet was not found.");
  }
  return processNepaSubmissionRow_(sheet, Number(rowNumber), true);
}

function getNepaSubmissionSpreadsheet() {
  if (NEPA_SUBMISSION_SPREADSHEET_ID) {
    return SpreadsheetApp.openById(NEPA_SUBMISSION_SPREADSHEET_ID);
  }
  var spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  if (!spreadsheet) {
    throw new Error("Set NEPA_SUBMISSION_SPREADSHEET_ID in Code.gs or bind this script to the submission spreadsheet.");
  }
  return spreadsheet;
}

function isNepaSubmissionSheet_(sheet) {
  var lastColumn = Math.max(1, sheet.getLastColumn());
  var headers = sheet.getRange(
    NEPA_SUBMISSION_HEADER_ROW, 1, 1, lastColumn
  ).getDisplayValues()[0];
  return findNepaSubmissionColumn(headers, ["Project Name", "Project"]) !== -1 &&
    findNepaSubmissionColumn(headers, [
      "Repaired GeoJSON ECZ", "Repaired ECZ GeoJSON", "ECZ GeoJSON",
      "GeoJSON ECZ", "Project GeoJSON", "Project Boundary GeoJSON",
      "ECZ Boundary", "ECZ"
    ]) !== -1;
}

async function processNepaSubmissionRow_(sheet, rowNumber, forceRetry) {
  if (!isFinite(rowNumber) || rowNumber <= NEPA_SUBMISSION_HEADER_ROW) {
    throw new Error("A valid submission data row number is required.");
  }
  var lock = LockService.getScriptLock();
  lock.waitLock(30000);
  var submission;
  try {
    var lastColumn = Math.max(1, sheet.getLastColumn());
    var headers = sheet.getRange(
      NEPA_SUBMISSION_HEADER_ROW, 1, 1, lastColumn
    ).getDisplayValues()[0];
    var columns = {
      projectName: findNepaSubmissionColumn(headers, [
        "Project Name", "Project"
      ]),
      stateProjectNumber: findNepaSubmissionColumn(headers, [
        "State No", "State Number", "State Project No",
        "State Project Number"
      ]),
      federalProjectNumber: findNepaSubmissionColumn(headers, [
        "Fed No", "Federal No", "Federal Number", "Federal Project No",
        "Federal Project Number"
      ]),
      projectType: findNepaSubmissionColumn(headers, [
        "Project Type", "Type"
      ]),
      projectGeoJson: findNepaSubmissionColumn(headers, [
        "Repaired GeoJSON ECZ", "Repaired ECZ GeoJSON", "ECZ GeoJSON",
        "GeoJSON ECZ", "Project GeoJSON", "Project Boundary GeoJSON",
        "ECZ Boundary", "ECZ"
      ]),
      userEmail: findNepaSubmissionColumn(headers, [
        "User Email", "Email Address", "Email"
      ])
    };
    if (columns.projectName === -1 || columns.projectGeoJson === -1) {
      throw new Error("The submission sheet needs headers for Project Name and the repaired ECZ GeoJSON.");
    }
    var rowValues = sheet.getRange(rowNumber, 1, 1, lastColumn).getValues()[0];
    var projectName = submissionCellText(rowValues, columns.projectName);
    var geoJsonValue = columns.projectGeoJson === -1
      ? ""
      : rowValues[columns.projectGeoJson];
    if (!projectName || geoJsonValue === "" || geoJsonValue === null ||
        geoJsonValue === undefined) {
      Logger.log("Skipping incomplete NEPA submission row " + rowNumber + ".");
      return { status: "SKIPPED_INCOMPLETE", rowNumber: rowNumber };
    }

    var spreadsheetWasLocked = unlockNepaSubmissionSpreadsheet_(sheet);
    var resultColumns = ensureNepaSubmissionResultColumns(sheet, headers);
    var resultValues = sheet.getRange(
      rowNumber, 1, 1, resultColumns.lastColumn
    ).getValues()[0];
    var previousStatus = String(
      resultValues[resultColumns.status - 1] || ""
    ).trim().toUpperCase();
    if (!forceRetry && previousStatus) {
      Logger.log("Skipping NEPA submission row " + rowNumber +
        " with existing status " + previousStatus + ".");
      return { status: "SKIPPED_ALREADY_PROCESSED", rowNumber: rowNumber };
    }
    sheet.getRange(rowNumber, resultColumns.status).setValue("PROCESSING");
    submission = {
      rowNumber: rowNumber,
      columns: resultColumns,
      projectName: projectName,
      stateProjectNumber: submissionCellText(rowValues, columns.stateProjectNumber),
      federalProjectNumber: submissionCellText(rowValues, columns.federalProjectNumber),
      projectType: submissionCellText(rowValues, columns.projectType),
      userEmail: submissionCellText(rowValues, columns.userEmail),
      geoJsonValue: geoJsonValue,
      spreadsheetWasLocked: spreadsheetWasLocked
    };
  } finally {
    if (!submission && spreadsheetWasLocked) relockNepaSubmissionSpreadsheet_(sheet);
    lock.releaseLock();
  }

  try {
    var geoJson = parseNepaSubmissionGeoJson(
      submission.geoJsonValue, submission.rowNumber
    );
    var output = await runNepaScreening({
      preparedProjectGeoJson: geoJson,
      projectName: submission.projectName,
      stateProjectNumber: submission.stateProjectNumber,
      federalProjectNumber: submission.federalProjectNumber,
      projectType: submission.projectType,
      userEmail: submission.userEmail
    });
    var issues = (output.issues || []).map(function(issue) {
      return (issue.displayName || issue.name || "Screening issue") +
        (issue.error ? ": " + issue.error : "");
    });
    var hasIssues = issues.length > 0 || !output.report || !output.map ||
      !output.report.url || !output.map.url;
    sheet.getRange(submission.rowNumber, submission.columns.status)
      .setValue(hasIssues ? "COMPLETED_WITH_ISSUES" : "COMPLETE");
    sheet.getRange(submission.rowNumber, submission.columns.reportUrl)
      .setValue(output.report && output.report.url || "");
    sheet.getRange(submission.rowNumber, submission.columns.mapUrl)
      .setValue(output.map && output.map.url || "");
    sheet.getRange(submission.rowNumber, submission.columns.error)
      .setValue(issues.join("\n").slice(0, 40000));
    sheet.getRange(submission.rowNumber, submission.columns.folderId)
      .setValue(output.projectFolder && output.projectFolder.id || "");
    sheet.getRange(submission.rowNumber, submission.columns.completedAt)
      .setValue(new Date());
    return output;
  } catch (error) {
    var errorMessage = error && error.message ? error.message : String(error);
    Logger.log("NEPA screening failed for submission row " +
      submission.rowNumber + ": " + errorMessage);
    sheet.getRange(submission.rowNumber, submission.columns.status)
      .setValue("ERROR");
    sheet.getRange(submission.rowNumber, submission.columns.error)
      .setValue(errorMessage.slice(0, 40000));
    throw error;
  } finally {
    if (submission.spreadsheetWasLocked) relockNepaSubmissionSpreadsheet_(sheet);
  }
}

function unlockNepaSubmissionSpreadsheet_(sheet) {
  try {
    var fileId = sheet.getParent().getId();
    if (!isSpreadsheetContentRestricted(fileId)) return false;
    var result = setSpreadsheetContentRestriction(fileId, false);
    if (!result.ok) Logger.log("Could not unlock the spreadsheet: " + result.code + " " + result.body);
    return true;
  } catch (error) {
    Logger.log("Could not check or unlock the spreadsheet: " + (error.message || error));
    return false;
  }
}

function relockNepaSubmissionSpreadsheet_(sheet) {
  try {
    SpreadsheetApp.flush();
    var result = setSpreadsheetContentRestriction(
      sheet.getParent().getId(), true, "Locked after NEPA screening"
    );
    if (!result.ok) Logger.log("Could not relock the spreadsheet: " + result.code + " " + result.body);
  } catch (error) {
    Logger.log("Could not relock the spreadsheet: " + (error.message || error));
  }
}

function parseNepaSubmissionGeoJson(value, rowNumber) {
  var geoJson = value;
  if (typeof geoJson === "string") {
    try {
      geoJson = JSON.parse(geoJson);
    } catch (error) {
      throw new Error("The repaired ECZ GeoJSON in row " + rowNumber +
        " is not valid JSON: " + (error.message || error));
    }
  }
  if (!geoJson || typeof geoJson !== "object") {
    throw new Error("The repaired ECZ GeoJSON in row " + rowNumber +
      " must be a GeoJSON object or JSON string.");
  }
  return geoJson;
}

function submissionCellText(rowValues, columnIndex) {
  if (columnIndex === -1) return "";
  var value = rowValues[columnIndex];
  return value === null || value === undefined ? "" : String(value).trim();
}

function findNepaSubmissionColumn(headers, aliases) {
  var normalizedAliases = aliases.map(normalizeNepaSubmissionHeader);
  for (var i = 0; i < headers.length; i++) {
    if (normalizedAliases.indexOf(
      normalizeNepaSubmissionHeader(headers[i])
    ) !== -1) return i;
  }
  return -1;
}

function normalizeNepaSubmissionHeader(value) {
  return String(value || "").toLowerCase().replace(/[^a-z0-9]/g, "");
}

function ensureNepaSubmissionResultColumns(sheet, headers) {
  var columns = {
    status: findNepaSubmissionColumn(headers, ["Screening Status"]),
    reportUrl: findNepaSubmissionColumn(headers, ["Screening Report URL"]),
    mapUrl: findNepaSubmissionColumn(headers, ["Screening Map URL"]),
    error: findNepaSubmissionColumn(headers, ["Screening Error"]),
    completedAt: findNepaSubmissionColumn(headers, ["Timestamp Completed"]),
    folderId: findNepaSubmissionColumn(headers, ["Project Folder ID"])
  };
  var labels = {
    status: "Screening Status",
    reportUrl: "Screening Report URL",
    mapUrl: "Screening Map URL",
    error: "Screening Error",
    completedAt: "Timestamp Completed",
    folderId: "Project Folder ID"
  };
  var lastColumn = headers.length;
  Object.keys(columns).forEach(function(key) {
    if (columns[key] !== -1) {
      columns[key] += 1;
      return;
    }
    lastColumn += 1;
    columns[key] = lastColumn;
    sheet.getRange(NEPA_SUBMISSION_HEADER_ROW, lastColumn)
      .setValue(labels[key]);
  });
  columns.lastColumn = lastColumn;
  return columns;
}

function testNepaScreeningWithSampleKmz() {
  return runNepaScreening({
    kmzFileId: "1dRL0AdUFuRF8vtB5nRm0AdJTrdjynfak",
    projectName: "Buffalo Trus Run Bridge",
    stateProjectNumber: "TEST-KMZ",
    federalProjectNumber: "",
    projectType: "Bridge"
  });
}

function legend_rendering_test() {
  var title = "NEPA Legend Rendering Test";
  var copy = DriveApp.getFileById(NEPA_CONFIG.slidesTemplateId).makeCopy(title);
  var presentation = SlidesApp.openById(copy.getId());
  var slide = prepareNepaMapSlide(presentation, presentation.getSlides());
  var legendEntries = createNepaLegendRenderingTestEntries();
  drawMapViewportFrame(slide, NEPA_CONFIG.mapWidthPt, NEPA_CONFIG.mapHeightPt);
  addMapLegend(
    slide,
    legendEntries,
    NEPA_CONFIG.mapWidthPt,
    NEPA_CONFIG.mapHeightPt
  );
  moveDriveFileToFolder(copy.getId(), NEPA_CONFIG.outputFolderId);

  var pdfBlob = DriveApp.getFileById(copy.getId())
    .getAs(MimeType.PDF)
    .setName(title + ".pdf");
  var pdfFile = DriveApp.createFile(pdfBlob);
  moveDriveFileToFolder(pdfFile.getId(), NEPA_CONFIG.outputFolderId);

  var legendLabels = legendEntries.map(function(entry) { return entry.label; });
  Logger.log("Legend-rendering test Slides: " + copy.getUrl());
  Logger.log("Legend-rendering test PDF: " + pdfFile.getUrl());
  Logger.log("Legend entries rendered: " + legendLabels.join(" | "));
  return { slidesUrl: copy.getUrl(), pdfUrl: pdfFile.getUrl(), legendLabels: legendLabels };
}

function runLWCFScreeningTest() {
  const submissionPolygon = {
    type: "Polygon",
    coordinates: [[
      [-81.65, 38.33],
      [-81.60, 38.33],
      [-81.60, 38.37],
      [-81.65, 38.37],
      [-81.65, 38.33]
    ]]
  };

  const results = getLWCFScreeningData(submissionPolygon);

  // Directly access the two JSON FeatureSets
  const directIntersectJson = results.lwcfi;
  const bufferJson = results.lwcfb;

  Logger.log("Direct Intersect records: " + directIntersectJson.features.length);
  Logger.log("1-Mile Buffer records: " + bufferJson.features.length);

  // Pass directly into your downstream GeoJSON converter
  // const directGeoJSON = yourExistingGeoJsonConverter(directIntersectJson);
  // const bufferGeoJSON = yourExistingGeoJsonConverter(bufferJson);
}
