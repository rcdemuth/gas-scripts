/**
 * Queries LWCF Layer 4 for environmental project screening in WV.
 * Returns raw ArcGIS FeatureSet JSONs for both direct intersection (lwcfi)
 * and 1-mile proximity buffer (lwcfb).
 *
 * @param {Object|string} inputGeometry - GeoJSON geometry (Polygon, MultiPolygon, LineString, MultiLineString) 
 *                                        or Esri JSON ({rings: [...]} / {paths: [...]}).
 * @return {Object} { lwcfi: Object, lwcfb: Object } containing raw ArcGIS FeatureSet JSONs.
 */
function getLWCFScreeningData(inputGeometry) {
  const QUERY_URL = "https://utility.arcgis.com/usrsvcs/servers/12bd04d956514fb983b5101f2d66122b/rest/services/Map/FeatureServer/4/query";
  const REFERER = "https://lwcf.tplgis.org/";

  // 1. Normalize input geometry to Esri format
  const esriGeom = parseToEsriGeometry(inputGeometry);

  const headers = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Referer": REFERER,
    "Origin": REFERER.replace(/\/+$/, "")
  };

  /**
   * Helper function to post queries and return the raw ArcGIS JSON response.
   */
  function queryArcGIS(distance, units) {
    const payload = {
      "f": "json",
      "where": "STATE = 'WV'",
      "outFields": "*",
      "returnGeometry": "true",
      "inSR": "4326",
      "outSR": "4326",
      "geometryType": esriGeom.geometryType,
      "geometry": JSON.stringify(esriGeom.geometry),
      "spatialRel": "esriSpatialRelIntersects",
      "resultRecordCount": "2000"
    };

    if (distance) {
      payload["distance"] = distance.toString();
      payload["units"] = units || "esriSRUnit_StatuteMile";
    }

    const options = {
      method: "post",
      headers: headers,
      payload: payload,
      muteHttpExceptions: true
    };

    const response = UrlFetchApp.fetch(QUERY_URL, options);
    const statusCode = response.getResponseCode();

    if (statusCode !== 200) {
      throw new Error(`ArcGIS Server Error (HTTP ${statusCode}): ${response.getContentText().substring(0, 300)}`);
    }

    const parsedJson = JSON.parse(response.getContentText());

    if (parsedJson.error) {
      throw new Error(`ArcGIS REST Error: ${parsedJson.error.message || JSON.stringify(parsedJson.error)}`);
    }

    return parsedJson;
  }

  // 2. Query direct footprint intersection
  const lwcfi = queryArcGIS();

  // 3. Query 1-mile buffer proximity
  const lwcfb = queryArcGIS(1, "esriSRUnit_StatuteMile");

  // 4. Return both raw ArcGIS JSON FeatureSets
  return {
    lwcfi: lwcfi,
    lwcfb: lwcfb
  };
}

/**
 * Converts GeoJSON Polygon, MultiPolygon, LineString, MultiLineString, 
 * or Esri JSON objects into ArcGIS REST-compatible geometry structures.
 */
function parseToEsriGeometry(input) {
  if (typeof input === "string") {
    input = JSON.parse(input);
  }
  if (input.type === "Feature" && input.geometry) {
    input = input.geometry;
  }

  // Esri Polygon
  if (input.rings) {
    return {
      geometryType: "esriGeometryPolygon",
      geometry: { rings: input.rings, spatialReference: { wkid: 4326 } }
    };
  }

  // Esri Polyline
  if (input.paths) {
    return {
      geometryType: "esriGeometryPolyline",
      geometry: { paths: input.paths, spatialReference: { wkid: 4326 } }
    };
  }

  // GeoJSON Polygon
  if (input.type === "Polygon") {
    return {
      geometryType: "esriGeometryPolygon",
      geometry: { rings: input.coordinates, spatialReference: { wkid: 4326 } }
    };
  }

  // GeoJSON MultiPolygon
  if (input.type === "MultiPolygon") {
    const flattenedRings = [];
    input.coordinates.forEach(polygon => {
      polygon.forEach(ring => flattenedRings.push(ring));
    });
    return {
      geometryType: "esriGeometryPolygon",
      geometry: { rings: flattenedRings, spatialReference: { wkid: 4326 } }
    };
  }

  // GeoJSON LineString
  if (input.type === "LineString") {
    return {
      geometryType: "esriGeometryPolyline",
      geometry: { paths: [input.coordinates], spatialReference: { wkid: 4326 } }
    };
  }

  // GeoJSON MultiLineString
  if (input.type === "MultiLineString") {
    return {
      geometryType: "esriGeometryPolyline",
      geometry: { paths: input.coordinates, spatialReference: { wkid: 4326 } }
    };
  }

  throw new Error(`Unsupported geometry type: ${input.type || "Unknown"}. Expected Polygon, MultiPolygon, LineString, MultiLineString, or Esri JSON.`);
}
