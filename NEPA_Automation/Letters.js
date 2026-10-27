/**
 * Configuration Constants
 */
const CONFIG = {
  SPREADSHEET_ID: "1gR_bFgn02BXs4il3utFUUTZ7zOM7qtjnRW-didoPRfo",
  DNR_TEMPLATE_ID: "1LKQWxtNz0JfJVDaSXirMh7IWV12X4YSl2iGljwajKfs",
  SEC408_TEMPLATE_ID: "1-KHMOyF2CS0U4ylaGPRQhCsuEO4lXYKZrhYRd8lu2Xk",
  CORP_CONTACTS: [
    ["Huntington", "Brett C. Latta", "Brett.C.Latta@usace.army.mil", "LRH404408@usace.army.mil", "U.S. Army Corps of Engineers\nHuntington District\nATTN: Section 408 Coordinator\n502 8th Street\nHuntington, WV 25701-2070"],
    ["Pittsburgh", "Benjamin Sakmar", "Benjamin.M.Sakmar@usace.army.mil", "Dll-celrp-sec408@usace.army.mil", "U.S. Army Corps of Engineers\nPittsburgh District\nATTN: Section 408 Coordinator\n1000 Liberty Avenue\nPittsburgh, PA 15222-4186"],
    ["Norfolk", "", "", "nao.section408@usace.army.mil", "U.S. Army Corps of Engineers\nNorfolk District\nATTN: Section 408 Coordinator\n803 Front Street\nNorfolk, VA 23510-1096"],
    ["Baltimore", "Joseph W. Chandler", "Joseph.W.Chandler@usace.army.mil", "nab-regulatory@usace.army.mil", "U.S. Army Corps of Engineers\nBaltimore District\nATTN: Section 408 Coordinator\n2 Hopkins Plaza\nBaltimore, MD 21201-2930"]
  ]
};

// Compact Arrow Helpers (Reuses global toTitleCase from summaries.gs)
const getTodayFormatted = () => Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "MMMM d, yyyy");
const escapeRegExp = str => str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

function createNewDocumentsIfMissing() { processSpreadsheetRows({ overwriteExisting: false }); }
function processOrUpdateDocuments() { processSpreadsheetRows({ overwriteExisting: true }); }

// ============================================================================
// --- UNIFIED WEBHOOK ENDPOINT ---
// ============================================================================

/**
 * Unified Webhook Handler:
 * Routes incoming POST requests to either the Summaries pipeline or the Letter Generator.
 */
