
/**
 * STREAMING_CHUNK:Initializing WVDOH Automated Map Layout Generation Engine...
 */

// GeoJSON representation for Hite-Saunders Elementary School (Huntington, WV)
const ecz = {
  "type": "FeatureCollection",
  "features": [
    {
      "type": "Feature",
      "properties": {
        "name": "Hite-Saunders Elementary School",
        "address": "3708 Green Valley Rd, Huntington, WV 25701",
        "county": "Cabell"
      },
      "geometry": {
        "type": "Polygon",
        "coordinates": [
          [
            [-82.37765, 38.38225],
            [-82.37635, 38.38225],
            [-82.37635, 38.38135],
            [-82.37765, 38.38135],
            [-82.37765, 38.38225]
          ]
        ]
      }
    }
  ]
};

/**
 * STREAMING_CHUNK:Defining test execution entry point...
 */
function testHiteSaundersMapGeneration() {
  var projectName = "Hite-Saunders Elementary Improvements";
  var projectNumber = "S306-HS-2026.00";
  var projectCounty = ecz.features[0].properties.county || "Cabell";

  var geoJsonCoords = ecz.features[0].geometry.coordinates[0];

  Logger.log("Generating Map Series for: " + projectName);
  Logger.log("Calculated Centroid: " + JSON.stringify(calculateGeoJsonCentroid(geoJsonCoords)));

  generateMapSeries1(projectName, projectNumber, projectCounty, geoJsonCoords);
  generateMapSeries2(projectName, projectNumber, projectCounty, geoJsonCoords);

  Logger.log("Test map generation completed successfully!");
}

/**
 * STREAMING_CHUNK:Configuring custom presentation dimensions via Slides API...
 */
function createCustomSizedPresentation(title, widthInches, heightInches) {
  var presentation = SlidesApp.create(title);
  var presentationId = presentation.getId();

  var widthEmu = widthInches * 914400;   // 7.5" = 6,858,000 EMU
  var heightEmu = heightInches * 914400; // 10.0" = 9,144,000 EMU

  var resource = {
    requests: [
      {
        updatePageProperties: {
          objectId: presentation.getSlides()[0].getObjectId(),
          pageProperties: {
            pageSize: {
              width: { magnitude: widthEmu, unit: 'EMU' },
              height: { magnitude: heightEmu, unit: 'EMU' }
            }
          },
          fields: 'pageSize'
        }
      }
    ]
  };

  try {
    Slides.Presentations.batchUpdate(resource, presentationId);
  } catch (e) {
    Logger.log("Notice on page sizing via Slides API: " + e.message);
  }

  return presentation;
}

// ==========================================
// MAP SERIES 1 GENERATOR (Scale 1:15,000)
// ==========================================
/**
 * STREAMING_CHUNK:Defining Map Series 1 build flow...
 */
function generateMapSeries1(projectName, projectNumber, projectCounty, geoJsonCoords) {
  var projectCentroid = calculateGeoJsonCentroid(geoJsonCoords);
  var presentation = createCustomSizedPresentation("Map Series 1 - Topo & Vicinity", 7.5, 10.0);
  var bbox = getBoundingBoxForScale(projectCentroid, 15000, 7.5, 8.7);

  var mapConfigs = [
    { 
      name: "Topography", 
      displayName: "Topography Overview",
      serviceUrl: "https://basemap.nationalmap.gov/arcgis/rest/services/USGSTopo/MapServer/export" 
    },
    { 
      name: "Vicinity", 
      displayName: "Vicinity Overview",
      serviceUrl: "https://gis.transportation.wv.gov/arcgis/rest/services/ROW/ROWLite/MapServer/export" 
    }
  ];

  for (var i = 0; i < mapConfigs.length; i++) {
    var slide = (i === 0) ? presentation.getSlides()[0] : presentation.appendSlide();
    buildSeries1Sheet(slide, bbox, projectCentroid, geoJsonCoords, mapConfigs[i], projectName, projectNumber, projectCounty);
  }
}

/**
 * STREAMING_CHUNK:Rendering individual Map Series 1 sheets...
 */
