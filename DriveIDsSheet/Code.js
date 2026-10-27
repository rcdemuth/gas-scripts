/**
 * Adds a custom menu to the spreadsheet when opened.
 */
function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('Drive Scanner')
    .addItem('Scan Drive Folder / File...', 'showScannerDialog')
    .addSeparator()
    .addItem('Sort Sheets by Path', 'sortBothSheetsByPathMenu')
    .addToUi();
}

/**
 * Displays the modal HTML dialog for configuring the scan.
 */
function showScannerDialog() {
  const html = HtmlService.createHtmlOutput(getDialogHtml())
    .setWidth(540)
    .setHeight(620)
    .setTitle('Google Drive Inventory Scanner');
  SpreadsheetApp.getUi().showModalDialog(html, 'Google Drive Inventory Scanner');
}

/**
 * Backend API for the in-dialog Drive folder/file browser.
 * Fetches folders and files for a given folder ID (or My Drive root).
 */
function getDriveItems(folderId) {
  try {
    let folder;
    let isRoot = false;
    const rootFolder = DriveApp.getRootFolder();

    if (!folderId || folderId === 'root' || folderId === rootFolder.getId()) {
      folder = rootFolder;
      isRoot = true;
    } else {
      folder = DriveApp.getFolderById(folderId);
    }

    let parentId = null;
    let parentName = null;
    const parents = folder.getParents();
    if (parents.hasNext()) {
      const p = parents.next();
      parentId = p.getId();
      parentName = p.getName();
    }

    const folders = [];
    const subfolders = folder.getFolders();
    let folderCount = 0;
    while (subfolders.hasNext() && folderCount < 150) {
      const sf = subfolders.next();
      folders.push({ id: sf.getId(), name: sf.getName() });
      folderCount++;
    }
    folders.sort((a, b) => a.name.localeCompare(b.name));

    const files = [];
    const childFiles = folder.getFiles();
    let fileCount = 0;
    while (childFiles.hasNext() && fileCount < 150) {
      const f = childFiles.next();
      files.push({ id: f.getId(), name: f.getName() });
      fileCount++;
    }
    files.sort((a, b) => a.name.localeCompare(b.name));

    return {
      current: {
        id: folder.getId(),
        name: isRoot ? 'My Drive' : folder.getName(),
        isRoot: isRoot
      },
      parent: parentId ? { id: parentId, name: parentName } : null,
      folders: folders,
      files: files
    };
  } catch (err) {
    throw new Error('Could not access folder: ' + err.message);
  }
}

/**
 * Main execution function invoked from the UI dialog.
 */
function runDriveScan(options) {
  const targetInput = (options.targetInput || '').trim();
  const recursion = Boolean(options.recursion);
  const outputType = options.outputType || 'both'; // 'folders', 'files', 'both'
  const includeSpecified = Boolean(options.includeSpecified);

  if (!targetInput) {
    throw new Error('Please select or enter a Google Drive Folder or File.');
  }

  const extractedId = extractDriveId(targetInput);
  const ss = SpreadsheetApp.getActiveSpreadsheet();

  let folderSheet = null;
  let fileSheet = null;
  let existingFolders = new Map();
  let existingFiles = new Map();

  if (outputType === 'folders' || outputType === 'both') {
    folderSheet = getOrCreateSheet(ss, 'Folders');
    existingFolders = loadExistingRecords(folderSheet);
  }

  if (outputType === 'files' || outputType === 'both') {
    fileSheet = getOrCreateSheet(ss, 'Files');
    existingFiles = loadExistingRecords(fileSheet);
  }

  let isFolder = false;
  let targetFolder = null;
  let targetFile = null;

  try {
    targetFolder = DriveApp.getFolderById(extractedId);
    isFolder = true;
  } catch (e) {
    try {
      targetFile = DriveApp.getFileById(extractedId);
      isFolder = false;
    } catch (err) {
      throw new Error('Could not find Drive Folder/File with ID: ' + extractedId);
    }
  }

  const newFolderRows = [];
  const updatedFolderRows = [];
  const newFileRows = [];
  const updatedFileRows = [];

  if (!isFolder) {
    if (fileSheet) {
      processSingleFile(targetFile, existingFiles, newFileRows, updatedFileRows);
    }
  } else {
    const rootPath = '/' + targetFolder.getName();
    
    if (includeSpecified && folderSheet) {
      const parentInfo = getParentDetails(targetFolder);
      upsertRecord(
        existingFolders,
        newFolderRows,
        updatedFolderRows,
        targetFolder.getId(),
        [
          targetFolder.getName(),
          rootPath,
          targetFolder.getId(),
          targetFolder.getUrl(),
          parentInfo.id,
          parentInfo.url
        ]
      );
    }

    traverseDrive(
      targetFolder,
      rootPath,
      recursion,
      outputType,
      existingFolders,
      newFolderRows,
      updatedFolderRows,
      existingFiles,
      newFileRows,
      updatedFileRows
    );
  }

  if (folderSheet) {
    applySheetChanges(folderSheet, updatedFolderRows, newFolderRows);
  }
  if (fileSheet) {
    applySheetChanges(fileSheet, updatedFileRows, newFileRows);
  }

  const summary = [
    `Scan complete!`,
    folderSheet ? `Folders: ${newFolderRows.length} added, ${updatedFolderRows.length} updated.` : null,
    fileSheet ? `Files: ${newFileRows.length} added, ${updatedFileRows.length} updated.` : null,
    `Sheets organized by Google Drive Path.`
  ].filter(Boolean).join('\n');

  return summary;
}

