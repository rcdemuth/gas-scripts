var NEPA_MAP_MAX_DRAWN_SEGMENTS = 5000;
var NEPA_MAP_TURTLE_GLYPH = "\uD83D\uDC22";
var NEPA_MAP_LWCF_GLYPH = String.fromCodePoint(0x1F3DE) + "\uFE0E";
var NEPA_MAP_LWCF_FONT_FAMILY = "Noto Sans Symbols 2";
var NEPA_MAP_GLYPH_TEMPLATE_ALT_TEXT = "Off_Screen_0_Padding";
var NEPA_MAP_LEGEND_GLYPH_TEMPLATE_ALT_TEXT = "Legend_Box_No_Padding_DO_NOT_RESIZE";
var NEPA_MAP_EMOJI_FONT_FAMILY = "Noto Emoji";
var NEPA_MAP_TURTLE_FONT_FAMILY = NEPA_MAP_EMOJI_FONT_FAMILY;
var NEPA_MAP_STATE_GREEN = "#38761D";
var NEPA_MAP_MAX_POINT_SYMBOL_SIZE_PT = 9;
var NEPA_SHPO_MAP_SERVICE_URL = "https://services.wvgis.wvu.edu/ArcGIS/rest/services/Society/wv_SHPO_public/MapServer";
var NEPA_PROTECTED_LANDS_MAP_SERVICE_URL = "https://services.wvgis.wvu.edu/ArcGIS/rest/services/Boundaries/wv_protected_lands/MapServer";
var NEPA_PROTECTED_LANDS_LEGEND_ASSETS = {
  sharedLands: "iVBORw0KGgoAAAANSUhEUgAAABQAAAAUCAYAAACNiR0NAAAACXBIWXMAAA7EAAAOxAGVKw4bAAAAATklEQVQ4jWOJy2ua+pOB04GBCoCd4fsBFpBhK5lKtKhhYPi/HgYWBioDllEDKQYslBuBCkYNpBywUMEMFDBq4IgIQ3aG7wdAJS01AMgsAHjEDv0dUv6GAAAAAElFTkSuQmCC",
  localLands: "iVBORw0KGgoAAAANSUhEUgAAABQAAAAUCAYAAACNiR0NAAAAT0lEQVQ4jWMpjCubyviT2YGBCuA/+98DLCDDhFbqa1HDwHfhFxlYGKgMWEYNpBiwUG4EKhg1kHLAQgUzUMCogSMiDP+z/z0AKmmpAUBmAQB8axIu2vHSDQAAAABJRU5ErkJggg==",
  wildlife: "iVBORw0KGgoAAAANSUhEUgAAABQAAAAUCAYAAACNiR0NAAAACXBIWXMAAA7EAAAOxAGVKw4bAAAA00lEQVQ4jbVUwRHDIAyT7zxN2Yd5uk7JEl2CLtEhnIPSHiEOGO6qVwBHCAnM8sAdhBvm4QDEw1jw5ERGHl4ChDzo6u/ReoIEBM5fANrilmBEVuB+hAtqtJqYCJ1FjVUxJ1by2eAujEeGeuRalYVMSh2AjVcIWlCpP6SsEdVjLQRNAGuhzCr7SyjyUat7aCHQNpTWwxmyK5vYQqSZ37vYQ1gVo3h4Snkldao8PKVsecu9e4heQW8TZe7YviwKBogMwVtCbuV1O/9iK8RBWWsfQ4TgtQM0JHEhR1GZngAAAABJRU5ErkJggg==",
  stateLands: "iVBORw0KGgoAAAANSUhEUgAAABQAAAAUCAYAAACNiR0NAAAATklEQVQ4jWNpioubyvnzpwMDFcB3dvYDLCDDSlau1KKGgT3h4QwsDFQGLKMGUgxYKDcCFYwaSDlgoYIZKGDUwBERht/Z2Q+ASlpqAJBZADo0EE2ukLNFAAAAAElFTkSuQmCC",
  federalLands: "iVBORw0KGgoAAAANSUhEUgAAABQAAAAUCAYAAACNiR0NAAAATUlEQVQ4jWPJq8ibysDM4MBADfCX4QALyDBWc1Ytapj3++RvBhYGKgOWUQMpBiyUG4EKRg2kHLBQwQwUMGrgyAjDvwwHQCUtVcBfhgMAWNYN4EzJaNQAAAAASUVORK5CYII="
};
var NEPA_MAP_LEGEND_ORDER = [
  "Project Area",
  "LWCF Projects",
  "Bat Captures",
  "Bat Roosts",
  "Hibernacula",
  "High Box Turt Habitat",
  "High Box Turt Crossing Risk",
  "Federal Mussel Streams",
  "State Mussel Streams",
  "Architectural Point",
  "National Register Point",
  "Cemeteries Point",
  "Architectural Poly",
  "National Register Poly",
  "Cemeteries Poly",
  "USGS Cemeteries",
  "Comm Nav Streams",
  "Fed Aid Routes",
  "FS Admin Limit",
  "NPS Admin Limit",
  "Federally Owned",
  "USACE",
  "USFWS",
  "State Forest",
  "State Park",
  "State Wildlife Center",
  "State Nature Area",
  "WMAs",
  "State Wildlife Sanctuary",
  "Protected Local Lands",
  "Private Protected Lands",
  "WVDEP Wetlands",
  "Airport Footprints"
];
var NEPA_MAP_ALWAYS_LEGEND_LAYERS = [
  "Bat Captures",
  "Bat Roosts",
  "Hibernacula",
  "High Box Turt Habitat",
  "High Box Turt Crossing Risk",
  "Architectural Point",
  "National Register Point",
  "Cemeteries Point",
  "Architectural Poly",
  "National Register Poly",
  "Cemeteries Poly",
  "USGS Cemeteries",
  "State Forest",
  "State Park",
  "Wildlife Management Area"
];
var NEPA_MAP_MAX_MARKER_FILL_SYMBOLS = 2500;
var NEPA_PROTECTED_LANDS_LEGEND_ITEMS = [
  { layerId: 14, label: "TNC Nature Preserves", imageKey: "sharedLands" },
  { layerId: 15, label: "Easements", imageKey: "sharedLands" },
  { layerId: 16, label: "Private Lands", imageKey: "sharedLands" },
  { layerId: 12, label: "Local Lands", imageKey: "localLands" },
  { layerId: 6, label: "WMAs", imageKey: "wildlife" },
  { layerId: 7, label: "Wildlife Center", imageKey: "wildlife" },
  { layerId: 8, label: "Wildlife Sanctuary", imageKey: "wildlife" },
  { layerId: 9, label: "Nature Area", imageKey: "wildlife" },
  { layerId: 10, label: "State Park", imageKey: "stateLands" },
  { layerId: 11, label: "State Forest", imageKey: "stateLands" },
  { layerId: 1, label: "National Forest", imageKey: "federalLands" },
  { layerId: 2, label: "National Park Service", imageKey: "federalLands" },
  { layerId: 3, label: "U.S. Fish and Wildlife Service", imageKey: "federalLands" },
  { layerId: 4, label: "U.S. Army Corps of Engineers", imageKey: "federalLands" }
];
var NEPA_SHPO_LEGEND_ITEMS = [
  {
    layerId: 0,
    label: "Architectural Point",
    imageData: "iVBORw0KGgoAAAANSUhEUgAAABQAAAAUCAYAAACNiR0NAAAACXBIWXMAAA7EAAAOxAGVKw4bAAAAw0lEQVQ4je3QMUsCARgG4Mc8gqIhJAhabBEbbgrabwmkrd+Qi6PQ3G9ocm7QH+Hi4NDocv6BhsDB1iCIruEIj+DEO+Um3/H7+B4+3sCOE+zBajqMOP3gKeYRP1uBN3QWjNo0vrg/I3rlrRQYMkh46HBYxwWXE+bX9GYMC4Et4ibhVWZ2jDtOpryERHO6G4Pn/7C/HKSd1sfcFvqwlrdYwUkhsGyCysBPLNccfqd1bg4m9OO8JY54LwTOeFYiQZmjPSibXxlSHxdTuipHAAAAAElFTkSuQmCC"
  },
  {
    layerId: 1,
    label: "National Register Point",
    imageData: "iVBORw0KGgoAAAANSUhEUgAAABQAAAAUCAYAAACNiR0NAAAACXBIWXMAAA7EAAAOxAGVKw4bAAAA2ElEQVQ4je3SvQtBURjH8W/dk2tQyn+glEEGbgwWxabM3pLRLmWQSWwGL5mZGGTxD1hMGGWwKEUpdbOLhZKuuveSyW98ns7nnOfpCL4c8Qd/tkMrEAdGwPVT0G3HUb8ixmeOHaAMqGbBjAtvLkspLCF8K+b5AY0m0AKWhkAZuRsloYSIBe8lp4fApEK/WCWXBrxATzfoJxIJEXO/3iMjt2sMU2WSiqEXSgjLux5gAy6GQLMRPwNPHNQdm4VWb8/Wcv+b+sE1i8IaTe+RmdGRp5iIMHPoD/KcGxKXKTCQLdI/AAAAAElFTkSuQmCC"
  },
  {
    layerId: 2,
    label: "Cemeteries Point",
    imageData: "iVBORw0KGgoAAAANSUhEUgAAABQAAAAUCAYAAACNiR0NAAAACXBIWXMAAA7EAAAOxAGVKw4bAAABAElEQVQ4jWNhoDJgGTVwiIVh0XTHYBCtoiiY+OLzJ4ZDVx8sONBwZw1ZBmZMd4oNdzFbCGLriOsyvvn6jOE/z2GvZ8V/EkFit3ofLCTZheQAFpwy3L8LJXlFGEFMdk51BhGm/wxy/CKM3/79KIKqIM2Fp57c5rv69jaYzcj8i+HN9y8M9z8+Yfj46RMvWS68efvr2tlntpWB2OqS/Awff/xkuHn/I4OGCNdakNhphm+kGSh6X7j+LPt7QRD7neKPSGFuNgY5Ru4V91/+r4WoeEOageQCFlwSDw48+MFwgCENxJaytMx/xvCYYe3x+9/JNhAZHD9+nKBBMDBafDFQDABBplZ8g1QOWgAAAABJRU5ErkJggg=="
  },
  {
    layerId: 3,
    label: "Architectural Poly",
    imageData: "iVBORw0KGgoAAAANSUhEUgAAABQAAAAUCAYAAACNiR0NAAAATklEQVQ4jWMx0bZqERIQcWCgAnj34c0BFpBhi5o3WlPDwLhafwYWBioDllEDKQYslBuBCkYNpBywUMEMFDBq4IgIw3cf3hwAlbTUACCzAJFTEV0KcDUjAAAAAElFTkSuQmCC"
  },
  {
    layerId: 4,
    label: "National Register Poly",
    imageData: "iVBORw0KGgoAAAANSUhEUgAAABQAAAAUCAYAAACNiR0NAAAATklEQVQ4jWPRNrFqERAScWCgAvjw7s0BFpBhzYs2WlPDwNo4fwYWBioDllEDKQYslBuBCkYNpBywUMEMFDBq4IgIww/v3hwAlbTUACCzAJFrEV20CmbgAAAAAElFTkSuQmCC"
  },
  {
    layerId: 5,
    label: "Cemeteries Poly",
    imageData: "iVBORw0KGgoAAAANSUhEUgAAABQAAAAUCAYAAACNiR0NAAAATklEQVQ4jWMxsNJuERARcGCgAvjw5sMBFpBhkzc2W1PDwFz/WgYWBioDllEDKQYslBuBCkYNpBywUMEMFDBq4IgIww9vPhwAlbTUACCzAJFrEV20CmbgAAAAAElFTkSuQmCC"
  }
];
var NEPA_MAP_LAYER_SYMBOLOGY = {
  "WVDEP Wetlands": {
    field: "wetland_type",
    defaultStyle: { polygon: { fillColor: "#FFAA00", fillStyle: "esriSFSBackwardDiagonal", fillAlpha: 255, outlineColor: "#FFAA00", outlineWidth: 2.67 } },
    classes: [
      { values: ["Estuarine and Marine Deepwater"], style: { polygon: { fillColor: "#FFBEE8", fillStyle: "esriSFSBackwardDiagonal", fillAlpha: 255, outlineColor: "#FFBEE8", outlineWidth: 2 } } },
      { values: ["Estuarine and Marine Wetland"], style: { polygon: { fillColor: "#E1B6FC", fillStyle: "esriSFSBackwardDiagonal", fillAlpha: 255, outlineColor: "#E8BEFF", outlineWidth: 2 } } },
      { values: ["Freshwater Emergent Wetland"], style: { polygon: { fillColor: "#73B2FF", fillStyle: "esriSFSBackwardDiagonal", fillAlpha: 255, outlineColor: "#7AB6F5", outlineWidth: 2.67 } } },
      { values: ["Freshwater Forested/Shrub Wetland"], style: { polygon: { fillColor: "#9ED7C2", fillStyle: "esriSFSBackwardDiagonal", fillAlpha: 255, outlineColor: "#9ED7C2", outlineWidth: 2.67 } } },
      { values: ["Freshwater Pond"], style: { polygon: { fillColor: "#BEE8FF", fillStyle: "esriSFSBackwardDiagonal", fillAlpha: 255, outlineColor: "#BEE8FF", outlineWidth: 2.67 } } },
      { values: ["Lake"], style: { polygon: { fillColor: "#00C5FF", fillStyle: "esriSFSBackwardDiagonal", fillAlpha: 255, outlineColor: "#00C5FF", outlineWidth: 2.67 } } },
      { values: ["Riverine"], style: { polygon: { fillColor: "#BEFFE8", fillStyle: "esriSFSBackwardDiagonal", fillAlpha: 255, outlineColor: "#BEFFE8", outlineWidth: 2 } } },
      { values: ["Other"], style: { polygon: { fillColor: "#FFAA00", fillStyle: "esriSFSBackwardDiagonal", fillAlpha: 255, outlineColor: "#FFAA00", outlineWidth: 2.67 } } }
    ]
  },
  "Comm Nav Streams": { line: { color: "#FF0000", width: 4.67, dotSize: 4.67, dotSpacing: 16 } },
  "Fed Aid Routes": { line: { color: "#0070FF", width: 4.67, dotSize: 4.67, dotSpacing: 16, legendDotOffsets: [1, 9] } },
  "Architectural Point": { point: { color: "#730000", outlineColor: "#000000", outlineWidth: 0.5, size: 9, shape: "PENTAGON", anchorX: 0.5, anchorY: 0.5 } },
  "National Register Point": { point: { color: "#0070FF", outlineColor: "#000000", outlineWidth: 0.5, size: 9, shape: "PENTAGON", anchorX: 0.5, anchorY: 0.5 } },
  "Cemeteries Point": { point: { glyph: "🪦", fontFamily: NEPA_MAP_LWCF_FONT_FAMILY, color: "#E600A9", size: 9, boxWidth: 0.14 * 72, boxHeight: 0.1 * 72, bold: true } },
  "Architectural Poly": { polygon: { fillColor: "#730000", fillStyle: "esriSFSBackwardDiagonal", fillAlpha: 255, hatchSpacing: 8, hatchWidth: 1.33, outlineColor: "#730000", outlineWidth: 1.33 } },
  "National Register Poly": { polygon: { fillColor: "#0070FF", fillStyle: "esriSFSBackwardDiagonal", fillAlpha: 255, hatchSpacing: 8, hatchWidth: 1.33, outlineColor: "#0070FF", outlineWidth: 1.33 } },
  "Cemeteries Poly": { polygon: { fillColor: "#E600A9", fillStyle: "esriSFSBackwardDiagonal", fillAlpha: 255, hatchSpacing: 8, hatchWidth: 1.33, outlineColor: "#E600A9", outlineWidth: 1.33 } },
  "Bridge": { point: { color: "#98E600", outlineColor: "#98E600", outlineWidth: 0.5, size: 9 } },
  "LWCF_Projects": {
    label: "LWCF Projects",
    point: {
      glyph: NEPA_MAP_LWCF_GLYPH,
      fontFamily: NEPA_MAP_LWCF_FONT_FAMILY,
      color: "#4169E1",
      size: 9,
      boxWidth: 0.15 * 72,
      boxHeight: 0.15 * 72,
      bold: true
    }
  },
  "Airport Footprints": { polygon: { fillColor: "#808080", fillAlpha: 50, outlineColor: "#808080", outlineWidth: 1.33 } },
  "NHDMusselStreams": {
    label: "NHD Mussel Streams",
    field: "StreamGroup",
    defaultStyle: { line: { color: "#FFFF00", width: 4 } },
    classes: [
      { values: ["1", "3"], style: { line: { color: "#4CE600", width: 4 } } }
    ]
  },
  "High Box Turt Habitat": {
    label: "High Box Turtle Habitat",
    polygon: {
      fillColor: "#FF7100",
      fillStyle: "esriSFSSolid",
      fillAlpha: 0,
      outlineColor: "#FF7100",
      outlineWidth: 0.8,
      drawOutline: true,
      legendOutline: true,
      markerFill: {
        shape: "TRIANGLE",
        color: "#FF7100",
        outlineColor: "#FF7100",
        outlineWidth: 0.8,
        size: 10,
        spacingX: 60,
        spacingY: 60,
        rotation: 180,
        anchorY: 0.5
      }
    }
  },
  "High Box Turt Crossing Risk": {
    label: "High Box Turtle Crossing Risk",
    line: {
      glyph: NEPA_MAP_TURTLE_GLYPH,
      fontFamily: NEPA_MAP_TURTLE_FONT_FAMILY,
      glyphSize: 10,
      boxWidth: 0.2 * 72,
      boxHeight: 0.2 * 72,
      glyphSpacing: 36,
      bold: true,
      color: "#FF7100"
    },
    point: { color: "#E64C00", outlineColor: "#000000", size: 9 },
    polygon: { fillColor: "#E64C00", fillAlpha: 100, outlineColor: "#000000", outlineWidth: 1 }
  },
  "Hibernacula": {
    label: "Bat Hibernacula",
    point: { color: "#730000", outlineColor: "#730000", outlineWidth: 0.8, size: 9, fillAlpha: 153, shape: "TRIANGLE", rotation: 90, anchorX: 0.5 },
    polygon: { outlineColor: "#730000", outlineWidth: 0.8, fillAlpha: 0, drawOutline: true, legendOutline: true },
    markerFill: { shape: "TRIANGLE", color: "#730000", outlineColor: "#730000", outlineWidth: 0.8, size: 10, spacingX: 60, spacingY: 60, rotation: 90, anchorX: 0.5 }
  },
  "Bat Roosts": {
    point: { color: "#E600A9", outlineColor: "#E600A9", outlineWidth: 0.8, size: 9, fillAlpha: 153, shape: "TRIANGLE", rotation: 270, anchorX: 0.5 },
    polygon: { outlineColor: "#E600A9", outlineWidth: 0.8, fillAlpha: 0, drawOutline: true, legendOutline: true },
    markerFill: { shape: "TRIANGLE", color: "#E600A9", outlineColor: "#E600A9", outlineWidth: 0.8, size: 10, spacingX: 60, spacingY: 60, rotation: 270, anchorX: 0.5 }
  },
  "Bat Captures": {
    point: { color: "#704489", outlineColor: "#704489", outlineWidth: 0.8, size: 9, fillAlpha: 153, shape: "TRIANGLE", anchorY: 0.5 },
    polygon: { outlineColor: "#704489", outlineWidth: 0.8, fillAlpha: 0, drawOutline: true, legendOutline: true },
    markerFill: { shape: "TRIANGLE", color: "#704489", outlineColor: "#704489", outlineWidth: 0.8, size: 10, spacingX: 60, spacingY: 60, anchorY: 0.5 }
  },
  "USGS Cemeteries": { point: { glyph: "🪦", fontFamily: NEPA_MAP_LWCF_FONT_FAMILY, color: "#007AC2", size: 9, boxWidth: 0.14 * 72, boxHeight: 0.1 * 72, bold: true } },
  "NPS Owned": { polygon: { fillColor: "#000000", fillStyle: "esriSFSDiagonalCross", fillAlpha: 255, hatchSpacing: 30, hatchWidth: 0.8, outlineColor: "#000000", outlineWidth: 0, drawOutline: false } },
  "FS Owned": { polygon: { fillColor: "#000000", fillStyle: "esriSFSDiagonalCross", fillAlpha: 255, hatchSpacing: 30, hatchWidth: 0.8, outlineColor: "#000000", outlineWidth: 0, drawOutline: false } },
  "USFWS": { polygon: { fillColor: "#004DA8", fillAlpha: 255, outlineColor: "#004DA8", outlineWidth: 0.5 } },
  "USACE": { polygon: { fillColor: "#E60000", fillAlpha: 255, outlineColor: "#E60000", outlineWidth: 0.5 } },
  "Wildlife Management Area": { polygon: { fillColor: "#730000", fillAlpha: 0, dotPattern: { spacing: 18, size: 1.5, color: "#730000" }, outlineColor: "#730000", outlineWidth: 0.8 } },
  "State Wildlife Center": {
    polygon: { outlineColor: NEPA_MAP_STATE_GREEN, outlineWidth: 0.4, fillAlpha: 0, drawOutline: true, legendOutline: true },
    markerFill: { glyph: "🫎", fontFamily: NEPA_MAP_EMOJI_FONT_FAMILY, bold: true, color: NEPA_MAP_STATE_GREEN, size: 25, spacingX: 20, spacingY: 20, anchorX: 0.5, anchorY: 0.5 }
  },
  "State Wildlife Sanctuary": {
    polygon: { outlineColor: NEPA_MAP_STATE_GREEN, outlineWidth: 0.4, fillAlpha: 0, drawOutline: true, legendOutline: true },
    markerFill: { glyph: "🐾", fontFamily: NEPA_MAP_EMOJI_FONT_FAMILY, bold: true, color: NEPA_MAP_STATE_GREEN, size: 25, spacingX: 20, spacingY: 20, anchorX: 0.5, anchorY: 0.5 }
  },
  "State Nature Area": {
    polygon: { outlineColor: NEPA_MAP_STATE_GREEN, outlineWidth: 0.4, fillAlpha: 0, drawOutline: true, legendOutline: true },
    markerFill: { glyph: "⛰︎", fontFamily: NEPA_MAP_EMOJI_FONT_FAMILY, bold: true, color: NEPA_MAP_STATE_GREEN, size: 25, spacingX: 20, spacingY: 20, anchorX: 0.5, anchorY: 0.5 }
  },
  "State Park": {
    polygon: { outlineColor: NEPA_MAP_STATE_GREEN, outlineWidth: 0.4, fillAlpha: 0, drawOutline: true, legendOutline: true },
    markerFill: { glyph: "⛺", fontFamily: NEPA_MAP_EMOJI_FONT_FAMILY, bold: true, color: NEPA_MAP_STATE_GREEN, size: 25, spacingX: 20, spacingY: 20, anchorX: 0.5, anchorY: 0.5 }
  },
  "State Forest": {
    polygon: { outlineColor: NEPA_MAP_STATE_GREEN, outlineWidth: 0.4, fillAlpha: 0, drawOutline: true, legendOutline: true },
    markerFill: { glyph: "🌲", fontFamily: NEPA_MAP_EMOJI_FONT_FAMILY, bold: true, color: NEPA_MAP_STATE_GREEN, size: 25, spacingX: 20, spacingY: 20, anchorX: 0.5, anchorY: 0.5 }
  },
  "Protected Local Lands": { polygon: { fillColor: "#00A9E6", fillStyle: "esriSFSVertical", fillAlpha: 255, outlineColor: "#00C5FF", outlineWidth: 1.33 } },
  "TNC Nature Preserves": { polygon: { fillColor: "#4C7300", fillStyle: "esriSFSVertical", fillAlpha: 255, outlineColor: "#4C7300", outlineWidth: 1.33 } },
  "Private Protected Lands": { polygon: { fillColor: "#FFFF00", fillStyle: "esriSFSVertical", fillAlpha: 255, outlineColor: "#FFFF00", outlineWidth: 2 } },
  "Easements": { polygon: { fillColor: "#F57A7A", fillStyle: "esriSFSVertical", fillAlpha: 255, outlineColor: "#F57A7A", outlineWidth: 1.33 } },
  "FS Admin Limit": { polygon: { fillColor: "#5C8944", fillAlpha: 255, outlineColor: "#5C8944", outlineWidth: 1 } },
  "NPS Admin Limit": { polygon: { fillColor: "#CDAA66", fillAlpha: 255, outlineColor: "#CDAA66", outlineWidth: 1 } }
};