function buildSeries1Sheet(slide, bbox, centroid, coords, config, projName, projNum, county) {
  var widthPt = 7.5 * 72;
  var mapH = 8.7 * 72;

  var exportUrl = config.serviceUrl +
    "?bbox=" + bbox.join(",") +
    "&bboxSR=4326" +
    "&size=1080,1252" + 
    "&format=png32" +
    "&f=image";

  var mapBlob = UrlFetchApp.fetch(exportUrl).getBlob();
  slide.insertImage(mapBlob).setLeft(0).setTop(0).setWidth(widthPt).setHeight(mapH);

  if (coords) {
    drawProjectBoundaryOnSlide(slide, coords, bbox, widthPt, mapH);
  }

  drawScaleBarStrip(slide, "1\" = 1,250' (1:15,000)");
  buildFooterLayout(slide, config.displayName, projName, projNum, county);
}

// ==========================================
// MAP SERIES 2 GENERATOR (Environmental & Assets)
// ==========================================
/**
 * STREAMING_CHUNK:Defining Map Series 2 build flow...
 */
function generateMapSeries2(projectName, projectNumber, projectCounty, geoJsonCoords) {
  var projectAreaBbox = calculateGeoJsonBbox(geoJsonCoords);
  var bbox = calculateSeries2Bbox(projectAreaBbox, 7.5, 8.7);
  var presentation = createCustomSizedPresentation("Map Series 2 - Environmental & Utilities", 7.5, 10.0);

  var mapConfigs = [
    { name: "Topography", displayName: "Topography Overview", baseType: "topo", layerUrl: null },
    { name: "Aerial", displayName: "Aerial Overview", baseType: "aerial", layerUrl: null },
    { name: "Flood zones", displayName: "Flood zones Overview", baseType: "aerial", layerUrl: "https://services.wvgis.wvu.edu/arcgis/rest/services/Hazards/floodTool_publicView/MapServer/1", isFlood: true },
    { 
      name: "Utility", 
      displayName: "Utility Overview", 
      baseType: "aerial", 
      isUtility: true,
      utilityUrls: [
        "https://services.wvgis.wvu.edu/arcgis/rest/services/Utilities_Communication/WV_WaterSewer_WVWDA/MapServer/2",
        "https://services.wvgis.wvu.edu/arcgis/rest/services/Utilities_Communication/WV_WaterSewer_WVWDA/MapServer/3",
        "https://gis.transportation.wv.gov/arcgis/rest/services/Assets/Assets/FeatureServer/59",
        "https://gis.transportation.wv.gov/arcgis/rest/services/Assets/Assets/FeatureServer/60",
        "https://gis.transportation.wv.gov/arcgis/rest/services/Assets/Assets/FeatureServer/63",
        "https://gis.transportation.wv.gov/arcgis/rest/services/Assets/Assets/FeatureServer/64"
      ]
    },
    { name: "Geology", displayName: "Geology Overview", baseType: "aerial", layerUrl: "https://services.wvgis.wvu.edu/arcgis/rest/services/Hazards/Landslide_Model_Inputs/MapServer/2", labelField: "MAPUNIT", transparent: true },
    { name: "Soil", displayName: "Soil Overview", baseType: "aerial", layerUrl: "https://services.wvgis.wvu.edu/arcgis/rest/services/Hazards/Landslide_Model_Inputs/MapServer/3", labelField: "MUKEY", transparent: true }
  ];

  for (var i = 0; i < mapConfigs.length; i++) {
    var slide = (i === 0) ? presentation.getSlides()[0] : presentation.appendSlide();
    buildSeries2Sheet(slide, bbox, geoJsonCoords, mapConfigs[i], projectName, projectNumber, projectCounty);
  }
}

/**
 * STREAMING_CHUNK:Rendering individual Map Series 2 sheets with thematic layers...
 */
