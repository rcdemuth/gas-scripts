// ============================================================================
// --- GLOBAL CONFIGURATION & POLYFILLS ---
// ============================================================================
var globalThis = this;
globalThis.setTimeout = function(callback, delay) { Utilities.sleep(delay || 0); callback(); };
globalThis.clearTimeout = function() {};

const TRACKER_SPREADSHEET_ID   = '1gR_bFgn02BXs4il3utFUUTZ7zOM7qtjnRW-didoPRfo';
const TRACKER_SHEET_NAME       = 'Status'; 
const BRIDGE_DB_SPREADSHEET_ID = '1vXJVYzlnQfQPDm7jKV5z2LF9vwmKtnbrAOeGxiLVeHI';

// Combined onOpen() example to put in either file:
function onOpen() {
  const ui = SpreadsheetApp.getUi();
  ui.createMenu('Project Summaries')
    .addItem('Process Pending Rows', 'processAndSyncSpreadsheet')
    .addItem('Sync JSON to Sheet', 'processAndSyncSpreadsheet')
    .addSeparator()
    .addItem('Enable Auto-Run on Edit', 'summariesSetupInstallableTrigger')
    .addToUi();
}

/**
 * Installs or refreshes the installable trigger using onChange()
 * so that both manual and automated edits/insertions fire the script.
 */
function summariesSetupInstallableTrigger() {
  const ss = SpreadsheetApp.getActiveSpreadsheet() || SpreadsheetApp.openById(TRACKER_SPREADSHEET_ID);
  const triggers = ScriptApp.getUserTriggers(ss);
  
  // Clean up any existing trigger duplicates
  triggers.forEach(t => {
    if (t.getHandlerFunction() === 'summariesInstallableTrigger' || t.getHandlerFunction() === 'handleInstallableEdit') {
      ScriptApp.deleteTrigger(t);
    }
  });

  // Wire as an onChange trigger to capture automated and manual edits
  ScriptApp.newTrigger('summariesInstallableTrigger')
    .forSpreadsheet(ss)
    .onChange()
    .create();

  SpreadsheetApp.getUi().alert("✅ summariesInstallableTrigger installed with onChange! Manual and automated edits will now trigger processing.");
}
/**
 * Installable Trigger Handler (onChange):
 * Supports both manual edits (via e.range) and automated updates/row additions (via onChange fallback).
 */
async function summariesInstallableTrigger(e) {
  if (!e) return;
  const ss = e.source || SpreadsheetApp.getActiveSpreadsheet() || SpreadsheetApp.openById(TRACKER_SPREADSHEET_ID);
  const sheet = ss.getSheetByName(TRACKER_SHEET_NAME);
  if (!sheet) return;

  ensurePdfLib();

  const data = sheet.getDataRange().getValues();
  if (data.length < 2) return;

  const cleanHeader = (name) => name.replace(/[\s_-]/g, '').toLowerCase();
  const cleanHeaders = data[0].map(h => cleanHeader(String(h).trim()));
  const cols = resolveColumnMap(cleanHeaders);

  let statusCol = cleanHeaders.indexOf('summarystatus');
  if (statusCol === -1) {
    statusCol = cleanHeaders.length;
    sheet.getRange(1, statusCol + 1).setValue('Summary Status');
  }

  // --- PATH 1: Manual UI Edit (e.range provided) ---
  if (e.range) {
    if (e.range.getSheet().getName() !== TRACKER_SHEET_NAME) return;

    const startCol = e.range.getColumn();
    const endCol = e.range.getLastColumn();
    const hitsMonitored = (startCol <= 14 && endCol >= 1) || (startCol <= 17 && endCol >= 17);
    if (!hitsMonitored) return;

    const startRow = Math.max(2, e.range.getRow());
    const endRow = e.range.getLastRow();

    for (let r = startRow; r <= endRow; r++) {
      const rowValues = sheet.getRange(r, 1, 1, Math.max(data[0].length, statusCol + 1)).getValues()[0];
      await processRow(sheet, r, rowValues, cols, statusCol);
    }
    SpreadsheetApp.flush();
    return;
  }

  // --- PATH 2: Automated Edits & Insertions (e.range omitted by Google) ---
  // Check active range if an automated process positioned the cursor
  const activeRange = ss.getActiveRange();
  if (activeRange && activeRange.getSheet().getName() === TRACKER_SHEET_NAME && activeRange.getRow() > 1) {
    const startCol = activeRange.getColumn();
    const endCol = activeRange.getLastColumn();
    if ((startCol <= 14 && endCol >= 1) || (startCol <= 17 && endCol >= 17)) {
      const startRow = activeRange.getRow();
      const endRow = activeRange.getLastRow();
      for (let r = startRow; r <= endRow; r++) {
        const rowValues = sheet.getRange(r, 1, 1, Math.max(data[0].length, statusCol + 1)).getValues()[0];
        await processRow(sheet, r, rowValues, cols, statusCol);
      }
      SpreadsheetApp.flush();
      return;
    }
  }

  // Fallback: Scan and process any rows not yet marked 'Processed'
  for (let i = 1; i < data.length; i++) {
    const status = String(data[i][statusCol] || '').trim();
    if (status !== 'Processed') {
      await processRow(sheet, i + 1, data[i], cols, statusCol);
    }
  }
  SpreadsheetApp.flush();
}