function traverseDrive(
  folder,
  currentPath,
  recursion,
  outputType,
  existingFolders,
  newFolderRows,
  updatedFolderRows,
  existingFiles,
  newFileRows,
  updatedFileRows
) {
  if (outputType === 'files' || outputType === 'both') {
    const files = folder.getFiles();
    while (files.hasNext()) {
      const file = files.next();
      const filePath = currentPath + '/' + file.getName();
      upsertRecord(
        existingFiles,
        newFileRows,
        updatedFileRows,
        file.getId(),
        [
          file.getName(),
          filePath,
          file.getId(),
          file.getUrl(),
          folder.getId(),
          folder.getUrl()
        ]
      );
    }
  }

  const subfolders = folder.getFolders();
  while (subfolders.hasNext()) {
    const subfolder = subfolders.next();
    const subfolderPath = currentPath + '/' + subfolder.getName();

    if (outputType === 'folders' || outputType === 'both') {
      upsertRecord(
        existingFolders,
        newFolderRows,
        updatedFolderRows,
        subfolder.getId(),
        [
          subfolder.getName(),
          subfolderPath,
          subfolder.getId(),
          subfolder.getUrl(),
          folder.getId(),
          folder.getUrl()
        ]
      );
    }

    if (recursion) {
      traverseDrive(
        subfolder,
        subfolderPath,
        recursion,
        outputType,
        existingFolders,
        newFolderRows,
        updatedFolderRows,
        existingFiles,
        newFileRows,
        updatedFileRows
      );
    }
  }
}

function processSingleFile(file, existingFiles, newFileRows, updatedFileRows) {
  const parentInfo = getParentDetails(file);
  const filePath = (parentInfo.name ? '/' + parentInfo.name : '') + '/' + file.getName();
  upsertRecord(
    existingFiles,
    newFileRows,
    updatedFileRows,
    file.getId(),
    [
      file.getName(),
      filePath,
      file.getId(),
      file.getUrl(),
      parentInfo.id,
      parentInfo.url
    ]
  );
}

function getParentDetails(item) {
  const parents = item.getParents();
  if (parents.hasNext()) {
    const p = parents.next();
    return { id: p.getId(), url: p.getUrl(), name: p.getName() };
  }
  return { id: '', url: '', name: '' };
}

function upsertRecord(existingMap, newRows, updatedRows, id, rowData) {
  if (existingMap.has(id)) {
    const existing = existingMap.get(id);
    const hasChanged =
      existing.rowData[0] !== rowData[0] ||
      existing.rowData[1] !== rowData[1] ||
      existing.rowData[4] !== rowData[4];

    if (hasChanged) {
      updatedRows.push({ rowIndex: existing.rowIndex, values: rowData });
      existing.rowData = rowData;
    }
  } else {
    newRows.push(rowData);
    existingMap.set(id, { rowIndex: -1, rowData: rowData });
  }
}