function buildSeries2Sheet(slide, bbox, projectCoords, config, projName, projNum, county) {
  var widthPt = 7.5 * 72;
  var mapH = 8.7 * 72;

  var baseServiceUrl = (config.baseType === "topo")
    ? "https://basemap.nationalmap.gov/arcgis/rest/services/USGSTopo/MapServer/export"
    : "https://services.wvgis.wvu.edu/arcgis/rest/services/Imagery_BaseMaps_EarthCover/wv_imagery_WVGISTC_leaf_off_mosaic/MapServer/export";

  var baseExportUrl = baseServiceUrl + "?bbox=" + bbox.join(",") + "&bboxSR=4326&size=1080,1252&format=png&f=image";
  var basemapBlob = UrlFetchApp.fetch(baseExportUrl).getBlob();
  slide.insertImage(basemapBlob).setLeft(0).setTop(0).setWidth(widthPt).setHeight(mapH);

  var visibleFeatures = [{ code: "Project Boundary", color: "#800080", isOutlineOnly: true }];

  if (config.isFlood) {
    var features = fetchArcGISFeatures(config.layerUrl, bbox);
    for (var f = 0; f < features.length; f++) {
      var props = features[f].attributes || {};
      var symb = getFloodplainSymbology(props.FLD_ZONE, props.ZONE_SUBTY);
      if (!symb) continue;

      visibleFeatures.push({ code: symb.label, color: symb.color, isHatching: !symb.isSolid });
      if (features[f].geometry && features[f].geometry.rings) {
        drawFloodPolygonOnSlide(slide, features[f].geometry.rings[0], bbox, widthPt, mapH, symb);
      }
    }
  } else if (config.isUtility) {
    for (var u = 0; u < config.utilityUrls.length; u++) {
      var utilFeatures = fetchArcGISFeatures(config.utilityUrls[u], bbox);
      for (var uf = 0; uf < utilFeatures.length; uf++) {
        if (utilFeatures[uf].geometry && utilFeatures[uf].geometry.paths) {
          drawPolylineOnSlide(slide, utilFeatures[uf].geometry.paths, bbox, widthPt, mapH, "#0055FF");
        }
      }
    }
    visibleFeatures.push({ code: "Utility Assets", color: "#0055FF" });
  } else if (config.layerUrl) {
    var features = fetchArcGISFeatures(config.layerUrl, bbox);
    for (var f = 0; f < features.length; f++) {
      var props = features[f].attributes || {};
      var labelVal = String(props[config.labelField] || props.LABEL || props.MUNAME || "Unit");
      var unitColor = (config.labelField === "MAPUNIT") ? getColorForMapUnit(labelVal) : getColorForMukey(labelVal);

      visibleFeatures.push({ code: labelVal, color: unitColor });

      if (features[f].geometry && features[f].geometry.rings) {
        drawPolygonOnSlide(slide, features[f].geometry.rings[0], bbox, widthPt, mapH, unitColor, config.transparent, labelVal);
      }
    }
  }

  if (projectCoords) {
    drawProjectBoundaryOnSlide(slide, projectCoords, bbox, widthPt, mapH);
  }

  buildFullWidthLegend(slide, visibleFeatures, config.name, 0, mapH - (1.25 * 72), widthPt, 1.25 * 72);
  drawScaleBarStrip(slide, "SCALE: Variable");
  buildFooterLayout(slide, config.displayName, projName, projNum, county);
}

// ==========================================
// FLOODPLAIN SYMBOLOGY RULES
// ==========================================
/**
 * STREAMING_CHUNK:Defining floodplain symbology rules...
 */
function getFloodplainSymbology(fldZone, zoneSubty) {
  var zone = (fldZone || "").trim().toUpperCase();
  var subType = (zoneSubty || "").trim().toUpperCase();

  if (zone === "AE" && subType === "FLOODWAY") {
    return {
      label: "Floodway",
      color: "#E60000",
      style: "HATCH_DIAGONAL",
      outlineColor: "#FFFFFF",
      outlineWeight: 1,
      isSolid: false
    };
  }

  var hazardZones = ["A", "AE", "AH", "AO"];
  if (hazardZones.indexOf(zone) !== -1) {
    return {
      label: "Flood Hazard Zone",
      color: "#E60000",
      style: "SOLID",
      outlineColor: null,
      outlineWeight: 0,
      isSolid: true
    };
  }

  return null;
}

// ==========================================
// COLOR PALETTES FOR GEOLOGY & SOILS
// ==========================================
/**
 * STREAMING_CHUNK:Defining color palette mapping functions...
 */
function getColorForMapUnit(mapUnit) {
  if (!mapUnit) return "#A0A0A0";
  var geologicalPalette = {
    "Pcb": "#FFD700", "Pma": "#FFA07A", "Ppo": "#D2691E",
    "Mm": "#4682B4", "Mgr": "#87CEFA", "Mpoc": "#B0C4DE",
    "Dch": "#9370DB", "Db": "#8A2BE2"
  };
  if (geologicalPalette[mapUnit]) return geologicalPalette[mapUnit];

  var hash = 0;
  for (var i = 0; i < mapUnit.length; i++) hash = mapUnit.charCodeAt(i) + ((hash << 5) - hash);
  var color = '#';
  for (var c = 0; c < 3; c++) color += ('00' + ((hash >> (c * 8)) & 0xFF).toString(16)).substr(-2);
  return color;
}

