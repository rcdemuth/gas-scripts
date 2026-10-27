function doGet() {
  return HtmlService.createHtmlOutputFromFile('Index')
      .setTitle('Merge PDFs and Image')
      .setSandboxMode(HtmlService.SandboxMode.IFRAME);
}

async function mergeUploadedFiles(pdfBase64Array, imageBase64, imageType) {
  const pdfDoc = await PDFLib.PDFDocument.create();
  
  // 1. Loop through all uploaded PDFs and combine their pages
  for (let i = 0; i < pdfBase64Array.length; i++) {
    const pdfBytes = Utilities.base64Decode(pdfBase64Array[i]);
    const loadedPdf = await PDFLib.PDFDocument.load(pdfBytes);
    const copiedPages = await pdfDoc.copyPages(loadedPdf, loadedPdf.getPageIndices());
    copiedPages.forEach(page => pdfDoc.addPage(page));
  }
  
  // 2. Add the Image (Optional - only runs if an image was provided)
  if (imageBase64 && imageType) {
    const imageBytes = Utilities.base64Decode(imageBase64);
    let embeddedImage;
    if (imageType === 'image/jpeg') {
      embeddedImage = await pdfDoc.embedJpg(imageBytes);
    } else if (imageType === 'image/png') {
      embeddedImage = await pdfDoc.embedPng(imageBytes);
    } else {
      throw new Error("Unsupported image format.");
    }
    
    const imageDims = embeddedImage.scale(1); 
    const imagePage = pdfDoc.addPage([imageDims.width, imageDims.height]);
    imagePage.drawImage(embeddedImage, { x: 0, y: 0, width: imageDims.width, height: imageDims.height });
  }
  
  // 3. Save and output
  const savedBytes = await pdfDoc.save();
  const finalBlob = Utilities.newBlob([...new Int8Array(savedBytes)], MimeType.PDF, "Merged_Output.pdf");
  const finalFile = DriveApp.createFile(finalBlob);
  
  return finalFile.getUrl();
}