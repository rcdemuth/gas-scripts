var NEPA_REPORT_FIELD_LABELS = {
  assessmentunitname: "Assessment Unit Name",
  barsid: "BARS No.",
  brnum: "Bridge Number",
  buffermile: "Buffer Mile",
  buffertype: "Buffer Type",
  cap_type: "Capture Type",
  d_des_tp: "Designation Type",
  featint: "Intersects",
  feattype: "Type",
  federal_land_access: "Federal Land Access",
  forestname: "Forest Name",
  gnis_name: "GNIS Name",
  histname: "Name",
  hu_10_name: "HUC 10 Name",
  hu_12_name: "HUC 12 Name",
  lengthft: "Length(ft)",
  loc_own: "Local Owner",
  locname: "Location Name",
  objectid: "Object ID",
  quad_name: "Quarter Quad",
  reachcode: "Reach Code",
  rivername: "River Name",
  roosttype: "Roost Type",
  resourcetype: "Type",
  site_id: "Site ID",
  streamgroup: "Stream Group",
  system_name: "System Name",
  unit_nm: "Unit Name",
  wetland_type: "Wetland Type",
  widthft: "Width(ft)",
  wv_strname: "WV Stream Name",
  yrblt: "Year Built"
};

var NEPA_REPORT_ABBREVIATIONS = {
  bars: "BARS",
  dep: "DEP",
  epa: "EPA",
  fas: "FAS",
  ft: "ft",
  gnis: "GNIS",
  huc: "HUC",
  id: "ID",
  nbi: "NBI",
  nhd: "NHD",
  nps: "NPS",
  nfs: "NFS",
  shpo: "SHPO",
  usace: "USACE",
  usgs: "USGS",
  wv: "WV",
  wvdot: "WVDOT"
};

function createNepaGoogleDoc(analysis, outputFolderId) {
  var projectName = analysis.projectName || NEPA_CONFIG.projectName;
  if (!NEPA_CONFIG.reportTemplateId) {
    throw new Error("Configure the Google Docs report template ID in Main.gs.");
  }
  var reportFile = DriveApp.getFileById(NEPA_CONFIG.reportTemplateId)
    .makeCopy(sanitizeDriveName(projectName + " - NEPA Screening"));
  var doc = DocumentApp.openById(reportFile.getId());
  var body = doc.getBody();
  body.clear();

  var isBridgeProject = isBridgeProjectType(analysis.projectType);
  var results = getReportLayerResults(analysis.results);
  appendReportProjectHeader(body, analysis, results);
  var summaryRows = createReportSummaryRows(results, isBridgeProject);

  appendReportLayerResults(body, results, isBridgeProject);
  var federalLandAccessResult = findResultByName(results, "Federal Land Access");
  if (federalLandAccessResult) {
    try {
      appendFederalLandAccessSection(body, federalLandAccessResult);
    } catch (error) {
      appendReportFailure(body, federalLandAccessResult.displayName || federalLandAccessResult.name, error);
    }
  }
  removeEmptyParagraphsAfterTables(body);

  doc.saveAndClose();
  appendScreeningSummaryTab(doc.getId(), summaryRows);
  if (analysis.boundaryProcessing) {
    appendBoundaryProcessingTab(doc.getId(), analysis.boundaryProcessing);
  }
  formatReportTableHeaderBorders(doc.getId());
  moveDriveFileToFolder(doc.getId(), outputFolderId);
  return { id: doc.getId(), url: doc.getUrl(), name: doc.getName() };
}

function appendReportProjectHeader(body, analysis, results) {
  var projectName = analysis.projectName || NEPA_CONFIG.projectName;
  appendReportParagraph(body, "NEPA Screening Report", DocumentApp.ParagraphHeading.TITLE, 13, true);
  appendReportParagraph(body, "Project Name: " + projectName, null, 13, true);
  if (analysis.stateProjectNumber) {
    appendReportParagraph(body, "State Number: " + analysis.stateProjectNumber, null, 13, true);
  }
  if (analysis.federalProjectNumber) {
    appendReportParagraph(body, "Federal Number: " + analysis.federalProjectNumber, null, 13, true);
  }

  var metadata = analysis.metadata || {};
  var bridgeResult = isBridgeProjectType(analysis.projectType) ? findResultByName(results, "Bridge") : null;
  appendProjectInformationLine(body, "County", metadata.countyNames);
  appendProjectInformationLine(body, "WVDOH District", metadata.wvdohDistrictNames);
  appendProjectInformationLine(body, "Quarter Quad", metadata.quadrangles);
  appendProjectInformationLine(body, "USACE District", metadata.usaceDistrictNames);
  appendProjectInformationLine(body, "Project Type", analysis.projectType);
  appendProjectCenterLines(body, metadata.center);
  if (bridgeResult) appendBridgeProjectDetailsSafely(body, bridgeResult);
  if (isShortSpanProjectType(analysis.projectType)) {
    appendShortSpanSectionSafely(body, analysis.shortSpans || []);
  }
}

function removeEmptyParagraphsAfterTables(body) {
  var childIndex = 1;
  while (childIndex < body.getNumChildren() - 1) {
    var previous = body.getChild(childIndex - 1);
    var current = body.getChild(childIndex);
    if (previous.getType() === DocumentApp.ElementType.TABLE &&
        current.getType() === DocumentApp.ElementType.PARAGRAPH &&
        current.asParagraph().getText().trim() === "") {
      body.removeChild(current);
      continue;
    }
    childIndex++;
  }
}

