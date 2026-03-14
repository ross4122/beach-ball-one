// -------------------- ENV + API SETUP --------------------
const PROD = "prod";
const DEV = "dev";
const STAGE = "stage";
const QA = "qa";

const KML_URL = "ku";
const LATITUDE = "la";
const LONGITUDE = "lo";
const FLEET_NUMBER = "fn";
const UPDATE_TIME = "ut";
const SERVICE_NUMBER = "sn";
const OPERATING_COMPANY = "oc";
const DIRECTION = "dn";
const DESTINATION_DISPLAY = "dd";
const CANCELLED = "cd";
const SERVICE_ID = "sd";
const HEADING = "hg";
const FINAL_STOP = "fs";
const AIMED_ORIGIN_STOP_DEPARTURE_TIME = "ao";
const ORIGIN_STOP_REFERENCE = "or";
const OUT_OF_SERVICE = "os";
const CAPACITY = "rg";

const ENVIRONMENT = getEnvironment();
const UKBUS_API_PREFIX = getUkBusUrl(ENVIRONMENT);
const SCG_API_PREFIX = getScgUrl(ENVIRONMENT);
const API_KEY = getApiKey(ENVIRONMENT);

const MAX_AGE_MS = 15 * 60 * 1000; // 15 minutes

const FEEDS = [
  { name: "prod", prefix: "https://api.stagecoach-technology.net" },
//  { name: "dev",  prefix: "https://api.stagecoach-technology-dev.net" },
//  { name: "qa",   prefix: "https://api.stagecoach-technology-qa.net" },
  { name: "stage",prefix: "https://api.stagecoach-technology-stage.net" },
];

// Higher number = higher priority (only used if update times tie)
const FEED_PRIORITY = {
  prod: 4,
  stage: 3,
//  qa: 2,
//  dev: 1,
};

function getUpdateMs(bus) {
  // Your ut appears to be ms already, but you divide by 1000 elsewhere.
  // We'll treat it as a number and compare numerically.
  const n = Number(bus?.[UPDATE_TIME]);
  return Number.isFinite(n) ? n : -Infinity;
}

function getFeedPriority(bus) {
  const name = String(bus?.__feed || "").trim();
  return FEED_PRIORITY[name] ?? 0;
}

function isBetterBus(candidate, current) {
  if (!current) return true;

  const cu = getUpdateMs(candidate);
  const uu = getUpdateMs(current);

  if (cu !== uu) return cu > uu; // newest wins

  // tie-breaker: feed priority
  const cp = getFeedPriority(candidate);
  const up = getFeedPriority(current);
  if (cp !== up) return cp > up;

  // final tie-breaker: keep current (stable)
  return false;
}

function isFreshEnough(bus) {
  const updatedMs = getUpdateMs(bus);
  return Number.isFinite(updatedMs) && Date.now() - updatedMs <= MAX_AGE_MS;
}

// Choose priority order by ordering FEEDS.
// First feed in the list “wins” if duplicates exist.

// If you DON'T want the API key client-side, remove it from here and proxy it server-side instead.
function getEnvironment() {
  if (
    window.location.hostname === "localhost" ||
    window.location.hostname === "www.stagecoach-technology-dev.net"
  ) {
    return DEV;
  } else if (window.location.hostname === "www.stagecoach-technology-qa.net") {
    return QA;
  } else if (window.location.hostname === "www.stagecoach-technology-stage.net") {
    return STAGE;
  } else if (window.location.hostname === "www.stagecoach-technology.net") {
    return PROD;
  }
  return DEV;
}

function getUkBusUrl(env) {
  if (env === PROD) return "https://api.stagecoachbus.com";
  return "https://api.ukbusprojectstage.com";
}

function getScgUrl(env) {
  if (env === QA) return "https://api.stagecoach-technology-qa.net";
  // stage/dev/prod all point to stage host in your original code
  return "https://api.stagecoach-technology-stage.net";
}

function getApiKey(env) {
  if (env === PROD) return "ukbusprodapi_7k8K536tNsPH#!";
  return "ukbusstageapi_RTflp12CeJ";
}

// -------------------- REQUIREMENTS LOGIC --------------------
// You can wire these to Sets like you did in the Leaflet version if you want.
// For now, they’re stubs matching your old structure:

function getFleetKey(bus) {
  // Normalise fleet number once
  return bus[FLEET_NUMBER] != null
    ? String(bus[FLEET_NUMBER]).trim()
    : "";
}

function isBRequirement(bus) {
  const fn = getFleetKey(bus);
  return bothReqFleetNumbers.has(fn);
}

function isRRequirement(bus) {
  const fn = getFleetKey(bus);
  return rReqFleetNumbers.has(fn) || bothReqFleetNumbers.has(fn);
}

function isKRequirement(bus) {
  const fn = getFleetKey(bus);
  return kReqFleetNumbers.has(fn) || bothReqFleetNumbers.has(fn);
}

function isUnknown(bus) {
  const fn = Number(bus[FLEET_NUMBER]);
  return Number.isFinite(fn) && (fn >= 90000 || fn < 10000);
}

