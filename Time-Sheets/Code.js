/**
 * Configuration and Constants
 */
const CONFIG = {
  TEST_MODE: false, 
  TARGET_FOLDER_ID: '1spfwIZsvag4k1Pl6YnaubnCja9ODJPWD',
  TEMPLATE_ID: '1sqIp56zJBWHya7LtgqkaB0Xih4F1PQbg',
  SIGNATURE_IMG_ID: '10Ez0hs-017VlUCK3MP36O0PzPjyjKEZo',
  EMAIL_LABEL: 'Time Sheets',
  WORK_START_HR: 7, // 7:00 AM
  WORK_END_HR: 15.5 // 3:30 PM (15:30)
};

// Adobe Acrobat-safe JavaScript (ES5 compliance so Acrobat doesn't crash)
const AUTO_DATE_SCRIPT = `
  function autoUpdateDates() {
    try {
      var d = util.printd("mm/dd/yyyy", new Date());
      for (var i = 0; i < this.numFields; i++) {
        var fname = this.getNthFieldName(i);
        // indexOf > -1 safely handles nested or suffixed field names
        if (fname && (fname.indexOf("Today") > -1 || fname.indexOf("supdate") > -1)) {
          var f = this.getField(fname);
          if (f) f.value = d;
        }
      }
    } catch(e) {}
  }
  autoUpdateDates();
`;

// Load PDF-lib for PDF manipulation
const loadPdfLib = () => {
  globalThis.setTimeout = function(callback, delay) {
    callback(); 
    return 0;
  };
  globalThis.clearTimeout = function(id) {};

  const url = 'https://cdnjs.cloudflare.com/ajax/libs/pdf-lib/1.17.1/pdf-lib.min.js';
  eval(UrlFetchApp.fetch(url).getContentText());
  return PDFLib;
};

/**
 * Main Function to process emails
 */
async function processTimeSheets() {
  const label = GmailApp.getUserLabelByName(CONFIG.EMAIL_LABEL);
  if (!label) {
    console.error(`Label ${CONFIG.EMAIL_LABEL} not found.`);
    return;
  }

  const threads = label.getThreads(0, CONFIG.TEST_MODE ? 1 : 20); 
  
  for (const thread of threads) {
    if (!thread.isUnread() && !CONFIG.TEST_MODE) continue;

    const messages = thread.getMessages();
    for (let i = messages.length - 1; i >= 0; i--) {
      const message = messages[i];
      if (!message.isUnread() && !CONFIG.TEST_MODE) continue;

      const attachments = message.getAttachments().filter(a => a.getContentType() === 'application/pdf');
      
      if (attachments.length > 0) {
        for (const attachment of attachments) {
          await processAttachment(attachment);
        }
        break; 
      }
    }

    if (!CONFIG.TEST_MODE) thread.markRead();
  }
}

/**
 * Process individual PDF timesheet
 */
