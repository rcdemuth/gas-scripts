//Extract PDF form values from screening sheet and export them as a JSON file.
async function savePdfFormValuesToJson(pdfID) {

  const pdfFileId = "1EQZ6iIw1Ni49YX_Cj6XSJxZ91EWtz3LQ"; // ID of PDF in Google Drive //pdfID //
  const fileId = "1EQZ6iIw1Ni49YX_Cj6XSJxZ91EWtz3LQ"; //pdfID //
  const mfid = "1mKKScUUZIYLDmzNM6n_gLWjkLgjMgccn"; //main projects folder//
  const file = DriveApp.getFileById(fileId);
  const fblob = file.getBlob();
  //let projectFolder = parents.
  //let path = [];
  //console.log(parents.next.name)
  let parents = file.getParents();
  var folderId = parents.next().getId();//ID the folder screening sheet is in.
  let projectFolder =  DriveApp.getFolderById(folderId)
  pparents = projectFolder.getParents();
  pid = pparents.next().getId();
  var tfoldid = folderId
  var tdfid = folderId
  console.log(pid)
  while (pid != mfid){
    tdfid = tfoldid
    tfoldid = pid
    pid = DriveApp.getFolderById(pid).getParents().next().getId();
    console.log(pid)
  }
  console.log(tdfid)
  folderId = tdfid
  projectFolder =  DriveApp.getFolderById(folderId)
  console.log('Project folder is '+ projectFolder.getName +'\nProject folder id is: '+ folderId)
  console.log(projectFolder.getName)
  console.log(tdfid)
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


  // --- POLYFILLS FOR APPS SCRIPT ---
  globalThis.setTimeout = function(callback, delay) { Utilities.sleep(delay || 0); callback(); };
  globalThis.clearTimeout = function() {};
  const pdfLibUrl = "https://cdnjs.cloudflare.com/ajax/libs/pdf-lib/1.17.1/pdf-lib.min.js";
  eval(UrlFetchApp.fetch(pdfLibUrl).getContentText());

  //try {
  const rawFormData = await extractPdfFields(fblob);
  const mappedFormData = {};
  for (const [key, value] of Object.entries(rawFormData)) {
    mappedFormData[fieldMap[key] || key] = value;
    }
  saveMetadataJson(projectFolder, mappedFormData);
  //}
  //catch (error){}
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