function isOutOfService(bus) {
  return bus[OUT_OF_SERVICE] === "True" || bus[CANCELLED] === "True";
}

function isNotInService(bus) {
  // same as your old logic
  return bus[AIMED_ORIGIN_STOP_DEPARTURE_TIME] === "" && bus[OPERATING_COMPANY] !== "SCLK";
}

function getIconClass(bus) {
  if (isUnknown(bus)) return "newicon";

  const r = isRRequirement(bus);
  const k = isKRequirement(bus);
  const b = isBRequirement(bus);

  if (b) return "breqicon";
  if (r && k) return "bothreqicon";
  if (r) return "r-reqicon";
  if (k) return "k-reqicon";

  return "newicon";
}

function getIconText(bus) {
  const r = isRRequirement(bus);
  const k = isKRequirement(bus);
  const b = isBRequirement(bus);

  if (b) return "B";
  if (r && k) return "R/K";
  if (r) return "R";
  if (k) return "K";
  return "";
}

// -------------------- LEAFLET MAP INIT --------------------
const map = L.map("map").setView([56.472, -2.9307], 12);

L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
  attribution:
    '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
}).addTo(map);

L.control
  .locate({
    position: "topleft",
    follow: true,
    setView: true,
    keepCurrentZoomLevel: true,
    icon: "fa fa-location-arrow",
    iconLoading: "fa fa-spinner fa-spin",
    showPopup: false,
  })
  .addTo(map);

// Optional: add user marker once
function addUserLocation() {
  if (!navigator.geolocation) return;
  navigator.geolocation.getCurrentPosition(
    (pos) => {
      const userCoords = [pos.coords.latitude, pos.coords.longitude];
      L.circleMarker(userCoords, {
        color: "blue",
        fillColor: "blue",
        fillOpacity: 0.5,
        radius: 5,
      }).addTo(map);
      map.setView(userCoords, 12);
    },
    () => {}
  );
}
addUserLocation();

// -------------------- MARKER RENDERING --------------------
const busMarkers = new Map(); // key: fleet number (fn) or stable id
let lastOpenedKey = null;
let popupWasOpen = false;

function formatLastSeen(bus) {
  const updatedTime = new Date(0);
  updatedTime.setUTCSeconds(Number(bus[UPDATE_TIME]) / 1000);

  const now = new Date();
  const diffMs = now - updatedTime;

  let seconds = Math.floor(diffMs / 1000);
  let minutes = Math.floor(seconds / 60);
  let hours = Math.floor(minutes / 60);
  let days = Math.floor(hours / 24);

  hours = hours - days * 24;
  minutes = minutes - days * 24 * 60 - hours * 60;
  seconds = seconds - days * 24 * 60 * 60 - hours * 60 * 60 - minutes * 60;

  const formattedTime = updatedTime.toLocaleString("en-GB", { timeZone: "UTC" });

  const ago =
    (days === 0 ? "" : `${days} days `) +
    (hours === 0 ? "" : `${hours} hrs `) +
    (minutes === 0 ? "" : `${minutes} min `) +
    (seconds === 1 ? `${seconds} sec ` : `${seconds} secs `) +
    "ago";

  return { formattedTime, ago, diffMs };
}

function buildPopupHtml(bus) {
  const service = bus[SERVICE_NUMBER] ? String(bus[SERVICE_NUMBER]) : "";
  const destination = (bus[DESTINATION_DISPLAY] || bus[FINAL_STOP] || "").trim();
  const opco = (bus[OPERATING_COMPANY] || "").trim();
  const fleet = bus[FLEET_NUMBER] != null ? String(bus[FLEET_NUMBER]) : "";
  const heading = bus[HEADING] != null ? String(bus[HEADING]) : "";

  const feed = (bus.__feed || "").trim(); // <-- added

  const updatedTime = new Date(0);
  updatedTime.setUTCSeconds(Number(bus[UPDATE_TIME]) / 1000);
  const now = new Date();
  const secs = Math.max(0, Math.floor((now - updatedTime) / 1000));

  const timeAgo =
    secs < 60 ? `${secs} secs ago` :
    secs < 120 ? `1 min ago` :
    `${Math.floor(secs / 60)} mins ago`;

  const line1 =
    service && destination
      ? `<b>${service}</b> to <b>${destination}</b>`
      : service
      ? `<b>${service}</b>`
      : `Not in Service`;

  return `
    ${line1}<br>
    <b>${fleet}</b> - ${opco}<br>
    <b>Last seen</b> ${timeAgo}<br>
    <b>Heading</b> ${heading}°<br>
    <small style="opacity:0.75">Feed: ${feed || "unknown"}</small>
  `;
}


