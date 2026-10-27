var NEPA_DEFAULT_SLIDES_TEMPLATE_ID = "13m1ZHqUspX9tNUPey1M-ICbAxT7ue4L7kTwBTrzO5CY";
var NEPA_CONFIG = {
  inputKmzFileId: "REPLACE_WITH_KMZ_DRIVE_FILE_ID",
  outputFolderId: "",
  parentFolderId: "15ytzBu4KBSmPav7BBOg1ke-AldNJenKV",
  slidesTemplateId: NEPA_DEFAULT_SLIDES_TEMPLATE_ID,
  reportTemplateId: "1YJyxfNveDfjd9YJV0aQSaypfnfE6R2NwjA30F2171Hk",
  projectName: "NEPA Screening",
  stateProjectNumber: "",
  federalProjectNumber: "",
  projectType: "Other",
  mapFeatureLimit: 250,
  pageContentOffsetX: 36,
  pageContentOffsetY: 36,
  mapWidthPt: 540,
  mapHeightPt: 622.8,
  layers: [
    { name: "USACE_Districts", longName: "NEPA\\screening\\unmapped\\USACE_Districts", source: "https://services7.arcgis.com/n1YM8pTrFmm7L4hs/ArcGIS/rest/services/DistrictLocator/FeatureServer/0", screen: true },
    { name: "County", longName: "NEPA\\screening\\unmapped\\County", source: "https://services.wvgis.wvu.edu/ArcGIS/rest/services/Boundaries/wv_political_boundary/MapServer/0", screen: true },
    { name: "Quarter Quad", longName: "NEPA\\screening\\unmapped\\Quarter Quad", source: "https://carto.nationalmap.gov/arcgis/rest/services/map_indices/MapServer/10", screen: true, returnGeometry: false },
    { name: "Streams", longName: "NEPA\\screening\\unmapped\\Streams", source: "https://tagis.dep.wv.gov/arcgis/rest/services/WVDEP_enterprise/watershed_assessment/MapServer/2", screen: true, fields: ["wv_strname", "gnis_name"] },
    { name: "Impaired Streams", longName: "NEPA\\screening\\unmapped\\Impaired Streams", source: "https://geopub.epa.gov/arcgis/rest/services/NEPAssist/Water/MapServer/1", screen: true, fields: ["assessmentunitname"] },
    { name: "Impaired Waterbodies", longName: "NEPA\\screening\\unmapped\\Impaired Waterbodies", source: "https://geopub.epa.gov/arcgis/rest/services/NEPAssist/Water/MapServer/2", screen: true, fields: ["assessmentunitname"] },
    { name: "HUC 8 Watersheds", longName: "NEPA\\screening\\unmapped\\HUC 8 Watersheds", source: "https://tagis.dep.wv.gov/arcgis/rest/services/WRPA_Web_GIS/WV_Watersheds/MapServer/1", screen: true, fields: ["watershed"] },
    { name: "HUC 10 and 12 Watersheds", longName: "NEPA\\screening\\unmapped\\HUC 10 and 12 Watersheds", source: "https://tagis.dep.wv.gov/arcgis/rest/services/WRPA_Web_GIS/WV_Watersheds/MapServer/3", screen: true, fields: ["hu_10_name", "hu_12_name"] },
    { name: "Federal Wetlands", longName: "NEPA\\screening\\unmapped\\Federal Wetlands", source: "https://services.arcgis.com/P3ePLMYs2RVChkJx/arcgis/rest/services/USA_Wetlands/FeatureServer/0", screen: true, fields: ["wetland_type", "system_name"] },
    { name: "WVDEP Wetlands", longName: "NEPA\\screening\\WVDEP Wetlands", source: "https://tagis.dep.wv.gov/arcgis/rest/services/WVDEP_enterprise/watershed_assessment/MapServer/18", screen: true, map: true, mapAsVector: true, fields: ["wetland_type"] },
    { name: "Comm Nav Streams", longName: "NEPA\\screening\\Infrastructure\\Comm Nav Streams", source: "https://services7.arcgis.com/n1YM8pTrFmm7L4hs/ArcGIS/rest/services/Waterway_Networks/FeatureServer/1", screen: true, map: true, fields: ["rivername"] },
    { name: "Fed Aid Routes", longName: "NEPA\\screening\\Infrastructure\\Fed Aid Routes", source: "https://services2.arcgis.com/xLpB90lOmCXYDAWo/ArcGIS/rest/services/Federal_Aid/FeatureServer/16", screen: true, map: true, fields: ["route_id", "fas_type"] },
    { name: "Bridge", longName: "NEPA\\screening\\Infrastructure\\Bridge", source: "Google Sheets: Main_Bridges", sourceType: "GOOGLE_SHEETS_BRIDGES", spreadsheetId: "1vXJVYzlnQfQPDm7jKV5z2LF9vwmKtnbrAOeGxiLVeHI", sheetName: "Main_Bridges", sheetFieldMap: { brnum: "co_rt_mp", barsid: "bars_number", locname: "bridge_name", featint: "narrative_nbi_6a_feature_intersected", lengthft: "total_bridge_length", feattype: "under_bridge", historic: "historic_significance", yrblt: "year_built", widthft: "width_out_to_out", latitude: "latitude", longitude: "longitude", federal_land_access: "federal_land_access" }, screen: true, map: true, fields: ["barsid", "locname", "featint", "feattype", "historic", "yrblt", "lengthft", "widthft"] },
    { name: "Airport Footprints", longName: "NEPA\\screening\\Infrastructure\\Airport Footprints", source: "https://geopub.epa.gov/arcgis/rest/services/NEPAssist/Transportation/MapServer/1", screen: true, map: true, mapAsVector: true, fields: ["name"], distanceMiles: 2 },
    { name: "NHDMusselStreams", mapLabel: "NHDMusselStreams", longName: "NEPA\\screening\\Species\\NHDMusselStreams", source: "https://services.wvgis.wvu.edu/ArcGIS/rest/services/Inland_Waters/Mussel_Streams_NHD/MapServer/1", screen: true, map: true, mapAsVector: true, fields: ["gnis_name", "streamgroup", "description", "length", "reachcode"], special: "mussels" },
    { name: "High Box Turt Habitat", longName: "NEPA\\screening\\Species\\Box Turtle Road Crossing Analysis\\High Box Turt Habitat", source: "DRIVE_GEOTIFF:1K582wzk2zjA61RUgywYkMrLIFVIVAZYN", sourceType: "DRIVE_GEOTIFF", rasterSample: 0, rasterStyle: { value: 30, noDataValue: 127, color: "#FF7100", opacity: 0.45 }, screen: true, map: true },
    { name: "High Box Turt Crossing Risk", longName: "NEPA\\screening\\Species\\Box Turtle Road Crossing Analysis\\High Box Turt Crossing Risk", source: "DRIVE_GEOJSON:1RFhd7jDcjkM1RidMYoCwyJHb_SHeCQ3H", topoJsonObjectIndex: 0, screen: true, map: true },
    { name: "Hibernacula", longName: "NEPA\\screening\\Species\\Bats\\Hibernacula", source: "DRIVE_GEOJSON:1iUtFwxjAl0qwPLh8olrOuJbwaAovmaEj", screen: true, map: true, topoJsonObject: "hibernacula.geojson", fields: ["objectid", "species", "hibernacula", "buffermile", "buffertype"] },
    { name: "Bat Roosts", longName: "NEPA\\screening\\Species\\Bats\\Bat Roosts", source: "DRIVE_GEOJSON:1iUtFwxjAl0qwPLh8olrOuJbwaAovmaEj", screen: true, map: true, topoJsonObject: "BatRoosts.geojson", fields: ["objectid", "species", "roosttype", "buffermile", "buffertype"] },
    { name: "Bat Captures", longName: "NEPA\\screening\\Species\\Bats\\Bat Captures", source: "DRIVE_GEOJSON:1iUtFwxjAl0qwPLh8olrOuJbwaAovmaEj", screen: true, map: true, topoJsonObject: "BatCaptures.geojson", fields: ["species", "cap_type", "buffermile", "buffertype"] },
    { name: "Architectural Point", longName: "NEPA\\screening\\History\\WV SHPO\\Architectural Point", source: "https://services.wvgis.wvu.edu/ArcGIS/rest/services/Society/wv_SHPO_public/FeatureServer/0", mapServiceUrl: "https://services.wvgis.wvu.edu/ArcGIS/rest/services/Society/wv_SHPO_public/MapServer", mapServiceLayerId: 0, mapServiceDefaultRenderer: true, screen: true, map: true, returnGeometry: true, fields: ["site_id", "histname", "resourcetype"], bufferMiles: 1 },
    { name: "National Register Point", longName: "NEPA\\screening\\History\\WV SHPO\\National Register Point", source: "https://services.wvgis.wvu.edu/ArcGIS/rest/services/Society/wv_SHPO_public/FeatureServer/1", mapServiceUrl: "https://services.wvgis.wvu.edu/ArcGIS/rest/services/Society/wv_SHPO_public/MapServer", mapServiceLayerId: 1, mapServiceDefaultRenderer: true, screen: true, map: true, returnGeometry: true, fields: ["resourcetype", "histname", "site_id"], bufferMiles: 1 },
    { name: "Cemeteries Point", longName: "NEPA\\screening\\History\\WV SHPO\\Cemeteries Point", source: "https://services.wvgis.wvu.edu/ArcGIS/rest/services/Society/wv_SHPO_public/FeatureServer/2", screen: true, map: true, mapAsVector: true, returnGeometry: true, fields: ["site_id", "histname"], bufferMiles: 1 },
    { name: "Architectural Poly", longName: "NEPA\\screening\\History\\WV SHPO\\Architectural Poly", source: "https://services.wvgis.wvu.edu/ArcGIS/rest/services/Society/wv_SHPO_public/FeatureServer/3", mapServiceUrl: "https://services.wvgis.wvu.edu/ArcGIS/rest/services/Society/wv_SHPO_public/MapServer", mapServiceLayerId: 3, screen: true, map: true, returnGeometry: true, fields: ["resourcetype", "histname", "site_id"], bufferMiles: 1 },
    { name: "National Register Poly", longName: "NEPA\\screening\\History\\WV SHPO\\National Register Poly", source: "https://services.wvgis.wvu.edu/ArcGIS/rest/services/Society/wv_SHPO_public/FeatureServer/4", mapServiceUrl: "https://services.wvgis.wvu.edu/ArcGIS/rest/services/Society/wv_SHPO_public/MapServer", mapServiceLayerId: 4, screen: true, map: true, returnGeometry: true, fields: ["resourcetype", "histname", "site_id"], bufferMiles: 1 },
    { name: "Cemeteries Poly", longName: "NEPA\\screening\\History\\WV SHPO\\Cemeteries Poly", source: "https://services.wvgis.wvu.edu/ArcGIS/rest/services/Society/wv_SHPO_public/FeatureServer/5", mapServiceUrl: "https://services.wvgis.wvu.edu/ArcGIS/rest/services/Society/wv_SHPO_public/MapServer", mapServiceLayerId: 5, screen: true, map: true, returnGeometry: true, fields: ["site_id", "histname"], bufferMiles: 1 },
    { name: "USGS Cemeteries", longName: "NEPA\\screening\\History\\USGS Cemeteries", source: "https://services.wvgis.wvu.edu/ArcGIS/rest/services/Location/wv_Cemeteries_USGS/MapServer/0", screen: true, map: true, mapAsVector: true, fields: ["name"], bufferMiles: 1 },
    { name: "WVParcels", longName: "NEPA\\screening\\unscreened\\WVParcels", source: "https://services.wvgis.wvu.edu/ArcGIS/rest/services/Planning_Cadastre/WV_Parcels/MapServer/0", screen: false, map: true },
    { name: "NPS Owned", longName: "NEPA\\screening\\unscreened\\NPS Owned", source: "https://services.wvgis.wvu.edu/ArcGIS/rest/services/Boundaries/wv_protected_lands/MapServer/2", screen: false, screenConditional: true, map: true, mapAsVector: true, drawAfterLayers: true },
    { name: "FS Owned", longName: "NEPA\\screening\\unscreened\\FS Owned", source: "https://services.wvgis.wvu.edu/ArcGIS/rest/services/Boundaries/wv_protected_lands/MapServer/1", screen: false, screenConditional: true, map: true, mapAsVector: true, drawAfterLayers: true },
    { name: "WVDOT Base Map", longName: "NEPA\\screening\\unscreened\\WVDOT Base Map", source: "https://gis.transportation.wv.gov/arcgis/rest/services/Base_Maps/WVDOT_Base_Map_WM/MapServer", screen: false, map: true, mapExportLayers: "hide:35,36,37" },
    { name: "Wildlife Management Area", longName: "NEPA\\screening\\Protected Lands\\Wildlife Management Area", source: "https://services.wvgis.wvu.edu/ArcGIS/rest/services/Boundaries/wv_protected_lands/MapServer/6", mapServiceUrl: "https://services.wvgis.wvu.edu/ArcGIS/rest/services/Boundaries/wv_protected_lands/MapServer", mapServiceLayerId: 6, screen: true, map: true, mapAsVector: true, nativePolygonPattern: true, fields: ["unit_nm", "loc_own"] },
    { name: "State Wildlife Sanctuary", longName: "NEPA\\screening\\Protected Lands\\State Protected Lands\\State Wildlife Sanctuary", source: "https://services.wvgis.wvu.edu/ArcGIS/rest/services/Boundaries/wv_protected_lands/MapServer/8", mapServiceUrl: "https://services.wvgis.wvu.edu/ArcGIS/rest/services/Boundaries/wv_protected_lands/MapServer", mapServiceLayerId: 8, screen: true, map: true, mapAsVector: true, nativeMarkerFill: true, fields: ["unit_nm", "loc_own"] },
    { name: "State Wildlife Center", longName: "NEPA\\screening\\Protected Lands\\State Protected Lands\\State Wildlife Center", source: "https://services.wvgis.wvu.edu/ArcGIS/rest/services/Boundaries/wv_protected_lands/MapServer/7", mapServiceUrl: "https://services.wvgis.wvu.edu/ArcGIS/rest/services/Boundaries/wv_protected_lands/MapServer", mapServiceLayerId: 7, screen: true, map: true, mapAsVector: true, nativeMarkerFill: true, fields: ["unit_nm", "loc_own"] },
    { name: "State Park", longName: "NEPA\\screening\\Protected Lands\\State Protected Lands\\State Park", source: "https://services.wvgis.wvu.edu/ArcGIS/rest/services/Boundaries/wv_protected_lands/MapServer/10", mapServiceUrl: "https://services.wvgis.wvu.edu/ArcGIS/rest/services/Boundaries/wv_protected_lands/MapServer", mapServiceLayerId: 10, screen: true, map: true, mapAsVector: true, nativeMarkerFill: true, fields: ["unit_nm"] },
    { name: "State Forest", longName: "NEPA\\screening\\Protected Lands\\State Protected Lands\\State Forest", source: "https://services.wvgis.wvu.edu/ArcGIS/rest/services/Boundaries/wv_protected_lands/MapServer/11", mapServiceUrl: "https://services.wvgis.wvu.edu/ArcGIS/rest/services/Boundaries/wv_protected_lands/MapServer", mapServiceLayerId: 11, screen: true, map: true, mapAsVector: true, nativeMarkerFill: true, fields: ["unit_nm"] },
    { name: "State Nature Area", longName: "NEPA\\screening\\Protected Lands\\State Protected Lands\\State Nature Area", source: "https://services.wvgis.wvu.edu/ArcGIS/rest/services/Boundaries/wv_protected_lands/MapServer/9", mapServiceUrl: "https://services.wvgis.wvu.edu/ArcGIS/rest/services/Boundaries/wv_protected_lands/MapServer", mapServiceLayerId: 9, screen: true, map: true, mapAsVector: true, nativeMarkerFill: true, fields: ["unit_nm"] },
    { name: "Protected Local Lands", longName: "NEPA\\screening\\Protected Lands\\Other Protected Lands\\Protected Local Lands", source: "https://services.wvgis.wvu.edu/ArcGIS/rest/services/Boundaries/wv_protected_lands/MapServer/12", mapServiceUrl: "https://services.wvgis.wvu.edu/ArcGIS/rest/services/Boundaries/wv_protected_lands/MapServer", mapServiceLayerId: 12, screen: true, map: true, fields: ["unit_nm", "loc_own"] },
    { name: "TNC Nature Preserves", longName: "NEPA\\screening\\Protected Lands\\Other Protected Lands\\TNC Nature Preserves", source: "https://services.wvgis.wvu.edu/ArcGIS/rest/services/Boundaries/wv_protected_lands/MapServer/14", mapServiceUrl: "https://services.wvgis.wvu.edu/ArcGIS/rest/services/Boundaries/wv_protected_lands/MapServer", mapServiceLayerId: 14, screen: true, map: true, fields: ["unit_nm"] },
    { name: "Private Protected Lands", longName: "NEPA\\screening\\Protected Lands\\Other Protected Lands\\Private Protected Lands", source: "https://services.wvgis.wvu.edu/ArcGIS/rest/services/Boundaries/wv_protected_lands/MapServer/16", mapServiceUrl: "https://services.wvgis.wvu.edu/ArcGIS/rest/services/Boundaries/wv_protected_lands/MapServer", mapServiceLayerId: 16, screen: true, map: true, fields: ["unit_nm", "loc_own"] },
    { name: "Easements", longName: "NEPA\\screening\\Protected Lands\\Other Protected Lands\\Easements", source: "https://services.wvgis.wvu.edu/ArcGIS/rest/services/Boundaries/wv_protected_lands/MapServer/15", mapServiceUrl: "https://services.wvgis.wvu.edu/ArcGIS/rest/services/Boundaries/wv_protected_lands/MapServer", mapServiceLayerId: 15, screen: true, map: true, fields: ["d_Des_Tp"] },
    { name: "USFWS", longName: "NEPA\\screening\\Protected Lands\\Federal Protected Lands\\USFWS", source: "https://services.wvgis.wvu.edu/ArcGIS/rest/services/Boundaries/wv_protected_lands/MapServer/3", mapServiceUrl: "https://services.wvgis.wvu.edu/ArcGIS/rest/services/Boundaries/wv_protected_lands/MapServer", mapServiceLayerId: 3, screen: true, map: true, fields: ["unit_nm"] },
    { name: "USACE", longName: "NEPA\\screening\\Protected Lands\\Federal Protected Lands\\USACE", source: "https://services.wvgis.wvu.edu/ArcGIS/rest/services/Boundaries/wv_protected_lands/MapServer/4", mapServiceUrl: "https://services.wvgis.wvu.edu/ArcGIS/rest/services/Boundaries/wv_protected_lands/MapServer", mapServiceLayerId: 4, screen: true, map: true, fields: ["unit_nm"] },
    { name: "FS Admin Limit", longName: "NEPA\\screening\\Protected Lands\\Federal Protected Lands\\FS Admin Limit", source: "https://services.arcgis.com/v01gqwM5QqNysAAi/arcgis/rest/services/USFS_Boundaries/FeatureServer/17", screen: true, map: true, fields: ["forestname"] },
    { name: "NPS Admin Limit", longName: "NEPA\\screening\\Protected Lands\\Federal Protected Lands\\NPS Admin Limit", source: "https://carto.nationalmap.gov/arcgis/rest/services/govunits/MapServer/29", screen: true, map: true, mapAsVector: true, fields: ["name"] },
    { name: "High Box Turt Habitat", mapLabel: "High Box Turt Habitat (Symbology)", longName: "NEPA\\Symbology Layers\\High Box Turt Habitat", source: "DRIVE_GEOJSON:REPLACE_WITH_BOX_TURTLE_HABITAT_SYMBOLOGY_GEOJSON_FILE_ID", screen: false, map: true },
    { name: "Box Turtle Habitat", mapLabel: "Box Turtle Habitat (Symbology)", longName: "NEPA\\Symbology Layers\\Box Turtle Habitat", source: "DRIVE_GEOJSON:REPLACE_WITH_BOX_TURTLE_HABITAT_SYMBOLOGY_GEOJSON_FILE_ID", screen: false, map: true },
    { name: "Hibernacula", mapLabel: "Hibernacula (Symbology)", longName: "NEPA\\Symbology Layers\\Hibernacula", source: "DRIVE_GEOJSON:REPLACE_WITH_HIBERNACULA_SYMBOLOGY_GEOJSON_FILE_ID", screen: false, map: true },
    { name: "Bat Roosts", mapLabel: "Bat Roosts (Symbology)", longName: "NEPA\\Symbology Layers\\Bat Roosts", source: "DRIVE_GEOJSON:REPLACE_WITH_BAT_ROOSTS_SYMBOLOGY_GEOJSON_FILE_ID", screen: false, map: true },
    { name: "Bat Captures", mapLabel: "Bat Captures (Symbology)", longName: "NEPA\\Symbology Layers\\Bat Captures", source: "DRIVE_GEOJSON:REPLACE_WITH_BAT_CAPTURES_SYMBOLOGY_GEOJSON_FILE_ID", screen: false, map: true }
  ],
  historicLayerNames: ["Architectural Point", "National Register Point", "Cemeteries Point", "Architectural Poly", "National Register Poly", "Cemeteries Poly", "USGS Cemeteries"],
  detailFields: {
    "USACE_Districts": ["district"],
    "County": ["county_name"],
    "Quarter Quad": ["CELL_NAME"],
    "HUC 8 Watersheds": ["watershed"],
    "HUC 10 and 12 Watersheds": ["hu_10_name", "hu_12_name"],
    "Impaired Streams": ["assessmentunitname"],
    "Impaired Waterbodies": ["assessmentunitname"],
    "Federal Wetlands": ["wetland_type", "system_name"],
    "WVDEP Wetlands": ["wetland_type"],
    "Comm Nav Streams": ["rivername"],
    "Fed Aid Routes": ["route_id", "fas_type"],
    "Airport Footprints": ["name"],
    "LWCF_Projects": ["unique_id", "program", "title", "desc_", "type_", "year_fund", "unit_name"],
    "buff_LWCF_Projects": ["unique_id", "title"],
    "High Box Turt Habitat": ["pixelValue"],
    "Wildlife Management Area": ["unit_nm", "loc_own"],
    "State Wildlife Sanctuary": ["unit_nm", "loc_own"],
    "State Wildlife Center": ["unit_nm", "loc_own"],
    "State Park": ["unit_nm"],
    "State Forest": ["unit_nm"],
    "State Nature Area": ["unit_nm"],
    "Protected Local Lands": ["unit_nm", "loc_own"],
    "TNC Nature Preserves": ["unit_nm"],
    "Private Protected Lands": ["unit_nm", "loc_own"],
    "Easements": ["d_Des_Tp"],
    "USFWS": ["unit_nm"],
    "USACE": ["unit_nm"],
    "FS Admin Limit": ["forestname"],
    "NPS Admin Limit": ["name"],
    "Federal Land Access": ["locname", "federal_land_access"]
  },
  colors: ["#2E86AB", "#F18F01", "#6A994E", "#C73E1D", "#6D597A", "#0081A7", "#BC6C25", "#7B2CBF", "#3A7D44", "#D1495B", "#386641", "#577590", "#A23B72", "#4D908E", "#F3722C", "#5C677D", "#9C6644", "#3D5A80"]
};

