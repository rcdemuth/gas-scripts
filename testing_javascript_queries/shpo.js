
//Downloads all data for sites in wvCounties.  
function shpotodrive() {
  // 1. Find or create the "geojsons" folder in your Google Drive
  let folderName = "geojsons";
  let folders = DriveApp.getFoldersByName(folderName);
  let targetFolder;
  
  if (folders.hasNext()) {
    targetFolder = folders.next(); // Use existing folder
  } else {
    targetFolder = DriveApp.createFolder(folderName); // Create it if it doesn't exist
  }

  const wvCounties = ["Cabell"]
    Arch_querylinks = [['sites_points','https://mapwv.gov/shpo/viewer/DotNet/proxy.ashx?https://appservices.wvgis.wvu.edu/arcgis/rest/services/SHPO/SHPO/MapServer/0/query?'],
    ['surveys_points','https://mapwv.gov/shpo/viewer/DotNet/proxy.ashx?https://appservices.wvgis.wvu.edu/arcgis/rest/services/SHPO/SHPO/MapServer/1/query?'],
    ['surveys_polys','https://mapwv.gov/shpo/viewer/DotNet/proxy.ashx?https://appservices.wvgis.wvu.edu/arcgis/rest/services/SHPO/SHPO/MapServer/8/query?'],
    ['sites_polys','https://mapwv.gov/shpo/viewer/DotNet/proxy.ashx?https://appservices.wvgis.wvu.edu/arcgis/rest/services/SHPO/SHPO/MapServer/7/query?']]
 
  for (let county of wvCounties) {
    let rawString = `County = '${county}'`;
    
    for (let layer of Arch_querylinks) {
      let requestUrl = layer[1]; 
      let layerName = `${county}_${layer[0]}`; 

      if (layer[0].split('_')[0] === 'sites') {
        // pdfurl = sitebase + PDFNAME
      }
      if (layer[0].split('_')[0] === 'surveys') {
        // pdfurl = surveybase + PDFNAME
      }

      Logger.log(`Downloading ${layerName}...`);

      // 2. Build the POST payload object
      // UrlFetchApp automatically URL-encodes this for POST requests
      let payload = {
        "where": rawString,
        "outFields": "*",
        "outSR": "4326",
        "f": "geojson"
      };

      let options = {
        "method": "post",
        "payload": payload,
        "muteHttpExceptions": true // Prevents script from crashing on a 404/500 error
      };

      try {
        let response = UrlFetchApp.fetch(requestUrl, options);
        
        if (response.getResponseCode() !== 200) {
          Logger.log(`HTTP Error ${response.getResponseCode()} for ${layerName}`);
          continue; 
        }

        // 1. Parse the response into a JavaScript object
        let geojsonData = JSON.parse(response.getContentText());
        let layerType = layer[0].split('_')[0]; // Determines 'sites' or 'surveys'
        
        // 2. Loop through every feature in the GeoJSON
        if (geojsonData.features) {
          geojsonData.features.forEach(feature => {
            let pdfNames = feature.properties.PDF_NAMES;
            
            // 3. Calculate and inject the new array field into the properties
            feature.properties.pdfurl = calculate_pdfurls(pdfNames, layerType);
          });
        }

        // 4. Convert back to string and save
        let fileName = `${layerName}.geojson`;
        let fileContent = JSON.stringify(geojsonData, null, 2);
        targetFolder.createFile(fileName, fileContent, MimeType.PLAIN_TEXT);
        
        Logger.log(`Successfully modified and saved ${fileName}`);
        Utilities.sleep(500); 

      } catch (error) {
        Logger.log(`Failed to process ${layerName}: ${error.toString()}`);
      }
    }
  }
}


function fetchAndSavePDFToDrive(pdfurl) {
  const url = pdfurl 

  try {
    // 1. Fetch the data using Google's UrlFetchApp
    const response = UrlFetchApp.fetch(url);
    
    // 2. Parse the JSON response
    const jsonData = JSON.parse(response.getContentText());

    if (!jsonData.success) {
      throw new Error("API returned an error: " + jsonData.resultMessage);
    }

    // 3. Extract the Base64 string
    const base64String = jsonData.result;

    // 4. Decode the Base64 string into a byte array
    const decodedBytes = Utilities.base64Decode(base64String);

    // 5. Create a Google Apps Script Blob from the bytes
    const pdfBlob = Utilities.newBlob(decodedBytes, 'application/pdf', '17-72-CB.pdf');

    // 6. Save the file to the root of your Google Drive
    const file = DriveApp.createFile(pdfBlob);

    // Log the URL of the newly created file so you can find it easily
    Logger.log('PDF saved successfully! View it here: ' + file.getUrl());

  } catch (error) {
    Logger.log("Failed to fetch or save the PDF: " + error.toString());
  }
}

function calculate_pdfurls(pdfNamesStr, type) {
  // If the field is null, undefined, or empty, return an empty array
  if (!pdfNamesStr) return []; 

  const sitebase = "https://mapwv.gov/gistc_rest/getFile/?pathname=%2F%2Fgistc-websrv1-22%2FWebsites%2Fmapwv%2Fshpo%2Fdocs%2FPDFs%2FArchaeologySites%2F";
  const surveybase = "https://mapwv.gov/gistc_rest/getFile/?pathname=%2F%2Fgistc-websrv1-22%2FWebsites%2Fmapwv%2Fshpo%2Fdocs%2FPDFs%2FArchaeologySurveys%2F";

  // Split by comma and map each name to its full URL
  let namesArray = pdfNamesStr.toString().split(',');
  
  return namesArray.map(name => {
    let cleanName = name.trim(); // Remove leading/trailing spaces
    // encodeURIComponent ensures spaces/special characters in filenames don't break the URL
    let encodedName = encodeURIComponent(cleanName); 
    
    if (type === 'surveys') {
      return surveybase + encodedName;
    } else if (type === 'sites') {
      return sitebase + encodedName;
    }
    return cleanName; // Fallback just in case
  });
}