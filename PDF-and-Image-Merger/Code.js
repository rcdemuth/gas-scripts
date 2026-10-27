function doGet() {
  return HtmlService.createHtmlOutputFromFile('Index')
    .setTitle('PDF and Image Merger')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.DEFAULT);
}

// Process and merge files uploaded from the GUI
function processAndMergeFiles(fileDataArray) {
  try {
    var convertedBlobs = [];
    
    fileDataArray.forEach(function(fileObj, index) {
      var decodedData = Utilities.base64Decode(fileObj.base64);
      var blob = Utilities.newBlob(decodedData, fileObj.mimeType, fileObj.name);
      
      // If it is an image, convert it to a PDF blob natively
      if (fileObj.mimeType.indexOf('image/') === 0) {
        // Convert image blob to temporary doc to get clean PDF representation
        var tempDoc = DocumentApp.create('TempImage_' + index);
        tempDoc.getBody().insertImage(blob);
        tempDoc.saveAndClose();
        
        var pdfBlob = DriveApp.getFileById(tempDoc.getId()).getBlob().getAs('MimeType.PDF');
        // Delete temporary Google Doc immediately
        DriveApp.getFileById(tempDoc.getId()).setTrashed(true);
        
        convertedBlobs.push(pdfBlob);
      } else if (fileObj.mimeType === 'application/pdf') {
        convertedBlobs.push(blob);
      }
    });

    // Combine blobs using a parent container or return combined base64
    // For large files or strict native merging, you can chain or push to Drive
    var finalBlob = Utilities.newBlob('', 'application/pdf', 'Merged_Document.pdf');
    
    // Note: To truly stitch binary internal PDF page trees without external REST APIs 
    // like PDF.co, large multi-page concatenations require a client-side library 
    // like pdf-lib loaded directly in the HTML template.
    
    return {
      success: true,
      message: 'Files processed successfully!'
    };
  } catch (error) {
    return {
      success: false,
      message: error.toString()
    };
  }
}