async function doPost(e) {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(30000)) {
    return ContentService.createTextOutput(JSON.stringify({
      status: "error",
      message: "Server busy: lock timeout exceeded"
    })).setMimeType(ContentService.MimeType.JSON);
  }

  try {
    const contents = JSON.parse(e.postData?.contents || "{}");
    const action = String(contents.action || "").trim().toLowerCase();
    const targetRow = parseInt(contents.rowIndex || contents.row, 10);

    const ssId = (typeof CONFIG !== 'undefined' && CONFIG.SPREADSHEET_ID) ? CONFIG.SPREADSHEET_ID : TRACKER_SPREADSHEET_ID;
    const ss = SpreadsheetApp.openById(ssId);
    const sheet = (typeof TRACKER_SHEET_NAME !== 'undefined' ? ss.getSheetByName(TRACKER_SHEET_NAME) : null) || ss.getSheets()[0];

    // ROUTE A: Project Summaries & Metadata
    if (action === 'summaries' || action === 'summary') {
      if (typeof ensurePdfLib === 'function') ensurePdfLib();

      const data = sheet.getDataRange().getValues();
      const cleanHeader = (name) => name.replace(/[\s_-]/g, '').toLowerCase();
      const cleanHeaders = data[0].map(h => cleanHeader(String(h).trim()));
      const cols = typeof resolveColumnMap === 'function' ? resolveColumnMap(cleanHeaders) : {};

      let statusCol = cleanHeaders.indexOf('summarystatus');
      if (statusCol === -1) {
        statusCol = cleanHeaders.length;
        sheet.getRange(1, statusCol + 1).setValue('Summary Status');
      }

      if (targetRow && targetRow > 1 && targetRow <= sheet.getLastRow()) {
        const rowValues = sheet.getRange(targetRow, 1, 1, Math.max(data[0].length, statusCol + 1)).getValues()[0];
        if (typeof processRow === 'function') {
          await processRow(sheet, targetRow, rowValues, cols, statusCol);
        }
      } else {
        for (let i = 1; i < data.length; i++) {
          const status = String(data[i][statusCol] || '').trim();
          if (status !== 'Processed' && typeof processRow === 'function') {
            await processRow(sheet, i + 1, data[i], cols, statusCol);
          }
        }
      }

      SpreadsheetApp.flush();
      return ContentService.createTextOutput(JSON.stringify({ status: "success", type: "summaries", row: targetRow || "pending_batch" }))
        .setMimeType(ContentService.MimeType.JSON);
    }

    // ROUTE B: Letter Generator
    if (targetRow && targetRow > 1) {
      const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
      
      if (typeof processSingleRow === 'function') {
        processSingleRow(sheet, headers, targetRow);
      } else {
        throw new Error("processSingleRow() function not found.");
      }

      return ContentService.createTextOutput(JSON.stringify({ status: "success", type: "letter", row: targetRow }))
        .setMimeType(ContentService.MimeType.JSON);
    }

    return ContentService.createTextOutput(JSON.stringify({ status: "ignored", message: "No valid action or rowIndex provided." }))
      .setMimeType(ContentService.MimeType.JSON);

  } catch (err) {
    console.error("Webhook processing error:", err);
    return ContentService.createTextOutput(JSON.stringify({ status: "error", message: err.message }))
      .setMimeType(ContentService.MimeType.JSON);
  } finally {
    lock.releaseLock();
  }
}

/**
 * Installable Trigger for direct AIsummaries_json edits
 */
function onEditInstallable(e) {
  if (!e || !e.range) return;
  const sheet = e.range.getSheet();
  if (sheet.getIndex() !== 1 || e.range.getRow() <= 1) return;

  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  const aiColIdx = headers.indexOf("AIsummaries_json");

  if (aiColIdx !== -1 && e.range.getColumn() === (aiColIdx + 1)) {
    console.log(`[onEdit] Detected edit in AIsummaries_json at Row ${e.range.getRow()}.`);
    processSingleRow(sheet, headers, e.range.getRow());
  }
}

/**
 * Batch Loop: Processes all rows with valid bounds
 */
function processSpreadsheetRows(options) {
  const sheet = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID).getSheets()[0];
  const lastRow = sheet.getLastRow();
  if (lastRow <= 1) return;

  const data = sheet.getRange(1, 1, lastRow, sheet.getLastColumn()).getValues();
  const headers = data[0];
  const hIndex = getHeaderMap(headers);
  const statusColIdx = getStatusColumnIndex(sheet, hIndex);
  const todayStr = getTodayFormatted();

  console.log(`Processing ${data.length - 1} rows. Target Date: ${todayStr}`);

  for (let r = 1; r < data.length; r++) {
    const updateRowStatus = msg => sheet.getRange(r + 1, statusColIdx + 1).setValue(msg);
    const result = buildValueMapForRow(data[r], hIndex, todayStr);

    if (result.error) {
      updateRowStatus(result.error);
      continue;
    }

    const processResult = executeDocumentGeneration(result.folderId, result.projectName, result.valueMap, options.overwriteExisting);
    updateRowStatus(processResult.error || `Letters Generated (${todayStr})`);
  }
}

/**
 * Single Row Processing Function
 */
function processSingleRow(sheet, headers, rowIndex) {
  const row = sheet.getRange(rowIndex, 1, 1, headers.length).getValues()[0];
  const hIndex = getHeaderMap(headers);
  const statusColIdx = getStatusColumnIndex(sheet, hIndex);
  const todayStr = getTodayFormatted();
  const updateRowStatus = msg => sheet.getRange(rowIndex, statusColIdx + 1).setValue(msg);

  const result = buildValueMapForRow(row, hIndex, todayStr);
  if (result.error) return updateRowStatus(result.error);

  const processResult = executeDocumentGeneration(result.folderId, result.projectName, result.valueMap, true);
  updateRowStatus(processResult.error || `Letters Updated (${todayStr})`);
}

