//poll interval
const POLL_MS = 500;

//offline threshold
const OFFLINE_SECS = 15;

//stale threshold
const STALE_SECS = OFFLINE_SECS * 3;

//panel 1 elements
const panelOneUpdatedEl = document.getElementById("lastUpdated");

//alert level elements
const panelOneAlertStatusEl      = document.getElementById("alertStatusText");
const panelOneAlertReasonEl      = document.getElementById("alertReason");
const panelOneAlertTriggeredByEl = document.getElementById("alertTriggeredBy");
const panelOneAlertDurationEl    = document.getElementById("alertDuration");

//system health elements
const panelOneHealthStatusEl = document.getElementById("healthStatusText");
const panelOneHealthReasonEl = document.getElementById("healthReason");
const panelOneHealthIssueEl  = document.getElementById("healthIssue");

//panel 2 water elements
const panelTwoWaterValueEl  = document.getElementById("waterValue");
const panelTwoWaterStatusEl = document.getElementById("waterStatus");
const panelTwoWaterTrendEl  = document.getElementById("waterTrend");
const panelTwoWaterSeenEl   = document.getElementById("waterSeen");

//panel 3 water node
const panelThreeWaterDotEl    = document.getElementById("healthWaterDot");
const panelThreeWaterStatusEl = document.getElementById("healthWaterStatus");
const panelThreeWaterSeenEl   = document.getElementById("healthWaterSeen");

//panel 3 city node
const panelThreeCityDotEl     = document.getElementById("healthCityDot");
const panelThreeCityStatusEl  = document.getElementById("healthCityStatus");
const panelThreeCitySeenEl    = document.getElementById("healthCitySeen");

//panel 3 wall node
const panelThreeWallDotEl     = document.getElementById("healthWallDot");
const panelThreeWallStatusEl  = document.getElementById("healthWallStatus");
const panelThreeWallSeenEl    = document.getElementById("healthWallSeen");

//panel 4 city elements
const panelFourCityTempEl  = document.getElementById("cityTemp");
const panelFourCityHumEl   = document.getElementById("cityHum");
const panelFourCityWetEl   = document.getElementById("citySurfaceWet");
const panelFourCityPressEl = document.getElementById("cityPress");
const panelFourCityAltEl   = document.getElementById("cityAlt");
const panelFourCitySeenEl  = document.getElementById("citySeen");
const panelFourCityStatusEl = document.getElementById("cityStatus");

//check panel 3 exists
const hasPanel3 =
  panelThreeWaterDotEl && panelThreeWaterStatusEl && panelThreeWaterSeenEl &&
  panelThreeCityDotEl  && panelThreeCityStatusEl  && panelThreeCitySeenEl  &&
  panelThreeWallDotEl  && panelThreeWallStatusEl  && panelThreeWallSeenEl;

//check panel 4 exists
const hasPanel4 =
  panelFourCityTempEl && panelFourCityHumEl && panelFourCityWetEl &&
  panelFourCityPressEl && panelFourCityAltEl && panelFourCitySeenEl &&
  panelFourCityStatusEl;

//track alert level
let currentAlertLevel = null;

//track alert start time
let alertStartMs = Date.now();

//get seconds since timestamp
function secondsAgo(ms) {
  if (!ms) return null;
  const diffMs = Date.now() - ms;
  if (diffMs < 0) return 0;
  return Math.floor(diffMs / 1000);
}

//format time ago
function formatSecondsAgo(ms) {
  if (!ms) return "never";
  const s = secondsAgo(ms);
  if (s === null) return "never";
  if (s < 60) return `${s}s ago`;
  return `${Math.floor(s / 60)}m ago`;
}

//format number
function formatNumber(n, digits = 1) {
  return (typeof n === "number" && Number.isFinite(n)) ? n.toFixed(digits) : null;
}

//check offline status
function isOffline(lastSeenMs) {
  const s = secondsAgo(lastSeenMs);
  if (s === null) return true;
  return s > OFFLINE_SECS;
}

//convert rain percent to label
function wetnessLabel(percent) {
  if (typeof percent !== "number" || !Number.isFinite(percent)) return null;
  if (percent < 10) return "Dry";
  if (percent < 40) return "Light";
  if (percent < 70) return "Wet";
  return "Heavy";
}

//get latest update time
function formatLastUpdated(latest) {
  const times = [
    latest.water?.lastSeen,
    latest.city?.lastSeen,
    latest.wall?.lastSeen
  ].filter(Boolean);

  if (times.length === 0) return "never";
  const newest = Math.max(...times);
  return formatSecondsAgo(newest);
}

//format alert duration
function formatAlertDuration() {
  const secs = Math.floor((Date.now() - alertStartMs) / 1000);
  if (secs < 60) return `${secs}s`;
  const mins = Math.floor(secs / 60);
  return `${mins}m ${secs % 60}s`;
}