function appendReportLayerResults(body, results, isBridgeProject) {
  results.forEach(function(result) {
    if (result.name === "Federal Land Access") return;
    if (isBridgeProject && result.name === "Bridge" &&
        result.status === "YES" && result.features && result.features.length) return;
    try {
      appendReportLayerResult(body, result, isBridgeProject);
    } catch (error) {
      appendReportFailure(body, reportLayerDisplayName(result), error);
    }
  });
}

function appendReportFailure(body, label, error) {
  var detail = error && error.message ? error.message : String(error);
  Logger.log("Could not add report details for " + label + ": " + detail);
  try {
    appendReportParagraph(
      body,
      "REPORT ERROR - " + label + ": " + reportErrorMessage(detail),
      null,
      10,
      false,
      { indentStart: 14.4 }
    );
  } catch (markerError) {
    Logger.log("Could not add the report error marker for " + label + ": " +
      (markerError && markerError.message ? markerError.message : markerError));
  }
}

function appendReportLayerResult(body, result, isBridgeProject) {
  var label = reportLayerDisplayName(result);
  appendReportResultHeading(
    body,
    label,
    result.status,
    (result.features || []).length
  );
  if (result.status === "ERROR" || result.status === "WARNING") {
    appendReportParagraph(
      body,
      (result.status === "ERROR" ? "CHECK MANUALLY: " : "WARNING: ") +
        reportErrorMessage(result.error),
      null,
      10,
      false,
      { indentStart: 14.4 }
    );
    return;
  }
  if (result.status === "NO") return;
  if (result.truncated) {
    appendReportParagraph(body,
      "The query reached its record limit; the result list may be incomplete.",
      null,
      10,
      false,
      { indentStart: 14.4 }
    );
  }
  if (result.name === "High Box Turt Habitat") return;
  appendFeatureDetails(body, result);
}

function appendReportResultHeading(body, label, status, featureCount) {
  var suffix = status ? " - " + status : "";
  if (status === "YES" && featureCount > 0) {
    suffix += " - " + featureCount + " intersecting feature" +
      (featureCount === 1 ? "" : "s");
  }
  var paragraph = appendReportParagraph(
    body,
    label + suffix,
    null,
    10,
    false,
    { spacingBefore: 5, spacingAfter: 3 }
  );
  var text = paragraph.editAsText();
  text.setBold(0, label.length - 1, true);
}

function appendFederalLandAccessSection(body, result) {
  if (!result) return;
  if (result.status === "ERROR" || result.status === "WARNING") {
    appendReportLayerResult(body, result, false);
    return;
  }

  var features = result.features || [];
  if (features.length === 1) {
    var singleProperties = features[0].properties || {};
    appendReportResultHeading(
      body,
      reportLayerDisplayName(result),
      normalizeFederalLandAccessValue(propertyValue(singleProperties, "federal_land_access"))
    );
    return;
  }
  if (features.length > 1) {
    appendReportResultHeading(body, reportLayerDisplayName(result), "");
    features.forEach(function(feature) {
      var properties = feature.properties || {};
      var bridgeName = propertyValue(properties, "locname");
      if (bridgeName === null || bridgeName === undefined || String(bridgeName).trim() === "") {
        bridgeName = propertyValue(properties, "barsid");
      }
      if (bridgeName === null || bridgeName === undefined || String(bridgeName).trim() === "") {
        bridgeName = "Bridge";
      }
      var bullet = body.appendListItem(
        String(bridgeName) + ": " +
          normalizeFederalLandAccessValue(propertyValue(properties, "federal_land_access"))
      );
      bullet.setGlyphType(DocumentApp.GlyphType.BULLET);
      bullet.setIndentStart(23.4);
      bullet.setIndentFirstLine(14.4);
      appendReportParagraphStyle(bullet, 10, false);
    });
    return;
  }
  appendReportResultHeading(
    body,
    reportLayerDisplayName(result),
    result.status === "NO" ? "NO" : result.status
  );
}

function normalizeFederalLandAccessValue(value) {
  var text = String(value === null || value === undefined ? "" : value).trim();
  if (!text || /^N\s*-\s*Not applicable$/i.test(text) || /^No$/i.test(text)) return "NO";
  if (/^Yes$/i.test(text)) return "YES";
  return text;
}

function createReportSummaryRows(results, isBridgeProject) {
  var rows = [["Layer / check", "Result", "Features"]];
  results.forEach(function(result) {
    if (isBridgeProject && result.name === "Bridge" &&
        result.status === "YES" && result.features && result.features.length) return;
    rows.push([
      reportLayerDisplayName(result),
      result.summary || result.status,
      String(result.features ? result.features.length : 0) +
        (result.truncated ? " (truncated)" : "")
    ]);
  });
  rows[0] = rows[0].map(reportHeaderLabel);
  return rows;
}

function reportLayerDisplayName(result) {
  return String(result.displayName || result.name || "")
    .replace(/\bBox Turt\b/g, "Box Turtle");
}

function reportCellValue(value) {
  return value === null || value === undefined || String(value).trim() === ""
    ? "—"
    : String(value);
}

