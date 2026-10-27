function queryNationalAndWVSites() {
  const mygj = {
    "type": "Feature",
    "geometry": {
      "type": "MultiPolygon",
      "coordinates": [
        [
          [
            [ -81.622527962761893, 39.058819696412492, 0.0 ],
            [ -81.622619942306372, 39.059662773327361, 0.0 ],
            [ -81.622115201308574, 39.059781223140128, 0.0 ],
            [ -81.621807871190271, 39.059507744931572, 0.0 ],
            [ -81.621471382831615, 39.058960788479247, 0.0 ],
            [ -81.622319338413348, 39.058488735836498, 0.0 ],
            [ -81.622527962761893, 39.058819696412492, 0.0 ]
          ]
        ]
      ]
    },
    "properties": {"name": "ECZ", "Description": ""},
    "id": 1
  };

  // National Register (NPS) URLs
  const npsPointsUrl = "https://mapservices.nps.gov/arcgis/rest/services/cultural_resources/nrhp_locations/MapServer/0/query";
  const npsPolyUrl   = "https://mapservices.nps.gov/arcgis/rest/services/cultural_resources/nrhp_locations/MapServer/1/query";

  // West Virginia SHPO URLs
  const wvPointsUrl = "https://services.wvgis.wvu.edu/ArcGIS/rest/services/Society/wv_SHPO_public/FeatureServer/1/query";
  const wvPolyUrl   = "https://services.wvgis.wvu.edu/ArcGIS/rest/services/Society/wv_SHPO_public/FeatureServer/4/query";

  // Convert GeoJSON MultiPolygon rings to 2D ArcGIS rings format
  const arcgisRings = mygj.geometry.coordinates.map(polygon => 
    polygon.map(ring => 
      ring.map(coord => [coord[0], coord[1]])
    )
  ).flat();

  const geometryPayload = JSON.stringify({
    rings: arcgisRings,
    spatialReference: { wkid: 4326 }
  });

  // Base parameters common across all queries
  const baseParams = {
    f: "json",
    geometryType: "esriGeometryPolygon",
    geometry: geometryPayload,
    inSR: "4326",
    outSR: "4326",
    outFields: "*",
    returnGeometry: "true"
  };

  // Helper to generate POST request configuration for UrlFetchApp
  function createRequest(url, spatialRel, distance, units) {
    const payload = Object.assign({}, baseParams, {
      spatialRel: spatialRel
    });

    if (distance) {
      payload.distance = distance;
      payload.units = units;
    }

    return {
      url: url,
      method: "post",
      payload: payload,
      muteHttpExceptions: true
    };
  }

  // Define array of all 8 requests (4 for NPS, 4 for WV SHPO)
  const requests = [
    // NPS National Queries
    createRequest(npsPointsUrl, "esriSpatialRelIntersects"),               // [0] pointsi
    createRequest(npsPointsUrl, "esriSpatialRelIntersects", "10", "esriSRUnit_StatuteMile"), // [1] pointsb
    createRequest(npsPolyUrl,   "esriSpatialRelIntersects"),               // [2] polyi
    createRequest(npsPolyUrl,   "esriSpatialRelIntersects", "10", "esriSRUnit_StatuteMile"), // [3] polyb

    // WV SHPO Queries
    createRequest(wvPointsUrl,  "esriSpatialRelIntersects"),               // [4] pointsiwv
    createRequest(wvPointsUrl,  "esriSpatialRelIntersects", "10", "esriSRUnit_StatuteMile"), // [5] pointsbwv
    createRequest(wvPolyUrl,    "esriSpatialRelIntersects"),               // [6] polyiwv
    createRequest(wvPolyUrl,    "esriSpatialRelIntersects", "10", "esriSRUnit_StatuteMile")  // [7] polybwv
  ];

  // Execute all 8 requests asynchronously in a single batch
  const responses = UrlFetchApp.fetchAll(requests);

  // Map response bodies into output object
  const results = {
    pointsi:   JSON.parse(responses[0].getContentText()),
    pointsb:   JSON.parse(responses[1].getContentText()),
    polyi:      JSON.parse(responses[2].getContentText()),
    polyb:      JSON.parse(responses[3].getContentText()),
    pointsiwv: JSON.parse(responses[4].getContentText()),
    pointsbwv: JSON.parse(responses[5].getContentText()),
    polyiwv:   JSON.parse(responses[6].getContentText()),
    polybwv:   JSON.parse(responses[7].getContentText())
  };

  // Log counts
  Logger.log("NPS Points Intersect: " + (results.pointsi.features ? results.pointsi.features.length : 0));
  Logger.log("NPS Points Buffer: "    + (results.pointsb.features ? results.pointsb.features.length : 0));
  Logger.log("NPS Poly Intersect: "   + (results.polyi.features ? results.polyi.features.length : 0));
  Logger.log("NPS Poly Buffer: "      + (results.polyb.features ? results.polyb.features.length : 0));
  Logger.log(results.pointsb)
  
  Logger.log("WV Points Intersect: "  + (results.pointsiwv.features ? results.pointsiwv.features.length : 0));
  Logger.log("WV Points Buffer: "     + (results.pointsbwv.features ? results.pointsbwv.features.length : 0));
  Logger.log("WV Poly Intersect: "    + (results.polyiwv.features ? results.polyiwv.features.length : 0));
  Logger.log("WV Poly Buffer: "       + (results.polybwv.features ? results.polybwv.features.length : 0));
  Logger.log(results.polybwv)

  return results;
}