function watchSpreadsheetForSummaries() { return processAndSyncSpreadsheet(); }
function syncJsonDataToSheet() { return processAndSyncSpreadsheet(); }

// ============================================================================
// --- CORE PROCESSING & SYNC PIPELINE ---
// ============================================================================

async function processAndSyncSpreadsheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet() || SpreadsheetApp.openById(TRACKER_SPREADSHEET_ID);
  const sheet = ss.getSheetByName(TRACKER_SHEET_NAME) || ss.getActiveSheet();
  const data = sheet.getDataRange().getValues();
  if (data.length < 2) return;

  const cleanHeader = (name) => name.replace(/[\s_-]/g, '').toLowerCase();
  const cleanHeaders = data[0].map(h => cleanHeader(String(h).trim()));

  // Dynamic header resolution mapped directly
  const cols = { projectname: 0, coordinatestr: 10, coordinatesjson: 11, eczgeojson: 12, metadatajson: 13, summariesjson: 14, folderid: 16 };
  cleanHeaders.forEach((h, idx) => { if (cols.hasOwnProperty(h)) cols[h] = idx; });
  
  let statusCol = cleanHeaders.indexOf('summarystatus');
  if (statusCol === -1) {
    statusCol = cleanHeaders.length;
    sheet.getRange(1, statusCol + 1).setValue('Summary Status');
  }

  if (typeof PDFLib === 'undefined') {
    eval(UrlFetchApp.fetch("https://cdnjs.cloudflare.com/ajax/libs/pdf-lib/1.17.1/pdf-lib.min.js").getContentText());
  }

  for (let i = 1; i < data.length; i++) {
    const status = String(data[i][statusCol] || '').trim();
    const folderId = String(data[i][cols.folderid] || '').trim();
    const projectName = String(data[i][cols.projectname] || '').trim();
    const cellMetadataVal = String(data[i][cols.metadatajson] || '').trim();

    if (status === 'Processed' || (!projectName && !folderId)) continue;
    if (!projectName || !/^[a-zA-Z0-9_-]{20,60}$/.test(folderId)) {
      if (projectName) sheet.getRange(i + 1, statusCol + 1).setValue('Error: Invalid Folder ID in cell');
      continue;
    }

    try {
      console.log(`\n--- Processing Row ${i + 1}: ${projectName} (${folderId}) ---`);
      const folder = DriveApp.getFolderById(folderId);
      let inMemoryMeta = null;
      let rawCoordStr = String(data[i][cols.coordinatestr] || '').trim();

      // 1. METADATA.JSON (COLUMN N)
      const metaFiles = folder.getFilesByName('metadata.json');
      if (metaFiles.hasNext()) {
        const content = metaFiles.next().getBlob().getDataAsString();
        try { inMemoryMeta = JSON.parse(content); } catch (e) {}
        if (!isMetadataEmpty(inMemoryMeta)) sheet.getRange(i + 1, cols.metadatajson + 1).setValue(content);
        else inMemoryMeta = null;
      }
      
      if (!inMemoryMeta) {
        let mapped = null;
        const pdfFile = findScreeningSheetInFolder(folder);
        if (pdfFile) mapped = mapScreeningSheetData(await extractPdfFields(pdfFile.getBlob()));

        if (isMetadataEmpty(mapped)) {
          const txtFile = findMetadataTxtInFolder(folder);
          if (txtFile) mapped = parseMetadataTxt(txtFile.getBlob());
        }

        if (mapped && !isMetadataEmpty(mapped)) {
          rawCoordStr = rawCoordStr || String(mapped.Coordinates || mapped.Text11 || '').trim();
          mapped = jsonifyMetadataFields(mapped, true);
          saveDriveFile(folder, 'metadata.json', mapped);
          sheet.getRange(i + 1, cols.metadatajson + 1).setValue(JSON.stringify(mapped, null, 2));
          inMemoryMeta = mapped;
        }
      }

      if (!inMemoryMeta && cellMetadataVal) {
        try { inMemoryMeta = JSON.parse(cellMetadataVal); } catch(e) {}
      }

      // 2. COORDINATES (COLUMNS K & L)
      if (inMemoryMeta) {
        const coordEntry = inMemoryMeta.Coordinates !== undefined ? inMemoryMeta.Coordinates : inMemoryMeta.Text11;
        let coordJson = "";

        if (typeof coordEntry === 'string') {
          coordJson = coordEntry.trim().startsWith('[') ? coordEntry : parseCoordinates(rawCoordStr || coordEntry.trim(), true);
          rawCoordStr = rawCoordStr || coordEntry.trim();
        } else if (Array.isArray(coordEntry)) {
          coordJson = JSON.stringify(coordEntry);
        }

        if (rawCoordStr) sheet.getRange(i + 1, cols.coordinatestr + 1).setValue(rawCoordStr);
        if (coordJson && coordJson !== '[]') sheet.getRange(i + 1, cols.coordinatesjson + 1).setValue(coordJson);
      }

      // 3. GEOJSON / KMZ / KML REPAIR (COLUMN M)
      const ecz = getOrGenerateEczGeoJson(folder);
      if (ecz && ecz.text) {
        const text = ecz.text.length > 49500 ? ecz.text.substring(0, 49500) + '... [TRUNCATED]' : ecz.text;
        sheet.getRange(i + 1, cols.eczgeojson + 1).setValue(text);
      }

      // 4. SUMMARIES.JSON (COLUMN O)
      const evalRes = evaluateProjectSummaries(folder, inMemoryMeta);
      const sumFiles = folder.getFilesByName('summaries.json');
      if (sumFiles.hasNext()) {
        sheet.getRange(i + 1, cols.summariesjson + 1).setValue(sumFiles.next().getBlob().getDataAsString());
      }

      // 5. STATUS
      const reqBridge = extractBarsList(inMemoryMeta).length > 0;
      const complete = evalRes.memoFound && (!reqBridge || evalRes.bridgeFound);
      sheet.getRange(i + 1, statusCol + 1).setValue(complete ? 'Processed' : 'Pending Summaries');

    } catch (e) {
      console.log(`Error on row ${i + 1}: ${e.message}`);
      sheet.getRange(i + 1, statusCol + 1).setValue(`Error: ${e.message}`);
    }
  }
  SpreadsheetApp.flush();
}

