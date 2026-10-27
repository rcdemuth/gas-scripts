function updateRETemplate() {
  // Your Google Drive Folder IDs
  const TEMPLATE_FOLDER_ID = '11M3QyH5NMJyH4_01lSK-hMQoRRqZa9Po';
  const PROJECTS_FOLDER_ID = '1mKKScUUZIYLDmzNM6n_gLWjkLgjMgccn';
  
  const TARGET_FILENAME = 'RE_Template.aptx';
  
  const templateFolder = DriveApp.getFolderById(TEMPLATE_FOLDER_ID);
  const projectsFolder = DriveApp.getFolderById(PROJECTS_FOLDER_ID);
  
  // 1. Get the existing RE_Template.aptx file and its last modified date
  const existingFiles = projectsFolder.getFilesByName(TARGET_FILENAME);
  let currentTargetFile = null;
  let currentTargetDate = new Date(0); // Default to epoch start if no existing file
  
  if (existingFiles.hasNext()) {
    currentTargetFile = existingFiles.next();
    currentTargetDate = currentTargetFile.getLastUpdated();
    Logger.log('Current ' + TARGET_FILENAME + ' last updated: ' + currentTargetDate);
  } else {
    Logger.log('No existing ' + TARGET_FILENAME + ' found in Projects. A new one will be created.');
  }
  
  // 2. Find the NEWEST matching RE_temp file in ProjectTemplates
  const files = templateFolder.getFiles();
  let newestTempFile = null;
  let newestTempDate = new Date(0);
  
  while (files.hasNext()) {
    const file = files.next();
    const name = file.getName();
    
    // Check if filename contains 'RE_temp' (case-insensitive) and ends with '.aptx'
    if (name.toLowerCase().includes('re_temp') && name.toLowerCase().endsWith('.aptx')) {
      const fileUpdateDate = file.getLastUpdated();
      
      // Keep track of the most recently updated temp file
      if (fileUpdateDate > newestTempDate) {
        newestTempDate = fileUpdateDate;
        newestTempFile = file;
      }
    }
  }
  
  // Exit if no matching temporary file exists
  if (!newestTempFile) {
    Logger.log('No RE_temp files found in ProjectTemplates.');
    return;
  }
  
  Logger.log('Newest template candidate: ' + newestTempFile.getName() + ' (Updated: ' + newestTempDate + ')');
  
  // 3. Compare dates: Only overwrite if the candidate template is NEWER than the target file
  if (currentTargetFile && newestTempDate <= currentTargetDate) {
    Logger.log('Skipping copy: The template file is older than or equal to the existing ' + TARGET_FILENAME);
    return;
  }
  
  // 4. Trash the old target file in Projects (if one existed)
  if (currentTargetFile) {
    currentTargetFile.setTrashed(true);
    Logger.log('Trashed older ' + TARGET_FILENAME);
  }
  
  // 5. Copy the newest temp file to Projects and rename it
  const newFile = newestTempFile.makeCopy(TARGET_FILENAME, projectsFolder);
  Logger.log('Successfully copied newer file as ' + TARGET_FILENAME + ' into Projects.');
  
  // 6. Verification check
  const verifyFiles = projectsFolder.getFilesByName(TARGET_FILENAME);
  if (verifyFiles.hasNext()) {
    Logger.log('Verification successful: Updated ' + TARGET_FILENAME + ' is present in Projects.');
  } else {
    Logger.log('Verification failed: File was not created in destination.');
  }
}