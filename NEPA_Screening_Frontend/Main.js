var NEPA_MAX_UPLOAD_BYTES = 10 * 1024 * 1024;
var NEPA_MAX_GEOJSON_CELL_CHARS = 40000;
var NEPA_MAX_SHEET_CELL_CHARS = 50000;
var NEPA_MAX_PROJECT_GEOJSON_BYTES = 10 * 1024 * 1024;
var NEPA_MAX_LINEAR_BUFFER_METERS = 100000;
var NEPA_LRS_URL = "https://gis.transportation.wv.gov/arcgis/rest/services/Roads_And_Highways/Publication_LRS/MapServer/exts/LRSServer";
var NEPA_LRS_NETWORK_LAYER_ID = 89;
var NEPA_OUTPUT_SPREADSHEET_PROPERTY = "ECZ_OUTPUT_SPREADSHEET_ID";
var NEPA_OUTPUT_SPREADSHEET_ID = "";
var NEPA_WVDOH_MEASURES_API_URL = "https://gis.transportation.wv.gov/api/measures/";
var NEPA_SUBMISSIONS_SHEET_NAME = "Submissions";
var NEPA_SUBMISSION_HEADERS = [
  "Submitted at",
  "Email",
  "Project name",
  "State number",
  "Federal number",
  "Original file name",
  "Project type"
];
var NEPA_PROJECT_TYPES = ["Bridge", "Short span", "Linear", "Other"];
var NEPA_AUTHORIZED_GROUP_EMAIL = "dotddenvirgisdata@wv.gov";
var NEPA_EMAIL_LIST_SPREADSHEET_ID = "1emaEYAiBhQlYP87naeksd8KKur5qEcBCdhxb_1Kxymw";

function isUserAuthorized() {
  if (typeof Session === "undefined") return true; // Offline / unit test environment
  var userEmail = "";
  try {
    userEmail = Session.getActiveUser().getEmail();
  } catch (e) {}
  if (!userEmail) {
    try {
      userEmail = Session.getEffectiveUser().getEmail();
    } catch (e) {}
  }
  if (!userEmail) return true; // Environment without active session

  // 1. Check Google Groups
  if (typeof GroupsApp !== "undefined" && GroupsApp.getGroupByEmail) {
    try {
      var group = GroupsApp.getGroupByEmail(NEPA_AUTHORIZED_GROUP_EMAIL);
      if (group && group.hasUser(userEmail)) {
        return true;
      }
    } catch (e) {}
  }

  // 2. Check authorized emails spreadsheet
  var authorizedEmails = getAuthorizedEmails();
  if (authorizedEmails && authorizedEmails.length) {
    var lower = userEmail.toLowerCase();
    for (var i = 0; i < authorizedEmails.length; i++) {
      if (authorizedEmails[i].toLowerCase() === lower) {
        return true;
      }
    }
  }

  return false;
}

function getAuthorizedEmails() {
  if (typeof CacheService !== "undefined" && CacheService.getScriptCache) {
    try {
      var cached = CacheService.getScriptCache().get("nepa_authorized_emails");
      if (cached) return JSON.parse(cached);
    } catch (e) {}
  }

  var emails = [];
  if (typeof SpreadsheetApp !== "undefined") {
    try {
      var ss = SpreadsheetApp.openById(NEPA_EMAIL_LIST_SPREADSHEET_ID);
      var sheet = ss.getSheets()[0];
      var lastRow = sheet.getLastRow();
      if (lastRow >= 1) {
        var values = sheet.getRange(1, 2, lastRow, 1).getValues(); // Column B
        for (var i = 0; i < values.length; i++) {
          var val = String(values[i][0] || "").trim();
          if (val && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val)) {
            if (emails.indexOf(val) === -1) {
              emails.push(val);
            }
          }
        }
      }
    } catch (err) {}
  }

  if (typeof CacheService !== "undefined" && CacheService.getScriptCache && emails.length) {
    try {
      CacheService.getScriptCache().put("nepa_authorized_emails", JSON.stringify(emails), 1800);
    } catch (e) {}
  }
  return emails;
}