/**
 * SHARED DATA BUILDER: Validates data, restricts by ENV_PM, performs REST lookup, and compiles valueMap
 */
function buildValueMapForRow(row, hIndex, todayStr) {
  const projectName = row[hIndex["Project Name"]] || "";
  const folderId = row[hIndex["folderID"]] || "";

  if (!projectName || !folderId) return { error: "Skipped: Missing Project Name or Folder ID" };

  const rawMetadataStr = row[hIndex["metadata_json"]];
  const rawAiSummariesStr = row[hIndex["AIsummaries_json"]];
  const rawSummariesStr = row[hIndex["summaries_json"]];

  if (!rawMetadataStr || rawMetadataStr.toString().trim() === "" || rawMetadataStr.toString().trim() === "{}") {
    return { error: "Skipped: metadata_json is blank or empty" };
  }
  if (!rawAiSummariesStr || rawAiSummariesStr.toString().trim() === "") {
    return { error: "Skipped: AIsummaries_json is blank" };
  }

  const metadata = parseJsonSafe(rawMetadataStr);
  const aiSummaries = parseJsonSafe(rawAiSummariesStr);
  const summaries = parseJsonSafe(rawSummariesStr);

  // Filter 1: Check summary text word count
  const projectSummaryText = (summaries.ProjectSummary || summaries.BridgeSummary || "").toString().trim();
  const wordCount = projectSummaryText ? projectSummaryText.split(/\s+/).filter(Boolean).length : 0;
  if (wordCount < 10) return { error: `Skipped: Summary text under 10 words (${wordCount} words)` };

  // Filter 2: ENV_PM Validation Gate (Must match Carl DeMuth / RCD / CD)
  const envPmCol = hIndex["ENV_PM"] ?? hIndex["Env_PM"] ?? hIndex["ENV PM"] ?? hIndex["PM"];
  const pmInfo = getPMInfo(metadata, row[envPmCol]);
  if (!pmInfo) {
    return { error: "Skipped: ENV_PM is not Carl DeMuth (RCD/CD)" };
  }

  const projectDescription = (aiSummaries && aiSummaries["ProjectSummaryRephr"]) ? aiSummaries["ProjectSummaryRephr"].trim() : "";

  // Spatial Lookup for USACE Regulatory District
  const coords = metadata.Coordinates || row[hIndex["Coordinate_str"]] || "";
  const rawGeoJson = row[hIndex["ecz_geojson"]] || row[hIndex["coordinates_json"]] || "";

  let usaceDistrict = metadata.USACE_District || row[hIndex["USACE_District"]] || "";
  if (!usaceDistrict) {
    usaceDistrict = fetchUsaceDistrict(coords, rawGeoJson);
  }
  if (!usaceDistrict) {
    usaceDistrict = (row[hIndex["District"]] || metadata.District || "Huntington").toString();
  }

  // Case-agnostic lookup against CONFIG.CORP_CONTACTS
  const targetDistrict = usaceDistrict.toString().trim().toLowerCase();
  const corpContact = CONFIG.CORP_CONTACTS.find(c => {
    const contactName = c[0].toLowerCase();
    return targetDistrict.includes(contactName) || contactName.includes(targetDistrict);
  }) || CONFIG.CORP_CONTACTS[0];

  let address = "";
  let salutation = "";
  if (corpContact[1] && corpContact[1].trim() !== "") {
    address = `${corpContact[1]}\n${corpContact[4]}\n${corpContact[2]}\ncc: ${corpContact[3]}`;
    salutation = `Dear ${corpContact[1]}:`;
  } else if (corpContact[4]) {
    address = `Section 408 Coordinator\n${corpContact[4]}\n${corpContact[3]}`;
    salutation = "To Whom It May Concern:";
  }

  const county = metadata.County || row[hIndex["County"]] || "";

  return {
    projectName,
    folderId,
    valueMap: {
      "{{DATE}}": todayStr,
      "{{ADDRESS}}": address,
      "{{ADDRESSEE}}": address,
      "{{SALUTATION}}": salutation,
      "{{USACE_DISTRICT}}": corpContact[0],
      "{{STATE_NO}}": metadata.StateNo || row[hIndex["StateNo"]] || "",
      "{{FED_NO}}": metadata.FederalNo || "",
      "{{PROJECT_NAME}}": projectName || metadata.ProjectName || "",
      "{{COUNTY_NAME}}": county,
      "{{COUNTY}}": county,
      "{{PROJECT_DESCRIPTION}}": projectDescription,
      "{{QUAD}}": toTitleCase(metadata.Quad || ""),
      "{{COORDS}}": coords,
      "{{COORDINATES}}": coords,
      "{{YOUR_NAME}}": pmInfo.name,
      "{{NAME}}": pmInfo.name,
      "{{PHONE_NUMBER}}": pmInfo.phone,
      "{{PHONE}}": pmInfo.phone,
      "{{EMAIL}}": pmInfo.email,
      "{{LAST_INITIAL}}": pmInfo.last_initial,
      "{{INITIALS}}": pmInfo.initials
    }
  };
}