function appendReportParagraph(body, value, heading, fontSize, bold, formatting) {
  formatting = formatting || {};
  var paragraph = null;
  if (body.getNumChildren && body.getNumChildren() === 1 &&
      body.getChild(0).getType() === DocumentApp.ElementType.PARAGRAPH &&
      body.getChild(0).asParagraph().getText() === "") {
    paragraph = body.getChild(0).asParagraph();
    paragraph.setText(String(value));
  } else {
    paragraph = body.appendParagraph(String(value));
  }
  if (heading) paragraph.setHeading(heading);
  paragraph.setLineSpacing(1.0);
  paragraph.setSpacingBefore(formatting.spacingBefore === undefined ? 0 : formatting.spacingBefore);
  paragraph.setSpacingAfter(formatting.spacingAfter === undefined ? 0 : formatting.spacingAfter);
  if (formatting.indentStart !== undefined) paragraph.setIndentStart(formatting.indentStart);
  if (formatting.indentFirstLine !== undefined) paragraph.setIndentFirstLine(formatting.indentFirstLine);
  var text = paragraph.editAsText();
  text.setFontFamily("Roboto");
  text.setFontSize(fontSize);
  text.setBold(!!bold);
  text.setUnderline(false);
  return paragraph;
}

function appendProjectCenterLines(body, center) {
  if (!center || center.length < 2) return;
  appendReportParagraph(
    body,
    "ECZ Center Latitude: " + formatReportCoordinate(center[1]),
    null,
    11,
    false
  );
  appendReportParagraph(
    body,
    "ECZ Center Longitude: " + formatReportCoordinate(center[0]),
    null,
    11,
    false
  );
}

function formatReportCoordinate(value) {
  var number = Number(value);
  if (!isFinite(number)) return String(value);
  return number.toFixed(6).replace(/0+$/, "").replace(/\.$/, "");
}

function appendBarsCoordinateLines(body, bridgeResult) {
  if (!bridgeResult || bridgeResult.status !== "YES") return;
  (bridgeResult.features || []).forEach(function(feature) {
    var properties = feature.properties || {};
    var latitude = propertyValue(properties, "latitude");
    var longitude = propertyValue(properties, "longitude");
    if (latitude !== null && latitude !== undefined && latitude !== "") {
      appendReportParagraph(body, "BARS Latitude: " + formatReportCoordinate(latitude), null, 11, false);
    }
    if (longitude !== null && longitude !== undefined && longitude !== "") {
      appendReportParagraph(body, "BARS Longitude: " + formatReportCoordinate(longitude), null, 11, false);
    }
  });
}

function appendBridgeProjectDetails(body, bridgeResult) {
  if (!bridgeResult || bridgeResult.status !== "YES" ||
      !bridgeResult.features || !bridgeResult.features.length) return;
  appendBarsCoordinateLines(body, bridgeResult);
  appendBridgeNumberLine(body, bridgeResult);
  var featureCount = bridgeResult.features.length;
  var tableTitle = "Bridge Table - " + featureCount + " intersecting feature" +
    (featureCount === 1 ? "" : "s");
  appendReportParagraph(body, tableTitle, null, 11, false, {
    spacingBefore: 5,
    weightedFontWeight: 500
  });
  appendFeatureDetails(body, bridgeResult);
}

function appendBridgeProjectDetailsSafely(body, bridgeResult) {
  try {
    appendBridgeProjectDetails(body, bridgeResult);
  } catch (error) {
    appendReportFailure(body, "Bridge table", error);
  }
}

function appendBridgeNumberLine(body, bridgeResult) {
  if (!bridgeResult || bridgeResult.status !== "YES") return;
  var bridgeNumbers = [];
  (bridgeResult.features || []).forEach(function(feature) {
    var value = propertyValue(feature.properties || {}, "brnum");
    if (value === null || value === undefined || String(value).trim() === "") return;
    if (bridgeNumbers.indexOf(String(value)) === -1) bridgeNumbers.push(String(value));
  });
  if (bridgeNumbers.length) {
    appendReportParagraph(body, "Bridge Number: " + bridgeNumbers.join(", "), null, 11, false);
  }
}

function isBridgeProjectType(projectType) {
  return String(projectType || "").trim().toLowerCase() === "bridge";
}

function getReportLayerResults(results) {
  var projectInformationLayers = ["County", "Quarter Quad", "USACE_Districts"];
  return results.filter(function(result) {
    return projectInformationLayers.indexOf(result.name) === -1;
  });
}

function appendProjectInformationLine(body, label, values) {
  if (values === null || values === undefined) return;
  var list = Array.isArray(values) ? values : [values];
  list = list.filter(function(value) {
    return value !== null && value !== undefined && String(value).trim() !== "";
  });
  if (list.length) appendReportParagraph(body, label + " - " + list.join(", "), null, 11, false);
}

function reportHeaderLabel(fieldName) {
  var field = String(fieldName || "").trim();
  var mapped = NEPA_REPORT_FIELD_LABELS[field.toLowerCase()];
  if (mapped) return mapped;
  return field
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/_/g, " ")
    .split(/\s+/)
    .map(function(word) {
      var lower = word.toLowerCase();
      return NEPA_REPORT_ABBREVIATIONS[lower] ||
        (word ? lower.charAt(0).toUpperCase() + lower.slice(1) : "");
    })
    .join(" ");
}

function reportErrorMessage(error) {
  var message = String(error || "Screening could not be completed.");
  if (/Configure the Drive GeoJSON file ID/i.test(message)) {
    return "The configured local screening dataset could not be loaded.";
  }
  return message.replace(/https?:\/\/\S+?:(?=\s)/g, "the configured service:");
}