function getColorForMukey(mukey) {
  if (!mukey) return "#C0C0C0";
  var soilPalette = {
    "101": "#D2691E", "102": "#CD853F", "103": "#F4A460", "104": "#DEB887", "105": "#BC8F8F"
  };
  if (soilPalette[mukey]) return soilPalette[mukey];

  var hash = 0, strKey = String(mukey);
  for (var i = 0; i < strKey.length; i++) hash = strKey.charCodeAt(i) + ((hash << 5) - hash);
  var color = '#';
  for (var c = 0; c < 3; c++) color += ('00' + ((hash >> (c * 8)) & 0xFF).toString(16)).substr(-2);
  return color;
}

// ==========================================
// HELPER COMPONENT & MATH FUNCTIONS
// ==========================================
/**
 * STREAMING_CHUNK:Defining geometric helpers and rendering utilities...
 */
function calculateGeoJsonCentroid(coords) {
  if (!coords || coords.length === 0) return [-79.95, 39.63];
  var sumLng = 0, sumLat = 0, count = coords.length;
  for (var i = 0; i < count; i++) {
    sumLng += coords[i][0];
    sumLat += coords[i][1];
  }
  return [Number((sumLng / count).toFixed(6)), Number((sumLat / count).toFixed(6))];
}

function calculateGeoJsonBbox(coords) {
  if (!coords || coords.length === 0) return [-79.955, 39.625, -79.945, 39.635];
  var minLng = coords[0][0], maxLng = coords[0][0];
  var minLat = coords[0][1], maxLat = coords[0][1];
  for (var i = 1; i < coords.length; i++) {
    if (coords[i][0] < minLng) minLng = coords[i][0];
    if (coords[i][0] > maxLng) maxLng = coords[i][0];
    if (coords[i][1] < minLat) minLat = coords[i][1];
    if (coords[i][1] > maxLat) maxLat = coords[i][1];
  }
  return [minLng, minLat, maxLng, maxLat];
}

function drawScaleBarStrip(slide, scaleText) {
  var widthPt = 7.5 * 72;
  var mapH = 8.7 * 72;
  var scaleH = 0.15 * 72;

  var scaleBg = slide.insertShape(SlidesApp.ShapeType.RECTANGLE, 0, mapH, widthPt, scaleH);
  scaleBg.getFill().setSolidFill("#F0F0F0");
  scaleBg.getBorder().getLineFill().setSolidFill("#000000");

  var txt = slide.insertTextBox(scaleText, 10, mapH - 3, 250, scaleH);
  txt.getText().getTextStyle().setFontSize(7).setBold(true).setFontFamily("Arial");
}