// ============================================================================
// --- EVALUATION & TEXT CLEANING ---
// ============================================================================

function cleanSummaryText(text) {
  if (!text) return "";
  return String(text)
    .replace(/\bMI\b/gi, 'miles')
    .replace(/of\s+(?:CO\.?\s*RT|C\.?R)\b\.?/gi, 'of County Route')
    .replace(/of\s+(?:ST\.?\s*RT|S\.?R)\b\.?/gi, 'of State Route')
    .replace(/\s+/g, ' ')
    .replace(/\.\s*\.+/g, '.')
    .replace(/\s+([,.;:!?])/g, '$1')
    .replace(/([.!?])(?=[A-Za-z])/g, '$1 ')
    .trim();
}

function evaluateProjectSummaries(projectFolder, preloadedMeta = null) {
  let meta = preloadedMeta || {};
  let sumData = { BridgeSummary: "", BridgeData: [], ProjectSummary: "" };
  let changed = false;

  const sumFiles = projectFolder.getFilesByName('summaries.json');
  if (sumFiles.hasNext()) {
    try { sumData = JSON.parse(sumFiles.next().getBlob().getDataAsString()); } catch (e) {}
  }

  let bridgeFound = !!sumData.BridgeSummary && !sumData.BridgeSummary.startsWith("Error:");
  if (!bridgeFound) {
    let bData = { summary: "Error: Not processed yet.", valuesArray: [] };
    const barsList = extractBarsList(meta);

    if (barsList.length > 0) {
      const summaries = [], values = [];
      for (const item of barsList) {
        const res = getBridgeDataFromSheet(item.bars);
        if (!res.summary.startsWith("Error:")) {
          summaries.push(item.id && !res.summary.toLowerCase().includes(item.id.toLowerCase()) ? `[${item.id}] ${res.summary}` : res.summary);
          values.push(res.valuesArray);
        }
      }
      if (summaries.length) bData = { summary: summaries.join("\n\n"), valuesArray: values.length === 1 ? values[0] : values };
    }

    if (bData.summary.startsWith("Error:")) bData = getShortSpanDataByIntersection(projectFolder, meta);

    if (!bData.summary.startsWith("Error:")) {
      sumData.BridgeSummary = bData.summary;
      sumData.BridgeData = bData.valuesArray;
      bridgeFound = true;
      changed = true;
    }
  }

  let memoFound = !!sumData.ProjectSummary && sumData.ProjectSummary.trim().length > 5;
  if (!memoFound) {
    const memoCandidates = findMemoFilesInProject(projectFolder);
    for (const file of memoCandidates) {
      const text = processAndCleanMemo(file);
      if (text && text.length > 5) {
        sumData.ProjectSummary = text;
        memoFound = true;
        changed = true;
        break;
      }
    }
  }

  if (changed || !sumFiles.hasNext()) saveDriveFile(projectFolder, 'summaries.json', sumData);
  return { memoFound, bridgeFound };
}

