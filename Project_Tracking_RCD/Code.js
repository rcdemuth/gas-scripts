/**
 * Normalizes project numbers by trimming whitespace and stripping trailing ' 00', '-00', or '_00'.
 * Examples:
 *   "STP-1234 00" -> "STP-1234"
 *   "12345-00"    -> "12345"
 *   "98765"       -> "98765"
 */
function normalizeProjectNumber(val) {
  if (val === null || val === undefined) return "";
  return String(val)
    .trim()
    .replace(/[\s\-_]+00$/i, '')
    .trim();
}

/**
 * Copies CD-assigned projects from the source spreadsheet into:
 * 1. Active Projects (local)
 * 2. Archaeology_Masterlist (local)
 * 3. Status spreadsheet (external)
 */
function copyCDEntriesToBothSheets() {
  const sourceSpreadsheetId = '1v4nXrqguoAo0KBTG0g7gakOpRUn5JOOUfv_tDcGsDME';
  const statusSpreadsheetId = '1gR_bFgn02BXs4il3utFUUTZ7zOM7qtjnRW-didoPRfo';
  const targetSpreadsheetId = SpreadsheetApp.getActiveSpreadsheet().getId();
  
  const sourceSheet = SpreadsheetApp.openById(sourceSpreadsheetId).getSheetByName('Active Projects');
  const targetActiveProjectsSheet = SpreadsheetApp.openById(targetSpreadsheetId).getSheetByName('Active Projects');
  const targetMasterlistSheet = SpreadsheetApp.openById(targetSpreadsheetId).getSheetByName('Archaeology_Masterlist');
  const statusSheet = SpreadsheetApp.openById(statusSpreadsheetId).getSheetByName('Status');
  
  const sourceData = sourceSheet.getDataRange().getValues();
  const targetActiveProjectsData = targetActiveProjectsSheet.getDataRange().getValues();
  const targetMasterlistData = targetMasterlistSheet.getDataRange().getValues();
  const statusData = statusSheet.getDataRange().getValues();
  
  let rootProjectsFolder = null;
  let templateFolder = null;
  
  function initFolders() {
    if (!rootProjectsFolder) {
      rootProjectsFolder = DriveApp.getFolderById('1mKKScUUZIYLDmzNM6n_gLWjkLgjMgccn');
      templateFolder = DriveApp.getFolderById('1mQD1fioetbBXhh-ixbw_22nHqqUYMaRR');
    }
  }

  // 1. Build list of existing projects in Active Projects
  const existingInActiveProjects = new Set();
  for (let i = 1; i < targetActiveProjectsData.length; i++) {
    const normNo = normalizeProjectNumber(targetActiveProjectsData[i][1]); // Col B
    if (normNo) {
      existingInActiveProjects.add(normNo);
    }
  }
  
  // 2. Build list of existing projects in Archaeology_Masterlist
  const existingInMasterlist = new Set();
  for (let i = 1; i < targetMasterlistData.length; i++) {
    const normNo = normalizeProjectNumber(targetMasterlistData[i][3]); // Col D
    if (normNo) {
      existingInMasterlist.add(normNo);
    }
  }

  // 3. Map existing projects in Status Sheet by normalized StateNo (Col C / Index 2)
  const statusProjectMap = new Map();
  for (let i = 1; i < statusData.length; i++) {
    const normStateNo = normalizeProjectNumber(statusData[i][2]);
    if (normStateNo) {
      statusProjectMap.set(normStateNo, i + 1); // 1-based row index
    }
  }
  
  const rowsForActiveProjects = [];
  const rowsForMasterlist = [];
  
  // 4. Loop through source data
  for (let i = 1; i < sourceData.length; i++) {
    const row = sourceData[i];
    const columnJ = String(row[9] || '').trim(); // Column J (Archaeologist)
    const rawProjectNumber = row[1];            // Column B (Project Number / StateNo)
    const normProjectNumber = normalizeProjectNumber(rawProjectNumber);
    
    if (columnJ === 'CD' && normProjectNumber !== "") {
      
      let folderData = null;
      const getOrFolderData = () => {
        if (!folderData) {
          initFolders();
          folderData = createProjectFolder(row[0], row[4], rootProjectsFolder, templateFolder);
        }
        return folderData;
      };

      // --- ACTIVE PROJECTS LOGIC ---
      if (!existingInActiveProjects.has(normProjectNumber)) {
        const folder = getOrFolderData();
        const activeProjectRow = [...row];
        
        while (activeProjectRow.length < 23) {
          activeProjectRow.push("");
        }
        
        activeProjectRow[21] = folder.url;
        activeProjectRow[22] = folder.id;
        
        rowsForActiveProjects.push(activeProjectRow);
        existingInActiveProjects.add(normProjectNumber);
      }
      
      // --- MASTERLIST LOGIC ---
      if (!existingInMasterlist.has(normProjectNumber)) {
        const newRow = ["", "", ...row];
        rowsForMasterlist.push(newRow);
        existingInMasterlist.add(normProjectNumber);
      }

      // --- STATUS SPREADSHEET LOGIC ---
      if (statusProjectMap.has(normProjectNumber)) {
        const rowIndex = statusProjectMap.get(normProjectNumber);
        const existingRow = statusData[rowIndex - 1];
        
        const updates = [
          { colIndex: 0, val: row[0] },            // Col A: Project Name
          { colIndex: 2, val: rawProjectNumber },  // Col C: StateNo
          { colIndex: 3, val: row[4] },            // Col D: County
          { colIndex: 4, val: row[5] },            // Col E: District
          { colIndex: 5, val: row[9] },            // Col F: Arch (Col J in Source)
          { colIndex: 6, val: row[11] },           // Col G: Hist (Col L in Source)
          { colIndex: 7, val: row[8] }             // Col H: PM (Col I in Source)
        ];

        if (!existingRow[16] || String(existingRow[16]).trim() === "") {
          const folder = getOrFolderData();
          if (folder.id) {
            updates.push({ colIndex: 16, val: folder.id });
          }
        }

        updates.forEach(update => {
          const currentVal = existingRow[update.colIndex];
          if ((currentVal === "" || currentVal === null || currentVal === undefined) && update.val) {
            statusSheet.getRange(rowIndex, update.colIndex + 1).setValue(update.val);
            existingRow[update.colIndex] = update.val;
          }
        });

      } else {
        const folder = getOrFolderData();
        const newStatusRow = new Array(17).fill("");
        
        newStatusRow[0]  = row[0];             // Col A: Project Name
        newStatusRow[2]  = rawProjectNumber;   // Col C: StateNo
        newStatusRow[3]  = row[4];             // Col D: County
        newStatusRow[4]  = row[5];             // Col E: District
        newStatusRow[5]  = row[9];             // Col F: Arch
        newStatusRow[6]  = row[11];            // Col G: Hist
        newStatusRow[7]  = row[8];             // Col H: PM
        newStatusRow[16] = folder.id;          // Col Q: Folder ID

        statusSheet.appendRow(newStatusRow);
        statusProjectMap.set(normProjectNumber, statusSheet.getLastRow());
      }
    }
  }
  
  if (rowsForActiveProjects.length > 0) {
    const startRow = targetActiveProjectsSheet.getLastRow() + 1;
    targetActiveProjectsSheet.getRange(startRow, 1, rowsForActiveProjects.length, rowsForActiveProjects[0].length).setValues(rowsForActiveProjects);
  }
  
  if (rowsForMasterlist.length > 0) {
    const startRow = targetMasterlistSheet.getLastRow() + 1;
    targetMasterlistSheet.getRange(startRow, 1, rowsForMasterlist.length, rowsForMasterlist[0].length).setValues(rowsForMasterlist);
  }
}