/**
 * SHARED DOCUMENT GENERATOR
 */
function executeDocumentGeneration(folderId, projectName, valueMap, overwriteExisting) {
  const ceFolder = getOrCreateSubfolder(folderId, "CE_Materials");
  if (!ceFolder) return { error: `Error: Unable to access CE_Materials folder (ID: ${folderId})` };

  const lettersFolder = getOrCreateSubfolderFolder(ceFolder, "Letters");
  if (!lettersFolder) return { error: "Error: Unable to access Letters subfolder" };

  generateExportDocAndPdf(CONFIG.DNR_TEMPLATE_ID, `${projectName} DNR Letter`, lettersFolder, valueMap, overwriteExisting);
  generateExportDocAndPdf(CONFIG.SEC408_TEMPLATE_ID, `${projectName} 408 Letter`, lettersFolder, valueMap, overwriteExisting);

  return { success: true };
}

/**
 * Clean I/O Exporter
 */
function generateExportDocAndPdf(templateId, docName, targetFolder, valueMap, overwriteExisting) {
  const hasDoc = targetFolder.getFilesByName(docName).hasNext();
  const hasDocx = targetFolder.getFilesByName(`${docName}.docx`).hasNext();
  const hasPdf = targetFolder.getFilesByName(`${docName}.pdf`).hasNext();

  if (!overwriteExisting && hasDoc && hasDocx && hasPdf) return;

  deleteExistingFile(targetFolder, docName);
  deleteExistingFile(targetFolder, `${docName}.docx`);
  deleteExistingFile(targetFolder, `${docName}.pdf`);

  const docFile = DriveApp.getFileById(templateId).makeCopy(docName, targetFolder);
  const doc = DocumentApp.openById(docFile.getId());
  const body = doc.getBody();
  const header = doc.getHeader();

  // Perform placeholder replacements
  for (const [key, value] of Object.entries(valueMap)) {
    const pattern = escapeRegExp(key);
    body.replaceText(pattern, value);
    if (header) header.replaceText(pattern, value);
  }

  doc.saveAndClose();

  // Export DOCX
  const docxUrl = `https://docs.google.com/feeds/download/documents/export/Export?id=${docFile.getId()}&exportFormat=docx`;
  const responseDocx = UrlFetchApp.fetch(docxUrl, {
    headers: { Authorization: `Bearer ${ScriptApp.getOAuthToken()}` },
    muteHttpExceptions: true
  });
  targetFolder.createFile(responseDocx.getBlob().setName(`${docName}.docx`));

  // Export PDF
  targetFolder.createFile(docFile.getAs(MimeType.PDF).setName(`${docName}.pdf`));
}

