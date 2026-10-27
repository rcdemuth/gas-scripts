// ===== Source: Kml.gs =====
var KML_NAMESPACE_URI = "http://www.opengis.net/kml/2.2";
var KML_GX_NAMESPACE_URI = "http://www.google.com/kml/ext/2.2";
var NEPA_MAX_KMZ_UNZIPPED_BYTES = 40 * 1024 * 1024;
var KML_SUPPORTED_NAMESPACE_URIS = [
  KML_NAMESPACE_URI,
  "http://earth.google.com/kml/2.0",
  "http://earth.google.com/kml/2.1",
  ""
];

function extractKmlFromKmz(kmzSource) {
  var kmzBlob;
  var fileName;
  if (typeof kmzSource === "string") {
    var driveFile = DriveApp.getFileById(kmzSource);
    kmzBlob = driveFile.getBlob();
    fileName = driveFile.getName();
  } else if (kmzSource && typeof kmzSource.getBytes === "function") {
    kmzBlob = kmzSource;
    fileName = kmzSource.getName ? kmzSource.getName() : "";
  } else {
    throw new Error("Input must be a Drive file ID or a KML/KMZ Blob.");
  }

  return extractKmlTextFromUpload(kmzBlob, fileName);
}

function extractKmlTextFromUpload(blob, fileName) {
  if (/\.kml$/i.test(fileName || "")) return blob.getDataAsString("UTF-8");
  if (!/\.kmz$/i.test(fileName || "")) {
    throw new Error("Upload a file with a .kml or .kmz extension.");
  }

  var files;
  try {
    var zipBlob = Utilities.newBlob(
      blob.getBytes(),
      "application/zip",
      fileName || "uploaded.kmz"
    );
    files = Utilities.unzip(zipBlob);
  } catch (error) {
    throw new Error("The uploaded KMZ could not be unzipped: " + (error.message || error));
  }
  var unzippedBytes = 0;
  for (var b = 0; b < files.length; b++) {
    unzippedBytes += files[b].getBytes().length;
    if (unzippedBytes > NEPA_MAX_KMZ_UNZIPPED_BYTES) {
      throw new Error("The uncompressed KMZ exceeds the 40 MiB processing limit.");
    }
  }

  var kmlFiles = files.filter(function(file) {
    var parts = normalizeKmzEntryName(file.getName()).split("/");
    var baseName = parts[parts.length - 1];
    var hasMetadataPath = parts.some(function(part) {
      return part.toLowerCase() === "__macosx" || /^\._/.test(part);
    });
    return !hasMetadataPath && /\.kml$/i.test(baseName);
  });
  if (!kmlFiles.length) throw new Error("The KMZ archive does not contain a KML file.");
  kmlFiles.sort(function(first, second) {
    var firstName = normalizeKmzEntryName(first.getName());
    var secondName = normalizeKmzEntryName(second.getName());
    var rankDifference = kmzKmlEntryRank(firstName) - kmzKmlEntryRank(secondName);
    return rankDifference || firstName.toLowerCase().localeCompare(secondName.toLowerCase());
  });
  return kmlFiles[0].getDataAsString("UTF-8");
}

function normalizeKmzEntryName(name) {
  return String(name || "").replace(/\\/g, "/").replace(/^(\.\/)+/, "").replace(/^\/+/, "");
}

function kmzKmlEntryRank(name) {
  var normalized = normalizeKmzEntryName(name);
  var parts = normalized.split("/");
  var depth = parts.length - 1;
  var baseName = parts[parts.length - 1].toLowerCase();
  if (depth === 0 && baseName === "doc.kml") return 0;
  if (depth === 0) return 1;
  return (baseName === "doc.kml" ? 2 : 3) + depth * 2;
}

function kmlToGeoJson(kmlText) {
  if (!kmlText || !String(kmlText).trim()) throw new Error("The KML file is empty.");
  var nativeResult;
  var nativeFailure = "";
  try {
    nativeResult = kmlToGeoJsonNative(kmlText);
  } catch (error) {
    nativeFailure = error.message || String(error);
    try {
      return kmlToGeoJsonViaDom(kmlText, nativeFailure, []);
    } catch (fallbackError) {
      throw new Error("Native KML conversion failed: " + nativeFailure +
        ". The toGeoJSON DOM fallback also failed: " +
        (fallbackError.message || String(fallbackError)));
    }
  }

  if (kmlResultNeedsDomFallback(nativeResult)) {
    try {
      return kmlToGeoJsonViaDom(kmlText, "native converter reported unsupported KML content",
        nativeResult.conversionWarnings || []);
    } catch (fallbackError) {
      nativeResult.conversionWarnings.push("The toGeoJSON DOM fallback was unavailable or failed: " +
        (fallbackError.message || String(fallbackError)));
    }
  }
  return nativeResult;
}

function kmlResultNeedsDomFallback(result) {
  var warnings = result && result.conversionWarnings || [];
  return warnings.some(function(warning) {
    return /skipped unsupported KML geometry|skipped rotated LatLonBox|skipped overlay/i.test(warning);
  });
}

function kmlToGeoJsonViaDom(kmlText, nativeFailure, nativeWarnings) {
  if (typeof XmlDom === "undefined" || !XmlDom.parse) {
    throw new Error("XmlDom.parse is not loaded. Ensure Boundary.gs includes the XML DOM compatibility bridge.");
  }
  if (typeof toGeoJSON === "undefined" || !toGeoJSON.kml) {
    throw new Error("The toGeoJSON.kml(document) API is not loaded. Add the togeojson bundle as a global script.");
  }

  var xmlForFallback = String(kmlText);
  var namespaceInjected = false;
  if (XmlDom.injectMissingGxNamespace) {
    var preparedXml = XmlDom.injectMissingGxNamespace(xmlForFallback);
    namespaceInjected = preparedXml !== xmlForFallback;
    xmlForFallback = preparedXml;
  }

  var document;
  var converted;
  if (XmlDom.clearCaches) XmlDom.clearCaches();
  try {
    document = XmlDom.parse(xmlForFallback);
    converted = toGeoJSON.kml(document);
  } finally {
    if (XmlDom.clearCaches) XmlDom.clearCaches();
  }
  if (converted && typeof converted.then === "function") {
    throw new Error("The togeojson KML converter must return synchronously.");
  }

  var normalizationWarnings = [];
  var output = normalizeKmlFallbackFeatureCollection(converted, normalizationWarnings);
  var warnings = Array.isArray(output.conversionWarnings) ? output.conversionWarnings.slice() : [];
  if (nativeFailure) warnings.push("Used the toGeoJSON DOM fallback because " + nativeFailure + ".");
  (nativeWarnings || []).forEach(function(warning) {
    warnings.push("Native converter warning: " + warning);
  });
  if (namespaceInjected) warnings.push("Added the missing gx namespace declaration before DOM parsing.");
  normalizationWarnings.forEach(function(warning) { warnings.push(warning); });
  output.conversionWarnings = warnings;
  return output;
}

function normalizeKmlFallbackFeatureCollection(collection, warnings) {
  if (!collection || collection.type !== "FeatureCollection" || !Array.isArray(collection.features)) {
    throw new Error("The togeojson fallback did not return a GeoJSON FeatureCollection.");
  }
  var output = {};
  Object.keys(collection).forEach(function(key) {
    if (key !== "features" && key !== "conversionWarnings") output[key] = collection[key];
  });
  output.type = "FeatureCollection";
  output.features = collection.features.map(function(feature, index) {
    if (!feature || feature.type !== "Feature") {
      throw new Error("The togeojson fallback returned an invalid Feature at index " + index + ".");
    }
    var normalized = {};
    Object.keys(feature).forEach(function(key) {
      if (key !== "geometry" && key !== "properties") normalized[key] = feature[key];
    });
    normalized.type = "Feature";
    normalized.properties = feature.properties && typeof feature.properties === "object"
      ? feature.properties : {};
    normalized.geometry = feature.geometry
      ? normalizeKmlFallbackGeometry(feature.geometry, warnings, index)
      : null;
    if (!normalized.properties.__kmlPath && normalized.properties.name) {
      normalized.properties.__kmlPath = String(normalized.properties.name);
    }
    return normalized;
  });
  if (!output.features.some(function(feature) { return !!feature.geometry; })) {
    throw new Error("The togeojson fallback returned no features with geometry.");
  }
  return output;
}