/**
 * Synchronizes and cleans up RCD Tracking and AutoSheet based on
 * external NEPA Tracking and Archaeology Tracking states.
 */
function syncAndPruneProjects() {
  const ID_NEPA = '18HPlYoBbzhGc3HmjUtN-njQs2GwsjqqpWabX5N-Y8Wg';
  const ID_ARCH = '1v4nXrqguoAo0KBTG0g7gakOpRUn5JOOUfv_tDcGsDME';
  const ID_AUTO = '1gR_bFgn02BXs4il3utFUUTZ7zOM7qtjnRW-didoPRfo';

  const nepaSheet = SpreadsheetApp.openById(ID_NEPA).getSheetByName('Carl');
  const archSheet = SpreadsheetApp.openById(ID_ARCH).getSheetByName('Active Projects');
  const autoSheet = SpreadsheetApp.openById(ID_AUTO).getSheetByName('Status');
  const rcdSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Active Projects');

  if (!nepaSheet || !archSheet || !autoSheet || !rcdSheet) {
    throw new Error('One or more required sheets could not be found.');
  }

  // --- 1. READ EXTERNAL SOURCE DATA ---
  const nepaData = nepaSheet.getDataRange().getValues();
  const archData = archSheet.getDataRange().getValues();

  // Map NEPA: Project# (Col F, idx 5) -> Status (Col C, idx 2)
  const nepaProjectMap = new Map();
  const sentProjectNumbers = new Set();

  for (let i = 1; i < nepaData.length; i++) {
    const rawProjNo = nepaData[i][5];
    const normProjNo = normalizeProjectNumber(rawProjNo);
    const statusColC = String(nepaData[i][2] || '').trim().toUpperCase();

    if (normProjNo) {
      nepaProjectMap.set(normProjNo, statusColC);
      if (statusColC === 'SENT') {
        sentProjectNumbers.add(normProjNo);
      }
    }
  }

  // --- 2. UPDATE ARCHAEOLOGY TRACKING ENV PM IF MATCHED IN NEPA ---
  const archProjectMap = new Map();

  for (let i = 1; i < archData.length; i++) {
    const rawProjNo = archData[i][1]; // Col B (idx 1)
    const normProjNo = normalizeProjectNumber(rawProjNo);
    if (!normProjNo) continue;

    let envPm = String(archData[i][8] || '').trim();      // Col I: ENV PM (idx 8)
    const archVal = String(archData[i][9] || '').trim();  // Col J: Archaeologist (idx 9)

    // Check if matched in NEPA
    if (nepaProjectMap.has(normProjNo)) {
      if (envPm.toUpperCase() !== 'CD') {
        archSheet.getRange(i + 1, 9).setValue('CD');      // Col I is 9
        envPm = 'CD';
        archData[i][8] = 'CD';
      }
    }

    archProjectMap.set(normProjNo, {
      archaeologist: archVal,
      envPm: envPm
    });
  }

  // --- 3. RECONCILE & UPDATE RCD TRACKING (Local Sheet) ---
  const rcdData = rcdSheet.getDataRange().getValues();
  const rcdRowsToDelete = []; // 1-based row indices

  for (let i = 1; i < rcdData.length; i++) {
    const rowNum = i + 1;
    const rawProjNo = rcdData[i][1]; // Col B (idx 1)
    const normProjNo = normalizeProjectNumber(rawProjNo);

    if (!normProjNo) continue;

    // Rule A: NEPA Col C == 'SENT' -> Delete
    if (sentProjectNumbers.has(normProjNo)) {
      rcdRowsToDelete.push(rowNum);
      continue;
    }

    // Check NEPA status: is it actively on NEPA Tracking and not sent?
    const isPendingInNepa = nepaProjectMap.has(normProjNo) && !sentProjectNumbers.has(normProjNo);

    // Rule B: Delete if missing from Archaeology Tracking AND NOT active in NEPA Tracking
    if (!archProjectMap.has(normProjNo)) {
      if (!isPendingInNepa) {
        rcdRowsToDelete.push(rowNum);
        continue;
      }
    }

    // Rule C: Update ENV PM on RCD Tracking if matched in NEPA
    let rcdEnvPm = String(rcdData[i][8] || '').trim(); // Col I: ENV PM (idx 8)
    if (nepaProjectMap.has(normProjNo)) {
      if (rcdEnvPm.toUpperCase() !== 'CD') {
        rcdSheet.getRange(rowNum, 9).setValue('CD');   // Col I is 9
        rcdData[i][8] = 'CD';
        rcdEnvPm = 'CD';
      }
    }

    // Rule D: Formatting check:
    // Format to purple text ONLY if the project is NOT in Archaeology_Tracking but CD is listed as the PM
    const isNotInArch = !archProjectMap.has(normProjNo);
    const isCDPm = (rcdEnvPm.toUpperCase() === 'CD');

    if (isNotInArch && isCDPm) {
      const rowRange = rcdSheet.getRange(rowNum, 1, 1, rcdSheet.getLastColumn());
      rowRange.setFontColor('#9900ff');
      rowRange.setBackground(null);
    }
  }

  // --- 4. RECONCILE AUTO_SHEET (Status) ---
  const autoData = autoSheet.getDataRange().getValues();
  const autoRowsToDelete = [];

  for (let i = 1; i < autoData.length; i++) {
    const rowNum = i + 1;
    const rawStateNo = autoData[i][2]; // Col C (idx 2) StateNo
    const normStateNo = normalizeProjectNumber(rawStateNo);

    if (!normStateNo) continue;

    // Rule A: NEPA Col C == 'SENT' -> Delete
    if (sentProjectNumbers.has(normStateNo)) {
      autoRowsToDelete.push(rowNum);
      continue;
    }

    const isPendingInNepa = nepaProjectMap.has(normStateNo) && !sentProjectNumbers.has(normStateNo);

    // Rule B: Delete if missing from Archaeology Tracking AND NOT active in NEPA Tracking
    if (!archProjectMap.has(normStateNo)) {
      if (!isPendingInNepa) {
        autoRowsToDelete.push(rowNum);
      }
      continue;
    }
  }

  // --- 5. BATCH EXECUTE ROW DELETIONS (Bottom-to-Top) ---
  deleteRowsBottomUp(rcdSheet, rcdRowsToDelete);
  deleteRowsBottomUp(autoSheet, autoRowsToDelete);

  Logger.log(`Sync complete. Removed ${rcdRowsToDelete.length} rows from RCD Tracking and ${autoRowsToDelete.length} rows from AutoSheet.`);
}

