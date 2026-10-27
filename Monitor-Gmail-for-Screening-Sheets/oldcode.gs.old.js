/** ==========================================
// --- GLOBAL CONFIGURATION ---
// ==========================================
const primaryProjectsFolderId = '1mKKScUUZIYLDmzNM6n_gLWjkLgjMgccn';
const templateFolderId = '1mQD1fioetbBXhh-ixbw_22nHqqUYMaRR'; 

// Toggle Sheet IDs by commenting/uncommenting:
const sheetId = '18HPlYoBbzhGc3HmjUtN-njQs2GwsjqqpWabX5N-Y8Wg'; // PRODUCTION
// const sheetId = '1gbeRV4vF2RfRgACJrQlK-FeJ9wh3QgTGlRzSkRwMaAU'; // TESTING

// Toggle Forwarding Recipient by commenting/uncommenting:
const recipient = "hannah.e.kasson@wv.gov"; // PRODUCTION
// const recipient = "robert.c.demuth@wv.gov"; // TESTING
// ==========================================

/**
 * Main function to process incoming emails, extract form fields, 
 * route the data to Drive folders, create Google Tasks, and update Sheets.
**
async function processScreeningSheets() {
  const primaryFolder = DriveApp.getFolderById(primaryProjectsFolderId);
  const templateFolder = DriveApp.getFolderById(templateFolderId);
  
  // Field Substitution Map
  const fieldMappingArray = [
    ["Text1", "StateNo"],["Text2", "FederalNo"],["Text3", "ProjectName"],
    ["Text4", "County"],["Text5", "MemoDate"],["Text6", "From"],
    ["Text7", "Authorization"],["Text8", "DSN_PM"],["Text9", "History Notes"],
    ["Dropdown1", "Historian"],["Check Box1", "HistoryRE"],["Check Box2", "HistorySHPO"],
    ["Text10", "ArchaeologyNotes"],["Check Box3", "ArchaeologyRE"],["Check Box4", "ArchaeologySHPO"],
    ["Dropdown2", "Archaeologist"],["Check Box5", "Sec7ESASpeciesListComplete" ],
    ["Check Box6", "StateListMusselStream"],["Check Box7", "Sec7esaNEdkeyComplete"],
    ["Check Box8", "MayAffectNeedUSFWSReview"],["Check Box9", "FedListMusselStream"],
    ["Check Box10", "FedListCrayfishStream"],["Check Box11", "BoxTurtleHighPriority"],
    ["Text11", "Coordinates"],["Text12", "Quad"],["Text13", "BARS"],
    ["Text14", "Airport"],["Text15", "NR_Notes"],["Text16", "ENG_Date"],
    ["Text17", "ROW_Date"],["Text18", "CN_Date"],["Check Box16", "NeedsBatHabitatAssess"],
    ["Check Box13", "TreeRemoval"],["Check Box14", "USGS_Coordination"]
  ];
  const fieldMap = Object.fromEntries(fieldMappingArray);
  
  // --- METRICS TRACKING ---
  let identifiedEmailsCount = 0;
  let emailSubjects = [];
  let extractedPdfDetails = []; 
  let foldersCreatedCount = 0;
  let savedFileLocations = [];
  
  // Setup Gmail Label
  let projectLabel = GmailApp.getUserLabelByName("Projects");
  if (!projectLabel) {
    projectLabel = GmailApp.createLabel("Projects");
    console.log('Created new Gmail label: Projects');
  }
  
  // --- POLYFILLS FOR APPS SCRIPT ---
  globalThis.setTimeout = function(callback, delay) {
    Utilities.sleep(delay || 0);
    callback();
  };
  globalThis.clearTimeout = function() {};
  
  // Dynamically import pdf-lib
  const pdfLibUrl = "https://cdnjs.cloudflare.com/ajax/libs/pdf-lib/1.17.1/pdf-lib.min.js";
  eval(UrlFetchApp.fetch(pdfLibUrl).getContentText());
  
  // Search Gmail for unread emails matching the criteria
  const searchQuery = 'has:attachment filename:pdf filename:"Screening Sheet" is:unread';
  const threads = GmailApp.search(searchQuery);
  
  for (const thread of threads) {
    const messages = thread.getMessages();
    let threadProcessed = false;
    
    for (const message of messages) {
      if (!message.isUnread()) continue;
      
      const attachments = message.getAttachments();
      let messageHasValidAttachment = false;
      
      for (const attachment of attachments) {
        const fileName = attachment.getName();
        
        if (attachment.getContentType() === 'application/pdf' && fileName.includes('Screening Sheet')) {
          
          if (!messageHasValidAttachment) {
            identifiedEmailsCount++;
            emailSubjects.push(message.getSubject());
            messageHasValidAttachment = true;
          }
          
          // 1. Extract raw form values natively using pdf-lib
          const rawFormData = await extractPdfFields(attachment);
          
          // 2. Map the raw keys to the friendly names
          const mappedFormData = {};
          for (const [key, value] of Object.entries(rawFormData)) {
            const mappedKey = fieldMap[key] || key; 
            mappedFormData[mappedKey] = value;
          }
          
          // 3. Route to Google Sheets & Forward if conditions are met
          const rawSender = message.getFrom().toLowerCase();
          const emailMatch = rawSender.match(/<([^>]+)>/);
          const senderEmail = emailMatch ? emailMatch[1].trim() : rawSender.trim();
          
          const dsnPmValue = (mappedFormData['DSN_PM'] || '').toString().toLowerCase();
          const isTestingMode = false;
          
          console.log(`\n--- SPREADSHEET ROUTING CHECK ---`);
          console.log(`Cleaned Email Sender: ${senderEmail} (Original: ${rawSender})`);
          console.log(`DSN_PM Field Value: ${dsnPmValue}`);
          
          if (dsnPmValue.includes('carl') || dsnPmValue.includes('demuth')) {
            console.log("=> Routing criteria MET! Updating Spreadsheets and forwarding...");
            updateSpreadsheetsAndForward(mappedFormData, message, isTestingMode);
          } else {
            console.log("=> Routing criteria NOT met. Skipping spreadsheet update for this file.");
          }
          console.log(`---------------------------------\n`);
          
          // 4. Extract specific routing data for Drive
          const rawProjectName = mappedFormData['ProjectName'] || mappedFormData['Text 3'] || '';
          const rawCountyName = mappedFormData['County'] || mappedFormData['Text 4'] || '';
          
          if (!rawCountyName || !rawProjectName) {
            console.log('Missing County or Project Name in PDF. Skipping Drive routing for this file...');
            continue;
          }
          
          extractedPdfDetails.push({ project: rawProjectName, county: rawCountyName });

          // 5. Redact all whitespace and special characters from Project Name
          const safeProjectName = rawProjectName.replace(/[^a-zA-Z0-9]/g, '');
          
          // 6. Find the matching County folder using Fuzzy Matching
          const countyFolder = findCountyFolderFuzzy(primaryFolder, rawCountyName);
          
          // 7. Check if the project folder exists within the county folder
          let projectFolder = getFolderByName(countyFolder, safeProjectName);
          
          if (!projectFolder) {
            projectFolder = copyFolderRecursive(templateFolder, countyFolder, safeProjectName);
            foldersCreatedCount++; 
          } 
          
          // 8. Save ALL email attachments into the root of the project folder
          for (const att of attachments) {
            const attName = att.getName();
            const existingFiles = projectFolder.getFilesByName(attName);
            while (existingFiles.hasNext()) {
              existingFiles.next().setTrashed(true);
            }
            projectFolder.createFile(att);
          }
          
          savedFileLocations.push(`${countyFolder.getName()} / ${safeProjectName}`);

          // 9. Generate Task and Calendar Events based on the requested logic
          handleTasksAndCalendar(mappedFormData, rawProjectName);

          // 10. Fetch bridge summary data using BARS number
          const barsNumber = mappedFormData['BARS'] || mappedFormData['Text13'] || '';
          if (barsNumber) {
            console.log(`Fetching Bridge Data for BARS Number: ${barsNumber}...`);
            const bridgeData = getBridgeDataFromSheet(barsNumber);
            
            console.log(`--- BRIDGE SUMMARY FOR ${safeProjectName} ---`);
            console.log(bridgeData.summary);
            console.log(`-------------------------------------------`);
            
            // Include summary inside mappedFormData so it is saved to metadata.json
            mappedFormData['BridgeSummary'] = bridgeData.summary;
            mappedFormData['BridgeExtractedValues'] = bridgeData.valuesArray;
          } else {
            console.log(`No BARS number found on PDF for ${safeProjectName}. Skipping bridge query.`);
          }

          // 11. Save mappedFormData (including bridge summary) as metadata.json
          saveMetadataJson(projectFolder, mappedFormData);
          
          threadProcessed = true;
        }
      }
      if (messageHasValidAttachment) {
         message.markRead();
      }
    }
    
    if (threadProcessed) {
      thread.addLabel(projectLabel);
    }
  }
  
  // --- OUTPUT SUMMARY TO CONSOLE ---
  console.log("=========================================");
  console.log("         EXECUTION SUMMARY               ");
  console.log("=========================================");
  console.log(`Emails Identified: ${identifiedEmailsCount}`);
  if (emailSubjects.length > 0) {
    console.log("Subject Lines:");
    emailSubjects.forEach(subject => console.log(`  - ${subject}`));
  }
  console.log("=========================================");
}

/**
 * Handles creation of the Google Task and conditional Calendar event on the deadline
 **
function handleTasksAndCalendar(mappedFormData, projectName) {
  const today = new Date();
  today.setHours(0, 0, 0, 0); 
  
  const oneMonthFromNow = new Date(today);
  oneMonthFromNow.setMonth(today.getMonth() + 1);

  function getValidDate(dateStr) {
    if (!dateStr || dateStr.trim() === '') return null;
    const d = new Date(dateStr.trim());
    if (isNaN(d.getTime())) return null;
    
    d.setHours(0, 0, 0, 0);
    if (d.getTime() >= oneMonthFromNow.getTime()) {
      return d;
    }
    return null;
  }

  const rowDate = getValidDate(mappedFormData['ROW_Date']);
  const cnDate = getValidDate(mappedFormData['CN_Date']);
  const engDate = getValidDate(mappedFormData['ENG_Date']);
  
  const firstValidDate = rowDate || cnDate || engDate;
  
  let taskDate;
  let taskTitle;
  let createCalEvent = false;
  let calDate;
  let calTitle;

  if (firstValidDate) {
    taskDate = new Date(firstValidDate);
    taskDate.setDate(taskDate.getDate() - 14); 
    taskTitle = `CE due for ${projectName}`;
    
    calDate = new Date(firstValidDate); 
    calTitle = `CE DEADLINE - ${projectName}`;
    createCalEvent = true;
  } else {
    taskDate = new Date(today);
    taskDate.setDate(taskDate.getDate() + 90); 
    
    if (taskDate.getDay() === 6) { 
      taskDate.setDate(taskDate.getDate() + 2);
    } else if (taskDate.getDay() === 0) { 
      taskDate.setDate(taskDate.getDate() + 1);
    }
    
    taskTitle = `CE due for ${projectName} - NO DATES`;
    createCalEvent = false;
  }

  // Generate Google Task (With Duplicate Check)
  try {
    let taskLists = Tasks.Tasklists.list().getItems() || [];
    let targetList = taskLists.find(list => list.title === 'CEs');
    let taskListId;
    
    if (targetList) {
      taskListId = targetList.id;
    } else {
      console.log("Task list 'CEs' not found. Creating it now...");
      const newList = Tasks.Tasklists.insert({ title: 'CEs' });
      taskListId = newList.id;
    }

    const existingTasks = Tasks.Tasks.list(taskListId).getItems() || [];
    const isDuplicateTask = existingTasks.some(t => t.title === taskTitle);
    
    if (isDuplicateTask) {
      console.log(`Skipped task: "${taskTitle}" already exists in the 'CEs' list.`);
    } else {
      const task = {
        title: taskTitle,
        due: taskDate.toISOString() 
      };
      Tasks.Tasks.insert(task, taskListId);
      console.log(`Task created: "${taskTitle}" due on ${taskDate.toDateString()} in the 'CEs' list.`);
    }
  } catch (e) {
    console.log(`Failed to create task. Error: ${e.message}`);
  }

  // Conditionally Generate Calendar Event
  if (createCalEvent) {
    const calendar = CalendarApp.getDefaultCalendar();
    const existingEvents = calendar.getEventsForDay(calDate, { search: calTitle });
    
    if (existingEvents.length === 0) {
      calendar.createAllDayEvent(calTitle, calDate);
      console.log(`Calendar event created: "${calTitle}" on ${calDate.toDateString()}`);
    } else {
      console.log(`Skipped calendar event: "${calTitle}" already exists on ${calDate.toDateString()}`);
    }
  } else {
    console.log(`Skipped calendar event: No valid dates found.`);
  }
}

/**
 * Updates the designated Google Sheets based on specific routing criteria and forwards the email.
 *
function updateSpreadsheetsAndForward(mappedFormData, message, isTestingMode) {
  try {
    let ss;
    try {
      ss = SpreadsheetApp.openById(sheetId);
    } catch (e) {
      console.log(`CRITICAL ERROR: Cannot open Spreadsheet with ID ${sheetId}.`);
      return;
    }
    
    const colToLetter = (colIndex) => {
      let temp, letter = '';
      let col = colIndex + 1;
      while (col > 0) {
        temp = (col - 1) % 26;
        letter = String.fromCharCode(temp + 65) + letter;
        col = (col - temp - 1) / 26;
      }
      return letter;
    };
    
    const stateNo = mappedFormData['StateNo'] || '';

    // TAB 1: UPDATE "Carl"
    const carlSheet = ss.getSheetByName('Carl');
    if (carlSheet) {
      const dataRange = carlSheet.getDataRange();
      const data = dataRange.getValues();
      const headers = data[0]; 
      
      let isDuplicate = false;
      if (stateNo) {
        isDuplicate = data.some((row, index) => {
          return index > 0 && String(row[5]).trim() === String(stateNo).trim(); 
        });
      }
      
      if (isDuplicate) {
        console.log(`Carl Sheet Check: Project No "${stateNo}" already exists in Column F. Skipping Carl sheet update.`);
      } else {
        let targetRowIndex = -1;
        for (let i = 1; i < data.length; i++) {
          const colE = data[i][4] ? String(data[i][4]).trim() : '';
          const colF = data[i][5] ? String(data[i][5]).trim() : '';
          
          if (colE === '' && colF === '') {
            targetRowIndex = i + 1; 
            break;
          }
        }
        if (targetRowIndex === -1) {
          targetRowIndex = data.length + 1; 
        }
        
        const getColIndex = (headerName) => headers.indexOf(headerName);
        
        const colCVal = getBestValidationMatch(carlSheet, targetRowIndex, 3, 'NOT SENT'); 
        const colKVal = getBestValidationMatch(carlSheet, targetRowIndex, 11, 'Not Received'); 
        const colMVal = getBestValidationMatch(carlSheet, targetRowIndex, 13, 'Not Received'); 
        
        const countyColIndex = getColIndex('County');
        let finalCountyVal = mappedFormData['County'] || '';
        if (countyColIndex !== -1 && finalCountyVal) {
          finalCountyVal = getBestValidationMatch(carlSheet, targetRowIndex, countyColIndex + 1, finalCountyVal);
        }
        
        const historyColIndex = getColIndex('History');
        let rawHistoryVal = mappedFormData['HistoryRE'] ? 'RE' : (mappedFormData['HistorySHPO'] ? 'SHPO' : '');
        if (historyColIndex !== -1 && rawHistoryVal) {
          rawHistoryVal = getBestValidationMatch(carlSheet, targetRowIndex, historyColIndex + 1, rawHistoryVal);
        }
        
        const archColIndex = getColIndex('Archaeology');
        let rawArchVal = mappedFormData['ArchaeologyRE'] ? 'RE' : (mappedFormData['ArchaeologySHPO'] ? 'SHPO' : '');
        if (archColIndex !== -1 && rawArchVal) {
          rawArchVal = getBestValidationMatch(carlSheet, targetRowIndex, archColIndex + 1, rawArchVal);
        }

        const updates = [
          { col: 2, val: colCVal }, 
          { col: 3, val: mappedFormData['ROW_Date'] || '' }, 
          { col: 5, val: stateNo }, 
          { col: 10, val: colKVal }, 
          { col: 12, val: colMVal }, 
          { col: getColIndex('Project'), val: mappedFormData['ProjectName'] },
          { col: getColIndex('County'), val: finalCountyVal },
          { col: getColIndex('Coordinates'), val: mappedFormData['Coordinates'] },
          { col: historyColIndex, val: rawHistoryVal },
          { col: archColIndex, val: rawArchVal }
        ];
        
        updates.forEach(update => {
          if (update.col !== -1 && update.col !== undefined && update.val !== undefined && update.val !== '') {
            carlSheet.getRange(targetRowIndex, update.col + 1).setValue(update.val);
          }
        });
        console.log(`Carl Sheet Updated: Added Project No "${stateNo}" to Row ${targetRowIndex}.`);
      }
    } else {
      console.log("Error: Tab named 'Carl' not found.");
    }
    
    // TAB 2: UPDATE "Section 7s" and FORWARD EMAIL
    const sec7Sheet = ss.getSheetByName('Section 7s');
    if (sec7Sheet) {
      const sec7Data = sec7Sheet.getDataRange().getValues();
      
      let isSec7Duplicate = false;
      if (stateNo) {
        isSec7Duplicate = sec7Data.some((row, index) => {
          return index > 0 && String(row[4]).trim() === String(stateNo).trim(); 
        });
      }
      
      if (isSec7Duplicate) {
        console.log(`Section 7s Sheet Check: Project No "${stateNo}" already exists in Column E. Skipping Section 7s update and forwarding.`);
      } else {
        let carlRowIndex = -1;
        
        for (let i = 0; i < sec7Data.length; i++) {
          if (String(sec7Data[i][0]).trim().toUpperCase() === 'CARL') {
            carlRowIndex = i + 1; 
            break;
          }
        }
        
        if (carlRowIndex !== -1) {
          let insertRowIndex = -1;
          
          for (let i = carlRowIndex; i < sec7Data.length; i++) {
            const colDVal = String(sec7Data[i][3]).trim(); 
            if (colDVal === 'BLANK') {
              insertRowIndex = i + 1; 
              break;
            }
          }
          
          if (insertRowIndex === -1) {
            insertRowIndex = sec7Data.length + 1; 
          }
          
          sec7Sheet.insertRowBefore(insertRowIndex);
          
          const sec7ColBVal = getBestValidationMatch(sec7Sheet, insertRowIndex, 2, 'Not Sent');
          const sec7CountyVal = getBestValidationMatch(sec7Sheet, insertRowIndex, 6, mappedFormData['County'] || '');
          
          const sec7Updates = [
            { col: 0, val: false }, 
            { col: 1, val: sec7ColBVal }, 
            { col: 2, val: mappedFormData['ROW_Date'] || '' }, 
            { col: 3, val: mappedFormData['ProjectName'] || '' }, 
            { col: 4, val: stateNo }, 
            { col: 5, val: sec7CountyVal }, 
            { col: 6, val: mappedFormData['Coordinates'] || '' } 
          ];

          sec7Updates.forEach(update => {
             sec7Sheet.getRange(insertRowIndex, update.col + 1).setValue(update.val);
          });
          
          console.log(`Section 7s Sheet Updated: Inserted new project at Row ${insertRowIndex}.`);
          
          const forwardBodyHTML = "Hannah,<br><br>Just forwarding this along as an FYI, I've added it to the Section 7s tab of the spreadsheet.<br><br>Carl<br><br><i>This email was generated as part of an automated workflow, I apologize if it was sent in error.</i>";
          
          message.forward(recipient, {
            htmlBody: forwardBodyHTML
          });
          
          console.log(`Email forwarded successfully to ${recipient}`);
        } else {
          console.log("Could not find 'CARL' in Column A of the Section 7s tab. Skipping Section 7s update.");
        }
      }
    } else {
      console.log("Error: Tab named 'Section 7s' not found.");
    }

  } catch (error) {
    console.log(`Failed to update spreadsheets and forward email: ${error.message}`);
  }
}

/**
 * Reads a Data Validation rule from a cell and fuzzy-matches the target value 
 *
function getBestValidationMatch(sheet, row, col, targetValue) {
  if (!targetValue) return '';
  const cell = sheet.getRange(row, col);
  const rule = cell.getDataValidation();
  
  if (!rule) return targetValue;
  
  const criteriaType = rule.getCriteriaType();
  let options = [];
  
  if (criteriaType === SpreadsheetApp.DataValidationCriteria.VALUE_IN_LIST) {
    options = rule.getCriteriaValues()[0];
  } else if (criteriaType === SpreadsheetApp.DataValidationCriteria.VALUE_IN_RANGE) {
    const range = rule.getCriteriaValues()[0];
    options = range.getValues().flat().filter(String);
  } else {
    return targetValue;
  }
  
  let bestMatch = targetValue;
  let minDistance = Infinity;
  const targetClean = String(targetValue).toLowerCase().trim();
  
  options.forEach(opt => {
    const optClean = String(opt).toLowerCase().trim();
    const dist = getLevenshteinDistance(targetClean, optClean);
    if (dist < minDistance) {
      minDistance = dist;
      bestMatch = opt; 
    }
  });
  
  return bestMatch;
}

/**
 * Extracts AcroForm fields from a PDF blob using pdf-lib safely
 *
async function extractPdfFields(blob) {
  const bytes = new Uint8Array(blob.getBytes());
  const pdfDoc = await PDFLib.PDFDocument.load(bytes);
  const form = pdfDoc.getForm();
  const fields = form.getFields();
  const formData = {};
  
  fields.forEach(field => {
    const name = field.getName();
    try {
      if (typeof field.getText === 'function') formData[name] = field.getText() || '';
      else if (typeof field.isChecked === 'function') formData[name] = field.isChecked();
      else if (typeof field.getSelected === 'function') {
        const selected = field.getSelected();
        formData[name] = Array.isArray(selected) ? (selected.length > 0 ? selected[0] : '') : (selected || '');
      } else formData[name] = "[Unsupported Field]";
    } catch (e) {
      formData[name] = null;
    }
  });
  return formData;
}

/**
 * Uses Levenshtein distance to find the closest matching folder name
 *
function findCountyFolderFuzzy(parentFolder, searchName) {
  const folders = parentFolder.getFolders();
  let bestMatch = null;
  let minDistance = Infinity;
  const target = searchName.toLowerCase().trim();

  while (folders.hasNext()) {
    const folder = folders.next();
    const folderName = folder.getName().toLowerCase().trim();
    const distance = getLevenshteinDistance(target, folderName);
    if (distance < minDistance) { minDistance = distance; bestMatch = folder; }
  }
  return bestMatch; 
}

/**
 * Calculates Levenshtein Distance
 *
function getLevenshteinDistance(a, b) {
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;
  
  const matrix = [];
  for (let i = 0; i <= b.length; i++) { matrix[i] = [i]; }
  for (let j = 0; j <= a.length; j++) { matrix[0][j] = j; }
  
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
 * Recursively copies a folder and all its files/subfolders
 *
function copyFolderRecursive(sourceFolder, destinationFolder, newFolderName) {
  const newFolder = destinationFolder.createFolder(newFolderName);
  const files = sourceFolder.getFiles();
  while (files.hasNext()) { const file = files.next(); file.makeCopy(file.getName(), newFolder); }
  const subFolders = sourceFolder.getFolders();
  while (subFolders.hasNext()) { const subFolder = subFolders.next(); copyFolderRecursive(subFolder, newFolder, subFolder.getName()); }
  return newFolder;
}

/**
 * Helper to get a specific folder by exact name to avoid duplicates
 *
function getFolderByName(parentFolder, folderName) {
  const folders = parentFolder.getFoldersByName(folderName);
  if (folders.hasNext()) return folders.next();
  return null;
}

/**
 * Safely saves metadata.json.
 *
function saveMetadataJson(targetFolder, dataObject) {
  const fileName = 'metadata.json';
  const existingFiles = targetFolder.getFilesByName(fileName);
  while (existingFiles.hasNext()) { existingFiles.next().setTrashed(true); }
  const jsonString = JSON.stringify(dataObject, null, 2);
  targetFolder.createFile(fileName, jsonString, MimeType.PLAIN_TEXT);
}

/**
 * Main function to query synced bridge data from a Google Sheet and return the formatted summary and extracted values.
 * @param {string} targetBarsNumber - The bars_number to query for.
 * @returns {Object} An object containing the formatted summary string and an array of the extracted values.
 *
function getBridgeDataFromSheet(targetBarsNumber) {
  const ssId = '1vXJVYzlnQfQPDm7jKV5z2LF9vwmKtnbrAOeGxiLVeHI';
  const sheet = SpreadsheetApp.openById(ssId).getSheets()[0]; 
  const data = sheet.getDataRange().getValues();
  
  if (data.length < 2) {
    return { summary: "Error: Sheet is empty or only contains headers.", valuesArray: [] };
  }

  const headers = data[0];
  const barsNumberIndex = headers.indexOf('bars_number');
  
  if (barsNumberIndex === -1) {
    return { summary: "Error: 'bars_number' column not found in the sheet headers.", valuesArray: [] };
  }

  let targetRow = null;
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][barsNumberIndex]) === String(targetBarsNumber)) {
      targetRow = data[i];
      break;
    }
  }

  if (!targetRow) {
    return {
      summary: `Error: Bridge with bars_number ${targetBarsNumber} not found in the sheet.`,
      valuesArray: []
    };
  }

  const p = {};
  headers.forEach((header, index) => {
    p[header] = targetRow[index];
  });

  const toTitleCase = (str) => {
    if (!str) return "";
    return String(str).toLowerCase().split(' ').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
  };

  const bars_number = p.bars_number || "";
  
  let bridge_name = String(p.bridge_name || "").trim();
  bridge_name = bridge_name.replace(/\s+br\.?$/i, ' Bridge');

  const bridge_type = p.bridge_type || "";
  const latitude = p.latitude || "";
  const longitude = p.longitude || "";
  const route = p.route || "";
  const subroute = p.subroute || "";
  const width_out_to_out = p.width_out_to_out || "";
  
  const total_bridge_length = p.total_bridge_length || p.total_bridge_lenghth || ""; 
  const year_built = p.year_built || "";
  const bridge_age = p.bridge_age || "";
  const span_lengths = p.span_lengths || "";
  const bridge_condition_classification = p.bridge_condition_classification || "";

  let location = String(p.location || "");
  location = location.replace(/\bMI\s+(N|S|E|W|NE|NW|SE|SW)\s+OF\b/gi, (match, dir) => {
    const directions = {
      'N': 'north', 'S': 'south', 'E': 'east', 'W': 'west',
      'NE': 'northeast', 'NW': 'northwest', 'SE': 'southeast', 'SW': 'southwest'
    };
    return `miles ${directions[dir.toUpperCase()]} of`;
  });

  const narrative_nbi_6a_feature_intersected = toTitleCase(p.narrative_nbi_6a_feature_intersected);
  const feature_carried = toTitleCase(p.feature_carried);
  
  let county = String(p.county || "");
  if (county.includes('-')) {
    county = county.split('-')[1].split('(')[0].trim();
  }

  const narrative_summary = String(p.narrative_summary || "").replace(/\n/g, ' ');
  let narrative_comments = String(p.narrative_comments || "").replace(/\n/g, ' ');
  narrative_comments = narrative_comments.replace(/ENGINEER's RECOMENDATION/g, "Recomendations include");

  let direction = "";
  let rawDirection = String(p._snbi_routes_direction || "").trim();
  
  if (rawDirection) {
    let firstDirStr = rawDirection;
    
    if (rawDirection.startsWith('[') && rawDirection.endsWith(']')) {
      try {
        const parsedArr = JSON.parse(rawDirection);
        if (parsedArr && parsedArr.length > 0) {
          firstDirStr = parsedArr[0]; 
        }
      } catch (e) {}
    }
    
    if (firstDirStr.includes('-')) {
      direction = firstDirStr.split('-')[1].trim().toLowerCase();
    } else {
      direction = firstDirStr.trim().toLowerCase();
    }
  }

  let place_name = String(p.place_name || "");
  const place_code = p.place_code || "";
  
  if (place_code == 0 || place_name.includes("Unincorporated / Rural")) {
    place_name = "an unicorporated part of rural"; 
  } else if (place_name) {
    place_name = place_name.trim() + ",";
  }

  const bridge_type_lower = String(bridge_type).toLowerCase();

  const summaryTemplate = `Located ${location} in ${place_name} ${county} County, ${bridge_name} carries ${direction} the travelling public on ${feature_carried} over ${narrative_nbi_6a_feature_intersected}. Initially built in ${year_built}, the existing structure is a ${bridge_age} year old ${bridge_type_lower} with a total length of ${total_bridge_length} feet, and an out-to-out width of ${width_out_to_out} feet. ${narrative_summary}. ${narrative_comments}.`;

  const extractedValues = [
    bars_number, narrative_nbi_6a_feature_intersected, bridge_name, county,
    bridge_type, latitude, longitude, location, route, subroute, narrative_summary,
    narrative_comments, width_out_to_out, total_bridge_length, year_built,
    bridge_age, span_lengths, bridge_condition_classification, feature_carried,
    direction, place_code, place_name
  ];

  return { summary: summaryTemplate, valuesArray: extractedValues };
}*/