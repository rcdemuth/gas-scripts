const PERMANENT_TOKEN = "ZZVjMb3dzm65yv7a-kCraSmIeB6NDFEfMo9usahBjW4"
  /** 18 files. Inventory & condition share_bridges_data, condition_history, nbi_history, element_events, element_component_history, shortspan_data, elements_data, element_history, element_due. Routes & geometry: dominant_routes.pmtiles, road_graph, milepoint_routes, bridge_milepoints, route_stitch, nhs_routes, and the three boundaries/*.geojson.
  
  Note his bridges file is at /data/share_bridges_data.json.gz, not bridges_data.json.gz.
  */ 

/**
 * Main function to trigger the sync for both datasets.
 * Set this function up on a Time-Driven Trigger (e.g., Daily).
 */
function syncAllBridgeData() {
  //const bridgesUrl = "https://pub-9f24a1c87e0541cbbc3da5a462a7ab13.r2.dev/bridges_data.json.gz";
  const bridgesUrl = "https://www.spanbasewv.com/data/share_bridges_data.json.gz";
  const shortspanUrl = "https://www.spanbasewv.com/shortspan_data.json.gz";

  //JUST THE GEOJSONS?? I'm not sure if these work.  I don't think they do.
  //https://www.spanbasewv.com/wv_bridges.geojson
  //https://www.spanbasewv.com/wv_shortspans.geojson

  Logger.log("Starting sync for Main Bridges...");
  syncGeoJsonToSheet(bridgesUrl, "Main_Bridges");
  
  Logger.log("Starting sync for Shortspan Bridges...");
  syncGeoJsonToSheet(shortspanUrl, "Shortspan_Bridges");
  
  Logger.log("Sync complete!");
}

/**
 * Helper function that checks file headers, fetches the compressed JSON if changed, 
 * processes the structure, and writes it to the active spreadsheet.
 * 
 * @param {string} url - The URL of the gzipped JSON file.
 * @param {string} sheetName - The name of the tab to write data to.
 */