function normalizeKmlFallbackGeometry(geometry, warnings, featureIndex) {
  if (!geometry || typeof geometry.type !== "string") {
    throw new Error("The togeojson fallback returned an invalid geometry for feature " + featureIndex + ".");
  }
  if (geometry.type === "GeometryCollection") {
    if (!Array.isArray(geometry.geometries) || !geometry.geometries.length) {
      throw new Error("The togeojson fallback returned an empty GeometryCollection.");
    }
    return {
      type: "GeometryCollection",
      geometries: geometry.geometries.map(function(item) {
        return normalizeKmlFallbackGeometry(item, warnings, featureIndex);
      })
    };
  }
  if (geometry.type === "Point") {
    return { type: geometry.type, coordinates: normalizeKmlFallbackPosition(geometry.coordinates) };
  }
  if (geometry.type === "MultiPoint") {
    if (!Array.isArray(geometry.coordinates) || !geometry.coordinates.length) {
      throw new Error("The togeojson fallback returned an empty MultiPoint.");
    }
    return {
      type: geometry.type,
      coordinates: geometry.coordinates.map(normalizeKmlFallbackPosition)
    };
  }
  if (geometry.type === "LineString") {
    return { type: geometry.type, coordinates: normalizeKmlFallbackLine(geometry.coordinates) };
  }
  if (geometry.type === "MultiLineString") {
    if (!Array.isArray(geometry.coordinates) || !geometry.coordinates.length) {
      throw new Error("The togeojson fallback returned an empty MultiLineString.");
    }
    return {
      type: geometry.type,
      coordinates: geometry.coordinates.map(normalizeKmlFallbackLine)
    };
  }
  if (geometry.type === "Polygon") {
    return { type: geometry.type, coordinates: normalizeKmlFallbackPolygon(geometry.coordinates, warnings) };
  }
  if (geometry.type === "MultiPolygon") {
    if (!Array.isArray(geometry.coordinates) || !geometry.coordinates.length) {
      throw new Error("The togeojson fallback returned an empty MultiPolygon.");
    }
    return {
      type: geometry.type,
      coordinates: geometry.coordinates.map(function(polygon) {
        return normalizeKmlFallbackPolygon(polygon, warnings);
      })
    };
  }
  throw new Error("The togeojson fallback returned unsupported geometry type " + geometry.type + ".");
}

function normalizeKmlFallbackPosition(position) {
  if (!Array.isArray(position) || position.length < 2) {
    throw new Error("The togeojson fallback returned an invalid coordinate position.");
  }
  var normalized = position.slice();
  for (var i = 0; i < normalized.length; i++) {
    if (typeof normalized[i] !== "number" || !isFinite(normalized[i])) {
      throw new Error("The togeojson fallback returned a nonnumeric coordinate.");
    }
  }
  if (normalized[0] < -180 || normalized[0] > 180 ||
      normalized[1] < -90 || normalized[1] > 90) {
    throw new Error("The togeojson fallback returned coordinates outside WGS 84 bounds.");
  }
  return normalized;
}

function normalizeKmlFallbackLine(coordinates) {
  if (!Array.isArray(coordinates) || coordinates.length < 2) {
    throw new Error("The togeojson fallback returned a line with fewer than two positions.");
  }
  return coordinates.map(normalizeKmlFallbackPosition);
}

function normalizeKmlFallbackPolygon(rings, warnings) {
  if (!Array.isArray(rings) || !rings.length) {
    throw new Error("The togeojson fallback returned a polygon with no rings.");
  }
  return rings.map(function(ring, ringIndex) {
    if (!Array.isArray(ring) || ring.length < 3) {
      throw new Error("The togeojson fallback returned an invalid polygon ring.");
    }
    var normalized = ring.map(normalizeKmlFallbackPosition);
    var first = normalized[0];
    var last = normalized[normalized.length - 1];
    if (kmlCoordinatesEqual(first, last)) {
      if (!kmlPositionsExactlyEqual(first, last)) {
        normalized[normalized.length - 1] = first.slice();
        warnings.push("Snapped fallback polygon ring " + ringIndex + " to exact closure.");
      }
    } else {
      normalized.push(first.slice());
      warnings.push("Closed fallback polygon ring " + ringIndex + ".");
    }
    var distinct = {};
    normalized.forEach(function(position) {
      distinct[position[0].toFixed(10) + "," + position[1].toFixed(10)] = true;
    });
    if (Object.keys(distinct).length < 3) {
      throw new Error("The togeojson fallback returned a degenerate polygon ring.");
    }
    return normalized;
  });
}

function kmlToGeoJsonNative(kmlText) {
  if (!kmlText || !String(kmlText).trim()) throw new Error("The KML file is empty.");

  var document;
  try {
    document = XmlService.parse(kmlText);
  } catch (error) {
    throw new Error("The KML XML is not well-formed: " + (error.message || error));
  }
  var root = document.getRootElement();
  if (!root || root.getName() !== "kml" || !isKmlNamespace(getXmlNamespaceUri(root))) {
    throw new Error("The XML root element is not a supported KML document.");
  }

  var placemarks = [];
  collectKmlPlacemarks(root, [], placemarks);
  var features = [];
  var warnings = [];
  for (var i = 0; i < placemarks.length; i++) {
    var placemark = placemarks[i].element;
    var path = placemarks[i].path.join(" / ") || "(unnamed placemark)";
    var geometryElements = [];
    collectKmlGeometryElements(placemark, geometryElements);
    var unsupported = [];
    collectUnsupportedKmlGeometryNames(placemark, unsupported);
    if (unsupported.length) {
      warnings.push(path + ": skipped unsupported KML geometry " + uniqueKmlValues(unsupported).join(", ") + ".");
    }
    if (!geometryElements.length) {
      continue;
    }

    var conversion = { warnings: [], coordTimes: [] };
    var geometries = [];
    try {
      for (var g = 0; g < geometryElements.length; g++) {
        var parsed = parseKmlGeometry(geometryElements[g], conversion);
        if (parsed) geometries.push(parsed);
      }
    } catch (error) {
      throw new Error(path + ": " + (error.message || error));
    }
    if (!geometries.length) continue;

    var properties = readKmlProperties(placemark);
    properties.__kmlPath = path;
    if (placemarks[i].path.length > 1 && !properties.Layer) {
      properties.Layer = placemarks[i].path[placemarks[i].path.length - 2];
    }
    if (conversion.coordTimes.length === 1) properties.coordTimes = conversion.coordTimes[0];
    if (conversion.coordTimes.length > 1) properties.coordTimes = conversion.coordTimes;
    features.push({
      type: "Feature",
      properties: properties,
      geometry: mergeKmlGeometries(geometries)
    });
    conversion.warnings.forEach(function(warning) { warnings.push(path + ": " + warning); });
  }

  var overlays = [];
  collectKmlElements(root, "GroundOverlay", overlays);
  for (var o = 0; o < overlays.length; o++) {
    var overlayWarnings = [];
    var overlayGeometry = parseKmlGroundOverlay(overlays[o], overlayWarnings);
    overlayWarnings.forEach(function(warning) { warnings.push("GroundOverlay: " + warning); });
    if (overlayGeometry) {
      var overlayProperties = readKmlProperties(overlays[o]);
      overlayProperties.__kmlType = "GroundOverlay";
      features.push({
        type: "Feature",
        properties: overlayProperties,
        geometry: overlayGeometry
      });
    }
  }

  if (!features.length) {
    throw new Error("No supported KML geometries were found. " +
      (warnings.length ? warnings.join(" ") : "The document may contain only unsupported geometry types."));
  }
  return { type: "FeatureCollection", features: features, conversionWarnings: warnings };
}

function collectKmlPlacemarks(element, path, output) {
  if (isKmlElement(element, "Placemark")) {
    var placemarkName = getKmlChildText(element, "name");
    output.push({
      element: element,
      path: path.concat(placemarkName ? [placemarkName.trim()] : [])
    });
    return;
  }

  var nextPath = path;
  if (isKmlElement(element, "Document") || isKmlElement(element, "Folder")) {
    var containerName = getKmlChildText(element, "name");
    if (containerName && containerName.trim()) nextPath = path.concat([containerName.trim()]);
  }
  var children = getXmlChildren(element);
  for (var i = 0; i < children.length; i++) {
    if (isKmlNamespace(getXmlNamespaceUri(children[i]))) {
      collectKmlPlacemarks(children[i], nextPath, output);
    }
  }
}

