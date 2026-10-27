// ===== Source: ArcGis.gs =====
var NEPA_ARCGIS_PAGE_SIZE = 1000;
var NEPA_ARCGIS_MAX_PAGES = 30;
var NEPA_BRIDGE_SHEET_FEATURE_CACHE = {};

function getLayerSourceLocation(layer) {
  if (layer && layer.sourceType === "GOOGLE_SHEETS_BRIDGES") {
    return "Google Sheets spreadsheet " + layer.spreadsheetId + ", tab \"" + layer.sheetName + "\"";
  }
  var source = layer && layer.source !== null && layer.source !== undefined
    ? String(layer.source).trim()
    : "";
  return source || "not configured";
}

function describeExpectedLayerLocation(layer) {
  var longName = layer && layer.longName ? String(layer.longName) : "not provided";
  return "long name \"" + longName + "\"; data source \"" + getLayerSourceLocation(layer) + "\"";
}

function requireLayerSource(layer) {
  var source = getLayerSourceLocation(layer);
  if (source === "not configured") throw new Error("No data source is configured for this layer.");
  return source;
}

function queryLayerAgainstProject(layer, project, options) {
  options = options || {};
  if (layer.sourceType === "GOOGLE_SHEETS_BRIDGES") {
    return queryGoogleSheetBridgeLayer(layer, project, options);
  }
  var layerSource = requireLayerSource(layer);
  if (layer.sourceType === "DRIVE_GEOTIFF") {
    throw new Error("GeoTIFF screening is asynchronous; use queryGeoTiffAgainstProject().");
  }
  if (layerSource.indexOf("DRIVE_GEOJSON:") === 0) {
    return queryLocalGeoJsonLayer(layer, project, options);
  }
  var resultFeatures = [];
  var seen = {};
  var queryTasks = arcGisProjectQueryTasks(layer, project, options, layerSource);
  for (var g = 0; g < queryTasks.length; g++) {
    var queryTask = queryTasks[g];
    var queried = fetchArcGisFeatures(
      queryTask.layerSource, queryTask.payload, options.recordLimit
    );
    for (var f = 0; f < queried.features.length; f++) {
      var feature = queried.features[f];
      var key = arcGisFeatureKey(feature);
      if (!seen[key]) {
        seen[key] = true;
        resultFeatures.push(arcGisFeatureToGeoJson(feature));
      }
    }
  }
  return { features: resultFeatures, truncated: false };
}

function arcGisProjectQueryTasks(layer, project, options, layerSource) {
  options = options || {};
  layerSource = layerSource || requireLayerSource(layer);
  var queryGeometries = [];
  for (var i = 0; i < project.features.length; i++) {
    collectArcGisQueryGeometries(project.features[i].geometry, queryGeometries);
  }
  var returnGeometry = options.returnGeometry === true || layer.returnGeometry === true;
  return queryGeometries.map(function(queryGeometry) {
    var payload = {
      geometry: JSON.stringify(queryGeometry.geometry),
      geometryType: queryGeometry.geometryType,
      inSR: "4326",
      spatialRel: "esriSpatialRelIntersects",
      outFields: "*",
      returnGeometry: returnGeometry ? "true" : "false",
      f: "json"
    };
    if (options.where) payload.where = options.where;
    if (returnGeometry && !isUnmappedScreeningLayer(layer)) payload.outSR = "4326";
    if (options.distanceMiles) {
      payload.distance = options.distanceMiles;
      payload.units = "esriSRUnit_StatuteMile";
    }
    return { layerSource: layerSource, payload: payload };
  });
}

function queryArcGisExtent(layer, bbox, limit, whereClause) {
  if (layer.sourceType === "GOOGLE_SHEETS_BRIDGES") {
    var extentFeature = bboxPolygon(bbox);
    var turfApi = getTurfApi();
    var bridgeFeatures = loadGoogleSheetBridgeFeatures(layer).features.filter(function(feature) {
      return turfApi.booleanIntersects(extentFeature, feature);
    });
    return { features: bridgeFeatures.slice(0, limit), truncated: bridgeFeatures.length > limit };
  }
  var layerSource = requireLayerSource(layer);
  if (layerSource.indexOf("DRIVE_GEOJSON:") === 0) {
    var local = loadDriveGeoJsonLayer(layer, bbox);
    var extentFeature = bboxPolygon(bbox);
    var matches = [];
    var turfApi = getTurfApi();
    for (var i = 0; i < local.features.length; i++) {
      if (turfApi.booleanIntersects(extentFeature, local.features[i])) matches.push(local.features[i]);
    }
    return { features: matches.slice(0, limit), truncated: matches.length > limit };
  }
  var queryTask = arcGisExtentQueryTask(layer, bbox, limit, whereClause, layerSource);
  var result = fetchArcGisFeatures(layerSource, queryTask.payload, limit);
  return { features: result.features.map(arcGisFeatureToGeoJson), truncated: result.truncated };
}

function arcGisExtentQueryTask(layer, bbox, limit, whereClause, layerSource, options) {
  layerSource = layerSource || requireLayerSource(layer);
  options = options || {};
  var endpoint = {
    xmin: bbox[0], ymin: bbox[1], xmax: bbox[2], ymax: bbox[3],
    spatialReference: { wkid: 4326 }
  };
  var payload = {
    geometry: JSON.stringify(endpoint),
    geometryType: "esriGeometryEnvelope",
    inSR: "4326",
    spatialRel: "esriSpatialRelIntersects",
    outFields: options.outFields || "*",
    returnGeometry: options.returnGeometry === undefined
      ? layer.returnGeometry === false || isUnmappedScreeningLayer(layer)
        ? "false"
        : "true"
      : options.returnGeometry ? "true" : "false",
    f: "json"
  };
  if (whereClause) payload.where = whereClause;
  if (!isUnmappedScreeningLayer(layer)) payload.outSR = "4326";
  if (options.resultRecordCount) payload.resultRecordCount = options.resultRecordCount;
  return { layerSource: layerSource, payload: payload, limit: limit };
}

function arcGisExtentBatchKey(layer, bbox, whereClause) {
  return JSON.stringify([
    getLayerSourceLocation(layer),
    bbox,
    whereClause || ""
  ]);
}

