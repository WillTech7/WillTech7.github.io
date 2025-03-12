(function($) {
  // Create AirQuality Dial Widget namespace
  let AQDialWidget = window.AQDialWidget = {};

  AQDialWidget.APP_NAME = "AQDialWidget";
  AQDialWidget.API_URL = "https://airnowgovapi.com/";
  
  AQDialWidget.appendAppSubName = function(subName) {
      AQDialWidget.APP_NAME += "." + subName;
  }
  
  let GLOBALS = AQDialWidget.GLOBALS = {};
  GLOBALS.getUrlVar = function (key) {
    if (GLOBALS.urlVars.hasOwnProperty(key)) {
      return decodeURIComponent(GLOBALS.urlVars[key]);
    }
    return false;
  };
  GLOBALS.urlVars = {};
  let urlVarsPairsStr = window.location.search.slice(1).split("&");
  for (let idx in urlVarsPairsStr) {
    if (urlVarsPairsStr.hasOwnProperty(idx)) {
      let urlVarPairStr = urlVarsPairsStr[idx];
      let urlVarPair = urlVarPairStr.split("=");
      GLOBALS.urlVars[urlVarPair[0]] = urlVarPair[1];
    }
  }
  
  // Add a subname to APP_NAME to help create unique sessionStorage keys later.
  let city = GLOBALS.getUrlVar("city");
  let state = GLOBALS.getUrlVar("state");
  let country = GLOBALS.getUrlVar("country");
  let latitude = GLOBALS.getUrlVar("latitude");
  let longitude = GLOBALS.getUrlVar("longitude");
  
  if (city && state && country) {
    AQDialWidget.APP_NAME += "." + city + "." + state + "." + country;
  } else if (latitude && longitude) {
    AQDialWidget.APP_NAME += "." + latitude + "." + longitude;
  }

})(jQuery);