function getNepaLayer(name) {
  for (var i = 0; i < NEPA_CONFIG.layers.length; i++) {
    if (NEPA_CONFIG.layers[i].name === name) return NEPA_CONFIG.layers[i];
  }
  return null;
}

var NEPA_MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

function doGet() {
  return HtmlService.createHtmlOutputFromFile("Index")
    .setTitle("NEPA Environmental Screening");
}

async function runNepaScreeningWeb(formData) {
  if (!formData || typeof formData !== "object") throw new Error("The upload form did not provide project information.");
  var fileName = String(formData.fileName || "");
  var projectName = String(formData.projectName || "").trim();
  var stateProjectNumber = String(formData.stateProjectNumber || "").trim();
  var federalProjectNumber = String(formData.federalProjectNumber || "").trim();
  var fileBase64 = String(formData.fileBase64 || "");
  if (!projectName) throw new Error("Enter a project name.");
  if (!stateProjectNumber) throw new Error("Enter a state project number.");
  if (projectName.length > 200 || stateProjectNumber.length > 80 || federalProjectNumber.length > 80) {
    throw new Error("Project name and project numbers must be within their maximum lengths.");
  }
  if (!/\.kml$|\.kmz$/i.test(fileName)) throw new Error("Choose a .kml or .kmz file.");
  if (!fileBase64 || fileBase64.length > Math.ceil(NEPA_MAX_UPLOAD_BYTES * 4 / 3) + 16) {
    throw new Error("The upload is empty or exceeds the 10 MiB file limit.");
  }
  var fileBytes;
  try {
    fileBytes = Utilities.base64Decode(fileBase64);
  } catch (error) {
    throw new Error("The uploaded file could not be decoded: " + (error.message || error));
  }
  if (!fileBytes.length || fileBytes.length > NEPA_MAX_UPLOAD_BYTES) {
    throw new Error("The upload is empty or exceeds the 10 MiB file limit.");
  }

  var contentType = /\.kml$/i.test(fileName) ? "application/vnd.google-earth.kml+xml" : "application/vnd.google-earth.kmz";
  var blob = Utilities.newBlob(fileBytes, contentType, fileName);
  return runNepaScreening({
    uploadBlob: blob,
    fileName: fileName,
    projectName: projectName,
    stateProjectNumber: stateProjectNumber,
    federalProjectNumber: federalProjectNumber
  });
}

