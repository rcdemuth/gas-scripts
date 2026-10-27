// ==========================================
// --- GLOBAL CONFIGURATION ---
// ==========================================
const primaryProjectsFolderId = '1mKKScUUZIYLDmzNM6n_gLWjkLgjMgccn';
const templateFolderId = '1mQD1fioetbBXhh-ixbw_22nHqqUYMaRR'; 

// Toggle Sheet IDs by commenting/uncommenting:
const sheetId = '18HPlYoBbzhGc3HmjUtN-njQs2GwsjqqpWabX5N-Y8Wg'; // PRODUCTION
// const sheetId = '1gbeRV4vF2RfRgACJrQlK-FeJ9wh3QgTGlRzSkRwMaAU'; // TESTING
const statusSheetId = '1gR_bFgn02BXs4il3utFUUTZ7zOM7qtjnRW-didoPRfo'; // MASTER STATUS TRACKER

// Toggle Forwarding Recipient by commenting/uncommenting:
const recipient = "hannah.e.kasson@wv.gov"; // PRODUCTION
// const recipient = "robert.c.demuth@wv.gov"; // TESTING
// ==========================================

/**
 * Main function to process incoming emails, extract form fields, 
 * route the data to Drive folders, create Google Tasks, and update Sheets.
 */
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
  let foldersCreatedCount = 0;
  
  // Setup Gmail Label
  let projectLabel = GmailApp.getUserLabelByName("Projects");
  if (!projectLabel) {
    projectLabel = GmailApp.createLabel("Projects");
  }
  
  // --- POLYFILLS FOR APPS SCRIPT ---
  globalThis.setTimeout = function(callback, delay) { Utilities.sleep(delay || 0); callback(); };
  globalThis.clearTimeout = function() {};
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
      if (threadProcessed) break; 
      
      const attachments = message.getAttachments();
      
      for (const attachment of attachments) {
        const fileName = attachment.getName();
        
        if (attachment.getContentType() === 'application/pdf' && fileName.toLowerCase().includes('screening sheet')) {
          identifiedEmailsCount++;
          
          // 1. Extract raw form values natively using pdf-lib
          const rawFormData = await extractPdfFields(attachment);
          const mappedFormData = {};
          for (const [key, value] of Object.entries(rawFormData)) {
            mappedFormData[fieldMap[key] || key] = value;
          }
          
          // 2. Extract specific routing data for Drive
          const rawProjectName = mappedFormData['ProjectName'] || mappedFormData['Text 3'] || '';
          const rawCountyName = mappedFormData['County'] || mappedFormData['Text 4'] || '';
          const dsnPmValue = (mappedFormData['DSN_PM'] || '').toString().toLowerCase();
          
          if (!rawCountyName || !rawProjectName) {
            console.log('Missing County or Project Name in PDF. Skipping Drive routing...');
            continue;
          }

          const safeProjectName = rawProjectName.replace(/[^a-zA-Z0-9]/g, '');
          const countyFolder = findCountyFolderFuzzy(primaryFolder, rawCountyName);
          
          // 3. Check if the project folder ALREADY exists
          let projectFolder = getFolderByName(countyFolder, safeProjectName);
          let isNewProject = false;
          
          if (!projectFolder) {
            const includeCeMaterials = dsnPmValue.includes('carl') || dsnPmValue.includes('demuth');
            projectFolder = createProjectFolderStructure(templateFolder, countyFolder, safeProjectName, includeCeMaterials);
            foldersCreatedCount++; 
            isNewProject = true;
          } else {
            console.log(`Project folder for "${safeProjectName}" already exists. Updating attachments and evaluating summaries...`);
          }
          
          // 4. Save ALL email attachments from the ENTIRE THREAD intelligently
          let attachmentsFolder = null;
          for (const msg of messages) {
            const msgAttachments = msg.getAttachments();
            for (const att of msgAttachments) {
              const attName = att.getName();
              const lowerName = attName.toLowerCase();
              
              const isScreeningSheet = lowerName.includes('screening sheet');
              const isMemo = lowerName.includes('memo');
              const isECZ = lowerName.includes('ecz');
              
              let targetFolderForAtt = projectFolder; // Default to Root
              
              if (!isScreeningSheet && !isMemo && !isECZ) {
                // If it isn't one of the core files, put it in 'Project Attachments'
                if (!attachmentsFolder) {
                  const attFolders = projectFolder.getFoldersByName('Project Attachments');
                  if (attFolders.hasNext()) {
                    attachmentsFolder = attFolders.next();
                  } else {
                    attachmentsFolder = projectFolder.createFolder('Project Attachments');
                  }
                }
                targetFolderForAtt = attachmentsFolder;
              }
              
              const existingFiles = targetFolderForAtt.getFilesByName(attName);
              while (existingFiles.hasNext()) { existingFiles.next().setTrashed(true); }
              targetFolderForAtt.createFile(att);
            }
          }
          
          // 5. Extract Google Drive Links from the ENTIRE THREAD
          const driveRegex = /(?:https?:\/\/)?(?:drive|docs)\.google\.com\/(?:file\/d\/|open\?id=|drive\/(?:u\/\d+\/)?folders\/|document\/d\/|spreadsheets\/d\/|presentation\/d\/)([a-zA-Z0-9-_]+)/gi;
          const driveIds = new Set();
          const driveLinks = new Set();
          
          for (const msg of messages) {
            let match;
            const plainBody = msg.getPlainBody() || "";
            while ((match = driveRegex.exec(plainBody)) !== null) { driveIds.add(match[1]); driveLinks.add(match[0]); }
            const htmlBody = msg.getBody() || "";
            while ((match = driveRegex.exec(htmlBody)) !== null) { driveIds.add(match[1]); driveLinks.add(match[0]); }
          }

          if (driveIds.size > 0) {
            let sharedFolder;
            const sharedFoldersIterator = projectFolder.getFoldersByName('shared');
            if (sharedFoldersIterator.hasNext()) sharedFolder = sharedFoldersIterator.next();
            else sharedFolder = projectFolder.createFolder('shared');

            let linksText = "Extracted Google Drive Links from Email:\n\n" + Array.from(driveLinks).join("\n");
            const linkFiles = sharedFolder.getFilesByName('Extracted_Drive_Links.txt');
            while (linkFiles.hasNext()) { linkFiles.next().setTrashed(true); }
            sharedFolder.createFile('Extracted_Drive_Links.txt', linksText, MimeType.PLAIN_TEXT);

            for (const id of driveIds) {
              try {
                const sourceFolder = DriveApp.getFolderById(id);
                createProjectFolderStructure(sourceFolder, sharedFolder, sourceFolder.getName(), true); 
              } catch (folderErr) {
                try {
                  const sourceFile = DriveApp.getFileById(id);
                  sourceFile.makeCopy(sourceFile.getName(), sharedFolder);
                } catch (fileErr) {}
              }
              try { sharedFolder.createShortcut(id); } catch (e) {}
            }
          }

          // ==========================================
          // --- NEW PROJECT INITIALIZATION ---
          // ==========================================
          if (isNewProject) {
            const rawSender = message.getFrom().toLowerCase();
            const emailMatch = rawSender.match(/<([^>]+)>/);
            const senderEmail = emailMatch ? emailMatch[1].trim() : rawSender.trim();
            
            console.log(`\n--- SPREADSHEET ROUTING CHECK ---`);
            console.log(`Cleaned Email Sender: ${senderEmail} (Original: ${rawSender})`);
            console.log(`DSN_PM Field Value: ${dsnPmValue}`);
            
            if (dsnPmValue.includes('carl') || dsnPmValue.includes('demuth')) {
              console.log("=> Routing criteria MET! Updating Spreadsheets and forwarding...");
              updateSpreadsheetsAndForward(mappedFormData, message, false);
            } else {
              console.log("=> Routing criteria NOT met. Skipping spreadsheet update for this file.");
            }
            console.log(`---------------------------------\n`);

            handleTasksAndCalendar(mappedFormData, rawProjectName);
            saveMetadataJson(projectFolder, mappedFormData);
            saveSummariesJson(projectFolder, "", [], "");
          }
          
          // ==========================================
          // --- EVALUATE SUMMARIES & QUEUEING ---
          // ==========================================
          const summaryStatus = evaluateProjectSummaries(projectFolder, safeProjectName);
          
          if (!summaryStatus.memoFound || !summaryStatus.bridgeFound) {
            addToQueue(projectFolder.getId(), safeProjectName);
          }
          
          threadProcessed = true;
          break; // Stop looking for other attachments in this specific message
        }
      }
      if (threadProcessed) break; 
    }
    
    if (threadProcessed) {
      thread.addLabel(projectLabel);
      thread.markRead(); // Mark ENTIRE thread as read
    }
  }
  
  // --- OUTPUT SUMMARY ---
  console.log("=========================================");
  console.log("         EXECUTION SUMMARY               ");
  console.log("=========================================");
  console.log(`Emails Identified: ${identifiedEmailsCount}`);
  console.log("=========================================");
}