function buildFooterLayout(slide, mapOverviewTitle, projectName, projectNumber, projectCounty) {
  var widthPt = 7.5 * 72;
  var mapH = 8.7 * 72;
  var scaleH = 0.15 * 72;
  var footerH = 1.15 * 72;
  var footerY = mapH + scaleH; 

  var neatLine = slide.insertShape(SlidesApp.ShapeType.RECTANGLE, 0, 0, widthPt, mapH + scaleH + footerH);
  neatLine.getFill().setTransparent();
  neatLine.getBorder().getLineFill().setSolidFill("#000000");
  neatLine.getBorder().setWeight(1.5);

  var footerBox = slide.insertShape(SlidesApp.ShapeType.RECTANGLE, 0, footerY, widthPt, footerH);
  footerBox.getFill().setSolidFill("#FFFFFF");
  footerBox.getBorder().getLineFill().setSolidFill("#000000");

  var logoUrl = "https://gis.transportation.wv.gov/files/Logos/WVDOH.png";
  var logoBlob = UrlFetchApp.fetch(logoUrl).getBlob();
  var logoImage = slide.insertImage(logoBlob);

  var padding = 4;
  var logoMaxH = footerH - (padding * 2);
  var logoW = (logoImage.getWidth() / logoImage.getHeight()) * logoMaxH;
  logoImage.setLeft(padding).setTop(footerY + padding).setWidth(logoW).setHeight(logoMaxH);

  var leftLineX = Math.max(logoW + (padding * 2), 90);
  var leftVLine = slide.insertLine(SlidesApp.LineCategory.STRAIGHT, leftLineX, footerY, leftLineX, footerY + footerH);
  leftVLine.getLineFill().setSolidFill("#000000");

  var rightSectionW = 150;
  var rightLineX = widthPt - rightSectionW;

  var rightVLine = slide.insertLine(SlidesApp.LineCategory.STRAIGHT, rightLineX, footerY, rightLineX, footerY + footerH);
  rightVLine.getLineFill().setSolidFill("#000000");

  buildCountyInset(slide, projectCounty, rightLineX + 5, footerY + 5, 85, footerH - 10);

  var labelBox = slide.insertTextBox(projectCounty.toUpperCase() + " CO., WV", rightLineX + 90, footerY + 12, 55, 25);
  labelBox.getFill().setTransparent();
  labelBox.getText().getTextStyle().setFontSize(7).setBold(true).setFontFamily("Arial");

  drawNorthArrow(slide, rightLineX + 105, footerY + 38, 20, 32);

  var centerTextX = leftLineX + 10;
  var centerTextW = (rightLineX - 10) - centerTextX;

  var infoBox = slide.insertTextBox("", centerTextX, footerY + 6, centerTextW, footerH - 12);
  infoBox.getFill().setTransparent();
  
  var infoText = infoBox.getText();
  var fullText = (projectName || "Project Name") + "\n" +
                 (projectNumber || "Project Number") + "\n" +
                 mapOverviewTitle;
                 
  infoText.setText(fullText);

  var paragraphs = infoText.getParagraphs();
  if (paragraphs.length > 0) paragraphs[0].getRange().getTextStyle().setFontSize(10).setBold(true).setFontFamily("Arial");
  if (paragraphs.length > 1) paragraphs[1].getRange().getTextStyle().setFontSize(9).setBold(false).setFontFamily("Arial");
  if (paragraphs.length > 2) paragraphs[2].getRange().getTextStyle().setFontSize(10).setBold(true).setFontFamily("Arial");
}

function fetchArcGISFeatures(serviceUrl, bbox) {
  var queryUrl = serviceUrl + "/query" +
    "?geometry=" + bbox.join(",") +
    "&geometryType=esriGeometryEnvelope" +
    "&inSR=4326" +
    "&spatialRel=esriSpatialRelIntersects" +
    "&outFields=*" +
    "&returnGeometry=true" +
    "&outSR=4326" +
    "&f=json";

  try {
    var response = UrlFetchApp.fetch(queryUrl);
    var json = JSON.parse(response.getContentText());
    return json.features || [];
  } catch (e) {
    return [];
  }
}

function drawProjectBoundaryOnSlide(slide, coords, bbox, mapWidth, mapHeight) {
  var minX = mapWidth, maxX = 0, minY = mapHeight, maxY = 0;
  for (var i = 0; i < coords.length; i++) {
    var pt = mapToSlidePixel(coords[i][0], coords[i][1], bbox, mapWidth, mapHeight);
    if (pt.x < minX) minX = pt.x;
    if (pt.x > maxX) maxX = pt.x;
    if (pt.y < minY) minY = pt.y;
    if (pt.y > maxY) maxY = pt.y;
  }

  var w = Math.max(maxX - minX, 5);
  var h = Math.max(maxY - minY, 5);

  var poly = slide.insertShape(SlidesApp.ShapeType.RECTANGLE, minX, minY, w, h);
  poly.getFill().setTransparent();
  poly.getBorder().getLineFill().setSolidFill("#800080");
  poly.getBorder().setWeight(3);
}

function drawPolygonOnSlide(slide, ring, bbox, mapWidth, mapHeight, color, isTransparent, labelText) {
  var minX = mapWidth, maxX = 0, minY = mapHeight, maxY = 0;
  for (var i = 0; i < ring.length; i++) {
    var pt = mapToSlidePixel(ring[i][0], ring[i][1], bbox, mapWidth, mapHeight);
    if (pt.x < minX) minX = pt.x;
    if (pt.x > maxX) maxX = pt.x;
    if (pt.y < minY) minY = pt.y;
    if (pt.y > maxY) maxY = pt.y;
  }

  var w = Math.max(maxX - minX, 5);
  var h = Math.max(maxY - minY, 5);

  var poly = slide.insertShape(SlidesApp.ShapeType.RECTANGLE, minX, minY, w, h);
  var alpha = isTransparent ? 0.65 : 1.0;
  poly.getFill().setSolidFill(color, alpha);
  poly.getBorder().getLineFill().setSolidFill(color);
  poly.getBorder().setWeight(1);
}