async function createNepaSlidesMap(analysis, outputFolderId) {
  var title = sanitizeDriveName((analysis.projectName || NEPA_CONFIG.projectName) + " - NEPA Screening Map");
  var template = DriveApp.getFileById(NEPA_CONFIG.slidesTemplateId);
  var copy = template.makeCopy(title);
  var presentation = SlidesApp.openById(copy.getId());
  var oldSlides = presentation.getSlides();
  var slide = prepareNepaMapSlide(presentation, oldSlides);
  var warnings = [];
  var bbox = mapExtentForProject(analysis.metadata.bbox);
  var width = NEPA_CONFIG.mapWidthPt;
  var height = NEPA_CONFIG.mapHeightPt;
  var drawn = { segments: 0, reachedLimit: false };
  var visibleLayers = [{
    label: "Project Area",
    symbol: mapLegendSymbolForGeometry("Polygon", "#800080", null, 1.4)
  }];
  var processedMapServices = {};
  var mapLayers = getNepaMapLayers();
  var extentBatchCache = queryArcGisExtentBatchForMap(
    mapLayers, bbox, NEPA_CONFIG.mapFeatureLimit
  );
  var deferredFederalOwnedFeatures = [];
  mapLayers.filter(function(layer) { return !!layer.mapExportLayers; }).forEach(function(layer) {
    try {
      insertArcGisMapImage(slide, layer.source, null, bbox, true,
        0, 0, width, height, null, layer.mapExportLayers);
    } catch (error) {
      var exportMessage = error.message || String(error);
      var exportWarning = mapWarning(layer, exportMessage);
      warnings.push(exportWarning);
      Logger.log("Map layer unavailable: " + layer.name + " (expected at " +
        exportWarning.expectedLocation + "): " + exportMessage);
    }
  });
  var protectedMapServiceUrl = normalizeArcGisLayerUrl(NEPA_PROTECTED_LANDS_MAP_SERVICE_URL);
  var protectedMapLayers = mapLayers.filter(function(layer) {
    return normalizeArcGisLayerUrl(layer.mapServiceUrl || "") === protectedMapServiceUrl;
  });
  if (protectedMapLayers.length) {
    processedMapServices[protectedMapServiceUrl] = true;
    protectedMapLayers.forEach(function(layer) {
      if (!isScreeningLegendLayer(layer)) return;
      if (NEPA_MAP_ALWAYS_LEGEND_LAYERS.indexOf(layer.name) === -1 &&
          !isNativeMapVectorLayer(layer)) {
        try {
          var presenceQuery = queryArcGisExtentWithBatch(
            extentBatchCache, layer, bbox, 1
          );
          if (!presenceQuery.features.length) return;
        } catch (error) {
          var presenceMessage = error.message || String(error);
          var presenceWarning = mapWarning(layer, presenceMessage);
          warnings.push(presenceWarning);
          Logger.log("Map legend presence query unavailable for " + layer.name +
            " (expected at " + presenceWarning.expectedLocation + "): " +
            presenceMessage);
          return;
        }
      }
      if (isNativeMapVectorLayer(layer) &&
          NEPA_MAP_ALWAYS_LEGEND_LAYERS.indexOf(layer.name) === -1) return;
      var color = NEPA_CONFIG.colors[NEPA_CONFIG.layers.indexOf(layer) % NEPA_CONFIG.colors.length];
      visibleLayers.push(createMapLegendEntry(layer, [], color, null, warnings));
    });
    try {
      var protectedLayerIds = protectedMapLayers.map(function(layer) {
        return layer.mapServiceLayerId;
      }).filter(function(layerId, index) {
        return !isNativeMapVectorLayer(protectedMapLayers[index]);
      });
      insertArcGisMapImage(slide, protectedMapServiceUrl, protectedLayerIds.join(","),
        bbox, true, 0, 0, width, height,
        mapDynamicLayersForConfiguredLayers(protectedMapLayers.filter(function(layer) {
          return !isNativeMapVectorLayer(layer);
        })));
    } catch (error) {
      var protectedMapWarning = mapWarning({
        name: "Protected lands map service layers",
        longName: "NEPA\\screening\\Protected Lands",
        source: protectedMapServiceUrl
      }, error.message || String(error));
      warnings.push(protectedMapWarning);
      Logger.log("Map layer group unavailable (expected at " +
        protectedMapWarning.expectedLocation + "): " + protectedMapWarning.error);
    }
  }

  for (var i = 0; i < mapLayers.length; i++) {
    var layer = mapLayers[i];
    var color = NEPA_CONFIG.colors[NEPA_CONFIG.layers.indexOf(layer) % NEPA_CONFIG.colors.length];
    var legendFeatures = [];
    if (layer.mapExportLayers) continue;
    if (layer.mapServiceUrl) {
      var mapServiceUrl = normalizeArcGisLayerUrl(layer.mapServiceUrl);
      if (processedMapServices[mapServiceUrl]) {
        if (isNativeMapVectorLayer(layer)) {
          var nativeQuery = queryArcGisExtentWithBatch(
            extentBatchCache, layer, bbox, NEPA_CONFIG.mapFeatureLimit
          );
          nativeQuery.features.forEach(function(feature) {
            drawGeoJsonGeometry(slide, feature.geometry, bbox, width, height,
              mapStyleForFeature(layer, feature), drawn);
          });
          if (nativeQuery.truncated) {
            warnings.push(mapWarning(layer, "Map feature limit reached (" +
              NEPA_CONFIG.mapFeatureLimit + "); some features may be omitted."));
          }
          if (nativeQuery.features.length &&
              NEPA_MAP_ALWAYS_LEGEND_LAYERS.indexOf(layer.name) === -1) {
            var nativeLegendColor = NEPA_CONFIG.colors[
              NEPA_CONFIG.layers.indexOf(layer) % NEPA_CONFIG.colors.length
            ];
            visibleLayers.push(createMapLegendEntry(
              layer, nativeQuery.features, nativeLegendColor, null, warnings
            ));
          }
        }
        continue;
      }
      processedMapServices[mapServiceUrl] = true;
      var mapServiceLayers = mapLayers.filter(function(item) {
        return normalizeArcGisLayerUrl(item.mapServiceUrl || "") === mapServiceUrl;
      });
      var mapServiceLayerIds = mapServiceLayers.map(function(item) {
        return item.mapServiceLayerId;
      });
      var groupedLayer = {
        name: "WV SHPO screening layers",
        longName: "NEPA\\screening\\History\\WV SHPO",
        source: mapServiceUrl
      };
      mapServiceLayers.forEach(function(groupLayer) {
        if (!isScreeningLegendLayer(groupLayer)) return;
        var groupColor = NEPA_CONFIG.colors[
          NEPA_CONFIG.layers.indexOf(groupLayer) % NEPA_CONFIG.colors.length
        ];
        visibleLayers.push(createMapLegendEntry(groupLayer, [], groupColor, null, warnings));
      });
      try {
        insertArcGisMapImage(slide, mapServiceUrl, mapServiceLayerIds.join(","),
          bbox, true, 0, 0, width, height,
          mapDynamicLayersForConfiguredLayers(mapServiceLayers));
      } catch (error) {
        var groupMessage = error.message || String(error);
        var groupWarning = mapWarning(groupedLayer, groupMessage);
        warnings.push(groupWarning);
        Logger.log("Map layer group unavailable (expected at " +
          groupWarning.expectedLocation + "): " + groupMessage);
      }
      continue;
    }
    try {
      if (layer.sourceType === "DRIVE_GEOTIFF") {
        var rasterStyleForMap = mapStyleForFeature(layer, null);
        var rasterMarkerFill = rasterStyleForMap.polygon &&
          rasterStyleForMap.polygon.markerFill;
        var rasterOverlay = await createGeoTiffMapOverlay(
          layer, bbox, width, height, rasterMarkerFill, rasterStyleForMap.polygon
        );
        if (rasterOverlay) {
          if (rasterOverlay.blob) {
            slide.insertImage(rasterOverlay.blob)
              .setLeft(pageContentX(rasterOverlay.left))
              .setTop(pageContentY(rasterOverlay.top))
              .setWidth(rasterOverlay.width)
              .setHeight(rasterOverlay.height);
          }
          for (var rasterMarkerIndex = 0;
              rasterMarkerFill && rasterMarkerIndex < rasterOverlay.markers.length;
              rasterMarkerIndex++) {
            if ((drawn.markerSymbols || 0) >= NEPA_MAP_MAX_MARKER_FILL_SYMBOLS) {
              drawn.reachedLimit = true;
              break;
            }
            var rasterMarker = rasterOverlay.markers[rasterMarkerIndex];
            if (drawMapMarker(slide, rasterMarker, rasterMarkerFill,
                rasterMarkerFill.size, width, height)) {
              drawn.markerSymbols = (drawn.markerSymbols || 0) + 1;
            }
          }
          var rasterOutlineStyle = rasterStyleForMap.polygon;
          var rasterOutlineSegments = rasterOverlay.outlineSegments || [];
          for (var rasterOutlineIndex = 0;
              rasterOutlineStyle && rasterOutlineStyle.drawOutline !== false &&
                rasterOutlineIndex < rasterOutlineSegments.length;
              rasterOutlineIndex++) {
            drawMapPath(slide, rasterOutlineSegments[rasterOutlineIndex], false,
              bbox, width, height, {
                color: rasterOutlineStyle.outlineColor || rasterOutlineStyle.fillColor,
                width: rasterOutlineStyle.outlineWidth || 0.8
              }, drawn);
            if (drawn.segments >= NEPA_MAP_MAX_DRAWN_SEGMENTS) {
              drawn.reachedLimit = true;
              break;
            }
          }
        }
        if (isScreeningLegendLayer(layer) &&
            NEPA_MAP_ALWAYS_LEGEND_LAYERS.indexOf(layer.name) === -1) {
          visibleLayers.push(createMapLegendEntry(layer, [], color, null, warnings));
        }
        continue;
      }
      if (layer.special === "mussels") {
        var musselMapVariants = [
          { label: "Federal Mussel Streams", where: "StreamGroup <> '1' AND StreamGroup <> '3'" },
          { label: "State Mussel Streams", where: "StreamGroup = '1' OR StreamGroup = '3'" }
        ];
        musselMapVariants.forEach(function(variant) {
          var musselQuery = queryArcGisExtentWithBatch(
            extentBatchCache, layer, bbox, NEPA_CONFIG.mapFeatureLimit, variant.where
          );
          musselQuery.features.forEach(function(feature) {
            drawGeoJsonGeometry(slide, feature.geometry, bbox, width, height,
              mapStyleForFeature(layer, feature), drawn);
          });
          if (musselQuery.truncated) {
            warnings.push(mapWarning(layer,
              variant.label + " map feature limit reached (" +
              NEPA_CONFIG.mapFeatureLimit + "); some features may be omitted."));
          }
        });
        continue;
      }
      var mapServerLayer = parseMapServerLayer(layer.source);
      if (mapServerLayer) {
        if (layer.mapAsVector) {
          var mapServerQuery = queryArcGisExtentWithBatch(
            extentBatchCache, layer, bbox, NEPA_CONFIG.mapFeatureLimit
          );
          if (!mapServerQuery.features.length) continue;
          legendFeatures = mapServerQuery.features;
          for (var mapFeatureIndex = 0; mapFeatureIndex < mapServerQuery.features.length; mapFeatureIndex++) {
            var mapFeature = mapServerQuery.features[mapFeatureIndex];
            if (layer.drawAfterLayers) {
              deferredFederalOwnedFeatures.push({
                layer: layer,
                feature: mapFeature
              });
            } else {
              drawGeoJsonGeometry(slide, mapFeature.geometry, bbox, width, height,
                mapStyleForFeature(layer, mapFeature), drawn);
            }
          }
          if (mapServerQuery.truncated) {
            warnings.push(mapWarning(layer, "Map feature limit reached (" + NEPA_CONFIG.mapFeatureLimit + "); some features may be omitted."));
          }
        } else {
          if (mapServerLayer.layerId !== null) {
            var mapServerQuery = queryArcGisExtentWithBatch(
              extentBatchCache, layer, bbox, NEPA_CONFIG.mapFeatureLimit
            );
            if (!mapServerQuery.features.length) continue;
            legendFeatures = mapServerQuery.features;
          }
          insertArcGisMapImage(slide, mapServerLayer.serviceUrl, mapServerLayer.layerId,
            bbox, true, 0, 0, width, height,
            mapDynamicLayersForConfiguredLayers([layer], mapServerLayer.layerId));
        }
      } else {
        var query = queryArcGisExtentWithBatch(
          extentBatchCache, layer, bbox, NEPA_CONFIG.mapFeatureLimit
        );
        if (!query.features.length) continue;
        legendFeatures = query.features;
        for (var f = 0; f < query.features.length; f++) {
          var feature = query.features[f];
          drawGeoJsonGeometry(slide, feature.geometry, bbox, width, height,
            mapStyleForFeature(layer, feature), drawn);
        }
        if (query.truncated) {
          warnings.push(mapWarning(layer, "Map feature limit reached (" + NEPA_CONFIG.mapFeatureLimit + "); some features may be omitted."));
        }
      }
      if (isScreeningLegendLayer(layer) && layer.name !== "Bridge" &&
          !layer.drawAfterLayers &&
          NEPA_MAP_ALWAYS_LEGEND_LAYERS.indexOf(layer.name) === -1) {
        visibleLayers.push(createMapLegendEntry(layer, legendFeatures, color, mapServerLayer, warnings));
      }
    } catch (error) {
      var message = error.message || String(error);
      var warning = mapWarning(layer, message);
      Logger.log("Map layer unavailable: " + layer.name + " (expected at " +
        warning.expectedLocation + "): " + message);
      warnings.push(warning);
    }
  }

  deferredFederalOwnedFeatures.forEach(function(item) {
    drawGeoJsonGeometry(slide, item.feature.geometry, bbox, width, height,
      mapStyleForFeature(item.layer, item.feature), drawn);
  });
  appendConfiguredMapLegendEntries(visibleLayers, mapLayers);
  appendLwcfMapContent(slide, analysis, bbox, width, height, visibleLayers, drawn);

  drawGeoJsonGeometryCollection(slide, analysis.project.features, bbox, width, height, "#800080", drawn);
  if (drawn.reachedLimit) {
    warnings.push({
      name: "Map geometry rendering",
      displayName: "Map geometry rendering",
      status: "WARNING",
      features: [],
      error: "The native map shape budget was reached; some polygon fills or vector geometry may be omitted."
    });
  }

  drawMapViewportFrame(slide, width, height);
  addMapLegend(slide, orderMapLegendEntries(visibleLayers), width, height);
  drawMapScaleStrip(slide, bbox, width, height);
  addNepaMapFooter(slide, analysis, warnings);

  moveDriveFileToFolder(copy.getId(), outputFolderId);
  return { id: copy.getId(), url: copy.getUrl(), name: copy.getName(), warnings: warnings };
}