/**
 * Universal function to check if a project is missing its Memo or Bridge summaries,
 * attempt to extract them, update JSONs/Google Doc, and log to the Status sheet.
 */
function evaluateProjectSummaries(projectFolder, projectName) {
  if (!projectFolder) {
    console.error("⚠️ evaluateProjectSummaries was run without a folder! If you are testing, select 'processPendingMemos' or 'processScreeningSheets' from the menu and click Run.");
    return { memoFound: false, bridgeFound: false };
  }

  console.log(`\n--- Evaluating Project: ${projectName} ---`);
  let metaData = {};
  let summariesData = { BridgeSummary: "", BridgeData: [], ProjectSummary: "" };
  let changed = false;
  
  // Load JSONs
  const metaFiles = projectFolder.getFilesByName('metadata.json');
  if (metaFiles.hasNext()) {
    try { metaData = JSON.parse(metaFiles.next().getBlob().getDataAsString()); } catch(e) {}
  }
  const sumFiles = projectFolder.getFilesByName('summaries.json');
  if (sumFiles.hasNext()) {
    try { summariesData = JSON.parse(sumFiles.next().getBlob().getDataAsString()); } catch(e) {}
  }
  
  // 1. Evaluate Bridge Summary
  let bridgeFound = !!summariesData.BridgeSummary && !summariesData.BridgeSummary.includes("Error:");
  if (!bridgeFound) {
    const barsNumber = (metaData['BARS'] || metaData['Text13'] || '').toString().trim();
    if (/^[a-zA-Z0-9]{6}$/.test(barsNumber)) {
      console.log(`Evaluating Bridge Data for BARS: ${barsNumber}`);
      const bData = getBridgeDataFromSheet(barsNumber);
      if (!bData.summary.includes("Error:")) {
        summariesData.BridgeSummary = bData.summary;
        summariesData.BridgeData = bData.valuesArray;
        metaData['BridgeSummary'] = bData.summary;
        metaData['BridgeExtractedValues'] = bData.valuesArray;
        bridgeFound = true;
        changed = true;
      }
    }
  }
  
  // 2. Evaluate Memo Summary
  let memoFound = !!summariesData.ProjectSummary && summariesData.ProjectSummary.trim().length > 5;
  
  if (!memoFound) {
    const memoFiles = findMemoFilesInProject(projectFolder);
    console.log(`Found ${memoFiles.length} file(s) with 'memo' in the name.`);
    
    for (const memoFile of memoFiles) {
      console.log(`Trying Memo file: "${memoFile.getName()}" (MIME: ${memoFile.getMimeType()})...`);
      try {
        const cleanedText = processAndCleanMemo(memoFile);
        
        if (cleanedText && cleanedText.trim().length > 5) {
          summariesData.ProjectSummary = cleanedText;
          metaData['CleanedMemoText'] = cleanedText;
          memoFound = true;
          changed = true;
          console.log(`✅ Success! Extracted text from "${memoFile.getName()}".`);
          break; // Stop looking once we get a successful extraction
        } else {
          console.log(`❌ Extracted text from "${memoFile.getName()}" was empty.`);
        }
      } catch (e) {
        console.log(`⚠️ Failed to process "${memoFile.getName()}": ${e.message}`);
      }
    }
  } else {
     console.log(`Memo text already exists in summaries.json. Skipping extraction.`);
  }
  
  // Make sure the Doc exists
  const docName = `${projectName} - Bridge & Project Summary`;
  const docExists = projectFolder.getFilesByName(docName).hasNext();

  if (changed || !docExists) {
    saveMetadataJson(projectFolder, metaData);
    saveSummariesJson(projectFolder, summariesData.BridgeSummary, summariesData.BridgeData, summariesData.ProjectSummary);
    createProjectGoogleDoc(projectFolder, projectName, summariesData.BridgeSummary, summariesData.ProjectSummary);
  }

  // Log to Status Tracking Spreadsheet
  updateProjectStatusSheet(projectFolder.getId(), metaData, summariesData);
  
  return { memoFound, bridgeFound };
}

