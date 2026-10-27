var NEPA_SHORT_SPAN_SHEET_NAME = "short_spans";
var NEPA_SHORT_SPAN_FIELD_HEADERS = {
  bridgeName: "bridge_name",
  barsNumber: "bars_number",
  yearBuilt: "year_built",
  bridgeType: "bridge_type",
  featureIntersected: "ss_feature_intersected",
  coRtMp: "ss_co_rt_mp",
  culvertPipeLength: "ss_culvert_pipe_length",
  totalBridgeLength: "total_bridge_length",
  nbisLength: "ss_nbis_length",
  widthOutToOut: "width_out_to_out",
  roadwayWidth: "ss_structure_roadway_width",
  bridgeAge: "bridge_age",
  location: "ss_location",
  narrative: "ss_narrative",
  deckMaterial: "ss_deck_material_type",
  material: "ss_material_type",
  notes: "ss_notes",
  substructureMaterial: "ss_substructure_material_type"
};
var NEPA_SHORT_SPAN_TABLE_HEADERS = [
  "Bridge Name", "BARS Number", "Year Built", "Bridge Type",
  "Feature Intersected", "CO-RT-MP", "Culvert/Pipe Length", "Length (ft)",
  "Width (ft)"
];
var NEPA_SHORT_SPAN_NARRATIVE_FIELDS = [
  ["bridgeAge", "Bridge Age"],
  ["location", "Location"],
  ["narrative", "Narrative"],
  ["deckMaterial", "Deck Material"],
  ["material", "Material"],
  ["substructureMaterial", "Substructure Material"],
  ["notes", "Notes"]
];