function appendReportTable(body, rows, tableType) {
  var isBridgeTable = tableType === "Bridge";
  var tableRows = rows.map(function(row) {
    return isBridgeTable ? row.slice() : [""].concat(row);
  });
  var table = body.appendTable(tableRows);
  styleReportTable(table, tableRows, tableType, rows, reportTableAvailableWidth(body));
  return table;
}

function styleReportTable(table, rows, tableType, sourceRows, maxTableWidth) {
  table.setBorderWidth(0.5);
  var columnCount = rows.length ? rows[0].length : 0;
  for (var rowIndex = 0; rowIndex < table.getNumRows(); rowIndex++) {
    var row = table.getRow(rowIndex);
    for (var columnIndex = 0; columnIndex < columnCount; columnIndex++) {
      var cell = row.getCell(columnIndex);
      cell.setPaddingTop(1.08);
      cell.setPaddingBottom(1.08);
      cell.setPaddingLeft(1.08);
      cell.setPaddingRight(1.08);
      cell.setVerticalAlignment(DocumentApp.VerticalAlignment.CENTER);
      var cellText = cell.editAsText();
      cellText.setFontFamily("Roboto");
      cellText.setFontSize(10);
      cellText.setBold(false);
      cellText.setUnderline(false);
      for (var childIndex = 0; childIndex < cell.getNumChildren(); childIndex++) {
        var child = cell.getChild(childIndex);
        if (child.getType() === DocumentApp.ElementType.PARAGRAPH) {
          var paragraph = child.asParagraph();
          paragraph.setLineSpacing(1.0);
          paragraph.setSpacingBefore(0);
          paragraph.setSpacingAfter(0);
        }
      }
    }
  }
  reportTableColumnWidths(
    sourceRows || rows,
    tableType,
    tableType !== "Bridge",
    maxTableWidth
  ).forEach(function(width, index) {
    table.setColumnWidth(index, width);
  });
}

function reportTableAvailableWidth(body) {
  if (!body || typeof body.getPageWidth !== "function" ||
      typeof body.getMarginLeft !== "function" ||
      typeof body.getMarginRight !== "function") return 522;
  var availableWidth = Number(body.getPageWidth()) -
    Number(body.getMarginLeft()) - Number(body.getMarginRight());
  if (!isFinite(availableWidth) || availableWidth <= 0) {
    throw new Error("Could not determine the report page's available table width.");
  }
  return availableWidth;
}

function reportTableColumnWidths(rows, tableType, includeIndent, maxTableWidth) {
  if (!rows.length || !rows[0].length) return [];
  maxTableWidth = Number(maxTableWidth);
  if (!isFinite(maxTableWidth) || maxTableWidth <= 0) maxTableWidth = 522;
  if (tableType === "Architectural") {
    var architecturalWidths = architecturalReportTableColumnWidths(rows);
    var minimumWidths = architecturalWidths.minimumWidths;
    var groupCount = (rows[0].length + 1) / 4;
    var architecturalTotal = 14.4 + architecturalWidths.reduce(function(sum, width) {
      return sum + width;
    }, 0);
    for (var shrinkIndex = 0;
        architecturalTotal > maxTableWidth && shrinkIndex < 3;
        shrinkIndex++) {
      var fieldIndex = [1, 2, 0][shrinkIndex];
      var availableReduction = Math.max(0, architecturalWidths[fieldIndex] - minimumWidths[fieldIndex]) * groupCount;
      var reduction = Math.min(availableReduction, architecturalTotal - maxTableWidth);
      if (!reduction) continue;
      architecturalWidths[fieldIndex] -= reduction / groupCount;
      architecturalTotal -= reduction;
    }
    if (architecturalTotal > maxTableWidth) {
      var spacerWidth = 8 * (groupCount - 1);
      var indentWidth = 14.4;
      var availableDataWidth = maxTableWidth - spacerWidth - indentWidth;
      if (availableDataWidth <= 0) {
        throw new Error("The report page is too narrow for the Architectural table.");
      }
      var naturalDataWidth = architecturalWidths.reduce(function(sum, width) {
        return sum + width;
      }, 0) - spacerWidth;
      var dataScale = availableDataWidth / naturalDataWidth;
      architecturalWidths = architecturalWidths.map(function(width, index) {
        return index % 4 === 3 ? width : width * dataScale;
      });
    }
    return [14.4].concat(architecturalWidths);
  }
  var columnCount = rows[0].length;
  var widths = [];
  var minimumWidths = [];
  for (var columnIndex = 0; columnIndex < columnCount; columnIndex++) {
    var maxLength = 0;
    var headerLength = 0;
    for (var rowIndex = 0; rowIndex < rows.length; rowIndex++) {
      var value = rows[rowIndex][columnIndex];
      var lines = String(value === null || value === undefined ? "" : value).split(/\r?\n/);
      for (var lineIndex = 0; lineIndex < lines.length; lineIndex++) {
        maxLength = Math.max(maxLength, lines[lineIndex].length);
        if (rowIndex === 0) {
          headerLength = Math.max(headerLength, lines[lineIndex].length);
        }
      }
    }
    var isFinalColumn = columnIndex === columnCount - 1;
    var padding = isFinalColumn ? 6.16 : 21.76;
    widths.push(Math.max(26, maxLength * 5.2 + padding));
    minimumWidths.push(Math.max(26, headerLength * 5.2 + padding));
  }

  if (includeIndent) {
    widths.unshift(14.4);
    minimumWidths.unshift(14.4);
  }
  var totalWidth = widths.reduce(function(sum, width) { return sum + width; }, 0);
  if (totalWidth > maxTableWidth) {
    var minimumTotal = minimumWidths.reduce(function(sum, width) { return sum + width; }, 0);
    if (minimumTotal >= maxTableWidth) {
      var scale = maxTableWidth / minimumTotal;
      widths = minimumWidths.map(function(width) { return width * scale; });
    } else {
      var availableForContent = maxTableWidth - minimumTotal;
      var naturalContentWidth = totalWidth - minimumTotal;
      var contentScale = naturalContentWidth > 0
        ? Math.min(1, availableForContent / naturalContentWidth)
        : 0;
      widths = widths.map(function(width, index) {
        return minimumWidths[index] +
          (width - minimumWidths[index]) * contentScale;
      });
    }
    if (includeIndent && minimumTotal >= maxTableWidth) {
      widths[0] = 14.4;
      var dataWidth = maxTableWidth - 14.4;
      var minimumDataWidth = minimumTotal - 14.4;
      var dataScale = minimumDataWidth > 0 ? dataWidth / minimumDataWidth : 0;
      for (var dataIndex = 1; dataIndex < widths.length; dataIndex++) {
        widths[dataIndex] = minimumWidths[dataIndex] * dataScale;
      }
    }
    if (widths.some(function(width) { return !isFinite(width) || width <= 0; })) {
      throw new Error("Could not determine valid report table column widths.");
    }
  }
  return widths;
}