function collectKmlGeometryElements(element, output) {
  var children = getXmlChildren(element);
  for (var i = 0; i < children.length; i++) {
    if (isKmlGeometryElement(children[i])) {
      output.push(children[i]);
    } else {
      collectKmlGeometryElements(children[i], output);
    }
  }
}

function isKmlGeometryElement(element) {
  if (isKmlNamespace(getXmlNamespaceUri(element))) {
    return ["Point", "LineString", "LinearRing", "Polygon", "MultiGeometry"].indexOf(element.getName()) !== -1;
  }
  return getXmlNamespaceUri(element) === KML_GX_NAMESPACE_URI &&
    ["Track", "MultiTrack"].indexOf(element.getName()) !== -1;
}

function collectUnsupportedKmlGeometryNames(element, output) {
  var children = getXmlChildren(element);
  for (var i = 0; i < children.length; i++) {
    var child = children[i];
    if (isKmlNamespace(getXmlNamespaceUri(child)) &&
        ["Model", "Location"].indexOf(child.getName()) !== -1) {
      output.push(child.getName());
    }
    collectUnsupportedKmlGeometryNames(child, output);
  }
}

function parseKmlGeometry(element, context) {
  var name = element.getName();
  if (isKmlNamespace(getXmlNamespaceUri(element))) {
    if (name === "MultiGeometry") {
      var components = [];
      var children = getXmlChildren(element);
      for (var i = 0; i < children.length; i++) {
        if (!isKmlGeometryElement(children[i])) continue;
        var childGeometry = parseKmlGeometry(children[i], context);
        if (childGeometry) components.push(childGeometry);
      }
      return mergeKmlGeometries(components);
    }
    if (name === "Point") {
      var pointCoordinates = parseKmlCoordinates(getKmlChild(element, "coordinates"));
      if (pointCoordinates.length !== 1) {
        throw new Error("A KML Point must contain exactly one coordinate tuple.");
      }
      return { type: "Point", coordinates: pointCoordinates[0] };
    }
    if (name === "LineString") {
      var lineCoordinates = parseKmlCoordinates(getKmlChild(element, "coordinates"));
      if (lineCoordinates.length < 2) throw new Error("A KML LineString must contain at least two coordinates.");
      return { type: "LineString", coordinates: lineCoordinates };
    }
    if (name === "LinearRing") {
      var ringCoordinates = parseKmlCoordinates(getKmlChild(element, "coordinates"));
      return {
        type: "Polygon",
        coordinates: [normalizeKmlRing(ringCoordinates, context)]
      };
    }
    if (name === "Polygon") return parseKmlPolygon(element, context);
  }
  if (getXmlNamespaceUri(element) === KML_GX_NAMESPACE_URI) {
    if (name === "Track") {
      var track = parseKmlTrack(element);
      context.coordTimes.push(track.times);
      return track.geometry;
    }
    if (name === "MultiTrack") {
      var tracks = getGxChildren(element, "Track");
      if (!tracks.length) throw new Error("A gx:MultiTrack does not contain any gx:Track elements.");
      var trackCoordinates = [];
      var trackTimes = [];
      for (var t = 0; t < tracks.length; t++) {
        var parsedTrack = parseKmlTrack(tracks[t]);
        trackCoordinates.push(parsedTrack.geometry.coordinates);
        trackTimes.push(parsedTrack.times);
      }
      context.coordTimes.push(trackTimes);
      return { type: "MultiLineString", coordinates: trackCoordinates };
    }
  }
  return null;
}

function parseKmlPolygon(element, context) {
  var outer = getKmlChild(element, "outerBoundaryIs");
  var outerLinearRing = outer && getKmlChild(outer, "LinearRing");
  if (!outerLinearRing) outerLinearRing = getKmlChild(element, "LinearRing");
  if (!outerLinearRing) throw new Error("A KML Polygon is missing its outer boundary LinearRing.");
  var rings = [normalizeKmlRing(parseKmlCoordinates(getKmlChild(outerLinearRing, "coordinates")), context)];
  var innerBoundaries = getKmlChildren(element, "innerBoundaryIs");
  for (var i = 0; i < innerBoundaries.length; i++) {
    var innerLinearRing = getKmlChild(innerBoundaries[i], "LinearRing");
    if (!innerLinearRing) throw new Error("A KML inner boundary is missing its LinearRing.");
    rings.push(normalizeKmlRing(parseKmlCoordinates(getKmlChild(innerLinearRing, "coordinates")), context));
  }
  return { type: "Polygon", coordinates: rings };
}

function normalizeKmlRing(coordinates, context) {
  if (coordinates.length < 3) throw new Error("A polygon ring must contain at least three coordinate tuples.");
  if (!kmlCoordinatesEqual(coordinates[0], coordinates[coordinates.length - 1])) {
    coordinates.push(coordinates[0].slice());
    context.warnings.push("closed an unclosed polygon ring to satisfy GeoJSON ring structure.");
  } else if (!kmlPositionsExactlyEqual(coordinates[0], coordinates[coordinates.length - 1])) {
    coordinates[coordinates.length - 1] = coordinates[0].slice();
    context.warnings.push("snapped a nearly closed polygon ring's final coordinate to its first coordinate.");
  }
  var distinct = {};
  coordinates.forEach(function(coordinate) {
    distinct[coordinate[0].toFixed(10) + "," + coordinate[1].toFixed(10)] = true;
  });
  if (Object.keys(distinct).length < 3) {
    throw new Error("A polygon ring must contain at least three distinct positions and a closing coordinate.");
  }
  return coordinates;
}

function parseKmlTrack(element) {
  var timeElements = getKmlChildren(element, "when");
  var coordinateElements = getGxChildren(element, "coord");
  if (coordinateElements.length < 2 || coordinateElements.length !== timeElements.length) {
    throw new Error("A gx:Track must have at least two gx:coord values and a matching <when> for each coordinate.");
  }
  var coordinates = [];
  var times = [];
  for (var i = 0; i < coordinateElements.length; i++) {
    coordinates.push(parseGxCoordinate(coordinateElements[i].getText()));
    times.push(timeElements[i].getText().trim());
  }
  return { geometry: { type: "LineString", coordinates: coordinates }, times: times };
}

function parseGxCoordinate(text) {
  var values = String(text || "").trim().split(/\s+/);
  if (values.length < 2 || values.length > 3) {
    throw new Error("A gx:coord must contain longitude, latitude, and optional altitude.");
  }
  return validateKmlCoordinate(parseKmlNumberTuple(values));
}

function parseKmlCoordinates(element) {
  if (!element) throw new Error("A KML geometry is missing its coordinates element.");
  var text = element.getText().trim();
  if (!text) return [];
  var tuples = text.split(/\s+/);
  var coordinates = [];
  for (var i = 0; i < tuples.length; i++) {
    var values = tuples[i].split(",");
    if (values.length < 2 || values.length > 3) {
      throw new Error("Invalid KML coordinate tuple: " + tuples[i]);
    }
    coordinates.push(validateKmlCoordinate(parseKmlNumberTuple(values)));
  }
  return coordinates;
}

function parseKmlNumberTuple(values) {
  var numbers = [];
  for (var i = 0; i < values.length; i++) {
    if (!String(values[i]).trim() || !isFinite(Number(values[i]))) {
      throw new Error("Invalid numeric value in KML coordinate tuple.");
    }
    numbers.push(Number(values[i]));
  }
  return numbers;
}

function validateKmlCoordinate(values) {
  if (values.length < 2 || values.length > 3 ||
      !isFinite(values[0]) || !isFinite(values[1]) ||
      values[0] < -180 || values[0] > 180 || values[1] < -90 || values[1] > 90 ||
      (values.length === 3 && !isFinite(values[2]))) {
    throw new Error("KML coordinates must be valid WGS 84 longitude, latitude, and optional altitude.");
  }
  return values;
}

function kmlCoordinatesEqual(first, second) {
  return Math.abs(first[0] - second[0]) <= 1e-10 &&
    Math.abs(first[1] - second[1]) <= 1e-10;
}

function kmlPositionsExactlyEqual(first, second) {
  if (first.length !== second.length) return false;
  for (var i = 0; i < first.length; i++) {
    if (first[i] !== second[i]) return false;
  }
  return true;
}