// ==========================================
// --- TWO-TIERED PROCESSING QUEUE ---
// ==========================================

function addToQueue(folderId, projectName) {
  const props = PropertiesService.getScriptProperties();
  let queue = JSON.parse(props.getProperty('MEMO_QUEUE') || '[]');
  
  if (!queue.some(item => item.folderId === folderId)) {
    queue.push({
      folderId: folderId,
      projectName: projectName,
      timestamp: new Date().getTime()
    });
    props.setProperty('MEMO_QUEUE', JSON.stringify(queue));
    console.log(`Added "${projectName}" to the missing summaries queue.`);
  }
}

/**
 * TIER 1: Process Pending Items (Frequent Checks e.g., 15 mins)
 */
function processPendingMemos() {
  const props = PropertiesService.getScriptProperties();
  const queueStr = props.getProperty('MEMO_QUEUE');
  if (!queueStr) return; 
  
  let queue = JSON.parse(queueStr);
  let remainingQueue = [];
  let potentialQueue = JSON.parse(props.getProperty('POTENTIAL_MEMO_QUEUE') || '[]');
  
  const now = new Date().getTime();
  const TWENTY_FOUR_HOURS = 24 * 60 * 60 * 1000;

  if (queue.length > 0) console.log(`Tier 1 Queue: ${queue.length} project(s) awaiting completion.`);

  for (let i = 0; i < queue.length; i++) {
    const item = queue[i];
    const isFullyProcessed = attemptToProcessQueueItem(item);

    if (!isFullyProcessed) {
      if (now - item.timestamp > TWENTY_FOUR_HOURS) {
        console.log(`Moving "${item.projectName}" to Tier 2 (exceeded 24 hours).`);
        potentialQueue.push(item);
      } else {
        remainingQueue.push(item);
      }
    } else {
      console.log(`Successfully completed summaries for ${item.projectName}. Removed from queue.`);
    }
  }

  props.setProperty('MEMO_QUEUE', JSON.stringify(remainingQueue));
  props.setProperty('POTENTIAL_MEMO_QUEUE', JSON.stringify(potentialQueue));
}

/**
 * TIER 2: Process Potential Pending Items (Infrequent Checks e.g., Once a day)
 */
function processPotentialPendingMemos() {
  const props = PropertiesService.getScriptProperties();
  const queueStr = props.getProperty('POTENTIAL_MEMO_QUEUE');
  if (!queueStr) return; 
  
  let queue = JSON.parse(queueStr);
  let remainingQueue = [];
  const now = new Date().getTime();
  const FOURTEEN_DAYS = 14 * 24 * 60 * 60 * 1000;

  if (queue.length > 0) console.log(`Tier 2 Queue: ${queue.length} project(s) awaiting long-term completion.`);

  for (let i = 0; i < queue.length; i++) {
    const item = queue[i];
    const isFullyProcessed = attemptToProcessQueueItem(item);

    if (!isFullyProcessed) {
      if (now - item.timestamp > FOURTEEN_DAYS) {
        console.log(`Timeout: ${item.projectName} missing summaries after 14 days. Dropping entirely.`);
      } else {
        remainingQueue.push(item);
      }
    } else {
      console.log(`Successfully completed long-term summaries for ${item.projectName}. Removed from queue.`);
    }
  }

  props.setProperty('POTENTIAL_MEMO_QUEUE', JSON.stringify(remainingQueue));
}

function attemptToProcessQueueItem(item) {
  try {
    const projectFolder = DriveApp.getFolderById(item.folderId);
    const status = evaluateProjectSummaries(projectFolder, item.projectName);
    return (status.memoFound && status.bridgeFound);
  } catch (e) {
    console.log(`Error processing queue item for "${item.projectName}": ${e.message}`);
    return false;
  }
}

// ==========================================
// --- UTILITY AND TEXT PARSING FUNCTIONS ---
// ==========================================

function createProjectFolderStructure(sourceFolder, destinationFolder, newFolderName, includeCeMaterials) {
  const newFolder = destinationFolder.createFolder(newFolderName);
  
  function copyStructure(src, dest) {
    if (includeCeMaterials && src.getName().toLowerCase() === 'ce materials') {
      const files = src.getFiles();
      while (files.hasNext()) {
        const file = files.next();
        file.makeCopy(file.getName(), dest);
      }
    }
    
    const subFolders = src.getFolders();
    while (subFolders.hasNext()) {
      const subFolder = subFolders.next();
      const newSubFolder = dest.createFolder(subFolder.getName());
      copyStructure(subFolder, newSubFolder);
    }
  }
  
  copyStructure(sourceFolder, newFolder);
  return newFolder;
}

