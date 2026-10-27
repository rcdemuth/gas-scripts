var NEPA_GEOTIFF_IMAGE_CACHE = {};

function NepaGeoTiffTextDecoder(encoding) {
  this.encoding = String(encoding || "utf-8").toLowerCase();
  if (this.encoding !== "utf-8" && this.encoding !== "utf8" &&
      this.encoding !== "ascii" && this.encoding !== "us-ascii") {
    throw new Error("Unsupported GeoTIFF text encoding: " + this.encoding);
  }
}

NepaGeoTiffTextDecoder.prototype.decode = function(input) {
  var bytes = input instanceof ArrayBuffer
    ? new Uint8Array(input)
    : ArrayBuffer.isView(input)
      ? new Uint8Array(input.buffer, input.byteOffset, input.byteLength)
      : new Uint8Array(input || []);
  var codePoints = [];
  var index = 0;
  if (this.encoding === "ascii" || this.encoding === "us-ascii") {
    for (; index < bytes.length; index++) {
      codePoints.push(bytes[index] < 128 ? bytes[index] : 65533);
    }
    return String.fromCharCode.apply(null, codePoints);
  }

  while (index < bytes.length) {
    var firstByte = bytes[index++];
    if (firstByte < 0x80) {
      codePoints.push(firstByte);
      continue;
    }

    var continuationCount;
    var codePoint;
    var minimumCodePoint;
    if (firstByte >= 0xC2 && firstByte <= 0xDF) {
      continuationCount = 1;
      codePoint = firstByte & 0x1F;
      minimumCodePoint = 0x80;
    } else if (firstByte >= 0xE0 && firstByte <= 0xEF) {
      continuationCount = 2;
      codePoint = firstByte & 0x0F;
      minimumCodePoint = 0x800;
    } else if (firstByte >= 0xF0 && firstByte <= 0xF4) {
      continuationCount = 3;
      codePoint = firstByte & 0x07;
      minimumCodePoint = 0x10000;
    } else {
      codePoints.push(65533);
      continue;
    }

    var validSequence = index + continuationCount <= bytes.length;
    for (var continuationIndex = 0;
        validSequence && continuationIndex < continuationCount;
        continuationIndex++) {
      var continuationByte = bytes[index + continuationIndex];
      if ((continuationByte & 0xC0) !== 0x80) {
        validSequence = false;
        break;
      }
      codePoint = (codePoint << 6) | (continuationByte & 0x3F);
    }
    if (!validSequence) {
      codePoints.push(65533);
      continue;
    }
    index += continuationCount;
    if (codePoint < minimumCodePoint || codePoint > 0x10FFFF ||
        (codePoint >= 0xD800 && codePoint <= 0xDFFF)) {
      codePoints.push(65533);
    } else if (codePoint <= 0xFFFF) {
      codePoints.push(codePoint);
    } else {
      codePoint -= 0x10000;
      codePoints.push(0xD800 | (codePoint >> 10));
      codePoints.push(0xDC00 | (codePoint & 0x3FF));
    }
  }

  if (codePoints[0] === 0xFEFF) codePoints.shift();
  var chunks = [];
  for (var chunkStart = 0; chunkStart < codePoints.length; chunkStart += 8192) {
    chunks.push(String.fromCharCode.apply(null, codePoints.slice(chunkStart, chunkStart + 8192)));
  }
  return chunks.join("");
};

if (typeof TextDecoder === "undefined" ||
    !TextDecoder.prototype ||
    typeof TextDecoder.prototype.decode !== "function") {
  globalThis.TextDecoder = NepaGeoTiffTextDecoder;
}