async function processAttachment(attachment) {
  const textContent = extractTextFromPdf(attachment);
  
  const payPeriodMatch = textContent.match(/Pay\s*Period[\s\S]*?(\d{1,2}\/\d{1,2}\/\d{2,4}\s*to\s*\d{1,2}\/\d{1,2}\/\d{2,4})/i);
  if (!payPeriodMatch) return console.warn("Could not find Pay Period string in PDF. Skipping.");

  const rawString = payPeriodMatch[1];
  const folderName = rawString.replace(/\//g, '-').replace(/[^a-zA-Z0-9- ]/g, '').trim();

  const parentFolder = DriveApp.getFolderById(CONFIG.TARGET_FOLDER_ID);
  const newFolder = parentFolder.createFolder(folderName);

  const pdfLib = loadPdfLib();
  const { PDFDocument } = pdfLib;

  const masterPdf = await PDFDocument.create();

  // --- Sign the Timesheet ---
  const timesheetDoc = await PDFDocument.load(new Uint8Array(attachment.getBytes()));
  
  // Seed dates on the timesheet before compiling so the Master PDF isn't blank
  try {
    const tsForm = timesheetDoc.getForm();
    const todayStr = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "MM/dd/yyyy");
    tsForm.getFields().forEach(f => {
      if (f.getName().indexOf('Today') > -1 || f.getName().indexOf('supdate') > -1) {
        try { tsForm.getTextField(f.getName()).setText(todayStr); } catch(e) {}
      }
    });
  } catch(e) {}

  const imageBlob = DriveApp.getFileById(CONFIG.SIGNATURE_IMG_ID).getBlob();
  const image = await timesheetDoc.embedPng(new Uint8Array(imageBlob.getBytes())); 
  
  const firstTimesheetPage = timesheetDoc.getPages()[0];
  firstTimesheetPage.drawImage(image, { x: 2.5 * 72, y: 0.7 * 72, width: image.width * 0.3, height: image.height * 0.3 });
  
  const signedTimesheetBytes = await timesheetDoc.save();
  const signedBlob = Utilities.newBlob(signedTimesheetBytes, 'application/pdf', folderName + ".pdf");
  newFolder.createFile(signedBlob); 
  
  const masterTimesheetPages = await masterPdf.copyPages(timesheetDoc, timesheetDoc.getPageIndices());
  masterTimesheetPages.forEach(page => masterPdf.addPage(page));
  // -------------------------------

  const parsedData = parseLeaveEvents(textContent);
  const consolidatedRequests = consolidateLeaveEvents(parsedData.events, parsedData.holpyDates);

  const counters = { ANNPY: 0, SCKPY: 0, FMSPY: 0 };

  for (const request of consolidatedRequests) {
    counters[request.type]++;
    request.counter = counters[request.type];
    
    const slipDoc = await generateLeaveSlip(request, newFolder, pdfLib);
    
    const masterSlipPages = await masterPdf.copyPages(slipDoc, slipDoc.getPageIndices());
    masterSlipPages.forEach(page => masterPdf.addPage(page));
  }

  // Inject JS into Compiled PDF (even though fields are stripped, this ensures absolute coverage)
  masterPdf.addJavaScript('AutoUpdateDates', AUTO_DATE_SCRIPT);

  const masterPdfBytes = await masterPdf.save();
  const masterBlob = Utilities.newBlob(masterPdfBytes, 'application/pdf', `Compiled_${folderName}.pdf`);
  newFolder.createFile(masterBlob);
}

/**
 * Generates the PDF, fills forms, changes field names, and saves
 */
async function generateLeaveSlip(request, folder, pdfLib) {
  const { PDFDocument, PDFName, PDFString } = pdfLib;
  const templateBlob = DriveApp.getFileById(CONFIG.TEMPLATE_ID).getBlob();
  
  const pdfDoc = await PDFDocument.load(new Uint8Array(templateBlob.getBytes()));
  const form = pdfDoc.getForm();
  
  // 1. Seed the date fields so the Compiled Master PDF doesn't render them blank
  const todayStr = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "MM/dd/yyyy");
  const fields = form.getFields();
  fields.forEach(field => {
    const currentName = field.getName();
    if (currentName.indexOf('Today') > -1 || currentName.indexOf('supdate') > -1) {
      try { form.getTextField(currentName).setText(todayStr); } catch (e) {}
    }
  });

  // 2. Inject the Acrobat-safe JavaScript to auto-update individual slips
  pdfDoc.addJavaScript('AutoUpdateDates', AUTO_DATE_SCRIPT);
  
  if (request.type === 'ANNPY') form.getTextField('Hours Annual').setText(request.totalHours.toString());
  if (request.type === 'SCKPY') form.getTextField('Hours Sick').setText(request.totalHours.toString());
  if (request.type === 'FMSPY') form.getTextField('Hours Sick Imm Family').setText(request.totalHours.toString());
  
  form.getTextField('Date').setText(request.fromDate);
  form.getTextField('X AM').setText(request.fromTime);
  form.getTextField('Date_2').setText(request.toDate);
  form.getTextField('X AM_2').setText(request.toTime);
  
  if (request.startIsAM) {
    form.getCheckBox('Check Box1').check();
    form.getCheckBox('Check Box2').uncheck();
  } else {
    form.getCheckBox('Check Box1').uncheck();
    form.getCheckBox('Check Box2').check();
  }

  if (request.endIsAM) {
    form.getCheckBox('Check Box4').check();
    form.getCheckBox('Check Box3').uncheck();
  } else {
    form.getCheckBox('Check Box4').uncheck();
    form.getCheckBox('Check Box3').check();
  }
  
  if ((request.type === 'SCKPY' || request.type === 'FMSPY') && request.isIsolated && request.totalHours <= 8) {
    try {
      const remarksField = form.getTextField('REMARKS');
      remarksField.setText('I had to attend an appointment in Huntington that required taking time off work.');
      remarksField.setFontSize(10);
    } catch (e) { }
  }

  let prefix = '';
  let typeLabel = '';
  if (request.type === 'ANNPY') { prefix = 'A'; typeLabel = 'Annual'; }
  else if (request.type === 'SCKPY') { prefix = 'S'; typeLabel = 'Sick'; }
  else if (request.type === 'FMSPY') { prefix = 'FS'; typeLabel = 'FamilySick'; }
  
  const uniqueSuffix = `_${prefix}${request.counter}`;

  // 3. Safely rename all fields
  fields.forEach(field => {
    const currentName = field.getName();
    field.acroField.dict.set(PDFName.of('T'), PDFString.of(`${currentName}${uniqueSuffix}`));
  });
  
  const pdfBytes = await pdfDoc.save();
  const newBlob = Utilities.newBlob(pdfBytes, 'application/pdf', `DeMuth_${typeLabel}_${request.fileDate}.pdf`);
  folder.createFile(newBlob);

  return pdfDoc; 
}