function drawFloodPolygonOnSlide(slide, ring, bbox, mapWidth, mapHeight, symb) {
  var minX = mapWidth, maxX = 0, minY = mapHeight, maxY = 0;
  for (var i = 0; i < ring.length; i++) {
    var pt = mapToSlidePixel(ring[i][0], ring[i][1], bbox, mapWidth, mapHeight);
    if (pt.x < minX) minX = pt.x;
    if (pt.x > maxX) maxX = pt.x;
    if (pt.y < minY) minY = pt.y;
    if (pt.y > maxY) maxY = pt.y;
  }

  var w = Math.max(maxX - minX, 2);
  var h = Math.max(maxY - minY, 2);

  var poly = slide.insertShape(SlidesApp.ShapeType.RECTANGLE, minX, minY, w, h);
  if (symb.isSolid) {
    poly.getFill().setSolidFill(symb.color);
    poly.getBorder().setTransparent();
  } else {
    poly.getFill().setSolidFill(symb.color, 0.85); 
    if (symb.outlineColor) {
      poly.getBorder().getLineFill().setSolidFill(symb.outlineColor);
      poly.getBorder().setWeight(symb.outlineWeight);
    }
  }
}

function drawPolylineOnSlide(slide, paths, bbox, mapWidth, mapHeight, color) {
  if (!paths) return;
  for (var p = 0; p < paths.length; p++) {
    var path = paths[p];
    for (var i = 0; i < path.length - 1; i++) {
      var pt1 = mapToSlidePixel(path[i][0], path[i][1], bbox, mapWidth, mapHeight);
      var pt2 = mapToSlidePixel(path[i+1][0], path[i+1][1], bbox, mapWidth, mapHeight);
      
      var line = slide.insertLine(SlidesApp.LineCategory.STRAIGHT, pt1.x, pt1.y, pt2.x, pt2.y);
      line.getLineFill().setSolidFill(color);
      line.setWeight(2);
    }
  }
}

function buildFullWidthLegend(slide, features, title, x, y, width, height) {
  var box = slide.insertShape(SlidesApp.ShapeType.RECTANGLE, x, y, width, height);
  box.getFill().setSolidFill("#FFFFFF", 0.50);
  box.getBorder().getLineFill().setSolidFill("#333333");

  var tBox = slide.insertTextBox(title + " Legend", x + 10, y + 2, 200, 16);
  tBox.getText().getTextStyle().setFontSize(8).setBold(true).setFontFamily("Arial");

  var unique = {};
  var items = [];
  for (var i = 0; i < features.length; i++) {
    if (!unique[features[i].code]) {
      unique[features[i].code] = true;
      items.push(features[i]);
    }
  }

  var cols = 3;
  var colWidth = width / cols;

  for (var j = 0; j < Math.min(items.length, 9); j++) {
    var col = j % cols;
    var row = Math.floor(j / cols);
    var itemX = x + 10 + (col * colWidth);
    var itemY = y + 20 + (row * 18);

    var swatch = slide.insertShape(SlidesApp.ShapeType.RECTANGLE, itemX, itemY, 12, 10);
    if (items[j].isOutlineOnly) {
      swatch.getFill().setTransparent();
      swatch.getBorder().getLineFill().setSolidFill(items[j].color);
      swatch.getBorder().setWeight(2);
    } else {
      swatch.getFill().setSolidFill(items[j].color);
    }

    var lbl = slide.insertTextBox(items[j].code, itemX + 16, itemY - 4, colWidth - 20, 16);
    lbl.getText().getTextStyle().setFontSize(7).setFontFamily("Arial");
  }
}

