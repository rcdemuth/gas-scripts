function mainquery(){
//IMPORT TURF JS here



layerUrl = 'https://services.wvgis.wvu.edu/ArcGIS/rest/services/Geoscientific_Information/WV_Geology/MapServer/0/query'
geo = '{"rings":[[[-81.6225279627619,39.05881969641249,0],[-81.62231933841335,39.0584887358365,0],[-81.62147138283161,39.05896078847925,0],[-81.62180787119027,39.05950774493157,0],[-81.62211520130857,39.05978122314013,0],[-81.62261994230637,39.05966277332736,0],[-81.6225279627619,39.05881969641249,0]]],"spatialReference":{"wkid":4326}}'

const mygj = {"type": "Feature", "geometry": { "type": "MultiPolygon", "coordinates": [ [ [ [ -81.622527962761893, 39.058819696412492, 0.0 ], [ -81.622619942306372, 39.059662773327361, 0.0 ], [ -81.622115201308574, 39.059781223140128, 0.0 ], [ -81.621807871190271, 39.059507744931572, 0.0 ], [ -81.621471382831615, 39.058960788479247, 0.0 ], [ -81.622319338413348, 39.058488735836498, 0.0 ], [ -81.622527962761893, 39.058819696412492, 0.0 ] ] ] ] }, "properties": {"name": "ECZ", "Description": ""}, "id": 1}

var jsonString = JSON.stringify(mygj);
var fileName = "map_data.geojson"
var file = DriveApp.createFile(fileName, jsonString, MimeType.PLAIN_TEXT);
  // Option B: Save to a specific folder (uncomment the lines below to use)
  // var folderId = "YOUR_FOLDER_ID_HERE";
  // var folder = DriveApp.getFolderById(folderId);
  // var file = folder.createFile(fileName, jsonString, MimeType.PLAIN_TEXT);

  Logger.log("File saved successfully!");
  Logger.log("File Name: " + file.getName());
  Logger.log("File ID: " + file.getId());
  Logger.log("View URL: " + file.getUrl());
//const myfn = 'mygeojson.json'
//const myblob = Utilities.newBlob(mygj);
//const myblob = Utilities.newBlob(mygj)
//myblob.setName('mygj.geojson')
//myblob.setContentTypeFromExtension()
//const file = DriveApp.createFile(myblob);
//console.log("Saved JSON to Drive: " + file.getUrl());


bb = turf.bbox(mygj)
bbox2x =[]
bbox2x[0] = bb[0] - ((bb[2]-bb[0])/2)
bbox2x[1] = bb[1] - ((bb[3]-bb[1])/2) 
bbox2x[2] =bb[2]+((bb[2]-bb[0])/2) 
bbox2x[3] =bb[3]+((bb[3]-bb[1])/2)   
bb2poly = turf.bboxPolygon(bbox2x)

bbox4x =[]
bbox4x[0] = bb[0] - (bb[2]-bb[0])
bbox4x[1] = bb[1] - (bb[3]-bb[1])
bbox4x[2] =bb[2]+(bb[2]-bb[0]) 
bbox4x[3] =bb[3]+(bb[3]-bb[1]) 
bb4poly = turf.bboxPolygon(bbox4x)
rev_bb4poly = bb4poly.geometry.coordinates[0].toReversed()
testExportMap(bbox4x)
var ebb4p = {rings:[rev_bb4poly],
             spatialReference: { wkid: 4326 }
};

mapdata = queryArcGISByGeometry(layerUrl, JSON.stringify(ebb4p))
console.log(mapdata)

data = queryArcGISByGeometry(layerUrl, geo)
console.log(data)


}

//FUNCTION TO FIND AND CONVERT KMZ/KML to GEOJSON HERE

function testExportMap(abbox) {
  // 1. Point to the /export endpoint of a MapServer
  const exportUrl = "https://services.wvgis.wvu.edu/ArcGIS/rest/services/Geoscientific_Information/WV_Geology/MapServer/export";
  
  // 2. Define your bounding box (e.g., roughly the state of Colorado)
  const myBbox = abbox
  console.log(myBbox)
  // 3. Call the function
  const imageBlob = exportArcGISMap(exportUrl, myBbox, {
    format: "png32",
    size: "1024,768",
    transparent: "true"
  });
  
  // 4. Check if it worked, then save to Google Drive
  if (imageBlob) {
    const file = DriveApp.createFile(imageBlob);
    console.log("Map saved successfully! View it here: " + file.getUrl());
  } else {
    console.log("Map export failed.");
  }
}