function getNepaMapLayers() {
  return NEPA_CONFIG.layers.filter(function(layer) {
    var longName = String(layer.longName || "");
    var pathParts = longName.split(/[\\/]+/).filter(function(part) { return part.length > 0; });
    if (!pathParts.length || pathParts[0].toLowerCase() !== "nepa") return false;
    if (pathParts.some(function(part) {
      var normalized = part.toLowerCase();
      return normalized.indexOf("extra") !== -1 ||
        normalized === "unmapped" || normalized === "symbology layers";
    })) return false;
    var layerName = String(layer.name || pathParts[pathParts.length - 1]).toLowerCase();
    return layerName !== "wvparcels" && layerName !== "bridge";
  });
}

function isScreeningLegendLayer(layer) {
  return layer.screen === true || layer.screenConditional === true;
}

function parseMapServerLayer(source) {
  var normalized = normalizeArcGisLayerUrl(source);
  var match = normalized.match(/^(.*\/MapServer)(?:\/(\d+))?$/i);
  return match ? { serviceUrl: match[1], layerId: match[2] === undefined ? null : Number(match[2]) } : null;
}

function createMapLegendEntry(layer, features, fallbackColor, mapServerLayer, warnings) {
  if (layer.mapServiceDefaultRenderer && layer.mapServiceUrl &&
      layer.mapServiceLayerId !== undefined) {
    var serviceLegendItem = mapServiceLegendItems(layer.mapServiceUrl).filter(function(item) {
      return item.layerId === layer.mapServiceLayerId;
    })[0];
    if (serviceLegendItem && serviceLegendItem.imageData) {
      return {
        label: serviceLegendItem.label,
        symbol: {
          kind: "image",
          imageData: serviceLegendItem.imageData,
          contentType: "image/png"
        }
      };
    }
  }
  var layerSymbology = mapLayerSymbology(layer);
  if (layerSymbology) {
    var feature = features && features.length ? features[0] : null;
    var featureSymbology = mapStyleForFeature(layer, feature);
    var geometryType = feature ? firstMapFeatureGeometryType([feature]) :
      mapGeometryTypeForConfiguredLayer(layer);
    return {
      label: mapLegendLabel(layer, layerSymbology),
      symbol: mapLegendSymbolForStyle(featureSymbology, geometryType, fallbackColor)
    };
  }
  var geometryType = firstMapFeatureGeometryType(features);
  var arcGisSymbol = null;
  if (mapServerLayer && mapServerLayer.layerId !== null) {
    try {
      var layerInfo = fetchArcGisMapLayerInfo(layer.source);
      geometryType = geometryType || geometryTypeFromArcGis(layerInfo.geometryType);
      arcGisSymbol = primaryArcGisRendererSymbol(layerInfo.drawingInfo && layerInfo.drawingInfo.renderer);
    } catch (error) {
      var message = "Could not read ArcGIS symbology for the legend; using a geometry-based symbol. " +
        (error.message || String(error));
      var warning = mapWarning(layer, message);
      warnings.push(warning);
      Logger.log("Map legend symbology unavailable for " + layer.name + " (expected at " +
        warning.expectedLocation + "): " + message);
    }
  }
  return {
    label: layer.mapLabel || layer.name,
    symbol: mapLegendSymbolForGeometry(geometryType, fallbackColor, arcGisSymbol)
  };
}

function mapGeometryTypeForConfiguredLayer(layer) {
  if (layer.mapServiceUrl &&
      normalizeArcGisLayerUrl(layer.mapServiceUrl) === normalizeArcGisLayerUrl(NEPA_SHPO_MAP_SERVICE_URL)) {
    return layer.mapServiceLayerId <= 2 ? "Point" : "Polygon";
  }
  return "";
}

function mapServiceLegendItems(serviceUrl) {
  var normalizedUrl = normalizeArcGisLayerUrl(serviceUrl);
  if (normalizedUrl === normalizeArcGisLayerUrl(NEPA_SHPO_MAP_SERVICE_URL)) {
    return NEPA_SHPO_LEGEND_ITEMS;
  }
  return [];
}

function appendLwcfMapContent(slide, analysis, bbox, width, height, visibleLayers, drawn) {
  var results = analysis && Array.isArray(analysis.results) ? analysis.results : [];
  var features = [];
  var seen = {};
  results.forEach(function(result) {
    if (result.name !== "LWCF_Projects" && result.name !== "buff_LWCF_Projects") return;
    (result.features || []).forEach(function(feature) {
      var properties = feature.properties || {};
      var key = "";
      Object.keys(properties).some(function(propertyName) {
        if (!/^(unique_id|objectid|fid|oid)$/i.test(propertyName)) return false;
        key = propertyName.toLowerCase() + ":" + properties[propertyName];
        return true;
      });
      if (!key) key = JSON.stringify(feature);
      if (seen[key]) return;
      seen[key] = true;
      features.push(feature);
    });
  });
  if (!features.length) return;

  var layer = { name: "LWCF_Projects" };
  features.forEach(function(feature) {
    drawGeoJsonGeometry(slide, feature.geometry, bbox, width, height,
      mapStyleForFeature(layer, feature), drawn);
  });
  visibleLayers.push(createMapLegendEntry(
    layer, features, "#4169E1", null, []
  ));
}

function mapLayerSymbology(layer) {
  return NEPA_MAP_LAYER_SYMBOLOGY[String(layer && layer.name || "")] || null;
}

function mapLegendLabel(layer, symbology) {
  if (layer.mapServiceUrl &&
      normalizeArcGisLayerUrl(layer.mapServiceUrl) === normalizeArcGisLayerUrl(NEPA_PROTECTED_LANDS_MAP_SERVICE_URL)) {
    var protectedItem = NEPA_PROTECTED_LANDS_LEGEND_ITEMS.filter(function(item) {
      return item.layerId === layer.mapServiceLayerId;
    })[0];
    if (protectedItem) return protectedItem.label;
  }
  if (layer.name === "Wildlife Management Area") return "WMAs";
  return layer.mapLabel || symbology && symbology.label || layer.name;
}

function mapStyleForFeature(layer, feature) {
  var symbology = mapLayerSymbology(layer);
  if (!symbology) return null;
  if (layer.sourceType === "DRIVE_GEOTIFF" && symbology.polygon) {
    var rasterStyle = layer.rasterStyle || {};
    var opacity = Number(rasterStyle.opacity);
    return {
      polygon: {
        fillColor: rasterStyle.color || symbology.polygon.fillColor,
        fillStyle: "esriSFSSolid",
        fillAlpha: symbology.polygon.markerFill ? 0 : isFinite(opacity)
          ? Math.max(0, Math.min(255, Math.round(opacity * 255)))
          : symbology.polygon.fillAlpha,
        outlineColor: rasterStyle.color || symbology.polygon.outlineColor,
        outlineWidth: symbology.polygon.outlineWidth || 0.8,
        drawOutline: symbology.polygon.drawOutline,
        legendOutline: symbology.polygon.legendOutline,
        markerFill: symbology.polygon.markerFill
      }
    };
  }
  if (!feature || !symbology.field || !symbology.classes) {
    return symbology.defaultStyle || symbology;
  }
  var properties = feature.properties || feature.attributes || {};
  var value = "";
  var fieldName = symbology.field.toLowerCase();
  Object.keys(properties).some(function(key) {
    if (key.toLowerCase() !== fieldName) return false;
    value = String(properties[key]);
    return true;
  });
  for (var i = 0; i < symbology.classes.length; i++) {
    var styleClass = symbology.classes[i];
    if (styleClass.values.some(function(classValue) {
      return String(classValue).toLowerCase() === value.toLowerCase();
    })) return styleClass.style;
  }
  return symbology.defaultStyle || symbology;
}