// ==========================================
// TIMER-DRIVEN RECOMPILER FUNCTION
// ==========================================

async function monitorAndRecompile() {
  const parentFolder = DriveApp.getFolderById(CONFIG.TARGET_FOLDER_ID);
  const folders = parentFolder.getFolders();
  let pdfLibLoaded = false;
  let pdfLib = null;

  while (folders.hasNext()) {
    const folder = folders.next();
    const files = folder.getFilesByType('application/pdf');
    
    let compiledFile = null;
    let timeSheetFile = null;
    let leaveSlips = [];
    
    while (files.hasNext()) {
      const file = files.next();
      const name = file.getName();
      if (name.startsWith('Compiled_')) compiledFile = file;
      else if (name === folder.getName() + '.pdf') timeSheetFile = file;
      else if (name.startsWith('DeMuth_')) leaveSlips.push(file);
    }
    
    if (compiledFile && timeSheetFile) {
      const compiledTime = compiledFile.getLastUpdated().getTime();
      const needsRecompile = leaveSlips.some(slip => slip.getLastUpdated().getTime() > compiledTime);
      
      if (needsRecompile) {
        console.log(`Updates detected in folder: ${folder.getName()}. Recompiling...`);
        
        if (!pdfLibLoaded) {
          pdfLib = loadPdfLib();
          pdfLibLoaded = true;
        }

        const { PDFDocument } = pdfLib;
        const masterPdf = await PDFDocument.create();
        
        masterPdf.addJavaScript('AutoUpdateDates', AUTO_DATE_SCRIPT);
        
        const tsDoc = await PDFDocument.load(new Uint8Array(timeSheetFile.getBlob().getBytes()));
        const tsPages = await masterPdf.copyPages(tsDoc, tsDoc.getPageIndices());
        tsPages.forEach(p => masterPdf.addPage(p));
        
        leaveSlips.sort((a, b) => a.getName().localeCompare(b.getName()));
        for (const slip of leaveSlips) {
          const slipDoc = await PDFDocument.load(new Uint8Array(slip.getBlob().getBytes()));
          const slipPages = await masterPdf.copyPages(slipDoc, slipDoc.getPageIndices());
          slipPages.forEach(p => masterPdf.addPage(p));
        }
        
        const masterBytes = await masterPdf.save();
        const newBlob = Utilities.newBlob(masterBytes, 'application/pdf', compiledFile.getName());
        
        compiledFile.setTrashed(true);
        folder.createFile(newBlob);
        
        console.log(`Successfully recompiled ${compiledFile.getName()}`);
      }
    }
  }
}

// ==========================================
// UTILITY FUNCTIONS
// ==========================================

function extractTextFromPdf(blob) {
  const resource = { name: blob.getName(), mimeType: 'application/vnd.google-apps.document' };
  const tempDoc = Drive.Files.create(resource, blob);
  const doc = DocumentApp.openById(tempDoc.id);
  const text = doc.getBody().getText();
  Drive.Files.remove(tempDoc.id);
  return text;
}

