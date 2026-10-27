/**
 * Master Script for Generating Map Series 1 and Map Series 2
 * Canvas Size: 7.5" x 10.0" (Template based)
 */

var PAGE_CONTENT_OFFSET_X_PT = 36;
var PAGE_CONTENT_OFFSET_Y_PT = 36;

function pageContentX(x) {
  return x + PAGE_CONTENT_OFFSET_X_PT;
}

function pageContentY(y) {
  return y + PAGE_CONTENT_OFFSET_Y_PT;
}

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

function testHiteSaundersMapGeneration(federalProjectNumber) {
  var projectName = "Hite-Saunders Elementary Improvements";
  var projectNumber = "S306-HS-2026.00";
  var projectCounty = ecz.features[0].properties.county || "Cabell";

  var geoJsonCoords = ecz.features[0].geometry.coordinates[0];

  Logger.log("Generating Map Series for: " + projectName);
  
  generateMapSeries1(projectName, projectNumber, projectCounty, geoJsonCoords, federalProjectNumber);
  generateMapSeries2(projectName, projectNumber, projectCounty, geoJsonCoords, federalProjectNumber);

  Logger.log("Test map generation completed successfully!");
}

/**
 * Duplicates a pre-sized Google Slides template (7.5" x 10") to bypass API sizing issues
 */
function createCustomSizedPresentation(title, widthInches, heightInches) {
  var templateId = "13m1ZHqUspX9tNUPey1M-ICbAxT7ue4L7kTwBTrzO5CY";
  
  try {
    var templateFile = DriveApp.getFileById(templateId);
    var copiedFile = templateFile.makeCopy(title);
    return SlidesApp.openById(copiedFile.getId());
  } catch (e) {
    Logger.log("Error copying template presentation: " + e.message);
    return SlidesApp.create(title);
  }
}

// ==========================================
// MAP SERIES 1 GENERATOR (Topography & Vicinity)
// ==========================================
function generateMapSeries1(projectName, projectNumber, projectCounty, geoJsonCoords, federalProjectNumber) {
  var projectCentroid = calculateGeoJsonCentroid(geoJsonCoords);
  var presentation = createCustomSizedPresentation("Map Series 1 - Topo & Vicinity", 7.5, 10.0);
  var bbox = getBoundingBoxForScale(projectCentroid, 15000, 7.5, 8.65);

  var mapConfigs = [
    { 
      name: "Topography", 
      displayName: "Topography Overview",
      serviceUrl: "https://basemap.nationalmap.gov/arcgis/rest/services/USGSTopo/MapServer/export",
      isRaster: true 
    },
    { 
      name: "Vicinity", 
      displayName: "Vicinity Map",
      serviceUrl1: "https://gis.transportation.wv.gov/arcgis/rest/services/ROW/ROWLite/MapServer/export",
      serviceUrl2: "https://gis.transportation.wv.gov/arcgis/rest/services/Routes/MapServer/export",
      isVicinity: true,
      skipLegend: true
    }
  ];

  for (var i = 0; i < mapConfigs.length; i++) {
    var slide = (i === 0) ? presentation.getSlides()[0] : presentation.appendSlide();
    buildSeries1Sheet(slide, bbox, projectCentroid, geoJsonCoords, mapConfigs[i],
      projectName, projectNumber, projectCounty, federalProjectNumber);
  }
}

function buildSeries1Sheet(slide, bbox, centroid, coords, config, projName, projNum, county, federalProjectNumber) {
  var widthPt = 7.5 * 72;
  var mapH = 8.65 * 72;

  function safeInsertMap(url) {
    try {
      var response = UrlFetchApp.fetch(url, { muteHttpExceptions: true });
      if (response.getResponseCode() === 200) {
        var blob = response.getBlob();
        if (blob.getContentType().indexOf('image') !== -1) {
          slide.insertImage(blob).setLeft(pageContentX(0)).setTop(pageContentY(0)).setWidth(widthPt).setHeight(mapH);
        } else {
          Logger.log("Map API Error (Not an image): " + response.getContentText().substring(0, 100));
        }
      } else {
        Logger.log("Map HTTP Error " + response.getResponseCode() + " for: " + url);
      }
    } catch (e) {
      Logger.log("Error inserting map: " + e.message);
    }
  }

  if (config.isVicinity) {
    var bgBox = slide.insertShape(SlidesApp.ShapeType.RECTANGLE, pageContentX(0), pageContentY(0), widthPt, mapH);
    bgBox.getFill().setSolidFill("#FFFFFF");
    bgBox.getBorder().getLineFill().setSolidFill("#000000");

    var exportUrl1 = config.serviceUrl1 +
      "?bbox=" + bbox.join(",") +
      "&bboxSR=4326&imageSR=4326&size=1080,1252&format=png32&layers=show:2,3,4&transparent=true&dpi=150&f=image";
    safeInsertMap(exportUrl1);

    var exportUrl2 = config.serviceUrl2 +
      "?bbox=" + bbox.join(",") +
      "&bboxSR=4326&imageSR=4326&size=1080,1252&format=png32&transparent=true&dpi=150&f=image";
    safeInsertMap(exportUrl2);

  } else {
    var exportUrl = config.serviceUrl +
      "?bbox=" + bbox.join(",") +
      "&bboxSR=4326&imageSR=4326&size=1080,1252&format=png32&transparent=false&dpi=150&f=image";
    safeInsertMap(exportUrl);
  }

  drawProjectCallout(slide, centroid, bbox, widthPt, mapH);
  drawScaleBarStrip(slide, "1\" = 381 meters (1:15,000)");
  buildFooterLayout(slide, config.displayName, projName, projNum, county, federalProjectNumber);
}

function drawProjectCallout(slide, centroid, bbox, mapWidth, mapHeight) {
  var centerPt = mapToSlidePixel(centroid[0], centroid[1], bbox, mapWidth, mapHeight);
  
  var dot = slide.insertShape(SlidesApp.ShapeType.ELLIPSE,
    pageContentX(centerPt.x - 3), pageContentY(centerPt.y - 3), 6, 6);
  dot.getFill().setSolidFill("#000000");
  dot.getBorder().setTransparent();

  var boxW = 120;
  var boxH = 25;
  var boxX = centerPt.x + 25; 
  var boxY = centerPt.y - 35; 

  if (boxX + boxW > mapWidth) boxX = centerPt.x - boxW - 25;
  if (boxY < 0) boxY = centerPt.y + 25;

  var line = slide.insertLine(SlidesApp.LineCategory.STRAIGHT,
    pageContentX(centerPt.x), pageContentY(centerPt.y),
    pageContentX(boxX), pageContentY(boxY + (boxH / 2)));
  line.getLineFill().setSolidFill("#000000");
  line.setWeight(1);

  var callout = slide.insertTextBox("Project Location",
    pageContentX(boxX), pageContentY(boxY), boxW, boxH);
  callout.getFill().setSolidFill("#FFFFE0");
  callout.getBorder().getLineFill().setSolidFill("#000000");
  callout.getBorder().setWeight(0.25);
  
  var textRange = callout.getText();
  textRange.getTextStyle().setFontSize(12).setBold(true).setFontFamily("Arial");
  textRange.getParagraphs()[0].getRange().getParagraphStyle().setParagraphAlignment(SlidesApp.ParagraphAlignment.CENTER);
}