function queryArcGisExtentBatchForMap(mapLayers, bbox, limit) {
  var cache = {};
  if (typeof UrlFetchApp === "undefined" ||
      typeof UrlFetchApp.fetchAll !== "function") return cache;
  var tasks = [];
  mapLayers.forEach(function(layer) {
    var protectedPresenceQuery = layer.mapServiceUrl &&
      normalizeArcGisLayerUrl(layer.mapServiceUrl) ===
        normalizeArcGisLayerUrl(NEPA_PROTECTED_LANDS_MAP_SERVICE_URL) &&
      !isNativeMapVectorLayer(layer) &&
      NEPA_MAP_ALWAYS_LEGEND_LAYERS.indexOf(layer.name) === -1;
    if (layer.mapExportLayers ||
        layer.mapServiceUrl && !isNativeMapVectorLayer(layer) && !protectedPresenceQuery ||
        layer.sourceType === "GOOGLE_SHEETS_BRIDGES" ||
        layer.sourceType === "DRIVE_GEOTIFF" ||
        String(layer.source || "").indexOf("DRIVE_GEOJSON:") === 0 ||
        !/^https?:\/\//i.test(String(layer.source || ""))) return;
    var whereClauses = layer.special === "mussels"
      ? ["StreamGroup <> '1' AND StreamGroup <> '3'", "StreamGroup = '1' OR StreamGroup = '3'"]
      : [""];
    whereClauses.forEach(function(whereClause) {
      var queryLimit = protectedPresenceQuery ? 1 : limit;
      var queryTask = arcGisExtentQueryTask(
        layer,
        bbox,
        queryLimit,
        whereClause,
        null,
        protectedPresenceQuery
          ? { returnGeometry: false, resultRecordCount: 1 }
          : null
      );
      tasks.push({
        layer: layer,
        layerSource: queryTask.layerSource,
        payload: queryTask.payload,
        limit: queryTask.limit,
        presenceOnly: protectedPresenceQuery,
        mapKey: arcGisExtentBatchKey(layer, bbox, whereClause)
      });
    });
  });
  if (!tasks.length) return cache;

  fetchArcGisQueryBatch(tasks).forEach(function(fetchedTask) {
    if (fetchedTask.error) {
      cache[fetchedTask.mapKey] = { error: fetchedTask.error };
      return;
    }
    try {
      var queried = fetchArcGisFeatures(
        fetchedTask.layerSource,
        fetchedTask.payload,
        fetchedTask.limit,
        fetchedTask.response
      );
      cache[fetchedTask.mapKey] = {
        features: queried.features.map(arcGisFeatureToGeoJson),
        truncated: queried.truncated
      };
    } catch (error) {
      cache[fetchedTask.mapKey] = { error: error.message || String(error) };
    }
  });
  return cache;
}

function isNativeMapVectorLayer(layer) {
  return !!(layer && (layer.nativeMarkerFill || layer.nativePolygonPattern));
}

function queryArcGisExtentWithBatch(cache, layer, bbox, limit, whereClause) {
  var key = arcGisExtentBatchKey(layer, bbox, whereClause);
  var result = cache && cache[key];
  if (!result) return queryArcGisExtent(layer, bbox, limit, whereClause);
  if (result.error) throw new Error(result.error);
  return result;
}

function isUnmappedScreeningLayer(layer) {
  var pathParts = String(layer && layer.longName || "")
    .split(/[\\/]+/)
    .filter(function(part) { return part.length > 0; });
  return pathParts.some(function(part) {
    return part.toLowerCase() === "unmapped";
  });
}

function queryGoogleSheetBridgeLayer(layer, project, options) {
  var turfApi = getTurfApi();
  var projectFeatures = project.features;
  if (options.distanceMiles) {
    projectFeatures = projectFeatures.map(function(feature) {
      return turfApi.buffer(feature, options.distanceMiles, { units: "miles" });
    });
  }
  var projectBbox = geoJsonFeaturesBbox(projectFeatures);
  var localFeatures = loadGoogleSheetBridgeFeatures(layer).features;
  var matches = [];
  var limit = options.recordLimit || NEPA_ARCGIS_PAGE_SIZE * NEPA_ARCGIS_MAX_PAGES;
  for (var i = 0; i < localFeatures.length; i++) {
    var coordinates = localFeatures[i].geometry.coordinates;
    if (coordinates[0] < projectBbox[0] || coordinates[0] > projectBbox[2] ||
        coordinates[1] < projectBbox[1] || coordinates[1] > projectBbox[3]) continue;
    for (var p = 0; p < projectFeatures.length; p++) {
      if (turfApi.booleanIntersects(localFeatures[i], projectFeatures[p])) {
        matches.push(localFeatures[i]);
        break;
      }
    }
    if (matches.length > limit) break;
  }
  return { features: matches.slice(0, limit), truncated: matches.length > limit };
}

function loadGoogleSheetBridgeFeatures(layer) {
  var cacheKey = String(layer.spreadsheetId) + ":" + String(layer.sheetName);
  if (Object.prototype.hasOwnProperty.call(NEPA_BRIDGE_SHEET_FEATURE_CACHE, cacheKey)) {
    return NEPA_BRIDGE_SHEET_FEATURE_CACHE[cacheKey];
  }
  if (!layer.spreadsheetId || !layer.sheetName || !layer.sheetFieldMap) {
    throw new Error("Bridge Google Sheets source is missing its spreadsheet ID, tab name, or field mapping.");
  }
  var spreadsheet = SpreadsheetApp.openById(layer.spreadsheetId);
  var sheet = spreadsheet.getSheetByName(layer.sheetName);
  if (!sheet) throw new Error("Google Sheets tab \"" + layer.sheetName + "\" was not found.");
  var lastRow = sheet.getLastRow();
  var lastColumn = sheet.getLastColumn();
  if (lastRow < 1 || lastColumn < 1) {
    throw new Error("Google Sheets tab \"" + layer.sheetName + "\" is empty.");
  }

  var headers = sheet.getRange(1, 1, 1, lastColumn).getValues()[0].map(function(header) {
    return String(header === null || header === undefined ? "" : header).trim().toLowerCase();
  });
  var fieldColumns = [];
  Object.keys(layer.sheetFieldMap).forEach(function(field) {
    var sourceHeader = String(layer.sheetFieldMap[field]).trim().toLowerCase();
    var matches = [];
    headers.forEach(function(header, index) {
      if (header === sourceHeader) matches.push(index + 1);
    });
    if (!matches.length) {
      throw new Error("Required Bridge column \"" + layer.sheetFieldMap[field] +
        "\" was not found in Google Sheets tab \"" + layer.sheetName + "\".");
    }
    if (matches.length > 1) {
      throw new Error("Bridge column \"" + layer.sheetFieldMap[field] +
        "\" appears more than once in Google Sheets tab \"" + layer.sheetName + "\".");
    }
    fieldColumns.push({ field: field, column: matches[0] });
  });

  var rowCount = Math.max(0, lastRow - 1);
  if (!rowCount) {
    var emptyResult = { type: "FeatureCollection", features: [] };
    NEPA_BRIDGE_SHEET_FEATURE_CACHE[cacheKey] = emptyResult;
    return emptyResult;
  }

  fieldColumns.sort(function(a, b) { return a.column - b.column; });
  var valuesByField = {};
  var groupStart = 0;
  while (groupStart < fieldColumns.length) {
    var groupEnd = groupStart + 1;
    while (groupEnd < fieldColumns.length &&
        fieldColumns[groupEnd].column === fieldColumns[groupEnd - 1].column + 1) {
      groupEnd++;
    }
    var firstColumn = fieldColumns[groupStart].column;
    var groupWidth = fieldColumns[groupEnd - 1].column - firstColumn + 1;
    var groupValues = sheet.getRange(2, firstColumn, rowCount, groupWidth).getValues();
    for (var fieldIndex = groupStart; fieldIndex < groupEnd; fieldIndex++) {
      var fieldColumn = fieldColumns[fieldIndex];
      var offset = fieldColumn.column - firstColumn;
      valuesByField[fieldColumn.field] = groupValues.map(function(row) {
        return row[offset];
      });
    }
    groupStart = groupEnd;
  }

  var features = [];
  for (var rowIndex = 0; rowIndex < rowCount; rowIndex++) {
    var properties = {};
    Object.keys(layer.sheetFieldMap).forEach(function(field) {
      properties[field] = valuesByField[field][rowIndex];
    });
    var isBlankRow = Object.keys(properties).every(function(field) {
      var value = properties[field];
      return value === null || value === undefined || String(value).trim() === "";
    });
    if (isBlankRow) continue;

    var latitude = bridgeCoordinate(properties.latitude);
    var longitude = bridgeCoordinate(properties.longitude);
    if (!isFinite(latitude) || latitude < -90 || latitude > 90) {
      throw new Error("Invalid Bridge latitude in Google Sheets row " + (rowIndex + 2) + ".");
    }
    if (!isFinite(longitude) || longitude < -180 || longitude > 180) {
      throw new Error("Invalid Bridge longitude in Google Sheets row " + (rowIndex + 2) + ".");
    }
    properties.brnum = normalizeBridgeNumber(properties.brnum);
    properties.feattype = normalizeBridgeFeatureType(properties.feattype);
    properties.latitude = latitude;
    properties.longitude = longitude;
    features.push({
      type: "Feature",
      properties: properties,
      geometry: { type: "Point", coordinates: [longitude, latitude] }
    });
  }

  var result = { type: "FeatureCollection", features: features };
  NEPA_BRIDGE_SHEET_FEATURE_CACHE[cacheKey] = result;
  return result;
}

function bridgeCoordinate(value) {
  if (value === null || value === undefined || String(value).trim() === "") return NaN;
  return typeof value === "number" ? value : Number(String(value).trim());
}

function normalizeBridgeNumber(value) {
  if (value === null || value === undefined) return value;
  return String(value).replace(/\(\)/g, "").replace(/\s{2,}/g, " ").trim();
}

function normalizeBridgeFeatureType(value) {
  if (value === null || value === undefined) return value;
  var parts = String(value).split(/\s+-\s+/);
  if (parts.length > 2) {
    parts = [parts[0], parts[1] + "/" + parts.slice(2).join("/")];
  }
  return parts.join("-").replace(/,\s*with or without pedestrian/i, "").trim();
}

function fetchArcGisRestResponse(url, payload, responseType, allowArcGisError) {
  if (isGetPreferredArcGisQuery(url)) {
    return fetchArcGisRestResponseGetFirst(url, payload, responseType, allowArcGisError);
  }

  var postResult = tryFetchArcGisRestResponse(url, {
    method: "post",
    payload: payload,
    muteHttpExceptions: true
  }, responseType, allowArcGisError);
  if (!postResult.error) {
    logSuccessfulArcGisQuery("POST", url, payload, postResult.response);
    return postResult.response;
  }

  Logger.log("ArcGIS POST request failed for " + url + ": " +
    postResult.error + "; retrying with GET.");

  var query = encodeArcGisRestQuery(payload);
  var getUrl = url + (url.indexOf("?") === -1 ? "?" : "&") + query;
  var getResult = tryFetchArcGisRestResponse(getUrl, {
    method: "get",
    muteHttpExceptions: true
  }, responseType, allowArcGisError);
  if (!getResult.error) {
    logSuccessfulArcGisQuery("GET", url, payload, getResult.response);
    return getResult.response;
  }

  Logger.log("ArcGIS GET request failed for " + getUrl + ": " + getResult.error);
  throw new Error("ArcGIS REST request failed for " + url +
    ". POST request failed: " + postResult.error +
    "; GET request failed: " + getResult.error);
}

function isGetPreferredArcGisQuery(url) {
  var queryUrl = String(url).split("?")[0].replace(/\/+$/, "").toLowerCase();
  return queryUrl === "https://services.wvgis.wvu.edu/arcgis/rest/services/" +
      "inland_waters/mussel_streams_nhd/mapserver/1/query" ||
    queryUrl === "https://geopub.epa.gov/arcgis/rest/services/" +
      "nepassist/transportation/mapserver/1/query";
}

function fetchArcGisRestResponseGetFirst(url, payload, responseType, allowArcGisError) {
  var query = encodeArcGisRestQuery(payload);
  var getUrl = url + (url.indexOf("?") === -1 ? "?" : "&") + query;
  var getResult = tryFetchArcGisRestResponse(getUrl, {
    method: "get",
    muteHttpExceptions: true
  }, responseType, allowArcGisError);
  if (!getResult.error) {
    logSuccessfulArcGisQuery("GET", url, payload, getResult.response);
    return getResult.response;
  }

  Logger.log("ArcGIS GET request failed for " + getUrl +
    ": " + getResult.error + "; retrying with POST.");
  var postResult = tryFetchArcGisRestResponse(url, {
    method: "post",
    payload: payload,
    muteHttpExceptions: true
  }, responseType, allowArcGisError);
  if (!postResult.error) {
    logSuccessfulArcGisQuery("POST", url, payload, postResult.response);
    return postResult.response;
  }

  Logger.log("ArcGIS POST request failed for " + url + ": " + postResult.error);
  throw new Error("ArcGIS REST request failed for " + url +
    ". GET request failed: " + getResult.error +
    "; POST request failed: " + postResult.error);
}

function fetchArcGisQueryBatch(queryTasks) {
  var requests = queryTasks.map(function(task) {
    return {
      layer: task.layer,
      payload: task.payload,
      screeningCase: task.screeningCase,
      mapKey: task.mapKey,
      candidates: arcGisQueryCandidates(task.layer, task.layerSource),
      candidateIndex: 0,
      failures: []
    };
  });
  var pending = requests.slice();

  while (pending.length) {
    var fetchRequests = pending.map(function(request) {
      var candidate = request.candidates[request.candidateIndex];
      return arcGisFetchRequest(candidate, request.payload);
    });
    var responses;
    try {
      responses = UrlFetchApp.fetchAll(fetchRequests);
    } catch (error) {
      var batchError = error.message || String(error);
      Logger.log("ArcGIS fetchAll batch failed: " + batchError);
      pending.forEach(function(request) {
        request.error = "ArcGIS fetchAll batch failed: " + batchError;
      });
      break;
    }
    if (!Array.isArray(responses) || responses.length !== pending.length) {
      var responseCountError = "ArcGIS fetchAll returned an unexpected number of responses.";
      Logger.log(responseCountError);
      pending.forEach(function(request) { request.error = responseCountError; });
      break;
    }

    var retry = [];
    for (var i = 0; i < pending.length; i++) {
      var request = pending[i];
      var candidate = request.candidates[request.candidateIndex];
      var response = responses[i];
      var responseError = arcGisRestResponseError(response, "json");
      if (!responseError) {
        request.response = response;
        request.layerSource = candidate.layerSource;
        logSuccessfulArcGisQuery(candidate.method.toUpperCase(),
          candidate.queryUrl, request.payload, response);
        continue;
      }

      request.failures.push(candidate.method.toUpperCase() + " " +
        candidate.queryUrl + ": " + responseError);
      request.candidateIndex++;
      if (request.candidateIndex < request.candidates.length) {
        var nextCandidate = request.candidates[request.candidateIndex];
        Logger.log("ArcGIS " + candidate.method.toUpperCase() +
          " request failed for " + candidate.queryUrl + ": " +
          responseError + "; retrying with " + nextCandidate.method.toUpperCase() +
          " at " + nextCandidate.queryUrl + ".");
        retry.push(request);
      } else {
        request.error = "ArcGIS REST request failed for " + candidate.queryUrl +
          ". " + request.failures.join("; ");
        Logger.log(request.error);
      }
    }
    pending = retry;
  }

  return requests;
}

function arcGisQueryCandidates(layer, layerSource) {
  var layerSources = [layerSource];
  if (isShpoFeatureServerLayer(layerSource)) {
    var mapLayerSource = layer.mapServiceUrl && layer.mapServiceLayerId !== undefined
      ? String(layer.mapServiceUrl).replace(/\/+$/, "") + "/" + layer.mapServiceLayerId
      : String(layerSource).replace(/\/FeatureServer\/(\d+)\/?$/i, "/MapServer/$1");
    layerSources = [mapLayerSource, layerSource];
  }

  var candidates = [];
  layerSources.forEach(function(source) {
    var queryUrl = normalizeArcGisLayerUrl(source) + "/query";
    var methods = isShpoFeatureServerLayer(layerSource)
      ? ["post", "get"]
      : isGetPreferredArcGisQuery(queryUrl) ? ["get", "post"] : ["post", "get"];
    methods.forEach(function(method) {
      candidates.push({
        layerSource: source,
        queryUrl: queryUrl,
        method: method
      });
    });
  });
  return candidates;
}

function isShpoFeatureServerLayer(layerSource) {
  return /\/services\/society\/wv_shpo_public\/featureserver\/\d+\/?$/i
    .test(String(layerSource || "").replace(/\/+$/, ""));
}

function arcGisFetchRequest(candidate, payload) {
  if (candidate.method === "post") {
    return {
      url: candidate.queryUrl,
      method: "post",
      payload: payload,
      muteHttpExceptions: true
    };
  }
  var query = encodeArcGisRestQuery(payload);
  return {
    url: candidate.queryUrl + (candidate.queryUrl.indexOf("?") === -1 ? "?" : "&") + query,
    method: "get",
    muteHttpExceptions: true
  };
}

function logSuccessfulArcGisQuery(method, url, payload, response) {
  if (!/\/query$/i.test(String(url).split("?")[0])) return;
  var content = JSON.parse(response.getContentText());
  var count = Array.isArray(content.features)
    ? content.features.length
    : Array.isArray(content.objectIds) ? content.objectIds.length : null;
  var summary = count === null
    ? "query completed successfully"
    : count + " feature(s) returned";
  Logger.log("ArcGIS " + method + " query succeeded for " +
    String(url).split("?")[0] + ": " + summary + ".");
}

function tryFetchArcGisRestResponse(url, options, responseType, allowArcGisError) {
  try {
    var response = UrlFetchApp.fetch(url, options);
    var responseError = arcGisRestResponseError(response, responseType, allowArcGisError);
    return responseError
      ? { error: responseError }
      : { response: response };
  } catch (error) {
    return { error: error.message || String(error) };
  }
}

function arcGisRestResponseError(response, responseType, allowArcGisError) {
  var status = response.getResponseCode();
  if (status < 200 || status >= 300) {
    return "HTTP " + status + ": " + response.getContentText().slice(0, 300);
  }

  if (responseType === "image") {
    var contentType = response.getBlob().getContentType() || "";
    if (contentType.indexOf("image/") !== 0) {
      return "HTTP " + status + " returned " + (contentType || "an unknown content type") +
        " instead of an image: " + response.getContentText().slice(0, 300);
    }
    return "";
  }

  var content;
  try {
    content = JSON.parse(response.getContentText());
  } catch (error) {
    return "HTTP " + status + " returned invalid JSON: " +
      response.getContentText().slice(0, 300);
  }
  if (!content || typeof content !== "object") {
    return "HTTP " + status + " returned a non-object JSON response.";
  }
  if (content.error) {
    if (allowArcGisError && allowArcGisError(content.error)) return "";
    return "HTTP " + status + " returned an ArcGIS error: " +
      (content.error.message || JSON.stringify(content.error)) + " " +
      JSON.stringify(content.error.details || []);
  }
  return "";
}

function encodeArcGisRestQuery(payload) {
  return Object.keys(payload).filter(function(key) {
    return payload[key] !== null && payload[key] !== undefined;
  }).map(function(key) {
    return encodeURIComponent(key) + "=" + encodeURIComponent(String(payload[key]));
  }).join("&");
}

function fetchArcGisFeatures(layerUrl, payload, recordLimit, firstResponse) {
  var url = normalizeArcGisLayerUrl(layerUrl) + "/query";
  var features = [];
  var seen = {};
  var objectIdField = "";
  var offset = 0;
  var maxFeatures = recordLimit || NEPA_ARCGIS_PAGE_SIZE * NEPA_ARCGIS_MAX_PAGES;
  var truncated = false;

  for (var page = 0; page < NEPA_ARCGIS_MAX_PAGES && features.length < maxFeatures; page++) {
    var pagePayload = {};
    Object.keys(payload).forEach(function(key) { pagePayload[key] = payload[key]; });
    if (page > 0) {
      pagePayload.resultOffset = offset;
      pagePayload.resultRecordCount = Math.min(NEPA_ARCGIS_PAGE_SIZE, maxFeatures - features.length);
    }
    var response = page === 0 && firstResponse
      ? firstResponse
      : fetchArcGisRestResponse(url, pagePayload, "json", function(error) {
        var message = (error.message || "") + " " + JSON.stringify(error.details || []);
        return page > 0 && /pagination is not supported/i.test(message);
      });
    var status = response.getResponseCode();
    if (status < 200 || status >= 300) {
      throw new Error("ArcGIS query failed for " + layerUrl + " (HTTP " + status + "): " + response.getContentText().slice(0, 500));
    }
    var json = JSON.parse(response.getContentText());
    if (json.error) {
      var errorMessage = json.error.message || JSON.stringify(json.error);
      var errorDetails = JSON.stringify(json.error.details || []);
      if (page > 0 && /pagination is not supported/i.test(errorMessage + " " + errorDetails)) {
        return fetchArcGisFeaturesByObjectIds(layerUrl, payload, maxFeatures);
      }
      throw new Error("ArcGIS query failed for " + layerUrl + ": " +
        errorMessage + " " + errorDetails);
    }
    objectIdField = json.objectIdFieldName || objectIdField;
    var pageFeatures = json.features || [];
    if (!pageFeatures.length) break;

    var added = 0;
    var pageSize = pagePayload.resultRecordCount || NEPA_ARCGIS_PAGE_SIZE;
    var pageExceededLimit = false;
    for (var i = 0; i < pageFeatures.length; i++) {
      var id = objectIdField && pageFeatures[i].attributes
        ? pageFeatures[i].attributes[objectIdField]
        : null;
      var key = id !== null && id !== undefined
        ? "id:" + id
        : JSON.stringify(pageFeatures[i].attributes || pageFeatures[i]);
      if (!seen[key]) {
        seen[key] = true;
        if (features.length >= maxFeatures) {
          pageExceededLimit = true;
          continue;
        }
        features.push(pageFeatures[i]);
        added++;
      }
    }
    offset += pageFeatures.length;
    if (pageExceededLimit || features.length >= maxFeatures) {
      truncated = pageExceededLimit || !!json.exceededTransferLimit || pageFeatures.length >= pageSize;
      break;
    }
    if (!json.exceededTransferLimit && pageFeatures.length < pageSize) break;
    if (added === 0) {
      throw new Error("ArcGIS pagination repeated results for " + layerUrl + "; refusing an incomplete screening result.");
    }
    if (page === NEPA_ARCGIS_MAX_PAGES - 1) truncated = true;
  }
  return { features: features, truncated: truncated };
}

function fetchArcGisFeaturesByObjectIds(layerUrl, payload, maxFeatures) {
  var url = normalizeArcGisLayerUrl(layerUrl) + "/query";
  var idPayload = {};
  Object.keys(payload).forEach(function(key) { idPayload[key] = payload[key]; });
  idPayload.returnIdsOnly = "true";
  idPayload.returnGeometry = "false";
  delete idPayload.outFields;

  var idResponse = fetchArcGisRestResponse(url, idPayload, "json");
  var idStatus = idResponse.getResponseCode();
  if (idStatus < 200 || idStatus >= 300) {
    throw new Error("ArcGIS object ID query failed for " + layerUrl + " (HTTP " + idStatus + "): " +
      idResponse.getContentText().slice(0, 500));
  }
  var idJson = JSON.parse(idResponse.getContentText());
  if (idJson.error) {
    throw new Error("ArcGIS object ID query failed for " + layerUrl + ": " +
      (idJson.error.message || JSON.stringify(idJson.error)) + " " +
      JSON.stringify(idJson.error.details || []));
  }
  if (!idJson.objectIds || !idJson.objectIds.length || !idJson.objectIdFieldName) {
    if (idJson.objectIds && !idJson.objectIds.length) return { features: [], truncated: false };
    throw new Error("ArcGIS object ID query returned no object IDs or object ID field for " + layerUrl + ".");
  }

  var objectIds = idJson.objectIds;
  var featureLimit = Math.min(maxFeatures, NEPA_ARCGIS_PAGE_SIZE * NEPA_ARCGIS_MAX_PAGES);
  var truncated = objectIds.length > featureLimit;
  if (truncated) objectIds = objectIds.slice(0, featureLimit);
  var features = [];
  var seen = {};
  var batchSize = NEPA_ARCGIS_PAGE_SIZE;
  for (var start = 0; start < objectIds.length; start += batchSize) {
    var queryPayload = {};
    Object.keys(payload).forEach(function(key) { queryPayload[key] = payload[key]; });
    queryPayload.objectIds = objectIds.slice(start, start + batchSize).join(",");
    var response = fetchArcGisRestResponse(url, queryPayload, "json");
    var status = response.getResponseCode();
    if (status < 200 || status >= 300) {
      throw new Error("ArcGIS object ID query failed for " + layerUrl + " (HTTP " + status + "): " +
        response.getContentText().slice(0, 500));
    }
    var json = JSON.parse(response.getContentText());
    if (json.error) {
      throw new Error("ArcGIS object ID query failed for " + layerUrl + ": " +
        (json.error.message || JSON.stringify(json.error)) + " " +
        JSON.stringify(json.error.details || []));
    }
    var batchFeatures = json.features || [];
    for (var i = 0; i < batchFeatures.length; i++) {
      var id = batchFeatures[i].attributes
        ? batchFeatures[i].attributes[idJson.objectIdFieldName]
        : null;
      var key = id !== null && id !== undefined
        ? "id:" + id
        : JSON.stringify(batchFeatures[i].attributes || batchFeatures[i]);
      if (!seen[key]) {
        seen[key] = true;
        features.push(batchFeatures[i]);
      }
    }
  }
  return { features: features, truncated: truncated };
}

function queryLocalGeoJsonLayer(layer, project, options) {
  var turfApi = getTurfApi();
  var projectFeatures = project.features;
  var distanceMiles = options.distanceMiles || 0;
  if (distanceMiles) {
    projectFeatures = project.features.map(function(feature) {
      return turfApi.buffer(feature, distanceMiles, { units: "miles" });
    });
  }
  var local = loadDriveGeoJsonLayer(layer, geoJsonFeaturesBbox(projectFeatures));

  var matches = [];
  var limit = options.recordLimit || NEPA_ARCGIS_PAGE_SIZE * NEPA_ARCGIS_MAX_PAGES;
  for (var i = 0; i < local.features.length; i++) {
    for (var p = 0; p < projectFeatures.length; p++) {
      if (turfApi.booleanIntersects(local.features[i], projectFeatures[p])) {
        matches.push(local.features[i]);
        break;
      }
    }
    if (matches.length > limit) break;
  }
  return { features: matches.slice(0, limit), truncated: matches.length > limit };
}

function loadDriveGeoJsonLayer(layer, spatialBbox) {
  var fileId = String(layer.source).replace(/^DRIVE_GEOJSON:/, "");
  if (!fileId || /^REPLACE_WITH_/.test(fileId)) {
    throw new Error("Configure the Drive GeoJSON file ID for layer \"" + layer.name + "\" at the top of Main.gs.");
  }
  var text = DriveApp.getFileById(fileId).getBlob().getDataAsString("UTF-8");
  var data = JSON.parse(text);
  var collection;
  if (data.type === "FeatureCollection" && Array.isArray(data.features)) {
    collection = data;
  } else if (data.type === "Feature" && data.geometry) {
    collection = { type: "FeatureCollection", features: [data] };
  } else if (data.type === "Topology" && typeof topojson !== "undefined" && topojson.feature) {
    collection = topoJsonFeatureCollectionInBbox(
      data, spatialBbox, layer.topoJsonObject, layer.topoJsonObjectIndex
    );
  } else if (data.type === "Topology") {
    throw new Error("Drive layer \"" + layer.name + "\" is TopoJSON; add a global topojson.feature bundle or convert it to GeoJSON.");
  } else {
    throw new Error("Drive layer \"" + layer.name + "\" must be GeoJSON Feature or FeatureCollection. Convert TopoJSON/GeoParquet before upload.");
  }
  collection.features.forEach(function(feature, index) {
    if (!feature || feature.type !== "Feature" || !feature.geometry) {
      throw new Error("Invalid GeoJSON feature " + (index + 1) + " in Drive layer \"" + layer.name + "\".");
    }
  });
  if (layer.topoJsonFeatureField) {
    var featureField = layer.topoJsonFeatureField.toLowerCase();
    collection.features = collection.features.filter(function(feature) {
      return Object.keys(feature.properties || {}).some(function(propertyName) {
        return propertyName.toLowerCase() === featureField;
      });
    });
    if (!collection.features.length) {
      throw new Error("TopoJSON Drive file " + fileId + " contains no features for \"" +
        layer.name + "\" using property \"" + layer.topoJsonFeatureField + "\".");
    }
  }
  return collection;
}

function topoJsonFeatureCollectionInBbox(topology, bbox, selectedObjectName, selectedObjectIndex) {
  if (!isValidSpatialBbox(bbox)) {
    throw new Error("A valid project-area bounding box is required to select TopoJSON geometries.");
  }
  var objectNames = Object.keys(topology.objects || {});
  if (selectedObjectName) {
    var objectName = objectNames.filter(function(name) {
      return name.toLowerCase() === String(selectedObjectName).toLowerCase();
    })[0];
    if (!objectName) {
      throw new Error("TopoJSON Drive file has no object named \"" + selectedObjectName +
        "\". Available objects: " + objectNames.join(", "));
    }
    objectNames = [objectName];
  } else if (selectedObjectIndex !== undefined && selectedObjectIndex !== null) {
    var objectIndex = Number(selectedObjectIndex);
    if (!Number.isInteger(objectIndex) || objectIndex < 0 || objectIndex >= objectNames.length) {
      throw new Error("TopoJSON object index " + selectedObjectIndex +
        " is outside the available object range (0-" + (objectNames.length - 1) + ").");
    }
    objectNames = [objectNames[objectIndex]];
  }
  if (!objectNames.length) throw new Error("Drive TopoJSON layer contains no objects.");
  var collection = { type: "FeatureCollection", features: [] };
  var arcBboxCache = {};
  objectNames.forEach(function(objectName) {
    var selectedObject = selectTopoJsonObjectByBbox(
      topology, topology.objects[objectName], bbox, arcBboxCache
    );
    if (!selectedObject) return;
    var converted = topojson.feature(topology, selectedObject);
    if (converted.type === "FeatureCollection") {
      collection.features = collection.features.concat(converted.features);
    } else {
      collection.features.push(converted);
    }
  });
  return collection;
}

function selectTopoJsonObjectByBbox(topology, geometry, bbox, arcBboxCache) {
  if (!geometry || typeof geometry !== "object") {
    throw new Error("Invalid TopoJSON geometry object.");
  }
  if (geometry.type === "GeometryCollection") {
    var selectedGeometries = [];
    (geometry.geometries || []).forEach(function(child) {
      var selectedChild = selectTopoJsonObjectByBbox(topology, child, bbox, arcBboxCache);
      if (selectedChild) selectedGeometries.push(selectedChild);
    });
    if (!selectedGeometries.length) return null;
    if (selectedGeometries.length === geometry.geometries.length) return geometry;
    var collectionCopy = copyTopoJsonGeometry(geometry);
    collectionCopy.geometries = selectedGeometries;
    return collectionCopy;
  }
  if (geometry.type === "Point") {
    return topoJsonPointIntersectsBbox(topology, geometry.coordinates, bbox) ? geometry : null;
  }
  if (geometry.type === "MultiPoint") {
    var selectedPoints = (geometry.coordinates || []).filter(function(point) {
      return topoJsonPointIntersectsBbox(topology, point, bbox);
    });
    if (!selectedPoints.length) return null;
    if (selectedPoints.length === geometry.coordinates.length) return geometry;
    var multiPointCopy = copyTopoJsonGeometry(geometry);
    multiPointCopy.coordinates = selectedPoints;
    return multiPointCopy;
  }
  if (geometry.type === "LineString") {
    return topoJsonArcGroupIntersectsBbox(topology, geometry.arcs, bbox, arcBboxCache)
      ? geometry
      : null;
  }
  if (geometry.type === "MultiLineString") {
    var selectedLines = (geometry.arcs || []).filter(function(line) {
      return topoJsonArcGroupIntersectsBbox(topology, line, bbox, arcBboxCache);
    });
    if (!selectedLines.length) return null;
    if (selectedLines.length === geometry.arcs.length) return geometry;
    var multiLineCopy = copyTopoJsonGeometry(geometry);
    multiLineCopy.arcs = selectedLines;
    return multiLineCopy;
  }
  if (geometry.type === "Polygon") {
    return topoJsonArcGroupIntersectsBbox(topology, geometry.arcs, bbox, arcBboxCache)
      ? geometry
      : null;
  }
  if (geometry.type === "MultiPolygon") {
    var selectedPolygons = (geometry.arcs || []).filter(function(polygon) {
      return topoJsonArcGroupIntersectsBbox(topology, polygon, bbox, arcBboxCache);
    });
    if (!selectedPolygons.length) return null;
    if (selectedPolygons.length === geometry.arcs.length) return geometry;
    var multiPolygonCopy = copyTopoJsonGeometry(geometry);
    multiPolygonCopy.arcs = selectedPolygons;
    return multiPolygonCopy;
  }
  return geometry;
}

function copyTopoJsonGeometry(geometry) {
  var copy = {};
  Object.keys(geometry).forEach(function(key) {
    if (key !== "bbox") copy[key] = geometry[key];
  });
  return copy;
}

function topoJsonPointIntersectsBbox(topology, point, bbox) {
  if (!Array.isArray(point) || point.length < 2 ||
      typeof point[0] !== "number" || typeof point[1] !== "number" ||
      !isFinite(point[0]) || !isFinite(point[1])) {
    throw new Error("Invalid TopoJSON point coordinates.");
  }
  var transform = topology.transform;
  var x = point[0];
  var y = point[1];
  if (transform) {
    validateTopoJsonTransform(transform);
    x = x * transform.scale[0] + transform.translate[0];
    y = y * transform.scale[1] + transform.translate[1];
  }
  return x >= bbox[0] && x <= bbox[2] && y >= bbox[1] && y <= bbox[3];
}

function topoJsonArcGroupIntersectsBbox(topology, arcReferences, bbox, arcBboxCache) {
  var flattenedReferences = [];
  flattenTopoJsonArcReferences(arcReferences, flattenedReferences);
  var groupBbox = [Infinity, Infinity, -Infinity, -Infinity];
  flattenedReferences.forEach(function(reference) {
    var arcBbox = topoJsonArcBbox(topology, reference, arcBboxCache);
    if (!arcBbox) return;
    groupBbox[0] = Math.min(groupBbox[0], arcBbox[0]);
    groupBbox[1] = Math.min(groupBbox[1], arcBbox[1]);
    groupBbox[2] = Math.max(groupBbox[2], arcBbox[2]);
    groupBbox[3] = Math.max(groupBbox[3], arcBbox[3]);
  });
  return isValidSpatialBbox(groupBbox) && spatialBboxesIntersect(groupBbox, bbox);
}

function flattenTopoJsonArcReferences(value, output) {
  if (Array.isArray(value)) {
    value.forEach(function(item) { flattenTopoJsonArcReferences(item, output); });
    return;
  }
  if (typeof value !== "number" || !isFinite(value) || Math.floor(value) !== value) {
    throw new Error("Invalid TopoJSON arc reference.");
  }
  output.push(value);
}

function topoJsonArcBbox(topology, arcReference, arcBboxCache) {
  var arcIndex = arcReference < 0 ? ~arcReference : arcReference;
  if (arcIndex < 0 || !topology.arcs || arcIndex >= topology.arcs.length) {
    throw new Error("TopoJSON geometry references an unavailable arc.");
  }
  if (Object.prototype.hasOwnProperty.call(arcBboxCache, arcIndex)) {
    return arcBboxCache[arcIndex];
  }
  var arc = topology.arcs[arcIndex];
  if (!Array.isArray(arc)) throw new Error("Invalid TopoJSON arc data.");
  var transform = topology.transform;
  if (transform) validateTopoJsonTransform(transform);
  var rawX = 0;
  var rawY = 0;
  var x;
  var y;
  var arcBbox = [Infinity, Infinity, -Infinity, -Infinity];
  arc.forEach(function(position) {
    if (!Array.isArray(position) || position.length < 2 ||
        typeof position[0] !== "number" || typeof position[1] !== "number" ||
        !isFinite(position[0]) || !isFinite(position[1])) {
      throw new Error("Invalid TopoJSON arc coordinates.");
    }
    if (transform) {
      rawX += position[0];
      rawY += position[1];
      x = rawX * transform.scale[0] + transform.translate[0];
      y = rawY * transform.scale[1] + transform.translate[1];
    } else {
      x = position[0];
      y = position[1];
    }
    arcBbox[0] = Math.min(arcBbox[0], x);
    arcBbox[1] = Math.min(arcBbox[1], y);
    arcBbox[2] = Math.max(arcBbox[2], x);
    arcBbox[3] = Math.max(arcBbox[3], y);
  });
  if (!isValidSpatialBbox(arcBbox)) arcBbox = null;
  arcBboxCache[arcIndex] = arcBbox;
  return arcBbox;
}

function validateTopoJsonTransform(transform) {
  if (!transform || !Array.isArray(transform.scale) || !Array.isArray(transform.translate) ||
      transform.scale.length < 2 || transform.translate.length < 2 ||
      typeof transform.scale[0] !== "number" || typeof transform.scale[1] !== "number" ||
      typeof transform.translate[0] !== "number" || typeof transform.translate[1] !== "number" ||
      !isFinite(transform.scale[0]) || !isFinite(transform.scale[1]) ||
      !isFinite(transform.translate[0]) || !isFinite(transform.translate[1])) {
    throw new Error("Invalid TopoJSON transform.");
  }
}

function spatialBboxesIntersect(first, second) {
  return first[0] <= second[2] && first[2] >= second[0] &&
    first[1] <= second[3] && first[3] >= second[1];
}

function isValidSpatialBbox(bbox) {
  return Array.isArray(bbox) && bbox.length === 4 &&
    bbox.every(function(value) { return typeof value === "number" && isFinite(value); }) &&
    bbox[0] <= bbox[2] && bbox[1] <= bbox[3];
}

function geoJsonFeaturesBbox(features) {
  var positions = [];
  features.forEach(function(feature) {
    collectGeometryPositions(feature.geometry, positions);
  });
  if (!positions.length) throw new Error("Cannot spatially filter TopoJSON with an empty project geometry.");
  var bbox = [Infinity, Infinity, -Infinity, -Infinity];
  positions.forEach(function(position) {
    bbox[0] = Math.min(bbox[0], position[0]);
    bbox[1] = Math.min(bbox[1], position[1]);
    bbox[2] = Math.max(bbox[2], position[0]);
    bbox[3] = Math.max(bbox[3], position[1]);
  });
  return bbox;
}

function getTurfApi() {
  if (typeof turf === "undefined" || !turf.booleanIntersects || !turf.buffer) {
    throw new Error("A Turf.js library exposing booleanIntersects and buffer is required for Drive-hosted GeoJSON layers. See README.md.");
  }
  return turf;
}

function normalizeArcGisLayerUrl(url) {
  return String(url).replace(/\/{2,}/g, "/").replace(":/", "://").replace(/\/+$/, "");
}

function collectArcGisQueryGeometries(geometry, output) {
  if (!geometry) throw new Error("The project KML contains a feature without geometry.");
  if (geometry.type === "GeometryCollection") {
    geometry.geometries.forEach(function(item) { collectArcGisQueryGeometries(item, output); });
    return;
  }
  var esri = geoJsonGeometryToEsri(geometry);
  output.push({ geometry: esri.geometry, geometryType: esri.geometryType });
}

function geoJsonGeometryToEsri(geometry) {
  var type = geometry.type;
  var coordinates = geometry.coordinates;
  if (type === "Point") {
    return {
      geometry: { x: coordinates[0], y: coordinates[1], spatialReference: { wkid: 4326 } },
      geometryType: "esriGeometryPoint"
    };
  }
  if (type === "MultiPoint") {
    return {
      geometry: { points: coordinates, spatialReference: { wkid: 4326 } },
      geometryType: "esriGeometryMultipoint"
    };
  }
  if (type === "LineString" || type === "MultiLineString") {
    return {
      geometry: { paths: type === "LineString" ? [coordinates] : coordinates, spatialReference: { wkid: 4326 } },
      geometryType: "esriGeometryPolyline"
    };
  }
  if (type === "Polygon" || type === "MultiPolygon") {
    var polygons = type === "Polygon" ? [coordinates] : coordinates;
    var rings = [];
    polygons.forEach(function(polygon) {
      polygon.forEach(function(ring, index) {
        var copy = ring.map(function(point) { return point.slice(0, 2); });
        var wantCounterClockwise = index > 0;
        if ((signedRingArea(copy) > 0) !== wantCounterClockwise) copy.reverse();
        rings.push(copy);
      });
    });
    return {
      geometry: { rings: rings, spatialReference: { wkid: 4326 } },
      geometryType: "esriGeometryPolygon"
    };
  }
  throw new Error("Unsupported GeoJSON project geometry type: " + type);
}

function signedRingArea(ring) {
  var area = 0;
  for (var i = 0; i < ring.length - 1; i++) {
    area += ring[i][0] * ring[i + 1][1] - ring[i + 1][0] * ring[i][1];
  }
  return area / 2;
}

function arcGisFeatureKey(feature) {
  var attributes = feature.attributes || {};
  var keys = Object.keys(attributes);
  for (var i = 0; i < keys.length; i++) {
    if (/^(objectid|fid|oid)$/i.test(keys[i])) return "id:" + attributes[keys[i]];
  }
  return JSON.stringify(attributes);
}

function arcGisFeatureToGeoJson(feature) {
  return {
    type: "Feature",
    properties: feature.attributes || {},
    geometry: arcGisGeometryToGeoJson(feature.geometry)
  };
}

function arcGisGeometryToGeoJson(geometry) {
  if (!geometry) return null;
  if (geometry.x !== undefined && geometry.y !== undefined) {
    return { type: "Point", coordinates: [geometry.x, geometry.y] };
  }
  if (geometry.points) {
    return { type: "MultiPoint", coordinates: geometry.points };
  }
  if (geometry.paths) {
    return geometry.paths.length === 1
      ? { type: "LineString", coordinates: geometry.paths[0] }
      : { type: "MultiLineString", coordinates: geometry.paths };
  }
  if (geometry.rings) {
    return { type: "Polygon", coordinates: geometry.rings };
  }
  throw new Error("ArcGIS returned an unsupported geometry.");
}

function bboxPolygon(bbox) {
  return {
    type: "Feature",
    properties: {},
    geometry: {
      type: "Polygon",
      coordinates: [[
        [bbox[0], bbox[1]], [bbox[2], bbox[1]], [bbox[2], bbox[3]],
        [bbox[0], bbox[3]], [bbox[0], bbox[1]]
      ]]
    }
  };
}

// ===== Source: Analysis.gs =====
var NEPA_DOHDISTRICTS = {
  Boone: 1, Clay: 1, Kanawha: 1, Mason: 1, Putnam: 1,
  Cabell: 2, Lincoln: 2, Logan: 2, Mingo: 2, Wayne: 2,
  Calhoun: 3, Jackson: 3, Pleasants: 3, Ritchie: 3, Roane: 3, Wirt: 3, Wood: 3,
  Doddridge: 4, Harrison: 4, Marion: 4, Monongalia: 4, Preston: 4, Taylor: 4,
  Berkeley: 5, Grant: 5, Hampshire: 5, Hardy: 5, Jefferson: 5, Mineral: 5, Morgan: 5,
  Brooke: 6, Hancock: 6, Marshall: 6, Ohio: 6, Tyler: 6, Wetzel: 6,
  Barbour: 7, Braxton: 7, Gilmer: 7, Lewis: 7, Upshur: 7, Webster: 7,
  Pendleton: 8, Pocahontas: 8, Randolph: 8, Tucker: 8,
  Fayette: 9, Greenbrier: 9, Monroe: 9, Nicholas: 9, Summers: 9,
  McDowell: 10, Mercer: 10, Raleigh: 10, Wyoming: 10
};

async function analyzeNepaProject(project) {
  var resultSlots = [];
  var screeningCases = [];
  for (var i = 0; i < NEPA_CONFIG.layers.length; i++) {
    var layer = NEPA_CONFIG.layers[i];
    if (!layer.screen) continue;
    if (layer.special === "mussels") {
      getMusselScreeningCases().forEach(function(musselCase) {
        addScreeningCase(resultSlots, screeningCases, layer, {
          where: musselCase.where,
          distanceMiles: musselCase.distance
        }, musselCase.label);
      });
    } else if (layer.sourceType === "DRIVE_GEOTIFF") {
      resultSlots.push({ result: await runGeoTiffScreeningLayer(layer, project) });
    } else if (isBatchableArcGisLayer(layer)) {
      addScreeningCase(resultSlots, screeningCases, layer, {
        distanceMiles: layer.distanceMiles || 0,
        bufferMiles: 0
      });
      if ((NEPA_CONFIG.historicLayerNames || []).indexOf(layer.name) !== -1) {
        addScreeningCase(resultSlots, screeningCases, layer, {
          distanceMiles: 1,
          bufferMiles: 0
        }, layer.name + " (1 mile buffer)");
      }
    } else {
      resultSlots.push({ result: runScreeningLayer(layer, project, {
        distanceMiles: layer.distanceMiles || 0,
        bufferMiles: 0
      }) });
      if ((NEPA_CONFIG.historicLayerNames || []).indexOf(layer.name) !== -1) {
        var bufferedResult = runScreeningLayer(layer, project, {
          distanceMiles: 1,
          bufferMiles: 0
        });
        bufferedResult.displayName = layer.name + " (1 mile buffer)";
        resultSlots.push({ result: bufferedResult });
      }
    }
  }

  var queryTasks = [];
  screeningCases.forEach(function(screeningCase) {
    try {
      screeningCase.queryTasks = arcGisProjectQueryTasks(
        screeningCase.layer,
        project,
        screeningCase.options
      );
      screeningCase.features = [];
      screeningCase.seenFeatures = {};
      screeningCase.queryTasks.forEach(function(queryTask) {
        queryTasks.push({
          layer: screeningCase.layer,
          layerSource: queryTask.layerSource,
          payload: queryTask.payload,
          screeningCase: screeningCase
        });
      });
    } catch (error) {
      screeningCase.error = error.message || String(error);
    }
  });

  var fetchedTasks = fetchArcGisQueryBatch(queryTasks);
  fetchedTasks.forEach(function(fetchedTask) {
    var screeningCase = fetchedTask.screeningCase;
    if (fetchedTask.error) {
      screeningCase.error = fetchedTask.error;
      return;
    }
    try {
      var queried = fetchArcGisFeatures(
        fetchedTask.layerSource,
        fetchedTask.payload,
        screeningCase.options.recordLimit,
        fetchedTask.response
      );
      for (var featureIndex = 0; featureIndex < queried.features.length; featureIndex++) {
        var feature = queried.features[featureIndex];
        var key = arcGisFeatureKey(feature);
        if (!screeningCase.seenFeatures[key]) {
          screeningCase.seenFeatures[key] = true;
          screeningCase.features.push(arcGisFeatureToGeoJson(feature));
        }
      }
      screeningCase.truncated = screeningCase.truncated || queried.truncated;
    } catch (error) {
      screeningCase.error = error.message || String(error);
    }
  });

  screeningCases.forEach(function(screeningCase) {
    screeningCase.result = screeningResultFromBatchCase(screeningCase);
  });
  var results = resultSlots.map(function(slot) {
    return slot.screeningCase ? slot.screeningCase.result : slot.result;
  });
  var lwcfResults = runLwcfScreening(project);
  var lastHistoricIndex = -1;
  (NEPA_CONFIG.historicLayerNames || []).forEach(function(layerName) {
    for (var historicIndex = results.length - 1; historicIndex >= 0; historicIndex--) {
      if (results[historicIndex].name === layerName) {
        lastHistoricIndex = Math.max(lastHistoricIndex, historicIndex);
        break;
      }
    }
  });
  var lwcfInsertIndex = lastHistoricIndex === -1 ? results.length : lastHistoricIndex + 1;
  results.splice.apply(results, [lwcfInsertIndex, 0].concat(lwcfResults));
  appendFederalLandChecks(results, project);
  appendFederalLandAccessResult(results);
  var metadata = summarizeProject(project, results);
  return { project: project, results: results, metadata: metadata };
}

function runLwcfScreening(project) {
  var directFeatures = [];
  var bufferedFeatures = [];
  var directSeen = {};
  var bufferedSeen = {};
  var errorMessage = "";
  try {
    if (typeof getLWCFScreeningData !== "function") {
      throw new Error("LWCF screening function is not available.");
    }
    if (!project || !Array.isArray(project.features) || !project.features.length) {
      throw new Error("The project has no geometries to screen against LWCF projects.");
    }
    project.features.forEach(function(projectFeature) {
      if (!projectFeature || !projectFeature.geometry) {
        throw new Error("A project feature is missing its geometry.");
      }
      var results = getLWCFScreeningData(projectFeature.geometry);
      appendLwcfFeatureSet(directFeatures, directSeen, results && results.lwcfi);
      appendLwcfFeatureSet(bufferedFeatures, bufferedSeen, results && results.lwcfb);
    });
  } catch (error) {
    errorMessage = error.message || String(error);
  }

  var resultDefinitions = [
    { name: "LWCF_Projects", features: directFeatures },
    { name: "buff_LWCF_Projects", features: bufferedFeatures }
  ];
  return resultDefinitions.map(function(definition) {
    var result = {
      name: definition.name,
      displayName: definition.name,
      longName: "NEPA\\screening\\Recreation\\LWCF\\" + definition.name,
      source: "https://utility.arcgis.com/usrsvcs/servers/12bd04d956514fb983b5101f2d66122b/rest/services/Map/FeatureServer/4",
      distanceMiles: definition.name === "buff_LWCF_Projects" ? 1 : 0,
      bufferMiles: 0,
      status: errorMessage ? "ERROR" : definition.features.length ? "YES" : "NO",
      features: definition.features,
      truncated: false
    };
    if (errorMessage) {
      result.error = errorMessage;
      result.expectedLocation = describeExpectedLayerLocation(result);
      Logger.log("Screening layer unavailable: " + result.name + " (expected at " +
        result.expectedLocation + "): " + errorMessage);
    }
    return result;
  });
}

function appendLwcfFeatureSet(target, seen, featureSet) {
  if (!featureSet || !Array.isArray(featureSet.features)) {
    throw new Error("LWCF screening returned an invalid FeatureSet.");
  }
  featureSet.features.forEach(function(feature) {
    var key = arcGisFeatureKey(feature);
    if (seen[key]) return;
    seen[key] = true;
    target.push(arcGisFeatureToGeoJson(feature));
  });
}

function addScreeningCase(resultSlots, screeningCases, layer, options, displayName) {
  var screeningCase = {
    layer: layer,
    options: options || {},
    displayName: displayName || "",
    features: [],
    truncated: false
  };
  screeningCases.push(screeningCase);
  resultSlots.push({ screeningCase: screeningCase });
}

function isBatchableArcGisLayer(layer) {
  return /^https?:\/\//i.test(getLayerSourceLocation(layer)) &&
    layer.sourceType !== "GOOGLE_SHEETS_BRIDGES";
}

function screeningResultFromBatchCase(screeningCase) {
  var layer = screeningCase.layer;
  var options = screeningCase.options;
  var result = {
    name: layer.name,
    longName: layer.longName,
    distanceMiles: options.distanceMiles || 0,
    bufferMiles: options.bufferMiles || 0,
    status: "NO",
    features: screeningCase.features || [],
    truncated: !!screeningCase.truncated
  };
  if (screeningCase.error) {
    result.status = "ERROR";
    result.error = screeningCase.error;
    result.source = getLayerSourceLocation(layer);
    result.expectedLocation = describeExpectedLayerLocation(layer);
    Logger.log("Screening layer unavailable: " + layer.name + " (expected at " +
      result.expectedLocation + "): " + result.error);
  } else {
    result.status = result.features.length ? "YES" : "NO";
    result.displayName = screeningCase.displayName || screeningLabel(result);
  }
  if (screeningCase.displayName) result.displayName = screeningCase.displayName;
  return result;
}

async function runGeoTiffScreeningLayer(layer, project) {
  var result = {
    name: layer.name,
    longName: layer.longName,
    distanceMiles: 0,
    bufferMiles: 0,
    status: "NO",
    features: [],
    truncated: false
  };
  try {
    var query = await queryGeoTiffAgainstProject(layer, project);
    result.features = query.features;
    result.truncated = query.truncated;
    result.status = query.features.length ? "YES" : "NO";
    result.displayName = screeningLabel(result);
  } catch (error) {
    result.status = "ERROR";
    result.error = error.message || String(error);
    result.source = getLayerSourceLocation(layer);
    result.expectedLocation = describeExpectedLayerLocation(layer);
    Logger.log("Screening layer unavailable: " + layer.name + " (expected at " +
      result.expectedLocation + "): " + result.error);
  }
  return result;
}

function runScreeningLayer(layer, project, options) {
  options = options || {};
  var result = {
    name: layer.name,
    longName: layer.longName,
    distanceMiles: options.distanceMiles || 0,
    bufferMiles: options.bufferMiles || 0,
    status: "NO",
    features: [],
    truncated: false
  };
  try {
    var query = queryLayerAgainstProject(layer, project, {
      where: options.where,
      distanceMiles: result.distanceMiles
    });
    result.features = query.features;
    result.truncated = query.truncated;
    result.status = query.features.length ? "YES" : "NO";
    result.displayName = screeningLabel(result);
  } catch (error) {
    result.status = "ERROR";
    result.error = error.message || String(error);
    result.source = getLayerSourceLocation(layer);
    result.expectedLocation = describeExpectedLayerLocation(layer);
    Logger.log("Screening layer unavailable: " + layer.name + " (expected at " +
      result.expectedLocation + "): " + result.error);
  }
  return result;
}

function appendMusselResults(results, layer, project) {
  var cases = getMusselScreeningCases();
  for (var i = 0; i < cases.length; i++) {
    var result = runScreeningLayer(layer, project, {
      where: cases[i].where,
      distanceMiles: cases[i].distance,
      label: cases[i].label
    });
    result.displayName = cases[i].label;
    results.push(result);
  }
}

function getMusselScreeningCases() {
  return [
    { label: "State mussels", where: "StreamGroup = '1' OR StreamGroup = '3'", distance: 0 },
    { label: "Endangered mussels", where: "StreamGroup <> '1' AND StreamGroup <> '3'", distance: 0 },
    { label: "Endangered mussels within 1/4 mile", where: "StreamGroup <> '1' AND StreamGroup <> '3'", distance: 0.25 },
    { label: "Endangered mussels within 1/2 mile", where: "StreamGroup <> '1' AND StreamGroup <> '3'", distance: 0.5 }
  ];
}

function appendFederalLandChecks(results, project) {
  appendOwnershipCheck(results, project, "FS Admin Limit", "FS Owned", "forestname", "Federal Forest ownership");
  appendOwnershipCheck(results, project, "NPS Admin Limit", "NPS Owned", "name", "National Park Service ownership");
}

function appendFederalLandAccessResult(results) {
  var bridgeResult = findResultByName(results, "Bridge");
  if (!bridgeResult) return;
  var result = {
    name: "Federal Land Access",
    displayName: "Federal Land Access",
    status: bridgeResult.status,
    features: [],
    truncated: !!bridgeResult.truncated
  };
  if (bridgeResult.status === "ERROR") {
    result.error = "Cannot determine Federal Land Access because Bridge screening failed: " +
      (bridgeResult.error || "unknown Bridge screening error");
  } else {
    result.features = (bridgeResult.features || []).map(function(feature) {
      var properties = feature.properties || {};
      return {
        type: "Feature",
        properties: {
          barsid: propertyValue(properties, "barsid"),
          locname: propertyValue(properties, "locname"),
          federal_land_access: propertyValue(properties, "federal_land_access")
        }
      };
    });
  }
  results.push(result);
}

function appendOwnershipCheck(results, project, adminLayerName, ownedLayerName, ownerField, label) {
  var adminResult = findResultByName(results, adminLayerName);
  if (!adminResult || adminResult.status === "ERROR") {
    results.push({
      name: ownedLayerName, displayName: label, status: "ERROR", features: [],
      error: "Cannot determine ownership because " + adminLayerName + " could not be screened."
    });
    return;
  }
  if (!adminResult.features.length) {
    results.push({ name: ownedLayerName, displayName: label, status: "NO", features: [] });
    return;
  }

  var ownedLayer = getNepaLayer(ownedLayerName);
  var ownedResult = runScreeningLayer(ownedLayer, project, {});
  ownedResult.displayName = label;
  if (ownedResult.status === "YES") {
    var ownerName = propertyValue(ownedResult.features[0].properties, ownerField);
    ownedResult.summary = ownerName ? "YES, " + ownerName : "YES";
    results.push(ownedResult);
    return;
  }
  if (ownedResult.status === "ERROR") {
    results.push(ownedResult);
    return;
  }

  var parcelResult = runScreeningLayer(getNepaLayer("WVParcels"), project, {});
  parcelResult.name = ownedLayerName + " private parcels";
  parcelResult.displayName = label + " (private parcels checked)";
  if (parcelResult.status === "YES") {
    parcelResult.summary = "NO; " + parcelResult.features.length + " intersecting parcel(s) require ownership review";
  } else if (parcelResult.status === "NO") {
    parcelResult.summary = "NO; no intersecting parcel records returned";
  }
  results.push(parcelResult);
  ownedResult.status = parcelResult.status === "ERROR" ? "ERROR" : "NO";
  ownedResult.summary = parcelResult.status === "ERROR"
    ? "CHECK MANUALLY: private parcel lookup failed."
    : "NO";
  results.push(ownedResult);
}

function summarizeProject(project, results) {
  var positions = [];
  var featureCentroids = [];
  project.features.forEach(function(feature) {
    collectGeometryPositions(feature.geometry, positions);
    featureCentroids.push(geometryCentroid(feature.geometry));
  });
  if (!positions.length) throw new Error("The project boundary contains no coordinate positions.");

  var minX = positions[0][0], maxX = positions[0][0];
  var minY = positions[0][1], maxY = positions[0][1];
  var sumX = 0, sumY = 0;
  for (var i = 0; i < positions.length; i++) {
    minX = Math.min(minX, positions[i][0]);
    maxX = Math.max(maxX, positions[i][0]);
    minY = Math.min(minY, positions[i][1]);
    maxY = Math.max(maxY, positions[i][1]);
  }
  featureCentroids.forEach(function(center) { sumX += center[0]; sumY += center[1]; });

  var counties = getResultPropertyValues(findResultByName(results, "County"), "county_name");
  var wvdohDistricts = [];
  counties.forEach(function(county) {
    var district = NEPA_DOHDISTRICTS[titleCase(county)];
    if (district && wvdohDistricts.indexOf(district) === -1) wvdohDistricts.push(district);
  });
  wvdohDistricts.sort(function(a, b) { return a - b; });

  var quadrangles = getResultPropertyValues(findResultByName(results, "Quarter Quad"), "quad_name");
  var usaceDistricts = getResultPropertyValues(
    findResultByName(results, "USACE_Districts"),
    "district"
  );
  return {
    center: [sumX / featureCentroids.length, sumY / featureCentroids.length],
    bbox: [minX, minY, maxX, maxY],
    countyNames: counties.map(titleCase),
    wvdohDistrictNames: wvdohDistricts.map(function(number) { return "District " + number; }),
    quadrangles: quadrangles,
    usaceDistrictNames: usaceDistricts,
    projectFeatureCount: project.features.length
  };
}

function geometryCentroid(geometry) {
  return geometryCentroidData(geometry).center;
}

function geometryCentroidData(geometry) {
  if (!geometry) throw new Error("Cannot find a centroid for a geometry-less feature.");
  if (geometry.type === "GeometryCollection") {
    var componentCentroids = geometry.geometries.map(geometryCentroidData);
    var highestDimension = Math.max.apply(null, componentCentroids.map(function(item) { return item.dimension; }));
    return weightedCentroid(componentCentroids.filter(function(item) { return item.dimension === highestDimension; }));
  }
  if (geometry.type === "Point") return { center: geometry.coordinates.slice(0, 2), weight: 1, dimension: 0 };
  if (geometry.type === "MultiPoint") {
    return { center: averagePositions(geometry.coordinates), weight: geometry.coordinates.length, dimension: 0 };
  }
  if (geometry.type === "LineString") return lineCentroidData(geometry.coordinates);
  if (geometry.type === "MultiLineString") {
    return weightedCentroid(geometry.coordinates.map(lineCentroidData));
  }
  if (geometry.type === "Polygon") return polygonCentroidData(geometry.coordinates);
  if (geometry.type === "MultiPolygon") {
    return weightedCentroid(geometry.coordinates.map(polygonCentroidData));
  }
  throw new Error("Cannot calculate a centroid for geometry type " + geometry.type + ".");
}

function polygonCentroidData(rings) {
  var weightedX = 0, weightedY = 0, totalArea = 0;
  for (var r = 0; r < rings.length; r++) {
    var ring = rings[r];
    var area2 = 0, centroidX6 = 0, centroidY6 = 0;
    for (var i = 0; i < ring.length; i++) {
      var current = ring[i];
      var next = ring[(i + 1) % ring.length];
      var cross = current[0] * next[1] - next[0] * current[1];
      area2 += cross;
      centroidX6 += (current[0] + next[0]) * cross;
      centroidY6 += (current[1] + next[1]) * cross;
    }
    if (Math.abs(area2) < 1e-12) continue;
    var ringArea = Math.abs(area2 / 2);
    var direction = r === 0 ? 1 : -1;
    weightedX += (centroidX6 / (3 * area2)) * ringArea * direction;
    weightedY += (centroidY6 / (3 * area2)) * ringArea * direction;
    totalArea += ringArea * direction;
  }
  if (Math.abs(totalArea) < 1e-12) {
    return { center: averagePositions(rings.reduce(function(all, ring) { return all.concat(ring); }, [])), weight: 1, dimension: 2 };
  }
  return { center: [weightedX / totalArea, weightedY / totalArea], weight: Math.abs(totalArea), dimension: 2 };
}

function lineCentroidData(coordinates) {
  var weightedX = 0, weightedY = 0, totalLength = 0;
  for (var i = 0; i < coordinates.length - 1; i++) {
    var first = coordinates[i], second = coordinates[i + 1];
    var length = Math.sqrt(Math.pow(second[0] - first[0], 2) + Math.pow(second[1] - first[1], 2));
    weightedX += ((first[0] + second[0]) / 2) * length;
    weightedY += ((first[1] + second[1]) / 2) * length;
    totalLength += length;
  }
  return {
    center: totalLength ? [weightedX / totalLength, weightedY / totalLength] : averagePositions(coordinates),
    weight: totalLength || 1,
    dimension: 1
  };
}

function weightedCentroid(centroids) {
  if (!centroids.length) throw new Error("Cannot find a centroid for an empty geometry.");
  var weightedX = 0, weightedY = 0, totalWeight = 0;
  centroids.forEach(function(item) {
    weightedX += item.center[0] * item.weight;
    weightedY += item.center[1] * item.weight;
    totalWeight += item.weight;
  });
  return {
    center: [weightedX / totalWeight, weightedY / totalWeight],
    weight: totalWeight,
    dimension: centroids[0].dimension
  };
}

function averagePositions(positions) {
  if (!positions.length) throw new Error("Cannot find a centroid for an empty geometry.");
  var x = 0, y = 0;
  positions.forEach(function(position) { x += position[0]; y += position[1]; });
  return [x / positions.length, y / positions.length];
}

function collectGeometryPositions(geometry, output) {
  if (!geometry) return;
  if (geometry.type === "GeometryCollection") {
    geometry.geometries.forEach(function(item) { collectGeometryPositions(item, output); });
    return;
  }
  collectNestedCoordinates(geometry.coordinates, output);
}

function collectNestedCoordinates(coordinates, output) {
  if (!Array.isArray(coordinates)) return;
  if (coordinates.length >= 2 && typeof coordinates[0] === "number" && typeof coordinates[1] === "number") {
    output.push([coordinates[0], coordinates[1]]);
    return;
  }
  coordinates.forEach(function(item) { collectNestedCoordinates(item, output); });
}

function findResultByName(results, name) {
  for (var i = 0; i < results.length; i++) if (results[i].name === name) return results[i];
  return null;
}

function getResultPropertyValues(result, fieldName) {
  if (!result || result.status !== "YES") return [];
  var values = [];
  result.features.forEach(function(feature) {
    var value = propertyValue(feature.properties, fieldName);
    if (value !== null && value !== undefined && String(value).trim() &&
        values.indexOf(String(value).trim()) === -1) values.push(String(value).trim());
  });
  return values;
}

function propertyValue(properties, name) {
  if (!properties) return null;
  if (Object.prototype.hasOwnProperty.call(properties, name)) return properties[name];
  var lowerName = name.toLowerCase();
  var keys = Object.keys(properties);
  for (var i = 0; i < keys.length; i++) {
    if (keys[i].toLowerCase() === lowerName) return properties[keys[i]];
  }
  return null;
}

function screeningLabel(result) {
  var label = result.name;
  if (result.distanceMiles) label += " (within " + result.distanceMiles + " miles)";
  if (result.bufferMiles) label += " (within " + result.bufferMiles + " mile buffer)";
  return label;
}

function titleCase(value) {
  return String(value || "").toLowerCase().replace(/\b([a-z])/g, function(match) { return match.toUpperCase(); });
}