//determine alert level
function computeAlertLevel(latest) {
  const water = latest.water || {};
  const wall  = latest.wall  || {};

  if (wall.state === "TRIGGERED" || water.status === "ALERT") return "CRITICAL";
  if (water.status === "RISING") return "WARNING";
  return "NORMAL";
}

//explain alert
function computeAlertExplanation(latest) {
  const water = latest.water || {};
  const wall  = latest.wall  || {};

  if (wall.state === "TRIGGERED") {
    const why = wall.triggeredBy && wall.triggeredBy !== "NO_DATA"
      ? wall.triggeredBy
      : "unknown reason";
    return `Flood wall triggered (${why})`;
  }

  if (water.status === "ALERT") return "Water level reached ALERT threshold";
  if (water.status === "RISING") return "Water level rising (RISING)";

  return "No active alerts";
}

//identify alert source
function computeAlertTriggeredBy(latest, alertLevel) {
  const water = latest.water || {};
  const wall  = latest.wall  || {};

  if (alertLevel === "CRITICAL") {
    if (wall.state === "TRIGGERED") return "WALL (actuation)";
    if (water.status === "ALERT") return "WATER node";
  }

  if (alertLevel === "WARNING") return "WATER node";
  return "—";
}

//check system health
function computeSystemHealth(latest) {
  const water = latest.water || {};
  const city  = latest.city  || {};
  const wall  = latest.wall  || {};

  const anyMissing =
    isOffline(water.lastSeen) || isOffline(city.lastSeen) || isOffline(wall.lastSeen) ||
    water.status === "NO_DATA" || city.status === "NO_DATA" || wall.state === "NO_DATA";

  return anyMissing ? "DEGRADED" : "OK";
}

//identify faulty node
function computeNodeIssue(latest) {
  const waterOff = isOffline(latest.water?.lastSeen) || latest.water?.status === "NO_DATA";
  const cityOff  = isOffline(latest.city?.lastSeen)  || latest.city?.status  === "NO_DATA";
  const wallOff  = isOffline(latest.wall?.lastSeen)  || latest.wall?.state   === "NO_DATA";

  if (waterOff) return `WATER (${formatSecondsAgo(latest.water?.lastSeen)})`;
  if (cityOff)  return `CITY (${formatSecondsAgo(latest.city?.lastSeen)})`;
  if (wallOff)  return `WALL (${formatSecondsAgo(latest.wall?.lastSeen)})`;

  return "—";
}

//explain system health
function computeHealthExplanation(latest, health) {
  const water = latest.water || {};
  const city  = latest.city  || {};
  const wall  = latest.wall  || {};

  if (health === "OK") return "All nodes reporting recently";

  if (isOffline(water.lastSeen)) return "No recent data from WATER node";
  if (isOffline(city.lastSeen))  return "No recent data from CITY node";
  if (isOffline(wall.lastSeen))  return "No recent data from WALL node";

  if (water.status === "NO_DATA") return "WATER node has no data yet";
  if (city.status === "NO_DATA")  return "CITY node has no data yet";
  if (wall.state === "NO_DATA")   return "WALL node has no data yet";

  return "Telemetry incomplete";
}

//render panel 1 (alert + health)
function renderPanel1(latest) {
  //update last updated
  panelOneUpdatedEl.textContent = formatLastUpdated(latest);

  //compute alert level
  const alertLevel = computeAlertLevel(latest);

  //reset timer if alert changes
  if (alertLevel !== currentAlertLevel) {
    currentAlertLevel = alertLevel;
    alertStartMs = Date.now();
  }

  //update alert ui
  panelOneAlertStatusEl.className = `panelOne-status ${alertLevel}`;
  panelOneAlertStatusEl.textContent = alertLevel;
  panelOneAlertReasonEl.textContent = computeAlertExplanation(latest);
  panelOneAlertTriggeredByEl.textContent = computeAlertTriggeredBy(latest, alertLevel);
  panelOneAlertDurationEl.textContent = formatAlertDuration();

  //compute system health
  const health = computeSystemHealth(latest);
  const healthClass = (health === "OK") ? "NORMAL" : "DEGRADED";

  //update health ui
  panelOneHealthStatusEl.className = `panelOne-status panelOne-statusSmall ${healthClass}`;
  panelOneHealthStatusEl.textContent = health;
  panelOneHealthReasonEl.textContent = computeHealthExplanation(latest, health);
  panelOneHealthIssueEl.textContent = (health === "OK") ? "—" : computeNodeIssue(latest);
}

//convert water status to text
function waterTrendText(status) {
  if (status === "RISING") return "Rising";
  if (status === "ALERT") return "Critical rise";
  if (status === "NORMAL") return "Stable";
  return "No data";
}

