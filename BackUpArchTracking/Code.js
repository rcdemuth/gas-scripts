/**
 * This backs up Rodney's Google Spreadsheet now that he is retired.  It is triggered every minute.
 * When Rodney's account is terminated this spreadsheet will still exist.  Use a copy of the spreadsheet to preserve the formatting.
 */
function copyAllSheetsToStatic() {
  var destSpreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  var sourceId = "1v4nXrqguoAo0KBTG0g7gakOpRUn5JOOUfv_tDcGsDME"; 
  var sourceSpreadsheet;
  
  // 1. Safely try to open the source spreadsheet
  try {
    sourceSpreadsheet = SpreadsheetApp.openById(sourceId);
  } catch (error) {
    // If access fails, show a warning and stop the script immediately
    SpreadsheetApp.getUi().alert("Access Denied: You do not have permission to open the source spreadsheet, or the ID is incorrect.");
    return; 
  }
  
  // 2. Get an array of ALL sheets in the source spreadsheet
  var sourceSheets = sourceSpreadsheet.getSheets();
  
  // 3. Loop through each sheet one by one
  sourceSheets.forEach(function(sourceSheet) {
    var sheetName = sourceSheet.getName();
    
    var sourceData = sourceSheet.getDataRange().getValues(); 
    
    if (sourceData.length === 0 || sourceData[0].length === 0 || (sourceData.length === 1 && sourceData[0][0] === "")) {
      return; 
    }
    
    var destSheet = destSpreadsheet.getSheetByName(sheetName);
    
    if (!destSheet) {
      destSheet = destSpreadsheet.insertSheet(sheetName);
    } else {
      destSheet.clearContents(); 
    }
    
    var destRange = destSheet.getRange(1, 1, sourceData.length, sourceData[0].length);
    destRange.setValues(sourceData);
  });
}