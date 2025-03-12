(function($) {
  // Create ReportingArea namespace 
  let AQDialWidget = window.AQDialWidget;
  let PubSub = window.PubSub;
  let GeoLocation = AQDialWidget.GeoLocation;
  let ReportingArea = AQDialWidget.ReportingArea = {};
  let Storage = AQDialWidget.Storage;

  const STORAGE_KEY = "ReportingArea";
  const FIELDS = ReportingArea.FIELDS = {
    "issueDate": "issueDate",
    "validDate": "validDate",
    "recordSequence": "recordSequence",
    "timezone": "timezone",
    "time": "time",
    "dataType": "dataType",
    "isPrimary": "isPrimary",
    "reportingAreaName": "reportingArea",
    "stateCode": "stateCode",
    "latitude": "latitude",
    "longitude": "longitude",
    "parameter": "parameter",
    "aqi": "aqi",
    "category": "category",
    "isActionDay": "isActionDay",
    "discussion": "discussion",
    "reportingAgency": "reportingAgency"
  };

  let loadingData = false;
  let loadingCurrentData = false;
  let loadingHistoricalData = false;
  let servicesReady = false;

  const TOPIC_BASE = AQDialWidget.APP_NAME + "." + STORAGE_KEY;
  const TOPICS = ReportingArea.TOPICS = {
    "new_data": TOPIC_BASE + ".new_data",
    "state_data": TOPIC_BASE + ".state_data",
    "state_historical_data": TOPIC_BASE + ".state_historical_data",
    "services_ready": TOPIC_BASE + ".services_ready"
  };


  let stateReportingAreaData = false;
  let historicalData = {}; // look up by date

  function getReportingArea() {
    let item = Storage.getItem(STORAGE_KEY);
    if (!item) {
      item = saveReportingArea({
        "current": [],
        "forecast": [],
      });
    }
    let locationCoord = GeoLocation.getLatLng();
    let locationStateCode = GeoLocation.getStateCode();
    if (Storage.isItemExpired(STORAGE_KEY) && locationCoord) {
      lookupLocationReportingAreaData(locationCoord.lat, locationCoord.lng, locationStateCode);
    }
    if (!locationCoord && !item.data.current.length && !item.data.forecast.length) {
      return false;
    }
    return item.data;
  }

  function saveReportingArea(reportingarea) {
    let item = Storage.storeItem(STORAGE_KEY, reportingarea);
    PubSub.publish(TOPICS.new_data, true);
    return item;
  }

  // returns all parameters for all days (sequence numbers)
  let getAllReportingAreaData = ReportingArea.getAllReportingAreaData = function() {
    let reportingarea = getReportingArea();
    if (!reportingarea) {
      return false;
    }
    return reportingarea.current.concat(reportingarea.forecast);
  };

  // returns true if any parameters found from reporting area data
  let hasReportingAreaData = ReportingArea.hasReportingAreaData = function() {
    let data = getAllReportingAreaData();
    return data.length > 0;
  };

  // returns array of all parameters for the given dayOffset (sequence number)
  let getAllCurrentReportingAreaData = ReportingArea.getAllCurrentReportingAreaData = function() {
    let reportingarea = getReportingArea();
    if (!reportingarea) {
      return false;
    }
    return reportingarea.current;
  };

  // returns primary parameter (max AQI) for the given dayOffset (sequence number)
  let getMaxCurrentReportingAreaData = ReportingArea.getMaxCurrentReportingAreaData = function() {
    let reportingarea = getReportingArea();
    if (!reportingarea) {
      return false;
    }
    let currentData = reportingarea.current;
    let current = false;
    for (let i = 0; i < currentData.length; i++) {
      let c = currentData[i];
      if (!current) {
        current = c;
      } else {
        if (c[FIELDS.aqi] > current[FIELDS.aqi]) {
          current = c;
        }
      }
    }

    return current;
  };

  // returns non-primary parameter (max AQI) for the given dayOffset (sequence number)
  let getOtherCurrentReportingAreaData = ReportingArea.getOtherCurrentReportingAreaData = function() {
    let allCurrent = getAllCurrentReportingAreaData();
    if (!allCurrent) {
      return false;
    }
    let otherCurrent = [];
    let maxAQI = -999;
    let maxIdx = -1;
    for (let i in allCurrent) {
      let c = allCurrent[i];
      otherCurrent.push(c);
      if (maxAQI < 0 || c[FIELDS.aqi] > maxAQI) {
        maxAQI = c[FIELDS.aqi];
        maxIdx = otherCurrent.length - 1;
      }
    }
    otherCurrent.splice(maxIdx, 1);
    otherCurrent.sort(function compare(a, b) {
      if (a.aqi > b.aqi)
        return -1;
      if (a.aqi < b.aqi)
        return 1;
      return 0;
    });
    return otherCurrent;
  };

  // returns array of all parameters for the given dayOffset (sequence number)
  let getAllForecastReportingAreaData = ReportingArea.getAllForecastReportingAreaData = function(dayOffset) {
    let today = moment().hours(0).minutes(0).seconds(0).milliseconds(0);
    dayOffset = dayOffset !== undefined ? dayOffset : 0;
    let reportingarea = getReportingArea();
    if (!reportingarea) {
      return false;
    }
    let forecastData = reportingarea.forecast;
    let forecasts = [];
    for (let i = 0; i < forecastData.length; i++) {
      let f = forecastData[i];
      let validDate = moment(f[FIELDS.validDate], "MM/DD/YY").hours(0).minutes(0).seconds(0).milliseconds(0);
      if (moment.duration(validDate.diff(today)).days() !== dayOffset) {
        continue;
      }
      forecasts.push(f);
    }
    return forecasts;
  };

  // returns primary parameter (max AQI) for the given dayOffset (sequence number)
  let getMaxForecastReportingAreaData = ReportingArea.getMaxForecastReportingAreaData = function(dayOffset) {
    dayOffset = dayOffset !== undefined ? dayOffset : 0;
    let reportingarea = getReportingArea();
    if (!reportingarea) {
      return false;
    }
    let forecastData = reportingarea.forecast;
    let forecast = false;
    for (let i = 0; i < forecastData.length; i++) {
      let today = moment().hours(0).minutes(0).seconds(0).milliseconds(0);
      let f = forecastData[i];
      let validDate = moment(f[FIELDS.validDate], "MM/DD/YY").hours(0).minutes(0).seconds(0).milliseconds(0);
      if (moment.duration(validDate.diff(today)).days() !== dayOffset) {
        continue;
      }
      if (!forecast) {
        forecast = f;
      } else {
        if (f[FIELDS.aqi] > forecast[FIELDS.aqi]) {
          forecast = f;
        }
      }
    }
    return forecast;
  };

  // returns non-primary parameter (max AQI) for the given dayOffset (sequence number)
  let getOtherForecastReportingAreaData = ReportingArea.getOtherForecastReportingAreaData = function(dayOffset) {
    let allForecast = getAllForecastReportingAreaData(dayOffset);
    if (!allForecast) {
      return false;
    }
    let otherForecast = [];
    let maxAQI = -999;
    let maxIdx = -1;

    for (let i in allForecast) {
      let f = allForecast[i];
      otherForecast.push(f);
      if (maxAQI < 0 || f[FIELDS.aqi] > maxAQI) {
        maxAQI = f[FIELDS.aqi];
        maxIdx = otherForecast.length - 1;
      }
    }
    otherForecast.splice(maxIdx, 1);
    otherForecast.sort(function compare(a, b) {
      if (a.aqi > b.aqi)
        return -1;
      if (a.aqi < b.aqi)
        return 1;
      return 0;
    });
    return otherForecast;
  };

  PubSub.subscribe(GeoLocation.TOPICS.new_location, function() {
    let locationCoord = GeoLocation.getLatLng();
    let locationStateCode = GeoLocation.getStateCode();
    if (locationCoord) {
      lookupLocationReportingAreaData(locationCoord.lat, locationCoord.lng, locationStateCode);
    }
  });

  let getStateCities = ReportingArea.getStateCities = function() {
    return Object.keys(stateReportingAreaData).sort();
  };

  // TBD: What should be selected when multiple parameters given for a current or forecast day but none have AQI values?
  let getStateCityData = ReportingArea.getStateCityData = function(reportingAreaName) {
    let today = moment().hours(0).minutes(0).seconds(0).milliseconds(0);
    let cityData = stateReportingAreaData[reportingAreaName];

    // Get the current observed record with the highest value pollutant
    let maxCurrentData = false;
    if(typeof cityData !== "undefined" && cityData.hasOwnProperty("current")) {
      for (let i = 0; i < cityData.current.length; i++) {
        let current = cityData.current[i];
        if (!maxCurrentData || maxCurrentData[FIELDS.aqi] < current[FIELDS.aqi]) {
          maxCurrentData = current;
        }
      }
    }

    // Get the today and tomorrow forecast record with the highest value pollutant
    let maxForecastToday = false;
    let maxForecastTomorrow = false;

    if(typeof cityData !== "undefined" && cityData.hasOwnProperty("forecast")) {
      for (let i = 0; i < cityData.forecast.length; i++) {
        let forecast = cityData.forecast[i];
        let validDate = moment(forecast[FIELDS.validDate], "MM/DD/YY").hours(0).minutes(0).seconds(0).milliseconds(0);
        if (moment.duration(validDate.diff(today)).days() === 0 && (!maxForecastToday || maxForecastToday[FIELDS.aqi] < forecast[FIELDS.aqi])) {
          maxForecastToday = forecast;
        } else if (moment.duration(validDate.diff(today)).days() === 1 && (!maxForecastTomorrow || maxForecastTomorrow[FIELDS.aqi] < forecast[FIELDS.aqi])) {
          maxForecastTomorrow = forecast;
        }
      }
    }

    return {
      current: maxCurrentData,
      forecast_today: maxForecastToday,
      forecast_tomorrow: maxForecastTomorrow
    }
  };

  let getStateHistoricalData = ReportingArea.getStateHistoricalData = function() {
      return historicalData;
  };
  
let isSessionReportingAreaExpired = ReportingArea.isSessionReportingAreaExpired = function() {
    return Storage.isItemExpired(STORAGE_KEY);
  }

  let lookupStateReportingAreaData = ReportingArea.lookupStateReportingAreaData = function(state_code) {
    if (!loadingCurrentData) {
      loadingCurrentData = true;
      $.ajax({
        type: "POST",
        url: AQDialWidget.API_URL + "reportingarea/get_state",
        data: {
          "state_code": state_code,
        },
        context: this,
        success: function (response) {
          stateReportingAreaData = {};
          let today = moment().hours(0).minutes(0).seconds(0).milliseconds(0);

          for (let i = 0; i < response.length; i++) {
            let record = response[i];
            let reportingAreaName = record[FIELDS.reportingAreaName];
            let dataType = record[FIELDS.dataType];
            let validDate = moment(record[FIELDS.validDate], "MM/DD/YY").hours(0).minutes(0).seconds(0).milliseconds(0);
            if (moment.duration(validDate.diff(today)).days() >= 0) {
              if (reportingAreaName && !stateReportingAreaData.hasOwnProperty(reportingAreaName)) {
                stateReportingAreaData[reportingAreaName] = {
                  current: [],
                  forecast: []
                }
              }

              if (record[FIELDS.dataType] === "O") {
                stateReportingAreaData[reportingAreaName].current.push(record);
              } else if (record[FIELDS.dataType] === "F") {
                stateReportingAreaData[reportingAreaName].forecast.push(record);
              }
            }
          }
          PubSub.publish(TOPICS.state_data, true);
          loadingCurrentData = false;
        },
        error: function (response) {
          // TODO: Handle errors
          console.error(response);
          loadingCurrentData = false;
        }
      });
    }
  };

  let lookupStateHistoricalData = ReportingArea.lookupStateHistoricalData = function(state_name, dateInstance) {
    if (!loadingHistoricalData) {
      let formattedDate = dateInstance.getFullYear() + "/" + (dateInstance.getMonth() + 1) + "/" + (dateInstance.getDate());

      loadingHistoricalData = true;
      // if (cachedHistoricalData.hasOwnProperty(formattedDate)) {
      //   return
      // }
      $.ajax({
        type: "GET",
        url: "https://an_gov_data.s3.amazonaws.com/States/" + state_name + "/" + formattedDate + ".json",
        context: this,
        success: function (response) {
          // resetting because it could be set from previous calls
          historicalData = {};

          let data = JSON.parse(response).reportingAreas;

          // reformatting city list so city names are keys
          for (let i = 0; i < data.length; i++) {
            let cityData = data[i];
            let cityName = Object.keys(cityData)[0];
            historicalData[cityName] = cityData[cityName];
          }

          PubSub.publish(TOPICS.state_historical_data, true);
          loadingHistoricalData = false;
        },
        error: function (response) {
          // TODO: Handle errors
          // console.error(response);
          historicalData = false;
          PubSub.publish(TOPICS.state_historical_data, false);
          loadingHistoricalData = false;
        }
      });
    }
  };

  let lookupLocationReportingAreaData = ReportingArea.lookupLocationReportingAreaData = function(latitude, longitude, stateCode) {
    if (!loadingData) {
      let apiData = {
        "latitude": latitude,
        "longitude": longitude
      };
      if (stateCode) {
        apiData["stateCode"] = stateCode;
      }
    apiData["maxDistance"] = 50; // miles

      loadingData = true;
      $.ajax({
        type: "POST",
        url: AQDialWidget.API_URL + "reportingarea/get",
        data: apiData,
        context: this,
        success: function (response) {
          let today = moment().hours(0).minutes(0).seconds(0).milliseconds(0);

          let currentData = [];
          let forecastData = [];

          let reportingareaData = response;
          if (reportingareaData.length) {
            for (let i = 0; i < reportingareaData.length; i++) {
              let record = reportingareaData[i];
              let validDate = moment(record[FIELDS.validDate], "MM/DD/YY").hours(0).minutes(0).seconds(0).milliseconds(0);
              if (moment.duration(validDate.diff(today)).days() >= 0) {
                if (record[FIELDS.dataType] === "O") {
                  currentData.push(record);
                } else if (record[FIELDS.dataType] === "F") {
                  forecastData.push(record);
                }
              }
            }
          }

          let reportingarea = {
            current: currentData,
            forecast: forecastData
          };
          saveReportingArea(reportingarea);
          loadingData = false;
        },
        error: function (response) {
          // TODO: Handle errors
          console.error(response);
        }
      });
    }
  };

  let lookupLocationByReportingAreaStateCode = ReportingArea.lookupLocationByReportingAreaStateCode = function (reportingArea, stateCode, callback, scope) {
    $.ajax({
      type: "POST",
      url: AQDialWidget.API_URL + "reportingarea/get_location",
      data: {
        "reportingArea": reportingArea,
        "stateCode": stateCode
      },
      context: this,
      success: function (response) {
        callback.call(scope, response);
      },
      error: function (response) {
        callback.call(scope, []);
      }
    });
  };
    
  PubSub.publish(TOPICS.services_ready, true);
  servicesReady = true;
  let isReady = ReportingArea.isReady = function () {
    return servicesReady;
  }
})(jQuery);