//render panel 2 (water)
function renderPanel2(latest) {
  const water = latest.water || {};

  //display water level
  panelTwoWaterValueEl.textContent =
    typeof water.cm === "number" ? `${water.cm.toFixed(1)} cm` : "—";

  //display status + trend
  panelTwoWaterStatusEl.textContent = water.status || "NO_DATA";
  panelTwoWaterTrendEl.textContent  = waterTrendText(water.status);
  panelTwoWaterSeenEl.textContent   = formatSecondsAgo(water.lastSeen);
}

//render panel 4 (city)
function renderPanel4(latest) {
  if (!hasPanel4) return;

  const city = latest.city || {};

  //format values
  const t = formatNumber(city.tempC, 1);
  const h = formatNumber(city.humidity, 0);
  const p = formatNumber(city.pressurehPa, 1);
  const a = formatNumber(city.altitudeM, 1);

  //update ui
  panelFourCityTempEl.textContent  = t ? `${t} °C` : "—";
  panelFourCityHumEl.textContent   = h ? `${h} %` : "—";
  panelFourCityPressEl.textContent = p ? `${p} hPa` : "—";
  panelFourCityAltEl.textContent   = a ? `${a} m` : "—";
  panelFourCitySeenEl.textContent  = formatSecondsAgo(city.lastSeen);
  panelFourCityStatusEl.textContent = city.status || "NO_DATA";

  //rain display
  if (typeof city.rainPercent === "number") {
    const label = wetnessLabel(city.rainPercent);
    const percent = Math.round(city.rainPercent);
    panelFourCityWetEl.textContent =
      label ? `${label} (${percent} %)` : `${percent} %`;
  } else {
    panelFourCityWetEl.textContent = "—";
  }
}

//check if water/city node is online
function nodeIsOnline_WaterCity(node) {
  if (!node?.lastSeen) return false;
  if (isOffline(node.lastSeen)) return false;
  if (node.status === "NO_DATA") return false;
  return true;
}

//check if wall node is online
function nodeIsOnline_Wall(node) {
  if (!node?.lastSeen) return false;
  if (isOffline(node.lastSeen)) return false;
  if (node.state === "NO_DATA") return false;
  return true;
}

//update node health row
function setHealthRow(dotEl, statusEl, seenEl, online, lastSeen, hasNoDataFlag) {
  if (online) {
    dotEl.className = "panelThree-dot ok";
    statusEl.textContent = "Online";
  } else {
    const age = secondsAgo(lastSeen);

    if (hasNoDataFlag && lastSeen && !isOffline(lastSeen)) {
      dotEl.className = "panelThree-dot warn";
      statusEl.textContent = "No data";
    } else if (age !== null && age <= STALE_SECS) {
      dotEl.className = "panelThree-dot warn";
      statusEl.textContent = "Stale";
    } else {
      dotEl.className = "panelThree-dot bad";
      statusEl.textContent = "Offline";
    }
  }

  //update last seen time
  seenEl.textContent = lastSeen ? formatSecondsAgo(lastSeen) : "never";
}

//render panel 3 (node health)
function renderPanel3(latest) {
  if (!hasPanel3) return;

  const water = latest.water || {};
  const city  = latest.city || {};
  const wall  = latest.wall || {};

  //water node
  setHealthRow(
    panelThreeWaterDotEl,
    panelThreeWaterStatusEl,
    panelThreeWaterSeenEl,
    nodeIsOnline_WaterCity(water),
    water.lastSeen,
    water.status === "NO_DATA"
  );

  //city node
  setHealthRow(
    panelThreeCityDotEl,
    panelThreeCityStatusEl,
    panelThreeCitySeenEl,
    nodeIsOnline_WaterCity(city),
    city.lastSeen,
    city.status === "NO_DATA"
  );

  //wall node
  setHealthRow(
    panelThreeWallDotEl,
    panelThreeWallStatusEl,
    panelThreeWallSeenEl,
    nodeIsOnline_Wall(wall),
    wall.lastSeen,
    wall.state === "NO_DATA"
  );
}

//fetch and update dashboard
async function update() {
  try {
    const res = await fetch("/api/latest", { cache: "no-store" });
    const latest = await res.json();

    renderPanel1(latest);
    renderPanel2(latest);
    renderPanel3(latest);
    renderPanel4(latest);
  } catch (err) {
    //fallback alert
    panelOneAlertStatusEl.className = "panelOne-status NORMAL";
    panelOneAlertStatusEl.textContent = "NORMAL";
    panelOneAlertReasonEl.textContent = "Cannot reach /api/latest";
    panelOneAlertTriggeredByEl.textContent = "—";
    panelOneAlertDurationEl.textContent = "—";

    //fallback health
    panelOneHealthStatusEl.className = "panelOne-status panelOne-statusSmall DEGRADED";
    panelOneHealthStatusEl.textContent = "DEGRADED";
    panelOneHealthReasonEl.textContent = "Cannot reach /api/latest";
    panelOneHealthIssueEl.textContent = "API unreachable";

    panelOneUpdatedEl.textContent = "—";

    console.log(err);
  }
}

//initial load
update();

//repeat polling
setInterval(update, POLL_MS);