async function loadDriveGeoTiffImage(layer) {
  var source = String(layer && layer.source || "");
  var fileId = source.replace(/^DRIVE_GEOTIFF:/, "");
  if (source.indexOf("DRIVE_GEOTIFF:") !== 0 || !fileId ||
      /^REPLACE_WITH_/.test(fileId)) {
    throw new Error("Configure the Drive GeoTIFF file ID for layer \"" +
      (layer && layer.name || "unnamed") + "\" in Main.gs.");
  }
  if (NEPA_GEOTIFF_IMAGE_CACHE[fileId]) return NEPA_GEOTIFF_IMAGE_CACHE[fileId];
  if (typeof GeoTIFF === "undefined" || !GeoTIFF.fromArrayBuffer) {
    throw new Error("The geotiff.js bundle must expose the global GeoTIFF.fromArrayBuffer API.");
  }

  var imagePromise = (async function() {
    var bytes = DriveApp.getFileById(fileId).getBlob().getBytes();
    var arrayBuffer = new Uint8Array(bytes).buffer;
    var tiff = await GeoTIFF.fromArrayBuffer(arrayBuffer);
    var image = await tiff.getImage(0);
    validateGeoTiffImage(image, layer);
    return image;
  })();
  NEPA_GEOTIFF_IMAGE_CACHE[fileId] = imagePromise;
  try {
    return await imagePromise;
  } catch (error) {
    delete NEPA_GEOTIFF_IMAGE_CACHE[fileId];
    throw error;
  }
}

function validateGeoTiffImage(image, layer) {
  var geoKeys = image.getGeoKeys ? image.getGeoKeys() || {} : {};
  var geographicEpsg = Number(geoKeys.GeographicTypeGeoKey || 0);
  var projectedEpsg = Number(geoKeys.ProjectedCSTypeGeoKey || 0);
  var epsg = projectedEpsg || geographicEpsg;
  if (!epsg) {
    throw new Error("GeoTIFF for \"" + layer.name +
      "\" must declare a supported projected or geographic EPSG code.");
  }
  var proj4Api = getNepaProj4Api();
  if (!proj4Api.defs("EPSG:" + epsg)) {
    throw new Error("Proj4js does not have a definition for the GeoTIFF CRS EPSG:" +
      epsg + " used by \"" + layer.name + "\".");
  }
  var fileDirectory = image.getFileDirectory();
  var transform = fileDirectory && fileDirectory.getValue("ModelTransformation");
  if (transform && (Math.abs(Number(transform[1]) || 0) > 1e-12 ||
      Math.abs(Number(transform[4]) || 0) > 1e-12)) {
    throw new Error("Rotated GeoTIFF grids are not supported for \"" + layer.name + "\".");
  }
  var origin = image.getOrigin();
  var resolution = image.getResolution();
  if (!origin || !resolution || !isFinite(origin[0]) || !isFinite(origin[1]) ||
      !isFinite(resolution[0]) || !isFinite(resolution[1]) ||
      resolution[0] === 0 || resolution[1] === 0) {
    throw new Error("GeoTIFF for \"" + layer.name + "\" has invalid affine georeferencing.");
  }
}

function getNepaProj4Api() {
  if (typeof proj4 !== "function" || typeof proj4.defs !== "function") {
    throw new Error("The proj4.js bundle must expose the global proj4 API.");
  }
  if (!proj4.defs("EPSG:26917")) {
    proj4.defs("EPSG:26917",
      "+proj=utm +zone=17 +ellps=GRS80 +datum=NAD83 +units=m +no_defs +type=crs");
  }
  return proj4;
}

function geoTiffRasterWindow(image, bbox) {
  var origin = image.getOrigin();
  var resolution = image.getResolution();
  var columns = [
    (bbox[0] - origin[0]) / resolution[0],
    (bbox[2] - origin[0]) / resolution[0]
  ];
  var rows = [
    (bbox[1] - origin[1]) / resolution[1],
    (bbox[3] - origin[1]) / resolution[1]
  ];
  var minimumColumn = Math.max(0, Math.floor(Math.min.apply(null, columns)));
  var maximumColumn = Math.min(image.getWidth(), Math.ceil(Math.max.apply(null, columns)));
  var minimumRow = Math.max(0, Math.floor(Math.min.apply(null, rows)));
  var maximumRow = Math.min(image.getHeight(), Math.ceil(Math.max.apply(null, rows)));
  return [minimumColumn, minimumRow, maximumColumn, maximumRow];
}

function geoTiffWindowBounds(image, window) {
  var origin = image.getOrigin();
  var resolution = image.getResolution();
  var firstX = origin[0] + window[0] * resolution[0];
  var lastX = origin[0] + window[2] * resolution[0];
  var firstY = origin[1] + window[1] * resolution[1];
  var lastY = origin[1] + window[3] * resolution[1];
  return [
    Math.min(firstX, lastX),
    Math.min(firstY, lastY),
    Math.max(firstX, lastX),
    Math.max(firstY, lastY)
  ];
}