function parseKmlGroundOverlay(element, warnings) {
  var gxQuad = getGxChild(element, "LatLonQuad");
  if (gxQuad) {
    var quadCoordinates;
    try {
      quadCoordinates = parseKmlCoordinates(getKmlChild(gxQuad, "coordinates"));
    } catch (error) {
      warnings.push("skipped LatLonQuad with invalid coordinates: " + (error.message || error));
      return null;
    }
    if (quadCoordinates.length === 5 && kmlCoordinatesEqual(quadCoordinates[0], quadCoordinates[4])) {
      quadCoordinates[4] = quadCoordinates[0].slice();
    } else if (quadCoordinates.length === 4) {
      quadCoordinates.push(quadCoordinates[0].slice());
    } else {
      warnings.push("skipped LatLonQuad because it must contain exactly four coordinate tuples.");
      return null;
    }
    try {
      return {
        type: "Polygon",
        coordinates: [normalizeKmlRing(quadCoordinates, { warnings: warnings })]
      };
    } catch (error) {
      warnings.push("skipped invalid LatLonQuad: " + (error.message || error));
      return null;
    }
  }

  var box = getKmlChild(element, "LatLonBox");
  if (!box) {
    warnings.push("skipped overlay with no supported LatLonBox or gx:LatLonQuad.");
    return null;
  }
  var northText = getKmlChildText(box, "north");
  var southText = getKmlChildText(box, "south");
  var eastText = getKmlChildText(box, "east");
  var westText = getKmlChildText(box, "west");
  var north = Number(northText);
  var south = Number(southText);
  var east = Number(eastText);
  var west = Number(westText);
  var rotationText = getKmlChildText(box, "rotation");
  var rotation = rotationText ? Number(rotationText) : 0;
  if (!northText || !northText.trim() || !southText || !southText.trim() ||
      !eastText || !eastText.trim() || !westText || !westText.trim() ||
      !isFinite(north) || !isFinite(south) || !isFinite(east) || !isFinite(west) ||
      north <= south || north > 90 || south < -90 || east < -180 || east > 180 ||
      west < -180 || west > 180 || !isFinite(rotation)) {
    warnings.push("skipped overlay with invalid LatLonBox bounds.");
    return null;
  }
  if (Math.abs(rotation) > 1e-10) {
    warnings.push("skipped rotated LatLonBox because its geographic rotation is not approximated.");
    return null;
  }
  if (east === west) {
    warnings.push("skipped LatLonBox with zero width.");
    return null;
  }
  if (east < west) {
    return {
      type: "MultiPolygon",
      coordinates: [
        [[[west, south], [180, south], [180, north], [west, north], [west, south]]],
        [[[-180, south], [east, south], [east, north], [-180, north], [-180, south]]]
      ]
    };
  }
  return {
    type: "Polygon",
    coordinates: [[[west, south], [east, south], [east, north], [west, north], [west, south]]]
  };
}

function mergeKmlGeometries(geometries) {
  if (!geometries || !geometries.length) return null;
  if (geometries.length === 1) return geometries[0];
  var baseType = null;
  var multiType = null;
  var coordinates = [];
  for (var i = 0; i < geometries.length; i++) {
    var geometry = geometries[i];
    var currentBase;
    var currentMulti;
    if (geometry.type === "Point" || geometry.type === "MultiPoint") {
      currentBase = "Point"; currentMulti = "MultiPoint";
    } else if (geometry.type === "LineString" || geometry.type === "MultiLineString") {
      currentBase = "LineString"; currentMulti = "MultiLineString";
    } else if (geometry.type === "Polygon" || geometry.type === "MultiPolygon") {
      currentBase = "Polygon"; currentMulti = "MultiPolygon";
    }
    if (!currentBase || (baseType && currentBase !== baseType)) {
      return { type: "GeometryCollection", geometries: geometries };
    }
    baseType = currentBase;
    multiType = currentMulti;
    if (geometry.type === currentBase) coordinates.push(geometry.coordinates);
    else coordinates = coordinates.concat(geometry.coordinates);
  }
  return { type: multiType, coordinates: coordinates };
}

function readKmlProperties(element) {
  var properties = {};
  var simpleProperties = [
    "name", "description", "address", "phoneNumber", "styleUrl",
    "visibility", "open", "extrude", "tessellate", "altitudeMode"
  ];
  for (var i = 0; i < simpleProperties.length; i++) {
    var value = getKmlChildText(element, simpleProperties[i]);
    if (value !== null) properties[simpleProperties[i]] = value;
  }
  var snippet = getKmlChild(element, "Snippet") || getKmlChild(element, "snippet");
  if (snippet) properties.snippet = snippet.getText();
  if (properties.description) parseKmlDescriptionTable(properties.description, properties);

  var timestamp = getKmlChild(element, "TimeStamp");
  if (timestamp) {
    var when = getKmlChildText(timestamp, "when");
    if (when !== null) properties.timestamp = when;
  }
  var timeSpan = getKmlChild(element, "TimeSpan");
  if (timeSpan) {
    var begin = getKmlChildText(timeSpan, "begin");
    var end = getKmlChildText(timeSpan, "end");
    if (begin !== null) properties.begin = begin;
    if (end !== null) properties.end = end;
  }

  var extendedData = getKmlChild(element, "ExtendedData");
  if (extendedData) {
    var dataElements = [];
    collectKmlElements(extendedData, "Data", dataElements);
    for (var d = 0; d < dataElements.length; d++) {
      var dataName = getXmlAttributeValue(dataElements[d], "name");
      var dataValue = getKmlChildText(dataElements[d], "value");
      if (dataName && dataValue !== null) properties[dataName] = dataValue;
    }
    var simpleData = [];
    collectKmlElements(extendedData, "SimpleData", simpleData);
    for (var s = 0; s < simpleData.length; s++) {
      var fieldName = getXmlAttributeValue(simpleData[s], "name");
      if (fieldName) properties[fieldName] = simpleData[s].getText();
    }
  }
  return properties;
}

function parseKmlDescriptionTable(description, properties) {
  var rowPattern = /<tr\b[^>]*>([\s\S]*?)<\/tr>/gi;
  var rowMatch;
  while ((rowMatch = rowPattern.exec(description)) !== null) {
    var cells = [];
    var cellPattern = /<t[dh]\b[^>]*>([\s\S]*?)<\/t[dh]>/gi;
    var cellMatch;
    while ((cellMatch = cellPattern.exec(rowMatch[1])) !== null) {
      cells.push(decodeKmlHtmlText(cellMatch[1]));
    }
    if (cells.length < 2 || !cells[0] || !cells[1] || properties[cells[0]]) continue;
    properties[cells[0]] = cells[1];
  }
}

function decodeKmlHtmlText(text) {
  return String(text || "")
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;|&#160;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, "\"")
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&#(\d+);/g, function(match, code) {
      var value = Number(code);
      return value > 0 && value <= 65535 ? String.fromCharCode(value) : match;
    })
    .replace(/&#x([0-9a-f]+);/gi, function(match, code) {
      var value = parseInt(code, 16);
      return value > 0 && value <= 65535 ? String.fromCharCode(value) : match;
    })
    .replace(/\s+/g, " ")
    .trim();
}

function collectKmlElements(element, name, output) {
  var children = getXmlChildren(element);
  for (var i = 0; i < children.length; i++) {
    if (isKmlElement(children[i], name)) output.push(children[i]);
    collectKmlElements(children[i], name, output);
  }
}

function getKmlChild(element, name) {
  var children = getXmlChildren(element);
  for (var i = 0; i < children.length; i++) {
    if (isKmlElement(children[i], name)) return children[i];
  }
  return null;
}

function getKmlChildren(element, name) {
  return getXmlChildren(element).filter(function(child) { return isKmlElement(child, name); });
}

function getGxChild(element, name) {
  var children = getXmlChildren(element);
  for (var i = 0; i < children.length; i++) {
    if (getXmlNamespaceUri(children[i]) === KML_GX_NAMESPACE_URI && children[i].getName() === name) {
      return children[i];
    }
  }
  return null;
}

function getGxChildren(element, name) {
  return getXmlChildren(element).filter(function(child) {
    return getXmlNamespaceUri(child) === KML_GX_NAMESPACE_URI && child.getName() === name;
  });
}

function getKmlChildText(element, name) {
  var child = getKmlChild(element, name);
  return child ? child.getText() : null;
}

function isKmlElement(element, name) {
  return element.getName() === name && isKmlNamespace(getXmlNamespaceUri(element));
}

function isKmlNamespace(uri) {
  return KML_SUPPORTED_NAMESPACE_URIS.indexOf(uri || "") !== -1;
}