function mapLegendSymbolForStyle(style, geometryType, fallbackColor) {
  style = style || {};
  var geometry = String(geometryType || "").toLowerCase();
  if (style.polygon && style.polygon.dotPattern) {
    return {
      kind: "polygon-dot",
      color: style.polygon.dotPattern.color || style.polygon.fillColor || fallbackColor,
      outlineColor: style.polygon.outlineColor || style.polygon.fillColor || fallbackColor,
      weight: style.polygon.outlineWidth || 0.8
    };
  }
  var markerFill = style.markerFill ||
    style.polygon && style.polygon.markerFill;
  if (markerFill) {
    var polygon = style.polygon || {};
    return {
      kind: "marker-fill",
      markerFill: markerFill,
      polygonOutline: polygon.legendOutline ? {
        color: polygon.outlineColor || markerFill.outlineColor || markerFill.color || fallbackColor,
        width: polygon.outlineWidth || 0.8
      } : null
    };
  }
  if (geometry.indexOf("point") !== -1 && style.point) {
    if (style.point.glyph) {
      return {
        kind: "glyph-point",
        glyph: style.point.glyph,
        fontFamily: style.point.fontFamily,
        color: style.point.color,
        bold: style.point.bold,
        rotation: style.point.rotation,
        size: style.point.size || 9
      };
    }
    return {
      kind: "point",
      color: style.point.color,
      outlineColor: style.point.outlineColor,
      weight: style.point.outlineWidth || 0.75,
      size: style.point.size || 8,
      width: style.point.width,
      height: style.point.height,
      fillAlpha: style.point.fillAlpha,
      shape: style.point.shape,
      rotation: style.point.rotation,
      anchorX: style.point.anchorX,
      anchorY: style.point.anchorY
    };
  }
  if ((geometry.indexOf("line") !== -1 || geometry.indexOf("curve") !== -1) && style.line) {
    if (style.line.glyph) {
      return {
        kind: "glyph-line",
        glyph: style.line.glyph,
        fontFamily: style.line.fontFamily,
        color: style.line.color,
        bold: style.line.bold,
        size: style.line.glyphSize || 10
      };
    }
    return {
      kind: style.line.dotSize ? "dot-line" : "line",
      color: style.line.color,
      weight: style.line.width || 1,
      dashStyle: style.line.dashStyle,
      dotSize: style.line.dotSize,
      dotOffsets: style.line.legendDotOffsets
    };
  }
  if (!geometry && style.point) {
    if (style.point.glyph) {
      return {
        kind: "glyph-point",
        glyph: style.point.glyph,
        fontFamily: style.point.fontFamily,
        color: style.point.color,
        bold: style.point.bold,
        rotation: style.point.rotation,
        size: style.point.size || 9
      };
    }
    return {
      kind: "point",
      color: style.point.color,
      outlineColor: style.point.outlineColor,
      weight: style.point.outlineWidth || 0.75,
      size: style.point.size || 8,
      width: style.point.width,
      height: style.point.height,
      fillAlpha: style.point.fillAlpha,
      shape: style.point.shape,
      rotation: style.point.rotation,
      anchorX: style.point.anchorX,
      anchorY: style.point.anchorY
    };
  }
  if (style.polygon) {
    var polygon = style.polygon;
    var hasFill = polygon.fillColor && polygon.fillStyle !== "esriSFSNull" &&
      polygon.fillAlpha !== 0;
    return {
      kind: hasFill && polygon.fillStyle && polygon.fillStyle !== "esriSFSSolid"
        ? "polygon-hatch" : hasFill ? "polygon-filled" : "polygon-outline",
      color: hasFill ? polygon.fillColor : polygon.outlineColor || fallbackColor,
      fillStyle: polygon.fillStyle,
      fillAlpha: polygon.fillAlpha,
      outlineColor: polygon.outlineColor || polygon.fillColor || fallbackColor,
      weight: polygon.outlineWidth || 1
    };
  }
  if (style.line) {
    return {
      kind: style.line.dotSize ? "dot-line" : "line",
      color: style.line.color,
      weight: style.line.width || 1,
      dashStyle: style.line.dashStyle,
      dotSize: style.line.dotSize,
      dotOffsets: style.line.legendDotOffsets
    };
  }
  if (style.point) {
    return {
      kind: "point",
      color: style.point.color,
      outlineColor: style.point.outlineColor,
      weight: style.point.outlineWidth || 0.75,
      size: style.point.size || 8,
      width: style.point.width,
      height: style.point.height,
      fillAlpha: style.point.fillAlpha,
      shape: style.point.shape,
      rotation: style.point.rotation,
      anchorX: style.point.anchorX,
      anchorY: style.point.anchorY
    };
  }
  return mapLegendSymbolForGeometry(geometryType, fallbackColor, null);
}

function mapDynamicLayersForConfiguredLayers(layers, onlyLayerId) {
  var dynamicLayers = [];
  layers.forEach(function(layer) {
    var parsed = parseMapServerLayer(layer.source);
    var layerId = onlyLayerId === undefined ? layer.mapServiceLayerId :
      onlyLayerId;
    if (layerId === null || layerId === undefined) {
      if (!parsed || parsed.layerId === null) return;
      layerId = parsed.layerId;
    }
    var symbology = mapLayerSymbology(layer);
    if (!symbology || layer.mapServiceDefaultRenderer || isNativeMapVectorLayer(layer)) return;
    dynamicLayers.push({
      id: layerId,
      source: { type: "mapLayer", mapLayerId: layerId },
      drawingInfo: {
        renderer: mapArcGisRendererForSymbology(symbology)
      }
    });
  });
  return dynamicLayers;
}

function mapArcGisRendererForSymbology(symbology) {
  if (symbology.field && symbology.classes) {
    var uniqueValueInfos = [];
    symbology.classes.forEach(function(styleClass) {
      styleClass.values.forEach(function(value) {
        uniqueValueInfos.push({
          value: value,
          label: styleClass.label || value,
          symbol: mapArcGisSymbolForStyle(styleClass.style)
        });
      });
    });
    return {
      type: "uniqueValue",
      field1: symbology.field,
      uniqueValueInfos: uniqueValueInfos,
      defaultLabel: "Other",
      defaultSymbol: mapArcGisSymbolForStyle(symbology.defaultStyle || symbology)
    };
  }
  return { type: "simple", symbol: mapArcGisSymbolForStyle(symbology) };
}

function mapArcGisSymbolForStyle(style) {
  if (style.polygon) {
    var polygon = style.polygon;
    var fillStyle = polygon.fillStyle || "esriSFSSolid";
    return {
      type: "esriSFS",
      style: fillStyle,
      color: mapRgbaColor(polygon.fillColor || polygon.outlineColor || "#000000",
        polygon.fillAlpha === undefined ? 0 : polygon.fillAlpha),
      outline: {
        type: "esriSLS",
        style: "esriSLSSolid",
        color: mapRgbaColor(polygon.outlineColor || polygon.fillColor || "#000000", 255),
        width: polygon.outlineWidth || 1
      }
    };
  }
  if (style.line) {
    return {
      type: "esriSLS",
      style: style.line.dashStyle === "DOT" ? "esriSLSDot" : "esriSLSSolid",
      color: mapRgbaColor(style.line.color, 255),
      width: style.line.width || 1
    };
  }
  var point = style.point || { color: "#000000", outlineColor: "#FFFFFF", size: 8 };
  var arcGisMarkerStyles = {
    TRIANGLE: "esriSMSTriangle",
    DIAMOND: "esriSMSDiamond",
    SQUARE: "esriSMSSquare",
    CIRCLE: "esriSMSCircle"
  };
  return {
    type: "esriSMS",
    style: arcGisMarkerStyles[point.shape] || "esriSMSCircle",
    color: mapRgbaColor(point.color, 255),
    size: point.size || 8,
    outline: {
      type: "esriSLS",
      style: "esriSLSSolid",
      color: mapRgbaColor(point.outlineColor || "#FFFFFF", 255),
      width: point.outlineWidth || 0.75
    }
  };
}

function mapRgbaColor(color, alpha) {
  var hex = String(color || "#000000").replace("#", "");
  if (hex.length !== 6) hex = "000000";
  return [
    parseInt(hex.slice(0, 2), 16),
    parseInt(hex.slice(2, 4), 16),
    parseInt(hex.slice(4, 6), 16),
    Math.max(0, Math.min(255, Number(alpha)))
  ];
}

function firstMapFeatureGeometryType(features) {
  for (var i = 0; features && i < features.length; i++) {
    var geometry = features[i] && features[i].geometry;
    if (!geometry) continue;
    if (geometry.type === "GeometryCollection") {
      var nested = firstMapFeatureGeometryType(geometry.geometries.map(function(item) {
        return { geometry: item };
      }));
      if (nested) return nested;
    } else {
      return geometry.type;
    }
  }
  return "";
}

function fetchArcGisMapLayerInfo(layerUrl) {
  var response = fetchArcGisRestResponse(
    normalizeArcGisLayerUrl(layerUrl), { f: "json" }, "json"
  );
  var code = response.getResponseCode();
  if (code < 200 || code >= 300) {
    throw new Error("ArcGIS layer metadata returned HTTP " + code);
  }
  var info = JSON.parse(response.getContentText());
  if (info.error) {
    throw new Error(info.error.message || JSON.stringify(info.error));
  }
  return info;
}

function primaryArcGisRendererSymbol(renderer) {
  if (!renderer) return null;
  if (renderer.symbol) return renderer.symbol;
  if (renderer.defaultSymbol) return renderer.defaultSymbol;
  if (renderer.uniqueValueInfos && renderer.uniqueValueInfos.length) {
    return renderer.uniqueValueInfos[0].symbol || null;
  }
  if (renderer.classBreakInfos && renderer.classBreakInfos.length) {
    return renderer.classBreakInfos[0].symbol || null;
  }
  return null;
}

function geometryTypeFromArcGis(geometryType) {
  if (geometryType === "esriGeometryPolygon") return "Polygon";
  if (geometryType === "esriGeometryPolyline") return "LineString";
  if (geometryType === "esriGeometryPoint" || geometryType === "esriGeometryMultipoint") return "Point";
  return "";
}

function mapLegendSymbolForGeometry(geometryType, fallbackColor, arcGisSymbol, defaultWeight) {
  var geometry = String(geometryType || "").toLowerCase();
  var symbolType = arcGisSymbol && arcGisSymbol.type || "";
  var weight = defaultWeight || 1;
  if (geometry.indexOf("polygon") !== -1) {
    var outline = arcGisSymbol && arcGisSymbol.outline;
    var isFilled = symbolType === "esriSFS" &&
      arcGisSymbol.style === "esriSFSSolid" &&
      arcGisColorIsVisible(arcGisSymbol.color);
    return {
      kind: isFilled ? "polygon-filled" : "polygon-outline",
      color: isFilled ? arcGisColorToHex(arcGisSymbol.color, fallbackColor) :
        arcGisColorToHex(outline && outline.color, fallbackColor),
      outlineColor: arcGisColorToHex(outline && outline.color, fallbackColor),
      weight: boundedLegendWeight(outline && outline.width, weight)
    };
  }
  if (geometry.indexOf("line") !== -1 || geometry.indexOf("curve") !== -1) {
    return {
      kind: "line",
      color: arcGisColorToHex(arcGisSymbol && arcGisSymbol.color, fallbackColor),
      weight: boundedLegendWeight(arcGisSymbol && arcGisSymbol.width, weight)
    };
  }
  if (geometry.indexOf("point") !== -1) {
    return {
      kind: "point",
      color: arcGisColorToHex(arcGisSymbol && arcGisSymbol.color, fallbackColor),
      outlineColor: arcGisColorToHex(arcGisSymbol && arcGisSymbol.outline &&
        arcGisSymbol.outline.color, "#FFFFFF"),
      weight: boundedLegendWeight(arcGisSymbol && arcGisSymbol.outline &&
        arcGisSymbol.outline.width, 0.5)
    };
  }
  return { kind: "line", color: fallbackColor, weight: weight };
}

function arcGisColorIsVisible(color) {
  return Array.isArray(color) && (color.length < 4 || color[3] > 0);
}

function arcGisColorToHex(color, fallbackColor) {
  if (!Array.isArray(color) || color.length < 3) return fallbackColor;
  return "#" + color.slice(0, 3).map(function(channel) {
    var hex = Math.max(0, Math.min(255, Number(channel) || 0)).toString(16);
    return hex.length < 2 ? "0" + hex : hex;
  }).join("").toUpperCase();
}

function boundedLegendWeight(weight, fallbackWeight) {
  var numericWeight = Number(weight);
  if (!isFinite(numericWeight) || numericWeight <= 0) return fallbackWeight;
  return numericWeight;
}

function insertArcGisMapImage(slide, serviceUrl, layerId, bbox, transparent, x, y, width, height, dynamicLayers, layersOverride) {
  var params = {
    bbox: bbox.join(","),
    bboxSR: "4326",
    imageSR: "4326",
    size: "1080,1252",
    format: "png32",
    dpi: "150",
    transparent: transparent ? "true" : "false",
    f: "image"
  };
  if (layersOverride) params.layers = layersOverride;
  else if (layerId !== null && layerId !== undefined) params.layers = "show:" + layerId;
  if (dynamicLayers && dynamicLayers.length) params.dynamicLayers = JSON.stringify(dynamicLayers);
  var response = fetchArcGisRestResponse(
    normalizeArcGisLayerUrl(serviceUrl) + "/export", params, "image"
  );
  var code = response.getResponseCode();
  if (code < 200 || code >= 300) {
    throw new Error("ArcGIS map export returned HTTP " + code + ": " + response.getContentText().slice(0, 300));
  }
  var contentType = response.getBlob().getContentType() || "";
  if (contentType.indexOf("image/") !== 0) {
    throw new Error("ArcGIS map export returned " + contentType + " instead of an image: " + response.getContentText().slice(0, 300));
  }
  var blob = response.getBlob();
  blob.setName("nepa-map-layer.png");
  slide.insertImage(blob).setLeft(pageContentX(x)).setTop(pageContentY(y)).setWidth(width).setHeight(height);
}

function mapExtentForProject(projectBbox) {
  var centerX = (projectBbox[0] + projectBbox[2]) / 2;
  var centerY = (projectBbox[1] + projectBbox[3]) / 2;
  var cosLat = Math.max(0.01, Math.cos(centerY * Math.PI / 180));
  var widthMeters = Math.max(0, (projectBbox[2] - projectBbox[0]) * cosLat * 111320);
  var heightMeters = Math.max(0, (projectBbox[3] - projectBbox[1]) * 111320);
  var frameRatio = NEPA_CONFIG.mapWidthPt / NEPA_CONFIG.mapHeightPt;
  var targetWidth = Math.max(widthMeters * 1.5, heightMeters * frameRatio * 1.5, 7.5 * 0.0254 * 6500);
  var targetHeight = targetWidth / frameRatio;
  var lonHalf = (targetWidth / 2) / (cosLat * 111320);
  var latHalf = (targetHeight / 2) / 111320;
  return [centerX - lonHalf, centerY - latHalf, centerX + lonHalf, centerY + latHalf];
}