function sanitizeProjectFolderName(stateProjectNumber) {
  var name = String(stateProjectNumber || "")
    .replace(/[\\/]/g, "^")
    .replace(/[\u0000-\u001f:*?"<>|]/g, "")
    .trim();
  return name || "NEPA Screening";
}

function createNepaProjectFolder(stateProjectNumber, parentFolderId) {
  var name = sanitizeProjectFolderName(stateProjectNumber);
  var folder = parentFolderId
    ? DriveApp.getFolderById(parentFolderId).createFolder(name)
    : DriveApp.createFolder(name);
  return { id: folder.getId(), url: folder.getUrl(), name: name };
}

function isShortSpanProjectType(projectType) {
  return /^short[\s_-]*span/i.test(String(projectType || "").trim());
}

function shortSpanNumber(value) {
  if (value === null || value === undefined || String(value).trim() === "") return NaN;
  if (typeof value === "number") return value;
  return Number(String(value).replace(/,/g, "").trim());
}

function shortSpanText(value) {
  return value === null || value === undefined ? "" : String(value).trim();
}

function formatShortSpanNumber(value) {
  return isFinite(value) ? String(Math.round(value * 100) / 100) : "";
}

function buildShortSpanRecord(properties) {
  var lengths = [properties.totalBridgeLength, properties.nbisLength]
    .map(shortSpanNumber)
    .filter(function(value) { return isFinite(value) && value > 0; });
  var width = shortSpanText(properties.widthOutToOut) !== ""
    ? properties.widthOutToOut
    : properties.roadwayWidth;
  var narrative = [];
  NEPA_SHORT_SPAN_NARRATIVE_FIELDS.forEach(function(entry) {
    var value = shortSpanText(properties[entry[0]]);
    if (value) narrative.push({ label: entry[1], value: value });
  });
  return {
    properties: properties,
    row: [
      shortSpanText(properties.bridgeName),
      shortSpanText(properties.barsNumber),
      shortSpanText(properties.yearBuilt),
      shortSpanText(properties.bridgeType),
      shortSpanText(properties.featureIntersected),
      shortSpanText(properties.coRtMp),
      shortSpanText(properties.culvertPipeLength),
      lengths.length ? formatShortSpanNumber(Math.min.apply(null, lengths)) : "",
      isFinite(shortSpanNumber(width)) ? formatShortSpanNumber(shortSpanNumber(width)) : shortSpanText(width)
    ],
    narrative: narrative
  };
}

function loadShortSpanRows(spreadsheetId) {
  var sheet = SpreadsheetApp.openById(spreadsheetId).getSheetByName(NEPA_SHORT_SPAN_SHEET_NAME);
  if (!sheet) throw new Error("Google Sheets tab \"" + NEPA_SHORT_SPAN_SHEET_NAME + "\" was not found.");
  var values = sheet.getDataRange().getValues();
  if (values.length < 2) return [];
  var headers = values[0].map(function(header) {
    return String(header === null || header === undefined ? "" : header).trim().toLowerCase();
  });
  function column(header) { return headers.indexOf(header); }
  var latitudeColumn = column("latitude");
  var longitudeColumn = column("longitude");
  var rows = [];
  for (var r = 1; r < values.length; r++) {
    var properties = {};
    Object.keys(NEPA_SHORT_SPAN_FIELD_HEADERS).forEach(function(key) {
      var index = column(NEPA_SHORT_SPAN_FIELD_HEADERS[key]);
      properties[key] = index === -1 ? "" : values[r][index];
    });
    if (!Object.keys(properties).some(function(key) { return shortSpanText(properties[key]) !== ""; })) continue;
    // latitude/longitude columns are placeholders until the short_spans tab has them
    properties.latitude = latitudeColumn === -1 ? 4 : shortSpanNumber(values[r][latitudeColumn]);
    properties.longitude = longitudeColumn === -1 ? 5 : shortSpanNumber(values[r][longitudeColumn]);
    rows.push(properties);
  }
  return rows;
}

function findShortSpanRecords(rows, project, bridgeResult) {
  var turfApi = getTurfApi();
  var barsIds = {};
  ((bridgeResult && bridgeResult.features) || []).forEach(function(feature) {
    var id = shortSpanText((feature.properties || {}).barsid);
    if (id) barsIds[id] = true;
  });
  var matches = [];
  rows.forEach(function(properties) {
    var hasPoint = isFinite(properties.latitude) && isFinite(properties.longitude);
    var matched = false;
    if (hasPoint) {
      var point = {
        type: "Feature",
        properties: {},
        geometry: { type: "Point", coordinates: [properties.longitude, properties.latitude] }
      };
      matched = project.features.some(function(feature) {
        return turfApi.booleanIntersects(point, feature);
      });
    } else {
      // no coordinates yet: fall back to the BARS number found by the Bridge layer
      matched = !!barsIds[shortSpanText(properties.barsNumber)];
    }
    if (matched) matches.push(buildShortSpanRecord(properties));
  });
  return matches;
}

function getShortSpanData(project, bridgeResult) {
  var bridgeLayer = (NEPA_CONFIG.layers || []).filter(function(layer) {
    return layer.name === "Bridge";
  })[0];
  if (!bridgeLayer || !bridgeLayer.spreadsheetId) {
    throw new Error("The Bridge layer spreadsheet ID is not configured.");
  }
  return findShortSpanRecords(loadShortSpanRows(bridgeLayer.spreadsheetId), project, bridgeResult);
}

function appendShortSpanSection(body, records) {
  appendReportParagraph(body, "Short Span Bridge Table - " + records.length +
    " intersecting record" + (records.length === 1 ? "" : "s"), null, 11, false, { spacingBefore: 5 });
  if (!records.length) return;
  var table = body.appendTable([NEPA_SHORT_SPAN_TABLE_HEADERS].concat(records.map(function(record) {
    return record.row;
  })));
  for (var r = 0; r < table.getNumRows(); r++) {
    for (var c = 0; c < table.getRow(r).getNumCells(); c++) {
      var text = table.getCell(r, c).editAsText();
      text.setFontFamily("Roboto");
      text.setFontSize(8);
      text.setBold(r === 0);
    }
  }
  records.forEach(function(record) {
    if (!record.narrative.length) return;
    appendReportParagraph(body, record.row[0] || record.row[1] || "Short span", null, 10, true,
      { spacingBefore: 5 });
    record.narrative.forEach(function(entry) {
      appendReportParagraph(body, entry.label + ": " + entry.value, null, 10, false, { indentStart: 14.4 });
    });
  });
}

function appendShortSpanSectionSafely(body, records) {
  try {
    appendShortSpanSection(body, records);
  } catch (error) {
    appendReportFailure(body, "Short span table", error);
  }
}

function createNepaAbbreviatedDoc(analysis, outputFolderId) {
  var projectName = analysis.projectName || NEPA_CONFIG.projectName;
  var reportFile = DriveApp.getFileById(NEPA_CONFIG.reportTemplateId)
    .makeCopy(sanitizeDriveName(projectName + " - NEPA Abbreviated Screening Report"));
  var doc = DocumentApp.openById(reportFile.getId());
  var body = doc.getBody();
  body.clear();
  var results = getReportLayerResults(analysis.results);
  appendReportProjectHeader(body, analysis, results);
  if (isShortSpanProjectType(analysis.projectType)) {
    appendShortSpanSectionSafely(body, analysis.shortSpans || []);
  }
  removeEmptyParagraphsAfterTables(body);
  doc.saveAndClose();
  formatReportTableHeaderBorders(doc.getId());
  moveDriveFileToFolder(doc.getId(), outputFolderId);
  return { id: doc.getId(), url: doc.getUrl(), name: doc.getName() };
}

function exportNepaFileAsPdf(file, outputFolderId) {
  var blob = DriveApp.getFileById(file.id).getAs("application/pdf");
  blob.setName(sanitizeDriveName(file.name || "NEPA Screening").replace(/\.pdf$/i, "") + ".pdf");
  var pdf = outputFolderId
    ? DriveApp.getFolderById(outputFolderId).createFile(blob)
    : DriveApp.createFile(blob);
  return { id: pdf.getId(), url: pdf.getUrl(), name: pdf.getName() };
}

function setSpreadsheetContentRestriction(fileId, readOnly, reason) {
  var restriction = { readOnly: !!readOnly };
  if (readOnly && reason) restriction.reason = reason;
  var response = UrlFetchApp.fetch(
    "https://www.googleapis.com/drive/v3/files/" + encodeURIComponent(fileId) +
      "?supportsAllDrives=true&fields=id,contentRestrictions",
    {
      method: "patch",
      contentType: "application/json",
      headers: { Authorization: "Bearer " + ScriptApp.getOAuthToken() },
      payload: JSON.stringify({ contentRestrictions: [restriction] }),
      muteHttpExceptions: true
    }
  );
  var code = response.getResponseCode();
  return { ok: code >= 200 && code < 300, code: code, body: response.getContentText() };
}

function isSpreadsheetContentRestricted(fileId) {
  var response = UrlFetchApp.fetch(
    "https://www.googleapis.com/drive/v3/files/" + encodeURIComponent(fileId) +
      "?supportsAllDrives=true&fields=contentRestrictions",
    { headers: { Authorization: "Bearer " + ScriptApp.getOAuthToken() }, muteHttpExceptions: true }
  );
  if (response.getResponseCode() !== 200) return false;
  var restrictions = JSON.parse(response.getContentText()).contentRestrictions || [];
  return restrictions.some(function(item) { return item.readOnly; });
}