function doGet() {
  if (!isUserAuthorized()) {
    var userEmail = "";
    try { userEmail = Session.getActiveUser().getEmail(); } catch (e) {}
    var deniedHtml = "<!DOCTYPE html><html><head><meta name='viewport' content='width=device-width, initial-scale=1'><style>" +
      "body { font-family: Arial, sans-serif; background: #f4f6f8; margin: 0; padding: 40px 16px; color: #1f2933; }" +
      ".card { max-width: 600px; margin: 40px auto; background: #fff; border: 1px solid #d9e1e8; border-radius: 8px; padding: 32px; box-shadow: 0 2px 4px rgba(0,0,0,0.05); }" +
      "h1 { color: #8d1a12; font-size: 22px; margin-top: 0; }" +
      "p { line-height: 1.6; color: #52616b; }" +
      "</style></head><body>" +
      "<div class='card'>" +
      "<h1>Access Restricted</h1>" +
      "<p>You do not have permission to access the ECZ Screening tool. This application is restricted to members of <strong>DOT DD Env_Sec_GIS_Data</strong> (<code>" + NEPA_AUTHORIZED_GROUP_EMAIL + "</code>)." +
      (userEmail ? "<br><br>Signed in as: <strong>" + userEmail + "</strong>" : "") +
      "</p>" +
      "<p>If you require access, please contact your administrator to be added to the group.</p>" +
      "</div></body></html>";
    return HtmlService.createHtmlOutput(deniedHtml)
      .setTitle("Access Restricted - ECZ Screening");
  }

  var template = HtmlService.createTemplateFromFile("Index");
  template.authorizedEmails = getAuthorizedEmails();
  return template.evaluate()
    .setTitle("ECZ GeoJSON Converter")
    .addMetaTag("viewport", "width=device-width, initial-scale=1");
}

function prepareEczForConfirmation(formData) {
  if (!isUserAuthorized()) {
    throw new Error("Access restricted: You must be a member of " + NEPA_AUTHORIZED_GROUP_EMAIL + " to use this tool.");
  }
  if (!formData || typeof formData !== "object") {
    throw new Error("The upload form did not provide project information.");
  }

  var email = String(formData.email || "").trim();
  var projectName = String(formData.projectName || "").trim();
  var projectType = String(formData.projectType || "").trim();
  var stateNumber = String(formData.stateNumber || "").trim();
  var federalNumber = String(formData.federalNumber || "").trim();
  var bufferDistanceMeters = formData.bufferDistanceMeters === undefined ||
      formData.bufferDistanceMeters === null || String(formData.bufferDistanceMeters).trim() === ""
    ? 15
    : Number(formData.bufferDistanceMeters);
  var fileName = String(formData.fileName || "").trim();
  var fileBase64 = String(formData.fileBase64 || "");
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) {
    throw new Error("Enter a valid email address.");
  }
  if (!projectName) throw new Error("Enter a project name.");
  if (NEPA_PROJECT_TYPES.indexOf(projectType) === -1) {
    throw new Error("Choose Bridge, Short span, Linear, or Other as the project type.");
  }
  if (!stateNumber) throw new Error("Enter a state number.");
  if (projectName.length > 200 || stateNumber.length > 80 || federalNumber.length > 80) {
    throw new Error("Project name and project numbers must be within their maximum lengths.");
  }
  if (projectType === "Linear" && (!isFinite(bufferDistanceMeters) ||
      bufferDistanceMeters < 5 || bufferDistanceMeters > NEPA_MAX_LINEAR_BUFFER_METERS)) {
    throw new Error("Enter a linear buffer distance of at least 5 and no more than 100000 meters.");
  }

  var rawFeatureCollection;
  if (formData.boundarySource === "route") {
    if (projectType !== "Linear") throw new Error("Route/milepoint input is only available for Linear projects.");
    var routeId = buildWvRouteId(formData.route);
    rawFeatureCollection = fetchRouteSegmentGeoJson(routeId, formData.route.beginMeasure, formData.route.endMeasure);
    fileName = "Route " + routeId + " " + Number(formData.route.beginMeasure) + "-" + Number(formData.route.endMeasure);
  } else if (formData.boundarySource === "route_points") {
    if (projectType !== "Linear") throw new Error("Point-to-point routing is only available for Linear projects.");
    rawFeatureCollection = parseSubmittedProjectGeoJson(formData.projectGeoJson);
    fileName = fileName || "Routed centerline.geojson";
  } else if (formData.boundarySource === "draw") {
    rawFeatureCollection = parseSubmittedProjectGeoJson(formData.projectGeoJson);
    fileName = "Drawn ECZ.geojson";
  } else {
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
    var contentType = /\.kml$/i.test(fileName)
      ? "application/vnd.google-earth.kml+xml"
      : "application/vnd.google-earth.kmz";
    var upload = Utilities.newBlob(fileBytes, contentType, fileName);
    var kmlText = extractKmlFromKmz(upload);
    rawFeatureCollection = kmlToGeoJson(kmlText);
  }

  if (formData.boundarySource === "draw" && projectType !== "Linear") {
    validateDrawnPolygonBoundary(rawFeatureCollection);
  }
  var hasLineGeometry = rawFeatureCollection.features.some(function(f) {
  return f.geometry && (f.geometry.type === "LineString" || f.geometry.type === "MultiLineString");
  });
  if (projectType === "Linear" && hasLineGeometry) {
    rawFeatureCollection = bufferLinearBoundary(rawFeatureCollection, bufferDistanceMeters);
  }
  var project = prepareEczBoundary(rawFeatureCollection);
  if (projectType === "Linear") {
    project.boundaryProcessing.processingSteps.unshift(
      "Buffered the selected centerline by " + bufferDistanceMeters + " meters with Turf.js."
    );
  }

  var downloads = getRepairedEczDownloads(project, projectName || "Repaired_ECZ");

  return {
    preparedGeoJson: {
      type: project.type,
      features: project.features
    },
    boundaryProcessing: project.boundaryProcessing,
    summary: {
      email: email,
      projectName: projectName,
      projectType: projectType,
      stateNumber: stateNumber,
      federalNumber: federalNumber,
      fileName: fileName,
      bufferDistanceMeters: projectType === "Linear" ? bufferDistanceMeters : ""
    },
    downloads: downloads
  };
}