// ==========================================
// SPATIAL REST SERVICE LOOKUP
// ==========================================

function extractDistrictAttribute(attributes) {
  if (!attributes) return "";
  for (const [key, val] of Object.entries(attributes)) {
    if (key.toLowerCase() === "district" && val) {
      return val.toString().trim();
    }
  }
  return "";
}

/**
 * Queries the USACE ArcGIS DistrictLocator REST service by Point or GeoJSON geometry.
 */
function fetchUsaceDistrict(coordsStr, geoJsonStr) {
  const baseUrl = "https://services7.arcgis.com/n1YM8pTrFmm7L4hs/ArcGIS/rest/services/DistrictLocator/FeatureServer/0/query";

  // 1. Point Coordinate Query (long,lat order in WGS84)
  if (coordsStr && typeof coordsStr === "string" && coordsStr.trim() !== "") {
    const cleanCoords = coordsStr.replace(/[\[\]\(\)]/g, "").trim();
    const parts = cleanCoords.split(/[,&\s]+/).filter(Boolean);

    if (parts.length >= 2) {
      let lat = parseFloat(parts[0]);
      let lng = parseFloat(parts[1]);

      if (Math.abs(lat) > 90 && Math.abs(lng) <= 90) {
        const temp = lat;
        lat = lng;
        lng = temp;
      }

      if (isFinite(lat) && isFinite(lng)) {
        const pointParam = encodeURIComponent(`${lng},${lat}`);
        const queryUrl = `${baseUrl}?geometry=${pointParam}&geometryType=esriGeometryPoint&inSR=4326&spatialRel=esriSpatialRelIntersects&outFields=DISTRICT&returnGeometry=false&f=json`;

        try {
          const resp = UrlFetchApp.fetch(queryUrl, { muteHttpExceptions: true });
          if (resp.getResponseCode() === 200) {
            const data = JSON.parse(resp.getContentText());
            if (data.features && data.features.length > 0) {
              const district = extractDistrictAttribute(data.features[0].attributes);
              if (district) return district;
            }
          }
        } catch (e) {
          console.warn("ArcGIS coordinate query failed:", e.message);
        }
      }
    }
  }

  // 2. Fallback: GeoJSON Query
  if (geoJsonStr && typeof geoJsonStr === "string" && geoJsonStr.trim() !== "") {
    try {
      const parsed = JSON.parse(geoJsonStr);
      let geom = parsed.geometry || (parsed.features && parsed.features[0] && parsed.features[0].geometry) || parsed;

      let esriGeomType = "esriGeometryPolygon";
      let esriGeom = null;

      if (geom.type === "Point") {
        esriGeomType = "esriGeometryPoint";
        esriGeom = { x: geom.coordinates[0], y: geom.coordinates[1], spatialReference: { wkid: 4326 } };
      } else if (geom.type === "Polygon") {
        esriGeomType = "esriGeometryPolygon";
        esriGeom = { rings: geom.coordinates, spatialReference: { wkid: 4326 } };
      } else if (geom.type === "MultiPolygon") {
        esriGeomType = "esriGeometryPolygon";
        esriGeom = { rings: geom.coordinates.flat(1), spatialReference: { wkid: 4326 } };
      } else if (geom.type === "LineString") {
        esriGeomType = "esriGeometryPolyline";
        esriGeom = { paths: [geom.coordinates], spatialReference: { wkid: 4326 } };
      }

      if (esriGeom) {
        const geomParam = encodeURIComponent(JSON.stringify(esriGeom));
        const queryUrl = `${baseUrl}?geometry=${geomParam}&geometryType=${esriGeomType}&inSR=4326&spatialRel=esriSpatialRelIntersects&outFields=DISTRICT&returnGeometry=false&f=json`;

        const resp = UrlFetchApp.fetch(queryUrl, { muteHttpExceptions: true });
        if (resp.getResponseCode() === 200) {
          const data = JSON.parse(resp.getContentText());
          if (data.features && data.features.length > 0) {
            const district = extractDistrictAttribute(data.features[0].attributes);
            if (district) return district;
          }
        }
      }
    } catch (e) {
      console.warn("ArcGIS GeoJSON geometry query failed:", e.message);
    }
  }

  return "";
}