function geoTiffRasterValueStyle(layer) {
  var style = layer && layer.rasterStyle || {};
  var value = Number(style.value);
  var color = String(style.color || "");
  var opacity = Number(style.opacity);
  if (!isFinite(value)) throw new Error("The GeoTIFF target pixel value is not configured.");
  if (!/^#[0-9A-F]{6}$/i.test(color)) {
    throw new Error("The GeoTIFF fill color must be a six-digit hexadecimal RGB value.");
  }
  if (!isFinite(opacity) || opacity < 0 || opacity > 1) {
    throw new Error("The GeoTIFF fill opacity must be a number from 0 to 1.");
  }
  var noDataValue = Number(style.noDataValue);
  if (!isFinite(noDataValue)) {
    throw new Error("The GeoTIFF no-data pixel value is not configured.");
  }
  if (value === noDataValue) {
    throw new Error("The GeoTIFF target pixel value cannot equal its no-data value.");
  }
  return {
    value: value,
    noDataValue: noDataValue,
    color: color,
    opacity: opacity,
    sample: Math.max(0, Number(layer.rasterSample) || 0)
  };
}

async function queryGeoTiffAgainstProject(layer, project) {
  var style = geoTiffRasterValueStyle(layer);
  var image = await loadDriveGeoTiffImage(layer);
  var targetEpsg = geoTiffEpsgCode(image, layer);
  var rasterProjectFeatures = targetEpsg === 4326
    ? project.features
    : reprojectGeoJsonFeatures(project.features, targetEpsg);
  var projectBbox = geoJsonFeaturesBbox(rasterProjectFeatures);
  var rasterBbox = image.getBoundingBox();
  var overlap = [
    Math.max(projectBbox[0], rasterBbox[0]),
    Math.max(projectBbox[1], rasterBbox[1]),
    Math.min(projectBbox[2], rasterBbox[2]),
    Math.min(projectBbox[3], rasterBbox[3])
  ];
  if (overlap[0] >= overlap[2] || overlap[1] >= overlap[3]) {
    return { features: [], truncated: false };
  }
  var window = geoTiffRasterWindow(image, overlap);
  if (window[0] >= window[2] || window[1] >= window[3]) {
    return { features: [], truncated: false };
  }

  var turfApi = getTurfApi();
  var origin = image.getOrigin();
  var resolution = image.getResolution();
  var chunkRows = 128;
  for (var rowStart = window[1]; rowStart < window[3]; rowStart += chunkRows) {
    var rowEnd = Math.min(window[3], rowStart + chunkRows);
    var pixels = await image.readRasters({
      window: [window[0], rowStart, window[2], rowEnd],
      samples: [style.sample],
      interleave: true
    });
    for (var pixelIndex = 0; pixelIndex < pixels.length; pixelIndex++) {
      if (Number(pixels[pixelIndex]) !== style.value ||
          Number(pixels[pixelIndex]) === style.noDataValue) continue;
      var localColumn = pixelIndex % (window[2] - window[0]);
      var localRow = Math.floor(pixelIndex / (window[2] - window[0]));
      var column = window[0] + localColumn;
      var row = rowStart + localRow;
      var x1 = origin[0] + column * resolution[0];
      var x2 = origin[0] + (column + 1) * resolution[0];
      var y1 = origin[1] + row * resolution[1];
      var y2 = origin[1] + (row + 1) * resolution[1];
      var cell = {
        type: "Feature",
        properties: {},
        geometry: {
          type: "Polygon",
          coordinates: [[
            [Math.min(x1, x2), Math.min(y1, y2)],
            [Math.max(x1, x2), Math.min(y1, y2)],
            [Math.max(x1, x2), Math.max(y1, y2)],
            [Math.min(x1, x2), Math.max(y1, y2)],
            [Math.min(x1, x2), Math.min(y1, y2)]
          ]]
        }
      };
      for (var featureIndex = 0; featureIndex < rasterProjectFeatures.length; featureIndex++) {
        if (turfApi.booleanIntersects(rasterProjectFeatures[featureIndex], cell)) {
          return {
            features: [{
              type: "Feature",
              properties: { pixelValue: style.value },
              geometry: null
            }],
            truncated: false
          };
        }
      }
    }
  }
  return { features: [], truncated: false };
}