async function runNepaScreening(request) {
  request = request || {};
  if (typeof request === "string") request = { kmzFileId: request };
  var project;
  var boundaryProcessing;
  if (request.preparedProjectGeoJson) {
    var preparedProject = normalizePreparedEczGeoJson(request.preparedProjectGeoJson);
    project = preparedProject.project;
    boundaryProcessing = preparedProject.boundaryProcessing;
  } else if (request.projectGeoJson) {
    var prepared = prepareEczBoundary(request.projectGeoJson);
    project = prepared;
    boundaryProcessing = prepared.boundaryProcessing;
  } else {
    var input = request.uploadBlob || request.kmzBlob || request.kmzFileId || NEPA_CONFIG.inputKmzFileId;
    if (typeof input === "string" && /^REPLACE_WITH_/.test(input)) {
      throw new Error("Provide a KML/KMZ file upload or a Drive file ID.");
    }
    var kmlText = request.kmlText || extractKmlFromKmz(input);
    var rawFeatureCollection = kmlToGeoJson(kmlText);
    var boundary = prepareEczBoundary(rawFeatureCollection);
    project = boundary;
    boundaryProcessing = boundary.boundaryProcessing;
    (rawFeatureCollection.conversionWarnings || []).forEach(function(warning) {
      boundaryProcessing.warnings.push("KML conversion: " + warning);
    });
  }

  var projectName = request.projectName || NEPA_CONFIG.projectName;
  var analysis;
  try {
    analysis = await analyzeNepaProject(project);
  } catch (error) {
    var analysisIssue = createNepaProcessIssue(
      "Screening analysis",
      error,
      "Configured NEPA layer sources in Main.gs and Screening.gs",
      "ERROR"
    );
    var fallbackResults = [analysisIssue];
    var fallbackMetadata = null;
    try {
      fallbackMetadata = summarizeProject(project, []);
    } catch (metadataError) {
      fallbackResults.push(createNepaProcessIssue(
        "Project metadata",
        metadataError,
        "Normalized project boundary geometry",
        "ERROR"
      ));
    }
    analysis = {
      project: project,
      results: fallbackResults,
      metadata: fallbackMetadata
    };
  }
  analysis.projectName = projectName;
  analysis.stateProjectNumber = request.stateProjectNumber || NEPA_CONFIG.stateProjectNumber;
  analysis.federalProjectNumber = request.federalProjectNumber || NEPA_CONFIG.federalProjectNumber;
  analysis.projectType = request.projectType || NEPA_CONFIG.projectType;
  analysis.userEmail = request.userEmail || "";
  analysis.boundaryProcessing = boundaryProcessing;
  var outputFolderId = request.outputFolderId || NEPA_CONFIG.outputFolderId;
  var projectFolder = null;
  if (!outputFolderId && analysis.stateProjectNumber) {
    try {
      projectFolder = createNepaProjectFolder(analysis.stateProjectNumber, NEPA_CONFIG.parentFolderId);
      outputFolderId = projectFolder.id;
    } catch (error) {
      boundaryProcessing.warnings.push("Project folder was not created: " + (error.message || String(error)));
      Logger.log("Project folder error: " + (error.message || error));
    }
  }

  var postReportIssues = [];
  if (isShortSpanProjectType(analysis.projectType)) {
    try {
      analysis.shortSpans = getShortSpanData(project, findResultByName(analysis.results, "Bridge"));
    } catch (error) {
      analysis.shortSpans = [];
      postReportIssues.push(createNepaProcessIssue(
        "Short span lookup", error, "short_spans tab of the Bridge workbook", "WARNING"
      ));
    }
  }
  var shapefile = null;
  try {
    shapefile = createNepaShapefileZip(project, projectName, outputFolderId);
  } catch (error) {
    boundaryProcessing.warnings.push("Shapefile ZIP was not created: " + (error.message || String(error)));
    Logger.log("Shapefile ZIP error: " + (error.message || error));
  }
  analysis.shapefile = shapefile;

  var map;
  try {
    map = await createNepaSlidesMap(analysis, outputFolderId);
  } catch (error) {
    var mapIssue = createNepaProcessIssue(
      "Slides map generation",
      error,
      "Google Slides service, the template configured in Main.gs, and the output Drive folder",
      "WARNING"
    );
    map = { id: "", url: "", name: "", warnings: [mapIssue] };
  }
  var reportResults = analysis.results.slice();
  map.warnings.forEach(function(warning) { analysis.results.push(warning); });
  var report = null;
  try {
    var reportAnalysis = Object.assign({}, analysis, { results: reportResults });
    report = createNepaGoogleDoc(reportAnalysis, outputFolderId);
  } catch (error) {
    analysis.results.push(createNepaProcessIssue(
      "Google Docs report generation",
      error,
      "Google Docs service and the output Drive folder",
      "ERROR"
    ));
  }

  postReportIssues.forEach(function(issue) { analysis.results.push(issue); });
  var abbreviatedReport = null;
  var pdfs = [];
  function recordPdfStep(label, step) {
    try {
      return step();
    } catch (error) {
      analysis.results.push(createNepaProcessIssue(
        label, error, "Google Docs/Drive services and the output Drive folder", "WARNING"
      ));
      return null;
    }
  }
  if (report) {
    abbreviatedReport = recordPdfStep("Abbreviated report generation", function() {
      return createNepaAbbreviatedDoc(Object.assign({}, analysis, { results: reportResults }), outputFolderId);
    });
  }
  [["Report PDF", report], ["Abbreviated report PDF", abbreviatedReport], ["Map PDF", map && map.id ? map : null]]
    .forEach(function(entry) {
      if (!entry[1]) return;
      var pdf = recordPdfStep(entry[0], function() {
        return exportNepaFileAsPdf(entry[1], outputFolderId);
      });
      if (pdf) pdfs.push(pdf);
    });

  var output = {
    report: report,
    map: map,
    screenedLayerCount: reportResults.length,
    errorCount: analysis.results.filter(function(result) { return result.status === "ERROR"; }).length,
    mapWarningCount: map.warnings.length,
    issues: analysis.results.filter(function(result) {
      return result.status === "ERROR" || result.status === "WARNING";
    }).map(function(result) {
      return {
        name: result.name,
        displayName: result.displayName || result.name,
        status: result.status,
        error: result.error || "",
        expectedLocation: result.expectedLocation || ""
      };
    }),
    shapefile: shapefile,
    projectFolder: projectFolder,
    abbreviatedReport: abbreviatedReport,
    pdfs: pdfs,
    boundaryProcessing: boundaryProcessing
  };
  Logger.log("NEPA screening process completed. Report: " +
    (report ? report.url : "not created") + " Map: " + (map.url || "not created"));
  return output;
}