// ==========================================
// MAP SERIES 2 GENERATOR (Environmental & Assets)
// ==========================================
function generateMapSeries2(projectName, projectNumber, projectCounty, geoJsonCoords, federalProjectNumber) {
  var projectAreaBbox = calculateGeoJsonBbox(geoJsonCoords);
  var bbox = calculateSeries2Bbox(projectAreaBbox, 7.5, 8.65);
  Logger.log("Map Series 2 bbox (EPSG:4326, minX,minY,maxX,maxY): " + bbox.join(","));
  var presentation = createCustomSizedPresentation("Map Series 2 - Environmental & Utilities", 7.5, 10.0);
  var geologyLabelFields = [
    { id: 44, field: "Cenozoic_Qal_Units.Label" },
    { id: 45, field: "Permian_P_Units.Label" },
    { id: 46, field: "Pennsylvanian_Pn_Units.Label" },
    { id: 47, field: "Mississippian_M_Units.Label" },
    { id: 48, field: "Devonian_D_Units.Label" },
    { id: 49, field: "Silurian_S_Units.Label" },
    { id: 50, field: "Ordovician_O_Units.Label" },
    { id: 51, field: "Cambrian_C_Units.Label" },
    { id: 52, field: "Cambrian_or_Precambrian_CPCc_Units.Label" },
    { id: 53, field: "Water_Wa_Units.Label" }
  ];
  var geologyDynamicLayers = geologyLabelFields.map(function(layer) {
    return {
      id: layer.id,
      source: { type: "mapLayer", mapLayerId: layer.id },
      drawingInfo: { showLabels: false, transparency: 35 }
    };
  });

  var utilDynamicLayers1 = [
    {"id":59,"source":{"type":"mapLayer","mapLayerId":59},"drawingInfo":{"renderer":{"type":"simple","symbol":{"type":"esriSLS","style":"esriSLSSolid","color":[0,77,168,255],"width":1}}}},
    {"id":60,"source":{"type":"mapLayer","mapLayerId":60},"drawingInfo":{"renderer":{"type":"simple","symbol":{"type":"esriSLS","style":"esriSLSSolid","color":[255,115,223,255],"width":1}}}},
    {"id":63,"source":{"type":"mapLayer","mapLayerId":63},"drawingInfo":{"renderer":{"type":"simple","symbol":{"type":"esriSLS","style":"esriSLSSolid","color":[115,76,0,255],"width":1}}}},
    {"id":64,"source":{"type":"mapLayer","mapLayerId":64},"drawingInfo":{"renderer":{"type":"simple","symbol":{"type":"esriSLS","style":"esriSLSSolid","color":[38,115,0,255],"width":1}}}}
  ];
  var utilDynamicLayers2 = [
    { "id": 2, "source": { "type": "mapLayer", "mapLayerId": 2 } },
    { "id": 3, "source": { "type": "mapLayer", "mapLayerId": 3 }, "drawingInfo": { "renderer": { "type": "simple", "symbol": { "type": "esriSLS", "style": "esriSLSSolid", "color": [115, 76, 0, 255], "width": 1 } } } }
  ];

  var mapConfigs = [
    { name: "Topography", displayName: "Topography Overview", baseType: "topo", isBasemapOnly: true },
    { name: "Aerial", displayName: "Aerial Overview", baseType: "aerial", isBasemapOnly: true },
    { 
      name: "Flood zones", displayName: "Flood zones Overview", baseType: "aerial", isFlood: true,
      serviceUrl: "https://services.wvgis.wvu.edu/ArcGIS/rest/services/Hazards/floodTool_publicView/MapServer/export",
      layers: "show:1"
    },
    { 
      name: "Geology", displayName: "Geology Overview", baseType: "aerial", isGeology: true,
      serviceUrl: "https://atlas2.wvgs.wvnet.edu/server/rest/services/Geology/Geologic_Map_of_West_Virginia_1968_rev_GeMS_2023/MapServer/export",
      layers: "show:44,45,46,47,48,49,50,51,52,53",
      dynamicLayers: geologyDynamicLayers,
      labelFields: geologyLabelFields
    },
    { 
      name: "Soils", displayName: "Soils Overview", baseType: "aerial", isSoil: true,
      serviceUrl: "https://sdmdataaccess.sc.egov.usda.gov/Spatial2/service.ows"
    },
    { 
      name: "Utility", displayName: "Utility Overview", baseType: "aerial", isUtility: true,
      serviceUrl1: "https://gis.transportation.wv.gov/arcgis/rest/services/Assets/Assets/MapServer/export",
      layers1: "show:59,60,63,64", dynamicLayers1: utilDynamicLayers1,
      serviceUrl2: "https://services.wvgis.wvu.edu/ArcGIS/rest/services/Utilities_Communication/WV_WaterSewer_WVWDA/MapServer/export",
      layers2: "show:2,3", dynamicLayers2: utilDynamicLayers2,
      legendItems: [
        { code: "Waterlines", color: "#004DA8", isLine: true },
        { code: "kV Powerlines", color: "#FF73DF", isLine: true },
        { code: "Sewer Lines", color: "#734C00", isLine: true },
        { code: "Natural Gas", color: "#267300", isLine: true }
      ]
    }
  ];

  for (var i = 0; i < mapConfigs.length; i++) {
    var slide = (i === 0) ? presentation.getSlides()[0] : presentation.appendSlide();
    buildSeries2Sheet(slide, bbox, geoJsonCoords, mapConfigs[i],
      projectName, projectNumber, projectCounty, federalProjectNumber);
  }
}

function buildSeries2Sheet(slide, bbox, projectCoords, config, projName, projNum, county, federalProjectNumber) {
  var widthPt = 7.5 * 72;
  var mapH = 8.65 * 72;

  function safeInsertMap(url) {
    try {
      var response = UrlFetchApp.fetch(url, { muteHttpExceptions: true });
      if (response.getResponseCode() === 200) {
        var blob = response.getBlob();
        if (blob.getContentType().indexOf('image') !== -1) {
          slide.insertImage(blob).setLeft(pageContentX(0)).setTop(pageContentY(0)).setWidth(widthPt).setHeight(mapH);
        } else {
          Logger.log("Map API Error (Not an image): " + response.getContentText().substring(0, 100));
        }
      } else {
        Logger.log("Map HTTP Error " + response.getResponseCode() + " for: " + url);
      }
    } catch (e) {
      Logger.log("Error inserting map: " + e.message);
    }
  }

  var baseServiceUrl = (config.baseType === "topo")
    ? "https://basemap.nationalmap.gov/arcgis/rest/services/USGSTopo/MapServer/export"
    : "https://services.wvgis.wvu.edu/arcgis/rest/services/Imagery_BaseMaps_EarthCover/wv_imagery_WVGISTC_leaf_off_mosaic/MapServer/export";

  var baseExportUrl = baseServiceUrl + "?bbox=" + bbox.join(",") + "&bboxSR=4326&imageSR=4326&size=1080,1252&format=png32&dpi=150&f=image";
  safeInsertMap(baseExportUrl);

  var visibleFeatures = [{ code: "Project Boundary", color: "#800080", isOutlineOnly: true }];

  if (config.isFlood) {
    var floodUrl = config.serviceUrl + 
      "?bbox=" + bbox.join(",") + 
      "&bboxSR=4326&imageSR=4326&size=1080,1252&format=png32&transparent=true" +
      "&layers=" + config.layers + "&dpi=150&f=image";
    safeInsertMap(floodUrl);
    
    visibleFeatures.push({ 
      code: "AE, FLOODWAY", 
      imageData: "iVBORw0KGgoAAAANSUhEUgAAACgAAAAUCAYAAAD/Rn+7AAAACXBIWXMAAA7EAAAOxAGVKw4bAAAA4UlEQVRIic3WMQrCMBTG8f8QcPE2Tjr1AG49ilOn4AE6eQ17BrPlQi52ibwaglCrScH2PXiBFL6+HyXQmBBCQHEZWe7nMw/nhgct4IETsM98STsj42NuKrOpKrbWvoCC650bAtIdsAP6TFwbB+VmBFdnZBLwfVBX+OXaOEiaQlxOxmjGJaBXikvAa+bZWRonlc6gJpwHLsCtBLgkrgaquDcacYd47LKAa+J+AtfGfQVqwE0CteA+AjXhRkBtOCmjGTe6LGjDJaBcDpsZv6LmjxkxJaC1VpbMUXCMXVJzMhJ8Ah62gam1AEK+AAAAAElFTkSuQmCC",
      contentType: "image/png",
      isImagePatch: true
    });
    
    visibleFeatures.push({ 
      code: "FLOODZONE", 
      imageData: "iVBORw0KGgoAAAANSUhEUgAAACgAAAAUCAYAAAD/Rn+7AAAACXBIWXMAAA7EAAAOxAGVKw4bAAAATUlEQVRIic3WUQ3AMBCAULYgrM5mbW7qomnOBU8Bn7hhHVgEvfA7cQ98BB1A4iRO4iRO4iRO4iRO4iRO4iRO4iRO4iRO4pytnnMtmrYLYuoItn2KrPEAAAAASUVORK5CYII=",
      contentType: "image/png",
      isImagePatch: true
    });

  } else if (config.isGeology) {
    var geoUrl = config.serviceUrl + 
      "?bbox=" + bbox.join(",") + 
      "&bboxSR=4326&imageSR=4326&size=1080,1252&format=png32&transparent=true" +
      "&layers=" + config.layers + 
      (config.dynamicLayers ? "&dynamicLayers=" + encodeURIComponent(JSON.stringify(config.dynamicLayers)) : "") + 
      "&dpi=150&f=image";
    safeInsertMap(geoUrl);
    var geologyLabels = fetchGeologyLabels(config.serviceUrl, bbox, config.labelFields, 1080, 1252, widthPt, 12);
    drawMapTextLabels(slide, geologyLabels, 1080, 1252, widthPt, mapH, 12, projectCoords, bbox);

    var geoLegends = fetchGeologyLegend(bbox, config.layers);
    for (var gl = 0; gl < geoLegends.length; gl++) {
      visibleFeatures.push(geoLegends[gl]);
    }

  } else if (config.isSoil) {
    var soilData = fetchSoilData(bbox);
    try {
      var soilRender = renderSoilFeaturesToPng(bbox, soilData.features, soilData.legendItems, 1080, 1252, widthPt, 9);
      slide.insertImage(soilRender.blob).setLeft(pageContentX(0)).setTop(pageContentY(0)).setWidth(widthPt).setHeight(mapH);
      drawMapTextLabels(slide, soilRender.labels, 1080, 1252, widthPt, mapH, 9, projectCoords, bbox);
      for (var soilIndex = 0; soilIndex < soilData.legendItems.length; soilIndex++) {
        visibleFeatures.push(soilData.legendItems[soilIndex]);
      }
    } catch (e) {
      throw new Error("Soil map generation failed: " + e.message);
    }

  } else if (config.isUtility) {
    var utilUrl1 = config.serviceUrl1 + 
      "?bbox=" + bbox.join(",") + 
      "&bboxSR=4326&imageSR=4326&size=1080,1252&format=png32&transparent=true" +
      "&layers=" + config.layers1 + 
      "&dynamicLayers=" + encodeURIComponent(JSON.stringify(config.dynamicLayers1)) + 
      "&dpi=150&f=image";
    safeInsertMap(utilUrl1);

    var utilUrl2 = config.serviceUrl2 + 
      "?bbox=" + bbox.join(",") + 
      "&bboxSR=4326&imageSR=4326&size=1080,1252&format=png32&transparent=true" +
      "&layers=" + config.layers2 + 
      "&dynamicLayers=" + encodeURIComponent(JSON.stringify(config.dynamicLayers2)) + 
      "&dpi=150&f=image";
    safeInsertMap(utilUrl2);
    
    for (var u = 0; u < config.legendItems.length; u++) {
      visibleFeatures.push(config.legendItems[u]);
    }
  }

  if (projectCoords) {
    drawProjectBoundaryOnSlide(slide, projectCoords, bbox, widthPt, mapH);
  }

  var legendColumns = config.isSoil ? 2 : 4;
  var legendRows = Math.max(1, Math.ceil(visibleFeatures.length / legendColumns));
  var legendRowHeight = 12;
  var legendHeight = 8 + (legendRows * legendRowHeight);
  buildFullWidthLegend(slide, visibleFeatures, config.name, 0, mapH - legendHeight, widthPt, legendHeight);

  var metersPerInch = calculateScaleFromBbox(bbox, 7.5);
  var formattedScale = metersPerInch.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  drawScaleBarStrip(slide, "1\" = " + formattedScale + " meters");

  buildFooterLayout(slide, config.displayName, projName, projNum, county, federalProjectNumber);
}