function findMemoFilesInProject(projectFolder) {
  let foundFiles = [];

  function searchRecursive(folder) {
    const files = folder.getFiles();
    while (files.hasNext()) {
      const file = files.next();
      const name = file.getName().toLowerCase();
      const mime = file.getMimeType();
      
      if (name.includes('memo')) {
        if (mime === MimeType.MICROSOFT_WORD || name.endsWith('.docx') || name.endsWith('.doc') || mime === MimeType.GOOGLE_DOCS || mime === MimeType.PDF || name.endsWith('.pdf')) {
          foundFiles.push(file);
        }
      }
    }
    const subfolders = folder.getFolders();
    while (subfolders.hasNext()) {
      searchRecursive(subfolders.next());
    }
  }
  
  searchRecursive(projectFolder);
  
  const ONE_DAY_MS = 24 * 60 * 60 * 1000;

  foundFiles.sort((a, b) => {
     const aName = a.getName().toLowerCase();
     const bName = b.getName().toLowerCase();
     
     if (aName.includes('template') && !bName.includes('template')) return 1;
     if (!aName.includes('template') && bName.includes('template')) return -1;
     
     const aIsDoc = (a.getMimeType() === MimeType.MICROSOFT_WORD || aName.endsWith('.docx') || aName.endsWith('.doc') || a.getMimeType() === MimeType.GOOGLE_DOCS);
     const bIsDoc = (b.getMimeType() === MimeType.MICROSOFT_WORD || bName.endsWith('.docx') || bName.endsWith('.doc') || b.getMimeType() === MimeType.GOOGLE_DOCS);
     const aTime = a.getLastUpdated().getTime();
     const bTime = b.getLastUpdated().getTime();

     if (aIsDoc && !bIsDoc) {
       if (bTime - aTime > ONE_DAY_MS) return 1;
       return -1; 
     }
     if (!aIsDoc && bIsDoc) {
       if (aTime - bTime > ONE_DAY_MS) return -1;
       return 1; 
     }
     
     return bTime - aTime; 
  });
  
  return foundFiles; 
}

function processAndCleanMemo(memoFile) {
  const mime = memoFile.getMimeType();
  const isPdf = mime === MimeType.PDF || memoFile.getName().toLowerCase().endsWith('.pdf');
  
  let wasOcred = false;
  let rawText = convertFileToText(memoFile, false);

  if (isPdf) {
    let hasExistingCond = /Existing Conditions?/i.test(rawText);
    let hasAttachments = /Attachments:/i.test(rawText);
    if ((!hasExistingCond || !hasAttachments) && !wasOcred) {
      rawText = convertFileToText(memoFile, true);
      wasOcred = true;
    }
  }

  let cleanedText = rawText;

  const subjectMatch = cleanedText.match(/SUBJECT:/i);
  if (subjectMatch) { cleanedText = cleanedText.substring(subjectMatch.index + subjectMatch[0].length); }

  cleanedText = cleanedText.replace(/E\.E\.O\.\/AFFIRMATIVE ACTION EMPLOYER/gi, '');

  let lines = cleanedText.split('\n');
  for (let i = 0; i < lines.length; i++) {
    if (/^[A-Z]{2,3}:[a-z]{1,3}$/.test(lines[i].trim())) { lines[i] = ''; }
  }
  cleanedText = lines.join('\n');

  if (isPdf) { cleanedText = cleanedText.replace(/(?<!\t| {4,}|\n|\r)[\r\n]+/g, ' '); }

  let previousText = '';
  while (previousText !== cleanedText) {
    previousText = cleanedText;
    cleanedText = cleanedText.replace(/  /g, ' ').replace(/\n\n\n/g, '\n\n');
  }
  cleanedText = cleanedText.split('\n').map(line => line.trim()).join('\n');

  const keywords = [ /Existing Conditions?/i, /Proposed Work/i, /Traffic Maintenance/i, /Right of Way/i, /Ground Disturbance/i, /USFWS Determination/i ];
  let matchCount = 0;
  keywords.forEach(regex => { if (regex.test(cleanedText)) matchCount++; });
  const list_style = (matchCount >= 2); 

  if (list_style) {
    const startMatch = cleanedText.search(/Existing Conditions?/i);
    if (startMatch !== -1) cleanedText = cleanedText.substring(startMatch);

    const endMatch = cleanedText.search(/Attachments:/i);
    if (endMatch !== -1) cleanedText = cleanedText.substring(0, endMatch);

    const allowedBreakPhrases = [ 'Existing Conditions', 'Proposed Work', 'Traffic Maintenance', 'Right of Way', 'Ground Disturbance', 'USFWS Determination' ];
    allowedBreakPhrases.forEach(phrase => {
      const re = new RegExp(`^(${phrase})`, 'gim');
      cleanedText = cleanedText.replace(re, '\n\n$1');
    });

    previousText = '';
    while (previousText !== cleanedText) {
      previousText = cleanedText;
      cleanedText = cleanedText.replace(/\n\n\n/g, '\n\n');
    }
  }
  return cleanedText.trim();
}

function convertFileToText(file, useOcr) {
  try {
    if (file.getMimeType() === MimeType.GOOGLE_DOCS) {
      return DocumentApp.openById(file.getId()).getBody().getText();
    }

    const blob = file.getBlob();
    let contentType = blob.getContentType();
    
    if (file.getName().toLowerCase().endsWith('.pdf')) {
      contentType = 'application/pdf';
    }

    const resource = { title: 'Temp_OCR_Memo_' + new Date().getTime(), mimeType: MimeType.GOOGLE_DOCS };
    let url = 'https://www.googleapis.com/upload/drive/v2/files?uploadType=multipart';
    if (useOcr) url += '&ocr=true&ocrLanguage=en';
    
    const boundary = '-------314159265358979323846';
    const multipartRequestBody = "\r\n--" + boundary + "\r\n" + 
      'Content-Type: application/json\r\n\r\n' + 
      JSON.stringify(resource) + "\r\n--" + boundary + "\r\n" + 
      'Content-Type: ' + contentType + '\r\nContent-Transfer-Encoding: base64\r\n\r\n' + 
      Utilities.base64Encode(blob.getBytes()) + "\r\n--" + boundary + "--";
    
    const options = {
      method: 'post', contentType: 'multipart/mixed; boundary="' + boundary + '"',
      headers: { Authorization: 'Bearer ' + ScriptApp.getOAuthToken() },
      payload: multipartRequestBody, muteHttpExceptions: true
    };
    
    const response = UrlFetchApp.fetch(url, options);
    const result = JSON.parse(response.getContentText());
    
    if (result && result.id) {
      const tempDoc = DocumentApp.openById(result.id);
      const text = tempDoc.getBody().getText();
      DriveApp.getFileById(result.id).setTrashed(true); 
      return text;
    } else {
      console.log(`Drive API Conversion Error: ${response.getContentText()}`);
    }
  } catch (e) {
    console.log(`PDF text conversion error (OCR=${useOcr}): ${e.message}`);
  }
  return '';
}