function confirmEczSubmission(submissionData) {
  if (!isUserAuthorized()) {
    throw new Error("Access restricted: You must be a member of " + NEPA_AUTHORIZED_GROUP_EMAIL + " to use this tool.");
  }
  if (!submissionData || !submissionData.summary || !submissionData.preparedGeoJson) {
    throw new Error("Invalid confirmation data.");
  }

  var summary = submissionData.summary;
  var geoJsonText = typeof submissionData.preparedGeoJson === "string"
    ? submissionData.preparedGeoJson
    : JSON.stringify(submissionData.preparedGeoJson);

  var sheetResult = appendEczSubmission({
    email: summary.email,
    projectName: summary.projectName,
    projectType: summary.projectType,
    stateNumber: summary.stateNumber,
    federalNumber: summary.federalNumber,
    fileName: summary.fileName,
    bufferDistanceMeters: summary.bufferDistanceMeters,
    geoJsonText: geoJsonText
  });

  var formUrl = "";
  if (typeof ScriptApp !== "undefined" && ScriptApp.getService) {
    try {
      formUrl = ScriptApp.getService().getUrl();
    } catch (e) {}
  }

  return {
    rowNumber: sheetResult.rowNumber,
    sheetName: sheetResult.sheetName,
    formUrl: formUrl
  };
}

function runEczGeoJsonConversion(formData) {
  var prep = prepareEczForConfirmation(formData);
  var confirmed = confirmEczSubmission({
    summary: prep.summary,
    preparedGeoJson: prep.preparedGeoJson
  });

  return {
    rowNumber: confirmed.rowNumber,
    sheetName: confirmed.sheetName,
    boundaryProcessing: prep.boundaryProcessing,
    formUrl: confirmed.formUrl,
    downloads: prep.downloads
  };
}

function fetchWvdohMeasures(path) {
  var key = "wvdoh_m_" + String(path || "").replace(/[^a-zA-Z0-9_]/g, "_").slice(0, 200);
  if (typeof CacheService !== "undefined" && CacheService.getScriptCache) {
    try {
      var cached = CacheService.getScriptCache().get(key);
      if (cached) return JSON.parse(cached);
    } catch (e) {}
  }

  var url = NEPA_WVDOH_MEASURES_API_URL + String(path || "");
  var response = UrlFetchApp.fetch(url, { muteHttpExceptions: true });
  if (response.getResponseCode() !== 200) {
    throw new Error("The WVDOH measures API returned HTTP " + response.getResponseCode() + ".");
  }
  var content = response.getContentText();
  try {
    var data = JSON.parse(content);
    if (typeof CacheService !== "undefined" && CacheService.getScriptCache && content.length < 100000) {
      try {
        CacheService.getScriptCache().put(key, content, 21600); // cache for 6 hours
      } catch (e) {}
    }
    return data;
  } catch (error) {
    throw new Error("The WVDOH measures API returned an unreadable response.");
  }
}