function drawGeoJsonGeometryCollection(slide, features, bbox, width, height, style, drawn) {
  features.forEach(function(feature) {
    if (feature.geometry) drawGeoJsonGeometry(slide, feature.geometry, bbox, width, height, style, drawn);
  });
}

function drawGeoJsonGeometry(slide, geometry, bbox, width, height, style, drawn) {
  if (!geometry) return;
  style = normalizeNativeMapStyle(style);
  if (geometry.type === "GeometryCollection") {
    geometry.geometries.forEach(function(item) { drawGeoJsonGeometry(slide, item, bbox, width, height, style, drawn); });
    return;
  }
  if (geometry.type === "Point") {
    var point = mapCoordinateToSlide(geometry.coordinates, bbox, width, height);
    var pointStyle = style.point || { color: "#666666", outlineColor: "#FFFFFF", size: 6 };
    if (pointStyle.glyph) {
      drawMapGlyph(slide, point, {
        glyph: pointStyle.glyph,
        fontFamily: pointStyle.fontFamily,
        color: pointStyle.color,
        bold: pointStyle.bold,
        rotation: pointStyle.rotation,
        glyphSize: pointStyle.size || 9,
        boxWidth: pointStyle.boxWidth,
        boxHeight: pointStyle.boxHeight
      }, width, height);
      return;
    }
    var pointSize = Math.max(4, pointStyle.size || 6);
    drawMapMarker(slide, point, pointStyle, pointSize, width, height);
    return;
  }
  if (geometry.type === "MultiPoint") {
    geometry.coordinates.forEach(function(coordinate) {
      drawGeoJsonGeometry(slide, { type: "Point", coordinates: coordinate }, bbox, width, height, style, drawn);
    });
    return;
  }
  if (geometry.type === "LineString") {
    drawMapPath(slide, geometry.coordinates, false, bbox, width, height,
      style.line || { color: "#666666", width: 1 }, drawn);
  } else if (geometry.type === "MultiLineString") {
    geometry.coordinates.forEach(function(path) {
      drawMapPath(slide, path, false, bbox, width, height,
        style.line || { color: "#666666", width: 1 }, drawn);
    });
  } else if (geometry.type === "Polygon") {
    drawStyledMapPolygon(slide, geometry.coordinates, bbox, width, height,
      mapPolygonStyleForNativeStyle(style), drawn);
  } else if (geometry.type === "MultiPolygon") {
    geometry.coordinates.forEach(function(polygon) {
      drawStyledMapPolygon(slide, polygon, bbox, width, height,
        mapPolygonStyleForNativeStyle(style), drawn);
    });
  } else {
    throw new Error("Unsupported map geometry type: " + geometry.type);
  }
}

function mapPolygonStyleForNativeStyle(style) {
  var polygonStyle = style.polygon || {};
  if (!style.markerFill) return polygonStyle;
  var combinedStyle = {};
  Object.keys(polygonStyle).forEach(function(key) {
    combinedStyle[key] = polygonStyle[key];
  });
  combinedStyle.markerFill = style.markerFill;
  return combinedStyle;
}

function mapSlideShapeType(shapeName) {
  return SlidesApp.ShapeType[shapeName] || SlidesApp.ShapeType.ELLIPSE;
}

function normalizeNativeMapStyle(style) {
  if (typeof style === "string") {
    return {
      point: { color: style, outlineColor: "#FFFFFF", size: 6 },
      line: { color: style, width: 1 },
      polygon: { outlineColor: style, outlineWidth: 1 }
    };
  }
  return style || {};
}

function mapPolygonOutlineStyle(polygonStyle) {
  return {
    color: polygonStyle && (polygonStyle.outlineColor || polygonStyle.fillColor) || "#666666",
    width: polygonStyle && polygonStyle.outlineWidth || 1
  };
}

function drawStyledMapPolygon(slide, rings, bbox, width, height, polygonStyle, drawn) {
  if (polygonStyle && polygonStyle.fillColor &&
      polygonStyle.fillStyle !== "esriSFSNull" && polygonStyle.fillAlpha !== 0) {
    var fillStyle = polygonStyle.fillStyle || "esriSFSSolid";
    var solidFill = fillStyle === "esriSFSSolid";
    var angles = solidFill ? [0] :
      fillStyle === "esriSFSDiagonalCross" ? [45, -45] :
      fillStyle === "esriSFSVertical" ? [90] :
    fillStyle === "esriSFSHorizontal" ? [0] :
    fillStyle === "esriSFSBackwardDiagonal" ? [-45] : [45];
      var spacing = polygonStyle.hatchSpacing || (solidFill ? 4.5 : 7);
      var weight = polygonStyle.hatchWidth || (solidFill ? 4.8 : 1.1);
    var fillColor = mapBlendColorWithWhite(
      polygonStyle.fillColor,
      polygonStyle.fillAlpha === undefined ? 255 : polygonStyle.fillAlpha
    );
    angles.forEach(function(angle) {
      drawPolygonScanLines(slide, rings, bbox, width, height, angle, spacing,
        fillColor, weight, drawn);
    });
  }
  if (polygonStyle && polygonStyle.markerFill) {
    drawPolygonMarkerFill(slide, rings, bbox, width, height,
      polygonStyle.markerFill, drawn);
  }
  if (polygonStyle && polygonStyle.dotPattern) {
    drawPolygonDotPattern(slide, rings, bbox, width, height,
      polygonStyle.dotPattern, drawn);
  }
  if (!polygonStyle || polygonStyle.drawOutline !== false) {
    rings.forEach(function(ring) {
      drawMapPath(slide, ring, true, bbox, width, height,
        mapPolygonOutlineStyle(polygonStyle), drawn);
    });
  }
}

function drawMapMarker(slide, anchor, markerStyle, sizeOverride, width, height) {
  var markerStyleValue = markerStyle || {};
  var size = Math.min(NEPA_MAP_MAX_POINT_SYMBOL_SIZE_PT,
    sizeOverride || markerStyleValue.size || 10);
  var markerWidth = Math.min(NEPA_MAP_MAX_POINT_SYMBOL_SIZE_PT,
    markerStyleValue.width || size);
  var markerHeight = Math.min(NEPA_MAP_MAX_POINT_SYMBOL_SIZE_PT,
    markerStyleValue.height || size);
  var shapeType = mapSlideShapeType(markerStyleValue.shape || "ELLIPSE");
  var anchorX = markerStyleValue.anchorX === undefined
    ? (shapeType === SlidesApp.ShapeType.ELLIPSE ? 0.5 : 0) : markerStyleValue.anchorX;
  var anchorY = markerStyleValue.anchorY === undefined
    ? (shapeType === SlidesApp.ShapeType.ELLIPSE ? 0.5 : 0) : markerStyleValue.anchorY;
  var left = anchor.x - markerWidth * anchorX;
  var top = anchor.y - markerHeight * anchorY;
  var boundsWidth = width === undefined ? NEPA_CONFIG.mapWidthPt : width;
  var boundsHeight = height === undefined ? NEPA_CONFIG.mapHeightPt : height;
  if (left < 0 || top < 0 || left + markerWidth > boundsWidth ||
      top + markerHeight > boundsHeight) return false;
  var marker = slide.insertShape(shapeType,
    pageContentX(left), pageContentY(top), markerWidth, markerHeight);
  if (markerStyleValue.fillAlpha === undefined) {
    marker.getFill().setSolidFill(markerStyleValue.color || "#666666");
  } else {
    marker.getFill().setSolidFill(markerStyleValue.color || "#666666",
      Math.max(0, Math.min(1, markerStyleValue.fillAlpha / 255)));
  }
  marker.getBorder().getLineFill().setSolidFill(
    markerStyleValue.outlineColor || markerStyleValue.color || "#FFFFFF"
  );
  marker.getBorder().setWeight(markerStyleValue.outlineWidth ||
    markerStyleValue.weight || 0.75);
  if (markerStyleValue.rotation) marker.setRotation(markerStyleValue.rotation);
  return true;
}

function drawPolygonMarkerFill(slide, rings, bbox, width, height, markerFill, drawn) {
  var screenRings = rings.map(function(ring) {
    return ring.map(function(coordinate) {
      return mapCoordinateToSlide(coordinate, bbox, width, height);
    });
  });
  var minimumX = Infinity;
  var minimumY = Infinity;
  var maximumX = -Infinity;
  var maximumY = -Infinity;
  screenRings.forEach(function(ring) {
    ring.forEach(function(point) {
      minimumX = Math.min(minimumX, point.x);
      minimumY = Math.min(minimumY, point.y);
      maximumX = Math.max(maximumX, point.x);
      maximumY = Math.max(maximumY, point.y);
    });
  });
  var spacingX = markerFill.spacingX || 60;
  var spacingY = markerFill.spacingY || 60;
  var anchorX = markerFill.anchorX || 0;
  var anchorY = markerFill.anchorY || 0;
  var size = markerFill.size || 10;
  var startX = Math.max(0, Math.ceil(minimumX / spacingX) * spacingX);
  var startY = Math.max(0, Math.ceil(minimumY / spacingY) * spacingY);
  for (var y = startY; y <= Math.min(height, maximumY); y += spacingY) {
    for (var x = startX; x <= Math.min(width, maximumX); x += spacingX) {
      if (!pointInMapPolygon(x, y, screenRings)) continue;
      if ((drawn.markerSymbols || 0) >= NEPA_MAP_MAX_MARKER_FILL_SYMBOLS) {
        drawn.reachedLimit = true;
        return;
      }
      var placed;
      if (markerFill.glyph) {
        placed = drawMapGlyph(slide, { x: x, y: y }, {
          glyph: markerFill.glyph,
          fontFamily: markerFill.fontFamily,
          color: markerFill.color,
          bold: markerFill.bold,
          rotation: markerFill.rotation,
          glyphSize: size
        }, width, height);
      } else {
        placed = drawMapMarker(slide, { x: x, y: y }, {
          shape: markerFill.shape || "TRIANGLE",
          color: markerFill.color,
          outlineColor: markerFill.outlineColor,
          outlineWidth: markerFill.outlineWidth,
          rotation: markerFill.rotation,
          anchorX: anchorX,
          anchorY: anchorY
        }, size, width, height);
      }
      if (!placed) continue;
      drawn.markerSymbols = (drawn.markerSymbols || 0) + 1;
    }
  }
}

function drawPolygonDotPattern(slide, rings, bbox, width, height, dotPattern, drawn) {
  var screenRings = rings.map(function(ring) {
    return ring.map(function(coordinate) {
      return mapCoordinateToSlide(coordinate, bbox, width, height);
    });
  });
  var minimumX = Infinity;
  var minimumY = Infinity;
  var maximumX = -Infinity;
  var maximumY = -Infinity;
  screenRings.forEach(function(ring) {
    ring.forEach(function(point) {
      minimumX = Math.min(minimumX, point.x);
      minimumY = Math.min(minimumY, point.y);
      maximumX = Math.max(maximumX, point.x);
      maximumY = Math.max(maximumY, point.y);
    });
  });
  var spacing = Number(dotPattern.spacing || 12);
  var size = Number(dotPattern.size || 1.5);
  var firstX = Math.ceil(minimumX / spacing) * spacing;
  var firstY = Math.ceil(minimumY / spacing) * spacing;
  for (var y = firstY; y <= Math.min(height, maximumY); y += spacing) {
    for (var x = firstX; x <= Math.min(width, maximumX); x += spacing) {
      if (!pointInMapPolygon(x, y, screenRings)) continue;
      if ((drawn.markerSymbols || 0) >= NEPA_MAP_MAX_MARKER_FILL_SYMBOLS) {
        drawn.reachedLimit = true;
        return;
      }
      if (drawMapMarker(slide, { x: x, y: y }, {
        shape: "ELLIPSE",
        color: dotPattern.color || "#730000",
        outlineColor: dotPattern.color || "#730000",
        outlineWidth: 0.4
      }, size, width, height)) {
        drawn.markerSymbols = (drawn.markerSymbols || 0) + 1;
      }
    }
  }
}

function pointInMapPolygon(x, y, rings) {
  if (!rings.length || !pointInMapRing(x, y, rings[0])) return false;
  for (var i = 1; i < rings.length; i++) {
    if (pointInMapRing(x, y, rings[i])) return false;
  }
  return true;
}

function pointInMapRing(x, y, ring) {
  var inside = false;
  for (var i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    var first = ring[i];
    var second = ring[j];
    var intersects = ((first.y > y) !== (second.y > y)) &&
      (x < (second.x - first.x) * (y - first.y) /
        (second.y - first.y) + first.x);
    if (intersects) inside = !inside;
  }
  return inside;
}

function drawPolygonScanLines(slide, rings, bbox, width, height, angle, spacing, color, weight, drawn) {
  var radians = angle * Math.PI / 180;
  var cosine = Math.cos(radians);
  var sine = Math.sin(radians);
  var rotatedRings = rings.map(function(ring) {
    return ring.map(function(coordinate) {
      var point = mapCoordinateToSlide(coordinate, bbox, width, height);
      return { u: point.x * cosine + point.y * sine, v: -point.x * sine + point.y * cosine };
    });
  });
  var minimumV = Infinity;
  var maximumV = -Infinity;
  rotatedRings.forEach(function(ring) {
    ring.forEach(function(point) {
      minimumV = Math.min(minimumV, point.v);
      maximumV = Math.max(maximumV, point.v);
    });
  });
  if (!isFinite(minimumV) || !isFinite(maximumV)) return;
  for (var v = Math.ceil(minimumV / spacing) * spacing; v <= maximumV; v += spacing) {
    if (drawn.segments >= NEPA_MAP_MAX_DRAWN_SEGMENTS ||
        (drawn.fillSegments || 0) >= NEPA_MAP_MAX_DRAWN_SEGMENTS / 2) {
      drawn.reachedLimit = true;
      return;
    }
    var intersections = [];
    rotatedRings.forEach(function(ring) {
      for (var i = 0; i < ring.length; i++) {
        var first = ring[i];
        var second = ring[(i + 1) % ring.length];
        if ((first.v <= v && second.v > v) || (second.v <= v && first.v > v)) {
          intersections.push(first.u + (v - first.v) *
            (second.u - first.u) / (second.v - first.v));
        }
      }
    });
    intersections.sort(function(first, second) { return first - second; });
    for (var intersection = 0; intersection + 1 < intersections.length; intersection += 2) {
      var firstU = intersections[intersection];
      var secondU = intersections[intersection + 1];
      var firstPoint = {
        x: firstU * cosine - v * sine,
        y: firstU * sine + v * cosine
      };
      var secondPoint = {
        x: secondU * cosine - v * sine,
        y: secondU * sine + v * cosine
      };
      var clipped = clipMapSegment(firstPoint, secondPoint, width, height);
      if (!clipped || clipped[0].x === clipped[1].x && clipped[0].y === clipped[1].y) continue;
      insertStyledMapLine(slide, clipped[0], clipped[1], color, weight);
      drawn.segments++;
      drawn.fillSegments = (drawn.fillSegments || 0) + 1;
      if (drawn.segments >= NEPA_MAP_MAX_DRAWN_SEGMENTS ||
          drawn.fillSegments >= NEPA_MAP_MAX_DRAWN_SEGMENTS / 2) {
        drawn.reachedLimit = true;
        return;
      }
    }
  }
}