// ============================================================================
// --- FILE ENGINE & SEARCH ---
// ============================================================================

function getPathRank(path) {
  const p = path.toLowerCase().replace(/\\/g, '/').replace(/[\s_-]+/g, ' ');
  return p.includes('design info/info') ? 1 : (p.includes('design info') ? 2 : 3);
}

function findProjectFiles(folder, filterFn, sortFn = null) {
  const matches = [];
  function walk(currentFolder, path) {
    if (currentFolder.getName().toLowerCase().includes('template')) return;
    const files = currentFolder.getFiles();
    while (files.hasNext()) {
      const f = files.next(), name = f.getName().toLowerCase(), mime = f.getMimeType();
      if (!name.includes('template') && filterFn(f, name, mime)) {
        matches.push({ file: f, path, name, mime, time: f.getLastUpdated().getTime() });
      }
    }
    const subs = currentFolder.getFolders();
    while (subs.hasNext()) {
      const sub = subs.next();
      walk(sub, path ? `${path}/${sub.getName()}` : sub.getName());
    }
  }
  walk(folder, '');
  return sortFn ? matches.sort(sortFn).map(m => m.file) : matches.map(m => m.file);
}

function findScreeningSheetInFolder(folder) {
  return findProjectFiles(folder, (f, name, mime) => name.includes('screening sheet') && (mime === MimeType.PDF || name.endsWith('.pdf')),
    (a, b) => (getPathRank(a.path) - getPathRank(b.path)) || (b.time - a.time)
  )[0] || null;
}

function findMemoFilesInProject(folder) {
  const isDoc = (m, n) => m === MimeType.MICROSOFT_WORD || m === MimeType.GOOGLE_DOCS || n.endsWith('.docx') || n.endsWith('.doc');
  const isPdf = (m, n) => m === MimeType.PDF || n.endsWith('.pdf');
  return findProjectFiles(folder, (f, name, mime) => (name.includes('memo') || name.includes('plan')) && (isDoc(mime, name) || isPdf(mime, name)),
    (a, b) => {
      const rankDiff = getPathRank(a.path) - getPathRank(b.path);
      if (rankDiff !== 0) return rankDiff;
      const memoDiff = (a.name.includes('memo') ? 1 : 2) - (b.name.includes('memo') ? 1 : 2);
      if (memoDiff !== 0) return memoDiff;
      const aDoc = isDoc(a.mime, a.name), bDoc = isDoc(b.mime, b.name);
      if (aDoc && !bDoc) return (b.time - a.time > 86400000) ? 1 : -1;
      if (!aDoc && bDoc) return (a.time - b.time > 86400000) ? -1 : 1;
      return b.time - a.time;
    }
  );
}

function findMetadataTxtInFolder(folder) {
  return findProjectFiles(folder, (f, name) => name === 'metadata.txt')[0] || null;
}

function findGeoJsonInFolder(folder) {
  return findProjectFiles(folder, (f, name) => name.endsWith('.geojson'))[0] || null;
}

function findKmlOrKmzInFolder(folder) {
  const score = (n) => n.includes('ecz') ? 3 : (n.includes('bound') ? 2 : (n.includes('project') ? 1 : 0));
  return findProjectFiles(folder, (f, name) => name.endsWith('.kmz') || name.endsWith('.kml'),
    (a, b) => score(b.name) - score(a.name)
  )[0] || null;
}

function saveDriveFile(folder, fileName, data) {
  const existing = folder.getFilesByName(fileName);
  while (existing.hasNext()) existing.next().setTrashed(true);
  const content = typeof data === 'string' ? data : JSON.stringify(data, null, 2);
  return folder.createFile(fileName, content, MimeType.PLAIN_TEXT);
}

// ============================================================================
// --- METADATA EXTRACTION & NORMALIZATION ---
// ============================================================================

const PDF_FIELD_MAP = {
  Text1: "StateNo", Text2: "FederalNo", Text3: "ProjectName", Text4: "County", Text5: "MemoDate",
  Text6: "From", Text7: "Authorization", Text8: "DSN_PM", Text9: "History Notes", Dropdown1: "Historian",
  "Check Box1": "HistoryRE", "Check Box2": "HistorySHPO", Text10: "ArchaeologyNotes",
  "Check Box3": "ArchaeologyRE", "Check Box4": "ArchaeologySHPO", Dropdown2: "Archaeologist",
  "Check Box5": "Sec7ESASpeciesListComplete", "Check Box6": "StateListMusselStream",
  "Check Box7": "Sec7esaNEdkeyComplete", "Check Box8": "MayAffectNeedUSFWSReview",
  "Check Box9": "FedListMusselStream", "Check Box10": "FedListCrayfishStream",
  "Check Box11": "BoxTurtleHighPriority", Text11: "Coordinates", Text12: "Quad", Text13: "BARS",
  Text14: "Airport", Text15: "NR_Notes", Text16: "ENG_Date", Text17: "ROW_Date", Text18: "CN_Date",
  "Check Box16": "NeedsBatHabitatAssess", "Check Box13": "TreeRemoval", "Check Box14": "USGS_Coordination"
};