function parseLeaveEvents(text) {
  const events = [];
  const holpyDates = new Set();
  
  // Negative lookahead regex prevents column scrambling
  const regex = /(\d{1,2}\/\d{1,2}\/\d{2,4})(?:(?!\d{1,2}\/\d{1,2}\/\d{2,4})[\s\S])*?(ANNPY|SCKPY|FMSPY|HOLPY)(?:(?!\d{1,2}\/\d{1,2}\/\d{2,4})[\s\S])*?(\d{2}:\d{2})/g;
  
  let match;
  while ((match = regex.exec(text)) !== null) {
    const dateObj = new Date(match[1]);
    const type = match[2];
    const hours = parseInt(match[3].split(':')[0], 10);
    
    if (type === 'HOLPY') holpyDates.add(dateObj.toDateString());
    else events.push({ date: dateObj, type: type, hours: hours });
  }
  events.sort((a, b) => a.date - b.date);
  return { events, holpyDates };
}

function consolidateLeaveEvents(events, holpyDates) {
  if (events.length === 0) return [];
  let requests = [];
  let currentGroup = [events[0]];

  for (let i = 1; i < events.length; i++) {
    const curr = events[i];
    const prev = events[i - 1];
    if (curr.type === prev.type && isNextWorkday(prev.date, curr.date)) currentGroup.push(curr);
    else { requests.push(currentGroup); currentGroup = [curr]; }
  }
  if (currentGroup.length > 0) requests.push(currentGroup);
  return requests.map(group => calculateLeaveTimes(group, holpyDates));
}

function calculateLeaveTimes(group, holpyDates) {
  const firstEvent = group[0];
  const lastEvent = group[group.length - 1];
  const type = firstEvent.type;
  let totalHours = group.reduce((sum, e) => sum + e.hours, 0);
  
  const isIsolated = group.length === 1;
  const hasHolpy = holpyDates.has(firstEvent.date.toDateString());
  
  let startHour = CONFIG.WORK_START_HR;
  if (firstEvent.hours < 8) {
    startHour = (isIsolated && hasHolpy) ? CONFIG.WORK_START_HR : CONFIG.WORK_END_HR - firstEvent.hours;
  }
  
  let endHour = 7; 
  let endDate = new Date(lastEvent.date);
  
  if (lastEvent.hours < 8 && group.length > 1) {
    endHour = CONFIG.WORK_START_HR + lastEvent.hours;
  } else if (lastEvent.hours < 8 && group.length === 1) {
    endHour = hasHolpy ? CONFIG.WORK_START_HR + lastEvent.hours : CONFIG.WORK_END_HR;
  } else {
    endDate = getNextWorkday(endDate);
  }

  const startFormatted = formatTime(startHour);
  const endFormatted = formatTime(endHour);

  return {
    type: type, totalHours: totalHours, isIsolated: isIsolated,
    fromDate: formatDate(firstEvent.date), fromTime: startFormatted.time, startIsAM: startFormatted.isAM,
    toDate: formatDate(endDate), toTime: endFormatted.time, endIsAM: endFormatted.isAM,
    fileDate: Utilities.formatDate(firstEvent.date, Session.getScriptTimeZone(), "MMddyy")
  };
}

function isNextWorkday(dateA, dateB) { 
  const next = getNextWorkday(dateA);
  return next.getFullYear() === dateB.getFullYear() &&
         next.getMonth() === dateB.getMonth() &&
         next.getDate() === dateB.getDate();
}

function getNextWorkday(date) {
  const next = new Date(date);
  next.setDate(next.getDate() + 1);
  if (next.getDay() === 6) next.setDate(next.getDate() + 2);
  if (next.getDay() === 0) next.setDate(next.getDate() + 1);
  return next;
}

function formatDate(date) { return Utilities.formatDate(date, Session.getScriptTimeZone(), "MM/dd/yyyy"); }

function formatTime(decimalHour) {
  let hrs = Math.floor(decimalHour);
  let mins = Math.round((decimalHour - hrs) * 60);
  let isAM = hrs < 12; 
  hrs = hrs % 12; hrs = hrs ? hrs : 12; 
  let minStr = mins < 10 ? '0' + mins : mins;
  return { time: `${hrs}:${minStr}`, isAM: isAM };
}