function mapBlendColorWithWhite(color, alpha) {
  var rgba = mapRgbaColor(color, alpha);
  return "#" + rgba.slice(0, 3).map(function(channel) {
    var blended = Math.round(channel * (rgba[3] / 255) + 255 * (1 - rgba[3] / 255));
    var hex = blended.toString(16);
    return hex.length < 2 ? "0" + hex : hex;
  }).join("").toUpperCase();
}

function drawMapPath(slide, coordinates, closePath, bbox, width, height, lineStyle, drawn) {
  if (!coordinates || coordinates.length < 2) return;
  if (lineStyle.glyph) {
    drawMapGlyphPath(slide, coordinates, closePath, bbox, width, height, lineStyle, drawn);
    return;
  }
  if (lineStyle.dotSize) {
    drawMapDottedPath(slide, coordinates, closePath, bbox, width, height, lineStyle, drawn);
    return;
  }
  var stop = coordinates.length - 1;
  for (var i = 0; i < stop; i++) {
    if (drawn.segments >= NEPA_MAP_MAX_DRAWN_SEGMENTS) {
      drawn.reachedLimit = true;
      return;
    }
    var first = mapCoordinateToSlide(coordinates[i], bbox, width, height);
    var second = mapCoordinateToSlide(coordinates[i + 1], bbox, width, height);
    var clipped = clipMapSegment(first, second, width, height);
    if (clipped) {
      insertStyledMapLine(slide, clipped[0], clipped[1], lineStyle.color,
        lineStyle.width || (closePath ? 1.4 : 1), lineStyle.dashStyle);
      drawn.segments++;
    }
  }
  if (closePath && coordinates.length > 2 &&
      (coordinates[0][0] !== coordinates[coordinates.length - 1][0] ||
       coordinates[0][1] !== coordinates[coordinates.length - 1][1])) {
    if (drawn.segments >= NEPA_MAP_MAX_DRAWN_SEGMENTS) {
      drawn.reachedLimit = true;
      return;
    }
    var closingSegment = clipMapSegment(
      mapCoordinateToSlide(coordinates[coordinates.length - 1], bbox, width, height),
      mapCoordinateToSlide(coordinates[0], bbox, width, height), width, height);
    if (closingSegment) {
        insertStyledMapLine(slide, closingSegment[0], closingSegment[1], lineStyle.color,
          lineStyle.width || 1.4, lineStyle.dashStyle);
      drawn.segments++;
    }
  }
}

function drawMapGlyphPath(slide, coordinates, closePath, bbox, width, height, lineStyle, drawn) {
  var path = coordinates.map(function(coordinate) {
    return mapCoordinateToSlide(coordinate, bbox, width, height);
  });
  var closed = path.length > 2 &&
    (path[0].x !== path[path.length - 1].x || path[0].y !== path[path.length - 1].y);
  if (closePath && closed) path.push(path[0]);

  var spacing = lineStyle.glyphSpacing || lineStyle.glyphSize * 2;
  var nextGlyphDistance = 0;
  var distanceBeforeSegment = 0;
  for (var i = 0; i < path.length - 1; i++) {
    var first = path[i];
    var second = path[i + 1];
    var dx = second.x - first.x;
    var dy = second.y - first.y;
    var segmentLength = Math.sqrt(dx * dx + dy * dy);
    if (!segmentLength) continue;
    while (nextGlyphDistance <= distanceBeforeSegment + segmentLength) {
      if (drawn.segments >= NEPA_MAP_MAX_DRAWN_SEGMENTS) {
        drawn.reachedLimit = true;
        return;
      }
      var segmentDistance = nextGlyphDistance - distanceBeforeSegment;
      var placed = drawMapGlyph(slide, {
        x: first.x + dx * segmentDistance / segmentLength,
        y: first.y + dy * segmentDistance / segmentLength
      }, lineStyle, width, height);
      if (placed) drawn.segments++;
      nextGlyphDistance += spacing;
    }
    distanceBeforeSegment += segmentLength;
  }
}

function drawMapGlyph(slide, anchor, glyphStyle, width, height) {
  var size = glyphStyle.glyphSize || glyphStyle.size || 10;
  var boxWidth = glyphStyle.boxWidth || size;
  var boxHeight = glyphStyle.boxHeight || size;
  var left = anchor.x - boxWidth / 2;
  var top = anchor.y - boxHeight / 2;
  var boundsWidth = width === undefined ? NEPA_CONFIG.mapWidthPt : width;
  var boundsHeight = height === undefined ? NEPA_CONFIG.mapHeightPt : height;
  if (left < 0 || top < 0 || left + boxWidth > boundsWidth ||
      top + boxHeight > boundsHeight) return false;

  var glyphBox = createMapGlyphTextBox(
    slide, glyphStyle.glyph, pageContentX(left), pageContentY(top), boxWidth, boxHeight
  );
  glyphBox.getFill().setTransparent();
  glyphBox.setContentAlignment(SlidesApp.ContentAlignment.MIDDLE);
  if (glyphStyle.rotation) glyphBox.setRotation(glyphStyle.rotation);
  var glyphText = glyphBox.getText();
  var textStyle = glyphText.getTextStyle()
    .setFontFamily(glyphStyle.fontFamily || NEPA_MAP_TURTLE_FONT_FAMILY)
    .setFontSize(size)
    .setForegroundColor(glyphStyle.color || "#FF7100");
  if (glyphStyle.bold) textStyle.setBold(true);
  glyphText.getParagraphs()[0].getRange().getParagraphStyle()
    .setParagraphAlignment(SlidesApp.ParagraphAlignment.CENTER);
  return true;
}

function drawMapDottedPath(slide, coordinates, closePath, bbox, width, height, lineStyle, drawn) {
  var path = coordinates.map(function(coordinate) {
    return mapCoordinateToSlide(coordinate, bbox, width, height);
  });
  var closed = path.length > 2 &&
    (path[0].x !== path[path.length - 1].x || path[0].y !== path[path.length - 1].y);
  if (closePath && closed) path.push(path[0]);

  var spacing = lineStyle.dotSpacing || lineStyle.dotSize * 3;
  var nextDotDistance = 0;
  var distanceBeforeSegment = 0;
  for (var i = 0; i < path.length - 1; i++) {
    var first = path[i];
    var second = path[i + 1];
    var dx = second.x - first.x;
    var dy = second.y - first.y;
    var segmentLength = Math.sqrt(dx * dx + dy * dy);
    if (!segmentLength) continue;
    while (nextDotDistance <= distanceBeforeSegment + segmentLength) {
      if (drawn.segments >= NEPA_MAP_MAX_DRAWN_SEGMENTS) {
        drawn.reachedLimit = true;
        return;
      }
      var segmentDistance = nextDotDistance - distanceBeforeSegment;
      var placed = drawMapMarker(slide, {
        x: first.x + dx * segmentDistance / segmentLength,
        y: first.y + dy * segmentDistance / segmentLength
      }, {
        shape: "ELLIPSE",
        color: lineStyle.color,
        outlineColor: lineStyle.color,
        outlineWidth: 0.5,
        size: lineStyle.dotSize,
        anchorX: 0.5,
        anchorY: 0.5
      }, lineStyle.dotSize, width, height);
      if (placed) drawn.segments++;
      nextDotDistance += spacing;
    }
    distanceBeforeSegment += segmentLength;
  }
}

function clipMapSegment(first, second, width, height) {
  var dx = second.x - first.x;
  var dy = second.y - first.y;
  var t0 = 0;
  var t1 = 1;
  var p = [-dx, dx, -dy, dy];
  var q = [first.x, width - first.x, first.y, height - first.y];
  for (var i = 0; i < p.length; i++) {
    if (p[i] === 0) {
      if (q[i] < 0) return null;
      continue;
    }
    var ratio = q[i] / p[i];
    if (p[i] < 0) {
      if (ratio > t1) return null;
      t0 = Math.max(t0, ratio);
    } else {
      if (ratio < t0) return null;
      t1 = Math.min(t1, ratio);
    }
  }
  return [
    { x: first.x + t0 * dx, y: first.y + t0 * dy },
    { x: first.x + t1 * dx, y: first.y + t1 * dy }
  ];
}

function insertStyledMapLine(slide, first, second, color, weight, dashStyle) {
  var line = slide.insertLine(SlidesApp.LineCategory.STRAIGHT,
    pageContentX(first.x), pageContentY(first.y), pageContentX(second.x), pageContentY(second.y));
  line.getLineFill().setSolidFill(color);
  line.setWeight(weight);
  if (dashStyle) line.setDashStyle(SlidesApp.DashStyle[dashStyle]);
}

function mapCoordinateToSlide(coordinate, bbox, width, height) {
  return {
    x: (coordinate[0] - bbox[0]) / (bbox[2] - bbox[0]) * width,
    y: height - ((coordinate[1] - bbox[1]) / (bbox[3] - bbox[1]) * height)
  };
}

function orderMapLegendEntries(layers) {
  var aliases = {
    "NHD Mussel Streams": "NHDMusselStreams",
    "Wildlife Management Area": "WMAs",
    "Wildlife Center": "State Wildlife Center",
    "Local Lands": "Protected Local Lands",
    "Private Lands": "Private Protected Lands",
    "U.S. Army Corps of Engineers": "USACE",
    "U.S. Fish and Wildlife Service": "USFWS"
  };
  var order = {};
  NEPA_MAP_LEGEND_ORDER.forEach(function(label, index) { order[label] = index; });
  return layers.map(function(layer, index) {
    var label = aliases[layer.label] || layer.label;
    return {
      entry: layer,
      index: index,
      order: Object.prototype.hasOwnProperty.call(order, label) ? order[label] : NEPA_MAP_LEGEND_ORDER.length + index
    };
  }).sort(function(first, second) {
    return first.order - second.order || first.index - second.index;
  }).map(function(item) {
    return item.entry;
  });
}

function appendConfiguredMapLegendEntries(visibleLayers, mapLayers) {
  var visibleNames = {};
  visibleLayers.forEach(function(entry) { visibleNames[entry.label] = true; });
  NEPA_MAP_ALWAYS_LEGEND_LAYERS.forEach(function(layerName) {
    var displayLabel = layerName === "Wildlife Management Area" ? "WMAs" : layerName;
    if (visibleNames[layerName] || visibleNames[displayLabel]) return;
    var layer = mapLayers.filter(function(item) { return item.name === layerName; })[0] ||
      { name: layerName };
    var style = mapStyleForFeature(layer, null);
    var geometryType = layerName === "High Box Turt Crossing Risk"
      ? "LineString"
      : layerName === "Architectural Point" || layerName === "National Register Point" ||
        layerName === "Cemeteries Point"
        ? "Point"
        : "";
    visibleLayers.push({
      label: displayLabel,
      symbol: mapLegendSymbolForStyle(style, geometryType, "#666666")
    });
    visibleNames[layerName] = true;
    visibleNames[displayLabel] = true;
  });

  var musselLayer = mapLayers.filter(function(layer) {
    return layer.special === "mussels";
  })[0] || { name: "NHDMusselStreams" };
  [
    { label: "Federal Mussel Streams", streamGroup: "2" },
    { label: "State Mussel Streams", streamGroup: "1" }
  ].forEach(function(variant) {
    if (visibleNames[variant.label]) return;
    var style = mapStyleForFeature(musselLayer, {
      properties: { StreamGroup: variant.streamGroup }
    });
    visibleLayers.push({
      label: variant.label,
      symbol: mapLegendSymbolForStyle(style, "LineString", "#666666")
    });
    visibleNames[variant.label] = true;
  });

  if (!visibleNames["Federally Owned"]) {
    var ownedLayer = mapLayers.filter(function(layer) {
      return layer.name === "NPS Owned";
    })[0] || { name: "NPS Owned" };
    visibleLayers.push({
      label: "Federally Owned",
      symbol: mapLegendSymbolForStyle(mapStyleForFeature(ownedLayer, null), "Polygon", "#000000")
    });
    visibleNames["Federally Owned"] = true;
  }
}

function createNepaLegendRenderingTestEntries() {
  var mapLayers = getNepaMapLayers();
  var entries = [{
    label: "Project Area",
    symbol: mapLegendSymbolForGeometry("Polygon", "#800080", null, 1.4)
  }];
  var visibleLabels = { "Project Area": true };

  mapLayers.forEach(function(layer) {
    if (!isScreeningLegendLayer(layer) || layer.special === "mussels" ||
        NEPA_MAP_ALWAYS_LEGEND_LAYERS.indexOf(layer.name) !== -1) return;
    var color = NEPA_CONFIG.colors[
      NEPA_CONFIG.layers.indexOf(layer) % NEPA_CONFIG.colors.length
    ];
    var entry = createMapLegendEntry(layer, [], color, null, []);
    if (visibleLabels[entry.label]) return;
    visibleLabels[entry.label] = true;
    entries.push(entry);
  });

  appendConfiguredMapLegendEntries(entries, mapLayers);
  var lwcfEntry = createMapLegendEntry(
    { name: "LWCF_Projects" }, [], "#4169E1", null, []
  );
  if (!visibleLabels[lwcfEntry.label]) entries.push(lwcfEntry);

  return orderMapLegendEntries(entries);
}

function mapLegendCellForIndex(index, total, columns) {
  var rows = Math.ceil(total / columns);
  return {
    row: index % rows,
    column: Math.floor(index / rows)
  };
}