function getXmlNamespaceUri(element) {
  var namespace = element && element.getNamespace ? element.getNamespace() : null;
  return namespace && namespace.getURI ? namespace.getURI() : "";
}

function getXmlChildren(element) {
  return element && element.getChildren ? element.getChildren() : [];
}

function getXmlAttributeValue(element, name) {
  var attribute = element.getAttribute ? element.getAttribute(name) : null;
  return attribute ? attribute.getValue() : null;
}

function uniqueKmlValues(values) {
  var output = [];
  values.forEach(function(value) {
    if (output.indexOf(value) === -1) output.push(value);
  });
  return output;
}

// ===== Source: XmlDom.gs =====
/**
 * XmlDom.gs
 *
 * Exposes the browser XML DOM surface that @tmcw/togeojson v7 uses,
 * backed by Apps Script's XmlService.
 *
 * API surface was derived by reading the togeojson source, not guessed:
 *   shared.ts        - getElementsByTagName, getElementsByTagNameNS,
 *                      nodeVal (-> normalize + textContent), isElement
 *   kml/geometry.ts  - childNodes.length, childNodes.item(i), tagName, nodeType
 *   kml/placemark.ts - getAttribute("id"), childNodes iteration
 *   kml/shared.ts    - nodeType === 4 for CDATA detection
 *   kml.ts           - parentNode, localName ("CascadingStyle" check)
 *
 * Documented divergences from browser DOM (all strictly more permissive):
 *   - getElementsByTagName matches qualified name OR local name, so a KML
 *     using a non-standard prefix for a known element still resolves.
 *   - getAttribute("id") also finds an attribute whose local name is "id"
 *     but which carries a namespace prefix (e.g. kml:id).
 *
 * Unverified against the live XmlService runtime (test before production):
 *   - Whether XmlService.ContentTypes.CDATA survives parsing, or is
 *     flattened to TEXT. If flattened, getMaybeHTMLDescription() in the
 *     converter will never fire and descriptions arrive as plain strings.
 *   - Whether getQualifiedName() exists on Element and Attribute.
 *   - Whether getAllContent() exists (getContentSize/getContent fallback
 *     is used when it does not).
 *   - Whether XmlService returns a stable JS object per underlying node.
 *     The caches assume it does; correctness does not depend on it.
 */