function createProjectGoogleDoc(projectFolder, projectName, bridgeSummary, cleanedMemoText) {
  const docName = `${projectName} - Bridge & Project Summary`;
  const existingDocs = projectFolder.getFilesByName(docName);
  while (existingDocs.hasNext()) { existingDocs.next().setTrashed(true); }
  
  const doc = DocumentApp.create(docName);
  const docFile = DriveApp.getFileById(doc.getId());
  docFile.moveTo(projectFolder);
  
  const body = doc.getBody();
  body.clear();
  
  if (bridgeSummary) {
    body.appendParagraph("Bridge Description").setHeading(DocumentApp.ParagraphHeading.HEADING1);
    body.appendParagraph(bridgeSummary);
  }
  
  if (cleanedMemoText) {
    if (bridgeSummary) body.appendParagraph(""); 
    body.appendParagraph("Existing Conditions / Memo Details").setHeading(DocumentApp.ParagraphHeading.HEADING1);
    body.appendParagraph(cleanedMemoText);
  }
  
  doc.saveAndClose();
}

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
    if (d.getTime() >= oneMonthFromNow.getTime()) return d;
    return null;
  }

  const rowDate = getValidDate(mappedFormData['ROW_Date']);
  const cnDate = getValidDate(mappedFormData['CN_Date']);
  const engDate = getValidDate(mappedFormData['ENG_Date']);
  const firstValidDate = rowDate || cnDate || engDate;
  
  let taskDate, taskTitle, createCalEvent = false, calDate, calTitle;

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
    if (taskDate.getDay() === 6) taskDate.setDate(taskDate.getDate() + 2);
    else if (taskDate.getDay() === 0) taskDate.setDate(taskDate.getDate() + 1);
    taskTitle = `CE due for ${projectName} - NO DATES`;
  }

  try {
    let taskLists = Tasks.Tasklists.list().getItems() || [];
    let targetList = taskLists.find(list => list.title === 'CEs');
    let taskListId = targetList ? targetList.id : Tasks.Tasklists.insert({ title: 'CEs' }).id;
    const isDuplicateTask = (Tasks.Tasks.list(taskListId).getItems() || []).some(t => t.title === taskTitle);
    if (!isDuplicateTask) Tasks.Tasks.insert({ title: taskTitle, due: taskDate.toISOString() }, taskListId);
  } catch (e) {}

  if (createCalEvent) {
    const calendar = CalendarApp.getDefaultCalendar();
    if (calendar.getEventsForDay(calDate, { search: calTitle }).length === 0) calendar.createAllDayEvent(calTitle, calDate);
  }
}