function addMapLegend(slide, layers, width, height) {
  if (!layers.length) return;
  var columns = 3;
  var rows = Math.ceil(layers.length / columns);
  var rowHeight = 10;
  var panelHeight = 8 + rows * rowHeight;
  var panelY = height - panelHeight;
  var panel = slide.insertShape(SlidesApp.ShapeType.RECTANGLE,
    pageContentX(0), pageContentY(panelY), width, panelHeight);
  panel.getFill().setSolidFill("#FFFFFF", 0.88);
  panel.getBorder().getLineFill().setSolidFill("#333333");
  panel.getBorder().setWeight(0.5);
  var columnWidth = width / columns;
  for (var i = 0; i < layers.length; i++) {
    var cell = mapLegendCellForIndex(i, layers.length, columns);
    var x = 7 + cell.column * columnWidth;
    var y = panelY + 4 + cell.row * rowHeight;
    var symbol = layers[i].symbol;
    var chipY = y + (rowHeight - 7) / 2;
    if (symbol.kind === "image") {
      var legendBlob = Utilities.newBlob(
        Utilities.base64Decode(symbol.imageData),
        symbol.contentType,
        "nepa-legend-" + i + ".png"
      );
      var legendImage = slide.insertImage(legendBlob);
      legendImage.setLeft(pageContentX(x))
        .setTop(pageContentY(y + (rowHeight - 10) / 2))
        .setWidth(10).setHeight(10);
    } else if (symbol.kind === "marker-fill") {
      var fillMarker = symbol.markerFill;
      if (symbol.polygonOutline && !fillMarker.glyph) {
        var outlineFrame = slide.insertShape(SlidesApp.ShapeType.RECTANGLE,
          pageContentX(x + 1), pageContentY(y + 1.5), 8, 7);
        outlineFrame.getFill().setTransparent();
        outlineFrame.getBorder().getLineFill().setSolidFill(symbol.polygonOutline.color);
        outlineFrame.getBorder().setWeight(symbol.polygonOutline.width);
      }
      if (fillMarker.glyph) {
        drawLegendGlyphTextBox(slide, x, y, fillMarker.glyph, {
          fontFamily: fillMarker.fontFamily,
          color: fillMarker.color,
          bold: fillMarker.bold,
          rotation: fillMarker.rotation,
          glyphSize: legendGlyphFontSize(layers[i].label, symbol.polygonOutline)
        }, symbol.polygonOutline, {
          standardTextbox: shouldUseStandardLegendGlyphTextbox(layers[i].label),
          compactGlyphBox: usesCompactLegendGlyphBox(layers[i].label)
        });
      } else {
        drawLegendMarker(slide,
          x + (symbol.polygonOutline ? 1.5 : 2),
          y + (rowHeight - 7) / 2, fillMarker, 7);
      }
    } else if (symbol.kind === "dot-line") {
      (symbol.dotOffsets || [1, 5, 9]).forEach(function(offset) {
        drawLegendMarker(slide, x + offset, y + (rowHeight - 3.5) / 2, {
          shape: "ELLIPSE",
          color: symbol.color,
          outlineColor: symbol.color,
          outlineWidth: 0.4
        }, 3.5);
      });
    } else if (symbol.kind === "glyph-line") {
      drawLegendGlyphTextBox(slide, x, y, symbol.glyph, {
        fontFamily: symbol.fontFamily,
        color: symbol.color,
        bold: symbol.bold,
        glyphSize: legendGlyphFontSize(layers[i].label)
      }, null, {
        standardTextbox: shouldUseStandardLegendGlyphTextbox(layers[i].label),
        compactGlyphBox: usesCompactLegendGlyphBox(layers[i].label)
      });
    } else if (symbol.kind === "glyph-point") {
      drawLegendGlyphTextBox(slide, x, y, symbol.glyph, {
        fontFamily: symbol.fontFamily,
        color: symbol.color,
        bold: symbol.bold,
        rotation: symbol.rotation,
        glyphSize: legendGlyphFontSize(layers[i].label)
      }, null, {
        standardTextbox: shouldUseStandardLegendGlyphTextbox(layers[i].label),
        compactGlyphBox: usesCompactLegendGlyphBox(layers[i].label)
      });
    } else if (symbol.kind === "line") {
      var line = slide.insertLine(SlidesApp.LineCategory.STRAIGHT,
        pageContentX(x), pageContentY(y + rowHeight / 2),
        pageContentX(x + 10), pageContentY(y + rowHeight / 2));
      line.getLineFill().setSolidFill(symbol.color);
      line.setWeight(Math.max(1, Math.min(3.5, symbol.weight || 1)));
      if (symbol.dashStyle) line.setDashStyle(SlidesApp.DashStyle[symbol.dashStyle]);
    } else {
      var shapeType = symbol.kind === "point"
        ? mapSlideShapeType(symbol.shape || "ELLIPSE")
        : SlidesApp.ShapeType.RECTANGLE;
      var pointWidth = symbol.width || symbol.size || 7;
      var pointHeight = symbol.height || symbol.size || 7;
      var pointScale = Math.min(1, NEPA_MAP_MAX_POINT_SYMBOL_SIZE_PT /
        Math.max(pointWidth, pointHeight));
      var chipWidth = symbol.kind === "point" ? pointWidth * pointScale : 10;
      var chipHeight = symbol.kind === "point" ? pointHeight * pointScale : 7;
      var pointLeft = x + (10 - chipWidth) / 2;
      var pointTop = y + (rowHeight - chipHeight) / 2;
      var swatch = slide.insertShape(shapeType,
        pageContentX(pointLeft), pageContentY(pointTop), chipWidth, chipHeight);
      if (symbol.kind === "polygon-outline" || symbol.kind === "polygon-hatch" ||
          symbol.kind === "polygon-dot") {
        swatch.getFill().setTransparent();
      } else if (symbol.fillAlpha !== undefined) {
        swatch.getFill().setSolidFill(symbol.color, Math.max(0, Math.min(1, symbol.fillAlpha / 255)));
      } else {
        swatch.getFill().setSolidFill(symbol.color);
      }
      swatch.getBorder().getLineFill().setSolidFill(symbol.outlineColor || symbol.color);
      swatch.getBorder().setWeight(Math.min(1.5, symbol.weight || 0.75));
      if (symbol.rotation) swatch.setRotation(symbol.rotation);
      if (symbol.kind === "polygon-dot") {
        [
          [1.5, chipY + 0.5],
          [7, chipY + 0.5],
          [4.25, chipY + 2.75],
          [1.5, chipY + 5],
          [7, chipY + 5]
        ].forEach(function(position) {
          drawLegendMarker(slide, x + position[0], position[1], {
            shape: "ELLIPSE",
            color: symbol.color,
            outlineColor: symbol.color,
            outlineWidth: 0.4
          }, 1.5);
        });
      }
      if (symbol.kind === "polygon-hatch") {
        if (symbol.fillStyle === "esriSFSVertical") {
          [3, 6, 9].forEach(function(offset) {
            var verticalHatch = slide.insertLine(SlidesApp.LineCategory.STRAIGHT,
              pageContentX(x + offset), pageContentY(chipY + 1),
              pageContentX(x + offset), pageContentY(chipY + 6));
            verticalHatch.getLineFill().setSolidFill(symbol.color);
            verticalHatch.setWeight(0.8);
          });
        } else if (symbol.fillStyle === "esriSFSHorizontal") {
          [chipY + 2, chipY + 4, chipY + 6].forEach(function(hatchY) {
            var horizontalHatch = slide.insertLine(SlidesApp.LineCategory.STRAIGHT,
              pageContentX(x + 1), pageContentY(hatchY),
              pageContentX(x + 9), pageContentY(hatchY));
            horizontalHatch.getLineFill().setSolidFill(symbol.color);
            horizontalHatch.setWeight(0.8);
          });
        } else {
          var hatchDirections = symbol.fillStyle === "esriSFSDiagonalCross" ? [-1, 1] : [1];
          if (symbol.fillStyle === "esriSFSBackwardDiagonal") hatchDirections = [-1];
          hatchDirections.forEach(function(direction) {
            var hatch = slide.insertLine(SlidesApp.LineCategory.STRAIGHT,
              pageContentX(x + 1), pageContentY(chipY + (direction < 0 ? 6 : 1)),
              pageContentX(x + 9), pageContentY(chipY + (direction < 0 ? 1 : 6)));
            hatch.getLineFill().setSolidFill(symbol.color);
            hatch.setWeight(0.8);
          });
        }
      }
    }
    var label = slide.insertTextBox(layers[i].label,
      pageContentX(x + 14), pageContentY(y), columnWidth - 18, rowHeight);
    label.getFill().setTransparent();
    label.setContentAlignment(SlidesApp.ContentAlignment.MIDDLE);
    label.getText().getTextStyle().setFontFamily("Arial").setFontSize(6);
  }
}

function drawMapGlyphSequence(slide, x, y, glyphs, glyphStyle) {
  var glyphBox = createMapGlyphTextBox(
    slide, glyphs, pageContentX(x), pageContentY(y), 10, 10
  );
  glyphBox.getFill().setTransparent();
  glyphBox.setContentAlignment(SlidesApp.ContentAlignment.MIDDLE);
  var glyphText = glyphBox.getText();
  var textStyle = glyphText.getTextStyle()
    .setFontFamily(glyphStyle.fontFamily || NEPA_MAP_TURTLE_FONT_FAMILY)
    .setFontSize(glyphStyle.glyphSize || 4)
    .setForegroundColor(glyphStyle.color || "#FF7100");
  if (glyphStyle.bold) textStyle.setBold(true);
  glyphText.getParagraphs()[0].getRange().getParagraphStyle()
    .setParagraphAlignment(SlidesApp.ParagraphAlignment.CENTER);
  if (glyphStyle.rotation) glyphBox.setRotation(glyphStyle.rotation);
  return glyphBox;
}

function drawLegendGlyphTextBox(slide, x, y, glyph, glyphStyle, outline, options) {
  options = options || {};
  var boxWidth = 0.14 * 72;
  var boxHeight = 0.1 * 72;
  if (options.compactGlyphBox) {
    boxWidth = 0.15 * 72;
    boxHeight = 0.15 * 72;
  }
  var boxOffsetX = (10 - boxWidth) / 2;
  var boxOffsetY = (10 - boxHeight) / 2;
  var glyphBox = options.standardTextbox
    ? slide.insertTextBox(
      glyph,
      pageContentX(x + boxOffsetX),
      pageContentY(y + boxOffsetY),
      boxWidth,
      boxHeight
    )
    : createMapGlyphTextBox(
      slide,
      glyph,
      pageContentX(x + boxOffsetX),
      pageContentY(y + boxOffsetY),
      boxWidth,
      boxHeight,
      NEPA_MAP_LEGEND_GLYPH_TEMPLATE_ALT_TEXT,
      !options.standardTextbox
    );
  var actualBoxWidth = typeof glyphBox.getWidth === "function"
    ? glyphBox.getWidth()
    : boxWidth;
  var actualBoxHeight = typeof glyphBox.getHeight === "function"
    ? glyphBox.getHeight()
    : boxHeight;
  if (!options.standardTextbox) {
    if (typeof glyphBox.setLeft === "function") {
      glyphBox.setLeft(pageContentX(x + (10 - actualBoxWidth) / 2));
    }
    if (typeof glyphBox.setTop === "function") {
      glyphBox.setTop(pageContentY(y + (10 - actualBoxHeight) / 2));
    }
  }
  glyphBox.getFill().setTransparent();
  glyphBox.setContentAlignment(SlidesApp.ContentAlignment.MIDDLE);
  if (outline) {
    glyphBox.getBorder().getLineFill().setSolidFill(outline.color);
    glyphBox.getBorder().setWeight(Math.min(1, outline.width || 0.5));
  }
  var glyphText = glyphBox.getText();
  var textStyle = glyphText.getTextStyle()
    .setFontFamily(glyphStyle.fontFamily || NEPA_MAP_TURTLE_FONT_FAMILY)
    .setFontSize(Math.max(1, Math.min(9,
      glyphStyle.glyphSize || (outline ? 8 : 9))))
    .setForegroundColor(glyphStyle.color || "#FF7100");
  if (glyphStyle.bold) textStyle.setBold(true);
  var paragraphStyle = glyphText.getParagraphs()[0].getRange().getParagraphStyle();
  paragraphStyle.setParagraphAlignment(SlidesApp.ParagraphAlignment.CENTER)
    .setSpaceAbove(0).setSpaceBelow(0);
  if (glyphStyle.rotation) glyphBox.setRotation(glyphStyle.rotation);
  return glyphBox;
}

function legendGlyphFontSize(label, outline) {
  var sizes = {
    "Nature Area": 6,
    "Wildlife Sanctuary": 7,
    "State Forest": 6,
    "State Park": 7,
    "Wildlife Center": 6,
    "High Box Turtle Crossing Risk": 8,
    "High Box Turt Crossing Risk": 8,
    "Cemeteries Point": 9,
    "USGS Cemeteries": 9
  };
  var size = sizes[label] || (outline ? 8 : 9);
  return Math.max(1, Math.min(9, size));
}

function usesCompactLegendGlyphBox(label) {
  return [
    "LWCF Projects",
    "High Box Turtle Crossing Risk",
    "High Box Turt Crossing Risk"
  ].indexOf(label) !== -1;
}

function shouldUseStandardLegendGlyphTextbox(label) {
  return [
    "LWCF Projects",
    "USGS Cemeteries",
    "Cemeteries Point",
    "High Box Turtle Crossing Risk",
    "High Box Turt Crossing Risk"
  ].indexOf(label) !== -1;
}

function prepareNepaMapSlide(presentation, oldSlides) {
  var mapGlyphTemplate = findMapGlyphTextBoxTemplateEntry(
    oldSlides, NEPA_MAP_GLYPH_TEMPLATE_ALT_TEXT
  );
  var legendGlyphTemplate = findMapGlyphTextBoxTemplateEntry(
    oldSlides, NEPA_MAP_LEGEND_GLYPH_TEMPLATE_ALT_TEXT
  );
  var templateEntry = mapGlyphTemplate && legendGlyphTemplate &&
    mapGlyphTemplate.slide === legendGlyphTemplate.slide
    ? {
      slide: mapGlyphTemplate.slide,
      elements: [mapGlyphTemplate, legendGlyphTemplate]
    }
    : null;
  if (!templateEntry) {
    var canInspectSlides = oldSlides.some(function(slide) {
      return slide && typeof slide.getPageElements === "function";
    });
    if (canInspectSlides) {
      throw new Error(
        'The Slides template must contain text boxes with alternate text "' +
        NEPA_MAP_GLYPH_TEMPLATE_ALT_TEXT + '" and "' +
        NEPA_MAP_LEGEND_GLYPH_TEMPLATE_ALT_TEXT + '" on the same slide.'
      );
    }
    oldSlides.forEach(function(oldSlide) { oldSlide.remove(); });
    return presentation.appendSlide(SlidesApp.PredefinedLayout.BLANK);
  }

  var slide = templateEntry.slide;
  slide.getPageElements().forEach(function(element) {
    var isTemplate = templateEntry.elements.some(function(template) {
      return element === template.pageElement ||
        (template.objectId &&
          typeof element.getObjectId === "function" &&
          element.getObjectId() === template.objectId);
    });
    if (!isTemplate) element.remove();
  });
  oldSlides.forEach(function(oldSlide) {
    if (oldSlide !== slide) oldSlide.remove();
  });
  return slide;
}

function findMapGlyphTextBoxTemplateEntry(slides, alternateText) {
  alternateText = alternateText || NEPA_MAP_GLYPH_TEMPLATE_ALT_TEXT;
  for (var slideIndex = 0; slideIndex < slides.length; slideIndex++) {
    var slide = slides[slideIndex];
    if (!slide || typeof slide.getPageElements !== "function") continue;
    var pageElements = slide.getPageElements();
    for (var elementIndex = 0; elementIndex < pageElements.length; elementIndex++) {
      var element = pageElements[elementIndex];
      var title = typeof element.getTitle === "function" ? element.getTitle() : "";
      var description = typeof element.getDescription === "function"
        ? element.getDescription()
        : "";
      if (title !== alternateText && description !== alternateText) continue;
      var shape = typeof element.asShape === "function" ? element.asShape() : element;
      if (typeof shape.getText === "function" &&
          typeof shape.duplicate === "function") {
        return {
          slide: slide,
          pageElement: element,
          objectId: typeof element.getObjectId === "function"
            ? element.getObjectId()
            : null,
          shape: shape
        };
      }
    }
  }
  return null;
}

function createMapGlyphTextBox(
    slide, text, left, top, width, height, alternateText, preserveTemplateSize) {
  var templateEntry = findMapGlyphTextBoxTemplateEntry([slide], alternateText);
  if (!templateEntry) {
    if (typeof slide.getPageElements === "function") {
      throw new Error(
        'The map slide is missing its "' +
        (alternateText || NEPA_MAP_GLYPH_TEMPLATE_ALT_TEXT) +
        '" text box template.'
      );
    }
    return slide.insertTextBox(text, left, top, width, height);
  }
  var glyphPageElement = templateEntry.shape.duplicate();
  var glyphBox = typeof glyphPageElement.asShape === "function"
    ? glyphPageElement.asShape()
    : glyphPageElement;
  glyphBox.setLeft(left);
  glyphBox.setTop(top);
  if (!preserveTemplateSize) {
    glyphBox.setWidth(width);
    glyphBox.setHeight(height);
  }
  glyphBox.getText().setText(text);
  if (typeof glyphBox.setTitle === "function") glyphBox.setTitle("");
  if (typeof glyphBox.setDescription === "function") glyphBox.setDescription("");
  return glyphBox;
}