function buildWvRouteId(route) {
  if (!route || typeof route !== "object") throw new Error("Enter route information.");
  var full = String(route.routeId || "").trim().toUpperCase();
  if (full) {
    if (!/^[A-Z0-9]{4,40}$/.test(full)) throw new Error("The route ID contains invalid characters.");
    return full;
  }
  throw new Error("Select a route using the Route ID builder dropdowns.");
}

function fetchRouteSegmentGeoJson(routeId, beginMeasure, endMeasure) {
  var begin = Number(beginMeasure);
  var end = Number(endMeasure);
  if (!isFinite(begin) || !isFinite(end) || begin < 0 || end < 0) {
    throw new Error("Enter valid beginning and ending mile points.");
  }
  if (begin === end) throw new Error("Beginning and ending mile points must differ.");
  var locations = [{ routeId: routeId, fromMeasure: Math.min(begin, end), toMeasure: Math.max(begin, end) }];
  var url = NEPA_LRS_URL + "/networkLayers/" + NEPA_LRS_NETWORK_LAYER_ID + "/measureToGeometry" +
    "?f=json&outSR=4326&temporalViewDate=&gdbVersion=" +
    "&locations=" + encodeURIComponent(JSON.stringify(locations));
  var response = UrlFetchApp.fetch(url, { muteHttpExceptions: true });
  if (response.getResponseCode() !== 200) {
    throw new Error("The WVDOT LRS service returned HTTP " + response.getResponseCode() + ".");
  }
  var data;
  try {
    data = JSON.parse(response.getContentText());
  } catch (error) {
    throw new Error("The WVDOT LRS service returned an unreadable response.");
  }
  if (data.error) throw new Error("WVDOT LRS error: " + (data.error.message || "request failed"));
  var location = data.locations && data.locations[0];
  if (!location || location.status !== "esriLocatingOK" || !location.geometry) {
    throw new Error("No route geometry was found for route " + routeId + " between those mile points (" +
      (location && location.status || "no result") + ").");
  }
  var paths = location.geometry.paths ||
    (location.geometry.type === "polyline" && location.geometry.paths) || [];
  paths = paths.map(function(path) {
    return path.map(function(point) { return [point[0], point[1]]; });
  }).filter(function(path) { return path.length >= 2; });
  if (!paths.length) throw new Error("The WVDOT LRS service returned no line geometry.");
  return {
    type: "FeatureCollection",
    features: paths.map(function(path) {
      return { type: "Feature", properties: {}, geometry: { type: "LineString", coordinates: path } };
    })
  };
}

function calculateRouteFromPoints(points) {
  if (!Array.isArray(points) || points.length < 2) {
    throw new Error("Select at least two points on the map.");
  }
  points.forEach(function(pt, idx) {
    if (!Array.isArray(pt) || pt.length < 2 || !isFinite(pt[0]) || !isFinite(pt[1])) {
      throw new Error("Point " + (idx + 1) + " has invalid coordinates.");
    }
  });

  // 1. If 2 points, try WVDOT LRS first for official state route centerline & mile points
  if (points.length === 2) {
    try {
      var lrsResult = tryWvdotLrsRoute(points[0], points[1]);
      if (lrsResult && lrsResult.features && lrsResult.features.length) {
        return lrsResult;
      }
    } catch (err) {
      // Fall through to Google Directions within Google Workspace
    }
  }

  // 2. Fall back to Google Maps DirectionFinder within the Google Apps Script ecosystem
  return routeViaGoogleDirections(points);
}