function architecturalReportTableColumnWidths(rows) {
  var columnCount = rows[0].length;
  var groupCount = (columnCount + 1) / 4;
  var spacerWidth = 8;
  var fieldWidths = [68.56, 42.56, 42.56];
  var minimumWidths = [
    9 * 5.2 + 21.76,
    "Name".length * 5.2 + 21.76,
    "Type".length * 5.2 + 21.76
  ];
  for (var groupIndex = 0; groupIndex < groupCount; groupIndex++) {
    for (var fieldIndex = 0; fieldIndex < 3; fieldIndex++) {
      var columnIndex = groupIndex * 4 + fieldIndex;
      for (var rowIndex = 0; rowIndex < rows.length; rowIndex++) {
        var value = rows[rowIndex][columnIndex];
        var lines = String(value === null || value === undefined ? "" : value).split(/\r?\n/);
        var linePadding = fieldIndex === 2 && groupIndex === groupCount - 1 ? 6.16 : 21.76;
        for (var lineIndex = 0; lineIndex < lines.length; lineIndex++) {
          fieldWidths[fieldIndex] = Math.max(
            fieldWidths[fieldIndex],
            lines[lineIndex].length * 5.2 + linePadding
          );
        }
      }
    }
  }

  var widths = [];
  for (var outputGroupIndex = 0; outputGroupIndex < groupCount; outputGroupIndex++) {
    if (outputGroupIndex > 0) widths.push(spacerWidth);
    widths.push(fieldWidths[0], fieldWidths[1], fieldWidths[2]);
  }
  widths.minimumWidths = minimumWidths;
  return widths;
}

function formatReportTableHeaderBorders(documentId) {
  var documentData = Docs.Documents.get(documentId, { includeTabsContent: true });
  if (!documentData.tabs || !documentData.tabs.length) {
    throw new Error("Google Docs did not return tab content for table formatting.");
  }
  var requests = [];
  documentData.tabs.forEach(function(tab) {
    collectReportTableRequests(tab, requests);
  });
  if (requests.length) Docs.Documents.batchUpdate({ requests: requests }, documentId);
}