function drawLegendMarker(slide, x, y, markerStyle, size) {
  size = Math.min(NEPA_MAP_MAX_POINT_SYMBOL_SIZE_PT, size);
  var shapeType = markerStyle.shape === "TRIANGLE"
    ? SlidesApp.ShapeType.TRIANGLE : SlidesApp.ShapeType.ELLIPSE;
  var marker = slide.insertShape(shapeType,
    pageContentX(x), pageContentY(y), size, size);
  marker.getFill().setSolidFill(markerStyle.color || "#666666");
  marker.getBorder().getLineFill().setSolidFill(
    markerStyle.outlineColor || markerStyle.color || "#666666"
  );
  marker.getBorder().setWeight(markerStyle.outlineWidth || 0.4);
  if (markerStyle.rotation) marker.setRotation(markerStyle.rotation);
}

function drawMapScaleStrip(slide, bbox, width, height) {
  var mapWidthInches = width / 72;
  var scaleHeight = 0.2 * 72;
  var strip = slide.insertShape(SlidesApp.ShapeType.RECTANGLE,
    pageContentX(0), pageContentY(height), width, scaleHeight);
  strip.getFill().setSolidFill("#FFFFFF");
  strip.getBorder().getLineFill().setSolidFill("#000000");
  var metersPerInch = calculateMapScaleMetersPerInch(bbox, mapWidthInches);
  var formattedScale = String(metersPerInch).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  var textY = height + (0.02 * 72);
  var text = slide.insertTextBox('1" = ' + formattedScale + " meters",
    pageContentX(10), pageContentY(textY), 200, scaleHeight);
  text.setContentAlignment(SlidesApp.ContentAlignment.MIDDLE);
  text.getText().getTextStyle().setFontSize(7).setBold(true).setFontFamily("Arial");

  var allowedSegments = [5, 10, 25, 50, 100, 250, 500, 1000, 2500, 5000, 10000];
  var segmentMeters = 10;
  var maxSegmentWidthPt = 60;
  for (var i = allowedSegments.length - 1; i >= 0; i--) {
    if ((allowedSegments[i] / metersPerInch) * 72 <= maxSegmentWidthPt) {
      segmentMeters = allowedSegments[i];
      break;
    }
  }
  var segments = 4;
  var segmentWidth = (segmentMeters / metersPerInch) * 72;
  var segmentHeight = 6;
  var startX = width - (segments * segmentWidth) - 30;
  var startY = height + (scaleHeight / 2) - (segmentHeight / 2) + 2;
  var labelY = startY - 13.44;
  for (var segment = 0; segment < segments; segment++) {
    var rect = slide.insertShape(SlidesApp.ShapeType.RECTANGLE,
      pageContentX(startX + segment * segmentWidth), pageContentY(startY), segmentWidth, segmentHeight);
    rect.getBorder().getLineFill().setSolidFill("#000000");
    rect.getBorder().setWeight(0.75);
    rect.getFill().setSolidFill(segment % 2 === 0 ? "#000000" : "#FFFFFF");
    var labelBox = slide.insertTextBox(String(segment * segmentMeters),
      pageContentX(startX + segment * segmentWidth - 15), pageContentY(labelY), 30, 15);
    labelBox.getText().getTextStyle().setFontSize(5).setFontFamily("Arial");
    labelBox.getText().getParagraphs()[0].getRange().getParagraphStyle()
      .setParagraphAlignment(SlidesApp.ParagraphAlignment.CENTER);
  }
  var finalLabel = slide.insertTextBox(String(segments * segmentMeters) + " meters",
    pageContentX(startX + segments * segmentWidth - 27.5), pageContentY(labelY), 55, 15);
  finalLabel.getText().getTextStyle().setFontSize(5).setFontFamily("Arial");
  finalLabel.getText().getParagraphs()[0].getRange().getParagraphStyle()
    .setParagraphAlignment(SlidesApp.ParagraphAlignment.CENTER);
}

function calculateMapScaleMetersPerInch(bbox, mapWidthInches) {
  var centerLatitude = (bbox[1] + bbox[3]) / 2;
  var metersPerDegree = 111320 * Math.cos(centerLatitude * Math.PI / 180);
  return Math.round((bbox[2] - bbox[0]) * metersPerDegree / mapWidthInches);
}

function drawMapViewportFrame(slide, width, height) {
  var frame = slide.insertShape(SlidesApp.ShapeType.RECTANGLE,
    pageContentX(0), pageContentY(0), width, height);
  frame.getFill().setTransparent();
  frame.getBorder().getLineFill().setSolidFill("#333333");
  frame.getBorder().setWeight(0.5);
}

function addNepaMapFooter(slide, analysis, warnings) {
  var width = NEPA_CONFIG.mapWidthPt;
  var mapHeight = NEPA_CONFIG.mapHeightPt;
  var footerY = mapHeight + 14.4;
  var footerHeight = 82.8;
  var outer = slide.insertShape(SlidesApp.ShapeType.RECTANGLE,
    pageContentX(0), pageContentY(0), width, mapHeight + 14.4 + footerHeight);
  outer.getFill().setTransparent();
  outer.getBorder().getLineFill().setSolidFill("#000000");
  outer.getBorder().setWeight(1.25);
  var footer = slide.insertShape(SlidesApp.ShapeType.RECTANGLE,
    pageContentX(0), pageContentY(footerY), width, footerHeight);
  footer.getFill().setSolidFill("#FFFFFF");
  footer.getBorder().getLineFill().setSolidFill("#000000");

  var leftSectionX = 90;
  var rightSectionX = width - 150;
  var logoLayer = {
    name: "WVDOH logo",
    longName: "Map footer logo",
    source: "https://gis.transportation.wv.gov/files/Logos/WVDOH.png"
  };
  try {
    var logoResponse = UrlFetchApp.fetch(logoLayer.source, { muteHttpExceptions: true });
    if (logoResponse.getResponseCode() < 200 || logoResponse.getResponseCode() >= 300) {
      throw new Error("Logo request returned HTTP " + logoResponse.getResponseCode());
    }
    var logoBlob = logoResponse.getBlob();
    if ((logoBlob.getContentType() || "").indexOf("image/") !== 0) {
      throw new Error("Logo request returned " + (logoBlob.getContentType() || "an unknown content type"));
    }
    var logo = slide.insertImage(logoBlob);
    var logoMaxHeight = footerHeight - 12;
    var logoMaxWidth = leftSectionX - 12;
    var logoScale = Math.min(logoMaxWidth / logo.getWidth(), logoMaxHeight / logo.getHeight());
    var logoWidth = logo.getWidth() * logoScale;
    var logoHeight = logo.getHeight() * logoScale;
    logo.setLeft(pageContentX((leftSectionX - logoWidth) / 2))
      .setTop(pageContentY(footerY + (footerHeight - logoHeight) / 2))
      .setWidth(logoWidth).setHeight(logoHeight);
  } catch (error) {
    var logoMessage = error.message || String(error);
    var logoWarning = mapWarning(logoLayer, logoMessage);
    logoWarning.displayName = "Map footer logo";
    warnings.push(logoWarning);
    Logger.log("Map footer logo unavailable (expected at " +
      logoWarning.expectedLocation + "): " + logoMessage);
  }

  var leftRule = slide.insertLine(SlidesApp.LineCategory.STRAIGHT,
    pageContentX(leftSectionX), pageContentY(footerY), pageContentX(leftSectionX), pageContentY(footerY + footerHeight));
  leftRule.getLineFill().setSolidFill("#000000");
  var rightRule = slide.insertLine(SlidesApp.LineCategory.STRAIGHT,
    pageContentX(rightSectionX), pageContentY(footerY), pageContentX(rightSectionX), pageContentY(footerY + footerHeight));
  rightRule.getLineFill().setSolidFill("#000000");

  var countyText = analysis.metadata.countyNames && analysis.metadata.countyNames.length
    ? analysis.metadata.countyNames.join(", ").toUpperCase() : "COUNTY NOT IDENTIFIED";
  var info = [
    analysis.projectName || NEPA_CONFIG.projectName,
    analysis.stateProjectNumber ? "State Project No. " + analysis.stateProjectNumber : "",
    analysis.federalProjectNumber ? "Federal Project No. " + analysis.federalProjectNumber : "",
    countyText,
    "NEPA Screening Map"
  ].filter(function(value) { return !!value; }).join("\n");
  var centerX = leftSectionX + 10;
  var centerWidth = rightSectionX - centerX - 10;
  var infoBox = slide.insertTextBox(info, pageContentX(centerX), pageContentY(footerY + 6), centerWidth, footerHeight - 12);
  infoBox.getFill().setTransparent();
  infoBox.setContentAlignment(SlidesApp.ContentAlignment.MIDDLE);
  var infoText = infoBox.getText();
  var lines = info.split("\n");
  var longestLineEm = lines.reduce(function(maximum, line) {
    return Math.max(maximum, estimateFooterTextWidthEm(line));
  }, 1);
  var footerFontSize = Math.max(4, Math.min(12, Math.floor((centerWidth - 12) / longestLineEm * 2) / 2));
  infoText.getTextStyle().setFontFamily("Arial").setFontSize(footerFontSize);
  var paragraphs = infoText.getParagraphs();
  for (var paragraphIndex = 0; paragraphIndex < paragraphs.length; paragraphIndex++) {
    paragraphs[paragraphIndex].getRange().getTextStyle()
      .setFontSize(footerFontSize)
      .setBold(paragraphIndex === 0 || paragraphIndex === paragraphs.length - 1)
      .setFontFamily("Arial");
  }

  var counties = analysis.metadata.countyNames || [];
  addCountyInset(slide, counties, rightSectionX + 5, footerY + 5, 85, footerHeight - 10, warnings);
  var countyInsetLabelText = counties.length
    ? countyText + (counties.length === 1 ? " COUNTY" : " COUNTIES")
    : "COUNTY NOT IDENTIFIED";
  var countyLabelY = footerY + 12 - (0.2 * 72);
  var countyLabel = slide.insertTextBox(countyInsetLabelText,
    pageContentX(rightSectionX + 90), pageContentY(countyLabelY), 60, 25);
  countyLabel.getFill().setTransparent();
  var countyFontSize = counties.length > 1
    ? Math.max(4, Math.min(7, 60 / estimateFooterTextWidthEm(countyInsetLabelText))) : 7;
  countyLabel.getText().getTextStyle().setFontSize(countyFontSize).setBold(true).setFontFamily("Arial");
  drawMapNorthArrow(slide, rightSectionX + 105, footerY + 38, 20, 32);
}

function estimateFooterTextWidthEm(text) {
  var widthEm = 0;
  var narrowCharacters = "ilI.,'!|:;";
  var wideCharacters = "MW@%&mw";
  var uppercaseAndDigits = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  for (var i = 0; i < text.length; i++) {
    var character = text.charAt(i);
    if (narrowCharacters.indexOf(character) !== -1) widthEm += 0.3;
    else if (wideCharacters.indexOf(character) !== -1) widthEm += 0.9;
    else if (character === " ") widthEm += 0.32;
    else if (uppercaseAndDigits.indexOf(character) !== -1) widthEm += 0.65;
    else widthEm += 0.56;
  }
  return widthEm * 1.1;
}
function addCountyInset(slide, counties, x, y, width, height, warnings) {
  var layer = {
    name: "County inset map",
    longName: "Map footer county inset",
    source: "https://gis.transportation.wv.gov/arcgis/rest/services/Boundaries/MapServer/export"
  };
  try {
    var uniqueValueInfos = counties.map(function(county) {
      return {
        value: county,
        symbol: {
          type: "esriSFS",
          style: "esriSFSSolid",
          color: [255, 0, 0, 255],
          outline: { type: "esriSLS", style: "esriSLSSolid", color: [0, 0, 0, 255], width: 1.5 }
        }
      };
    });
    var dynamicLayers = [{
      id: 1,
      source: { type: "mapLayer", mapLayerId: 1 },
      drawingInfo: {
        renderer: {
          type: "uniqueValue",
          field1: "NAME",
          fieldDelimiter: ", ",
          defaultSymbol: {
            type: "esriSFS",
            style: "esriSFSNull",
            outline: { type: "esriSLS", style: "esriSLSSolid", color: [0, 0, 0, 255], width: 1.5 }
          },
          uniqueValueInfos: uniqueValueInfos
        }
      }
    }];
    var bbox = "-83.51931787241341,36.88930690440627,-77.72553094737698,41.04425403872816";
    var exportPayload = {
      bbox: bbox,
      bboxSR: "4326",
      imageSR: "4326",
      size: "300,300",
      format: "png32",
      transparent: "true",
      dynamicLayers: JSON.stringify(dynamicLayers),
      dpi: "150",
      f: "image"
    };
    var response = fetchArcGisRestResponse(layer.source, exportPayload, "image");
    if (response.getResponseCode() < 200 || response.getResponseCode() >= 300) {
      throw new Error("County inset export returned HTTP " + response.getResponseCode());
    }
    var insetBlob = response.getBlob();
    if ((insetBlob.getContentType() || "").indexOf("image/") !== 0) {
      throw new Error("County inset export returned " + (insetBlob.getContentType() || "an unknown content type"));
    }
    insetBlob.setName("nepa-county-inset.png");
    slide.insertImage(insetBlob, pageContentX(x), pageContentY(y), width, height);
    var frame = slide.insertShape(SlidesApp.ShapeType.RECTANGLE,
      pageContentX(x), pageContentY(y), width, height);
    frame.getFill().setTransparent();
    frame.getBorder().getLineFill().setSolidFill("#000000");
  } catch (error) {
    var message = error.message || String(error);
    var warning = mapWarning(layer, message);
    warning.displayName = "County inset map";
    warnings.push(warning);
    Logger.log("Map layer unavailable: County inset (expected at " +
    warning.expectedLocation + "): " + message);
  }
}

function drawMapNorthArrow(slide, x, y, width, height) {
  var arrow = slide.insertShape(SlidesApp.ShapeType.UP_ARROW,
    pageContentX(x), pageContentY(y), width, height);
  arrow.getFill().setSolidFill("#000000");
  arrow.getBorder().getLineFill().setSolidFill("#000000");
  var labelY = (y - 12) + (0.2 * 72);
  var northLabel = slide.insertTextBox("N",
    pageContentX(x - 2), pageContentY(labelY), width + 4, 15);
  northLabel.getFill().setTransparent();
  var text = northLabel.getText();
  text.getTextStyle().setFontSize(12).setBold(true).setFontFamily("Arial").setForegroundColor("#FFFFFF");
  text.getParagraphs()[0].getRange().getParagraphStyle()
    .setParagraphAlignment(SlidesApp.ParagraphAlignment.CENTER);
}

function pageContentX(x) {
  return x + NEPA_CONFIG.pageContentOffsetX;
}

function pageContentY(y) {
  return y + NEPA_CONFIG.pageContentOffsetY;
}

function mapWarning(layer, message) {
  var name = layer && layer.name ? String(layer.name) : "unnamed layer";
  var longName = layer && layer.longName ? String(layer.longName) : "not provided";
  return {
    name: "Map - " + name,
    displayName: "Map layer: " + name + " [" + longName + "]",
    longName: longName,
    source: getLayerSourceLocation(layer),
    expectedLocation: describeExpectedLayerLocation(layer),
    status: "WARNING",
    features: [],
    error: message
  };
}