function updateSpreadsheetsAndForward(mappedFormData, message, isTestingMode) {
  try {
    let ss;
    try { ss = SpreadsheetApp.openById(sheetId); } catch (e) { return; }
    const stateNo = mappedFormData['StateNo'] || '';

    const carlSheet = ss.getSheetByName('Carl');
    if (carlSheet) {
      const dataRange = carlSheet.getDataRange();
      const data = dataRange.getValues();
      const headers = data[0]; 
      if (!data.some((row, index) => index > 0 && String(row[5]).trim() === String(stateNo).trim())) {
        let targetRowIndex = data.length + 1;
        for (let i = 1; i < data.length; i++) {
          if ((data[i][4] ? String(data[i][4]).trim() : '') === '' && (data[i][5] ? String(data[i][5]).trim() : '') === '') { targetRowIndex = i + 1; break; }
        }
        const getColIndex = (headerName) => headers.indexOf(headerName);
        const colCVal = getBestValidationMatch(carlSheet, targetRowIndex, 3, 'NOT SENT'); 
        const colKVal = getBestValidationMatch(carlSheet, targetRowIndex, 11, 'Not Received'); 
        const colMVal = getBestValidationMatch(carlSheet, targetRowIndex, 13, 'Not Received'); 
        
        let finalCountyVal = mappedFormData['County'] || '';
        if (getColIndex('County') !== -1 && finalCountyVal) finalCountyVal = getBestValidationMatch(carlSheet, targetRowIndex, getColIndex('County') + 1, finalCountyVal);
        
        let rawHistoryVal = mappedFormData['HistoryRE'] ? 'RE' : (mappedFormData['HistorySHPO'] ? 'SHPO' : '');
        if (getColIndex('History') !== -1 && rawHistoryVal) rawHistoryVal = getBestValidationMatch(carlSheet, targetRowIndex, getColIndex('History') + 1, rawHistoryVal);
        
        let rawArchVal = mappedFormData['ArchaeologyRE'] ? 'RE' : (mappedFormData['ArchaeologySHPO'] ? 'SHPO' : '');
        if (getColIndex('Archaeology') !== -1 && rawArchVal) rawArchVal = getBestValidationMatch(carlSheet, targetRowIndex, getColIndex('Archaeology') + 1, rawArchVal);

        const updates = [
          { col: 2, val: colCVal }, { col: 3, val: mappedFormData['ROW_Date'] || '' }, { col: 5, val: stateNo }, 
          { col: 10, val: colKVal }, { col: 12, val: colMVal }, { col: getColIndex('Project'), val: mappedFormData['ProjectName'] },
          { col: getColIndex('County'), val: finalCountyVal }, { col: getColIndex('Coordinates'), val: mappedFormData['Coordinates'] },
          { col: getColIndex('History'), val: rawHistoryVal }, { col: getColIndex('Archaeology'), val: rawArchVal }
        ];
        
        updates.forEach(update => { if (update.col !== -1 && update.col !== undefined && update.val !== undefined && update.val !== '') carlSheet.getRange(targetRowIndex, update.col + 1).setValue(update.val); });
      }
    }
    
    const sec7Sheet = ss.getSheetByName('Section 7s');
    if (sec7Sheet) {
      const sec7Data = sec7Sheet.getDataRange().getValues();
      if (!sec7Data.some((row, index) => index > 0 && String(row[4]).trim() === String(stateNo).trim())) {
        let carlRowIndex = -1;
        for (let i = 0; i < sec7Data.length; i++) { if (String(sec7Data[i][0]).trim().toUpperCase() === 'CARL') { carlRowIndex = i + 1; break; } }
        
        if (carlRowIndex !== -1) {
          let insertRowIndex = sec7Data.length + 1;
          for (let i = carlRowIndex; i < sec7Data.length; i++) { if (String(sec7Data[i][3]).trim() === 'BLANK') { insertRowIndex = i + 1; break; } }
          
          sec7Sheet.insertRowBefore(insertRowIndex);
          const sec7ColBVal = getBestValidationMatch(sec7Sheet, insertRowIndex, 2, 'Not Sent');
          const sec7CountyVal = getBestValidationMatch(sec7Sheet, insertRowIndex, 6, mappedFormData['County'] || '');
          
          const sec7Updates = [
            { col: 0, val: false }, { col: 1, val: sec7ColBVal }, { col: 2, val: mappedFormData['ROW_Date'] || '' }, 
            { col: 3, val: mappedFormData['ProjectName'] || '' }, { col: 4, val: stateNo }, { col: 5, val: sec7CountyVal }, 
            { col: 6, val: mappedFormData['Coordinates'] || '' } 
          ];
          sec7Updates.forEach(update => sec7Sheet.getRange(insertRowIndex, update.col + 1).setValue(update.val));
          message.forward(recipient, { htmlBody: "Hannah,<br><br>Just forwarding this along as an FYI, I've added it to the Section 7s tab of the spreadsheet.<br><br>Carl<br><br><i>This email was generated as part of an automated workflow, I apologize if it was sent in error.</i>" });
        }
      }
    }
  } catch (error) {}
}

/**
 * Handles appending or updating project rows in the standalone Status spreadsheet.
 */
function updateProjectStatusSheet(folderId, metaData, summariesData) {
  try {
    const ss = SpreadsheetApp.openById(statusSheetId);
    const sheet = ss.getSheetByName('Status') || ss.getSheets()[0];
    if (!sheet) {
      console.log("Status sheet not found.");
      return;
    }

    const data = sheet.getDataRange().getValues();
    const stateNo = String(metaData['StateNo'] || '').trim();
    
    if (!stateNo) {
      console.log("No StateNo found in metadata. Skipping Status spreadsheet update to prevent duplicates.");
      return;
    }

    // Search for existing stateNo in Column C (Index 2)
    let targetRowIndex = -1;
    for (let i = 1; i < data.length; i++) {
      if (String(data[i][2]).trim() === stateNo) {
        targetRowIndex = i + 1; // 1-based index for getRange
        break;
      }
    }

    // 1-based column mapping per instructions
    const updates = {
      1: metaData['ProjectName'] || '',
      2: metaData['ROW_Date'] || '',
      3: stateNo,
      4: metaData['County'] || '',
      5: metaData['District'] || '', 
      6: metaData['Archaeologist'] || '',
      7: metaData['Historian'] || '',
      8: metaData['DSN_PM'] || '',
      11: metaData['Coordinates'] || '',
      14: JSON.stringify(metaData, null, 2),
      15: JSON.stringify(summariesData, null, 2),
      17: folderId
    };

    if (targetRowIndex !== -1) {
      // If row exists, ONLY update columns that are blank
      const rowData = data[targetRowIndex - 1]; // 0-based array index
      for (const [colNum, newVal] of Object.entries(updates)) {
        const colIndex = parseInt(colNum) - 1;
        const existingVal = String(rowData[colIndex] || '').trim();
        if (existingVal === '' && newVal !== '') {
          sheet.getRange(targetRowIndex, parseInt(colNum)).setValue(newVal);
        }
      }
      console.log(`Updated blank fields in Status sheet for StateNo: ${stateNo}`);
    } else {
      // Append brand new row exactly formatted out to 17 columns
      let newRow = new Array(17).fill('');
      for (const [colNum, newVal] of Object.entries(updates)) {
        newRow[parseInt(colNum) - 1] = newVal;
      }
      sheet.appendRow(newRow);
      targetRowIndex = sheet.getLastRow();
      console.log(`Appended new row to Status sheet for StateNo: ${stateNo}`);
      }
    sendSummariesWebhook(targetRowIndex)
  } catch (e) {
    console.log(`Failed to update Status spreadsheet: ${e.message}`);
  }
}

function getBestValidationMatch(sheet, row, col, targetValue) {
  if (!targetValue) return '';
  const cell = sheet.getRange(row, col);
  const rule = cell.getDataValidation();
  if (!rule) return targetValue;
  
  const criteriaType = rule.getCriteriaType();
  let options = [];
  if (criteriaType === SpreadsheetApp.DataValidationCriteria.VALUE_IN_LIST) options = rule.getCriteriaValues()[0];
  else if (criteriaType === SpreadsheetApp.DataValidationCriteria.VALUE_IN_RANGE) options = rule.getCriteriaValues()[0].getValues().flat().filter(String);
  else return targetValue;
  
  let bestMatch = targetValue, minDistance = Infinity;
  const targetClean = String(targetValue).toLowerCase().trim();
  
  options.forEach(opt => {
    const dist = getLevenshteinDistance(targetClean, String(opt).toLowerCase().trim());
    if (dist < minDistance) { minDistance = dist; bestMatch = opt; }
  });
  return bestMatch;
}

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
    } catch (e) { formData[name] = null; }
  });
  return formData;
}