/**
 * Deletes rows starting from the bottom of the sheet to avoid shifting indices.
 * Groups consecutive rows to minimize API calls.
 */
function deleteRowsBottomUp(sheet, rowIndices) {
  if (!rowIndices || rowIndices.length === 0) return;

  rowIndices.sort((a, b) => b - a);

  let currentBlockStart = rowIndices[0];
  let currentBlockLength = 1;

  for (let i = 1; i < rowIndices.length; i++) {
    if (rowIndices[i] === currentBlockStart - currentBlockLength) {
      currentBlockLength++;
    } else {
      sheet.deleteRows(currentBlockStart - currentBlockLength + 1, currentBlockLength);
      currentBlockStart = rowIndices[i];
      currentBlockLength = 1;
    }
  }

  sheet.deleteRows(currentBlockStart - currentBlockLength + 1, currentBlockLength);
}

/**
 * Helper function to locate the county folder using fuzzy matching, initiate the copy process, 
 * and return an object containing the URL and ID.
 */
function createProjectFolder(projectName, countyName, rootFolder, templateFolder) {
  const sanitizedProjectName = String(projectName).replace(/[^a-zA-Z0-9]/g, '');
  const targetCountyName = String(countyName).toLowerCase().trim();
  const folders = rootFolder.getFolders();
  
  let bestMatchFolder = null;
  let lowestDistance = Infinity;
  
  while (folders.hasNext()) {
    const folder = folders.next();
    const currentFolderName = folder.getName().toLowerCase().trim();
    
    if (currentFolderName === targetCountyName) {
      bestMatchFolder = folder;
      break;
    }
    
    const distance = getLevenshteinDistance(targetCountyName, currentFolderName);
    if (distance < lowestDistance) {
      lowestDistance = distance;
      bestMatchFolder = folder;
    }
  }
  
  if (bestMatchFolder) {
    const existingProjectFolders = bestMatchFolder.getFoldersByName(sanitizedProjectName);
    if (existingProjectFolders.hasNext()) {
      const existingFolder = existingProjectFolders.next();
      return { url: existingFolder.getUrl(), id: existingFolder.getId() }; 
    }
    const newFolder = copyFolderRecursive(templateFolder, bestMatchFolder, sanitizedProjectName);
    return { url: newFolder.getUrl(), id: newFolder.getId() };
  }
  
  return { url: "", id: "" }; 
}