// ==========================================
// UTILITY HELPERS
// ==========================================

const getHeaderMap = headers => headers.reduce((acc, h, i) => (acc[h.trim()] = i, acc), {});

function getStatusColumnIndex(sheet, hIndex) {
  let colIndex = hIndex["Letter Status"];
  if (colIndex === undefined) {
    colIndex = 21; // Default Column V
    sheet.getRange(1, colIndex + 1).setValue("Letter Status");
  }
  return colIndex;
}

/**
 * Case-agnostic ENV_PM evaluator
 */
function getPMInfo(metadata, sheetEnvPmValue) {
  const sheetEnvPm = (sheetEnvPmValue || "").toString().trim().toLowerCase();
  const metadataEnvPm = (metadata?.ENV_PM || metadata?.env_pm || "").toString().trim().toLowerCase();

  const isMatch = val => {
    if (!val) return false;
    return val === "cd" || val === "rcd" || val.includes("carl") || val.includes("demuth");
  };

  return (isMatch(sheetEnvPm) || isMatch(metadataEnvPm)) ? {
    phone: "304.720.7382",
    email: "robert.c.demuth@wv.gov",
    name: "R. Carl DeMuth",
    initials: "CD",
    last_initial: "d"
  } : null;
}

function getOrCreateSubfolder(parentFolderId, subfolderName) {
  try {
    return getOrCreateSubfolderFolder(DriveApp.getFolderById(parentFolderId), subfolderName);
  } catch (err) {
    console.error(`Error accessing folder ID ${parentFolderId}: `, err);
    return null;
  }
}

function getOrCreateSubfolderFolder(parentFolder, subfolderName) {
  const subfolders = parentFolder.getFoldersByName(subfolderName);
  return subfolders.hasNext() ? subfolders.next() : parentFolder.createFolder(subfolderName);
}

function deleteExistingFile(folder, fileName) {
  const files = folder.getFilesByName(fileName);
  while (files.hasNext()) files.next().setTrashed(true);
}

/**
 * 3-Step Resilient JSON Parser
 */
function parseJsonSafe(jsonString) {
  if (!jsonString || typeof jsonString !== "string") return {};

  const sanitizedStr = jsonString.trim();
  if (sanitizedStr === "" || sanitizedStr === "{}") return {};

  try { return JSON.parse(sanitizedStr); } catch (e) {}

  try {
    const cleanControlChars = sanitizedStr.replace(/[\r\n]+/g, "\\n").replace(/\t/g, " ");
    return JSON.parse(cleanControlChars);
  } catch (e) {}

  try {
    const extractedObj = {};
    const keyRegex = /"([^"]+)":\s*/g;
    let match;
    const keys = [];

    while ((match = keyRegex.exec(sanitizedStr)) !== null) {
      keys.push({ key: match[1], index: match.index, valueStart: keyRegex.lastIndex });
    }

    for (let i = 0; i < keys.length; i++) {
      const currentKey = keys[i].key;
      const startIdx = keys[i].valueStart;
      const endIdx = (i + 1 < keys.length) ? keys[i + 1].index : sanitizedStr.length;

      let rawVal = sanitizedStr.substring(startIdx, endIdx).trim();
      rawVal = rawVal.replace(/,\s*$/, "").replace(/}\s*$/, "").trim();

      if (rawVal.startsWith('"') && rawVal.endsWith('"')) {
        rawVal = rawVal.substring(1, rawVal.length - 1);
      } else if (rawVal.startsWith('"')) {
        rawVal = rawVal.substring(1);
      }

      extractedObj[currentKey] = rawVal.replace(/\\n/g, " ").replace(/[\r\n]+/g, " ").trim();
    }
    return extractedObj;
  } catch (err) {
    console.error("Failed all JSON parse attempts:", err);
    return {};
  }
}