const CSV_FIELD_MAP = [
  ["StateNo","st_no"], ["FederalNo","fed_no"], ["ProjectName","p_Name"], ["County","county"],
  ["MemoDate","memo_date"], ["From","isfrom"], ["Authorization","auth"], ["DSN_PM","dsn_pm"],
  ["History Notes","hist_notes"], ["Historian","hist_pm"], ["HistoryRE","re_hist"],
  ["HistorySHPO","shpo_hist"], ["ArchaeologyNotes","arch_notes"], ["ArchaeologyRE","re_arch"],
  ["ArchaeologySHPO","shpo_arch"], ["Archaeologist","arch_pm"], ["Sec7ESASpeciesListComplete","nrcb"],
  ["StateListMusselStream","nrcb2"], ["Sec7esaNEdkeyComplete","nrcb3"], ["MayAffectNeedUSFWSReview","nrcb4"],
  ["FedListMusselStream","nrcb5"], ["FedListCrayfishStream","nrcb6"], ["BoxTurtleHighPriority","nrcb7"],
  ["Coordinates","coordinates"], ["Quad","quad"], ["BARS","bars"], ["Airport","airport"],
  ["NR_Notes","nr_notes"], ["ENG_Date","eng_date"], ["ROW_Date","row_date"], ["CN_Date","cn_date"],
  ["NeedsBatHabitatAssess","nrcb8"], ["TreeRemoval","nrcb9"], ["USGS_Coordination","nrcb10"]
];

function mapScreeningSheetData(raw) {
  const mapped = {};
  for (const [k, v] of Object.entries(raw)) mapped[PDF_FIELD_MAP[k] || k] = v;
  return mapped;
}

function parseMetadataTxt(blob) {
  let rows;
  try { rows = Utilities.parseCsv(blob.getDataAsString()); } catch (e) { return {}; }
  if (rows.length < 2) return {};
  const headers = rows[0].map(h => String(h).trim()), vals = rows[1], mapped = {};
  for (const [jsonKey, csvCol] of CSV_FIELD_MAP) {
    const idx = headers.indexOf(csvCol);
    mapped[jsonKey] = (idx !== -1 && vals.length > idx) ? vals[idx] : "";
  }
  return mapped;
}

async function extractPdfFields(blob) {
  const pdfDoc = await PDFLib.PDFDocument.load(new Uint8Array(blob.getBytes()));
  const form = pdfDoc.getForm(), out = {};
  form.getFields().forEach(f => {
    const n = f.getName();
    try {
      if (typeof f.getText === 'function') out[n] = f.getText() || '';
      else if (typeof f.isChecked === 'function') out[n] = f.isChecked();
      else if (typeof f.getSelected === 'function') out[n] = [].concat(f.getSelected())[0] || '';
      else out[n] = '';
    } catch (e) { out[n] = null; }
  });
  return out;
}

function isMetadataEmpty(m) {
  return !m || Object.values(m).every(v => v === null || v === '' || v === false);
}

function extractBarsList(meta) {
  if (!meta) return [];
  const raw = meta.BARS || meta['BARS No'] || meta.Text13;
  if (!raw) return [];
  let items = Array.isArray(raw) ? raw : (typeof raw === 'string' && raw.trim().startsWith('[') ? JSON.parse(raw) : null);
  if (!items) {
    return String(raw).split('&').map(s => {
      const m = s.match(/\b([a-zA-Z0-9]{5,7})\b/);
      return { id: s.replace(m ? m[0] : '', '').replace(/[\(\)\[\]:;\-\/]/g, '').trim() || null, bars: m ? m[1] : s.trim() };
    }).filter(x => /^[a-zA-Z0-9]{5,7}$/.test(x.bars));
  }
  return items.map(i => typeof i === 'string' ? { id: null, bars: (i.match(/\b([a-zA-Z0-9]{5,7})\b/) || [])[1] } : i)
              .filter(i => i && /^[a-zA-Z0-9]{5,7}$/.test(i.bars));
}

function parseCoordinates(input, asString = true) {
  if (!input || typeof input !== 'string') return asString ? '[]' : [];
  if (input.trim().startsWith('[')) return asString ? input.trim() : JSON.parse(input);
  const regex = /(-?\d+\.?\d*)\s*,\s*(-?\d+\.?\d*)/;
  const res = input.split('&').flatMap(str => {
    const m = str.match(regex);
    if (!m) return [];
    return [{ id: str.replace(m[0], '').replace(/[\(\)\[\]:;\-\/]/g, '').trim() || null, lat: +m[1], lng: +m[2] }];
  });
  return asString ? JSON.stringify(res) : res;
}