/**
 * Helper function to recursively copy a folder, its files, and all subfolders
 */
function copyFolderRecursive(sourceFolder, destinationParentFolder, newFolderName) {
  const newFolder = destinationParentFolder.createFolder(newFolderName);
  const files = sourceFolder.getFiles();
  while (files.hasNext()) {
    const file = files.next();
    file.makeCopy(file.getName(), newFolder);
  }
  const subFolders = sourceFolder.getFolders();
  while (subFolders.hasNext()) {
    const subFolder = subFolders.next();
    copyFolderRecursive(subFolder, newFolder, subFolder.getName());
  }
  return newFolder;
}

/**
 * Helper function to calculate the Levenshtein distance between two strings
 */
function getLevenshteinDistance(a, b) {
  const matrix = [];
  for (let i = 0; i <= b.length; i++) matrix[i] = [i];
  for (let j = 0; j <= a.length; j++) matrix[0][j] = j;
  
  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          Math.min(matrix[i][j - 1] + 1, matrix[i - 1][j] + 1)
        );
      }
    }
  }
  return matrix[b.length][a.length];
}

/**
 * Monitors project folders for KMZ and vicinity PDF requirements.
 */
function monitorProjectFolders() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Active Projects');
  const data = sheet.getDataRange().getValues();
  
  Logger.log("Starting folder monitor...");
  
  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    
    let folderUrl = String(row[21]).trim(); // Column V (Index 21)
    let folderId = String(row[22]).trim();  // Column W (Index 22)
    const projectName = String(row[0]).trim();
    
    if (!folderId || folderId === '#VALUE!' || folderId === '') {
      const match = folderUrl.match(/[-\w]{25,}/);
      if (match) {
        folderId = match[0];
      } else {
        continue;
      }
    }
    
    try {
      const projectFolder = DriveApp.getFolderById(folderId);
      
      if (hasKmzFile(projectFolder)) {
        let hasVicinityPdf = false;
        const reportFolders = projectFolder.getFoldersByName('Report Elements');
        
        while (reportFolders.hasNext()) {
          const reportFolder = reportFolders.next();
          const pdfs = reportFolder.getFilesByName('01_vicinity.pdf');
          if (pdfs.hasNext()) {
            hasVicinityPdf = true;
            break;
          }
        }
        
        if (!hasVicinityPdf) {
          const existingTxt = projectFolder.getFilesByName('force_arcgis.txt');
          if (!existingTxt.hasNext()) {
            projectFolder.createFile('force_arcgis.txt', 'Trigger ArcGIS processing.');
            Logger.log(`[SUCCESS] Created 'force_arcgis.txt' for Row ${i + 1}: ${projectName}`);
          }
        }
      }
      
    } catch (e) {
      Logger.log(`[ERROR] Could not access folder for Row ${i + 1} (${projectName}): ${e.message}`);
    }
  }
  
  Logger.log("Finished checking all folders.");
}

