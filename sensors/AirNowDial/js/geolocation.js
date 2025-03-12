(function($) {
  // Create Storage namespace
  let PubSub = window.PubSub;
  let AQDialWidget = window.AQDialWidget;
  let Storage = AQDialWidget.Storage;
  let PageLoader = AQDialWidget.PageLoader;
  let GeoLocation = AQDialWidget.GeoLocation = {};

  const STORAGE_KEY = "Location";

  const TOPIC_BASE = AQDialWidget.APP_NAME + "." + STORAGE_KEY;
  const TOPICS = GeoLocation.TOPICS = {
    "new_location": TOPIC_BASE + ".new_location",
    "services_ready": TOPIC_BASE + ".services_ready",
  };

  const STATE_CODES = {
    'Alabama': 'AL',
    'Alaska': 'AK',
    'American Samoa': 'AS',
    'Arizona': 'AZ',
    'Arkansas': 'AR',
    'California': 'CA',
    'Colorado': 'CO',
    'Connecticut': 'CT',
    'Delaware': 'DE',
    'District of Columbia': 'DC',
    'Federated States Of Micronesia': 'FM',
    'Florida': 'FL',
    'Georgia': 'GA',
    'Guam': 'GU',
    'Hawaii': 'HI',
    'Idaho': 'ID',
    'Illinois': 'IL',
    'Indiana': 'IN',
    'Iowa': 'IA',
    'Kansas': 'KS',
    'Kentucky': 'KY',
    'Louisiana': 'LA',
    'Maine': 'ME',
    'Marshall Islands': 'MH',
    'Maryland': 'MD',
    'Massachusetts': 'MA',
    'Mexico': 'MX',
    'Michigan': 'MI',
    'Minnesota': 'MN',
    'Mississippi': 'MS',
    'Missouri': 'MO',
    'Montana': 'MT',
    'Nebraska': 'NE',
    'Nevada': 'NV',
    'New Hampshire': 'NH',
    'New Jersey': 'NJ',
    'New Mexico': 'NM',
    'New York': 'NY',
    'North Carolina': 'NC',
    'North Dakota': 'ND',
    'Northern Mariana Islands': 'MP',
    'Ohio': 'OH',
    'Oklahoma': 'OK',
    'Oregon': 'OR',
    'Palau': 'PW',
    'Pennsylvania': 'PA',
    'Puerto Rico': 'PR',
    'Rhode Island': 'RI',
    'South Carolina': 'SC',
    'South Dakota': 'SD',
    'Tennessee': 'TN',
    'Texas': 'TX',
    'Utah': 'UT',
    'Vermont': 'VT',
    'Virgin Islands': 'VI',
    'Virginia': 'VA',
    'Washington': 'WA',
    'West Virginia': 'WV',
    'Wisconsin': 'WI',
    'Wyoming': 'WY'
  };

  // True if we pull a location from the url.  If true, we won't prompt for user's GPS location
  let urlLocation = false;
  let servicesReady = false;
  let user_selected_location = false;

  function getLocation() {
    let item = Storage.getItem(STORAGE_KEY);
	  if (!item) {
      item = saveLocation({
        "latitude": null,
        "longitude": null,
        "displayName": "N/A",
        "cityName": "N/A",
        "stateName": "N/A",
        "stateCode": "N/A",
        "countryCode": "N/A",
        "isStateSearch": false,
        "geolocation": false,
        "utcOffset": false
      });
    }
    return item.data;
  }

  function saveLocation(location, silent) {
    let item = Storage.storeItem(STORAGE_KEY, location);
    if (silent !== true) {
      PubSub.publish(TOPICS.new_location, true);
    }
    return item;
  }

  let getLocationDisplayName = GeoLocation.getLocationDisplayName = function() {
    let location = getLocation();
    if (!location.latitude && !location.longitude) {
      return false;
    }
    return location.displayName;
  };

  let getLocationStateName = GeoLocation.getLocationStateName = function() {
    let location = getLocation();
    if (!location.latitude && !location.longitude) {
      return false;
    }
    return location.stateName ;
  };

  let getLatLng = GeoLocation.getLatLng = function() {
    let location = getLocation();
    if (!location.latitude && !location.longitude) {
      return false;
    }
    return {lat: location.latitude, lng: location.longitude};
  };

  let getLatLngTimezone = GeoLocation.getLatLngTimezone = function(callback) {
    let location = getLocation();
    if (!location.latitude && !location.longitude) {
      callback(false);
    }

    callback(location.utcOffset);
  };

  let getStateCode = GeoLocation.getStateCode = function() {
    let location = getLocation();
    if (!location.latitude && !location.longitude) {
      return false;
    }
    return location.stateCode;
  };

  let isStateSearch = GeoLocation.isStateSearch = function() {
    let location = getLocation();
    if (!location.latitude && !location.longitude) {
      return false;
    }
    return location.isStateSearch;
  };

  let getCityName = GeoLocation.getCityName = function() {
    let location = getLocation();
    if (!location.latitude && !location.longitude) {
      return false;
    }
    return location.cityName;
  }

  let getCountryCode = GeoLocation.getCountryCode = function() {
      let location = getLocation();
      if (!location.latitude && !location.longitude) {
        return false;
      }
      return location.countryCode;
    };

  let getUserSelectedLocation = GeoLocation.getUserSelectedLocation = function() {
    return user_selected_location;
  };

  let resetUserSelectedLocation = GeoLocation.resetUserSelectedLocation = function() {
    user_selected_location = false;
  };

  let isSessionLocationExpired = GeoLocation.isSessionLocationExpired = function() {
    return Storage.isItemExpired(STORAGE_KEY);
  }
  
  function lookupLocation(response, type, latlng) {
    // IE11 fix - ES6 introduced defaulted function parameters, but sadly ES6 is not supported in IE11.
    latlng = typeof latlng !== "undefined" ? latlng : null;
    // These four variables are the set differently depending on what type of call is made
     //<!-- latlng = null; // AirNowDrupal #107 IE fix cw 2019-03-08 // This change Reversed on 2019-04-10 -->
	user_selected_location = (type === "SearchInput" || type === "UpdateUserLocation");
    let location, city, state, countryCode;
    if (type === "CityStateCountry") {
      location = {
        lat: response.candidates[0].location.y,
        lng: response.candidates[0].location.x
      };
      let attributes = response.candidates[0].attributes;
      city = attributes.City.length ? attributes.City : attributes.Subregion;
      state = attributes.Region;
      countryCode = attributes.Country;
    } else if (type === "SearchInput") {
      location = {
        lat: response.result.feature.geometry.y,
        lng: response.result.feature.geometry.x
      };
      let attributes = response.result.feature.attributes;
      city = attributes.City.length ? attributes.City : "";
      state = attributes.Region;
      countryCode = attributes.Country;
    } else {
      location = latlng;
      let address = response.address;
      city = address.City.length ? address.City : address.Subregion;
      state = address.Region;
      countryCode = address.CountryCode;
    }

    // These are overrides for the two locations in Mexico due to differences in how ESRI provides the information
    // compared to how we want to present that information for the locations in Mexico.
    if ((state === "The Federal District" || state === "Mexico City") && countryCode === "MEX") {
      city = "Mexico City";
      state = "";
      countryCode = "MEX";
    } else if (state === "Baja California") {
      state = "";
      countryCode = "MEX";
    } else if (!state && countryCode) {
      if (countryCode !== "USA") {
        state = "";
      }
    }
    
    if (type === "LatLong" || type === "SearchInput") {
      if (!state && countryCode === "USA") {
        return;
      }
      if (!city) {
        // try an alternate value (a blank space) for city cw 2024-04-04
        city = " ";
        // return; Continue processing cw 2024-04-04
      }
    } else {
      if (!city && !state) {
        return;
      }
    }

    state = typeof STATE_CODES[state] !== "undefined" ? state.trim() : "";
    let displayName = city;
    if (state.length) {
      displayName += ", " + STATE_CODES[state];
    } else if (countryCode.length && countryCode !== "USA") {
      displayName += ", " + countryCode;
    }

    if (type === "CityStateCountry" || type === "SearchInput") {
      let sessionLocation = getLocation();
      let newSessionLocation = {
        latitude: location.lat,
        longitude: location.lng,
        displayName: displayName,
        cityName: city,
        stateName: state,
        stateCode: state.length ? STATE_CODES[state] : "",
        countryCode: countryCode,
        isStateSearch: false,
        geolocation: (type ===  "CityStateCountry" ? true : sessionLocation.geolocation)
      };
      if (type === "SearchInput" && newSessionLocation.isStateSearch) {
        window.open("/state/" + newSessionLocation.stateName.replace(/ /g, "-").toLowerCase(), "_self");
      }
      saveLocation(newSessionLocation);
    } else {
      state = typeof STATE_CODES[state] !== "undefined" ? state.trim() : "";
      let updatedSessionLocation = {
        latitude: location.lat,
        longitude: location.lng,
        displayName: displayName,
        cityName: city,
        stateName: state,
        stateCode: state.length ? STATE_CODES[state] : "",
        countryCode: countryCode,
        isStateSearch: false,
        geolocation: true
      };
      saveLocation(updatedSessionLocation);
    }
  }

  let lookupLocationByLatLng = GeoLocation.lookupLocationByLatLng = function(latlng, fromUrl) {
    urlLocation = fromUrl === true;

    $.ajax({
      type: "GET",
      url: "https://geocode.arcgis.com/arcgis/rest/services/World/GeocodeServer/reverseGeocode?f=json&langCode=EN&featureTypes=PointAddress,Locality,Postal&location=" + latlng.lng + "," + latlng.lat,
      context: this,
      success: function (response) {
        lookupLocation(response, "LatLong", latlng);
      },
      error: function (response) {
        // TODO: Handle errors
        console.error(response);
      }
    });
  };

  let lookupLocationByCityStateCountry = GeoLocation.lookupLocationByCityStateCountry = function(city, state, country, fromUrl) {
    urlLocation = fromUrl === true;

    let query = "";
    if (city && state && !country) {
      query = "city=" + city + "&region=" + state;
    } else if (city && !state && country) {
      query = "city=" + city + "&countryCode=" + country;
    } else if (city && state && country) {
      query = "city=" + city + "&region=" + state + "&countryCode=" + country;
    }

    if (query) {
      $.ajax({
        type: "GET",
        url: "https://geocode.arcgis.com/arcgis/rest/services/World/GeocodeServer/findAddressCandidates?f=json&langCode=EN&outFields=PlaceName,Type,City,Country,Addr_type,Region,SubRegion&" + query,
        context: this,
        success: function (response) {
            lookupLocation(response, "CityStateCountry");
        },
        error: function (response) {
          // TODO: Handle errors
          console.error(response);
        }
      });
    }
  };

  let isReady = GeoLocation.isReady = function() {
    return servicesReady;
  }
})(jQuery);