function geoTiffEpsgCode(image, layer) {
  var geoKeys = image.getGeoKeys ? image.getGeoKeys() || {} : {};
  var epsg = Number(geoKeys.ProjectedCSTypeGeoKey || geoKeys.GeographicTypeGeoKey || 0);
  if (!epsg || !getNepaProj4Api().defs("EPSG:" + epsg)) {
    throw new Error("Proj4js cannot resolve the GeoTIFF CRS for \"" +
      (layer && layer.name || "unnamed layer") + "\".");
  }
  return epsg;
}

function reprojectGeoJsonFeatures(features, targetEpsg) {
  var sourceCrs = "EPSG:4326";
  var targetCrs = "EPSG:" + targetEpsg;
  var proj4Api = getNepaProj4Api();
  if (!proj4Api.defs(sourceCrs) || !proj4Api.defs(targetCrs)) {
    throw new Error("Proj4js definitions are required to transform project geometry from " +
      sourceCrs + " to " + targetCrs + ".");
  }
  return features.map(function(feature) {
    if (!feature || !feature.geometry) return feature;
    return {
      type: feature.type,
      properties: feature.properties,
      geometry: reprojectGeoJsonGeometry(feature.geometry, sourceCrs, targetCrs)
    };
  });
}

function reprojectGeoJsonGeometry(geometry, sourceCrs, targetCrs) {
  if (geometry.type === "GeometryCollection") {
    return {
      type: geometry.type,
      geometries: geometry.geometries.map(function(child) {
        return reprojectGeoJsonGeometry(child, sourceCrs, targetCrs);
      })
    };
  }
  if (!Array.isArray(geometry.coordinates)) {
    throw new Error("Cannot reproject GeoJSON geometry type \"" + geometry.type + "\".");
  }
  return {
    type: geometry.type,
    coordinates: reprojectGeoJsonCoordinates(geometry.coordinates, sourceCrs, targetCrs)
  };
}

function reprojectGeoJsonCoordinates(coordinates, sourceCrs, targetCrs) {
  if (!Array.isArray(coordinates)) {
    throw new Error("Cannot reproject malformed GeoJSON coordinates.");
  }
  if (coordinates.length && typeof coordinates[0] === "number") {
    if (coordinates.length < 2 || !isFinite(coordinates[0]) || !isFinite(coordinates[1])) {
      throw new Error("Cannot reproject a GeoJSON coordinate with invalid longitude or latitude.");
    }
    var transformed = proj4(sourceCrs, targetCrs, [
      Number(coordinates[0]),
      Number(coordinates[1])
    ]);
    if (!transformed || !isFinite(transformed[0]) || !isFinite(transformed[1])) {
      throw new Error("Proj4js returned an invalid coordinate transforming to " + targetCrs + ".");
    }
    return [transformed[0], transformed[1]].concat(coordinates.slice(2));
  }
  return coordinates.map(function(child) {
    return reprojectGeoJsonCoordinates(child, sourceCrs, targetCrs);
  });
}