// ==========================================
// LEGEND & FOOTER RENDERING
// ==========================================
function buildFullWidthLegend(slide, features, title, x, y, width, height) {
  var legendBg = slide.insertShape(SlidesApp.ShapeType.RECTANGLE,
    pageContentX(x), pageContentY(y), width, height);
  legendBg.getFill().setSolidFill("#FFFFFF", 0.60);
  legendBg.getBorder().getLineFill().setSolidFill("#333333");

  var unique = {};
  var items = [];
  for (var i = 0; i < features.length; i++) {
    if (!unique[features[i].code]) {
      unique[features[i].code] = true;
      items.push(features[i]);
    }
  }

  var cols = title === "Soils" ? 2 : 4;
  var colWidth = width / cols;
  var rowHeight = 12;

  for (var j = 0; j < items.length; j++) {
    var col = j % cols;
    var row = Math.floor(j / cols);
    var itemX = x + 10 + (col * colWidth);
    var itemY = y + 4 + (row * rowHeight);
    var labelFontSize = title === "Soils" ? 6 : 7;
    var chipHeight = labelFontSize + 1;
    var chipTop = itemY + ((10 - chipHeight) / 2);

    if (items[j].isImagePatch && items[j].imageData) {
      try {
        var decoded = Utilities.base64Decode(items[j].imageData);
        var blob = Utilities.newBlob(decoded, items[j].contentType, "patch_" + j + ".png");
        slide.insertImage(blob).setLeft(pageContentX(itemX)).setTop(pageContentY(chipTop)).setWidth(12).setHeight(chipHeight);
        if (title === "Geology") {
          var patchOutline = slide.insertShape(SlidesApp.ShapeType.RECTANGLE,
            pageContentX(itemX), pageContentY(chipTop), 12, chipHeight);
          patchOutline.getFill().setTransparent();
          patchOutline.getBorder().getLineFill().setSolidFill("#000000");
          patchOutline.getBorder().setWeight(0.5);
        }
      } catch (e) {
        Logger.log("Error inserting base64 PNG patch: " + e.message);
      }
    } else if (items[j].isLine) {
      var lineCenterY = chipTop + (chipHeight / 2);
      var linePatch = slide.insertLine(SlidesApp.LineCategory.STRAIGHT,
        pageContentX(itemX), pageContentY(lineCenterY), pageContentX(itemX + 12), pageContentY(lineCenterY));
      linePatch.getLineFill().setSolidFill(items[j].color);
      linePatch.setWeight(2);
    } else {
      var swatch = slide.insertShape(SlidesApp.ShapeType.RECTANGLE,
        pageContentX(itemX), pageContentY(chipTop), 12, chipHeight);
      if (items[j].isOutlineOnly) {
        swatch.getFill().setTransparent();
        swatch.getBorder().getLineFill().setSolidFill(items[j].color);
        swatch.getBorder().setWeight(2);
      } else {
        swatch.getFill().setSolidFill(items[j].color);
        if (title === "Geology") {
          swatch.getBorder().getLineFill().setSolidFill("#000000");
          swatch.getBorder().setWeight(0.5);
        } else {
          swatch.getBorder().setTransparent();
        }
      }
    }

    var labelHeight = 12;
    var labelLeft = itemX + 10.2;
    var labelWidth = colWidth - 14.2;
    var lbl = slide.insertTextBox(items[j].code,
      pageContentX(labelLeft), pageContentY(itemY - 1), labelWidth, labelHeight);
    lbl.setContentAlignment(SlidesApp.ContentAlignment.MIDDLE);
    lbl.getText().getTextStyle().setFontSize(labelFontSize).setFontFamily("Arial");
  }
}