function syncGeoJsonToSheet(url, sheetName) {
  if (!PERMANENT_TOKEN || PERMANENT_TOKEN === "YOUR_PERMANENT_TOKEN_HERE") {
    Logger.log(`Skipping ${sheetName}: Please add your permanent token at the top of the script.`);
    return;
  }

  const scriptProperties = PropertiesService.getScriptProperties();
  const memoryKey = `last_version_${sheetName}`;
  const storedVersion = scriptProperties.getProperty(memoryKey);

  // 1. Perform a lightweight request to check the file's metadata with the permanent token
  const checkOptions = {
    method: 'get',
    headers: { 
      'Range': 'bytes=0-0',
      'Authorization': 'Bearer ' + PERMANENT_TOKEN
    },
    muteHttpExceptions: true
  };
  const headResponse = UrlFetchApp.fetch(url, checkOptions);
  const responseCode = headResponse.getResponseCode();
  
  if (responseCode === 401 || responseCode === 403) {
    Logger.log(`ERROR: The permanent token was rejected by the server for ${sheetName}. Check if it is typed correctly.`);
    return;
  }

  if (responseCode !== 200 && responseCode !== 206) {
    Logger.log(`ERROR: Could not fetch headers. HTTP ${responseCode} for ${sheetName}.`);
    return;
  }

  const headers = headResponse.getAllHeaders();
  const currentVersion = headers['ETag'] || headers['etag'] || headers['Last-Modified'] || headers['last-modified'];

  if (currentVersion && currentVersion === storedVersion) {
    Logger.log(`✅ No changes detected for ${sheetName}. Skipping download.`);
    return;
  }
  
  Logger.log(`🔄 New data detected for ${sheetName}. Downloading...`);

  // 2. Fetch the full data using the permanent token
  const getOptions = {
    method: 'get',
    headers: { 'Authorization': 'Bearer ' + PERMANENT_TOKEN },
    muteHttpExceptions: true
  };
  const response = UrlFetchApp.fetch(url, getOptions);
  let data = null;
  
  try {
    const text = response.getContentText();
    data = JSON.parse(text);
  } catch (error1) {
    try {
      const blob = response.getBlob();
      blob.setContentType("application/x-gzip"); 
      const unzippedText = Utilities.ungzip(blob).getDataAsString();
      data = JSON.parse(unzippedText);
    } catch (error2) {
      Logger.log(`ERROR on ${sheetName}: Could not parse JSON and could not unzip.`);
      return;
    }
  }
  
  // 3. Detect JSON Structure and pull out the raw records
  let rawRecords = [];
  if (Array.isArray(data)) {
    rawRecords = data;
  } else if (data && Array.isArray(data.features)) {
    rawRecords = data.features.map(f => f.properties || f);
  } else {
    Logger.log(`Unknown JSON structure at ${url}.`);
    return;
  }

  if (rawRecords.length === 0) {
    Logger.log(`No records found at ${url}. Skipping.`);
    return;
  }

  // 4. Process the records with our edge-case handler
  Logger.log("Processing records...");
  const flatRecords = rawRecords.map(record => processRecord(record));
  
  // 5. Dynamically gather all possible headers
  const headerSet = new Set();
  flatRecords.forEach(record => {
    Object.keys(record).forEach(key => headerSet.add(key));
  });
  const sheetHeaders = Array.from(headerSet);
  
  // 6. Build the 2D array for Google Sheets
  const rows = [];
  rows.push(sheetHeaders);
  
  flatRecords.forEach(record => {
    const row = sheetHeaders.map(header => {
      let val = record[header];
      return val === undefined ? "" : val;
    });
    rows.push(row);
  });
  
  // 7. Write data to the CURRENT Spreadsheet
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(sheetName);
  
  if (!sheet) {
    sheet = ss.insertSheet(sheetName);
  } else {
    sheet.clear(); 
  }
  
  const numRows = rows.length;
  const numCols = rows[0].length;
  
  sheet.getRange(1, 1, numRows, numCols).setValues(rows);
  sheet.setFrozenRows(1);
  sheet.getRange(1, 1, 1, numCols).setFontWeight("bold");
  
  // 8. Save the new version string
  if (currentVersion) {
    scriptProperties.setProperty(memoryKey, currentVersion);
  }
  
  Logger.log(`🎉 Successfully synced ${numRows - 1} records to sheet: ${sheetName}`);
}

/**
 * Utility function to force a fresh download if needed.
 */

function forceResetMemory() {
  PropertiesService.getScriptProperties().deleteAllProperties();
  Logger.log("Memory cleared! You can now run syncAllBridgeData to force a full re-download.");
}

/**
 * Processes a single record. 
 * Flattens _snbi_routes one level deep (ignoring array index for headers).
 * If there are multiple entries, groups them as an array inside a single cell.
 * Stringifies all OTHER nested objects/arrays.
 */
function processRecord(record) {
  let result = {};
  for (let key in record) {
    if (!record.hasOwnProperty(key)) continue;
    
    let val = record[key];

    if (key === '_snbi_routes' || key === '_snbi') {
      if (Array.isArray(val) && val.length > 0) {
        let subKeys = new Set();
        val.forEach(item => {
          if (item && typeof item === 'object') {
            Object.keys(item).forEach(k => subKeys.add(k));
          }
        });
        
        subKeys.forEach(subKey => {
          let finalKey = key + '_' + subKey; 
          let extractedValues = val.map(item => {
            return (item && item[subKey] !== undefined && item[subKey] !== null) ? item[subKey] : "";
          });
          
          if (extractedValues.length === 1) {
            result[finalKey] = extractedValues[0];
          } else {
            result[finalKey] = JSON.stringify(extractedValues);
          }
        });
      } else if (val !== null && typeof val === 'object') {
        for (let subKey in val) {
          result[key + '_' + subKey] = val[subKey] === null || val[subKey] === undefined ? "" : val[subKey];
        }
      } else {
        result[key] = val === null || val === undefined ? "" : val;
      }
    } else {
      if (val !== null && typeof val === 'object') {
        result[key] = JSON.stringify(val);
      } else {
        result[key] = val === null || val === undefined ? "" : val;
      }
    }
  }
  return result;
}
