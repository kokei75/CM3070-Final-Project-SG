//store water history
let waterHistory = [];

//history duration window
const HISTORY_DURATION = 10000;

//load data from api
async function loadData() {
  const res = await fetch("/api/latest");
  const data = await res.json();

  const water = data.water || {};
  const city = data.city || {};

  //get current water value
  const currentCm =
    typeof water.cm === "number"
      ? water.cm
      : water.cm !== undefined && water.cm !== null
      ? Number(water.cm)
      : null;

  //store water history
  if (currentCm !== null && !Number.isNaN(currentCm)) {
    waterHistory.push({
      value: currentCm,
      time: Date.now()
    });

    const now = Date.now();

    //remove old entries
    waterHistory = waterHistory.filter(
      entry => now - entry.time <= HISTORY_DURATION
    );
  }

  //calculate trend
  let trend = "—";
  let oldAvg = null;
  let newAvg = null;
  let rapidRise = false;

  if (waterHistory.length >= 3) {
    const midIndex = Math.floor(waterHistory.length / 2);

    const older = waterHistory.slice(0, midIndex);
    const newer = waterHistory.slice(midIndex);

    //average helper
    const avg = arr =>
      arr.reduce((sum, e) => sum + e.value, 0) / arr.length;

    oldAvg = avg(older);
    newAvg = avg(newer);

    const diff = newAvg - oldAvg;
    const tolerance = 1.5;

    //determine trend
    if (diff > tolerance) {
      trend = "Falling";
    } else if (diff < -tolerance) {
      trend = "Rising";
    } else {
      trend = "Stable";
    }

    //detect rapid rise
    if (trend === "Rising") {
      const change = Math.abs(newAvg - oldAvg);
      if (change > 5) {
        rapidRise = true;
      }
    }
  }

  //update trend text
  const trendEl = document.getElementById("waterTrend");
  trendEl.textContent = trend.toUpperCase();

  //determine water condition
  let waterCondition = "Unknown";

  if (water.status === "ALERT") {
    waterCondition = "High";
  } else if (water.status === "RISING") {
    waterCondition = "Moderate";
  } else if (water.status === "NORMAL") {
    waterCondition = "Low";
  }

  document.getElementById("waterStatus").textContent = waterCondition;

  //determine flood status
  let status = "SAFE";
  let message = "No flood risk";
  let action = "No action needed";
  let alert = "No active alerts";
  let reason = "—";

  if (water.status === "ALERT") {
    status = "DANGER";
    message = "Flood risk detected";
    action = "Move to higher ground";
    alert = "Flood risk detected";
    reason = "Water level has reached alert threshold";
  }

  else if (rapidRise) {
    status = "WARNING";
    message = "Water levels rising rapidly";
    action = "Prepare essentials";
    alert = "Rapid water rise detected";
    reason = "Significant increase in water level within a short time";
  }

  else if (water.status === "RISING" || trend === "Rising") {
    status = "WARNING";
    message = "Water levels rising";
    action = "Prepare essentials";
    alert = "Water level rising";
    reason = "Recent increase in water level";
  }

  //update flood status panel
  const floodEl = document.getElementById("floodStatus");
  floodEl.textContent = status;
  floodEl.className = "panelOne-status " + status;

  document.getElementById("floodMessage").textContent = message;

  //update alert panel
  const alertEl = document.getElementById("alertText");
  alertEl.textContent = alert;

  //update alert style
  alertEl.className = "panelFour-main";
  if (status === "DANGER") alertEl.classList.add("danger");
  else if (status === "WARNING") alertEl.classList.add("warning");
  else alertEl.classList.add("safe");

  document.getElementById("alertReason").textContent = reason;

  //update action panel
  const actionEl = document.getElementById("actionText");
  actionEl.textContent = action;

  //update weather
  document.getElementById("temp").textContent =
    city.tempC !== undefined && city.tempC !== null
      ? city.tempC + "°C"
      : "—";

  document.getElementById("humidity").textContent =
    city.humidity !== undefined && city.humidity !== null
      ? city.humidity + "%"
      : "—";

  document.getElementById("rain").textContent =
    city.rainPercent !== undefined && city.rainPercent !== null
      ? city.rainPercent > 50
        ? "Yes"
        : "No"
      : "—";

  //update last updated
  const lastEl = document.getElementById("lastUpdated");

  if (water.lastSeen) {
    const seconds = Math.floor((Date.now() - water.lastSeen) / 1000);
    lastEl.textContent = seconds + "s ago";
  } else {
    lastEl.textContent = "No data";
  }
}

//poll data every second
setInterval(loadData, 1000);

//initial load
loadData();