/**
 * Helper function to recursively search for a .kmz file in a folder and all its subfolders.
 */
function hasKmzFile(folder) {
  const files = folder.searchFiles("title contains '.kmz'");
  if (files.hasNext()) {
    return true;
  }
  
  const subfolders = folder.getFolders();
  while (subfolders.hasNext()) {
    if (hasKmzFile(subfolders.next())) {
      return true;
    }
  }
  
  return false;
}

/**
 * Quick diagnostic test function to run in the script editor
 * to verify normalization rules against messy string variants.
 */
function testProjectNormalization() {
  const testCases = [
    { input: "STP-1234 00", expected: "STP-1234" },
    { input: "STP-1234-00", expected: "STP-1234" },
    { input: "STP-1234_00", expected: "STP-1234" },
    { input: "12345 00",   expected: "12345" },
    { input: "98765",       expected: "98765" },
    { input: "  44200 00 ", expected: "44200" },
    { input: "20000",       expected: "20000" }
  ];

  testCases.forEach((tc, idx) => {
    const result = normalizeProjectNumber(tc.input);
    const pass = result === tc.expected;
    Logger.log(`Test ${idx + 1} [${tc.input}]: Result="${result}" | Expected="${tc.expected}" -> ${pass ? "PASS" : "FAIL"}`);
  });
}