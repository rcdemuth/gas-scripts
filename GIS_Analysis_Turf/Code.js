function loadTurf() {
  // Fetch the minified library from a CDN
  const url = "https://cdnjs.cloudflare.com/ajax/libs/Turf.js/6.5.0/turf.min.js";
  const scriptText = UrlFetchApp.fetch(url).getContentText();
  
  // Evaluate the script into the Apps Script environment
  eval(scriptText);
  
  // Turf attaches itself to the global context
  return this.turf;
}

function testSpatialAnalysis() {
  const turf = loadTurf();
  
  const point1 = turf.point([-75.343, 39.984]);
  const point2 = turf.point([-75.534, 39.123]);
  
  const distance = turf.distance(point1, point2, {units: 'miles'});
  Logger.log("Distance: " + distance + " miles");
}

function convertBlobWithLibraries(blob) {
  const fileName = blob.getName() ? blob.getName().toLowerCase() : "";
  const contentType = blob.getContentType();
  let kmlText = "";
  
  // 1. Unzip if it's a KMZ
  if (fileName.endsWith('.kmz') || contentType === 'application/vnd.google-earth.kmz') {
    const unzipped = Utilities.unzip(blob);
    for (let i = 0; i < unzipped.length; i++) {
      if (unzipped[i].getName().toLowerCase().endsWith('.kml')) {
        kmlText = unzipped[i].getDataAsString();
        break;
      }
    }
  } else {
    kmlText = blob.getDataAsString();
  }
  
  if (!kmlText) throw new Error("No KML data found.");

  // 2. Parse the raw string into a standard DOM Object (Using the 'xmldom' library)
  const parser = new DOMParser(); 
  const kmlDocument = parser.parseFromString(kmlText, "text/xml");
  
  // 3. Convert the DOM object to GeoJSON (Using the 'togeojson' library)
  const geoJson = toGeoJSON.kml(kmlDocument);
  
  return geoJson;
}