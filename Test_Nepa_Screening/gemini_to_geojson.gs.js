/**
 * Advanced Native GAS KML to GeoJSON Parser
 * Built to handle malformed GIS/CAD exports and Bentley OpenRoads (ORD) quirks.
 * 
 * @param {string} kmlString - The raw XML/KML string
 * @returns {Object} A GeoJSON FeatureCollection
 */
function geminiToGeoJSON(kmlString) {
  var doc = XmlService.parse(kmlString);
  var root = doc.getRootElement();
  
  var geojson = {
    type: "FeatureCollection",
    features: []
  };

  var placemarks = _getElementsByTagName(root, 'Placemark');

  for (var i = 0; i < placemarks.length; i++) {
    var feature = parsePlacemark(placemarks[i]);
    if (feature) {
      geojson.features.push(feature);
    }
  }

  return geojson;
}

function parsePlacemark(node) {
  var feature = {
    type: "Feature",
    properties: parseProperties(node),
    geometry: parseGeometry(node)
  };

  if (!feature.geometry) return null;
  return feature;
}

function parseGeometry(node) {
  var children = node.getChildren();
  for (var i = 0; i < children.length; i++) {
    var child = children[i];
    var nodeName = child.getName();
    
    switch (nodeName) {
      case 'Point':
        return parsePoint(child);
      case 'LineString':
        return parseLineString(child);
      case 'Polygon':
        return parsePolygon(child);
      case 'LinearRing': // Edge Case: Standalone CAD Rings
        return parseStandaloneRing(child);
      case 'MultiGeometry':
        return parseMultiGeometry(child);
    }
  }
  return null;
}

function parsePoint(node) {
  var coords = _getCoordinates(_child(node, 'coordinates'));
  if (!coords || coords.length === 0) return null;
  return { type: "Point", coordinates: coords[0] };
}

function parseLineString(node) {
  var coords = _getCoordinates(_child(node, 'coordinates'));
  if (!coords || coords.length < 2) return null;
  return { type: "LineString", coordinates: coords };
}

/** Promotes standalone LinearRings to Polygons */
function parseStandaloneRing(node) {
  var coords = _getCoordinates(_child(node, 'coordinates'));
  if (!coords || coords.length < 3) return null;
  return { type: "Polygon", coordinates: [_closeRing(coords)] };
}

function parsePolygon(node) {
  var coordinates = [];
  
  // Standard KML Outer Boundary
  var outer = _child(node, 'outerBoundaryIs');
  if (outer) {
    var outerRing = _child(outer, 'LinearRing');
    if (outerRing) {
      var outerCoords = _getCoordinates(_child(outerRing, 'coordinates'));
      if (outerCoords && outerCoords.length > 0) coordinates.push(_closeRing(outerCoords));
    }
  } else {
    // Malformed CAD Polygon (LinearRing directly under Polygon)
    var directRings = _children(node, 'LinearRing');
    if (directRings.length > 0) {
      var directCoords = _getCoordinates(_child(directRings[0], 'coordinates'));
      if (directCoords && directCoords.length > 0) coordinates.push(_closeRing(directCoords));
    }
  }

  // Inner Boundaries (Holes)
  var inners = _children(node, 'innerBoundaryIs');
  for (var i = 0; i < inners.length; i++) {
    var innerRing = _child(inners[i], 'LinearRing');
    if (innerRing) {
      var innerCoords = _getCoordinates(_child(innerRing, 'coordinates'));
      if (innerCoords && innerCoords.length > 0) coordinates.push(_closeRing(innerCoords));
    }
  }

  if (coordinates.length === 0) return null;
  return { type: "Polygon", coordinates: coordinates };
}

function parseMultiGeometry(node) {
  var geometries = [];
  var children = node.getChildren();
  
  for (var i = 0; i < children.length; i++) {
    var geom = null;
    var nodeName = children[i].getName();
    
    if (nodeName === 'Point') geom = parsePoint(children[i]);
    else if (nodeName === 'LineString') geom = parseLineString(children[i]);
    else if (nodeName === 'Polygon') geom = parsePolygon(children[i]);
    else if (nodeName === 'LinearRing') geom = parseStandaloneRing(children[i]);
    else if (nodeName === 'MultiGeometry') geom = parseMultiGeometry(children[i]);
    
    if (geom) geometries.push(geom);
  }

  if (geometries.length === 0) return null;

  // Flatten nested MultiGeometries
  var allPoints = true, allLines = true, allPolys = true;
  for (var j = 0; j < geometries.length; j++) {
    if (geometries[j].type !== 'Point') allPoints = false;
    if (geometries[j].type !== 'LineString') allLines = false;
    if (geometries[j].type !== 'Polygon') allPolys = false;
  }

  if (allPoints) return { type: 'MultiPoint', coordinates: geometries.map(function(g) { return g.coordinates; }) };
  if (allLines) return { type: 'MultiLineString', coordinates: geometries.map(function(g) { return g.coordinates; }) };
  if (allPolys) return { type: 'MultiPolygon', coordinates: geometries.map(function(g) { return g.coordinates; }) };

  return { type: 'GeometryCollection', geometries: geometries };
}

/**
 * Extracts OpenRoads HTML tables, Folder/Level mappings, and ExtendedData
 */