function applySheetChanges(sheet, updatedRows, newRows) {
  for (let i = 0; i < updatedRows.length; i++) {
    const item = updatedRows[i];
    sheet.getRange(item.rowIndex, 1, 1, item.values.length).setValues([item.values]);
  }

  if (newRows.length > 0) {
    const startRow = sheet.getLastRow() + 1;
    sheet.getRange(startRow, 1, newRows.length, newRows[0].length).setValues(newRows);
  }

  sortSheetByPath(sheet);
}

function sortSheetByPath(sheet) {
  const lastRow = sheet.getLastRow();
  const lastCol = Math.max(sheet.getLastColumn(), 6);
  if (lastRow > 1) {
    const dataRange = sheet.getRange(2, 1, lastRow - 1, lastCol);
    dataRange.sort([
      { column: 2, ascending: true }, // Column B: Path
      { column: 1, ascending: true }  // Column A: Name
    ]);
    sheet.autoResizeColumns(1, 6);
  }
}

function sortBothSheetsByPathMenu() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const folderSheet = ss.getSheetByName('Folders');
  const fileSheet = ss.getSheetByName('Files');

  let sortedCount = 0;
  if (folderSheet && folderSheet.getLastRow() > 1) {
    sortSheetByPath(folderSheet);
    sortedCount++;
  }
  if (fileSheet && fileSheet.getLastRow() > 1) {
    sortSheetByPath(fileSheet);
    sortedCount++;
  }

  SpreadsheetApp.getActiveSpreadsheet().toast(
    `Sorted ${sortedCount} sheet(s) by Google Drive Path.`,
    'Sorting Complete',
    3
  );
}

function loadExistingRecords(sheet) {
  const map = new Map();
  const lastRow = sheet.getLastRow();
  if (lastRow <= 1) return map;

  const values = sheet.getRange(2, 1, lastRow - 1, 6).getValues();
  for (let i = 0; i < values.length; i++) {
    const id = String(values[i][2]).trim();
    if (id) {
      map.set(id, {
        rowIndex: i + 2,
        rowData: values[i]
      });
    }
  }
  return map;
}

function getOrCreateSheet(ss, sheetName) {
  let sheet = ss.getSheetByName(sheetName);
  const headers = [
    'Name',
    'Google Drive Path',
    'Drive ID',
    'Drive Link',
    'Parent Folder Drive ID',
    'Parent Folder Link'
  ];

  if (!sheet) {
    sheet = ss.insertSheet(sheetName);
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    sheet.getRange(1, 1, 1, headers.length).setFontWeight('bold');
    sheet.setFrozenRows(1);
  } else if (sheet.getLastRow() === 0) {
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    sheet.getRange(1, 1, 1, headers.length).setFontWeight('bold');
    sheet.setFrozenRows(1);
  }
  return sheet;
}