function collectReportTableRequests(tab, requests) {
  var tabId = tab.tabProperties && tab.tabProperties.tabId;
  var content = tab.documentTab && tab.documentTab.body && tab.documentTab.body.content || [];
  content.forEach(function(element) {
    var table = element.table;
    if (!table || !table.tableRows || !table.tableRows.length) return;
    var headerCells = table.tableRows[0].tableCells || [];
    if (!headerCells.length) throw new Error("Google Docs returned a table without header cells.");
    if (element.startIndex === undefined || !tabId) {
      throw new Error("Google Docs did not return the location or tab ID for a report table.");
    }
    var columnCount = headerCells.length;
    var hasIndent = reportTableCellText(headerCells[0]) === "" &&
      reportTableCellText(headerCells[1]) !== "";
    var isArchitectural = reportTableCellText(headerCells[hasIndent ? 1 : 0]) === "Site ID";
    var dataColumns = [];
    for (var columnIndex = 0; columnIndex < columnCount; columnIndex++) {
      var label = reportTableCellText(headerCells[columnIndex]);
      if (hasIndent && columnIndex === 0) continue;
      if (isArchitectural && label === "" && columnIndex > 0) continue;
      dataColumns.push(columnIndex);
    }
    requests.push(reportTableCellStyleRequest(
      element.startIndex, tabId, 0, 0, table.tableRows.length, columnCount,
      reportTableInvisibleBorders(), "borderTop,borderBottom,borderLeft,borderRight"
    ));
    requests.push(reportTableCellStyleRequest(
      element.startIndex, tabId, 0, 0, 1, columnCount,
      reportTableBorderStyle(0.5, ["borderTop"]), "borderTop"
    ));
    requests.push(reportTableCellStyleRequest(
      element.startIndex, tabId, 0, 0, 1, columnCount,
      reportTableBorderStyle(1, ["borderBottom"]), "borderBottom"
    ));
    if (hasIndent) {
      requests.push(reportTableCellStyleRequest(
        element.startIndex, tabId, 0, 0, table.tableRows.length, 1,
        reportTableInvisibleBorders(), "borderTop,borderBottom,borderLeft,borderRight"
      ));
      if (dataColumns.length) {
        requests.push(reportTableCellStyleRequest(
          element.startIndex, tabId, 0, dataColumns[0], table.tableRows.length, 1,
          reportTableInvisibleBorders(), "borderLeft"
        ));
      }
    }
    if (isArchitectural) {
      for (var spacerIndex = 0; spacerIndex < columnCount; spacerIndex++) {
        if (reportTableCellText(headerCells[spacerIndex]) !== "") continue;
        requests.push(reportTableCellStyleRequest(
          element.startIndex, tabId, 0, spacerIndex, table.tableRows.length, 1,
          reportTableInvisibleBorders(), "borderTop,borderBottom,borderLeft,borderRight"
        ));
        if (spacerIndex > 0) {
          requests.push(reportTableCellStyleRequest(
            element.startIndex, tabId, 0, spacerIndex - 1, table.tableRows.length, 1,
            reportTableInvisibleBorders(), "borderRight"
          ));
          requests.push(reportTableCellStyleRequest(
            element.startIndex, tabId, 0, spacerIndex + 1, table.tableRows.length, 1,
            reportTableInvisibleBorders(), "borderLeft"
          ));
        }
      }
    }
    var dataColumnGroups = reportTableDataColumnGroups(dataColumns);
    dataColumnGroups.forEach(function(group) {
      var runStart = -1;
      for (var rowIndex = 1; rowIndex <= table.tableRows.length; rowIndex++) {
        var hasValues = rowIndex < table.tableRows.length &&
          (!isArchitectural || group.some(function(groupColumn) {
            return reportTableCellText(
              table.tableRows[rowIndex].tableCells[groupColumn]
            ).trim() !== "";
          }));
        if (hasValues && runStart === -1) runStart = rowIndex;
        if ((!hasValues || rowIndex === table.tableRows.length) &&
            runStart !== -1) {
          var rowSpan = rowIndex - runStart;
          for (var groupColumnIndex = 0;
              groupColumnIndex < group.length - 1;
              groupColumnIndex++) {
            requests.push(reportTableCellStyleRequest(
              element.startIndex,
              tabId,
              runStart,
              group[groupColumnIndex],
              rowSpan,
              1,
              reportTableBorderStyle(0.5, ["borderRight"]),
              "borderRight"
            ));
          }
          runStart = -1;
        }
      }
    });
    headerCells.forEach(function(cell) {
      collectReportHeaderTextRequests(cell, tabId, requests);
    });
  });
  collectReportParagraphFontRequests(content, tabId, requests);
  (tab.childTabs || []).forEach(function(childTab) {
    collectReportTableRequests(childTab, requests);
  });
}

function reportTableDataColumnGroups(dataColumns) {
  var groups = [];
  dataColumns.forEach(function(columnIndex) {
    var group = groups.length ? groups[groups.length - 1] : null;
    if (!group || group[group.length - 1] + 1 !== columnIndex) {
      group = [];
      groups.push(group);
    }
    group.push(columnIndex);
  });
  return groups;
}

function reportTableCellStyleRequest(startIndex, tabId, rowIndex, columnIndex, rowSpan, columnSpan,
                                     tableCellStyle, fields) {
  return {
    updateTableCellStyle: {
      tableRange: {
        tableCellLocation: {
          tableStartLocation: { index: startIndex, tabId: tabId },
          rowIndex: rowIndex,
          columnIndex: columnIndex
        },
        rowSpan: rowSpan,
        columnSpan: columnSpan
      },
      tableCellStyle: tableCellStyle,
      fields: fields
    }
  };
}

function reportTableBorderStyle(width, borderNames) {
  var style = {};
  borderNames.forEach(function(name) {
    style[name] = {
      color: { color: { rgbColor: { red: 0, green: 0, blue: 0 } } },
      width: { magnitude: width, unit: "PT" },
      dashStyle: "SOLID"
    };
  });
  return style;
}

function reportTableInvisibleBorders() {
  var invisible = {
    color: { color: { rgbColor: { red: 1, green: 1, blue: 1 } } },
    width: { magnitude: 0, unit: "PT" },
    dashStyle: "SOLID"
  };
  return {
    borderTop: invisible,
    borderBottom: invisible,
    borderLeft: invisible,
    borderRight: invisible
  };
}

function reportTableCellText(cell) {
  var text = "";
  (cell.content || []).forEach(function(content) {
    (content.paragraph && content.paragraph.elements || []).forEach(function(element) {
      if (element.textRun) text += element.textRun.content || "";
    });
  });
  return text.replace(/\n$/, "");
}

function collectReportHeaderTextRequests(cell, tabId, requests) {
  (cell.content || []).forEach(function(content) {
    (content.paragraph && content.paragraph.elements || []).forEach(function(element) {
      if (!element.textRun || element.startIndex === undefined) return;
      var text = element.textRun.content || "";
      if (!text.replace(/\s/g, "")) return;
      requests.push({
        updateTextStyle: {
          range: {
            startIndex: element.startIndex,
            endIndex: element.startIndex + text.replace(/\n$/, "").length,
            tabId: tabId
          },
          textStyle: { weightedFontFamily: { fontFamily: "Roboto", weight: 600 } },
          fields: "weightedFontFamily"
        }
      });
    });
  });
}

