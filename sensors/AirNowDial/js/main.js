(function($) {
    const MAX_ROTATION_DEGREES = 180;
    const MIN_ROTATION_DEGREES = 0;
    let AQDialWidget = window.AQDialWidget;
    let ReportingArea = AQDialWidget.ReportingArea;
    let GeoLocation = AQDialWidget.GeoLocation;

    $(document).ready(function() {
        loadData();
    });

    function loadData() {
        AQDialWidget = window.AQDialWidget;
        ReportingArea = AQDialWidget.ReportingArea;
        GeoLocation = AQDialWidget.GeoLocation;

        PubSub.subscribe(ReportingArea.TOPICS.new_data, function() {
            populateData();
        });

        let transparent = AQDialWidget.GLOBALS.getUrlVar("transparent");
        $("body").toggleClass("transparent", transparent === "true" || transparent === 1);

        // Primary URL Parameters
        let city = AQDialWidget.GLOBALS.getUrlVar("city");
        let state = AQDialWidget.GLOBALS.getUrlVar("state");
        let country = AQDialWidget.GLOBALS.getUrlVar("country");

        // Secondary URL Parameters
        let latitude = AQDialWidget.GLOBALS.getUrlVar("latitude");
        let longitude = AQDialWidget.GLOBALS.getUrlVar("longitude");

        if (city && state && country) {
            if (GeoLocation.isSessionLocationExpired() || ReportingArea.isSessionReportingAreaExpired()) {
                GeoLocation.lookupLocationByCityStateCountry(city, state, country, false);
            } else {
                populateData();
            }
        } else if (latitude && longitude) {
            if (GeoLocation.isSessionLocationExpired() || ReportingArea.isSessionReportingAreaExpired()) {
                GeoLocation.lookupLocationByLatLng({lat: latitude, lng: longitude}, false);
            } else {
                populateData();
            }
        } else {
            console.error("URL improperly formatted: city, state, and country parameters, or latitude and longitude parameters, must be set.");
            setErrorDisplay();
        }
    }

    function populateData() {
        let locationDisplayName = GeoLocation.getCityName();

        let aqData = ReportingArea.getMaxCurrentReportingAreaData();
        let fcstTodayData = ReportingArea.getMaxForecastReportingAreaData(0);
        let fcstTomorrowData = ReportingArea.getMaxForecastReportingAreaData(1);

        let hasData = aqData;

        if (hasData) {
            if (aqData) {
                let categoryImageType = "not_available";
                let aqi = aqData[ReportingArea.FIELDS.aqi];
                let category = aqData[ReportingArea.FIELDS.category];

                if (category === "Good") {
                    categoryImageType = "good"; // good
                } else if (category === "Moderate") {
                    categoryImageType = "moderate"; // moderate
                } else if (category === "Unhealthy for Sensitive Groups") {
                    categoryImageType = "usg"; // semi unhealthy
                } else if (category === "Unhealthy") {
                    categoryImageType = "unhealthy"; // unhealthy
                } else if (category === "Very Unhealthy") {
                    categoryImageType = "very_unhealthy"; // very unhealthy
                } else if (category === "Hazardous") {
                    if (aqi <= 500) {
                        categoryImageType = "hazardous"; // hazardous
                    } else {
                        categoryImageType = "beyond_index"; // beyond index
                        category = "Beyond the AQI"; // AIR-446 Standard is "Beyond the AQI" cw 2016-06-28
                    }
                } else {
                    category = "Not Available";
                }

                $(".aq-title").text(category);
                $(".aq-dial-widget").toggleClass(categoryImageType, true);
                //$(".aq-aqi-container").toggleClass(categoryImageType, true);

                // Note that setTimeout needed to allow initial animation to play
                if (typeof aqi !== "undefined" && aqi >= 0) {
                    $(".aq-dial-arrow").show();
                    $(".aq-dial-container").one('webkitTransitionEnd otransitionend oTransitionEnd msTransitionEnd transitionend', function() {
                        let deg = getDegree(aqi);
                        rotateArrow(deg);
                        setCity();
                    });
                } else {
                    $(".aq-dial-arrow").hide();
                    aqi = "- -";
                }

                // Convert reporting area's 24-hour update time to 12-hour
                let time;
                let rawTime = aqData[ReportingArea.FIELDS.time];
                let hour = rawTime.split(":")[0];
                let minute = rawTime.split(":")[1];
                if (Number(hour) < 12) { // 12 AM - 11 AM
                    if (Number(hour) === 0) {
                        time = "12 AM";
                    } else {
                        time = "" + Number(hour) + " AM";
                    }
                } else { // 12 PM - 11 PM
                    if (Number(hour) === 12) {
                        time = "12 PM";
                    } else {
                        time = "" + Number(hour - 12) + " PM";
                    }
                }
                let tz = aqData[ReportingArea.FIELDS.timezone];
                let validDate = moment(aqData[ReportingArea.FIELDS.validDate], "MM/DD/YY");
                // $(".aq-updated-time").html("<b>" + time + "</b> " + tz);
                $(".aq-updated-time").html("<b>" + time + "</b> " + tz + " " + validDate.format("MMM D")); // AIR-588 Dispaly date on Widget cw 2023-01-03
                $(".aq-aqi-value").text(aqi);
                $(".aq-pollutant-label").text(aqData[ReportingArea.FIELDS.parameter]);
            } else {
                setNoDataDisplay();
            }
        } else {
            setNoDataDisplay();
        }
        $(".aq-dial-container, .city").toggleClass("hidden", false);
        updateAirNowLink();
    }

    function setNoDataDisplay() {
        $(".aq-updated-time").text("").hide();
        $(".aq-data-row").hide();
        $(".aq-dial-arrow").hide();
        $(".aq-aqi-value").text("N/A");
        $(".aq-pollutant-label").text("N/A");
        $(".aq-dial-status").toggleClass("not_available", true);
        $(".aq-title").html("<p>Not Available</p>"); // AIR-430 Widget Cleanly Displays No Data cw 2021-06-28
        setCity();
    }

    function setErrorDisplay() {
        $(".aq-updated-time").text("").hide();
        $(".aq-data-row").hide();
        $(".aq-dial-arrow").hide();
        $(".aq-aqi-value").text("--");
        $(".aq-pollutant-label").text("--");
        $(".aq-dial-status").toggleClass("not_available", true);
        $(".aq-title").html("<p>No Data</p>"); // AIR-430 Widget Cleanly Displays No Data cw 2021-06-28
        $(".aq-dial-container").toggleClass("hidden", false);
        $(".city").toggleClass("hidden", true);
    }

    function setCity() {
        let city = AQDialWidget.GLOBALS.getUrlVar("city");
        if (!city) {
            city = GeoLocation.getCityName();
        }
        $(".city").text(city);
    }

    function updateAirNowLink() {
        let $elem = $(".aq-dial-airnow-logo");
        let city = AQDialWidget.GLOBALS.getUrlVar("city");
        let state = AQDialWidget.GLOBALS.getUrlVar("state");
        let country = AQDialWidget.GLOBALS.getUrlVar("country");

        let url = $elem.attr("href");

        // If URL parameters are not set, instead pull from GeoLocation object
        if (!(city && state && country)) {
            city = GeoLocation.getCityName();
            state = GeoLocation.getStateCode();
            country = GeoLocation.getCountryCode();
        }

        url += "?city=" + city;
        if (state) {
            url += "&state=" + state;
        }
        url += "&country=" + country;
        $elem.attr("href", url);
    }

    function getDegree(aqi) {
        let deg;
        // AQI values 0 - 200 represent the first 4/6 of the dial
        if (aqi <= 200) {
          deg = (aqi / 200) * (MAX_ROTATION_DEGREES * (4/6));
        }
        // AQI values 201 - 300 represent the second to last 1/6 of the dial
        else if (aqi <= 300) {
          deg = (MAX_ROTATION_DEGREES * (4/6)) + ((((aqi-200) / (300-200))) * (MAX_ROTATION_DEGREES * (1/6)))
        }
        // AQI values 301 - 500 represent the last 1/6 of the dial
        else if (aqi <= 500) {
          deg = (MAX_ROTATION_DEGREES * (5/6)) + ((((aqi-300) / (500-300))) * (MAX_ROTATION_DEGREES * (1/6)))
        }
        // AQI values above 400 should just be treated as the maximum rotation
        else {
          deg = MAX_ROTATION_DEGREES;
        }
        return deg;
    }

    // Rotates the arrow to the provided degrees.  Degree values capped at 0 and 180
    function rotateArrow(deg) {
        // Ensure we do not rotate too far in either direction
        deg = Math.max(MIN_ROTATION_DEGREES, Math.min(deg, MAX_ROTATION_DEGREES));
        // Apply the rotation
        let arrows = document.getElementsByClassName("aq-dial-arrow");
        for (let i = 0; i < arrows.length; i++) {
            let arrow = arrows[i];
            arrow.style.webkitTransform = "rotate("+deg+"deg)";
            arrow.style.mozTransform = "rotate("+deg+"deg)";
            arrow.style.msTransform = "rotate("+deg+"deg)";
            arrow.style.oTransform = "rotate("+deg+"deg)";
            arrow.style.transform = "rotate("+deg+"deg)";
        }
    }
})(jQuery);