//
function exportArcGISMap(url, bbox, options = {}) {
  // Convert bbox object to the comma-separated string ArcGIS expects
  let bboxString;
  if (typeof bbox === 'object') {
    bboxString = `${bbox.xmin},${bbox.ymin},${bbox.xmax},${bbox.ymax}`;
  } else {
    bboxString = bbox;
  }
  
  // Set default payload parameters for a map export
  const payload = {
    f: options.f || "image", // "image" returns raw bytes, "json" returns a URL to the image
    bbox: bboxString,
    size: options.size || "1000,1000", // Width,Height in pixels
    format: options.format || "png", // png8, png24, jpg, pdf, etc.
    transparent: options.transparent !== undefined ? String(options.transparent) : "false",
    dpi:"100",
    bboxSR: options.bboxSR || "4326", // Default spatial reference for the bbox (WGS84)
    imageSR: options.imageSR || "4326" // Default spatial reference for the output image
  };

  // Merge any additional custom options into the payload
  for (const key in options) {
    if (payload[key] === undefined) {
      payload[key] = options[key];
    }
  }

  const fetchOptions = {
    method: "post",
    payload: payload,
    muteHttpExceptions: true
  };

  try {
    const response = UrlFetchApp.fetch(url, fetchOptions);
    const responseCode = response.getResponseCode();

    if (responseCode !== 200) {
      console.log("HTTP Error " + responseCode + ": " + response.getContentText());
      return null;
    }

    // Sometimes ArcGIS returns an error wrapped in JSON even when f=image was requested.
    // We check the headers to see if we got JSON back instead of an image.
    const headers = response.getHeaders();
    const contentType = headers['Content-Type'] || headers['content-type'] || '';

    if (contentType.includes("application/json") || contentType.includes("text/plain")) {
      const json = JSON.parse(response.getContentText());
      if (json.error) {
        console.log("ArcGIS Error: " + json.error.message);
        return null;
      }
      
      // If the user intentionally requested f="json", return the parsed JSON object
      if (payload.f === "json") return json;
    }

    // If successful and f="image", return as a GAS Blob
    const blob = response.getBlob();
    
    // Give the blob a file name based on the requested format
    const extension = payload.format.includes("png") ? "png" : 
                      payload.format.includes("jpg") ? "jpg" : payload.format;
    blob.setName("Exported_Map." + extension);
    
    return blob;

  } catch (error) {
    console.log("Script Execution Error: " + error.toString());
    return null;
  }
}
//queries arcgis rest layer and returns a geojson.
function queryArcGISByGeometry(url, geometry, options = {}) {
  // ArcGIS expects geometry as a string (either a bounding box string or stringified JSON)
  const geometryString = typeof geometry === 'object' ? JSON.stringify(geometry) : geometry;
  
  // Set default payload parameters for a spatial query
  const payload = {
    f: "geojson",
    where: options.where || "1=1", //default to 1 = 1
    geometry: geometryString,
    geometryType: options.geometryType || "esriGeometryPolygon", // Default to envelope/bbox
    spatialRel: options.spatialRel || "esriSpatialRelIntersects",
    outFields: options.outFields || "*",
    returnGeometry: options.returnGeometry || "true",
    inSR: options.inSR || "4326", // Default input spatial reference to WGS84
    outSR: options.outSR || "4326"
  };

  // Merge any additional custom options into the payload
  for (const key in options) {
    if (payload[key] === undefined) {
      payload[key] = options[key];
    }
  }

  const fetchOptions = {
    method: "post",
    payload: payload,
    muteHttpExceptions: true
  };

  try {
    const response = UrlFetchApp.fetch(url, fetchOptions);
    const responseCode = response.getResponseCode();
    const responseText = response.getContentText();

    if (responseCode !== 200) {
      //Logger.log("HTTP Error " + responseCode + ": " + responseText);
      return null;
    }

    const json = JSON.parse(responseText);

    if (json.error) {
      //Logger.log("ArcGIS Error: " + json.error.message);
      return null;
    }

    const fileName = options.fileName || "ArcGIS_Query_Results.json";
    
    // Create a text blob from the raw response and save it
    const blob = Utilities.newBlob(responseText, MimeType.JSON, fileName);
    const file = DriveApp.createFile(blob);
    console.log("Saved JSON to Drive: " + file.getUrl());

    return json;

  } catch (error) {
    console.log("Script Execution Error: " + error.toString());
    //Logger.log("Script Execution Error: " + error.toString());
    return null;
  }
}

