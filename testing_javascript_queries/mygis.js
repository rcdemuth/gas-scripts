// Example 1: Extracting using a Google Drive File ID
function testWithFileId() {
  var fileId = 'YOUR_KMZ_FILE_ID_HERE';
  var kmlString = extractKmlFromKmz(fileId);
  
  // Pass to your parser
  var geojson = toGeoJSON(kmlString);
  console.log(geojson);
}

// Example 2: Extracting from a file uploaded via Gmail, Web App, or Forms
function testWithBlob(kmzBlob) {
  var kmlString = extractKmlFromKmz(kmzBlob);
  console.log('Extracted KML length:', kmlString.length);
}

/**
 * Main function to import KMZ, parse to GeoJSON, and apply spatial logic
 * @param {GoogleAppsScript.Base.Blob} kmzBlob - The KMZ file blob
 */
function processKmzSpatialLogic(kmzBlob) {
  // 1. Unpack the KMZ (ZIP) and locate the KML
  var unzippedBlobs = Utilities.unzip(kmzBlob);
  var kmlBlob = unzippedBlobs.filter(function(blob) {
    return blob.getName().toLowerCase().endsWith('.kml');
  })[0];
  
  if (!kmlBlob) {
    throw new Error("No KML file found inside the KMZ.");
  }

  // 2. Convert KML to GeoJSON using togeojson (Assumes tj object is loaded in GAS)
  // Note: Depending on your togeojson GAS port, you may need to parse the XML string first.
  var xmlString = kmlBlob.getDataAsString();
  var domParser = new DOMParser(); // Substitute with your GAS DOM parser implementation
  var kmlDom = domParser.parseFromString(xmlString, 'text/xml');
  var geojson = tj.kml(kmlDom);

  // 3. Determine and select the correct feature(s)
  var features = geojson.features;
  var targetRegex = /ecz|env|control|sensi/i;
  var targetExact = ['env sensitive area', 'ecz', 'env control zone', 'environmentally sensitive area', 'environmental sensitive area', 'environmental control zone'];
  
  var selectedFeatures = [];
  
  // Filter features based on naming convention
  features.forEach(function(feat) {
    var name = (feat.properties && feat.properties.name) ? feat.properties.name.toLowerCase() : "";
    if (targetRegex.test(name) || targetExact.indexOf(name) !== -1) {
      selectedFeatures.push(feat);
    }
  });

  // Fallback if no specific named layers are found
  if (selectedFeatures.length === 0) {
    console.warn('Error: Could not locate named ecz file, using first available features.');
    selectedFeatures = features.length > 0 ? [features[0]] : [];
  }

  // 4. Check if there are multiple features and determine geometry types
  var isMultiple = selectedFeatures.length > 1;
  var processedFeatures = [];

  selectedFeatures.forEach(function(feature) {
    var geomType = feature.geometry.type.toLowerCase();
    
    // 5. Convert lines to polygons, or buffer points
    if (geomType.indexOf('line') !== -1) {
      try {
        // Attempt lineToPolygon first
        processedFeatures.push(turf.lineToPolygon(feature));
      } catch (e) {
        // Fallback to polygonize if lineToPolygon fails
        var fc = turf.featureCollection([feature]);
        var polygonized = turf.polygonize(fc);
        if (polygonized.features.length > 0) {
          processedFeatures.push(polygonized.features[0]);
        }
      }
    } else if (geomType.indexOf('point') !== -1) {
      // Buffer points to create polygons (75 meters used as equivalent to Python buffer(75) depending on projection)
      processedFeatures.push(turf.buffer(feature, 75, {units: 'meters'}));
    } else if (geomType.indexOf('polygon') !== -1) {
      processedFeatures.push(feature);
    }
  });

  if (processedFeatures.length === 0) return null;

  // 6. Merge / Union / Hulls Logic
  var finalGeometry;
  
  if (processedFeatures.length === 1) {
    finalGeometry = processedFeatures[0];
  } else {
    // We have multiple features that look correct; merge them into a single polygon
    var collectionToMerge = turf.featureCollection(processedFeatures);
    
    try {
      // Attempt 1: Combine and Union / Dissolve
      // Turf's dissolve acts like a multi-polygon union
      var flattened = turf.flatten(collectionToMerge);
      var dissolved = turf.dissolve(flattened);
      
      // If dissolve results in multiple disjointed polygons but we need ONE bounding area,
      // we assess if it worked cleanly.
      finalGeometry = dissolved.features[0]; 
      
      // Check if it's still returning multiple separate polygons unexpectedly
      if (!finalGeometry || dissolved.features.length > 1) {
        throw new Error("Union/Dissolve resulted in fragmented polygons.");
      }
    } catch (errUnion) {
      console.warn("Union failed, attempting concave hull...", errUnion);
      
      try {
        // Attempt 2: Concave Hull
        // Note: Turf's concave hull requires a FeatureCollection of Points. 
        // We must extract vertices first.
        var explodedPoints = turf.explode(collectionToMerge);
        finalGeometry = turf.concave(explodedPoints, {maxEdge: 2}); // Adjust maxEdge as needed
        
        if (!finalGeometry) throw new Error("Concave hull returned null.");
      } catch (errConcave) {
        console.warn("Concave hull failed, falling back to convex hull...", errConcave);
        
        // Attempt 3: Convex Hull (Safest fallback)
        var explodedPointsForConvex = turf.explode(collectionToMerge);
        finalGeometry = turf.convex(explodedPointsForConvex);
      }
    }
  }

  // 7. Format output coordinates (Truncate to 6 decimal places, mimicking Python rounding)
  finalGeometry = turf.truncate(finalGeometry, {precision: 6, coordinates: 2});

  // Export to JSON string representation
  var finalJsonString = JSON.stringify(finalGeometry);
  
  // Example of saving it back to Google Drive
  // DriveApp.createFile('ecz2.json', finalJsonString, MimeType.PLAIN_TEXT);
  
  return finalGeometry;
}