function collectReportParagraphFontRequests(content, tabId, requests) {
  content.forEach(function(element) {
    if (!element.paragraph || element.startIndex === undefined) return;
    var text = "";
    (element.paragraph.elements || []).forEach(function(part) {
      if (part.textRun) text += part.textRun.content || "";
    });
    var layerMatch = text.match(
      /^(.*?) - (?:YES|NO|ERROR|WARNING)(?: - \d+ intersecting features?)?\s*$/
    );
    var weight = null;
    var length = 0;
    if (layerMatch) {
      weight = 900;
      length = layerMatch[1].length;
    } else if (/^Bridge Table(?: - \d+ intersecting features?)?\s*$/.test(text)) {
      weight = 500;
      length = "Bridge Table".length;
    }
    if (weight === null || !length) return;
    requests.push({
      updateTextStyle: {
        range: {
          startIndex: element.startIndex,
          endIndex: element.startIndex + length,
          tabId: tabId
        },
        textStyle: { weightedFontFamily: { fontFamily: "Roboto", weight: weight } },
        fields: "weightedFontFamily"
      }
    });
  });
}

function appendScreeningSummaryTab(documentId, summaryRows) {
  var tabTitle = "Screening Summary";
  var response = Docs.Documents.batchUpdate({
    requests: [{
      addDocumentTab: {
        tabProperties: { title: tabTitle }
      }
    }]
  }, documentId);
  var addTabReply = response.replies && response.replies[0] && response.replies[0].addDocumentTab;
  var tabId = addTabReply && addTabReply.tabProperties && addTabReply.tabProperties.tabId;
  if (!tabId) throw new Error("Google Docs did not return the new screening summary tab ID.");

  var doc = DocumentApp.openById(documentId);
  var tab = doc.getTab(tabId);
  if (!tab) throw new Error("Google Docs could not open the new screening summary tab.");
  var body = tab.asDocumentTab().getBody();
  body.clear();
  body.setMarginLeft(36);
  body.setMarginRight(36);
  appendReportParagraph(body, tabTitle, DocumentApp.ParagraphHeading.HEADING1, 11, true);
  appendReportTable(body, summaryRows);
  doc.saveAndClose();
}

function appendBoundaryProcessingTab(documentId, boundaryProcessing) {
  var tabTitle = "Boundary selection and repair";
  var response = Docs.Documents.batchUpdate({
    requests: [{
      addDocumentTab: {
        tabProperties: { title: tabTitle }
      }
    }]
  }, documentId);
  var addTabReply = response.replies && response.replies[0] && response.replies[0].addDocumentTab;
  var tabId = addTabReply && addTabReply.tabProperties && addTabReply.tabProperties.tabId;
  if (!tabId) throw new Error("Google Docs did not return the new boundary tab ID.");

  var doc = DocumentApp.openById(documentId);
  var tab = doc.getTab(tabId);
  if (!tab) throw new Error("Google Docs could not open the new boundary tab.");
  var body = tab.asDocumentTab().getBody();
  body.clear();
  body.setMarginLeft(36);
  body.setMarginRight(36);
  appendReportParagraph(body, tabTitle, DocumentApp.ParagraphHeading.HEADING1, 11, true);

  var tableRows = [["Boundary processing item", "Details"]];
  appendBoundaryTableRow(tableRows, "Selection rule", boundaryProcessing.selectionRule);
  appendBoundaryTableRow(tableRows, "Input KML placemarks", boundaryProcessing.sourceFeatureCount);
  appendBoundaryTableRow(tableRows, "Selected ECZ features", boundaryProcessing.selectedFeatureCount);
  appendBoundaryTableRow(tableRows, "Selected feature(s)", boundaryProcessing.selectedNames);
  appendBoundaryTableRow(tableRows, "Input geometry types", boundaryProcessing.inputGeometryTypes);
  appendBoundaryTableRow(tableRows, "Output geometry", boundaryProcessing.outputGeometryType);
  appendBoundaryTableRow(tableRows, "Processing steps", boundaryProcessing.processingSteps);
  var boundaryWarnings = (boundaryProcessing.warnings || []).filter(function(warning) {
    return !/^Shapefile ZIP was not created:/i.test(String(warning));
  });
  appendBoundaryTableRow(tableRows, "Boundary warnings", boundaryWarnings);
  tableRows[0] = tableRows[0].map(reportHeaderLabel);
  appendReportTable(body, tableRows);
  doc.saveAndClose();
}

function appendBoundaryTableRow(rows, label, value) {
  if (value === null || value === undefined || value === "") return;
  if (Array.isArray(value)) {
    if (!value.length) return;
    value = value.join("; ");
  }
  rows.push([label, String(value)]);
}