function createShapefile(geojson, folderId, fileName) {
  // Standard WGS 1984 Projection String (Since GeoJSON is always WGS84)
  var wgs84Prj = 'GEOGCS["GCS_WGS_1984",DATUM["D_WGS_1984",SPHEROID["WGS_1984",6378137,298.257223563]],PRIMEM["Greenwich",0],UNIT["Degree",0.017453292519943295]]';

  var options = {
    folder: fileName,
    prj: wgs84Prj, // The Mapbox version supports injecting custom projections
    types: {
      point: 'points',
      polygon: 'polygons',
      line: 'lines'
    }
  };

  try {
    // Generate the base64 ZIP string
    var base64Zip = shpwrite.zip(geojson, options);
    
    // Convert to GAS Blob
    var decodedZip = Utilities.base64Decode(base64Zip);
    var zipBlob = Utilities.newBlob(decodedZip, 'application/zip', fileName + '.zip');
    
    // Save to Google Drive
    var folder = DriveApp.getFolderById(folderId);
    var file = folder.createFile(zipBlob);
    
    return file.getUrl();
    
  } catch (e) {
    console.error("@mapbox/shp-write failed: " + e);
    return null;
  }
}

//**
//function loadTurf() {
//  if (typeof turf === 'undefined') {
//    const url = "https://cdn.jsdelivr.net/npm/@turf/turf/turf.min.js";
//    const script = UrlFetchApp.fetch(url).getContentText();
//    eval(script);
//  }
//}
//
function updateTurfLibrary() {
  const scriptId = ScriptApp.getScriptId();
  const token = ScriptApp.getOAuthToken();
  const apiUrl = `https://script.googleapis.com/v1/projects/${scriptId}/content`;

  // 1. Fetch the latest Turf.js code
  const turfUrl = "https://cdn.jsdelivr.net/npm/@turf/turf@6/turf.min.js";
  const newTurfCode = UrlFetchApp.fetch(turfUrl).getContentText();

  // 2. Get the current project files
  const getOptions = {
    method: "get",
    headers: { Authorization: `Bearer ${token}` },
    muteHttpExceptions: true
  };
  
  const getResponse = UrlFetchApp.fetch(apiUrl, getOptions);
  if (getResponse.getResponseCode() !== 200) {
    console.error("Failed to fetch project files: " + getResponse.getContentText());
    return;
  }
  
  const projectContent = JSON.parse(getResponse.getContentText());
  let fileFound = false;

  // 3. Find the Turf file and update its source
  projectContent.files.forEach(file => {
    if (file.name === "Turf") { // The name of your file in the editor (without .gs)
      file.source = newTurfCode;
      fileFound = true;
    }
  });

  if (!fileFound) {
    console.error("Could not find a file named 'Turf'. Please create it first.");
    return;
  }

  // 4. Save the project back to Google Apps Script
  const putOptions = {
    method: "put",
    headers: { Authorization: `Bearer ${token}` },
    contentType: "application/json",
    payload: JSON.stringify(projectContent),
    muteHttpExceptions: true
  };

  const putResponse = UrlFetchApp.fetch(apiUrl, putOptions);
  
  if (putResponse.getResponseCode() === 200) {
    console.log("Turf.js successfully updated to the latest version!");
  } else {
    console.error("Failed to update project: " + putResponse.getContentText());
  }
}

function extractKmlFromKmz(kmzSource) {
  var kmzBlob;

  // Resolve input to a Blob whether given a Drive File ID or a direct Blob
  if (typeof kmzSource === 'string') {
    kmzBlob = DriveApp.getFileById(kmzSource).getBlob();
  } else if (kmzSource && typeof kmzSource.getBytes === 'function') {
    kmzBlob = kmzSource;
  } else {
    throw new Error('Invalid input: Provide a valid Google Drive File ID or KMZ Blob.');
  }

  // Unzip the KMZ archive in memory
  var unzippedBlobs = Utilities.unzip(kmzBlob);

  // Locate the primary .kml file (typically named doc.kml)
  var kmlBlob = unzippedBlobs.filter(function(blob) {
    return blob.getName().toLowerCase().endsWith('.kml');
  })[0];

  if (!kmlBlob) {
    throw new Error('No .kml file found inside the provided KMZ archive.');
  }

  return kmlBlob.getDataAsString();
}