async function createGeoTiffMapOverlay(layer, mapBbox, mapWidth, mapHeight, markerFill, outlineStyle) {
  var style = geoTiffRasterValueStyle(layer);
  var image = await loadDriveGeoTiffImage(layer);
  var epsg = geoTiffEpsgCode(image, layer);
  var rasterCrs = "EPSG:" + epsg;
  var proj4Api = getNepaProj4Api();
  var rasterBbox = image.getBoundingBox();
  var projectedMapBounds = [Infinity, Infinity, -Infinity, -Infinity];
  var edgeSteps = 32;
  for (var edgeIndex = 0; edgeIndex <= edgeSteps; edgeIndex++) {
    var fraction = edgeIndex / edgeSteps;
    var edgeCoordinates = [
      [mapBbox[0] + (mapBbox[2] - mapBbox[0]) * fraction, mapBbox[1]],
      [mapBbox[0] + (mapBbox[2] - mapBbox[0]) * fraction, mapBbox[3]],
      [mapBbox[0], mapBbox[1] + (mapBbox[3] - mapBbox[1]) * fraction],
      [mapBbox[2], mapBbox[1] + (mapBbox[3] - mapBbox[1]) * fraction]
    ];
    edgeCoordinates.forEach(function(coordinate) {
      var projected = proj4Api("EPSG:4326", rasterCrs, coordinate);
      if (!projected || !isFinite(projected[0]) || !isFinite(projected[1])) {
        throw new Error("Proj4js returned an invalid map coordinate transforming to " +
          rasterCrs + " for \"" + layer.name + "\".");
      }
      projectedMapBounds[0] = Math.min(projectedMapBounds[0], projected[0]);
      projectedMapBounds[1] = Math.min(projectedMapBounds[1], projected[1]);
      projectedMapBounds[2] = Math.max(projectedMapBounds[2], projected[0]);
      projectedMapBounds[3] = Math.max(projectedMapBounds[3], projected[1]);
    });
  }
  var overlap = [
    Math.max(projectedMapBounds[0], rasterBbox[0]),
    Math.max(projectedMapBounds[1], rasterBbox[1]),
    Math.min(projectedMapBounds[2], rasterBbox[2]),
    Math.min(projectedMapBounds[3], rasterBbox[3])
  ];
  if (overlap[0] >= overlap[2] || overlap[1] >= overlap[3]) return null;

  var window = geoTiffRasterWindow(image, overlap);
  if (window[0] >= window[2] || window[1] >= window[3]) return null;
  var pixelScale = 2;
  var pixelWidth = Math.max(1, Math.round(mapWidth * pixelScale));
  var pixelHeight = Math.max(1, Math.round(mapHeight * pixelScale));
  var raster = await image.readRasters({
    window: window,
    samples: [style.sample],
    interleave: true
  });
  var origin = image.getOrigin();
  var resolution = image.getResolution();
  var rasterWidth = window[2] - window[0];
  var rasterHeight = window[3] - window[1];
  if (markerFill) {
    var spacingX = Number(markerFill.spacingX || 60);
    var spacingY = Number(markerFill.spacingY || 60);
    if (!isFinite(spacingX) || spacingX <= 0 ||
        !isFinite(spacingY) || spacingY <= 0) {
      throw new Error("Raster marker-fill spacing must be positive for \"" +
        layer.name + "\".");
    }
    var markers = [];
    for (var markerY = 0; markerY <= mapHeight; markerY += spacingY) {
      var markerLatitude = mapBbox[3] -
        (markerY / mapHeight) * (mapBbox[3] - mapBbox[1]);
      for (var markerX = 0; markerX <= mapWidth; markerX += spacingX) {
        var markerLongitude = mapBbox[0] +
          (markerX / mapWidth) * (mapBbox[2] - mapBbox[0]);
        var projectedMarker = proj4Api("EPSG:4326", rasterCrs,
          [markerLongitude, markerLatitude]);
        if (!projectedMarker || !isFinite(projectedMarker[0]) ||
            !isFinite(projectedMarker[1])) {
          throw new Error("Proj4js returned an invalid marker coordinate transforming to " +
            rasterCrs + " for \"" + layer.name + "\".");
        }
        var markerColumn = Math.floor((projectedMarker[0] - origin[0]) / resolution[0]);
        var markerRow = Math.floor((projectedMarker[1] - origin[1]) / resolution[1]);
        if (markerColumn < window[0] || markerColumn >= window[2] ||
            markerRow < window[1] || markerRow >= window[3] ||
            markerColumn < 0 || markerColumn >= image.getWidth() ||
            markerRow < 0 || markerRow >= image.getHeight()) continue;
        var markerValue = Number(raster[(markerRow - window[1]) * rasterWidth +
          markerColumn - window[0]]);
        if (markerValue === style.value && markerValue !== style.noDataValue) {
          markers.push({ x: markerX, y: markerY });
        }
      }
    }
    return {
      blob: null,
      markers: markers,
      outlineSegments: outlineStyle && outlineStyle.drawOutline !== false
        ? geoTiffTargetRasterOutlineSegments(
          raster, rasterWidth, rasterHeight, window, origin, resolution,
          style, rasterCrs, proj4Api
        )
        : []
    };
  }

  var rgb = hexColorToRgb(style.color);
  var alpha = Math.round(style.opacity * 255);
  var rgba = new Uint8Array(pixelWidth * pixelHeight * 4);
  for (var pixelY = 0; pixelY < pixelHeight; pixelY++) {
    var latitude = mapBbox[3] -
      ((pixelY + 0.5) / pixelHeight) * (mapBbox[3] - mapBbox[1]);
    for (var pixelX = 0; pixelX < pixelWidth; pixelX++) {
      var longitude = mapBbox[0] +
        ((pixelX + 0.5) / pixelWidth) * (mapBbox[2] - mapBbox[0]);
      var projectedPixel = proj4Api("EPSG:4326", rasterCrs, [longitude, latitude]);
      if (!projectedPixel || !isFinite(projectedPixel[0]) ||
          !isFinite(projectedPixel[1])) {
        throw new Error("Proj4js returned an invalid map pixel transforming to " +
          rasterCrs + " for \"" + layer.name + "\".");
      }
      var column = Math.floor((projectedPixel[0] - origin[0]) / resolution[0]);
      var row = Math.floor((projectedPixel[1] - origin[1]) / resolution[1]);
      if (column < window[0] || column >= window[2] ||
          row < window[1] || row >= window[3] ||
          column < 0 || column >= image.getWidth() ||
          row < 0 || row >= image.getHeight()) continue;
      var rasterValue = Number(raster[(row - window[1]) * rasterWidth +
        column - window[0]]);
      if (rasterValue !== style.value || rasterValue === style.noDataValue) continue;
      var offset = (pixelY * pixelWidth + pixelX) * 4;
      rgba[offset] = rgb[0];
      rgba[offset + 1] = rgb[1];
      rgba[offset + 2] = rgb[2];
      rgba[offset + 3] = alpha;
    }
  }
  var pngBytes = encodeRgbaPng(pixelWidth, pixelHeight, rgba);
  var blob = Utilities.newBlob(
    pngBytes.map(function(value) { return value > 127 ? value - 256 : value; }),
    "image/png",
    "nepa-box-turtle-habitat.png"
  );
  return {
    blob: blob,
    left: 0,
    top: 0,
    width: mapWidth,
    height: mapHeight
  };
}