function tryWvdotLrsRoute(pt1, pt2) {
  var locations = [
    { geometry: { x: pt1[0], y: pt1[1] } },
    { geometry: { x: pt2[0], y: pt2[1] } }
  ];
  var url = NEPA_LRS_URL + "/networkLayers/" + NEPA_LRS_NETWORK_LAYER_ID + "/geometryToMeasure" +
    "?f=json&inSR=4326&tolerance=100&locations=" + encodeURIComponent(JSON.stringify(locations));
  var response = UrlFetchApp.fetch(url, { muteHttpExceptions: true });
  if (response.getResponseCode() !== 200) return null;
  var data;
  try {
    data = JSON.parse(response.getContentText());
  } catch (err) {
    return null;
  }
  if (!data.locations || data.locations.length < 2) return null;
  var loc1 = data.locations[0];
  var loc2 = data.locations[1];
  if (!loc1.results || !loc1.results.length || !loc2.results || !loc2.results.length) return null;

  var candidates1 = {};
  loc1.results.forEach(function(r) { candidates1[r.routeId] = r.measure; });
  var commonRouteId = null;
  var m1 = 0, m2 = 0;
  for (var i = 0; i < loc2.results.length; i++) {
    var r2 = loc2.results[i];
    if (candidates1[r2.routeId] !== undefined) {
      commonRouteId = r2.routeId;
      m1 = candidates1[commonRouteId];
      m2 = r2.measure;
      break;
    }
  }
  if (!commonRouteId || Math.abs(m1 - m2) < 0.0001) return null;

  var geoJson = fetchRouteSegmentGeoJson(commonRouteId, Math.min(m1, m2), Math.max(m1, m2));
  geoJson.routeId = commonRouteId;
  geoJson.fromMeasure = Math.min(m1, m2);
  geoJson.toMeasure = Math.max(m1, m2);
  geoJson.source = "WVDOT LRS";
  return geoJson;
}

function routeViaGoogleDirections(points) {
  if (typeof Maps === "undefined" || !Maps.newDirectionFinder) {
    throw new Error("Google Maps routing service is not available.");
  }
  var start = points[0];
  var end = points[points.length - 1];
  var finder = Maps.newDirectionFinder()
    .setOrigin(start[1], start[0])
    .setDestination(end[1], end[0])
    .setMode(Maps.DirectionFinder.Mode.DRIVING);
  for (var i = 1; i < points.length - 1; i++) {
    finder.addWaypoint(points[i][1], points[i][0]);
  }
  var res = finder.getDirections();
  if (!res || res.status !== "OK" || !res.routes || !res.routes.length) {
    throw new Error("Could not find a driving route between the selected points (" + (res && res.status || "no route") + ").");
  }
  var overview = res.routes[0].overview_polyline && res.routes[0].overview_polyline.points;
  if (!overview) {
    throw new Error("The routing service did not return route coordinates.");
  }
  var coords = decodeGooglePolyline(overview);
  return {
    type: "FeatureCollection",
    source: "Google Directions",
    summary: res.routes[0].summary || "Road Route",
    features: [{
      type: "Feature",
      properties: {
        summary: res.routes[0].summary || "Road Route"
      },
      geometry: {
        type: "LineString",
        coordinates: coords
      }
    }]
  };
}

function decodeGooglePolyline(encoded) {
  var points = [];
  var index = 0, len = encoded.length;
  var lat = 0, lng = 0;
  while (index < len) {
    var b, shift = 0, result = 0;
    do {
      b = encoded.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);
    var dlat = ((result & 1) ? ~(result >> 1) : (result >> 1));
    lat += dlat;

    shift = 0;
    result = 0;
    do {
      b = encoded.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);
    var dlng = ((result & 1) ? ~(result >> 1) : (result >> 1));
    lng += dlng;

    points.push([lng * 1e-5, lat * 1e-5]);
  }
  return points;
}

function parseSubmittedProjectGeoJson(value) {
  var projectGeoJson = value;
  if (typeof projectGeoJson === "string") {
    if (projectGeoJson.length > NEPA_MAX_PROJECT_GEOJSON_BYTES) {
      throw new Error("The drawn GeoJSON exceeds the 10 MiB processing limit.");
    }
    try {
      projectGeoJson = JSON.parse(projectGeoJson);
    } catch (error) {
      throw new Error("The drawn project boundary is not valid GeoJSON.");
    }
  } else if (projectGeoJson) {
    var serialized = JSON.stringify(projectGeoJson);
    if (serialized.length > NEPA_MAX_PROJECT_GEOJSON_BYTES) {
      throw new Error("The drawn GeoJSON exceeds the 10 MiB processing limit.");
    }
  }
  if (!projectGeoJson || projectGeoJson.type !== "FeatureCollection" ||
      !Array.isArray(projectGeoJson.features) || !projectGeoJson.features.length) {
    throw new Error("Draw a project boundary on the map before submitting.");
  }
  projectGeoJson.features.forEach(function(feature) {
    if (!feature || feature.type !== "Feature" || !feature.geometry) {
      throw new Error("The drawn boundary must contain GeoJSON features with geometry.");
    }
    validateSubmittedGeometry(feature.geometry);
  });
  return projectGeoJson;
}