function parseProperties(node) {
  var props = {};
  
  // 1. Standard KML properties
  var standardProps = ['name', 'visibility', 'styleUrl', 'extrude', 'tessellate', 'altitudeMode'];
  for (var i = 0; i < standardProps.length; i++) {
    var val = _text(_child(node, standardProps[i]));
    if (val) props[standardProps[i]] = val;
  }

  // 2. OpenRoads Quirk: Scrape the parent <Folder> to get the DGN Level name
  var parent = node.getParentElement();
  if (parent && parent.getName() === 'Folder') {
    var folderName = _text(_child(parent, 'name'));
    if (folderName) props['Layer'] = folderName;
  }

  // 3. OpenRoads Quirk: Extract DGN attributes from HTML table inside <description>
  var desc = _text(_child(node, 'description'));
  if (desc) {
    props['description'] = desc; // Keep raw HTML just in case
    var tableRegex = /<tr>\s*<td>(.*?)<\/td>\s*<td>(.*?)<\/td>\s*<\/tr>/ig;
    var match;
    while ((match = tableRegex.exec(desc)) !== null) {
      var key = match[1].replace(/(<([^>]+)>)/gi, "").trim();
      var val = match[2].replace(/(<([^>]+)>)/gi, "").trim();
      if (key && val && !props[key]) {
        props[key] = val;
      }
    }
  }

  // 4. Standard ExtendedData and CAD <SchemaData>
  var extendedData = _child(node, 'ExtendedData');
  if (extendedData) {
    var dataNodes = _children(extendedData, 'Data');
    for (var d = 0; d < dataNodes.length; d++) {
      var nameAttr = dataNodes[d].getAttribute('name');
      var valueNode = _child(dataNodes[d], 'value');
      if (nameAttr && valueNode) props[nameAttr.getValue()] = _text(valueNode);
    }
    
    var simpleDataNodes = _children(extendedData, 'SimpleData');
    for (var s = 0; s < simpleDataNodes.length; s++) {
      var sNameAttr = simpleDataNodes[s].getAttribute('name');
      if (sNameAttr) props[sNameAttr.getValue()] = _text(simpleDataNodes[s]);
    }

    var schemaDataNodes = _children(extendedData, 'SchemaData');
    for (var sd = 0; sd < schemaDataNodes.length; sd++) {
      var sdChildren = _children(schemaDataNodes[sd], 'SimpleData');
      for (var sdc = 0; sdc < sdChildren.length; sdc++) {
        var sdcNameAttr = sdChildren[sdc].getAttribute('name');
        if (sdcNameAttr) props[sdcNameAttr.getValue()] = _text(sdChildren[sdc]);
      }
    }
  }

  return props;
}

/* =========================================
   ROBUST HELPER FUNCTIONS
   ========================================= */

/** 
 * Strips ghost coordinates, rounds to 6 decimals, and handles Z-values
 */
function _getCoordinates(node) {
  var text = _text(node);
  if (!text) return [];
  
  var strParts = text.replace(/\s+/g, ' ').trim().split(' ');
  var coords = [];
  
  for (var i = 0; i < strParts.length; i++) {
    var pt = strParts[i].split(',');
    if (pt.length >= 2) {
      var lon = parseFloat(pt[0]);
      var lat = parseFloat(pt[1]);
      
      if (!isNaN(lon) && !isNaN(lat)) {
        // Round to 6 decimal places (approx ~11cm precision)
        lon = Math.round(lon * 1000000) / 1000000;
        lat = Math.round(lat * 1000000) / 1000000;
        
        var coord = [lon, lat];
        
        // Handle Z / Elevation
        if (pt.length >= 3) {
          var alt = parseFloat(pt[2]);
          if (!isNaN(alt)) coord.push(Math.round(alt * 1000) / 1000); 
        }
        
        coords.push(coord);
      }
    }
  }
  return coords;
}

/** Force-Close Polygon Rings for Turf.js compatibility */
function _closeRing(coords) {
  if (!coords || coords.length === 0) return coords;
  
  var first = coords[0];
  var last = coords[coords.length - 1];
  
  if (first[0] !== last[0] || first[1] !== last[1]) {
    var newPoint = [first[0], first[1]];
    if (first.length > 2) newPoint.push(first[2]); 
    coords.push(newPoint);
  }
  
  return coords;
}

/** Recursive namespace-agnostic tag search */
function _getElementsByTagName(node, tagName, results) {
  results = results || [];
  if (node.getName && node.getName() === tagName) results.push(node);
  if (node.getChildren) {
    var children = node.getChildren();
    for (var i = 0; i < children.length; i++) {
      _getElementsByTagName(children[i], tagName, results);
    }
  }
  return results;
}

function _children(node, tagName) {
  var res = [];
  if (!node || !node.getChildren) return res;
  var kids = node.getChildren();
  for (var i = 0; i < kids.length; i++) {
    if (kids[i].getName() === tagName) res.push(kids[i]);
  }
  return res;
}

function _child(node, tagName) {
  var kids = _children(node, tagName);
  return kids.length > 0 ? kids[0] : null;
}

function _text(node) {
  return node ? node.getText().trim() : null;
}