var XmlDom = (function () {
  var CT = XmlService.ContentTypes;

  var elementCache = new Map();
  var textCache = new Map();

  function contentTypeOf(c) {
    try { return c.getType(); } catch (e) { return -1; }
  }

  function isElementContent(c) {
    return contentTypeOf(c) === CT.ELEMENT;
  }

  /** All child content of an element, including text and CDATA. */
  function contentsOf(el) {
    try {
      if (typeof el.getAllContent === "function") {
        return el.getAllContent() || [];
      }
    } catch (e) { /* fall through */ }
    var out = [];
    try {
      var n = el.getContentSize();
      for (var i = 0; i < n; i++) {
        var c = el.getContent(i);
        if (c) out.push(c);
      }
    } catch (e2) { /* empty element */ }
    return out;
  }

  function qualifiedNameOf(el) {
    try {
      if (typeof el.getQualifiedName === "function") {
        var q = el.getQualifiedName();
        if (q) return q;
      }
    } catch (e) { /* older runtime */ }
    return el.getName();
  }

  function prefixOf(node) {
    try {
      var ns = node.getNamespace();
      return ns ? ns.getPrefix() : null;
    } catch (e) { return null; }
  }

  /**
   * Attach a non-enumerable .item(i) so arrays satisfy the NodeList
   * contract that kml/geometry.ts relies on (node.childNodes.item(i)).
   */
  function asNodeList(arr) {
    try {
      Object.defineProperty(arr, "item", {
        value: function (i) { return this[i] != null ? this[i] : null; },
        enumerable: false,
        writable: true,
        configurable: true
      });
    } catch (e) { /* frozen array - ignore */ }
    return arr;
  }

  /**
   * DOM textContent equivalent: concatenation of all descendant text and
   * CDATA nodes, in document order. Implemented recursively rather than
   * delegating to Element.getValue(), because getValue() semantics on
   * elements with mixed content are not documented.
   */
  function textContentOf(el) {
    var contents = contentsOf(el);
    if (contents.length === 1) {
      var t = contentTypeOf(contents[0]);
      if (t === CT.TEXT || t === CT.CDATA) {
        return contents[0].getValue() || "";
      }
    }
    var s = "";
    for (var i = 0; i < contents.length; i++) {
      var c = contents[i];
      var ct = contentTypeOf(c);
      if (ct === CT.TEXT || ct === CT.CDATA) {
        s += c.getValue() || "";
      } else if (ct === CT.ELEMENT) {
        s += textContentOf(c.asElement());
      }
    }
    return s;
  }

  // ---------------------------------------------------------------
  // Text / CDATA node wrapper
  // ---------------------------------------------------------------
  function wrapText(content, parentWrapper) {
    if (textCache.has(content)) {
      var cached = textCache.get(content);
      if (parentWrapper && !cached.parentNode) cached.parentNode = parentWrapper;
      return cached;
    }
    var value = "";
    try { value = content.getValue() || ""; } catch (e) { /* empty */ }

    var isCdata = contentTypeOf(content) === CT.CDATA;

    var wrapper = {
      nodeType: isCdata ? 4 : 3,
      nodeName: isCdata ? "#cdata-section" : "#text",
      nodeValue: value,
      data: value,
      textContent: value,
      parentNode: parentWrapper || null,
      previousSibling: null,
      nextSibling: null,
      normalize: function () { return this; },
      toString: function () { return value; }
    };

    textCache.set(content, wrapper);
    return wrapper;
  }

  // ---------------------------------------------------------------
  // Element wrapper
  // ---------------------------------------------------------------
  function wrapElement(el, parentWrapper) {
    if (elementCache.has(el)) {
      var cached = elementCache.get(el);
      if (parentWrapper && !cached.parentNode) cached.parentNode = parentWrapper;
      return cached;
    }

    var localName = el.getName();
    var qualifiedName = qualifiedNameOf(el);

    var namespaceUri = null;
    try {
      var ns = el.getNamespace();
      if (ns) namespaceUri = ns.getURI();
    } catch (e) { /* no namespace */ }

    var _childNodes = null;
    var _attrs = null;

    var wrapper = {
      // ---- identity ----
      nodeType: 1,
      nodeName: qualifiedName,
      tagName: qualifiedName,
      localName: localName,
      namespaceURI: namespaceUri,
      parentNode: parentWrapper || null,
      previousSibling: null,
      nextSibling: null,

      _xml: el,
      _isXmlDomElement: true,
      _descIndex: null,

      // togeojson calls node.normalize() before reading textContent
      normalize: function () { return this; },

      get ownerDocument() {
        var n = this.parentNode;
        while (n && n.nodeType !== 9) n = n.parentNode;
        return n || null;
      },

      // ---- children ----
      get childNodes() {
        if (_childNodes) return _childNodes;
        var arr = [];
        var contents = contentsOf(el);
        for (var i = 0; i < contents.length; i++) {
          var c = contents[i];
          var t = contentTypeOf(c);
          if (t === CT.ELEMENT) {
            arr.push(wrapElement(c.asElement(), wrapper));
          } else if (t === CT.TEXT || t === CT.CDATA) {
            arr.push(wrapText(c, wrapper));
          }
          // comments, PIs, whitespace-only ignorable nodes are dropped.
          // togeojson skips them via nodeType checks anyway.
        }
        for (var j = 0; j < arr.length; j++) {
          arr[j].previousSibling = j > 0 ? arr[j - 1] : null;
          arr[j].nextSibling = j < arr.length - 1 ? arr[j + 1] : null;
        }
        _childNodes = asNodeList(arr);
        return _childNodes;
      },

      get children() {
        var cn = this.childNodes;
        var out = [];
        for (var i = 0; i < cn.length; i++) {
          if (cn[i].nodeType === 1) out.push(cn[i]);
        }
        return asNodeList(out);
      },

      get firstChild() {
        var cn = this.childNodes;
        return cn.length ? cn[0] : null;
      },

      get lastChild() {
        var cn = this.childNodes;
        return cn.length ? cn[cn.length - 1] : null;
      },

      hasChildNodes: function () { return this.childNodes.length > 0; },

      // ---- text ----
      get textContent() { return textContentOf(el); },

      // ---- attributes ----
      get attributes() {
        if (_attrs) return _attrs;
        var raw = [];
        try { raw = el.getAttributes() || []; } catch (e) { /* none */ }
        var out = [];
        for (var i = 0; i < raw.length; i++) {
          var a = raw[i];
          var ln = a.getName();
          var pfx = prefixOf(a);
          out.push({
            nodeType: 2,
            nodeName: pfx ? pfx + ":" + ln : ln,
            name: ln,
            localName: ln,
            qualifiedName: pfx ? pfx + ":" + ln : ln,
            prefix: pfx,
            value: a.getValue(),
            nodeValue: a.getValue(),
            specified: true
          });
        }
        _attrs = out;
        return _attrs;
      },

      getAttribute: function (name) {
        if (name == null) return null;
        var attrs = this.attributes;
        var colon = name.indexOf(":");
        var prefix = colon > 0 ? name.substring(0, colon) : null;
        var local = colon > 0 ? name.substring(colon + 1) : name;

        for (var i = 0; i < attrs.length; i++) {
          var a = attrs[i];
          if (a.qualifiedName === name) return a.value;
          if (a.localName === name) return a.value;
          if (prefix && a.localName === local && a.prefix === prefix) {
            return a.value;
          }
        }
        return null;
      },

      hasAttribute: function (name) {
        return this.getAttribute(name) !== null;
      },

      // ---- descendant queries ----
      getElementsByTagName: function (name) {
        var idx = ensureIndex(wrapper, el);
        if (name === "*") return asNodeList(idx.all.slice());
        if (idx.byLocal[name]) return asNodeList(idx.byLocal[name].slice());
        if (idx.byQual[name]) return asNodeList(idx.byQual[name].slice());
        return asNodeList([]);
      },

      getElementsByTagNameNS: function (nsUri, localName) {
        var matchAllNs = (nsUri === "*" || nsUri == null);
        var matchAllLocal = (localName === "*" || localName == null);
        var idx = ensureIndex(wrapper, el);
        var pool = matchAllLocal ? idx.all : (idx.byLocal[localName] || []);
        var out = [];
        for (var i = 0; i < pool.length; i++) {
          var w = pool[i];
          if (matchAllNs || w.namespaceURI === nsUri) out.push(w);
        }
        return asNodeList(out);
      },

      toString: function () { return "<" + qualifiedName + ">"; }
    };

    elementCache.set(el, wrapper);
    return wrapper;
  }

  /**
   * Lazily index the subtree by local name and qualified name.
   *
   * togeojson performs roughly 15-20 full descendant scans per Placemark
   * (getMulti, extractStyle's four sub-lookups, extended data, timespan,
   * timestamp, cascaded style). On a 5,000-placemark CAD export that is
   * the difference between seconds and a timeout. The index is built once
   * per element on first query and reused.
   *
   * Parent wrappers are threaded during the build, so parentNode chains
   * are correct for every element returned - which is what
   * kml.ts:getStyleId needs to find a CascadingStyle ancestor.
   */
  function ensureIndex(wrapper, el) {
    if (wrapper._descIndex) return wrapper._descIndex;

    var all = [];
    var byLocal = {};
    var byQual = {};

    (function walk(nodeEl, nodeWrapper) {
      var contents = contentsOf(nodeEl);
      for (var i = 0; i < contents.length; i++) {
        var c = contents[i];
        if (!isElementContent(c)) continue;
        var childEl = c.asElement();
        var childWrapper = wrapElement(childEl, nodeWrapper);

        var ln = childEl.getName();
        all.push(childWrapper);
        (byLocal[ln] || (byLocal[ln] = [])).push(childWrapper);

        var qn = qualifiedNameOf(childEl);
        if (qn !== ln) {
          (byQual[qn] || (byQual[qn] = [])).push(childWrapper);
        }

        walk(childEl, childWrapper);
      }
    })(el, wrapper);

    wrapper._descIndex = { all: all, byLocal: byLocal, byQual: byQual };
    return wrapper._descIndex;
  }

  // ---------------------------------------------------------------
  // Document wrapper
  // ---------------------------------------------------------------
  function wrapDocument(xmlDoc) {
    var rootEl = xmlDoc.getRootElement();
    var rootWrapper = wrapElement(rootEl, null);

    var docWrapper = {
      nodeType: 9,
      nodeName: "#document",
      documentElement: rootWrapper,
      parentNode: null,
      _xml: xmlDoc,
      _isXmlDomDocument: true,

      normalize: function () { return this; },
      get textContent() { return ""; },

      get childNodes() { return asNodeList([rootWrapper]); },
      get firstChild() { return rootWrapper; },
      get lastChild() { return rootWrapper; },
      hasChildNodes: function () { return true; },

      get ownerDocument() { return this; },

      /**
       * Document-level lookup, matching browser semantics: the root element
       * is included in the result if it matches.
       */
      getElementsByTagName: function (name) {
        var out = [];
        var ln = rootWrapper.localName;
        var qn = rootWrapper.tagName;
        if (name === "*" || ln === name || qn === name) out.push(rootWrapper);
        var inner = rootWrapper.getElementsByTagName(name);
        for (var i = 0; i < inner.length; i++) out.push(inner[i]);
        return asNodeList(out);
      },

      getElementsByTagNameNS: function (nsUri, localName) {
        var matchAllNs = (nsUri === "*" || nsUri == null);
        var matchAllLocal = (localName === "*" || localName == null);
        var out = [];

        var rootMatches =
          (matchAllLocal || rootWrapper.localName === localName) &&
          (matchAllNs || rootWrapper.namespaceURI === nsUri);
        if (rootMatches) out.push(rootWrapper);

        var inner = rootWrapper.getElementsByTagNameNS(nsUri, localName);
        for (var i = 0; i < inner.length; i++) out.push(inner[i]);
        return asNodeList(out);
      },

      getElementById: function (id) {
        var all = this.getElementsByTagName("*");
        for (var i = 0; i < all.length; i++) {
          if (all[i].getAttribute("id") === id) return all[i];
        }
        return null;
      },

      toString: function () { return "#document"; }
    };

    // Browser DOM: documentElement.parentNode === document.
    // isElement(document) is false (nodeType 9), so kml.ts:getStyleId's
    // CascadingStyle check is unaffected.
    rootWrapper.parentNode = docWrapper;

    return docWrapper;
  }

  // ---------------------------------------------------------------
  // Entry points
  // ---------------------------------------------------------------

  function parse(xmlString) {
    if (xmlString == null) {
      throw new Error("XmlDom.parse: input is null or undefined");
    }
    var s = String(xmlString);
    if (s.charCodeAt(0) === 0xFEFF) s = s.substring(1);
    s = s.replace(/^\s+/, "");

    var doc;
    try {
      doc = XmlService.parse(s);
    } catch (e) {
      throw new Error(
        "XmlDom.parse: XML parse failed - " + (e && e.message ? e.message : String(e))
      );
    }
    return wrapDocument(doc);
  }

  /** Accepts a pre-parsed XmlService Document. */
  function fromXmlServiceDocument(xmlDoc) {
    if (!xmlDoc) throw new Error("XmlDom.fromXmlServiceDocument: document is null");
    return wrapDocument(xmlDoc);
  }

  /**
   * A GPX/KML file that declares gx: elements without declaring the gx
   * namespace is invalid XML and XmlService.parse rejects it. Inject the
   * declaration when it is missing. Call this before XmlDom.parse if your
   * inputs come from tools that omit it.
   */
  function injectMissingGxNamespace(xmlString) {
    var s = String(xmlString);
    if (/xmlns:gx\s*=/.test(s)) return s;
    if (!/<gx:/.test(s)) return s;
    return s.replace(
      /<([A-Za-z_][\w.-]*:?[A-Za-z_][\w.-]*)\b/,
      function (m) {
        return m + ' xmlns:gx="http://www.google.com/kml/ext/2.2"';
      }
    );
  }

  function clearCaches() {
    elementCache.clear();
    textCache.clear();
  }

  return {
    parse: parse,
    fromXmlServiceDocument: fromXmlServiceDocument,
    injectMissingGxNamespace: injectMissingGxNamespace,
    wrapDocument: wrapDocument,
    wrapElement: wrapElement,
    clearCaches: clearCaches
  };
})();

// ===== Source: GeometryRepair.gs =====
var NEPA_GEOMETRY_CONCAVE_RATIO = 0.2;
var NEPA_CLOSED_LINE_TOLERANCE = 1e-8;