function geoTiffTargetRasterOutlineSegments(
  raster, rasterWidth, rasterHeight, window, origin, resolution,
  style, rasterCrs, proj4Api
) {
  var maxSegments = typeof NEPA_MAP_MAX_DRAWN_SEGMENTS === "number"
    ? NEPA_MAP_MAX_DRAWN_SEGMENTS
    : 5000;
  var segments = [];
  function isTarget(row, column) {
    if (row < 0 || row >= rasterHeight || column < 0 || column >= rasterWidth) {
      return false;
    }
    var value = Number(raster[row * rasterWidth + column]);
    return value === style.value && value !== style.noDataValue;
  }
  function addSegment(startX, startY, endX, endY) {
    if (segments.length >= maxSegments) return;
    var start = proj4Api(rasterCrs, "EPSG:4326", [startX, startY]);
    var end = proj4Api(rasterCrs, "EPSG:4326", [endX, endY]);
    if (!start || !end || !isFinite(start[0]) || !isFinite(start[1]) ||
        !isFinite(end[0]) || !isFinite(end[1])) {
      throw new Error("Proj4js returned an invalid habitat outline coordinate transforming from " +
        rasterCrs + ".");
    }
    segments.push([[start[0], start[1]], [end[0], end[1]]]);
  }
  function appendHorizontalBoundary(boundaryRow) {
    var runStart = -1;
    for (var column = 0; column <= rasterWidth; column++) {
      var exposed = column < rasterWidth &&
        isTarget(boundaryRow - 1, column) !== isTarget(boundaryRow, column);
      if (exposed && runStart === -1) runStart = column;
      if (!exposed && runStart !== -1) {
        var y = origin[1] + (window[1] + boundaryRow) * resolution[1];
        addSegment(
          origin[0] + (window[0] + runStart) * resolution[0],
          y,
          origin[0] + (window[0] + column) * resolution[0],
          y
        );
        runStart = -1;
        if (segments.length >= maxSegments) return;
      }
    }
  }
  function appendVerticalBoundary(boundaryColumn) {
    var runStart = -1;
    for (var row = 0; row <= rasterHeight; row++) {
      var exposed = row < rasterHeight &&
        isTarget(row, boundaryColumn - 1) !== isTarget(row, boundaryColumn);
      if (exposed && runStart === -1) runStart = row;
      if (!exposed && runStart !== -1) {
        var x = origin[0] + (window[0] + boundaryColumn) * resolution[0];
        addSegment(
          x,
          origin[1] + (window[1] + runStart) * resolution[1],
          x,
          origin[1] + (window[1] + row) * resolution[1]
        );
        runStart = -1;
        if (segments.length >= maxSegments) return;
      }
    }
  }

  for (var boundaryRow = 0; boundaryRow <= rasterHeight; boundaryRow++) {
    appendHorizontalBoundary(boundaryRow);
    if (segments.length >= maxSegments) return segments;
  }
  for (var boundaryColumn = 0; boundaryColumn <= rasterWidth; boundaryColumn++) {
    appendVerticalBoundary(boundaryColumn);
    if (segments.length >= maxSegments) return segments;
  }
  return segments;
}