function findCountyFolderFuzzy(parentFolder, searchName) {
  const folders = parentFolder.getFolders();
  let bestMatch = null, minDistance = Infinity;
  const target = searchName.toLowerCase().trim();
  while (folders.hasNext()) {
    const folder = folders.next();
    const distance = getLevenshteinDistance(target, folder.getName().toLowerCase().trim());
    if (distance < minDistance) { minDistance = distance; bestMatch = folder; }
  }
  return bestMatch; 
}

function getLevenshteinDistance(a, b) {
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;
  const matrix = [];
  for (let i = 0; i <= b.length; i++) matrix[i] = [i];
  for (let j = 0; j <= a.length; j++) matrix[0][j] = j;
  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) matrix[i][j] = matrix[i - 1][j - 1];
      else matrix[i][j] = Math.min(matrix[i - 1][j - 1] + 1, Math.min(matrix[i][j - 1] + 1, matrix[i - 1][j] + 1));
    }
  }
  return matrix[b.length][a.length];
}

function getFolderByName(parentFolder, folderName) {
  const folders = parentFolder.getFoldersByName(folderName);
  if (folders.hasNext()) return folders.next();
  return null;
}

function saveMetadataJson(targetFolder, dataObject) {
  const fileName = 'metadata.json';
  const existingFiles = targetFolder.getFilesByName(fileName);
  while (existingFiles.hasNext()) existingFiles.next().setTrashed(true);
  targetFolder.createFile(fileName, JSON.stringify(dataObject, null, 2), MimeType.PLAIN_TEXT);
}

function saveSummariesJson(targetFolder, bridgeSummary, bridgeValues, memoText) {
  const fileName = 'summaries.json';
  const existingFiles = targetFolder.getFilesByName(fileName);
  while (existingFiles.hasNext()) existingFiles.next().setTrashed(true);
  
  const summaryData = {
    BridgeSummary: bridgeSummary || "",
    BridgeData: bridgeValues || [],
    ProjectSummary: memoText || ""
  };
  
  targetFolder.createFile(fileName, JSON.stringify(summaryData, null, 2), MimeType.PLAIN_TEXT);
}

