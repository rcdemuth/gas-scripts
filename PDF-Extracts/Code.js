//Function to watch for new screening sheet PDFs

//Extract PDF form values from screening sheet and export them as a JSON file.
async function savePdfFormValuesToJson(pdfID) {
  const pdfFileId = "1hGlbLiDMr5YDHg9GejV8SoAAULQjFJ1r"; // ID of PDF in Google Drive //pdfID //
  const fileId = "1hGlbLiDMr5YDHg9GejV8SoAAULQjFJ1r"; //pdfID //
  const file = DriveApp.getFileById(fileId);
  let parents = file.getParents();
  let path = [];
  console.log(parents.next.name)

  // Trace the folder hierarchy upward
  while (parents.hasNext()) {
    let folder = parents.next();
    path.unshift(folder.getName()); // Add folder to the beginning of the path array
    parents = folder.getParents();  // Move up to the next parent folder level
  }
  let position = path.indexOf('Projects')+3;
  const folpath = path.slice(0,position)
  const fullPath = '/' + path.join('/') + '/' + file.getName();  
  console.log('Full File Path: ' + fullPath);
  const full_folPath = '/' + folpath.join('/')
  console.log("folder path - "+ full_folPath)
  console.log(position);
  x = path.length - folpath.length
  console.log(x)
  let count = 0
  parents = file.getParents();
  var folderId = parents.next().getId();
  console.log('first folder id'+ folderId)
  while (count < x) {
    parents = DriveApp.getFolderById(folderId).getParents()
    folderId = parents.next().getId();
    count++; // Increments count so the loop eventually stops
  }
  pfolder =  DriveApp.getFolderById(folderId)
  console.log('Folder ID'+ folderId)
  console.log(pfolder.getName)

  try {
    // 1. Get the PDF blob from Google Drive
    const pdfBlob = DriveApp.getFileById(pdfFileId).getBlob();
    // 2. Extract the form field values using PDFApp library
    const formValues = await PDFApp.setPDFBlob(pdfBlob).getValuesFromPDFForm();
    // 3. Convert the extracted values into a JSON-formatted string
    const jsonString = JSON.stringify(formValues, null, 2);
    // 4. Create and save the JSON file to Google Drive
    const jsonBlob = Utilities.newBlob(jsonString, 'application/json', 'metadata.json');
    
    let targetFolder = folderId ? DriveApp.getFolderById(folderId) : DriveApp.getRootFolder();
    console.log(targetFolder)
    const savedFile = targetFolder.createFile(jsonBlob);

    console.log(`JSON file saved successfully with ID: ${savedFile.getId()}`);
  } catch (error) {
    console.error("Error processing PDF form:", error);
  }
}