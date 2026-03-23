//poll interval
const POLL_MS = 1000;

//offline threshold
const OFFLINE_SECS = 15;

//history display interval
const DISPLAY_INTERVAL_MS = 30 * 1000;

//get seconds since timestamp
function secondsAgo(ms) {
  if (!ms) return null;
  return Math.floor((Date.now() - ms) / 1000);
}

//format last seen text
function formatSeen(ms) {
  if (!ms) return "never";
  const s = secondsAgo(ms);
  if (s < 60) return `${s}s ago`;
  return `${Math.floor(s / 60)}m ago`;
}

//format clock time
function formatClock(ms) {
  if (!ms) return "—";
  return new Date(ms).toLocaleTimeString();
}

//check if node is online
function isOnline(ms) {
  const s = secondsAgo(ms);
  return s !== null && s <= OFFLINE_SECS;
}

//update online badge
function setBadge(id, online) {
  const el = document.getElementById(id);
  el.textContent = online ? "ONLINE" : "OFFLINE";
  el.className = "badge " + (online ? "online" : "offline");
}

//filter history by time interval
function filterHistoryByInterval(rows = [], intervalMs = DISPLAY_INTERVAL_MS) {
  if (!rows.length) return [];

  const kept = [];
  const seenBuckets = new Set();

  for (const row of rows) {
    if (!row.time) continue;

    const bucketStart = Math.floor(row.time / intervalMs) * intervalMs;

    if (!seenBuckets.has(bucketStart)) {
      kept.push({
        ...row,
        bucketTime: bucketStart
      });
      seenBuckets.add(bucketStart);
    }
  }

  return kept;
}

//update water values
function updateWater(w) {
  document.getElementById("waterCm").textContent =
    typeof w.cm === "number" ? `${w.cm.toFixed(1)} cm` : "—";

  document.getElementById("waterStatus").textContent = w.status || "NO_DATA";
  document.getElementById("waterRssi").textContent = w.rssi ?? "—";
  document.getElementById("waterTime").textContent = formatSeen(w.lastSeen);

  setBadge("waterOnline", isOnline(w.lastSeen));
}

//render water history
function renderWaterHistory(rows = []) {
  const body = document.getElementById("waterHistoryBody");
  const displayRows = filterHistoryByInterval(rows);

  body.innerHTML = displayRows.map(row => `
    <tr>
      <td>${formatClock(row.bucketTime || row.time)}</td>
      <td>${typeof row.cm === "number" ? row.cm.toFixed(1) + " cm" : "—"}</td>
      <td>${row.status || "NO_DATA"}</td>
      <td>${row.rssi ?? "—"}</td>
    </tr>
  `).join("");
}

//update city values
function updateCity(c) {
  document.getElementById("cityTemp").textContent =
    typeof c.tempC === "number" ? `${c.tempC.toFixed(1)} °C` : "—";

  document.getElementById("cityHumidity").textContent =
    typeof c.humidity === "number" ? `${c.humidity.toFixed(0)} %` : "—";

  document.getElementById("cityRainPercent").textContent =
    typeof c.rainPercent === "number" ? `${Math.round(c.rainPercent)} %` : "—";

  document.getElementById("cityPressure").textContent =
    typeof c.pressurehPa === "number" ? `${c.pressurehPa.toFixed(1)} hPa` : "—";

  document.getElementById("cityAltitude").textContent =
    typeof c.altitudeM === "number" ? `${c.altitudeM.toFixed(1)} m` : "—";

  document.getElementById("cityStatus").textContent = c.status || "NO_DATA";
  document.getElementById("cityTime").textContent = formatSeen(c.lastSeen);

  setBadge("cityOnline", isOnline(c.lastSeen));
}

//render city history
function renderCityHistory(rows = []) {
  const body = document.getElementById("cityHistoryBody");
  const displayRows = filterHistoryByInterval(rows);

  body.innerHTML = displayRows.map(row => `
    <tr>
      <td>${formatClock(row.bucketTime || row.time)}</td>
      <td>${typeof row.tempC === "number" ? row.tempC.toFixed(1) + " °C" : "—"}</td>
      <td>${typeof row.humidity === "number" ? row.humidity.toFixed(0) + " %" : "—"}</td>
      <td>${typeof row.rainPercent === "number" ? Math.round(row.rainPercent) + " %" : "—"}</td>
      <td>${row.status || "NO_DATA"}</td>
    </tr>
  `).join("");
}

//update wall values
function updateWall(w) {
  document.getElementById("wallState").textContent = w.state || "NO_DATA";
  document.getElementById("wallTriggeredBy").textContent = w.triggeredBy || "—";
  document.getElementById("wallRssi").textContent = w.rssi ?? "—";
  document.getElementById("wallTime").textContent = formatSeen(w.lastSeen);

  setBadge("wallOnline", isOnline(w.lastSeen));
}

//render wall history
function renderWallHistory(rows = []) {
  const body = document.getElementById("wallHistoryBody");
  const displayRows = filterHistoryByInterval(rows);

  body.innerHTML = displayRows.map(row => `
    <tr>
      <td>${formatClock(row.bucketTime || row.time)}</td>
      <td>${row.state || "NO_DATA"}</td>
      <td>${row.triggeredBy || "—"}</td>
      <td>${row.rssi ?? "—"}</td>
    </tr>
  `).join("");
}

//load latest data and history
async function loadNodes() {
  try {
    const [latestRes, historyRes] = await Promise.all([
      fetch("/api/latest", { cache: "no-store" }),
      fetch("/api/history", { cache: "no-store" })
    ]);

    const latest = await latestRes.json();
    const history = await historyRes.json();

    updateWater(latest.water || {});
    updateCity(latest.city || {});
    updateWall(latest.wall || {});

    renderWaterHistory(history.water || []);
    renderCityHistory(history.city || []);
    renderWallHistory(history.wall || []);
  } catch (err) {
    console.error("Failed to load nodes:", err);
  }
}

//initial load
loadNodes();

//repeat polling
setInterval(loadNodes, POLL_MS);