function drawScaleBarStrip(slide, scaleText) {
  var widthPt = 7.5 * 72;
  var mapH = 8.65 * 72; 
  var scaleH = 0.2 * 72; 

  var scaleBg = slide.insertShape(SlidesApp.ShapeType.RECTANGLE,
    pageContentX(0), pageContentY(mapH), widthPt, scaleH);
  scaleBg.getFill().setSolidFill("#FFFFFF");
  scaleBg.getBorder().getLineFill().setSolidFill("#000000");

  var textY = mapH + (0.02 * 72);
  var txt = slide.insertTextBox(scaleText, pageContentX(10), pageContentY(textY), 200, scaleH);
  txt.setContentAlignment(SlidesApp.ContentAlignment.MIDDLE);
  txt.getText().getTextStyle().setFontSize(7).setBold(true).setFontFamily("Arial");

  var scaleMatch = scaleText.match(/1"\s*=\s*([0-9,]+)\s*meters?\b/i);
  
  if (scaleMatch) {
    var metersPerInch = parseInt(scaleMatch[1].replace(/,/g, ''), 10);
    
    var allowedSegments = [5, 10, 25, 50, 100, 250, 500, 1000, 2500, 5000, 10000];
    var segmentMeters = 10; 
    var maxSegmentWidthPt = 60; 

    for (var s = allowedSegments.length - 1; s >= 0; s--) {
      var testWidthPt = (allowedSegments[s] / metersPerInch) * 72;
      if (testWidthPt <= maxSegmentWidthPt) {
        segmentMeters = allowedSegments[s];
        break;
      }
    }
    
    var segments = 4;
    var segmentHeight = 6;
    var segmentWidthPt = (segmentMeters / metersPerInch) * 72; 
    
    var startX = widthPt - (segments * segmentWidthPt) - 30; 
    var startY = mapH + (scaleH / 2) - (segmentHeight / 2) + 2; 

    var labelY = startY - 13.44;

    for (var i = 0; i < segments; i++) {
      var rect = slide.insertShape(SlidesApp.ShapeType.RECTANGLE,
        pageContentX(startX + (i * segmentWidthPt)), pageContentY(startY), segmentWidthPt, segmentHeight);
      rect.getBorder().getLineFill().setSolidFill("#000000");
      rect.getBorder().setWeight(0.75);
      rect.getFill().setSolidFill(i % 2 === 0 ? "#000000" : "#FFFFFF");
      
      var labelVal = i * segmentMeters;
      var labelBox = slide.insertTextBox(labelVal.toString(),
        pageContentX(startX + (i * segmentWidthPt) - 15), pageContentY(labelY), 30, 15);
      labelBox.getText().getTextStyle().setFontSize(5).setFontFamily("Arial");
      labelBox.getText().getParagraphs()[0].getRange().getParagraphStyle().setParagraphAlignment(SlidesApp.ParagraphAlignment.CENTER);
    }
    
    var finalLabelVal = segments * segmentMeters;
    var finalLabelBox = slide.insertTextBox(finalLabelVal.toString() + " meters",
      pageContentX(startX + (segments * segmentWidthPt) - 27.5), pageContentY(labelY), 55, 15);
    finalLabelBox.getText().getTextStyle().setFontSize(5).setFontFamily("Arial");
    finalLabelBox.getText().getParagraphs()[0].getRange().getParagraphStyle().setParagraphAlignment(SlidesApp.ParagraphAlignment.CENTER);
  }
}

function buildFooterLayout(slide, mapOverviewTitle, projectName, projectNumber, projectCounty, federalProjectNumber) {
  var widthPt = 7.5 * 72;
  var mapH = 8.65 * 72; 
  var scaleH = 0.2 * 72; 
  var footerH = 1.15 * 72;
  var footerY = mapH + scaleH; 

  var neatLine = slide.insertShape(SlidesApp.ShapeType.RECTANGLE,
    pageContentX(0), pageContentY(0), widthPt, mapH + scaleH + footerH);
  neatLine.getFill().setTransparent();
  neatLine.getBorder().getLineFill().setSolidFill("#000000");
  neatLine.getBorder().setWeight(1.5);

  var footerBox = slide.insertShape(SlidesApp.ShapeType.RECTANGLE,
    pageContentX(0), pageContentY(footerY), widthPt, footerH);
  footerBox.getFill().setSolidFill("#FFFFFF");
  footerBox.getBorder().getLineFill().setSolidFill("#000000");

  var logoUrl = "https://gis.transportation.wv.gov/files/Logos/WVDOH.png";
  var logoBlob = UrlFetchApp.fetch(logoUrl).getBlob();
  var logoImage = slide.insertImage(logoBlob);

  var padding = 4;
  var logoMaxH = footerH - (padding * 2);
  var logoW = (logoImage.getWidth() / logoImage.getHeight()) * logoMaxH;
  logoImage.setLeft(pageContentX(padding + 4.32)).setTop(pageContentY(footerY + padding)).setWidth(logoW).setHeight(logoMaxH);

  var leftLineX = Math.max(logoW + (padding * 2), 90);
  var leftVLine = slide.insertLine(SlidesApp.LineCategory.STRAIGHT,
    pageContentX(leftLineX), pageContentY(footerY), pageContentX(leftLineX), pageContentY(footerY + footerH));
  leftVLine.getLineFill().setSolidFill("#000000");

  var rightSectionW = 150;
  var rightLineX = widthPt - rightSectionW;

  var rightVLine = slide.insertLine(SlidesApp.LineCategory.STRAIGHT,
    pageContentX(rightLineX), pageContentY(footerY), pageContentX(rightLineX), pageContentY(footerY + footerH));
  rightVLine.getLineFill().setSolidFill("#000000");

  buildCountyInset(slide, projectCounty, rightLineX + 5, footerY + 5, 85, footerH - 10);

  var countyLabelY = (footerY + 12) - (0.2 * 72);
  var labelBox = slide.insertTextBox(projectCounty.toUpperCase() + " COUNTY",
    pageContentX(rightLineX + 90), pageContentY(countyLabelY), 60, 25);
  labelBox.getFill().setTransparent();
  labelBox.getText().getTextStyle().setFontSize(7).setBold(true).setFontFamily("Arial");

  drawNorthArrow(slide, rightLineX + 105, footerY + 38, 20, 32);

  var centerTextX = leftLineX + 10;
  var centerTextW = (rightLineX - 10) - centerTextX;

  var infoBox = slide.insertTextBox("", pageContentX(centerTextX), pageContentY(footerY + 6),
    centerTextW, footerH - 12);
  infoBox.getFill().setTransparent();
  
  var infoText = infoBox.getText();
  var footerLines = [
    projectName || "Project Name",
    projectNumber || "Project Number"
  ];
  var federalNumber = federalProjectNumber === null || federalProjectNumber === undefined ?
    "" : String(federalProjectNumber).trim();
  if (federalNumber) footerLines.push("Federal Project No. " + federalNumber);
  footerLines.push(mapOverviewTitle || "");
  var fullText = footerLines.join("\n");
  
  infoText.setText(fullText);

  var paragraphs = infoText.getParagraphs();
  var availableTextWidth = Math.max(1, centerTextW - 12);
  var longestLineWidthEm = 0;
  var textLines = fullText.split("\n");
  for (var lineIndex = 0; lineIndex < textLines.length; lineIndex++) {
    longestLineWidthEm = Math.max(longestLineWidthEm, estimateFooterTextWidthEm(textLines[lineIndex]));
  }
  var footerFontSize = Math.min(12, availableTextWidth / Math.max(longestLineWidthEm, 1));
  footerFontSize = Math.max(4, Math.floor(footerFontSize * 2) / 2);
  for (var paragraphIndex = 0; paragraphIndex < paragraphs.length; paragraphIndex++) {
    paragraphs[paragraphIndex].getRange().getTextStyle()
      .setFontSize(footerFontSize)
      .setBold(paragraphIndex === 0 || paragraphIndex === paragraphs.length - 1)
      .setFontFamily("Arial");
  }
}

function estimateFooterTextWidthEm(text) {
  var widthEm = 0;
  var narrowCharacters = "ilI.,'!|:;";
  var wideCharacters = "MW@%&mw";
  var uppercaseAndDigits = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  for (var i = 0; i < text.length; i++) {
    var character = text.charAt(i);
    if (narrowCharacters.indexOf(character) !== -1) {
      widthEm += 0.3;
    } else if (wideCharacters.indexOf(character) !== -1) {
      widthEm += 0.9;
    } else if (character === " ") {
      widthEm += 0.32;
    } else if (uppercaseAndDigits.indexOf(character) !== -1) {
      widthEm += 0.65;
    } else {
      widthEm += 0.56;
    }
  }
  return widthEm * 1.1;
}

function buildCountyInset(slide, projectCounty, x, y, width, height) {
  var countyMapUrl = "https://gis.transportation.wv.gov/arcgis/rest/services/Boundaries/MapServer/export";
  var bbox = "-9297327.936958615,4423688.807949397,-8652366.526698831,5018871.317417317";
  
  var dynamicLayers = [
    {
      "id": 1,
      "source": { "type": "mapLayer", "mapLayerId": 1 },
      "drawingInfo": {
        "renderer": {
          "type": "uniqueValue",
          "field1": "NAME",
          "fieldDelimiter": ", ",
          "defaultSymbol": {
            "type": "esriSFS",
            "style": "esriSFSNull",
            "outline": { "type": "esriSLS", "style": "esriSLSSolid", "color": [0, 0, 0, 255], "width": 1.5 }
          },
          "uniqueValueInfos": [
            {
              "value": projectCounty,
              "symbol": {
                "type": "esriSFS",
                "style": "esriSFSSolid",
                "color": [255, 0, 0, 255],
                "outline": { "type": "esriSLS", "style": "esriSLSSolid", "color": [0, 0, 0, 255], "width": 1.5 }
              }
            }
          ]
        }
      }
    }
  ];

  var exportUrl = countyMapUrl + "?bbox=" + bbox + "&bboxSR=3857&imageSR=3857&size=300,300&format=png32&transparent=true&dynamicLayers=" + encodeURIComponent(JSON.stringify(dynamicLayers)) + "&dpi=150&f=image";

  try {
    var insetBlob = UrlFetchApp.fetch(exportUrl).getBlob();
    slide.insertImage(insetBlob, pageContentX(x), pageContentY(y), width, height);

    var neatline = slide.insertShape(SlidesApp.ShapeType.RECTANGLE,
      pageContentX(x), pageContentY(y), width, height);
    neatline.getFill().setTransparent();
    neatline.getBorder().getLineFill().setSolidFill("#000000");
  } catch (e) {
    Logger.log("Error generating county inset map: " + e.toString());
  }
}

function drawNorthArrow(slide, x, y, width, height) {
  var arrow = slide.insertShape(SlidesApp.ShapeType.UP_ARROW,
    pageContentX(x), pageContentY(y), width, height);
  arrow.getFill().setSolidFill("#000000");
  arrow.getBorder().getLineFill().setSolidFill("#000000");

  var nBoxY = (y - 12) + (0.2 * 72);
  var nBox = slide.insertTextBox("N", pageContentX(x - 2), pageContentY(nBoxY), width + 4, 15);
  nBox.getFill().setTransparent();
  
  var nTxt = nBox.getText();
  nTxt.getTextStyle().setFontSize(12).setBold(true).setFontFamily("Arial").setForegroundColor("#FFFFFF");
  nTxt.getParagraphs()[0].getRange().getParagraphStyle().setParagraphAlignment(SlidesApp.ParagraphAlignment.CENTER);
}

// ==========================================
// GEOMETRY, MATH & API HELPERS
// ==========================================
function fetchGeologyLegend(bbox, visibleLayers) {
  var mapServerUrl = "https://atlas2.wvgs.wvnet.edu/server/rest/services/Geology/Geologic_Map_of_West_Virginia_1968_rev_GeMS_2023/MapServer";
  var queryUrl = mapServerUrl + "/queryLegends";
  
  var payload = {
    "f": "json",
    "bbox": bbox.join(","),
    "bboxSR": "4326",
    "layers": visibleLayers,
    "transparent": "true",
    "returnOnlyVisible": "true",
    "patchSize": "30,15"
  };
  
  var options = {
    "method": "post",
    "payload": payload,
    "muteHttpExceptions": true
  };
  
  var dynamicLegendItems = [];
  
  try {
    var response = UrlFetchApp.fetch(queryUrl, options);
    if (response.getResponseCode() !== 200) {
      Logger.log("Geology Legend HTTP Error: " + response.getResponseCode());
      return dynamicLegendItems;
    }
    
    var data = JSON.parse(response.getContentText());
    if (!data.layers || data.layers.length === 0) return dynamicLegendItems;
    
    for (var i = 0; i < data.layers.length; i++) {
      var layer = data.layers[i];
      var layerId = layer.layerId;
      
      var validItems = [];
      if (layer.legend) {
        for (var j = 0; j < layer.legend.length; j++) {
          if (layer.legend[j].imageData) {
            validItems.push(layer.legend[j]);
          }
        }
      }
      
      if (validItems.length > 0) {
        var symField = null, lblField = null, nameField = null;
        var labelDict = {};
        
        var metaRes = UrlFetchApp.fetch(mapServerUrl + "/" + layerId + "?f=json", {muteHttpExceptions: true});
        if (metaRes.getResponseCode() === 200) {
          var metaData = JSON.parse(metaRes.getContentText());
          if (metaData.fields) {
            for (var f = 0; f < metaData.fields.length; f++) {
              var fName = metaData.fields[f].name;
              if (fName.match(/Units\.Symbol$/i)) symField = fName;
              if (fName.match(/Units\.Label$/i) || fName.match(/Units\.label$/i)) lblField = fName;
              if (fName.match(/MasterTable\.FullName$/i)) nameField = fName;
            }
          }
        }
        
        if (symField && lblField && nameField) {
          var symbols = [];
          for (var v = 0; v < validItems.length; v++) {
            symbols.push("'" + validItems[v].label.replace(/'/g, "''") + "'");
          }
          
          var qPayload = {
            "f": "json",
            "where": symField + " IN (" + symbols.join(",") + ")",
            "outFields": symField + "," + lblField + "," + nameField,
            "returnGeometry": "false",
            "returnDistinctValues": "true"
          };
          
          var qRes = UrlFetchApp.fetch(mapServerUrl + "/" + layerId + "/query", {
            method: "post",
            payload: qPayload,
            muteHttpExceptions: true
          });
          
          if (qRes.getResponseCode() === 200) {
            var qData = JSON.parse(qRes.getContentText());
            if (qData.features) {
              for (var q = 0; q < qData.features.length; q++) {
                var attr = qData.features[q].attributes;
                var sVal = attr[symField];
                var pLabel = attr[lblField] + " - " + attr[nameField];
                labelDict[sVal] = pLabel;
              }
            }
          }
        }
        
        for (var k = 0; k < validItems.length; k++) {
          var item = validItems[k];
          var rawLabel = item.label; 
          var finalLabel = labelDict[rawLabel] ? labelDict[rawLabel] : (item.label || layer.layerName);
          
          dynamicLegendItems.push({
            code: finalLabel,
            imageData: item.imageData,
            contentType: item.contentType || "image/png",
            isImagePatch: true
          });
        }
      }
    }
  } catch (e) {
    Logger.log("Geology Legend Fetch Error: " + e.message);
  }
  
  return dynamicLegendItems;
}

function fetchGeologyLabels(serviceUrl, bbox, labelFields, width, height, mapWidthPt, fontSize) {
  if (!Array.isArray(labelFields) || labelFields.length === 0) {
    throw new Error("Geology label fields are not configured.");
  }

  var mapServerUrl = serviceUrl.replace(/\/export\/?$/, "");
  var queryUrl = mapServerUrl + "/{layerId}/query";
  var envelope = {
    xmin: bbox[0],
    ymin: bbox[1],
    xmax: bbox[2],
    ymax: bbox[3],
    spatialReference: { wkid: 4326 }
  };
  var pixelTolerance = Math.min(
    (bbox[2] - bbox[0]) / width,
    (bbox[3] - bbox[1]) / height
  );
  var maxAllowableOffset = Math.max(pixelTolerance * 0.75, 0.00000001);
  var labels = [];

  for (var layerIndex = 0; layerIndex < labelFields.length; layerIndex++) {
    var layer = labelFields[layerIndex];
    var idsResult = geologyQueryJson(
      queryUrl.replace("{layerId}", layer.id),
      {
        f: "json",
        where: "1=1",
        geometry: JSON.stringify(envelope),
        geometryType: "esriGeometryEnvelope",
        inSR: "4326",
        spatialRel: "esriSpatialRelIntersects",
        returnIdsOnly: "true"
      },
      layer.id
    );
    var objectIds = idsResult.objectIds || [];
    if (!Array.isArray(objectIds)) {
      throw new Error("Geology layer " + layer.id + " returned an invalid objectIds response.");
    }

    for (var start = 0; start < objectIds.length; start += 25) {
      var featureResult = geologyQueryJson(
        queryUrl.replace("{layerId}", layer.id),
        {
          f: "json",
          objectIds: objectIds.slice(start, start + 25).join(","),
          outFields: layer.field,
          returnGeometry: "true",
          outSR: "4326",
          geometryPrecision: "8",
          maxAllowableOffset: String(maxAllowableOffset)
        },
        layer.id
      );
      var features = featureResult.features || [];

      for (var featureIndex = 0; featureIndex < features.length; featureIndex++) {
        var feature = features[featureIndex];
        var attributes = feature.attributes || {};
        var label = attributes[layer.field];
        if (label === undefined) {
          throw new Error("Geology layer " + layer.id + " omitted label field " + layer.field + ".");
        }
        if (label === null || String(label).trim() === "") continue;
        if (!feature.geometry || !Array.isArray(feature.geometry.rings)) {
          throw new Error("Geology layer " + layer.id + " returned a feature without polygon rings.");
        }

        var candidate = findInteriorMapLabelPoint(
          feature.geometry.rings, bbox, width, height, String(label), fontSize, mapWidthPt
        );
        if (!candidate) continue;
        labels.push({
          text: String(label),
          x: candidate.x,
          y: candidate.y,
          availableWidth: candidate.width
        });
      }
    }
  }

  return labels;
}

function geologyQueryJson(queryUrl, payload, layerId) {
  var response = UrlFetchApp.fetch(queryUrl, {
    method: "post",
    payload: payload,
    muteHttpExceptions: true
  });
  var responseText = response.getContentText();
  if (response.getResponseCode() !== 200) {
    throw new Error("Geology label query for layer " + layerId + " returned HTTP " +
      response.getResponseCode() + ": " + responseText.substring(0, 300));
  }

  var result;
  try {
    result = JSON.parse(responseText);
  } catch (e) {
    throw new Error("Geology label query for layer " + layerId +
      " returned invalid JSON: " + responseText.substring(0, 300));
  }
  if (result.error) {
    throw new Error("Geology label query for layer " + layerId + " failed: " +
      (result.error.message || JSON.stringify(result.error)));
  }
  return result;
}

function findInteriorMapLabelPoint(polygonRings, bbox, width, height, text, fontSize, mapWidthPt) {
  var rings = soilProjectRings(polygonRings, bbox, width, height);
  var pixelsPerPoint = width / mapWidthPt;
  var clearancePx = 3 * pixelsPerPoint;
  var halfWidth = (mapLabelTextWidthPoints(text, fontSize) * pixelsPerPoint / 2) + clearancePx;
  var halfHeight = ((fontSize + 12) * pixelsPerPoint / 2) + clearancePx;
  var rowStep = Math.max(1, Math.floor(height / 100));
  var centerY = Math.floor(height / 2);
  var bestCandidate = null;

  for (var offset = 0; offset < height / 2; offset += rowStep) {
    var rows = offset === 0 ? [centerY] : [centerY + offset, centerY - offset];
    for (var rowIndex = 0; rowIndex < rows.length; rowIndex++) {
      var y = rows[rowIndex];
      if (y - halfHeight < 0 || y + halfHeight >= height) continue;

      var intervals = mapLabelScanlineIntervals(rings, y, width);
      for (var intervalIndex = 0; intervalIndex < intervals.length; intervalIndex++) {
        var interval = intervals[intervalIndex];
        if (interval.right - interval.left < halfWidth * 2) continue;
        var x = (interval.left + interval.right) / 2;
        if (!mapLabelRectangleFits(rings, x, y, halfWidth, halfHeight, width)) continue;

        var candidateWidth = interval.right - interval.left;
        var centerPenalty = Math.abs(x - (width / 2)) + Math.abs(y - (height / 2));
        if (!bestCandidate || candidateWidth > bestCandidate.width ||
            (candidateWidth === bestCandidate.width && centerPenalty < bestCandidate.centerPenalty)) {
          bestCandidate = {
            x: x,
            y: y + 0.5,
            width: candidateWidth,
            centerPenalty: centerPenalty
          };
        }
      }
    }
  }
  return bestCandidate;
}

function mapLabelTextWidthPoints(text, fontSize) {
  return Math.max(28, (text.length * fontSize * 0.85) + 10);
}

function mapLabelScanlineIntervals(rings, y, width) {
  var scanY = y + 0.5;
  var intersections = [];
  for (var ringIndex = 0; ringIndex < rings.length; ringIndex++) {
    var ring = rings[ringIndex];
    for (var edgeIndex = 0; edgeIndex < ring.length; edgeIndex++) {
      var first = ring[edgeIndex];
      var second = ring[(edgeIndex + 1) % ring.length];
      if ((first.y <= scanY && second.y > scanY) || (second.y <= scanY && first.y > scanY)) {
        intersections.push(first.x + ((scanY - first.y) * (second.x - first.x)) / (second.y - first.y));
      }
    }
  }

  intersections.sort(function(a, b) { return a - b; });
  var intervals = [];
  for (var pairIndex = 0; pairIndex + 1 < intersections.length; pairIndex += 2) {
    var left = Math.max(0, intersections[pairIndex]);
    var right = Math.min(width, intersections[pairIndex + 1]);
    if (right > left) intervals.push({ left: left, right: right });
  }
  return intervals;
}

function mapLabelRectangleFits(rings, centerX, centerY, halfWidth, halfHeight, width) {
  var verticalStep = 4;
  var firstY = centerY - halfHeight;
  var lastY = centerY + halfHeight;
  for (var y = firstY; y <= lastY; y += verticalStep) {
    var intervals = mapLabelScanlineIntervals(rings, y, width);
    var fitsThisRow = false;
    for (var intervalIndex = 0; intervalIndex < intervals.length; intervalIndex++) {
      if (intervals[intervalIndex].left <= centerX - halfWidth &&
          intervals[intervalIndex].right >= centerX + halfWidth) {
        fitsThisRow = true;
        break;
      }
    }
    if (!fitsThisRow) return false;
  }
  return true;
}

var SOIL_COLOR_PALETTE = [
  "#0072B2", "#E69F00", "#009E73", "#D55E00", "#CC79A7",
  "#56B4E9", "#F0E442", "#332288", "#44AA99", "#AA4499",
  "#117733", "#999933", "#DDCC77", "#CC6677", "#882255",
  "#661100", "#6699CC", "#AA4466", "#1B9E77", "#7570B3"
];

function soilColorForIndex(index) {
  if (index < SOIL_COLOR_PALETTE.length) return SOIL_COLOR_PALETTE[index];

  var generatedIndex = index - SOIL_COLOR_PALETTE.length;
  var hue = (23 + (generatedIndex * 137.508)) % 360;
  var saturation = [0.68, 0.76, 0.62, 0.72][generatedIndex % 4];
  var lightness = [0.48, 0.57, 0.43, 0.53][Math.floor(generatedIndex / 4) % 4];
  var chroma = (1 - Math.abs((2 * lightness) - 1)) * saturation;
  var hueSegment = hue / 60;
  var secondary = chroma * (1 - Math.abs((hueSegment % 2) - 1));
  var red = 0;
  var green = 0;
  var blue = 0;

  if (hueSegment < 1) {
    red = chroma;
    green = secondary;
  } else if (hueSegment < 2) {
    red = secondary;
    green = chroma;
  } else if (hueSegment < 3) {
    green = chroma;
    blue = secondary;
  } else if (hueSegment < 4) {
    green = secondary;
    blue = chroma;
  } else if (hueSegment < 5) {
    red = secondary;
    blue = chroma;
  } else {
    red = chroma;
    blue = secondary;
  }

  var offset = lightness - (chroma / 2);
  return "#" + [red, green, blue].map(function(channel) {
    var hex = Math.round((channel + offset) * 255).toString(16).toUpperCase();
    return hex.length === 1 ? "0" + hex : hex;
  }).join("");
}

function fetchSoilData(bbox) {
  var wfsUrl = "https://sdmdataaccess.sc.egov.usda.gov/Spatial2/service.ows";
  var params = {
    SERVICE: "WFS",
    VERSION: "1.0.0",
    REQUEST: "GetFeature",
    TYPENAME: "mapunitpoly",
    BBOX: bbox.join(","),
    OUTPUTFORMAT: "application/json"
  };
  var query = Object.keys(params).map(function(key) {
    return encodeURIComponent(key) + "=" + encodeURIComponent(params[key]);
  }).join("&");
  var response = UrlFetchApp.fetch(wfsUrl + "?" + query, { muteHttpExceptions: true });
  var contentType = response.getHeaders()["Content-Type"] || response.getHeaders()["content-type"] || "";
  var responseText = response.getContentText();
  if (response.getResponseCode() !== 200 || contentType.toLowerCase().indexOf("json") === -1) {
    throw new Error("Soil WFS HTTP " + response.getResponseCode() + " (" + contentType + "): " + responseText.substring(0, 300));
  }

  var data;
  try {
    data = JSON.parse(responseText);
  } catch (e) {
    throw new Error("Soil WFS returned invalid JSON: " + responseText.substring(0, 300));
  }
  if (!data.features || data.features.length === 0) {
    throw new Error("Soil WFS returned no map-unit features for the extent.");
  }

  var uniqueUnits = {};
  var mukeys = {};
  for (var i = 0; i < data.features.length; i++) {
    var properties = data.features[i].properties || {};
    var musym = properties.musym || properties.MUSYM || properties.Musym;
    var mukey = properties.mukey || properties.MUKEY || properties.Mukey;
    var mukeyValue = mukey !== undefined && mukey !== null ? String(mukey) : "";
    if (/^\d+$/.test(mukeyValue)) mukeys[mukeyValue] = true;
    if (musym !== undefined && musym !== null && String(musym) !== "") {
      var symbol = String(musym);
      if (!Object.prototype.hasOwnProperty.call(uniqueUnits, symbol)) {
        uniqueUnits[symbol] = { musym: symbol, mukey: /^\d+$/.test(mukeyValue) ? mukeyValue : "" };
      } else if (!uniqueUnits[symbol].mukey && /^\d+$/.test(mukeyValue)) {
        uniqueUnits[symbol].mukey = mukeyValue;
      }
    }
  }

  var namesByMukey = fetchSoilNamesByMukey(Object.keys(mukeys));
  var symbols = Object.keys(uniqueUnits).sort();
  if (symbols.length === 0) {
    throw new Error("Soil WFS features did not include map-unit symbols.");
  }
  var legendItems = [];
  for (var unitIndex = 0; unitIndex < symbols.length; unitIndex++) {
    var unit = uniqueUnits[symbols[unitIndex]];
    unit.soilName = namesByMukey[unit.mukey];
    if (!unit.soilName) {
      throw new Error("Soil name lookup did not return a name for map unit " + unit.musym + ".");
    }
    unit.code = unit.musym + " - " + unit.soilName;
    unit.label = unit.musym;
    unit.color = soilColorForIndex(unitIndex);
    unit.isOutlineOnly = false;
    legendItems.push(unit);
  }

  return { features: data.features, legendItems: legendItems };
}

function fetchSoilNamesByMukey(mukeys) {
  if (!mukeys || mukeys.length === 0) {
    throw new Error("Soil WFS response did not include map-unit keys for name lookup.");
  }
  var postRestUrl = "https://sdmdataaccess.sc.egov.usda.gov/Tabular/post.rest";
  var query = "SELECT mukey, musym, muname FROM mapunit WHERE mukey IN (" + mukeys.join(",") + ")";
  var response = UrlFetchApp.fetch(postRestUrl, {
    method: "post",
    contentType: "application/json",
    payload: JSON.stringify({
      service: "query",
      query: query,
      format: "json+columnname",
      "*auditdata*": '(application="SDA" description="gas_re_maps soil-name lookup")'
    }),
    muteHttpExceptions: true
  });
  var contentType = response.getHeaders()["Content-Type"] || response.getHeaders()["content-type"] || "";
  var responseText = response.getContentText();
  if (response.getResponseCode() !== 200 || contentType.toLowerCase().indexOf("json") === -1) {
    throw new Error("Soil-name query HTTP " + response.getResponseCode() + " (" + contentType + "): " + responseText.substring(0, 300));
  }

  var result;
  try {
    result = JSON.parse(responseText);
  } catch (e) {
    throw new Error("Soil-name query returned invalid JSON: " + responseText.substring(0, 300));
  }
  var table = result.Table || result.table;
  if (!table || table.length < 2 || !Array.isArray(table[0])) {
    throw new Error("Soil-name query returned no result rows: " + responseText.substring(0, 300));
  }
  var columns = table[0].map(function(column) { return String(column).toLowerCase(); });
  var mukeyIndex = columns.indexOf("mukey");
  var nameIndex = columns.indexOf("muname");
  if (mukeyIndex === -1 || nameIndex === -1) {
    throw new Error("Soil-name query response is missing mukey or muname columns.");
  }

  var namesByMukey = {};
  for (var rowIndex = 1; rowIndex < table.length; rowIndex++) {
    var row = table[rowIndex];
    if (row[mukeyIndex] !== null && row[mukeyIndex] !== undefined && row[nameIndex]) {
      namesByMukey[String(row[mukeyIndex])] = String(row[nameIndex]);
    }
  }
  return namesByMukey;
}

function renderSoilFeaturesToPng(bbox, features, legendItems, width, height, mapWidthPt, fontSize) {
  var rgba = new Uint8Array(width * height * 4);
  var colorsBySymbol = {};
  for (var i = 0; i < legendItems.length; i++) {
    colorsBySymbol[legendItems[i].musym] = soilHexToRgb(legendItems[i].color);
  }

  var labelCandidates = {};
  var renderablePolygonCount = 0;
  for (var featureIndex = 0; featureIndex < features.length; featureIndex++) {
    var feature = features[featureIndex];
    var properties = feature.properties || {};
    var musym = properties.musym || properties.MUSYM || properties.Musym;
    var color = colorsBySymbol[String(musym)];
    if (!color || !feature.geometry) continue;
    var polygons = soilGeometryToPolygons(feature.geometry);
    for (var polygonIndex = 0; polygonIndex < polygons.length; polygonIndex++) {
      var rings = soilProjectRings(polygons[polygonIndex], bbox, width, height);
      var fillCandidate = soilFillPolygon(rgba, width, height, rings, color, 166);
      if (!fillCandidate) continue;
      renderablePolygonCount++;

      var candidate = findInteriorMapLabelPoint(
        polygons[polygonIndex], bbox, width, height, String(musym), fontSize, mapWidthPt
      );
      if (candidate && (!labelCandidates[String(musym)] || candidate.width > labelCandidates[String(musym)].width)) {
        labelCandidates[String(musym)] = candidate;
      }
    }
  }
  if (renderablePolygonCount === 0) {
    throw new Error("Soil WFS returned no renderable polygon geometries.");
  }

  var outline = [64, 64, 64];
  for (var outlineFeatureIndex = 0; outlineFeatureIndex < features.length; outlineFeatureIndex++) {
    var outlineFeature = features[outlineFeatureIndex];
    var outlineProps = outlineFeature.properties || {};
    var outlineSymbol = outlineProps.musym || outlineProps.MUSYM || outlineProps.Musym;
    if (!colorsBySymbol[String(outlineSymbol)] || !outlineFeature.geometry) continue;
    var outlinePolygons = soilGeometryToPolygons(outlineFeature.geometry);
    for (var outlinePolygonIndex = 0; outlinePolygonIndex < outlinePolygons.length; outlinePolygonIndex++) {
      var outlineRings = soilProjectRings(outlinePolygons[outlinePolygonIndex], bbox, width, height);
      for (var ringIndex = 0; ringIndex < outlineRings.length; ringIndex++) {
        soilStrokeRing(rgba, width, height, outlineRings[ringIndex], outline, 220);
      }
    }
  }

  var symbols = Object.keys(labelCandidates);
  var labels = [];
  for (var symbolIndex = 0; symbolIndex < symbols.length; symbolIndex++) {
    var labelSymbol = symbols[symbolIndex];
    var candidate = labelCandidates[labelSymbol];
    labels.push({
      text: labelSymbol,
      x: candidate.x,
      y: candidate.y,
      availableWidth: candidate.width
    });
  }

  return {
    blob: soilEncodePng(width, height, rgba),
    labels: labels
  };
}

function drawMapTextLabels(slide, labels, imageWidth, imageHeight, mapWidth, mapHeight, fontSize, projectCoords, bbox) {
  if (!Array.isArray(labels) || labels.length === 0) return 0;

  var prioritizedLabels = labels.slice();
  prioritizedLabels.sort(function(first, second) {
    var firstWidth = typeof first.availableWidth === "number" ? first.availableWidth : 0;
    var secondWidth = typeof second.availableWidth === "number" ? second.availableWidth : 0;
    return secondWidth - firstWidth;
  });

  var pixelsPerPoint = imageWidth / mapWidth;
  var placedBoxes = [];
  var projectBoundaryPixels = [];
  if (Array.isArray(projectCoords) && bbox) {
    for (var pointIndex = 0; pointIndex < projectCoords.length; pointIndex++) {
      projectBoundaryPixels.push(mapToSlidePixel(
        projectCoords[pointIndex][0], projectCoords[pointIndex][1], bbox, imageWidth, imageHeight
      ));
    }
  }

  for (var labelIndex = 0; labelIndex < prioritizedLabels.length; labelIndex++) {
    var label = prioritizedLabels[labelIndex];
    var text = String(label.text).replace(/[\r\n\t]+/g, " ").replace(/\s+/g, " ").trim();
    if (!text) continue;
    var boxWidth = mapLabelTextWidthPoints(text, fontSize);
    var boxHeight = fontSize + 12;
    var centerX = (label.x / imageWidth) * mapWidth;
    var centerY = (label.y / imageHeight) * mapHeight;
    var requiredPixelWidth = (boxWidth + 6) * pixelsPerPoint;
    if (label.availableWidth !== undefined && label.availableWidth < requiredPixelWidth) continue;

    var box = {
      left: centerX - (boxWidth / 2) - 1,
      right: centerX + (boxWidth / 2) + 1,
      top: centerY - (boxHeight / 2) - 1,
      bottom: centerY + (boxHeight / 2) + 1
    };
    if (box.left < 0 || box.right > mapWidth || box.top < 0 || box.bottom > mapHeight) continue;

    var pixelBox = {
      left: label.x - ((boxWidth / 2) * pixelsPerPoint),
      right: label.x + ((boxWidth / 2) * pixelsPerPoint),
      top: label.y - ((boxHeight / 2) * pixelsPerPoint),
      bottom: label.y + ((boxHeight / 2) * pixelsPerPoint)
    };
    if (projectBoundaryPixels.length > 1 &&
        mapLabelRectangleIntersectsProjectBoundary(pixelBox, projectBoundaryPixels, 4 * pixelsPerPoint)) continue;

    var overlapsExisting = false;
    for (var placedIndex = 0; placedIndex < placedBoxes.length; placedIndex++) {
      var placed = placedBoxes[placedIndex];
      if (box.left < placed.right && box.right > placed.left &&
          box.top < placed.bottom && box.bottom > placed.top) {
        overlapsExisting = true;
        break;
      }
    }
    if (overlapsExisting) continue;

    insertMapTextLabel(slide, text, centerX, centerY, boxWidth, boxHeight, fontSize, "#111111");
    placedBoxes.push(box);
  }
  return placedBoxes.length;
}

function mapLabelRectangleIntersectsProjectBoundary(rect, coords, clearancePx) {
  var minX = coords[0].x, maxX = coords[0].x;
  var minY = coords[0].y, maxY = coords[0].y;
  for (var i = 1; i < coords.length; i++) {
    minX = Math.min(minX, coords[i].x);
    maxX = Math.max(maxX, coords[i].x);
    minY = Math.min(minY, coords[i].y);
    maxY = Math.max(maxY, coords[i].y);
  }

  var overlapsVerticalEdgeRange = rect.bottom >= minY - clearancePx &&
    rect.top <= maxY + clearancePx;
  var overlapsHorizontalEdgeRange = rect.right >= minX - clearancePx &&
    rect.left <= maxX + clearancePx;
  var touchesVerticalEdge = (rect.left <= minX + clearancePx && rect.right >= minX - clearancePx) ||
    (rect.left <= maxX + clearancePx && rect.right >= maxX - clearancePx);
  var touchesHorizontalEdge = (rect.top <= minY + clearancePx && rect.bottom >= minY - clearancePx) ||
    (rect.top <= maxY + clearancePx && rect.bottom >= maxY - clearancePx);

  return (overlapsVerticalEdgeRange && touchesVerticalEdge) ||
    (overlapsHorizontalEdgeRange && touchesHorizontalEdge);
}

function insertMapTextLabel(slide, text, centerX, centerY, width, height, fontSize, color) {
  var textBox = slide.insertTextBox(text,
    pageContentX(centerX - (width / 2)), pageContentY(centerY - (height / 2)), width, height);
  textBox.getFill().setTransparent();
  textBox.setContentAlignment(SlidesApp.ContentAlignment.MIDDLE);
  var textRange = textBox.getText();
  textRange.getTextStyle().setFontFamily("Arial").setFontSize(fontSize).setBold(true).setForegroundColor(color);
  textRange.getParagraphs()[0].getRange().getParagraphStyle()
    .setParagraphAlignment(SlidesApp.ParagraphAlignment.CENTER);
}

function soilGeometryToPolygons(geometry) {
  if (geometry.type === "Polygon") return [geometry.coordinates];
  if (geometry.type === "MultiPolygon") return geometry.coordinates;
  return [];
}

function soilProjectRings(polygonRings, bbox, width, height) {
  var spanX = bbox[2] - bbox[0];
  var spanY = bbox[3] - bbox[1];
  if (spanX <= 0 || spanY <= 0) throw new Error("Invalid soil map extent.");
  return polygonRings.map(function(ring) {
    return ring.map(function(point) {
      return {
        x: ((point[0] - bbox[0]) / spanX) * width,
        y: ((bbox[3] - point[1]) / spanY) * height
      };
    });
  });
}

function soilFillPolygon(rgba, width, height, rings, color, alpha) {
  var minimumY = height;
  var maximumY = -1;
  for (var ringIndex = 0; ringIndex < rings.length; ringIndex++) {
    for (var pointIndex = 0; pointIndex < rings[ringIndex].length; pointIndex++) {
      var pointY = rings[ringIndex][pointIndex].y;
      minimumY = Math.min(minimumY, pointY);
      maximumY = Math.max(maximumY, pointY);
    }
  }
  var firstRow = Math.max(0, Math.floor(minimumY));
  var lastRow = Math.min(height - 1, Math.ceil(maximumY));
  var bestLabel = null;
  for (var y = firstRow; y <= lastRow; y++) {
    var scanY = y + 0.5;
    var intersections = [];
    for (var ringIndex = 0; ringIndex < rings.length; ringIndex++) {
      var ring = rings[ringIndex];
      for (var edgeIndex = 0; edgeIndex < ring.length; edgeIndex++) {
        var first = ring[edgeIndex];
        var second = ring[(edgeIndex + 1) % ring.length];
        if ((first.y <= scanY && second.y > scanY) || (second.y <= scanY && first.y > scanY)) {
          intersections.push(first.x + ((scanY - first.y) * (second.x - first.x)) / (second.y - first.y));
        }
      }
    }
    intersections.sort(function(a, b) { return a - b; });
    for (var pairIndex = 0; pairIndex + 1 < intersections.length; pairIndex += 2) {
      var left = Math.max(0, Math.ceil(intersections[pairIndex] - 0.5));
      var right = Math.min(width - 1, Math.floor(intersections[pairIndex + 1] - 0.5));
      if (right >= left && (!bestLabel || right - left > bestLabel.width)) {
        bestLabel = { x: (left + right + 1) / 2, y: y + 0.5, width: right - left + 1 };
      }
      for (var x = left; x <= right; x++) {
        var pixel = ((y * width) + x) * 4;
        rgba[pixel] = color[0];
        rgba[pixel + 1] = color[1];
        rgba[pixel + 2] = color[2];
        rgba[pixel + 3] = alpha;
      }
    }
  }
  return bestLabel;
}

function soilStrokeRing(rgba, width, height, ring, color, alpha) {
  for (var i = 0; i < ring.length; i++) {
    var first = ring[i];
    var second = ring[(i + 1) % ring.length];
    var clipped = soilClipLine(first.x, first.y, second.x, second.y, width, height);
    if (!clipped) continue;
    var x0 = Math.round(clipped[0]);
    var y0 = Math.round(clipped[1]);
    var x1 = Math.round(clipped[2]);
    var y1 = Math.round(clipped[3]);
    var dx = Math.abs(x1 - x0);
    var sx = x0 < x1 ? 1 : -1;
    var dy = -Math.abs(y1 - y0);
    var sy = y0 < y1 ? 1 : -1;
    var error = dx + dy;
    while (true) {
      if (x0 >= 0 && x0 < width && y0 >= 0 && y0 < height) {
        var pixel = ((y0 * width) + x0) * 4;
        rgba[pixel] = color[0];
        rgba[pixel + 1] = color[1];
        rgba[pixel + 2] = color[2];
        rgba[pixel + 3] = alpha;
      }
      if (x0 === x1 && y0 === y1) break;
      var doubledError = 2 * error;
      if (doubledError >= dy) {
        error += dy;
        x0 += sx;
      }
      if (doubledError <= dx) {
        error += dx;
        y0 += sy;
      }
    }
  }
}

function soilClipLine(x0, y0, x1, y1, width, height) {
  var dx = x1 - x0;
  var dy = y1 - y0;
  var lower = 0;
  var upper = 1;
  var p = [-dx, dx, -dy, dy];
  var q = [x0, width - 1 - x0, y0, height - 1 - y0];
  for (var i = 0; i < 4; i++) {
    if (p[i] === 0) {
      if (q[i] < 0) return null;
      continue;
    }
    var ratio = q[i] / p[i];
    if (p[i] < 0) {
      if (ratio > upper) return null;
      lower = Math.max(lower, ratio);
    } else {
      if (ratio < lower) return null;
      upper = Math.min(upper, ratio);
    }
  }
  if (lower > upper) return null;
  return [x0 + lower * dx, y0 + lower * dy, x0 + upper * dx, y0 + upper * dy];
}

function soilHexToRgb(hex) {
  var value = String(hex).replace(/^#/, "");
  if (!/^[0-9a-f]{6}$/i.test(value)) throw new Error("Invalid soil color: " + hex);
  return [
    parseInt(value.substring(0, 2), 16),
    parseInt(value.substring(2, 4), 16),
    parseInt(value.substring(4, 6), 16)
  ];
}

function soilEncodePng(width, height, rgba) {
  var rowLength = width * 4 + 1;
  var scanlines = new Uint8Array(rowLength * height);
  for (var y = 0; y < height; y++) {
    var rowStart = y * rowLength;
    scanlines[rowStart] = 0;
    scanlines.set(rgba.subarray(y * width * 4, (y + 1) * width * 4), rowStart + 1);
  }

  var gzipBytes = Utilities.gzip(Utilities.newBlob(scanlines, "application/octet-stream")).getBytes();
  var deflateStart = 10;
  var gzipFlags = gzipBytes[3] & 255;
  if (gzipFlags & 4) deflateStart += 2 + (gzipBytes[deflateStart] & 255) + ((gzipBytes[deflateStart + 1] & 255) << 8);
  if (gzipFlags & 8) while (gzipBytes[deflateStart++] !== 0) {}
  if (gzipFlags & 16) while (gzipBytes[deflateStart++] !== 0) {}
  if (gzipFlags & 2) deflateStart += 2;
  var deflateEnd = gzipBytes.length - 8;

  // PNG uses a zlib wrapper around the same DEFLATE stream stored in gzip.
  var zlibStream = new Uint8Array(2 + deflateEnd - deflateStart + 4);
  zlibStream[0] = 0x78;
  zlibStream[1] = 0x9c;
  for (var deflateIndex = deflateStart; deflateIndex < deflateEnd; deflateIndex++) {
    zlibStream[2 + deflateIndex - deflateStart] = gzipBytes[deflateIndex] & 255;
  }
  var adler = soilAdler32(scanlines);
  var adlerOffset = zlibStream.length - 4;
  zlibStream[adlerOffset] = (adler >>> 24) & 255;
  zlibStream[adlerOffset + 1] = (adler >>> 16) & 255;
  zlibStream[adlerOffset + 2] = (adler >>> 8) & 255;
  zlibStream[adlerOffset + 3] = adler & 255;

  var png = soilConcatBytes([
    new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]),
    soilPngChunk("IHDR", soilBuildPngHeader(width, height)),
    soilPngChunk("IDAT", zlibStream),
    soilPngChunk("IEND", new Uint8Array(0))
  ]);
  return Utilities.newBlob(png, "image/png", "soil-map.png");
}

function soilBuildPngHeader(width, height) {
  return new Uint8Array([
    (width >>> 24) & 255, (width >>> 16) & 255, (width >>> 8) & 255, width & 255,
    (height >>> 24) & 255, (height >>> 16) & 255, (height >>> 8) & 255, height & 255,
    8, 6, 0, 0, 0
  ]);
}

function soilPngChunk(type, data) {
  var typeBytes = new Uint8Array([type.charCodeAt(0), type.charCodeAt(1), type.charCodeAt(2), type.charCodeAt(3)]);
  var crcInput = soilConcatBytes([typeBytes, data]);
  var chunk = new Uint8Array(data.length + 12);
  chunk[0] = (data.length >>> 24) & 255;
  chunk[1] = (data.length >>> 16) & 255;
  chunk[2] = (data.length >>> 8) & 255;
  chunk[3] = data.length & 255;
  chunk.set(typeBytes, 4);
  chunk.set(data, 8);
  var crc = soilCrc32(crcInput);
  var crcOffset = chunk.length - 4;
  chunk[crcOffset] = (crc >>> 24) & 255;
  chunk[crcOffset + 1] = (crc >>> 16) & 255;
  chunk[crcOffset + 2] = (crc >>> 8) & 255;
  chunk[crcOffset + 3] = crc & 255;
  return chunk;
}

function soilCrc32(bytes) {
  var crc = 0xffffffff;
  for (var i = 0; i < bytes.length; i++) {
    crc = (crc >>> 8) ^ soilCrcTable[(crc ^ (bytes[i] & 255)) & 255];
  }
  return (crc ^ 0xffffffff) >>> 0;
}

var soilCrcTable = (function() {
  var table = new Uint32Array(256);
  for (var n = 0; n < 256; n++) {
    var crc = n;
    for (var bit = 0; bit < 8; bit++) {
      crc = (crc & 1) ? (0xedb88320 ^ (crc >>> 1)) : (crc >>> 1);
    }
    table[n] = crc >>> 0;
  }
  return table;
})();

function soilAdler32(bytes) {
  var a = 1;
  var b = 0;
  for (var i = 0; i < bytes.length; i++) {
    a += bytes[i] & 255;
    b += a;
    if ((i % 5552) === 5551) {
      a %= 65521;
      b %= 65521;
    }
  }
  a %= 65521;
  b %= 65521;
  return ((b << 16) | a) >>> 0;
}

function soilConcatBytes(parts) {
  var totalLength = 0;
  for (var i = 0; i < parts.length; i++) totalLength += parts[i].length;
  var result = new Uint8Array(totalLength);
  var offset = 0;
  for (var partIndex = 0; partIndex < parts.length; partIndex++) {
    result.set(parts[partIndex], offset);
    offset += parts[partIndex].length;
  }
  return result;
}

function calculateScaleFromBbox(bbox, mapWidthInches) {
  var centerLat = (bbox[1] + bbox[3]) / 2;
  var lngDiff = bbox[2] - bbox[0];
  var metersPerDegree = 111320 * Math.cos(centerLat * Math.PI / 180);
  var totalWidthMeters = lngDiff * metersPerDegree;
  var metersPerInch = totalWidthMeters / mapWidthInches;
  return Math.round(metersPerInch);
}

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

function getBoundingBoxForScale(centroid, scale, widthInches, heightInches) {
  var centerLng = centroid[0], centerLat = centroid[1];
  var totalWidthMeters = (widthInches || 7.5) * 0.0254 * (scale || 15000);
  var totalHeightMeters = (heightInches || 8.65) * 0.0254 * (scale || 15000); 

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

  var poly = slide.insertShape(SlidesApp.ShapeType.RECTANGLE,
    pageContentX(minX), pageContentY(minY), w, h);
  poly.getFill().setTransparent();
  poly.getBorder().getLineFill().setSolidFill("#800080");
  poly.getBorder().setWeight(3);
}

/**
 * Generates copy-pasteable POST requests for debugging firewall blocks
 */

/**
 * Generates copy-pasteable Python scripts for debugging firewall blocks
 */
function logPostDebugCommands(url, payload, isXml) {
  Logger.log("\n================ DEBUG PYTHON COMMAND ================\n");
  
  var pythonScript = "";
  if (isXml) {
    // Attempt 1: Pure XML POST (text/xml)
    pythonScript = 'import requests\n\n' +
                   'url = "' + url + '"\n' +
                   'headers = {"Content-Type": "text/xml"}\n' +
                   'payload = """' + payload + '"""\n\n' +
                   'response = requests.post(url, headers=headers, data=payload)\n' +
                   'print("Status Code:", response.status_code)\n' +
                   'print("Content-Type:", response.headers.get("Content-Type"))\n' +
                   'print("Response:", response.text[:200])';
  } else {
    // Attempt 2: Clean Form POST (application/x-www-form-urlencoded)
    pythonScript = 'import requests\n\n' +
                   'url = "' + url + '"\n' +
                   'headers = {"Content-Type": "application/x-www-form-urlencoded"}\n' +
                   'payload = "' + payload + '"\n\n' +
                   'response = requests.post(url, headers=headers, data=payload)\n' +
                   'print("Status Code:", response.status_code)\n' +
                   'print("Content-Type:", response.headers.get("Content-Type"))\n' +
                   'print("Response:", response.text[:200])';
  }
  
  Logger.log(pythonScript + "\n\n======================================================\n");
}

function logPostDebugCommander(url, payload) {
  Logger.log("\n================ DEBUG POST COMMANDS ================\n");
  
  // 1. Browser Console (Fetch API)
  var jsFetch = 'fetch("' + url + '", {\n' +
                '  method: "POST",\n' +
                '  headers: { "Content-Type": "application/x-www-form-urlencoded" },\n' +
                '  body: "' + payload + '"\n' +
                '}).then(res => { console.log("Status:", res.status); return res.text(); }).then(text => console.log("Response:", text.substring(0, 200)));';
  Logger.log("--- 1. BROWSER CONSOLE (FETCH) ---\n" + jsFetch + "\n");

  // 2. Python (Requests Library)
  var pythonScript = 'import requests\n' +
                     'url = "' + url + '"\n' +
                     'headers = {"Content-Type": "application/x-www-form-urlencoded"}\n' +
                     'payload = "' + payload + '"\n' +
                     'response = requests.post(url, headers=headers, data=payload)\n' +
                     'print("Status Code:", response.status_code)\n' +
                     'print("Response:", response.text[:200])';
  Logger.log("--- 2. PYTHON (REQUESTS) ---\n" + pythonScript + "\n");

  // 3. PowerShell
  var psCommand = 'Invoke-WebRequest -Uri "' + url + '" -Method POST -ContentType "application/x-www-form-urlencoded" -Body "' + payload + '"';
  Logger.log("--- 3. POWERSHELL ---\n" + psCommand + "\n");
  
  Logger.log("=====================================================\n");
}

function fetchDefaultSld() {
  // Try the NextGen server first
  var url = "https://SDMDataAccess.sc.egov.usda.gov/Spatial/SDM.wms?SERVICE=WMS&VERSION=1.1.1&REQUEST=GetStyles&LAYERS=mapunitpoly";
  
  try {
    var response = UrlFetchApp.fetch(url, {muteHttpExceptions: true});
    Logger.log("=== DEFAULT SLD FROM SERVER ===\n\n" + response.getContentText());
  } catch (e) {
    Logger.log("Fetch failed: " + e.message);
  }
}