function jsonifyMetadataFields(metadata, asString = true) {
  if (!metadata) return metadata;
  const isStr = typeof metadata === 'string';
  let meta = isStr ? JSON.parse(metadata || '{}') : metadata;

  const cKey = meta.Coordinates !== undefined ? 'Coordinates' : (meta.Text11 !== undefined ? 'Text11' : null);
  if (cKey && typeof meta[cKey] === 'string' && meta[cKey].includes('&')) {
    const coords = parseCoordinates(meta[cKey], false);
    meta[cKey] = asString ? JSON.stringify(coords) : coords;
  }

  const bKey = meta.BARS !== undefined ? 'BARS' : (meta['BARS No'] !== undefined ? 'BARS No' : (meta.Text13 !== undefined ? 'Text13' : null));
  if (bKey && typeof meta[bKey] === 'string' && meta[bKey].includes('&')) {
    const bars = extractBarsList({ [bKey]: meta[bKey] });
    meta[bKey] = asString ? JSON.stringify(bars) : bars;
  }
  return isStr ? JSON.stringify(meta, null, 2) : meta;
}

// ============================================================================
// --- OCR & MEMO EXTRACTION ---
// ============================================================================

function processAndCleanMemo(memoFile) {
  const isPdf = memoFile.getMimeType() === MimeType.PDF || memoFile.getName().toLowerCase().endsWith('.pdf');
  let text = convertFileToText(memoFile, isPdf);
  if (isPdf) Utilities.sleep(1200);

  const sub = text.match(/SUBJECT:/i);
  if (sub) text = text.substring(sub.index + sub[0].length);
  text = text.replace(/E\.E\.O\.\/AFFIRMATIVE ACTION EMPLOYER/gi, '')
             .split('\n').filter(l => !/^[A-Z]{2,3}:[a-z]{1,3}$/.test(l.trim())).join('\n');
  if (isPdf) text = text.replace(/(?<!\t| {4,}|\n|\r)[\r\n]+/g, ' ');

  const headers = ['Existing Conditions?', 'Proposed Work', 'Traffic Maintenance', 'Right of Way', 'Ground Disturbance', 'USFWS Determination'];
  if (headers.filter(h => new RegExp(h, 'i').test(text)).length >= 2) {
    const start = text.search(/Existing Conditions?/i), end = text.search(/Attachments/i);
    if (start !== -1) text = text.substring(start);
    if (end !== -1) text = text.substring(0, end);
    headers.forEach(h => { text = text.replace(new RegExp(`(^|\\n|\\.\\s+)(${h})`, 'gi'), '$1\n\n$2'); });
  }
  return text.replace(/ {2,}/g, ' ').replace(/\n{3,}/g, '\n\n').trim();
}