function hexColorToRgb(color) {
  return [
    parseInt(color.slice(1, 3), 16),
    parseInt(color.slice(3, 5), 16),
    parseInt(color.slice(5, 7), 16)
  ];
}

function encodeRgbaPng(width, height, rgba) {
  var scanlineLength = width * 4 + 1;
  var raw = new Uint8Array(scanlineLength * height);
  for (var row = 0; row < height; row++) {
    var targetOffset = row * scanlineLength;
    raw[targetOffset] = 0;
    raw.set(rgba.subarray(row * width * 4, (row + 1) * width * 4), targetOffset + 1);
  }
  var compressed = zlibStore(raw);
  var output = [137, 80, 78, 71, 13, 10, 26, 10];
  var ihdr = new Uint8Array(13);
  writeUint32BigEndian(ihdr, 0, width);
  writeUint32BigEndian(ihdr, 4, height);
  ihdr[8] = 8;
  ihdr[9] = 6;
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;
  appendPngChunk(output, "IHDR", ihdr);
  appendPngChunk(output, "IDAT", compressed);
  appendPngChunk(output, "IEND", new Uint8Array(0));
  return output;
}

function zlibStore(data) {
  var output = [120, 1];
  for (var offset = 0; offset < data.length;) {
    var length = Math.min(65535, data.length - offset);
    var finalBlock = offset + length >= data.length;
    output.push(finalBlock ? 1 : 0);
    output.push(length & 255, (length >>> 8) & 255);
    var complement = 65535 - length;
    output.push(complement & 255, (complement >>> 8) & 255);
    for (var i = offset; i < offset + length; i++) output.push(data[i]);
    offset += length;
  }
  var a = 1;
  var b = 0;
  for (var index = 0; index < data.length; index++) {
    a = (a + data[index]) % 65521;
    b = (b + a) % 65521;
  }
  var adler = new Uint8Array(4);
  writeUint32BigEndian(adler, 0, ((b << 16) | a) >>> 0);
  for (var checksumIndex = 0; checksumIndex < adler.length; checksumIndex++) {
    output.push(adler[checksumIndex]);
  }
  return new Uint8Array(output);
}

function appendPngChunk(output, type, data) {
  var typeBytes = new Uint8Array(type.length);
  for (var i = 0; i < type.length; i++) typeBytes[i] = type.charCodeAt(i);
  var length = new Uint8Array(4);
  writeUint32BigEndian(length, 0, data.length);
  var checksumInput = new Uint8Array(typeBytes.length + data.length);
  checksumInput.set(typeBytes);
  checksumInput.set(data, typeBytes.length);
  var crc = pngCrc32(checksumInput);
  output.push(length[0], length[1], length[2], length[3]);
  for (var typeIndex = 0; typeIndex < typeBytes.length; typeIndex++) {
    output.push(typeBytes[typeIndex]);
  }
  for (var dataIndex = 0; dataIndex < data.length; dataIndex++) output.push(data[dataIndex]);
  output.push((crc >>> 24) & 255, (crc >>> 16) & 255, (crc >>> 8) & 255, crc & 255);
}

function writeUint32BigEndian(bytes, offset, value) {
  bytes[offset] = (value >>> 24) & 255;
  bytes[offset + 1] = (value >>> 16) & 255;
  bytes[offset + 2] = (value >>> 8) & 255;
  bytes[offset + 3] = value & 255;
}

function pngCrc32(bytes) {
  var crc = 0xFFFFFFFF;
  for (var i = 0; i < bytes.length; i++) {
    crc ^= bytes[i];
    for (var bit = 0; bit < 8; bit++) {
      crc = (crc >>> 1) ^ (crc & 1 ? 0xEDB88320 : 0);
    }
  }
  return (crc ^ 0xFFFFFFFF) >>> 0;
}