function normalizePreparedEczGeoJson(input) {
  var featureCollection;
  if (input && input.type === "FeatureCollection" &&
      Array.isArray(input.features)) {
    featureCollection = input;
  } else if (input && input.type === "Feature") {
    featureCollection = { type: "FeatureCollection", features: [input] };
  } else if (input && typeof input.type === "string" &&
      input.type !== "FeatureCollection" && input.type !== "Feature") {
    featureCollection = {
      type: "FeatureCollection",
      features: [{ type: "Feature", properties: {}, geometry: input }]
    };
  } else {
    throw new Error("The submitted preprocessed ECZ must be a GeoJSON Feature, FeatureCollection, or Geometry.");
  }
  if (!featureCollection.features.length) {
    throw new Error("The submitted preprocessed ECZ contains no features.");
  }
  featureCollection.features.forEach(function(feature, index) {
    if (!feature || feature.type !== "Feature" || !feature.geometry ||
        typeof feature.geometry.type !== "string") {
      throw new Error("Preprocessed ECZ feature " + (index + 1) +
        " must be a GeoJSON Feature with a geometry.");
    }
  });
  var geometryTypes = uniqueValues(featureCollection.features.map(function(feature) {
    return feature.geometry.type;
  }));
  return {
    project: featureCollection,
    boundaryProcessing: {
      sourceFeatureCount: featureCollection.features.length,
      selectedFeatureCount: featureCollection.features.length,
      selectedNames: featureCollection.features.map(function(feature, index) {
        var properties = feature.properties || {};
        return properties.name || "Feature " + (index + 1);
      }),
      selectionRule: "Preprocessed GeoJSON ECZ supplied by the submission sheet",
      inputGeometryTypes: geometryTypes,
      outputGeometryType: geometryTypes.join(", "),
      processingSteps: ["Used the supplied GeoJSON without ECZ selection or geometry repair."],
      warnings: []
    }
  };
}

function createNepaProcessIssue(phase, error, expectedLocation, status) {
  var message = error && error.message ? String(error.message) : String(error);
  var issue = {
    name: "Process - " + phase,
    displayName: phase,
    status: status,
    features: [],
    error: message,
    expectedLocation: expectedLocation
  };
  Logger.log("NEPA process " + status.toLowerCase() + " during " + phase +
    " (expected at " + expectedLocation + "): " + message);
  return issue;
}

function runNepaScreeningFromDrive() {
  return runNepaScreening();
}