function createBusDivIcon(bus) {
  const container = document.createElement("div");
  container.className = "bus-marker";

  const label = document.createElement("div");
  label.className = "fleetlabel";
  label.textContent = bus[FLEET_NUMBER] ?? "";

  if (isNotInService(bus)) label.classList.add("fleetlabel--nis");

  // Apply colouring directly to fleet label
  if (isUnknown(bus)) {
    label.classList.add("fleetlabel--unknown");
  } else {
    const r = isRRequirement(bus);
    const k = isKRequirement(bus);
    const b = isBRequirement(bus);

    if (b) label.classList.add("fleetlabel--b");
    else if (r && k) label.classList.add("fleetlabel--rk");
    else if (r) label.classList.add("fleetlabel--r");
    else if (k) label.classList.add("fleetlabel--k");
  }

  container.appendChild(label);

  const W = 52;
  const H = 16;

  return L.divIcon({
    html: container,
    className: "bus-divicon",
    iconSize: [W, H],
    iconAnchor: [W / 2, H / 2],
    popupAnchor: [0, -(H / 2)],
  });
}


// -------------------- FETCHING --------------------
function withQuery(name, value) {
  if (value == null) return "";
  return `?${name}=${encodeURIComponent(value)}`;
}
function andParam(name, value) {
  if (value == null) return "";
  return `&${name}=${encodeURIComponent(value)}`;
}

function buildVehicleQueryString(apiPrefix, bounds) {
  const baseUrl = `${apiPrefix}/vehicle-tracking/v1/vehicles`;
  const ne = bounds.getNorthEast();
  const sw = bounds.getSouthWest();

  return (
    baseUrl +
    withQuery("latsw", sw.lat) +
    andParam("lngsw", sw.lng) +
    andParam("latne", ne.lat) +
    andParam("lngne", ne.lng) +
    andParam("clip", "true")
  );
}

async function fetchFeedVehicles(feed, bounds) {
  const url = buildVehicleQueryString(feed.prefix, bounds);
  const proxiedUrl = `https://global.ross4122-ff0.workers.dev/?url=${encodeURIComponent(url)}`;

  const res = await fetch(proxiedUrl);
  if (!res.ok) throw new Error(`[${feed.name}] Fetch failed: ${res.status} ${res.statusText}`);

  const data = await res.json();
  const services = Array.isArray(data?.services) ? data.services : [];

  // tag each bus with the feed name so popup + marker can display it
  for (const bus of services) bus.__feed = feed.name;

  return services;
}

async function fetchVehicles() {
  try {
    const showRequirementsOnly =
      document.getElementById("requirementsCheckbox")?.checked ?? false;

    popupWasOpen = !!map._popup;

    const bounds = map.getBounds();

    // 1) Pull all feeds
    const mergedByFleet = new Map(); // fleetKey -> best bus

    for (const feed of FEEDS) {
      let services = [];
      try {
        services = await fetchFeedVehicles(feed, bounds);
      } catch (e) {
        console.warn(String(e));
        continue;
      }

      for (const bus of services) {
        const fleetKey = String(bus[FLEET_NUMBER] ?? "").trim();
        if (!fleetKey) continue;

        const existing = mergedByFleet.get(fleetKey);
        if (isBetterBus(bus, existing)) {
          mergedByFleet.set(fleetKey, bus);
        }
      }
    }

    // 2) Create the set of keys that should exist after merge
    const targetKeys = new Set();

    for (const [fleetKey, bus] of mergedByFleet.entries()) {
      // Hide buses older than 15 minutes
      if (!isFreshEnough(bus)) {
        continue;
      }

      // Apply requirement-only filter
      if (
        showRequirementsOnly &&
        !(isRRequirement(bus) || isKRequirement(bus) || isBRequirement(bus))
      ) {
        continue;
      }

      const lat = Number(bus[LATITUDE]);
      const lon = Number(bus[LONGITUDE]);
      if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue;

      targetKeys.add(fleetKey);

      const icon = createBusDivIcon(bus);
      const popupHtml = buildPopupHtml(bus);

      if (busMarkers.has(fleetKey)) {
        const marker = busMarkers.get(fleetKey);
        marker.setLatLng([lat, lon]);
        marker.setIcon(icon);
        marker.setPopupContent(popupHtml);
        marker.options.bus = bus;
      } else {
        const marker = L.marker([lat, lon], { icon, bus }).addTo(map);
        marker.bindPopup(popupHtml);
        busMarkers.set(fleetKey, marker);

        marker.on("popupopen", () => {
          lastOpenedKey = fleetKey;
          popupWasOpen = true;
        });

        marker.on("popupclose", () => {
          lastOpenedKey = null;
          popupWasOpen = false;
        });
      }
    }

    // 3) Remove markers not in target set
    for (const [key, marker] of busMarkers.entries()) {
      if (!targetKeys.has(key)) {
        marker.remove();
        busMarkers.delete(key);
      }
    }

    // 4) Re-open popup after refresh
    if (popupWasOpen && lastOpenedKey && busMarkers.has(lastOpenedKey)) {
      busMarkers.get(lastOpenedKey).openPopup();
    }
  } catch (err) {
    console.error("Error fetching vehicles:", err);
  }
}

// checkbox listener (same as your Leaflet app)
document
  .getElementById("requirementsCheckbox")
  ?.addEventListener("change", fetchVehicles);

// initial + interval + refresh-after-pan
fetchVehicles();
setInterval(fetchVehicles, 10000);

let fetchTimeout;
map.on("moveend", () => {
  clearTimeout(fetchTimeout);
  fetchTimeout = setTimeout(fetchVehicles, 500);
});