function prepareEczBoundary(rawFeatureCollection) {
  if (!rawFeatureCollection || rawFeatureCollection.type !== "FeatureCollection" ||
      !rawFeatureCollection.features || !rawFeatureCollection.features.length) {
    throw new Error("The uploaded KML/KMZ contains no geometry features.");
  }

  var selection = selectEczFeatures(rawFeatureCollection.features);
  var geometries = [];
  selection.features.forEach(function(feature) {
    flattenProjectGeometry(feature.geometry, geometries);
  });
  var selectedGeometryTypes = uniqueValues(geometries.map(function(geometry) { return geometry.type; }));
  var pointComponentCount = geometries.filter(function(geometry) {
    return geometry.type === "Point" || geometry.type === "MultiPoint";
  }).length;
  geometries = geometries.filter(function(geometry) {
    return geometry.type !== "Point" && geometry.type !== "MultiPoint";
  });
  if (!geometries.length) {
    throw new Error("The selected ECZ feature(s) contain only points. A point cannot define a project area; upload a polygon or a closed boundary line.");
  }

  var diagnostics = {
    sourceFeatureCount: rawFeatureCollection.features.length,
    selectedFeatureCount: selection.features.length,
    selectedNames: selection.features.map(function(feature) {
      return feature.properties && (feature.properties.name || feature.properties.__kmlPath) || "(unnamed feature)";
    }),
    selectionRule: selection.rule,
    inputGeometryTypes: selectedGeometryTypes,
    processingSteps: [],
    warnings: []
  };
  if (pointComponentCount) {
    diagnostics.warnings.push("Ignored " + pointComponentCount + " point component(s) because the selected ECZ also contains area or line geometry.");
  }

  var closed = [];
  var openLines = [];
  geometries.forEach(function(geometry) {
    var converted = convertClosedLinesToPolygons(geometry);
    closed = closed.concat(converted.polygons);
    openLines = openLines.concat(converted.lines);
    if (converted.convertedCount) {
      diagnostics.processingSteps.push("Converted " + converted.convertedCount + " closed line ring(s) to polygon ring(s).");
    }
  });
  var normalized = closed.concat(openLines);
  if (!normalized.length) {
    throw new Error("The selected features do not contain a polygon or usable line geometry.");
  }

  var repaired = tryJstsPolygonRepair(normalized, diagnostics);
  if (!repaired) {
    var concaveError = "";
    try {
      repaired = callConcaveHullAdapter(normalized);
      diagnostics.processingSteps.push("Constructed a GEOS concave hull from the selected project geometry.");
    } catch (error) {
      concaveError = error.message || String(error);
      diagnostics.warnings.push("Concave hull failed: " + concaveError);
    }
  }
  if (!repaired) {
    var convexError = "";
    try {
      repaired = makeJstsConvexHull(normalized);
      diagnostics.processingSteps.push("Used the JSTS convex hull as the final geometry fallback.");
    } catch (error) {
      convexError = error.message || String(error);
    }
    if (!repaired) {
      throw new Error("Could not construct a project polygon. " +
        (diagnostics.warnings.length ? diagnostics.warnings[diagnostics.warnings.length - 1] + " " : "") +
        "Convex hull failed: " + convexError +
        " Add the JSTS geometry bundle and a GEOS-WASM concave-hull adapter as described in README.md.");
    }
  }

  if (!isPolygonalGeoJson(repaired)) {
    throw new Error("The geometry repair process did not produce a polygon. Point-only and line-only results are not valid project areas.");
  }
  diagnostics.outputGeometryType = repaired.type;
  return {
    type: "FeatureCollection",
    features: [{
      type: "Feature",
      properties: { name: "ECZ", sourceFeatureCount: selection.features.length },
      geometry: repaired
    }],
    boundaryProcessing: diagnostics
  };
}

function selectEczFeatures(features) {
  var records = [];
  for (var i = 0; i < features.length; i++) {
    var feature = features[i];
    if (!feature || feature.type !== "Feature" || !feature.geometry) continue;
    var properties = feature.properties || {};
    if (properties.__kmlType === "GroundOverlay") continue;
    var text = [properties.__kmlPath, properties.name, properties.description]
      .filter(function(value) { return !!value; }).join(" ").toLowerCase();
    var labelLike = /\b(label|annotation|dimension|text|leader|callout)\b/i.test(text);
    var rightOfWay = /\brow\b|right[ -]of[ -]way/i.test(text);
    var environmentalMatch = /\becz\b|environment|control zone|sensitiv/i.test(text);
    var areaGeometry = geometryContainsAreaOrLine(feature.geometry);
    records.push({
      feature: feature,
      environmentalMatch: environmentalMatch,
      labelLike: labelLike,
      rightOfWay: rightOfWay,
      areaGeometry: areaGeometry,
      index: i
    });
  }
  if (!records.length) throw new Error("No usable KML placemarks were found.");

  var nonLabel = records.filter(function(record) { return !record.labelLike; });
  var namedCandidates = nonLabel.filter(function(record) {
    return record.environmentalMatch && record.areaGeometry && !record.rightOfWay;
  });
  if (!namedCandidates.length) {
    namedCandidates = nonLabel.filter(function(record) {
      return record.environmentalMatch && record.areaGeometry;
    });
  }
  if (namedCandidates.length) {
    return { features: namedCandidates.map(function(record) { return record.feature; }), rule: "environment/ECZ name match" };
  }

  var nonRowAreas = nonLabel.filter(function(record) { return record.areaGeometry && !record.rightOfWay; });
  if (nonRowAreas.length) {
    return { features: nonRowAreas.map(function(record) { return record.feature; }), rule: "all non-label polygon/line features (ambiguous inputs merged)" };
  }
  var rowAreas = nonLabel.filter(function(record) { return record.areaGeometry && record.rightOfWay; });
  if (rowAreas.length) {
    return { features: rowAreas.map(function(record) { return record.feature; }), rule: "ROW fallback; no other polygon/line candidates found" };
  }
  var pointFeatures = nonLabel.filter(function(record) { return !record.areaGeometry; });
  return { features: pointFeatures.map(function(record) { return record.feature; }), rule: "point-only fallback" };
}

function geometryContainsAreaOrLine(geometry) {
  if (!geometry) return false;
  if (geometry.type === "Point" || geometry.type === "MultiPoint") return false;
  if (geometry.type === "GeometryCollection") {
    return geometry.geometries.some(geometryContainsAreaOrLine);
  }
  return ["LineString", "MultiLineString", "Polygon", "MultiPolygon"].indexOf(geometry.type) !== -1;
}

function flattenProjectGeometry(geometry, output) {
  if (!geometry) return;
  if (geometry.type === "GeometryCollection") {
    geometry.geometries.forEach(function(child) { flattenProjectGeometry(child, output); });
    return;
  }
  if (geometry.type === "MultiPoint") {
    output.push(geometry);
  } else if (geometry.type === "MultiLineString") {
    geometry.coordinates.forEach(function(path) { output.push({ type: "LineString", coordinates: path }); });
  } else if (geometry.type === "MultiPolygon") {
    geometry.coordinates.forEach(function(polygon) { output.push({ type: "Polygon", coordinates: polygon }); });
  } else {
    output.push(geometry);
  }
}

function convertClosedLinesToPolygons(geometry) {
  if (geometry.type === "LineString") {
    if (isClosedLine(geometry.coordinates)) {
      return { polygons: [{ type: "Polygon", coordinates: [closeRing(geometry.coordinates)] }], lines: [], convertedCount: 1 };
    }
    return { polygons: [], lines: [geometry], convertedCount: 0 };
  }
  if (geometry.type === "Polygon") {
    return { polygons: [normalizePolygonRings(geometry)], lines: [], convertedCount: 0 };
  }
  if (geometry.type === "Point" || geometry.type === "MultiPoint") {
    return { polygons: [], lines: [], convertedCount: 0 };
  }
  throw new Error("Unsupported selected project geometry: " + geometry.type);
}

function isClosedLine(coordinates) {
  if (!coordinates || coordinates.length < 3) return false;
  var first = coordinates[0], last = coordinates[coordinates.length - 1];
  if (!coordinatesAreEqual(first, last)) return false;
  var distinct = {};
  coordinates.forEach(function(coordinate) {
    distinct[coordinate[0].toFixed(8) + "," + coordinate[1].toFixed(8)] = true;
  });
  return Object.keys(distinct).length >= 3;
}