function drawNorthArrow(slide, x, y, width, height) {
  var arrow = slide.insertShape(SlidesApp.ShapeType.UP_ARROW, x, y, width, height);
  arrow.getFill().setSolidFill("#000000");
  arrow.getBorder().getLineFill().setSolidFill("#000000");

  var nBox = slide.insertTextBox("N", x - 2, y - 12, width + 4, 15);
  nBox.getFill().setTransparent();
  var nTxt = nBox.getText();
  nTxt.getTextStyle().setFontSize(8).setBold(true).setFontFamily("Arial");
  nTxt.getParagraphs()[0].getRange().getParagraphStyle().setParagraphAlignment(SlidesApp.ParagraphAlignment.CENTER);
}

/**
 * STREAMING_CHUNK:Building county inset map using county boundary ArcGIS REST export...
 */
function buildCountyInset(slide, targetCounty, x, y, width, height) {
  var wvBbox = [-82.64, 37.20, -77.72, 40.64];
  
  var countyServiceUrl = "https://services.wvgis.wvu.edu/arcgis/rest/services/Boundaries/WV_Counties/MapServer/export" +
    "?bbox=" + wvBbox.join(",") + 
    "&bboxSR=4326" + 
    "&size=300,300" + 
    "&format=png32" + 
    "&transparent=true" + 
    "&f=image";

  try {
    var insetBlob = UrlFetchApp.fetch(countyServiceUrl).getBlob();
    slide.insertImage(insetBlob).setLeft(x).setTop(y).setWidth(width).setHeight(height);
  } catch (e) {
    var fallback = slide.insertShape(SlidesApp.ShapeType.RECTANGLE, x, y, width, height);
    fallback.getFill().setSolidFill("#E0E0E0");
  }
}

function getBoundingBoxForScale(centroid, scale, widthInches, heightInches) {
  var centerLng = centroid[0], centerLat = centroid[1];
  var totalWidthMeters = (widthInches || 7.5) * 0.0254 * (scale || 15000);
  var totalHeightMeters = (heightInches || 8.7) * 0.0254 * (scale || 15000);

  var EARTH_RADIUS = 6378137;
  var latOffset = ((totalHeightMeters / 2) / EARTH_RADIUS) * (180 / Math.PI);
  var lngOffset = ((totalWidthMeters / 2) / (EARTH_RADIUS * Math.cos(centerLat * Math.PI / 180))) * (180 / Math.PI);

  return [
    Number((centerLng - lngOffset).toFixed(6)),
    Number((centerLat - latOffset).toFixed(6)),
    Number((centerLng + lngOffset).toFixed(6)),
    Number((centerLat + latOffset).toFixed(6))
  ];
}

function calculateSeries2Bbox(projBbox, widthInches, heightInches) {
  var centerLng = (projBbox[0] + projBbox[2]) / 2;
  var centerLat = (projBbox[1] + projBbox[3]) / 2;

  var bbox1500 = getBoundingBoxForScale([centerLng, centerLat], 1500, widthInches, heightInches);
  var projWidth = projBbox[2] - projBbox[0], projHeight = projBbox[3] - projBbox[1];
  var bbox2x = [centerLng - projWidth, centerLat - projHeight, centerLng + projWidth, centerLat + projHeight];

  var degreesToMeters = 111320 * Math.cos(centerLat * Math.PI / 180);
  var widthMeters2x = (bbox2x[2] - bbox2x[0]) * degreesToMeters;
  var scale2x = widthMeters2x / (widthInches * 0.0254);

  if (scale2x > 8000) {
    return [centerLng - (projWidth * 0.625), centerLat - (projHeight * 0.625), centerLng + (projWidth * 0.625), centerLat + (projHeight * 0.625)];
  } else {
    var span1500 = bbox1500[2] - bbox1500[0], span2x = bbox2x[2] - bbox2x[0];
    return (span2x > span1500) ? bbox2x : bbox1500;
  }
}

function mapToSlidePixel(lon, lat, bbox, mapWidth, mapHeight) {
  var x = (lon - bbox[0]) / (bbox[2] - bbox[0]) * mapWidth;
  var y = mapHeight - ((lat - bbox[1]) / (bbox[3] - bbox[1]) * mapHeight);
  return { x: x, y: y };
}

function loadProjectGeoJson(filename) {
  var files = DriveApp.getFilesByName(filename);
  if (files.hasNext()) {
    var geoData = JSON.parse(files.next().getBlob().getDataAsString());
    return geoData.features[0].geometry.coordinates[0];
  }
  return null;
}