function validateSubmittedGeometry(geometry) {
  var supportedTypes = ["Point", "MultiPoint", "LineString", "MultiLineString",
    "Polygon", "MultiPolygon", "GeometryCollection"];
  if (!geometry || supportedTypes.indexOf(geometry.type) === -1) {
    throw new Error("The drawn boundary contains an unsupported GeoJSON geometry.");
  }
  if (geometry.type === "GeometryCollection") {
    if (!Array.isArray(geometry.geometries) || !geometry.geometries.length) {
      throw new Error("The drawn boundary contains an empty geometry collection.");
    }
    geometry.geometries.forEach(validateSubmittedGeometry);
    return;
  }
  validateSubmittedCoordinateTree(geometry.coordinates);
}

function validateSubmittedCoordinateTree(coordinates) {
  if (!Array.isArray(coordinates) || !coordinates.length) {
    throw new Error("The drawn boundary contains an invalid coordinate structure.");
  }
  if (typeof coordinates[0] === "number" || typeof coordinates[1] === "number") {
    if (coordinates.length < 2 || coordinates.length > 3 ||
        typeof coordinates[0] !== "number" || typeof coordinates[1] !== "number" ||
        !isFinite(coordinates[0]) || !isFinite(coordinates[1]) ||
        coordinates[0] < -180 || coordinates[0] > 180 ||
        coordinates[1] < -90 || coordinates[1] > 90 ||
        (coordinates.length === 3 &&
          (typeof coordinates[2] !== "number" || !isFinite(coordinates[2])))) {
      throw new Error("Drawn coordinates must be finite WGS 84 longitude/latitude values.");
    }
    return;
  }
  coordinates.forEach(validateSubmittedCoordinateTree);
}

function validateDrawnPolygonBoundary(featureCollection) {
  var validPolygon = featureCollection.features.every(function(feature) {
    return feature && feature.type === "Feature" && feature.geometry &&
      (feature.geometry.type === "Polygon" || feature.geometry.type === "MultiPolygon");
  });
  if (!validPolygon) throw new Error("Draw polygons for non-linear project types.");
}

function unlockSubmissionsFile(spreadsheet, sheet) {
  if (typeof Drive !== "undefined" && Drive.Files && spreadsheet) {
    try {
      Drive.Files.update({ contentRestrictions: [{ readOnly: false }] }, spreadsheet.getId());
    } catch (e) {}
  }
  if (sheet && typeof sheet.getProtections === "function") {
    try {
      var protections = sheet.getProtections(SpreadsheetApp.ProtectionType.SHEET);
      for (var i = 0; i < protections.length; i++) {
        try { protections[i].remove(); } catch (e) {}
      }
    } catch (e) {}
  }
}

function lockSubmissionsFile(spreadsheet, sheet) {
  if (sheet && typeof sheet.protect === "function") {
    try {
      var protections = sheet.getProtections(SpreadsheetApp.ProtectionType.SHEET);
      if (!protections || !protections.length) {
        sheet.protect().setDescription("Submissions locked");
      }
    } catch (e) {}
  }
  if (typeof Drive !== "undefined" && Drive.Files && spreadsheet) {
    try {
      Drive.Files.update({ contentRestrictions: [{ readOnly: true, reason: "Locked after submission" }] }, spreadsheet.getId());
    } catch (e) {}
  }
}