function closeRing(coordinates) {
  var ring = coordinates.map(function(coordinate) { return coordinate.slice(0, 2); });
  if (!coordinates.length) return ring;
  if (coordinatesAreEqual(ring[0], ring[ring.length - 1])) {
    ring[ring.length - 1] = ring[0].slice();
  } else {
    ring.push(ring[0].slice());
  }
  return ring;
}

function coordinatesAreEqual(first, second) {
  return Math.abs(first[0] - second[0]) <= NEPA_CLOSED_LINE_TOLERANCE &&
    Math.abs(first[1] - second[1]) <= NEPA_CLOSED_LINE_TOLERANCE;
}

function normalizePolygonRings(polygon) {
  return {
    type: "Polygon",
    coordinates: polygon.coordinates.map(function(ring) { return closeRing(ring); })
  };
}

function tryJstsPolygonRepair(geometries, diagnostics) {
  var allArePolygonal = geometries.every(function(geometry) {
    return geometry.type === "Polygon" || geometry.type === "MultiPolygon";
  });
  if (allArePolygonal && geometries.length === 1) return geometries[0];

  try {
    var namespace = getJstsNamespace();
    var geometryCollection = {
      type: "GeometryCollection",
      geometries: geometries
    };
    var reader = new namespace.io.GeoJSONReader();
    var jstsGeometry = reader.read(geometryCollection);
    var union = namespace.operation.union.UnaryUnionOp.union(jstsGeometry);
    var polygonal = extractJstsPolygons(union, namespace);
    if (!polygonal) {
      var polygonizer = new namespace.operation.polygonize.Polygonizer();
      polygonizer.add(union);
      polygonal = extractJstsPolygons(polygonizer.getGeometry(), namespace);
      if (polygonal) diagnostics.processingSteps.push("Polygonized the selected/noded linework.");
    }
    if (polygonal) {
      diagnostics.processingSteps.push("Merged selected geometries with JSTS unary union.");
      return polygonal;
    }
  } catch (error) {
    diagnostics.warnings.push("JSTS union/polygonize failed: " + (error.message || String(error)));
  }
  return null;
}

function makeJstsConvexHull(geometries) {
  var namespace = getJstsNamespace();
  var geometry = new namespace.io.GeoJSONReader().read({
    type: "GeometryCollection",
    geometries: geometries
  });
  var hull = new namespace.algorithm.ConvexHull(geometry).getConvexHull();
  return extractJstsPolygons(hull, namespace);
}

function getJstsNamespace() {
  if (typeof jsts === "undefined" || !jsts.io || !jsts.operation ||
      !jsts.operation.union || !jsts.operation.polygonize || !jsts.algorithm) {
    throw new Error("JSTS is not loaded. Add the compatible JSTS browser bundle to the Apps Script project.");
  }
  return jsts;
}

function extractJstsPolygons(geometry, namespace) {
  if (!geometry || geometry.isEmpty()) return null;
  var polygons = [];
  collectJstsPolygonComponents(geometry, polygons);
  if (!polygons.length) return null;
  var writer = new namespace.io.GeoJSONWriter();
  var polygonGeometries = polygons.map(function(polygon) { return writer.write(polygon); });
  if (polygonGeometries.length === 1) return polygonGeometries[0];
  return { type: "MultiPolygon", coordinates: polygonGeometries.map(function(polygon) { return polygon.coordinates; }) };
}

function collectJstsPolygonComponents(geometry, output) {
  var type = geometry.getGeometryType();
  if (type === "Polygon") {
    output.push(geometry);
    return;
  }
  if (type === "MultiPolygon" || type === "GeometryCollection") {
    for (var i = 0; i < geometry.getNumGeometries(); i++) {
      collectJstsPolygonComponents(geometry.getGeometryN(i), output);
    }
  }
}

function callConcaveHullAdapter(geometries) {
  if (typeof nepaConcaveHullGeoJson !== "function") {
    throw new Error("The GEOS-WASM concave-hull adapter is not installed.");
  }
  var result = nepaConcaveHullGeoJson({
    type: "GeometryCollection",
    geometries: geometries
  }, NEPA_GEOMETRY_CONCAVE_RATIO);
  if (result && typeof result.then === "function") {
    throw new Error("The GEOS-WASM adapter must expose a synchronous nepaConcaveHullGeoJson(geometry, ratio) function to the screening server.");
  }
  if (result && result.type === "Feature") result = result.geometry;
  if (!isPolygonalGeoJson(result)) throw new Error("GEOS-WASM did not return Polygon or MultiPolygon geometry.");
  return result;
}

function isPolygonalGeoJson(geometry) {
  return !!geometry && (geometry.type === "Polygon" || geometry.type === "MultiPolygon");
}

function uniqueValues(values) {
  var output = [];
  values.forEach(function(value) {
    if (output.indexOf(value) === -1) output.push(value);
  });
  return output;
}

// ===== Source: Shapefile.gs =====
var NEPA_WGS84_PRJ = 'GEOGCS["GCS_WGS_1984",DATUM["D_WGS_1984",SPHEROID["WGS_1984",6378137,298.257223563]],PRIMEM["Greenwich",0],UNIT["Degree",0.0174532925199433]]';

function createNepaShapefileZip(project, projectName, outputFolderId) {
  if (typeof shpwrite === "undefined" || !shpwrite.zip) {
    throw new Error("shp-write is not loaded; the project boundary ZIP was not created.");
  }
  var wgs84GeoJson = validateWgs84FeatureCollection(project);
  var fileName = sanitizeDriveName(projectName + "_ECZ");
  var zipResult = shpwrite.zip(wgs84GeoJson, {
    prj: NEPA_WGS84_PRJ,
    types: { point: "points", line: "lines", polygon: "polygons" }
  });
  var bytes = getShapefileZipBytes(zipResult);
  var blob = Utilities.newBlob(bytes, "application/zip", fileName + ".zip");
  var file = outputFolderId
    ? DriveApp.getFolderById(outputFolderId).createFile(blob)
    : DriveApp.createFile(blob);
  return { id: file.getId(), url: file.getUrl(), name: file.getName() };
}

function getShapefileZipBytes(zipResult) {
  if (zipResult && typeof zipResult.then === "function") {
    throw new Error("shp-write returned an asynchronous ZIP result; use a synchronous Apps Script-compatible bundle.");
  }
  if (typeof zipResult === "string") return Utilities.base64Decode(zipResult);

  var view;
  if (typeof ArrayBuffer !== "undefined" && zipResult instanceof ArrayBuffer) {
    view = new Uint8Array(zipResult);
  } else if (typeof ArrayBuffer !== "undefined" && ArrayBuffer.isView(zipResult)) {
    view = new Uint8Array(zipResult.buffer, zipResult.byteOffset, zipResult.byteLength);
  } else if (Array.isArray(zipResult)) {
    view = zipResult;
  } else {
    throw new Error("shp-write did not return a ZIP ArrayBuffer or base64 archive.");
  }

  var bytes = [];
  for (var i = 0; i < view.length; i++) {
    var byte = Number(view[i]) & 255;
    bytes.push(byte > 127 ? byte - 256 : byte);
  }
  if (!bytes.length) throw new Error("shp-write returned an empty ZIP archive.");
  return bytes;
}

function validateWgs84FeatureCollection(featureCollection) {
  return {
    type: "FeatureCollection",
    features: featureCollection.features.map(function(feature) {
      return {
        type: "Feature",
        properties: feature.properties || {},
        geometry: validateWgs84Geometry(feature.geometry)
      };
    })
  };
}

function validateWgs84Geometry(geometry) {
  if (!geometry) return null;
  if (geometry.type === "GeometryCollection") {
    return {
      type: "GeometryCollection",
      geometries: geometry.geometries.map(validateWgs84Geometry)
    };
  }
  return {
    type: geometry.type,
    coordinates: validateWgs84CoordinateTree(geometry.coordinates)
  };
}

function validateWgs84CoordinateTree(coordinates) {
  if (!Array.isArray(coordinates)) throw new Error("Invalid coordinate structure for WGS 84 shapefile export.");
  if (coordinates.length >= 2 && typeof coordinates[0] === "number" && typeof coordinates[1] === "number") {
    if (coordinates[0] < -180 || coordinates[0] > 180 || coordinates[1] < -90 || coordinates[1] > 90) {
      throw new Error("The ECZ shapefile export contains coordinates outside WGS 84 longitude/latitude bounds.");
    }
    return coordinates.slice(0, 2);
  }
  return coordinates.map(validateWgs84CoordinateTree);
}
