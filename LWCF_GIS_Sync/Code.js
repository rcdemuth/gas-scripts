/**
 * Automated LWCF Layer Extractor & Drive Sync
 */
const CONFIG = {
  // Target Google Drive Folder ID
  GOOGLE_DRIVE_FOLDER_ID: "1BqBCtDGgys2tKxi8ajgLJ_gf4pbrH2L4",

  // Required header: utility.arcgis.com verifies this domain to permit access
  REFERER: "https://lwcf.tplgis.org/",

  LAYERS: [
    {
      id: 0,
      name: "layer_0_state_points.geojson",
      url: "https://utility.arcgis.com/usrsvcs/servers/12bd04d956514fb983b5101f2d66122b/rest/services/Map/FeatureServer/0",
      where: "1=1",
      description: "State points"
    },
    {
      id: 1,
      name: "layer_1_federal_unit_and_area_level_summary.geojson",
      url: "https://utility.arcgis.com/usrsvcs/servers/12bd04d956514fb983b5101f2d66122b/rest/services/Map/FeatureServer/1",
      where: "1=1",
      description: "Federal unit and area level summary"
    },
    {
      id: 2,
      name: "layer_2_unit_and_area_level_summary.geojson",
      url: "https://utility.arcgis.com/usrsvcs/servers/12bd04d956514fb983b5101f2d66122b/rest/services/Map/FeatureServer/2",
      where: "1=1",
      description: "Unit and area level summary"
    },
    {
      id: 3,
      name: "layer_3_projects_zoomed_out.geojson",
      url: "https://utility.arcgis.com/usrsvcs/servers/12bd04d956514fb983b5101f2d66122b/rest/services/Map/FeatureServer/3",
      where: "STATE = 'WV'",
      description: "Projects Zoomed Out"
    },
    {
      id: 4,
      name: "layer_4_projects_zoomed_in.geojson",
      url: "https://utility.arcgis.com/usrsvcs/servers/12bd04d956514fb983b5101f2d66122b/rest/services/Map/FeatureServer/4",
      where: "STATE = 'WV'",
      description: "Projects Zoomed In"
    }
  ]
};

/**
 * Main execution function — run manually or connect to a timer trigger.
 */
function updateAllLayers() {
  const folder = CONFIG.GOOGLE_DRIVE_FOLDER_ID 
    ? DriveApp.getFolderById(CONFIG.GOOGLE_DRIVE_FOLDER_ID) 
    : DriveApp.getRootFolder();

  CONFIG.LAYERS.forEach(layerCfg => {
    Logger.log(`\n==================================================`);
    Logger.log(`Starting Layer ${layerCfg.id}: ${layerCfg.description}`);
    try {
      const geojson = fetchLayerAsGeoJSON(layerCfg);
      saveOrUpdateDriveFile(folder, layerCfg.name, JSON.stringify(geojson, null, 2));
      Logger.log(`Successfully saved ${geojson.features.length} features to ${layerCfg.name}`);
    } catch (err) {
      Logger.log(`Error updating Layer ${layerCfg.id}: ${err.message}`);
    }
  });

  Logger.log("\nAll layers processed.");
}

/**
 * Queries the ArcGIS REST endpoint via POST, handles pagination,
 * and formats features as standard WGS84 GeoJSON.
 */
function fetchLayerAsGeoJSON(layerCfg) {
  let queryUrl = layerCfg.url.trim().replace(/\/+$/, "");
  if (!queryUrl.endsWith("/query")) {
    queryUrl += "/query";
  }

  const pageSize = 2000;
  let offset = 0;
  let hasMore = true;
  let allFeatures = [];

  const headers = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Referer": CONFIG.REFERER,
    "Origin": CONFIG.REFERER.replace(/\/+$/, "")
  };

  while (hasMore) {
    const payload = {
      "where": layerCfg.where || "1=1",
      "outFields": "*",
      "returnGeometry": "true",
      "outSR": "4326", // WGS84 [longitude, latitude]
      "f": "json",
      "resultOffset": offset.toString(),
      "resultRecordCount": pageSize.toString()
    };

    const options = {
      method: "post",
      headers: headers,
      payload: payload,
      muteHttpExceptions: true
    };

    const response = UrlFetchApp.fetch(queryUrl, options);
    const code = response.getResponseCode();

    if (code !== 200) {
      throw new Error(`Server returned HTTP ${code}: ${response.getContentText().substring(0, 300)}`);
    }

    const data = JSON.parse(response.getContentText());

    if (data.error) {
      throw new Error(`ArcGIS Server Error: ${data.error.message || JSON.stringify(data.error)}`);
    }

    const features = data.features || [];
    allFeatures = allFeatures.concat(features);
    Logger.log(`[Layer ${layerCfg.id}] Batch fetched: ${features.length} records (Total: ${allFeatures.length})`);

    // Verify pagination limits
    if (features.length < pageSize || data.exceededTransferLimit === false) {
      hasMore = false;
    } else {
      offset += pageSize;
    }
  }

  // Convert Esri JSON geometries into standard GeoJSON
  const geojsonFeatures = allFeatures.map(f => {
    let geom = null;
    if (f.geometry) {
      if (f.geometry.x !== undefined && f.geometry.y !== undefined) {
        geom = { type: "Point", coordinates: [f.geometry.x, f.geometry.y] };
      } else if (f.geometry.rings) {
        geom = { type: "Polygon", coordinates: f.geometry.rings };
      } else if (f.geometry.paths) {
        geom = { type: "MultiLineString", coordinates: f.geometry.paths };
      }
    }
    return {
      type: "Feature",
      geometry: geom,
      properties: f.attributes || {}
    };
  });

  return {
    type: "FeatureCollection",
    layerId: layerCfg.id,
    layerDescription: layerCfg.description,
    lastUpdated: new Date().toISOString(),
    features: geojsonFeatures
  };
}

/**
 * Updates an existing file in Google Drive or creates a new one.
 */
function saveOrUpdateDriveFile(folder, filename, content) {
  const files = folder.getFilesByName(filename);
  if (files.hasNext()) {
    const file = files.next();
    file.setContent(content);
  } else {
    folder.createFile(filename, content, MimeType.PLAIN_TEXT);
  }
}