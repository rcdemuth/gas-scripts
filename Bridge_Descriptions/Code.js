/**
 * Main function to query synced bridge data from a Google Sheet and return the formatted summary and extracted values.
 * @param {string} targetBarsNumber - The bars_number to query for.
 * @returns {Object} An object containing the formatted summary string and an array of the extracted values.
 */
function getBridgeDataFromSheet(targetBarsNumber) {
  const ssId = '1vXJVYzlnQfQPDm7jKV5z2LF9vwmKtnbrAOeGxiLVeHI';
  const ss = SpreadsheetApp.openById(ssId);
  const sheet = ss.getSheets()[0]; 
  const data = sheet.getDataRange().getValues();
  
  if (data.length < 2) return { summary: "Error: Sheet is empty.", valuesArray: [] };
  const headers = data[0];
  const barsNumberIndex = headers.indexOf('bars_number');
  if (barsNumberIndex === -1) return { summary: "Error: 'bars_number' not found.", valuesArray: [] };

  let targetRow = null;
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][barsNumberIndex]) === String(targetBarsNumber)) { targetRow = data[i]; break; }
  }
  if (!targetRow) return { summary: `Error: Bridge ${targetBarsNumber} not found.`, valuesArray: [] };

  const p = {};
  headers.forEach((header, index) => p[header] = targetRow[index]);

  // --- FETCH ABBREVIATIONS MAP BY SHEET NAME ---
  let abbrMap = [];
  const allSheets = ss.getSheets();
  for (const s of allSheets) {
    if (s.getName().toLowerCase() === 'abbreviations') {
      const sData = s.getDataRange().getValues();
      // Skip row 0 (headers), start at row 1
      for (let i = 1; i < sData.length; i++) {
        const abbr = String(sData[i][0]).trim();
        const term = String(sData[i][1]).trim();
        if (abbr && term) {
          abbrMap.push({ abbr: abbr, term: term });
        }
      }
      break; // Found the sheet, stop looking
    }
  }
  // Sort by abbreviation length (longest first) to prevent partial substring matches
  abbrMap.sort((a, b) => b.abbr.length - a.abbr.length);

  /**
   * Helper function to remove underscores and expand trailing abbreviations
   */
  function cleanAndExpand(text) {
    if (!text) return "";
    
    // 1. Remove underscores (replace with space to prevent word-crushing, then collapse double spaces)
    let cleaned = String(text).replace(/_/g, ' ').replace(/\s+/g, ' ').trim();
    
    // 2. Expand abbreviations if they occur directly at the end of the string following a space
    for (const {abbr, term} of abbrMap) {
      // Escape abbreviation to safely handle periods (e.g. "St.")
      const safeAbbr = abbr.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
      const regex = new RegExp('(\\s+)(' + safeAbbr + ')$', 'i');
      
      if (regex.test(cleaned)) {
        cleaned = cleaned.replace(regex, '$1' + term);
        break; // Stop after a successful replacement at the end of the string
      }
    }
    return cleaned;
  }

  // --- CLEAN PRIMARY TARGET FIELDS IMMEDIATELY ---
  p.location = cleanAndExpand(p.location);
  p.feature_carried = cleanAndExpand(p.feature_carried);
  p.narrative_nbi_6a_feature_intersected = cleanAndExpand(p.narrative_nbi_6a_feature_intersected);
  p.bridge_name = cleanAndExpand(p.bridge_name);


  // --- CONTINUE WITH NORMAL FORMATTING ---
  const toTitleCase = (str) => {
    if (!str) return "";
    return String(str).toLowerCase().split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
  };

  const bars_number = p.bars_number || "";
  let bridge_name = p.bridge_name.replace(/\s+br\.?$/i, ' Bridge');
  const bridge_type = p.bridge_type || "";
  const latitude = p.latitude || "", longitude = p.longitude || "", route = p.route || "", subroute = p.subroute || "", width_out_to_out = p.width_out_to_out || "";
  const total_bridge_length = p.total_bridge_length || p.total_bridge_lenghth || "", year_built = p.year_built || "", bridge_age = p.bridge_age || "";
  const span_lengths = p.span_lengths || "", bridge_condition_classification = p.bridge_condition_classification || "";
  
  // Extract ADT
  const adt = p.adt || p.average_daily_traffic || p.ADT || "";

  let location = String(p.location || "").replace(/\bMI\s+(N|S|E|W|NE|NW|SE|SW)\s+OF\b/gi, (match, dir) => {
    const directions = { 'N':'north', 'S':'south', 'E':'east', 'W':'west', 'NE':'northeast', 'NW':'northwest', 'SE':'southeast', 'SW':'southwest' };
    return `miles ${directions[dir.toUpperCase()]} of`;
  });

  const feature_intersected = toTitleCase(p.narrative_nbi_6a_feature_intersected);
  const feature_carried = toTitleCase(p.feature_carried);
  
  let county = String(p.county || "");
  if (county.includes('-')) county = county.split('-')[1].split('(')[0].trim();

  const narrative_summary = String(p.narrative_summary || "").replace(/\n/g, ' ');
  let narrative_comments = String(p.narrative_comments || "").replace(/\n/g, ' ').replace(/ENGINEER's RECOMENDATION/g, "Recomendations include");

  let direction = "";
  let rawDirection = String(p._snbi_routes_direction || "").trim();
  if (rawDirection) {
    let firstDirStr = rawDirection;
    if (rawDirection.startsWith('[') && rawDirection.endsWith(']')) {
      try { const parsedArr = JSON.parse(rawDirection); if (parsedArr && parsedArr.length > 0) firstDirStr = parsedArr[0]; } catch (e) {}
    }
    direction = firstDirStr.includes('-') ? firstDirStr.split('-')[1].trim().toLowerCase() : firstDirStr.trim().toLowerCase();
  }

  let place_name = String(p.place_name || "");
  const place_code = p.place_code || "";
  if (place_code == 0 || place_name.includes("Unincorporated / Rural")) place_name = "an unicorporated part of rural"; 
  else if (place_name) place_name = place_name.trim() + ",";

  const bridge_type_lower = String(bridge_type).toLowerCase();
  
  let summaryTemplate = `Located ${location} in ${place_name} ${county} County, ${bridge_name} crosses ${feature_intersected}. Part of ${feature_carried}, ${bridge_name} carries ${direction} traffic, and has an average daily traffic of ${adt}. Initially built in ${year_built}, the existing structure is a ${bridge_age} year old ${bridge_type_lower} with a total length of ${total_bridge_length} feet, and an out-to-out width of ${width_out_to_out} feet. ${narrative_summary}. ${narrative_comments}.`;

  // --- NEW STRING REPLACEMENTS ---
  // Replace ' MI ' with ' miles ' (case agnostic)
  summaryTemplate = summaryTemplate.replace(/ MI /gi, ' miles ');
  
  // Replace 'of CO. RT.', 'of CO RT', 'of CR', 'of C.R.' with 'of County Route' (case agnostic)
  summaryTemplate = summaryTemplate.replace(/of\s+(CO\.?\s*RT\.?|C\.?R\.?)\b/gi, 'of County Route');
  
  // Replace 'of St Rt', 'of St. Rt.', 'of S.R.', 'of SR', 'of ST RT' with 'of State Route' (case agnostic)
  summaryTemplate = summaryTemplate.replace(/of\s+(ST\.?\s*RT\.?|S\.?R\.?)\b/gi, 'of State Route');

  // Clean up any potential double spaces, extra punctuation, or double periods
  summaryTemplate = summaryTemplate.replace(/\s+/g, ' ')
                                   .replace(/\. \./g, '.')
                                   .replace(/\.{2,}/g, '.') // Removes double periods (e.g., '..')
                                   .trim();

  const extractedValues = [ bars_number, feature_intersected, bridge_name, county, bridge_type, latitude, longitude, location, route, subroute, narrative_summary, narrative_comments, width_out_to_out, total_bridge_length, year_built, bridge_age, span_lengths, bridge_condition_classification, feature_carried, direction, place_code, place_name, adt ];
  
  return { summary: summaryTemplate, valuesArray: extractedValues };
}
/**
 * Example function to test the script.
 */
function testRunBridgeSummaryFromSheet() {
  const result = getBridgeDataFromSheet("31A167");
  
  Logger.log("--- SUMMARY ---");
  Logger.log(result.summary);
  
  Logger.log("--- EXTRACTED VALUES ARRAY ---");
  Logger.log(result.valuesArray);
}