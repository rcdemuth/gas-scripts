
//unused functions that might need to be brought back for other scripts or if the permenant token stops working
function getSpanbaseToken() {
  const scriptProperties = PropertiesService.getScriptProperties();
  let token = scriptProperties.getProperty('SPANBASE_TOKEN');
  
  if (token) return token;
  
  const loginUrl = 'https://www.spanbasewv.com/api/auth/login'; 
  const payload = {username: "robert.c.demuth@wv.gov", password: "Lola1010"}
  
  const options = {
    'method': 'post',
    'contentType': 'application/json',
    'payload': JSON.stringify(payload),
    'muteHttpExceptions': true
  };
  
  const response = UrlFetchApp.fetch(loginUrl, options);
  
  if (response.getResponseCode() === 200) {
    const data = JSON.parse(response.getContentText());
    token = data.token; 
    
    scriptProperties.setProperty('SPANBASE_TOKEN', token);
    Logger.log('Successfully logged in. New token stored.');
    return token;
  } else {
    Logger.log('Login failed: ' + response.getContentText());
    return null;
  }
}

function fetchSpanbaseData() {
  const token = getSpanbaseToken();
  if (!token) return;
  
  // Replace this with the URL of the data you want to retrieve
  const targetUrl = 'https://www.spanbasewv.com/layers/bridge_overlays.geojson'; 
  
  const options = {
    'method': 'get',
    'headers': {
      'Authorization': 'Bearer ' + token // Try this first. If it fails, check the headers in your Network tab.
    },
    'muteHttpExceptions': true
  };
  
  const response = UrlFetchApp.fetch(targetUrl, options);
  
  // If the token expired, clear it so the next run generates a new one
  if (response.getResponseCode() === 401 || response.getResponseCode() === 403) {
    Logger.log('Token expired or invalid. Clearing saved token.');
    PropertiesService.getScriptProperties().deleteProperty('SPANBASE_TOKEN');
    return;
  }
  
  //Logger.log(response.getContentText());
  console.log("loaded_data")

}

/**
 * Recursively flattens nested JSON objects and arrays into a single-level object.
 * e.g., { _snbi: [ { direction: "N" } ] } becomes { "_snbi_0_direction": "N" }
 */
function flattenObject(obj, prefix = '') {
  let flattened = {};
  for (let key in obj) {
    if (obj.hasOwnProperty(key)) {
      // Create the new column header name
      let propName = prefix ? prefix + '_' + key : key;
      let val = obj[key];
      
      if (val !== null && typeof val === 'object' && Object.keys(val).length > 0) {
        // If it's a nested object/array, recurse deeper!
        Object.assign(flattened, flattenObject(val, propName));
      } else {
        // If it's a flat value, add it to our object
        flattened[propName] = val === null || val === undefined ? "" : val;
      }
    }
  }
  return flattened;
}