function appendFeatureDetails(body, result) {
  var configLayer = getNepaLayer(result.name);
  var fields = configLayer && configLayer.fields
    ? configLayer.fields
    : NEPA_CONFIG.detailFields[result.name];
  if (!fields || !fields.length) return;

  var maxRows = 500;
  if (result.name === "Architectural Point" || result.name === "Architectural Poly") {
    appendArchitecturalFeatureDetails(body, result, maxRows);
    return;
  }
  if (fields.length === 1) {
    var featureCount = Math.min(result.features.length, maxRows);
    for (var featureIndex = 0; featureIndex < featureCount; featureIndex++) {
      var properties = result.features[featureIndex].properties || {};
      var value = propertyValue(properties, fields[0]);
      var bullet = body.appendListItem(
        reportCellValue(value)
      );
      bullet.setGlyphType(DocumentApp.GlyphType.BULLET);
      bullet.setIndentStart(23.4);
      bullet.setIndentFirstLine(14.4);
      appendReportParagraphStyle(bullet, 10, false);
    }
    if (result.features.length > maxRows) {
      appendReportParagraph(body,
        "Feature list limited to " + maxRows + " of " + result.features.length + " returned features.",
        null,
        10,
        false,
        { indentStart: 14.4 }
      );
    }
    return;
  }

  var tableRows = [fields];
  var featureCount = Math.min(result.features.length, maxRows);
  for (var i = 0; i < featureCount; i++) {
    var properties = result.features[i].properties || {};
    tableRows.push(fields.map(function(field) {
      var value = propertyValue(properties, field);
      if (result.name === "Bridge" && String(field).toLowerCase() === "historic") {
        value = summarizeBridgeHistoricValue(value);
      }
      return reportCellValue(value);
    }));
  }
  tableRows[0] = tableRows[0].map(function(field) {
    return reportHeaderLabel(field);
  });
  if (tableRows.length > 1) appendReportTable(body, tableRows, result.name);
  if (result.features.length > maxRows) {
    appendReportParagraph(body,
      "Detail table limited to " + maxRows + " of " + result.features.length + " returned features.",
      null,
      10,
      false,
      { indentStart: 14.4 }
    );
  }
}

function appendArchitecturalFeatureDetails(body, result, maxRows) {
  var fields = ["site_id", "histname", "resourcetype"];
  var featureCount = Math.min(result.features.length, maxRows);
  if (!featureCount) return;

  var groupCount = featureCount > 15 ? 3 : featureCount > 5 ? 2 : 1;
  var maxTableWidth = reportTableAvailableWidth(body);
  var tableRows;
  while (groupCount > 1) {
    tableRows = createArchitecturalReportRows(result.features, featureCount, fields, groupCount);
    var naturalWidths = [14.4].concat(architecturalReportTableColumnWidths(tableRows));
    if (naturalWidths.reduce(function(sum, width) { return sum + width; }, 0) <= maxTableWidth) break;
    groupCount--;
  }
  tableRows = createArchitecturalReportRows(result.features, featureCount, fields, groupCount);
  appendReportTable(body, tableRows, "Architectural");

  if (result.features.length > maxRows) {
    appendReportParagraph(body,
      "Detail table limited to " + maxRows + " of " + result.features.length + " returned features.",
      null,
      10,
      false,
      { indentStart: 14.4 }
    );
  }
}

function createArchitecturalReportRows(features, featureCount, fields, groupCount) {
  var rowsPerGroup = Math.ceil(featureCount / groupCount);
  var tableRows = [[
    "Site ID", "Name", "Type"
  ]];
  for (var groupIndex = 1; groupIndex < groupCount; groupIndex++) {
    tableRows[0].push("", "Site ID", "Name", "Type");
  }

  for (var rowIndex = 0; rowIndex < rowsPerGroup; rowIndex++) {
    var row = [];
    for (var dataGroupIndex = 0; dataGroupIndex < groupCount; dataGroupIndex++) {
      if (dataGroupIndex > 0) row.push("");
      var featureIndex = dataGroupIndex * rowsPerGroup + rowIndex;
      var feature = featureIndex < featureCount ? features[featureIndex] : null;
      var properties = feature && feature.properties || {};
      fields.forEach(function(field) {
        if (!feature) {
          row.push("");
          return;
        }
        var value = propertyValue(properties, field);
        row.push(reportCellValue(value));
      });
    }
    tableRows.push(row);
  }
  return tableRows;
}

function summarizeBridgeHistoricValue(value) {
  var text = String(value === null || value === undefined ? "" : value);
  var match = text.match(/^\s*([34567N])\s*-/i);
  if (!match) return value;
  var summaries = {
    "3": "3 - Contributing structure in a listed or eligible district",
    "4": "4 - Noncontributing/eligible structure in a listed or eligible district",
    "5": "5 - Unevaluated potentially eligible structure or contributing structure",
    "6": "6 - Listed at the State/Local level, ineligible for NRHP",
    "7": "7 - Undetermined significance",
    "N": "N - Not eligible for the NRHP"
  };
  return summaries[match[1].toUpperCase()];
}

function appendReportParagraphStyle(paragraph, fontSize, bold) {
  paragraph.setLineSpacing(1.0);
  paragraph.setSpacingBefore(0);
  paragraph.setSpacingAfter(0);
  var text = paragraph.editAsText();
  text.setFontFamily("Roboto");
  text.setFontSize(fontSize);
  text.setBold(!!bold);
  text.setUnderline(false);
}

function moveDriveFileToFolder(fileId, folderId) {
  if (!folderId) return;
  DriveApp.getFileById(fileId).moveTo(DriveApp.getFolderById(folderId));
}

function sanitizeDriveName(name) {
  return String(name || "NEPA Screening").replace(/[\\/:*?"<>|]/g, "_").trim();
}