function extractDriveId(input) {
  if (!input) return '';
  const folderMatch = input.match(/\/folders\/([a-zA-Z0-9_-]+)/);
  if (folderMatch && folderMatch[1]) return folderMatch[1];

  const fileMatch = input.match(/\/d\/([a-zA-Z0-9_-]+)/);
  if (fileMatch && fileMatch[1]) return fileMatch[1];

  const idParamMatch = input.match(/[?&]id=([a-zA-Z0-9_-]+)/);
  if (idParamMatch && idParamMatch[1]) return idParamMatch[1];

  return input.split(/[?#]/)[0].trim();
}

/**
 * Returns the HTML dialog content with the embedded Drive Explorer.
 */
function getDialogHtml() {
  return `
  <!DOCTYPE html>
  <html>
    <head>
      <base target="_top">
      <style>
        body {
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
          font-size: 13px;
          margin: 16px;
          color: #202124;
        }
        .form-group {
          margin-bottom: 12px;
        }
        label {
          display: block;
          font-weight: 600;
          margin-bottom: 5px;
        }
        .input-row {
          display: flex;
          gap: 6px;
        }
        input[type="text"], select {
          width: 100%;
          padding: 7px 9px;
          box-sizing: border-box;
          border: 1px solid #dadce0;
          border-radius: 4px;
        }
        .checkbox-label {
          font-weight: normal;
          display: flex;
          align-items: center;
          gap: 8px;
          cursor: pointer;
          margin-top: 5px;
        }
        .btn-container {
          margin-top: 16px;
          display: flex;
          justify-content: flex-end;
          gap: 8px;
        }
        button {
          padding: 7px 15px;
          border-radius: 4px;
          border: 1px solid transparent;
          cursor: pointer;
          font-size: 13px;
          font-weight: 500;
        }
        .btn-primary {
          background-color: #1a73e8;
          color: #fff;
        }
        .btn-primary:hover {
          background-color: #1557b0;
        }
        .btn-primary:disabled {
          background-color: #dadce0;
          cursor: not-allowed;
        }
        .btn-secondary {
          background-color: #f1f3f4;
          color: #3c4043;
          border-color: #dadce0;
        }
        .btn-secondary:hover {
          background-color: #e8eaed;
        }
        /* Picker panel styles */
        #pickerContainer {
          border: 1px solid #dadce0;
          border-radius: 6px;
          padding: 8px;
          margin-top: 8px;
          background-color: #fafbfc;
          display: none;
        }
        .picker-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding-bottom: 6px;
          border-bottom: 1px solid #e0e0e0;
          margin-bottom: 6px;
        }
        .breadcrumb-text {
          font-weight: 600;
          color: #1a73e8;
          font-size: 12px;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
          max-width: 320px;
        }
        .picker-list {
          height: 180px;
          overflow-y: auto;
          background: #fff;
          border: 1px solid #e8eaed;
          border-radius: 4px;
        }
        .picker-item {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 6px 10px;
          border-bottom: 1px solid #f1f3f4;
          font-size: 12px;
        }
        .picker-item:hover {
          background-color: #f8f9fa;
        }
        .item-label {
          display: flex;
          align-items: center;
          gap: 6px;
          cursor: pointer;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
          flex-grow: 1;
        }
        .item-label:hover {
          color: #1a73e8;
        }
        .item-actions button {
          padding: 3px 8px;
          font-size: 11px;
        }
        #statusMessage {
          margin-top: 10px;
          font-size: 12px;
          min-height: 18px;
        }
      </style>
    </head>
    <body>
      <div class="form-group">
        <label for="targetInput">Target Drive Folder / File:</label>
        <div class="input-row">
          <input type="text" id="targetInput" placeholder="Paste link/ID or click 'Browse Drive'..." />
          <button type="button" class="btn-secondary" id="browseToggleBtn" onclick="togglePicker()">Browse Drive</button>
        </div>
      </div>

      <!-- In-Dialog Drive Picker Panel -->
      <div id="pickerContainer">
        <div class="picker-header">
          <div class="breadcrumb-text" id="pickerPath">Loading My Drive...</div>
          <div style="display: flex; gap: 4px;">
            <button type="button" class="btn-secondary" id="upBtn" style="padding: 3px 8px; font-size: 11px;" onclick="navigateUp()" disabled>⬆ Up</button>
            <button type="button" class="btn-primary" style="padding: 3px 8px; font-size: 11px;" onclick="selectCurrentFolder()">Select This Folder</button>
          </div>
        </div>
        <div class="picker-list" id="pickerList">
          <div style="padding: 12px; color: #5f6368;">Loading items...</div>
        </div>
      </div>

      <div class="form-group" style="margin-top: 10px;">
        <label for="outputType">Include in Output:</label>
        <select id="outputType">
          <option value="both" selected>Both Folders and Files</option>
          <option value="folders">Folders Only</option>
          <option value="files">Files Only</option>
        </select>
      </div>

      <div class="form-group">
        <label class="checkbox-label">
          <input type="checkbox" id="recursion" />
          Recursive scan (include all nested subfolders)
        </label>
      </div>

      <div class="form-group">
        <label class="checkbox-label">
          <input type="checkbox" id="includeSpecified" checked />
          Include target folder details in output
        </label>
      </div>

      <div id="statusMessage"></div>

      <div class="btn-container">
        <button class="btn-secondary" onclick="google.script.host.close()">Close</button>
        <button class="btn-primary" id="runBtn" onclick="submitForm()">Run Scan</button>
      </div>

      <script>
        var currentFolderData = null;

        function togglePicker() {
          var container = document.getElementById('pickerContainer');
          var btn = document.getElementById('browseToggleBtn');
          if (container.style.display === 'block') {
            container.style.display = 'none';
            btn.textContent = 'Browse Drive';
          } else {
            container.style.display = 'block';
            btn.textContent = 'Hide Browser';
            if (!currentFolderData) {
              loadFolder('root');
            }
          }
        }

        function loadFolder(folderId) {
          var list = document.getElementById('pickerList');
          list.innerHTML = '<div style="padding: 12px; color: #5f6368;">Loading folder items...</div>';
          document.getElementById('upBtn').disabled = true;

          google.script.run
            .withSuccessHandler(renderFolderView)
            .withFailureHandler(function(err) {
              list.innerHTML = '<div style="padding: 12px; color: #d93025;">Error: ' + err.message + '</div>';
            })
            .getDriveItems(folderId);
        }

        function renderFolderView(data) {
          currentFolderData = data;
          document.getElementById('pickerPath').textContent = data.current.name;
          document.getElementById('upBtn').disabled = !data.parent || data.current.isRoot;

          var list = document.getElementById('pickerList');
          list.innerHTML = '';

          if (data.folders.length === 0 && data.files.length === 0) {
            list.innerHTML = '<div style="padding: 12px; color: #5f6368;">Folder is empty.</div>';
            return;
          }

          // Render Folders
          data.folders.forEach(function(f) {
            var item = document.createElement('div');
            item.className = 'picker-item';
            item.innerHTML = 
              '<div class="item-label" onclick="loadFolder(\\'' + f.id + '\\')">' +
                '<span>📁</span> <span title="' + escapeHtml(f.name) + '">' + escapeHtml(f.name) + '</span>' +
              '</div>' +
              '<div class="item-actions">' +
                '<button type="button" class="btn-secondary" onclick="selectItem(\\'' + f.id + '\\', \\'' + escapeHtml(f.name) + '\\')">Select</button>' +
              '</div>';
            list.appendChild(item);
          });

          // Render Files
          data.files.forEach(function(file) {
            var item = document.createElement('div');
            item.className = 'picker-item';
            item.innerHTML = 
              '<div class="item-label">' +
                '<span>📄</span> <span title="' + escapeHtml(file.name) + '">' + escapeHtml(file.name) + '</span>' +
              '</div>' +
              '<div class="item-actions">' +
                '<button type="button" class="btn-secondary" onclick="selectItem(\\'' + file.id + '\\', \\'' + escapeHtml(file.name) + '\\')">Select</button>' +
              '</div>';
            list.appendChild(item);
          });
        }

        function navigateUp() {
          if (currentFolderData && currentFolderData.parent) {
            loadFolder(currentFolderData.parent.id);
          }
        }

        function selectCurrentFolder() {
          if (currentFolderData && currentFolderData.current) {
            selectItem(currentFolderData.current.id, currentFolderData.current.name);
          }
        }

        function selectItem(id, name) {
          document.getElementById('targetInput').value = id;
          document.getElementById('pickerContainer').style.display = 'none';
          document.getElementById('browseToggleBtn').textContent = 'Browse Drive';
          document.getElementById('statusMessage').innerHTML = 
            '<span style="color:#188038;">Selected: <b>' + escapeHtml(name) + '</b></span>';
        }

        function escapeHtml(text) {
          var div = document.createElement('div');
          div.appendChild(document.createTextNode(text));
          return div.innerHTML;
        }

        function submitForm() {
          var inputVal = document.getElementById('targetInput').value.trim();
          if (!inputVal) {
            document.getElementById('statusMessage').innerHTML = 
              '<span style="color:#d93025;">Please pick or enter a Folder/File ID or link.</span>';
            return;
          }

          var runBtn = document.getElementById('runBtn');
          var status = document.getElementById('statusMessage');
          runBtn.disabled = true;
          status.innerHTML = '<span style="color:#1a73e8; font-weight: bold;">Scanning Drive... This may take a moment.</span>';

          var options = {
            targetInput: inputVal,
            outputType: document.getElementById('outputType').value,
            recursion: document.getElementById('recursion').checked,
            includeSpecified: document.getElementById('includeSpecified').checked
          };

          google.script.run
            .withSuccessHandler(function(response) {
              runBtn.disabled = false;
              status.innerHTML = '<span style="color:#188038;">' + response.replace(/\\n/g, '<br>') + '</span>';
            })
            .withFailureHandler(function(error) {
              runBtn.disabled = false;
              status.innerHTML = '<span style="color:#d93025;">Error: ' + error.message + '</span>';
            })
            .runDriveScan(options);
        }
      </script>
    </body>
  </html>
  `;
}

function doGet() {
  return HtmlService.createHtmlOutput(getDialogHtml())
    .setTitle('Google Drive Inventory Scanner')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