function getBridgeDataFromSheet(targetBarsNumber) {
  const ssId = '1vXJVYzlnQfQPDm7jKV5z2LF9vwmKtnbrAOeGxiLVeHI';
  const ss = SpreadsheetApp.openById(ssId);
  const sheet = ss.getSheets()[0]; 
  const data = sheet.getDataRange().getValues();
  
  if (data.length < 2) return { summary: "Error: Sheet is empty.", valuesArray: [] };
  const headers = data[0];
  const barsNumberIndex = headers.indexOf('bars_number');
  if (barsNumberIndex === -1) return { summary: "Error: 'bars_number' not found.", valuesArray: [] };

  let targetRow = null;
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][barsNumberIndex]) === String(targetBarsNumber)) { targetRow = data[i]; break; }
  }
  if (!targetRow) return { summary: `Error: Bridge ${targetBarsNumber} not found.`, valuesArray: [] };

  const p = {};
  headers.forEach((header, index) => p[header] = targetRow[index]);

  let abbrMap = [];
  const allSheets = ss.getSheets();
  for (const s of allSheets) {
    if (s.getName().toLowerCase() === 'abbreviations') {
      const sData = s.getDataRange().getValues();
      for (let i = 1; i < sData.length; i++) {
        const abbr = String(sData[i][0]).trim();
        const term = String(sData[i][1]).trim();
        if (abbr && term) {
          abbrMap.push({ abbr: abbr, term: term });
        }
      }
      break; 
    }
  }
  abbrMap.sort((a, b) => b.abbr.length - a.abbr.length);

  function cleanAndExpand(text) {
    if (!text) return "";
    let cleaned = String(text).replace(/_/g, ' ').replace(/\s+/g, ' ').trim();
    for (const {abbr, term} of abbrMap) {
      const safeAbbr = abbr.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
      const regex = new RegExp('(\\s+)(' + safeAbbr + ')$', 'i');
      if (regex.test(cleaned)) {
        cleaned = cleaned.replace(regex, '$1' + term);
        break; 
      }
    }
    return cleaned;
  }

  p.location = cleanAndExpand(p.location);
  p.feature_carried = cleanAndExpand(p.feature_carried);
  p.narrative_nbi_6a_feature_intersected = cleanAndExpand(p.narrative_nbi_6a_feature_intersected);
  p.bridge_name = cleanAndExpand(p.bridge_name);

  const toTitleCase = (str) => {
    if (!str) return "";
    return String(str).toLowerCase().split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
  };

  const bars_number = p.bars_number || "";
  let bridge_name = p.bridge_name.replace(/\s+br\.?$/i, ' Bridge');
  const bridge_type = p.bridge_type || "";
  const latitude = p.latitude || "", longitude = p.longitude || "", route = p.route || "", subroute = p.subroute || "", width_out_to_out = p.width_out_to_out || "";
  const total_bridge_length = p.total_bridge_length || p.total_bridge_lenghth || "", year_built = p.year_built || "", bridge_age = p.bridge_age || "";
  const span_lengths = p.span_lengths || "", bridge_condition_classification = p.bridge_condition_classification || "";
  
  const adt = p.adt || p.average_daily_traffic || p.ADT || "";

  let location = String(p.location || "").replace(/\bMI\s+(N|S|E|W|NE|NW|SE|SW)\s+OF\b/gi, (match, dir) => {
    const directions = { 'N':'north', 'S':'south', 'E':'east', 'W':'west', 'NE':'northeast', 'NW':'northwest', 'SE':'southeast', 'SW':'southwest' };
    return `miles ${directions[dir.toUpperCase()]} of`;
  });

  const feature_intersected = toTitleCase(p.narrative_nbi_6a_feature_intersected);
  const feature_carried = toTitleCase(p.feature_carried);
  
  let county = String(p.county || "");
  if (county.includes('-')) county = county.split('-')[1].split('(')[0].trim();

  const narrative_summary = String(p.narrative_summary || "").replace(/\n/g, ' ');
  let narrative_comments = String(p.narrative_comments || "").replace(/\n/g, ' ').replace(/ENGINEER's RECOMENDATION/g, "Recomendations include");

  let direction = "";
  let rawDirection = String(p._snbi_routes_direction || "").trim();
  if (rawDirection) {
    let firstDirStr = rawDirection;
    if (rawDirection.startsWith('[') && rawDirection.endsWith(']')) {
      try { const parsedArr = JSON.parse(rawDirection); if (parsedArr && parsedArr.length > 0) firstDirStr = parsedArr[0]; } catch (e) {}
    }
    direction = firstDirStr.includes('-') ? firstDirStr.split('-')[1].trim().toLowerCase() : firstDirStr.trim().toLowerCase();
  }

  let place_name = String(p.place_name || "");
  const place_code = p.place_code || "";
  if (place_code == 0 || place_name.includes("Unincorporated / Rural")) place_name = "an unicorporated part of rural"; 
  else if (place_name) place_name = place_name.trim() + ",";

  const bridge_type_lower = String(bridge_type).toLowerCase();
  
  let summaryTemplate = `Located ${location} in ${place_name} ${county} County, ${bridge_name} crosses ${feature_intersected}. Part of ${feature_carried}, ${bridge_name} carries ${direction} traffic, and has an average daily traffic of ${adt}. Initially built in ${year_built}, the existing structure is a ${bridge_age} year old ${bridge_type_lower} with a total length of ${total_bridge_length} feet, and an out-to-out width of ${width_out_to_out} feet. ${narrative_summary}. ${narrative_comments}.`;

  summaryTemplate = summaryTemplate.replace(/ MI /gi, ' miles ');
  summaryTemplate = summaryTemplate.replace(/of\s+(CO\.?\s*RT\.?|C\.?R\.?)\b/gi, 'of County Route');
  summaryTemplate = summaryTemplate.replace(/of\s+(ST\.?\s*RT\.?|S\.?R\.?)\b/gi, 'of State Route');

  summaryTemplate = summaryTemplate.replace(/\s+/g, ' ')
                                   .replace(/\. \./g, '.')
                                   .replace(/\.{2,}/g, '.') 
                                   .trim();

  const extractedValues = [ bars_number, feature_intersected, bridge_name, county, bridge_type, latitude, longitude, location, route, subroute, narrative_summary, narrative_comments, width_out_to_out, total_bridge_length, year_built, bridge_age, span_lengths, bridge_condition_classification, feature_carried, direction, place_code, place_name, adt ];
  
  return { summary: summaryTemplate, valuesArray: extractedValues };
}
/**
 * ONE-TIME USE: Scans only the projects currently in the active queues
 * and pushes their data to the Status Spreadsheet.
 */
function oneTimePopulateFromQueue() {
  const props = PropertiesService.getScriptProperties();
  const activeQueue = JSON.parse(props.getProperty('MEMO_QUEUE') || '[]');
  const potentialQueue = JSON.parse(props.getProperty('POTENTIAL_MEMO_QUEUE') || '[]');
  
  // Combine both queues into one list
  const allActiveItems = activeQueue.concat(potentialQueue);
  
  console.log(`Found ${allActiveItems.length} active projects currently in the queues.`);
  let projectsProcessed = 0;
  
  for (const item of allActiveItems) {
    try {
      const projectFolder = DriveApp.getFolderById(item.folderId);
      
      let metaData = {};
      let summariesData = { BridgeSummary: "", BridgeData: [], ProjectSummary: "" };

      // Load metadata
      const metaFiles = projectFolder.getFilesByName('metadata.json');
      if (metaFiles.hasNext()) {
        try { metaData = JSON.parse(metaFiles.next().getBlob().getDataAsString()); } catch(e) {}
      }

      // Load summaries
      const sumFiles = projectFolder.getFilesByName('summaries.json');
      if (sumFiles.hasNext()) {
        try { summariesData = JSON.parse(sumFiles.next().getBlob().getDataAsString()); } catch(e) {}
      }

      // Push to the Status sheet if a StateNo exists
      if (metaData['StateNo']) {
         console.log(`Pushing active project: ${item.projectName} (StateNo: ${metaData['StateNo']})`);
         updateProjectStatusSheet(projectFolder.getId(), metaData, summariesData);
         projectsProcessed++;
      } else {
         console.log(`Skipped ${item.projectName} (No StateNo found in metadata.json)`);
      }
      
    } catch (e) {
      console.log(`Could not process queue item ${item.projectName}: ${e.message}`);
    }
  }

  console.log(`✅ Finished! Successfully pushed ${projectsProcessed} active projects to the Status sheet.`);
}

function sendSummariesWebhook(rowIndex) {
  const WEBHOOK_URL = 'https://script.google.com/a/macros/wv.gov/s/AKfycbyXVNblZdh5lFjkAtEacGKfX_hvDEIkp6LISc8rVsIX7uPnXs1fvoNZXIlfB1XEiiuM/exec';

  const payload = {
    action: "summaries",
    rowIndex: rowIndex
  };
  const options = {
    method: 'post',
    contentType: 'application/json',
    payload: JSON.stringify(payload),
    followRedirects: true,
    muteHttpExceptions: true
  };
  UrlFetchApp.fetch(WEBHOOK_URL, options);
}