function appendEczSubmission(submission) {
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(30000)) throw new Error("Another submission is being saved. Please try again.");
  var spreadsheet;
  var sheet;
  try {
    spreadsheet = getEczOutputSpreadsheet();
    sheet = spreadsheet.getSheetByName(NEPA_SUBMISSIONS_SHEET_NAME);
    if (!sheet) {
      var sheets = spreadsheet.getSheets();
      if (sheets.length === 1 && sheets[0].getLastRow() === 0) {
        sheet = sheets[0];
        sheet.setName(NEPA_SUBMISSIONS_SHEET_NAME);
      } else {
        sheet = spreadsheet.insertSheet(NEPA_SUBMISSIONS_SHEET_NAME);
      }
    }

    unlockSubmissionsFile(spreadsheet, sheet);

    var geoJsonParts = splitGeoJsonForCells(submission.geoJsonText);
    var headers = NEPA_SUBMISSION_HEADERS.slice();
    for (var i = 0; i < geoJsonParts.length; i++) {
      headers.push("Modified GeoJSON (part " + (i + 1) + ")");
    }
    ensureSubmissionHeaders(sheet, headers);

    var values = [
      new Date().toISOString(),
      sheetSafeText(submission.email),
      sheetSafeText(submission.projectName),
      sheetSafeText(submission.stateNumber),
      sheetSafeText(submission.federalNumber),
      sheetSafeText(submission.fileName),
      sheetSafeText(submission.projectType)
    ].concat(geoJsonParts);
    ensureSheetColumnCapacity(sheet, values.length);
    var rowNumber = sheet.getLastRow() + 1;
    sheet.getRange(rowNumber, 1, 1, values.length).setNumberFormat("@");
    sheet.getRange(rowNumber, 1, 1, values.length).setValues([values]);
    SpreadsheetApp.flush();
    return {
      rowNumber: rowNumber,
      spreadsheetUrl: spreadsheet.getUrl(),
      sheetName: sheet.getName()
    };
  } finally {
    if (spreadsheet && sheet) {
      lockSubmissionsFile(spreadsheet, sheet);
    }
    lock.releaseLock();
  }
}

function getEczOutputSpreadsheet() {
  var properties = PropertiesService.getScriptProperties();
  var spreadsheetId = NEPA_OUTPUT_SPREADSHEET_ID ||
    properties.getProperty(NEPA_OUTPUT_SPREADSHEET_PROPERTY);
  if (spreadsheetId) return SpreadsheetApp.openById(spreadsheetId);

  var spreadsheet = SpreadsheetApp.create("ECZ GeoJSON Submissions");
  properties.setProperty(NEPA_OUTPUT_SPREADSHEET_PROPERTY, spreadsheet.getId());
  return spreadsheet;
}

function ensureSubmissionHeaders(sheet, headers) {
  if (sheet.getLastRow() === 0) {
    ensureSheetColumnCapacity(sheet, headers.length);
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    sheet.setFrozenRows(1);
    return;
  }

  // Delete "Buffer distance (m)" column if it exists in the header row
  var maxCols = sheet.getMaxColumns();
  if (maxCols >= 7) {
    var checkCols = Math.min(maxCols, 15);
    var firstRow = sheet.getRange(1, 1, 1, checkCols).getValues()[0];
    for (var colIdx = firstRow.length - 1; colIdx >= 0; colIdx--) {
      if (firstRow[colIdx] === "Buffer distance (m)") {
        sheet.deleteColumn(colIdx + 1);
      }
    }
  }

  var existing = sheet.getRange(1, 1, 1, Math.min(sheet.getMaxColumns(), NEPA_SUBMISSION_HEADERS.length)).getValues()[0];
  for (var i = 0; i < 6; i++) {
    if (existing[i] !== NEPA_SUBMISSION_HEADERS[i]) {
      throw new Error("The configured output sheet has a different header layout; use a blank Submissions sheet.");
    }
  }
  if (existing[6] !== NEPA_SUBMISSION_HEADERS[6]) {
    if (existing[6] && existing[6] !== "Modified GeoJSON (part 1)") {
      throw new Error("The configured output sheet has an unexpected column after its submission fields.");
    }
    sheet.insertColumnBefore(7);
  }
  ensureSheetColumnCapacity(sheet, headers.length);
  sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
}

function ensureSheetColumnCapacity(sheet, requiredColumns) {
  var currentColumns = sheet.getMaxColumns();
  if (currentColumns < requiredColumns) {
    sheet.insertColumnsAfter(currentColumns, requiredColumns - currentColumns);
  }
}

function splitGeoJsonForCells(geoJsonText) {
  if (geoJsonText.length > NEPA_MAX_SHEET_CELL_CHARS * 1000) {
    throw new Error("The prepared GeoJSON is too large to store in the Google Sheet.");
  }
  var parts = [];
  for (var offset = 0; offset < geoJsonText.length; offset += NEPA_MAX_GEOJSON_CELL_CHARS) {
    parts.push(geoJsonText.slice(offset, offset + NEPA_MAX_GEOJSON_CELL_CHARS));
  }
  if (!parts.length) parts.push("{}");
  return parts;
}

function sheetSafeText(value) {
  var text = String(value || "");
  return /^[=+\-@]/.test(text) ? "'" + text : text;
}