function convertFileToText(file, useOcr) {
  try {
    if (file.getMimeType() === MimeType.GOOGLE_DOCS) return DocumentApp.openById(file.getId()).getBody().getText();
    const blob = file.getBlob();
    const name = file.getName().toLowerCase();
    const mime = name.endsWith('.pdf') ? 'application/pdf' : (name.endsWith('.docx') ? 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' : 'application/msword');
    
    let url = `https://www.googleapis.com/upload/drive/v2/files?uploadType=multipart&convert=true${useOcr ? '&ocr=true&ocrLanguage=en' : ''}`;
    const boundary = '-------314159265358979323846';
    const payload = `\r\n--${boundary}\r\nContent-Type: application/json\r\n\r\n${JSON.stringify({ title: 'Temp_' + Date.now(), mimeType: mime })}\r\n--${boundary}\r\nContent-Type: ${mime}\r\nContent-Transfer-Encoding: base64\r\n\r\n${Utilities.base64Encode(blob.getBytes())}\r\n--${boundary}--`;

    let retries = 3, delay = 2500;
    while (retries >= 0) {
      const resp = UrlFetchApp.fetch(url, {
        method: 'post', contentType: `multipart/mixed; boundary="${boundary}"`,
        headers: { Authorization: 'Bearer ' + ScriptApp.getOAuthToken() }, payload, muteHttpExceptions: true
      });
      if (resp.getResponseCode() >= 200 && resp.getResponseCode() < 300) {
        const id = JSON.parse(resp.getContentText()).id;
        const bodyText = DocumentApp.openById(id).getBody().getText();
        DriveApp.getFileById(id).setTrashed(true);
        return bodyText;
      }
      if ((resp.getResponseCode() === 403 || resp.getResponseCode() === 429) && resp.getContentText().includes("rateLimitExceeded") && retries > 0) {
        Utilities.sleep(delay); delay *= 2; retries--; continue;
      }
      break;
    }
  } catch (e) { console.log(`Conversion error: ${e.message}`); }
  return '';
}

// ============================================================================
// --- BRIDGE & SPATIAL SHORT SPAN LOOKUP ---
// ============================================================================

function getAbbreviationMap(ss) {
  const sheet = ss.getSheetByName('abbreviations') || ss.getSheets().find(s => s.getName().toLowerCase() === 'abbreviations');
  if (!sheet) return [];
  return sheet.getDataRange().getValues().slice(1)
    .map(r => ({ abbr: String(r[0]).trim(), term: String(r[1]).trim() }))
    .filter(x => x.abbr && x.term)
    .sort((a, b) => b.abbr.length - a.abbr.length);
}

function expandAbbreviations(text, abbrMap) {
  if (!text) return "";
  let clean = String(text).replace(/_/g, ' ').replace(/\s+/g, ' ').trim();
  for (const {abbr, term} of abbrMap) {
    const rx = new RegExp(`(\\s+)(${abbr.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&')})$`, 'i');
    if (rx.test(clean)) return clean.replace(rx, `$1${term}`);
  }
  return clean;
}

function toTitleCase(str) {
  return String(str || '').toLowerCase().split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
}

function getBridgeDataFromSheet(barsNumber) {
  const ss = SpreadsheetApp.openById(BRIDGE_DB_SPREADSHEET_ID);
  const data = ss.getSheets()[0].getDataRange().getValues();
  if (data.length < 2) return { summary: "Error: Bridge DB empty.", valuesArray: [] };
  const headers = data[0], barsIdx = headers.indexOf('bars_number');
  const row = data.find(r => String(r[barsIdx]) === String(barsNumber));
  if (!row) return { summary: `Error: Bridge ${barsNumber} not found.`, valuesArray: [] };

  const p = {};
  headers.forEach((h, i) => p[h] = row[i]);
  const abbrMap = getAbbreviationMap(ss);

  const bridgeName = expandAbbreviations(p.bridge_name, abbrMap).replace(/\s+br\.?$/i, ' Bridge');
  const featCarried = toTitleCase(expandAbbreviations(p.feature_carried, abbrMap));
  const featIntersected = toTitleCase(expandAbbreviations(p.narrative_nbi_6a_feature_intersected, abbrMap));
  const county = String(p.county || '').includes('-') ? p.county.split('-')[1].split('(')[0].trim() : String(p.county || '');
  const location = String(p.location || '').replace(/\bMI\s+(N|S|E|W|NE|NW|SE|SW)\s+OF\b/gi, (_, d) => `miles ${{N:'north',S:'south',E:'east',W:'west',NE:'northeast',NW:'northwest',SE:'southeast',SW:'southwest'}[d.toUpperCase()]} of`);
  const narrativeComments = String(p.narrative_comments || '').replace(/\n/g, ' ').replace(/ENGINEER's RECOMENDATION/g, "Recommendations include");

  let dir = "";
  if (p._snbi_routes_direction) {
    let dStr = String(p._snbi_routes_direction).trim();
    if (dStr.startsWith('[')) try { dStr = JSON.parse(dStr)[0] || ""; } catch (e) {}
    dir = dStr.includes('-') ? dStr.split('-')[1].trim().toLowerCase() : dStr.trim().toLowerCase();
  }

  const raw = `Located ${location} in ${p.place_code == 0 || String(p.place_name).includes("Rural") ? "an unincorporated part of rural" : (p.place_name ? p.place_name + ',' : '')} ${county} County, ${bridgeName} crosses ${featIntersected}. Part of ${featCarried}, ${bridgeName} carries ${dir} traffic, and has an average daily traffic of ${p.adt || p.average_daily_traffic || p.ADT || ''}. Initially built in ${p.year_built || ''}, the existing structure is a ${p.bridge_age || ''} year old ${String(p.bridge_type || '').toLowerCase()} with a total length of ${p.total_bridge_length || ''} feet, and an out-to-out width of ${p.width_out_to_out || ''} feet. ${String(p.narrative_summary || '').replace(/\n/g, ' ')}. ${narrativeComments}.`;
  
  return {
    summary: cleanSummaryText(raw),
    valuesArray: [p.bars_number || "", featIntersected, bridgeName, county, p.bridge_type || "", p.latitude || "", p.longitude || "", location, p.route || "", p.subroute || "", p.narrative_summary || "", narrativeComments, p.width_out_to_out || "", p.total_bridge_length || "", p.year_built || "", p.bridge_age || "", p.span_lengths || "", p.bridge_condition_classification || "", featCarried, dir, p.place_code || "", p.place_name || "", p.adt || ""]
  };
}

function getShortSpanDataByIntersection(projectFolder, meta) {
  const ecz = (getOrGenerateEczGeoJson(projectFolder) || {}).geoJson;
  const coords = (meta && (meta.Coordinates || meta.Text11)) ? (Array.isArray(meta.Coordinates) ? meta.Coordinates : parseCoordinates(meta.Coordinates || meta.Text11, false)) : [];
  if (!ecz && !coords.length) return { summary: "Error: No ECZ GeoJSON or Coordinates.", valuesArray: [] };

  if (typeof turf === 'undefined') eval(UrlFetchApp.fetch("https://cdnjs.cloudflare.com/ajax/libs/Turf.js/6.5.0/turf.min.js").getContentText());
  const ss = SpreadsheetApp.openById(BRIDGE_DB_SPREADSHEET_ID);
  const sheet = ss.getSheetByName("short_spans");
  if (!sheet) return { summary: "Error: 'short_spans' tab missing.", valuesArray: [] };

  const data = sheet.getDataRange().getValues();
  const headers = data[0].map(h => String(h).trim().toLowerCase());
  const latIdx = headers.indexOf('latitude'), lonIdx = headers.indexOf('longitude');
  const matched = [];

  for (let i = 1; i < data.length; i++) {
    const lat = parseFloat(data[i][latIdx]), lon = parseFloat(data[i][lonIdx]);
    if (!isFinite(lat) || !isFinite(lon)) continue;
    const pt = turf.point([lon, lat]);
    let hit = ecz && ecz.features && ecz.features.some(f => turf.booleanIntersects(pt, f));
    if (!hit && coords.length) hit = coords.some(c => isFinite(c.lat) && turf.distance(pt, turf.point([c.lng, c.lat]), { units: 'miles' }) <= 0.05);
    if (hit) matched.push(data[i]);
  }
  if (!matched.length) return { summary: "Error: No short span found intersecting area.", valuesArray: [] };

  const abbrMap = getAbbreviationMap(ss), summaries = [], values = [];
  matched.forEach(row => {
    const p = {};
    headers.forEach((h, i) => p[h] = row[i]);
    const name = expandAbbreviations(p.bridge_name, abbrMap);
    const feat = toTitleCase(expandAbbreviations(p.ss_feature_intersected, abbrMap));
    const loc = String(p.ss_location || '').replace(/\bMI\s+(N|S|E|W|NE|NW|SE|SW)\s+OF\b/gi, (_, d) => `miles ${{N:'north',S:'south',E:'east',W:'west',NE:'northeast',NW:'northwest',SE:'southeast',SW:'southwest'}[d.toUpperCase()]} of`);
    const len = [p.total_bridge_length, p.ss_nbis_length].map(Number).filter(v => isFinite(v) && v > 0);
    const length = len.length ? Math.min(...len) : "";
    const width = p.width_out_to_out || p.ss_structure_roadway_width || "";

    const raw = `Located ${loc}, short span ${name} crosses ${feat}. Initially built in ${p.year_built || ''}, the existing structure is a ${p.bridge_age || ''} year old ${String(p.bridge_type || '').toLowerCase()} with a length of ${length} feet, and a width of ${width} feet. ${String(p.ss_narrative || '').replace(/\n/g, ' ')} ${String(p.ss_notes || '').replace(/\n/g, ' ')}`;
    summaries.push(cleanSummaryText(raw));
    values.push([p.bars_number || "", feat, name, p.bridge_type || "", loc, p.ss_co_rt_mp || "", p.ss_culvert_pipe_length || "", length, width, p.year_built || "", p.bridge_age || "", p.ss_deck_material_type || "", p.ss_material_type || "", p.ss_substructure_material_type || "", p.ss_narrative || "", p.ss_notes || ""]);
  });

  return { summary: summaries.join("\n\n"), valuesArray: values.length === 1 ? values[0] : values };
}

// ============================================================================
// --- BOUNDARY INTERACTION (DELEGATED TO BOUNDARY.GS) ---
// ============================================================================

function getOrGenerateEczGeoJson(folder) {
  const existing = findGeoJsonInFolder(folder);
  if (existing) {
    try {
      const text = existing.getBlob().getDataAsString();
      return { file: existing, text, geoJson: JSON.parse(text) };
    } catch (e) {}
  }
  const kmlFile = findKmlOrKmzInFolder(folder);
  if (!kmlFile) return null;

  try {
    const raw = kmlToGeoJson(extractKmlFromKmz(kmlFile.getBlob()));
    const repaired = prepareEczBoundary(raw);
    const jsonStr = JSON.stringify(repaired, null, 2);
    const base = kmlFile.getName().replace(/\.(kmz|kml)$/i, '');
    const outName = base.toLowerCase().includes('ecz') ? `${base}.geojson` : `${base}_ECZ.geojson`;
    const newFile = saveDriveFile(folder, outName, jsonStr);
    return { file: newFile, text: jsonStr, geoJson: repaired };
  } catch (err) {
    console.error(`Boundary repair error: ${err.message}`);
    return null;
  }
}