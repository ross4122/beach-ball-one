const PROD = "prod";
const DEV = "dev";
const STAGE = "stage";
const QA = "qa";
const ENVIRONMENT = getEnvironment();
const UKBUS_API_PREFIX = getUkBusUrl(ENVIRONMENT);
const SCG_API_PREFIX = getScgUrl(ENVIRONMENT);
const API_KEY = getApiKey(ENVIRONMENT);

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
const NEXT_STOP_REFERENCE = "nr";
const ROUTE_NEXT_STOP = "ns";
const ROUTE_CURRENT_STOP = "cs";
const NEXT_STOP_NAME = "nn";
const HEADING = "hg";
const FINAL_STOP = "fs";
const AIMED_NEXT_STOP_DEPARTURE_TIME = "ax";
const EXP_NEXT_STOP_DEPARTURE_TIME = "ex";
const AIMED_ORIGIN_STOP_DEPARTURE_TIME = "ao";
const ORIGIN_STOP_REFERENCE = "or";
const OUT_OF_SERVICE = "os";
const BOUNDARY_DISTANCE = 0.02;
const AHEAD = "ahead";
const BEHIND = "behind";
const ARRIVED = "arrived";
const CAPACITY = "rg";

const DEFAULT = "#000000";
const RED = "#BA5E3D";
const AMBER = "#F5BA42";
const GREEN = "#009b77";
const EDUCATION = "#FFFF00";
const BUSINESS = "#009B77";

let markers = {};
let xhrRequests = [];

let map = null;
let viewportBox = null;
let refreshInterval = null;
let selectedBus = null;
let selectedMarker = null;

function getEnvironment() {
  if (
    window.location.hostname === "localhost" ||
    window.location.hostname === "www.stagecoach-technology-dev.net"
  ) {
    return DEV;
  } else if (window.location.hostname === "www.stagecoach-technology-qa.net") {
    return QA;
  } else if (
    window.location.hostname === "www.stagecoach-technology-stage.net"
  ) {
    return STAGE;
  } else if (window.location.hostname === "www.stagecoach-technology.net") {
    return PROD;
  }
  return DEV;
}

function getUkBusUrl(env) {
  if (env === PROD) {
    return "https://api.stagecoachbus.com";
  }
  return "https://api.ukbusprojectstage.com";
}

function getScgUrl(env) {
  if (env === PROD) {
    return "https://api.stagecoach-technology.net";
  } else if (env === STAGE) {
    return "https://api.stagecoach-technology-stage.net";
  } else if (env === QA) {
    return "https://api.stagecoach-technology-qa.net";
  }

  return "https://api.stagecoach-technology.net";
}

function getApiKey(env) {
  if (env == PROD) {
    return "ukbusprodapi_7k8K536tNsPH#!";
  }
  return "ukbusstageapi_RTflp12CeJ";
}

function isGreenRoad(bus) {
  return bus[OPERATING_COMPANY] == undefined;
}

function FilterControls(controlDiv) {
  // Set CSS for the control border.
  const opCoSelect = document.createElement("select");
  opCoSelect.id = "opco";

  [
    "All Op-Co",
    "SCMN",
    "SBLB",
    "SCCM",
    "SCCU",
    "SCEK",
    "SCNH",
    "SCEM",
    "SCFI",
    "SCGL",
    "SCHI",
    "SCMN",
    "SCMY",
    "SCNE",
    "SCOX",
    "SDVN",
    "SSWL",
    "STWS",
    "SYRK",
    "SCSO",
    "SCLK",
  ].forEach(function (opCo) {
    const option = document.createElement("option");
    option.text = opCo;
    option.value = opCo;
    opCoSelect.appendChild(option);
  });

  opCoSelect.style.backgroundColor = "#fff";
  opCoSelect.style.border = "2px solid #fff";
  opCoSelect.style.borderRadius = "3px";
  opCoSelect.style.boxShadow = "0 2px 6px rgba(0,0,0,.3)";
  opCoSelect.style.cursor = "pointer";
  opCoSelect.style.marginBottom = "22px";
  opCoSelect.style.marginTop = "8px";
  opCoSelect.style.marginRight = "8px";
  opCoSelect.style.textAlign = "center";
  opCoSelect.title = "Operating Company";
  controlDiv.appendChild(opCoSelect);

  const opCoSelectText = document.createElement("div");
  opCoSelectText.style.color = "rgb(25,25,25)";
  opCoSelectText.style.fontFamily = "Arial, Helvetica, sans-serif";
  opCoSelectText.style.fontSize = "16px";
  opCoSelectText.style.lineHeight = "38px";
  opCoSelectText.style.paddingLeft = "5px";
  opCoSelectText.style.paddingRight = "5px";
  opCoSelect.appendChild(opCoSelectText);

  opCoSelect.addEventListener("change", function () {
    changeCriteria();
  });

  const serviceNumber = document.createElement("input");
  serviceNumber.setAttribute("type", "text");
  serviceNumber.id = "serviceNumber";
  serviceNumber.style.marginRight = "8px";
  serviceNumber.placeholder = "Service No.";
  controlDiv.appendChild(serviceNumber);

  const appSettingsToggle = document.createElement("input");
  appSettingsToggle.setAttribute("type", "checkbox");
  appSettingsToggle.id = "appSettingsToggle";
  appSettingsToggle.style.marginRight = "8px";
  appSettingsToggle.name = "appSettingsToggle";
  const appSettingsToggleLabel = document.createElement("label");
  appSettingsToggleLabel.htmlFor = "appSettingsToggle";
  appSettingsToggleLabel.appendChild(
    document.createTextNode("Use App Settings")
  );
  appSettingsToggle.value = false;
  appSettingsToggle.onchange = function () {
    clearMarkers();
  };

  controlDiv.appendChild(appSettingsToggle);
  controlDiv.appendChild(appSettingsToggleLabel);

  serviceNumber.addEventListener("keyup", function () {
    event.preventDefault();
    const ENTER = 13;
    if (event.keyCode === ENTER) {
      changeCriteria();
    }
  });
}

function changeCriteria() {
  abortXhr();
  clearMarkers();
  locateBuses();
}

function clearMarkers() {
  for (let key in markers) {
    markers[key].setMap(null);
  }
  markers = {};
}

function loadXml(path, success, error) {
  const xhr = new XMLHttpRequest();
  xhr.responseType = "document";
  xhr.overrideMimeType("text/xml");
  xhr.onreadystatechange = function () {
    if (xhr.readyState === XMLHttpRequest.DONE) {
      if (xhr.status === 200) {
        if (success) success(xmlToObj(xhr.responseXML.documentElement));
      } else {
        if (error) error(xhr);
      }
      removeElement(xhrRequests, xhr);
    }
  };
  xhr.open("GET", path, true);
  xhr.send();
  xhrRequests.push(xhr);
}

function loadJSON(path, success, error) {
  const xhr = new XMLHttpRequest();
  xhr.onreadystatechange = function () {
    if (xhr.readyState === XMLHttpRequest.DONE) {
      if (xhr.status === 200) {
        if (success) success(JSON.parse(xhr.responseText));
      } else {
        if (error) error(xhr);
      }
      removeElement(xhrRequests, xhr);
    }
  };
  xhr.open("GET", path, true);
  xhr.send();
  xhrRequests.push(xhr);
}

function loadJSONPOST(path, request, success, error) {
  const xhr = new XMLHttpRequest();
  xhr.onreadystatechange = function () {
    if (xhr.readyState === XMLHttpRequest.DONE) {
      if (xhr.status === 200) {
        if (success) success(JSON.parse(xhr.responseText));
      } else {
        if (error) error(xhr);
      }
      removeElement(xhrRequests, xhr);
    }
  };
  xhr.open("POST", path, true);
  xhr.setRequestHeader("Content-Type", "application/json;charset=UTF-8");
  xhr.setRequestHeader("X-SC-apiKey", API_KEY);
  xhr.setRequestHeader("X-SC-securityMethod", "API");
  xhr.send(request);
  xhrRequests.push(xhr);
}

function abortXhr() {
  for (let i in xhrRequests) {
    xhrRequests[i].abort();
  }
  xhrRequests = [];
}

function removeElement(array, element) {
  const index = array.indexOf(element);
  if (index > -1) {
    array.splice(index, 1);
  }
}

function notSeenForSometime(bus) {
  const updatedTime = new Date(0);
  updatedTime.setUTCSeconds(bus[UPDATE_TIME] / 1000);
  const now = new Date();
  const diffMs = now - updatedTime;
  const notSeenForSometime = diffMs > 54000000 && !isOutOfService(bus);
  return notSeenForSometime;
}

function isMegabus(bus) {
  return (
    bus[FLEET_NUMBER] == "50450" ||
    bus[FLEET_NUMBER] == "50451" ||
    bus[FLEET_NUMBER] == "50501" ||
    bus[FLEET_NUMBER] == "50502" ||
    bus[FLEET_NUMBER] == "50503" ||
    bus[FLEET_NUMBER] == "50504" ||
    bus[FLEET_NUMBER] == "50505" ||
    bus[FLEET_NUMBER] == "50506" ||
    bus[FLEET_NUMBER] == "50507" ||
    bus[FLEET_NUMBER] == "50508" ||
    bus[FLEET_NUMBER] == "50509" ||
    bus[FLEET_NUMBER] == "50510" ||
    bus[FLEET_NUMBER] == "50511" ||
    bus[FLEET_NUMBER] == "50512" ||
    bus[FLEET_NUMBER] == "50513" ||
    bus[FLEET_NUMBER] == "50514" ||
    bus[FLEET_NUMBER] == "50515" ||
    bus[FLEET_NUMBER] == "50516" ||
    bus[FLEET_NUMBER] == "50517" ||
    bus[FLEET_NUMBER] == "50518" ||
    bus[FLEET_NUMBER] == "50519" ||
    bus[FLEET_NUMBER] == "50520" ||
    bus[FLEET_NUMBER] == "50521" ||
    bus[FLEET_NUMBER] == "50522" ||
    bus[FLEET_NUMBER] == "50523" ||
    bus[FLEET_NUMBER] == "50524" ||
    bus[FLEET_NUMBER] == "50525" ||
    bus[FLEET_NUMBER] == "50526" ||
    bus[FLEET_NUMBER] == "50527" ||
    bus[FLEET_NUMBER] == "50528" ||
    bus[FLEET_NUMBER] == "50529" ||
    bus[FLEET_NUMBER] == "50530" ||
    bus[FLEET_NUMBER] == "54214" ||
    bus[FLEET_NUMBER] == "54218" ||
    bus[FLEET_NUMBER] == "54219" ||
    bus[FLEET_NUMBER] == "54221" ||
    bus[FLEET_NUMBER] == "54258" ||
    bus[FLEET_NUMBER] == "54259" ||
    bus[FLEET_NUMBER] == "54260" ||
    bus[FLEET_NUMBER] == "54261" ||
    bus[FLEET_NUMBER] == "54262" ||
    bus[FLEET_NUMBER] == "54263" ||
    bus[FLEET_NUMBER] == "54277" ||
    bus[FLEET_NUMBER] == "54278" ||
    bus[FLEET_NUMBER] == "54280" ||
    bus[FLEET_NUMBER] == "54301" ||
    bus[FLEET_NUMBER] == "54302" ||
    bus[FLEET_NUMBER] == "54303" ||
    bus[FLEET_NUMBER] == "54362" ||
    bus[FLEET_NUMBER] == "54363" ||
    bus[FLEET_NUMBER] == "54366" ||
    bus[FLEET_NUMBER] == "54367" ||
    bus[FLEET_NUMBER] == "54368"
  );
}

// PHOTO REQUIREMENTS

function isBRequirement(bus) {
  return (
    // BLUEBIRD 08/03/25
    bus[FLEET_NUMBER] == "10525" ||
    bus[FLEET_NUMBER] == "11161" ||
    bus[FLEET_NUMBER] == "11168" ||
    bus[FLEET_NUMBER] == "11174" ||
    bus[FLEET_NUMBER] == "11781" ||
    bus[FLEET_NUMBER] == "11782" ||
    bus[FLEET_NUMBER] == "11783" ||
    bus[FLEET_NUMBER] == "11784" ||
    bus[FLEET_NUMBER] == "11785" ||
    bus[FLEET_NUMBER] == "11786" ||
    bus[FLEET_NUMBER] == "11787" ||
    bus[FLEET_NUMBER] == "11788" ||
    bus[FLEET_NUMBER] == "11789" ||
    bus[FLEET_NUMBER] == "11790" ||
    bus[FLEET_NUMBER] == "11791" ||
    bus[FLEET_NUMBER] == "11792" ||
    bus[FLEET_NUMBER] == "11793" ||
    bus[FLEET_NUMBER] == "11794" ||
    bus[FLEET_NUMBER] == "11795" ||
    bus[FLEET_NUMBER] == "11796" ||
    bus[FLEET_NUMBER] == "11797" ||
    bus[FLEET_NUMBER] == "19173" ||
    bus[FLEET_NUMBER] == "19176" ||
    bus[FLEET_NUMBER] == "19214" ||
    bus[FLEET_NUMBER] == "19216" ||
    bus[FLEET_NUMBER] == "19217" ||
    bus[FLEET_NUMBER] == "19219" ||
    bus[FLEET_NUMBER] == "19372" ||
    bus[FLEET_NUMBER] == "21369" ||
    bus[FLEET_NUMBER] == "21370" ||
    bus[FLEET_NUMBER] == "21371" ||
    bus[FLEET_NUMBER] == "21372" ||
    bus[FLEET_NUMBER] == "21373" ||
    bus[FLEET_NUMBER] == "21374" ||
    bus[FLEET_NUMBER] == "21375" ||
    bus[FLEET_NUMBER] == "21376" ||
    bus[FLEET_NUMBER] == "21377" ||
    bus[FLEET_NUMBER] == "21378" ||
    bus[FLEET_NUMBER] == "21379" ||
    bus[FLEET_NUMBER] == "21380" ||
    bus[FLEET_NUMBER] == "21381" ||
    bus[FLEET_NUMBER] == "21382" ||
    bus[FLEET_NUMBER] == "21383" ||
    bus[FLEET_NUMBER] == "21384" ||
    bus[FLEET_NUMBER] == "21385" ||
    bus[FLEET_NUMBER] == "21386" ||
    bus[FLEET_NUMBER] == "21387" ||
    bus[FLEET_NUMBER] == "21389" ||
    bus[FLEET_NUMBER] == "21390" ||
    bus[FLEET_NUMBER] == "21391" ||
    bus[FLEET_NUMBER] == "21392" ||
    bus[FLEET_NUMBER] == "21393" ||
    bus[FLEET_NUMBER] == "21394" ||
    bus[FLEET_NUMBER] == "21395" ||
    bus[FLEET_NUMBER] == "21396" ||
    bus[FLEET_NUMBER] == "21397" ||
    bus[FLEET_NUMBER] == "21398" ||
    bus[FLEET_NUMBER] == "21401" ||
    bus[FLEET_NUMBER] == "21402" ||
    bus[FLEET_NUMBER] == "21403" ||
    bus[FLEET_NUMBER] == "21404" ||
    bus[FLEET_NUMBER] == "21405" ||
    bus[FLEET_NUMBER] == "21406" ||
    bus[FLEET_NUMBER] == "21407" ||
    bus[FLEET_NUMBER] == "21409" ||
    bus[FLEET_NUMBER] == "21410" ||
    bus[FLEET_NUMBER] == "21411" ||
    bus[FLEET_NUMBER] == "21412" ||
    bus[FLEET_NUMBER] == "21413" ||
    bus[FLEET_NUMBER] == "21414" ||
    bus[FLEET_NUMBER] == "21415" ||
    bus[FLEET_NUMBER] == "21416" ||
    bus[FLEET_NUMBER] == "26127" ||
    bus[FLEET_NUMBER] == "26128" ||
    bus[FLEET_NUMBER] == "26129" ||
    bus[FLEET_NUMBER] == "26131" ||
    bus[FLEET_NUMBER] == "26132" ||
    bus[FLEET_NUMBER] == "26133" ||
    bus[FLEET_NUMBER] == "26134" ||
    bus[FLEET_NUMBER] == "27104" ||
    bus[FLEET_NUMBER] == "27803" ||
    bus[FLEET_NUMBER] == "27807" ||
    bus[FLEET_NUMBER] == "27808" ||
    bus[FLEET_NUMBER] == "28644" ||
    bus[FLEET_NUMBER] == "36046" ||
    bus[FLEET_NUMBER] == "36066" ||
    bus[FLEET_NUMBER] == "36956" ||
    bus[FLEET_NUMBER] == "36957" ||
    bus[FLEET_NUMBER] == "36958" ||
    bus[FLEET_NUMBER] == "36959" ||
    bus[FLEET_NUMBER] == "37256" ||
    bus[FLEET_NUMBER] == "37257" ||
    bus[FLEET_NUMBER] == "37258" ||
    bus[FLEET_NUMBER] == "37259" ||
    bus[FLEET_NUMBER] == "39501" ||
    bus[FLEET_NUMBER] == "39502" ||
    bus[FLEET_NUMBER] == "39503" ||
    bus[FLEET_NUMBER] == "39504" ||
    bus[FLEET_NUMBER] == "39505" ||
    bus[FLEET_NUMBER] == "39506" ||
    bus[FLEET_NUMBER] == "39507" ||
    bus[FLEET_NUMBER] == "39508" ||
    bus[FLEET_NUMBER] == "39509" ||
    bus[FLEET_NUMBER] == "39510" ||
    bus[FLEET_NUMBER] == "39511" ||
    bus[FLEET_NUMBER] == "44060" ||
    bus[FLEET_NUMBER] == "44061" ||
    bus[FLEET_NUMBER] == "47813" ||
    bus[FLEET_NUMBER] == "48051" ||
    bus[FLEET_NUMBER] == "48052" ||
    bus[FLEET_NUMBER] == "48053" ||
    bus[FLEET_NUMBER] == "48054" ||
    bus[FLEET_NUMBER] == "48055" ||
    bus[FLEET_NUMBER] == "48056" ||
    bus[FLEET_NUMBER] == "48057" ||
    bus[FLEET_NUMBER] == "48058" ||
    bus[FLEET_NUMBER] == "48059" ||
    bus[FLEET_NUMBER] == "50518" ||
    bus[FLEET_NUMBER] == "50519" ||
    bus[FLEET_NUMBER] == "50521" ||
    bus[FLEET_NUMBER] == "50522" ||
    bus[FLEET_NUMBER] == "50523" ||
    bus[FLEET_NUMBER] == "53107" ||
    bus[FLEET_NUMBER] == "53110" ||
    bus[FLEET_NUMBER] == "53112" ||
    bus[FLEET_NUMBER] == "53613" ||
    bus[FLEET_NUMBER] == "53705" ||
    bus[FLEET_NUMBER] == "53708" ||
    bus[FLEET_NUMBER] == "53716" ||
    bus[FLEET_NUMBER] == "54133" ||
    bus[FLEET_NUMBER] == "54210" ||
    bus[FLEET_NUMBER] == "54218" ||
    bus[FLEET_NUMBER] == "54219" ||
    bus[FLEET_NUMBER] == "54221" ||
    bus[FLEET_NUMBER] == "54263" ||
    bus[FLEET_NUMBER] == "54272" ||
    bus[FLEET_NUMBER] == "54301" ||
    bus[FLEET_NUMBER] == "54303" ||
    bus[FLEET_NUMBER] == "54310" ||
    bus[FLEET_NUMBER] == "54320" ||
    bus[FLEET_NUMBER] == "54322" ||
    bus[FLEET_NUMBER] == "54324" ||
    bus[FLEET_NUMBER] == "54821" ||
    bus[FLEET_NUMBER] == "54822" ||
    bus[FLEET_NUMBER] == "54823" ||
    bus[FLEET_NUMBER] == "54824" ||
    bus[FLEET_NUMBER] == "57001" ||
    bus[FLEET_NUMBER] == "57002" ||
    bus[FLEET_NUMBER] == "57003" ||
    bus[FLEET_NUMBER] == "57004" ||
    bus[FLEET_NUMBER] == "57005" ||
    bus[FLEET_NUMBER] == "57006" ||
    bus[FLEET_NUMBER] == "59001" ||
    bus[FLEET_NUMBER] == "59002" ||
    bus[FLEET_NUMBER] == "59003" ||
    bus[FLEET_NUMBER] == "59101" ||
    bus[FLEET_NUMBER] == "59102" ||
    bus[FLEET_NUMBER] == "59103" ||
    bus[FLEET_NUMBER] == "59104" ||
    bus[FLEET_NUMBER] == "59105" ||
    bus[FLEET_NUMBER] == "59106" ||
    bus[FLEET_NUMBER] == "63101" ||
    bus[FLEET_NUMBER] == "63102" ||
    bus[FLEET_NUMBER] == "63103" ||
    bus[FLEET_NUMBER] == "63104" ||
    bus[FLEET_NUMBER] == "63105" ||
    bus[FLEET_NUMBER] == "63106" ||
    bus[FLEET_NUMBER] == "63107" ||
    bus[FLEET_NUMBER] == "63108" ||
    bus[FLEET_NUMBER] == "63109" ||
    bus[FLEET_NUMBER] == "63110" ||
    bus[FLEET_NUMBER] == "63111" ||
    bus[FLEET_NUMBER] == "63112" ||
    bus[FLEET_NUMBER] == "63113" ||
    bus[FLEET_NUMBER] == "63114" ||
    bus[FLEET_NUMBER] == "63115" ||
    bus[FLEET_NUMBER] == "63116" ||
    bus[FLEET_NUMBER] == "63117" ||
    bus[FLEET_NUMBER] == "63118" ||
    bus[FLEET_NUMBER] == "63119" ||
    bus[FLEET_NUMBER] == "63120" ||
    bus[FLEET_NUMBER] == "63121" ||
    bus[FLEET_NUMBER] == "63122" ||
    bus[FLEET_NUMBER] == "63123" ||
    bus[FLEET_NUMBER] == "63124" ||
    bus[FLEET_NUMBER] == "63125" ||
    bus[FLEET_NUMBER] == "84057" ||
    bus[FLEET_NUMBER] == "84058" ||
    bus[FLEET_NUMBER] == "84065" ||
    bus[FLEET_NUMBER] == "84066" ||
    // EAST SCOTLAND 08/03/25
    bus[FLEET_NUMBER] == "10675" ||
    bus[FLEET_NUMBER] == "10677" ||
    bus[FLEET_NUMBER] == "11534" ||
    bus[FLEET_NUMBER] == "11536" ||
    bus[FLEET_NUMBER] == "15462" ||
    bus[FLEET_NUMBER] == "15465" ||
    bus[FLEET_NUMBER] == "15643" ||
    bus[FLEET_NUMBER] == "15733" ||
    bus[FLEET_NUMBER] == "19038" ||
    bus[FLEET_NUMBER] == "19394" ||
    bus[FLEET_NUMBER] == "19631" ||
    bus[FLEET_NUMBER] == "19635" ||
    bus[FLEET_NUMBER] == "21433" ||
    bus[FLEET_NUMBER] == "21434" ||
    bus[FLEET_NUMBER] == "21437" ||
    bus[FLEET_NUMBER] == "28602" ||
    bus[FLEET_NUMBER] == "28645" ||
    bus[FLEET_NUMBER] == "28650" ||
    bus[FLEET_NUMBER] == "46019" ||
    bus[FLEET_NUMBER] == "46020" ||
    bus[FLEET_NUMBER] == "50511" ||
    bus[FLEET_NUMBER] == "50515" ||
    bus[FLEET_NUMBER] == "50516" ||
    bus[FLEET_NUMBER] == "50517" ||
    bus[FLEET_NUMBER] == "50536" ||
    bus[FLEET_NUMBER] == "50537" ||
    bus[FLEET_NUMBER] == "50541" ||
    bus[FLEET_NUMBER] == "50543" ||
    bus[FLEET_NUMBER] == "50544" ||
    bus[FLEET_NUMBER] == "76127" ||
    bus[FLEET_NUMBER] == "76128" ||
    bus[FLEET_NUMBER] == "76129" ||
    bus[FLEET_NUMBER] == "76130" ||
    bus[FLEET_NUMBER] == "76131" ||
    bus[FLEET_NUMBER] == "76132" ||
    bus[FLEET_NUMBER] == "76133" ||
    bus[FLEET_NUMBER] == "76134" ||
    bus[FLEET_NUMBER] == "76135" ||
    bus[FLEET_NUMBER] == "76136" ||
    bus[FLEET_NUMBER] == "76137" ||
    bus[FLEET_NUMBER] == "76138" ||
    bus[FLEET_NUMBER] == "76139" ||
    bus[FLEET_NUMBER] == "76140" ||
    bus[FLEET_NUMBER] == "76141" ||
    bus[FLEET_NUMBER] == "76142" ||
    bus[FLEET_NUMBER] == "76143" ||
    bus[FLEET_NUMBER] == "76144" ||
    bus[FLEET_NUMBER] == "76145" ||
    bus[FLEET_NUMBER] == "76146" ||
    bus[FLEET_NUMBER] == "76147" ||
    bus[FLEET_NUMBER] == "76148" ||
    bus[FLEET_NUMBER] == "80211" ||
    bus[FLEET_NUMBER] == "80212" ||
    bus[FLEET_NUMBER] == "80213" ||
    bus[FLEET_NUMBER] == "80215" ||
    bus[FLEET_NUMBER] == "80217" ||
    bus[FLEET_NUMBER] == "80223" ||
    bus[FLEET_NUMBER] == "80226" ||
    bus[FLEET_NUMBER] == "84071" ||
    // WEST SCOTLAND 08/03/25
    bus[FLEET_NUMBER] == "10521" ||
    bus[FLEET_NUMBER] == "22388" ||
    bus[FLEET_NUMBER] == "24189" ||
    bus[FLEET_NUMBER] == "24191" ||
    bus[FLEET_NUMBER] == "25245" ||
    bus[FLEET_NUMBER] == "27580" ||
    bus[FLEET_NUMBER] == "27721" ||
    bus[FLEET_NUMBER] == "27814" ||
    bus[FLEET_NUMBER] == "28704" ||
    bus[FLEET_NUMBER] == "28706" ||
    bus[FLEET_NUMBER] == "28707" ||
    bus[FLEET_NUMBER] == "36140" ||
    bus[FLEET_NUMBER] == "36141" ||
    bus[FLEET_NUMBER] == "36143" ||
    bus[FLEET_NUMBER] == "36145" ||
    bus[FLEET_NUMBER] == "36147" ||
    bus[FLEET_NUMBER] == "36152" ||
    bus[FLEET_NUMBER] == "36332" ||
    bus[FLEET_NUMBER] == "36704" ||
    bus[FLEET_NUMBER] == "36739" ||
    bus[FLEET_NUMBER] == "36740" ||
    bus[FLEET_NUMBER] == "36745" ||
    bus[FLEET_NUMBER] == "37247" ||
    bus[FLEET_NUMBER] == "37248" ||
    bus[FLEET_NUMBER] == "37486" ||
    bus[FLEET_NUMBER] == "39001" ||
    bus[FLEET_NUMBER] == "39002" ||
    bus[FLEET_NUMBER] == "39003" ||
    bus[FLEET_NUMBER] == "39004" ||
    bus[FLEET_NUMBER] == "39005" ||
    bus[FLEET_NUMBER] == "39006" ||
    bus[FLEET_NUMBER] == "39007" ||
    bus[FLEET_NUMBER] == "39008" ||
    bus[FLEET_NUMBER] == "46001" ||
    bus[FLEET_NUMBER] == "46010" ||
    bus[FLEET_NUMBER] == "47002" ||
    bus[FLEET_NUMBER] == "47388" ||
    bus[FLEET_NUMBER] == "47460" ||
    bus[FLEET_NUMBER] == "47651" ||
    bus[FLEET_NUMBER] == "47746" ||
    bus[FLEET_NUMBER] == "47822" ||
    bus[FLEET_NUMBER] == "47828" ||
    bus[FLEET_NUMBER] == "47829" ||
    bus[FLEET_NUMBER] == "47830" ||
    bus[FLEET_NUMBER] == "47835" ||
    bus[FLEET_NUMBER] == "47837" ||
    bus[FLEET_NUMBER] == "47839" ||
    bus[FLEET_NUMBER] == "47840" ||
    bus[FLEET_NUMBER] == "47841" ||
    bus[FLEET_NUMBER] == "47843" ||
    bus[FLEET_NUMBER] == "47844" ||
    bus[FLEET_NUMBER] == "47846" ||
    bus[FLEET_NUMBER] == "47877" ||
    bus[FLEET_NUMBER] == "47878" ||
    bus[FLEET_NUMBER] == "47914" ||
    bus[FLEET_NUMBER] == "47934" ||
    bus[FLEET_NUMBER] == "47935" ||
    bus[FLEET_NUMBER] == "47936" ||
    bus[FLEET_NUMBER] == "47937" ||
    bus[FLEET_NUMBER] == "47939" ||
    bus[FLEET_NUMBER] == "48021" ||
    bus[FLEET_NUMBER] == "48044" ||
    bus[FLEET_NUMBER] == "48045" ||
    bus[FLEET_NUMBER] == "48127" ||
    bus[FLEET_NUMBER] == "50286" ||
    bus[FLEET_NUMBER] == "50406" ||
    bus[FLEET_NUMBER] == "50501" ||
    bus[FLEET_NUMBER] == "50502" ||
    bus[FLEET_NUMBER] == "50504" ||
    bus[FLEET_NUMBER] == "50508" ||
    bus[FLEET_NUMBER] == "50509" ||
    bus[FLEET_NUMBER] == "50510" ||
    bus[FLEET_NUMBER] == "50525" ||
    bus[FLEET_NUMBER] == "50527" ||
    bus[FLEET_NUMBER] == "50528" ||
    bus[FLEET_NUMBER] == "53709" ||
    bus[FLEET_NUMBER] == "53711" ||
    bus[FLEET_NUMBER] == "53712" ||
    bus[FLEET_NUMBER] == "53723" ||
    bus[FLEET_NUMBER] == "54212" ||
    bus[FLEET_NUMBER] == "54215" ||
    bus[FLEET_NUMBER] == "54265" ||
    bus[FLEET_NUMBER] == "54271" ||
    bus[FLEET_NUMBER] == "64005" ||
    bus[FLEET_NUMBER] == "64033" ||
    bus[FLEET_NUMBER] == "64034" ||
    bus[FLEET_NUMBER] == "66001" ||
    bus[FLEET_NUMBER] == "66014" ||
    bus[FLEET_NUMBER] == "66022" ||
    bus[FLEET_NUMBER] == "66024" ||
    bus[FLEET_NUMBER] == "76121" ||
    bus[FLEET_NUMBER] == "76122" ||
    bus[FLEET_NUMBER] == "76123" ||
    bus[FLEET_NUMBER] == "76124" ||
    bus[FLEET_NUMBER] == "76125" ||
    bus[FLEET_NUMBER] == "76126" ||
    bus[FLEET_NUMBER] == "80185" ||
    bus[FLEET_NUMBER] == "80186" ||
    bus[FLEET_NUMBER] == "80187" ||
    bus[FLEET_NUMBER] == "80188" ||
    bus[FLEET_NUMBER] == "80189" ||
    bus[FLEET_NUMBER] == "80190" ||
    bus[FLEET_NUMBER] == "80191" ||
    bus[FLEET_NUMBER] == "80192" ||
    bus[FLEET_NUMBER] == "80193" ||
    bus[FLEET_NUMBER] == "80194" ||
    bus[FLEET_NUMBER] == "80195" ||
    bus[FLEET_NUMBER] == "80196" ||
    bus[FLEET_NUMBER] == "80197" ||
    bus[FLEET_NUMBER] == "80198" ||
    bus[FLEET_NUMBER] == "80199" ||
    bus[FLEET_NUMBER] == "80200" ||
    bus[FLEET_NUMBER] == "80201" ||
    bus[FLEET_NUMBER] == "80202" ||
    bus[FLEET_NUMBER] == "80203" ||
    bus[FLEET_NUMBER] == "80204" ||
    bus[FLEET_NUMBER] == "80205" ||
    bus[FLEET_NUMBER] == "80206" ||
    bus[FLEET_NUMBER] == "80207" ||
    bus[FLEET_NUMBER] == "80208" ||
    bus[FLEET_NUMBER] == "80209" ||
    bus[FLEET_NUMBER] == "80210" ||
    // NORTH EAST 08/03/25
    bus[FLEET_NUMBER] == "10484" ||
    bus[FLEET_NUMBER] == "10579" ||
    bus[FLEET_NUMBER] == "10580" ||
    bus[FLEET_NUMBER] == "10644" ||
    bus[FLEET_NUMBER] == "11281" ||
    bus[FLEET_NUMBER] == "11282" ||
    bus[FLEET_NUMBER] == "11283" ||
    bus[FLEET_NUMBER] == "11284" ||
    bus[FLEET_NUMBER] == "11285" ||
    bus[FLEET_NUMBER] == "11286" ||
    bus[FLEET_NUMBER] == "11287" ||
    bus[FLEET_NUMBER] == "11288" ||
    bus[FLEET_NUMBER] == "11289" ||
    bus[FLEET_NUMBER] == "11290" ||
    bus[FLEET_NUMBER] == "11291" ||
    bus[FLEET_NUMBER] == "11292" ||
    bus[FLEET_NUMBER] == "11293" ||
    bus[FLEET_NUMBER] == "11294" ||
    bus[FLEET_NUMBER] == "11295" ||
    bus[FLEET_NUMBER] == "11296" ||
    bus[FLEET_NUMBER] == "11297" ||
    bus[FLEET_NUMBER] == "11298" ||
    bus[FLEET_NUMBER] == "11299" ||
    bus[FLEET_NUMBER] == "11300" ||
    bus[FLEET_NUMBER] == "11501" ||
    bus[FLEET_NUMBER] == "11607" ||
    bus[FLEET_NUMBER] == "11608" ||
    bus[FLEET_NUMBER] == "11609" ||
    bus[FLEET_NUMBER] == "11610" ||
    bus[FLEET_NUMBER] == "11611" ||
    bus[FLEET_NUMBER] == "11612" ||
    bus[FLEET_NUMBER] == "11613" ||
    bus[FLEET_NUMBER] == "11614" ||
    bus[FLEET_NUMBER] == "11615" ||
    bus[FLEET_NUMBER] == "11616" ||
    bus[FLEET_NUMBER] == "11617" ||
    bus[FLEET_NUMBER] == "11618" ||
    bus[FLEET_NUMBER] == "11619" ||
    bus[FLEET_NUMBER] == "11620" ||
    bus[FLEET_NUMBER] == "11718" ||
    bus[FLEET_NUMBER] == "11719" ||
    bus[FLEET_NUMBER] == "11770" ||
    bus[FLEET_NUMBER] == "11771" ||
    bus[FLEET_NUMBER] == "11772" ||
    bus[FLEET_NUMBER] == "11773" ||
    bus[FLEET_NUMBER] == "11774" ||
    bus[FLEET_NUMBER] == "11775" ||
    bus[FLEET_NUMBER] == "11776" ||
    bus[FLEET_NUMBER] == "11777" ||
    bus[FLEET_NUMBER] == "11778" ||
    bus[FLEET_NUMBER] == "11779" ||
    bus[FLEET_NUMBER] == "11780" ||
    bus[FLEET_NUMBER] == "17239" ||
    bus[FLEET_NUMBER] == "17240" ||
    bus[FLEET_NUMBER] == "17643" ||
    bus[FLEET_NUMBER] == "17645" ||
    bus[FLEET_NUMBER] == "18418" ||
    bus[FLEET_NUMBER] == "19440" ||
    bus[FLEET_NUMBER] == "22071" ||
    bus[FLEET_NUMBER] == "22072" ||
    bus[FLEET_NUMBER] == "22073" ||
    bus[FLEET_NUMBER] == "22075" ||
    bus[FLEET_NUMBER] == "22076" ||
    bus[FLEET_NUMBER] == "24110" ||
    bus[FLEET_NUMBER] == "24111" ||
    bus[FLEET_NUMBER] == "24116" ||
    bus[FLEET_NUMBER] == "24117" ||
    bus[FLEET_NUMBER] == "24119" ||
    bus[FLEET_NUMBER] == "24120" ||
    bus[FLEET_NUMBER] == "24121" ||
    bus[FLEET_NUMBER] == "24122" ||
    bus[FLEET_NUMBER] == "24123" ||
    bus[FLEET_NUMBER] == "24169" ||
    bus[FLEET_NUMBER] == "26276" ||
    bus[FLEET_NUMBER] == "26277" ||
    bus[FLEET_NUMBER] == "26279" ||
    bus[FLEET_NUMBER] == "26280" ||
    bus[FLEET_NUMBER] == "26281" ||
    bus[FLEET_NUMBER] == "26282" ||
    bus[FLEET_NUMBER] == "26283" ||
    bus[FLEET_NUMBER] == "26284" ||
    bus[FLEET_NUMBER] == "26285" ||
    bus[FLEET_NUMBER] == "26286" ||
    bus[FLEET_NUMBER] == "26287" ||
    bus[FLEET_NUMBER] == "26288" ||
    bus[FLEET_NUMBER] == "26290" ||
    bus[FLEET_NUMBER] == "26291" ||
    bus[FLEET_NUMBER] == "27168" ||
    bus[FLEET_NUMBER] == "27173" ||
    bus[FLEET_NUMBER] == "27175" ||
    bus[FLEET_NUMBER] == "27180" ||
    bus[FLEET_NUMBER] == "27247" ||
    bus[FLEET_NUMBER] == "27248" ||
    bus[FLEET_NUMBER] == "27509" ||
    bus[FLEET_NUMBER] == "27631" ||
    bus[FLEET_NUMBER] == "27632" ||
    bus[FLEET_NUMBER] == "27688" ||
    bus[FLEET_NUMBER] == "27698" ||
    bus[FLEET_NUMBER] == "27699" ||
    bus[FLEET_NUMBER] == "27717" ||
    bus[FLEET_NUMBER] == "27718" ||
    bus[FLEET_NUMBER] == "27728" ||
    bus[FLEET_NUMBER] == "27729" ||
    bus[FLEET_NUMBER] == "27731" ||
    bus[FLEET_NUMBER] == "27732" ||
    bus[FLEET_NUMBER] == "27736" ||
    bus[FLEET_NUMBER] == "27739" ||
    bus[FLEET_NUMBER] == "27740" ||
    bus[FLEET_NUMBER] == "27770" ||
    bus[FLEET_NUMBER] == "27771" ||
    bus[FLEET_NUMBER] == "27812" ||
    bus[FLEET_NUMBER] == "27817" ||
    bus[FLEET_NUMBER] == "27818" ||
    bus[FLEET_NUMBER] == "27819" ||
    bus[FLEET_NUMBER] == "27820" ||
    bus[FLEET_NUMBER] == "27821" ||
    bus[FLEET_NUMBER] == "27822" ||
    bus[FLEET_NUMBER] == "27823" ||
    bus[FLEET_NUMBER] == "27913" ||
    bus[FLEET_NUMBER] == "27914" ||
    bus[FLEET_NUMBER] == "28004" ||
    bus[FLEET_NUMBER] == "28006" ||
    bus[FLEET_NUMBER] == "28007" ||
    bus[FLEET_NUMBER] == "28008" ||
    bus[FLEET_NUMBER] == "28010" ||
    bus[FLEET_NUMBER] == "28012" ||
    bus[FLEET_NUMBER] == "28013" ||
    bus[FLEET_NUMBER] == "28014" ||
    bus[FLEET_NUMBER] == "28015" ||
    bus[FLEET_NUMBER] == "28019" ||
    bus[FLEET_NUMBER] == "28022" ||
    bus[FLEET_NUMBER] == "28023" ||
    bus[FLEET_NUMBER] == "28025" ||
    bus[FLEET_NUMBER] == "28026" ||
    bus[FLEET_NUMBER] == "28027" ||
    bus[FLEET_NUMBER] == "28028" ||
    bus[FLEET_NUMBER] == "28030" ||
    bus[FLEET_NUMBER] == "34605" ||
    bus[FLEET_NUMBER] == "34611" ||
    bus[FLEET_NUMBER] == "34833" ||
    bus[FLEET_NUMBER] == "35222" ||
    bus[FLEET_NUMBER] == "35224" ||
    bus[FLEET_NUMBER] == "35231" ||
    bus[FLEET_NUMBER] == "35234" ||
    bus[FLEET_NUMBER] == "35236" ||
    bus[FLEET_NUMBER] == "35261" ||
    bus[FLEET_NUMBER] == "36050" ||
    bus[FLEET_NUMBER] == "36081" ||
    bus[FLEET_NUMBER] == "36082" ||
    bus[FLEET_NUMBER] == "36083" ||
    bus[FLEET_NUMBER] == "36084" ||
    bus[FLEET_NUMBER] == "36085" ||
    bus[FLEET_NUMBER] == "36086" ||
    bus[FLEET_NUMBER] == "36087" ||
    bus[FLEET_NUMBER] == "36088" ||
    bus[FLEET_NUMBER] == "36091" ||
    bus[FLEET_NUMBER] == "36093" ||
    bus[FLEET_NUMBER] == "36286" ||
    bus[FLEET_NUMBER] == "36287" ||
    bus[FLEET_NUMBER] == "36291" ||
    bus[FLEET_NUMBER] == "36293" ||
    bus[FLEET_NUMBER] == "36294" ||
    bus[FLEET_NUMBER] == "36341" ||
    bus[FLEET_NUMBER] == "36345" ||
    bus[FLEET_NUMBER] == "36349" ||
    bus[FLEET_NUMBER] == "36361" ||
    bus[FLEET_NUMBER] == "36363" ||
    bus[FLEET_NUMBER] == "36367" ||
    bus[FLEET_NUMBER] == "36461" ||
    bus[FLEET_NUMBER] == "36462" ||
    bus[FLEET_NUMBER] == "36463" ||
    bus[FLEET_NUMBER] == "36464" ||
    bus[FLEET_NUMBER] == "36465" ||
    bus[FLEET_NUMBER] == "36466" ||
    bus[FLEET_NUMBER] == "36467" ||
    bus[FLEET_NUMBER] == "36960" ||
    bus[FLEET_NUMBER] == "36961" ||
    bus[FLEET_NUMBER] == "36962" ||
    bus[FLEET_NUMBER] == "36964" ||
    bus[FLEET_NUMBER] == "36965" ||
    bus[FLEET_NUMBER] == "36966" ||
    bus[FLEET_NUMBER] == "36968" ||
    bus[FLEET_NUMBER] == "36969" ||
    bus[FLEET_NUMBER] == "36970" ||
    bus[FLEET_NUMBER] == "36971" ||
    bus[FLEET_NUMBER] == "36972" ||
    bus[FLEET_NUMBER] == "36973" ||
    bus[FLEET_NUMBER] == "36974" ||
    bus[FLEET_NUMBER] == "36976" ||
    bus[FLEET_NUMBER] == "36979" ||
    bus[FLEET_NUMBER] == "36980" ||
    bus[FLEET_NUMBER] == "37143" ||
    bus[FLEET_NUMBER] == "37144" ||
    bus[FLEET_NUMBER] == "37302" ||
    bus[FLEET_NUMBER] == "37303" ||
    bus[FLEET_NUMBER] == "37306" ||
    bus[FLEET_NUMBER] == "37308" ||
    bus[FLEET_NUMBER] == "37309" ||
    bus[FLEET_NUMBER] == "37310" ||
    bus[FLEET_NUMBER] == "37311" ||
    bus[FLEET_NUMBER] == "37313" ||
    bus[FLEET_NUMBER] == "37317" ||
    bus[FLEET_NUMBER] == "37318" ||
    bus[FLEET_NUMBER] == "39715" ||
    bus[FLEET_NUMBER] == "39726" ||
    bus[FLEET_NUMBER] == "44005" ||
    bus[FLEET_NUMBER] == "44006" ||
    bus[FLEET_NUMBER] == "44031" ||
    bus[FLEET_NUMBER] == "44032" ||
    bus[FLEET_NUMBER] == "44033" ||
    bus[FLEET_NUMBER] == "44034" ||
    bus[FLEET_NUMBER] == "44035" ||
    bus[FLEET_NUMBER] == "44053" ||
    bus[FLEET_NUMBER] == "54269" ||
    bus[FLEET_NUMBER] == "54270" ||
    bus[FLEET_NUMBER] == "54281" ||
    bus[FLEET_NUMBER] == "54289" ||
    bus[FLEET_NUMBER] == "54290" ||
    bus[FLEET_NUMBER] == "54601" ||
    bus[FLEET_NUMBER] == "59223" ||
    bus[FLEET_NUMBER] == "59226" ||
    bus[FLEET_NUMBER] == "73057" ||
    bus[FLEET_NUMBER] == "73058" ||
    bus[FLEET_NUMBER] == "73059" ||
    bus[FLEET_NUMBER] == "73060" ||
    bus[FLEET_NUMBER] == "73061" ||
    bus[FLEET_NUMBER] == "73062" ||
    bus[FLEET_NUMBER] == "73063" ||
    bus[FLEET_NUMBER] == "73064" ||
    bus[FLEET_NUMBER] == "73065" ||
    bus[FLEET_NUMBER] == "73066" ||
    bus[FLEET_NUMBER] == "73067" ||
    bus[FLEET_NUMBER] == "73068" ||
    bus[FLEET_NUMBER] == "73069" ||
    bus[FLEET_NUMBER] == "73070" ||
    bus[FLEET_NUMBER] == "73071" ||
    bus[FLEET_NUMBER] == "73072" ||
    bus[FLEET_NUMBER] == "73073" ||
    bus[FLEET_NUMBER] == "73074" ||
    bus[FLEET_NUMBER] == "73075" ||
    bus[FLEET_NUMBER] == "73076" ||
    bus[FLEET_NUMBER] == "73089" ||
    bus[FLEET_NUMBER] == "73090" ||
    bus[FLEET_NUMBER] == "73091" ||
    bus[FLEET_NUMBER] == "73092" ||
    bus[FLEET_NUMBER] == "73093" ||
    bus[FLEET_NUMBER] == "73094" ||
    bus[FLEET_NUMBER] == "73095" ||
    bus[FLEET_NUMBER] == "73096" ||
    bus[FLEET_NUMBER] == "73097" ||
    bus[FLEET_NUMBER] == "73098" ||
    bus[FLEET_NUMBER] == "73099" ||
    bus[FLEET_NUMBER] == "73100" ||
    bus[FLEET_NUMBER] == "73101" ||
    bus[FLEET_NUMBER] == "73102" ||
    bus[FLEET_NUMBER] == "73103" ||
    bus[FLEET_NUMBER] == "73104" ||
    bus[FLEET_NUMBER] == "73105" ||
    bus[FLEET_NUMBER] == "73106" ||
    bus[FLEET_NUMBER] == "73132" ||
    bus[FLEET_NUMBER] == "73133" ||
    bus[FLEET_NUMBER] == "73134" ||
    bus[FLEET_NUMBER] == "73135" ||
    bus[FLEET_NUMBER] == "73136" ||
    bus[FLEET_NUMBER] == "73137" ||
    bus[FLEET_NUMBER] == "73138" ||
    bus[FLEET_NUMBER] == "73139" ||
    bus[FLEET_NUMBER] == "73140" ||
    bus[FLEET_NUMBER] == "73141" ||
    bus[FLEET_NUMBER] == "73142" ||
    bus[FLEET_NUMBER] == "73143" ||
    bus[FLEET_NUMBER] == "73144" ||
    bus[FLEET_NUMBER] == "73145" ||
    bus[FLEET_NUMBER] == "73146" ||
    bus[FLEET_NUMBER] == "73147" ||
    bus[FLEET_NUMBER] == "73148" ||
    bus[FLEET_NUMBER] == "73149" ||
    bus[FLEET_NUMBER] == "73150" ||
    bus[FLEET_NUMBER] == "73151" ||
    bus[FLEET_NUMBER] == "73152" ||
    bus[FLEET_NUMBER] == "73153" ||
    bus[FLEET_NUMBER] == "73154" ||
    bus[FLEET_NUMBER] == "73155" ||
    bus[FLEET_NUMBER] == "73156" ||
    bus[FLEET_NUMBER] == "73157" ||
    bus[FLEET_NUMBER] == "73158" ||
    bus[FLEET_NUMBER] == "73159" ||
    bus[FLEET_NUMBER] == "73160" ||
    bus[FLEET_NUMBER] == "73161" ||
    bus[FLEET_NUMBER] == "73162" ||
    bus[FLEET_NUMBER] == "73163" ||
    bus[FLEET_NUMBER] == "73164" ||
    bus[FLEET_NUMBER] == "73165" ||
    bus[FLEET_NUMBER] == "73166" ||
    bus[FLEET_NUMBER] == "73167" ||
    bus[FLEET_NUMBER] == "73168" ||
    bus[FLEET_NUMBER] == "73169" ||
    bus[FLEET_NUMBER] == "73170" ||
    bus[FLEET_NUMBER] == "73171"
  );
}

function isRRequirement(bus) {
  return (
    // BLUEBIRD 08/03/25
    bus[FLEET_NUMBER] == "11165" ||
    bus[FLEET_NUMBER] == "27102" ||
    bus[FLEET_NUMBER] == "36201" ||
    bus[FLEET_NUMBER] == "36203" ||
    bus[FLEET_NUMBER] == "36204" ||
    bus[FLEET_NUMBER] == "47811" ||
    bus[FLEET_NUMBER] == "50413" ||
    bus[FLEET_NUMBER] == "53617" ||
    bus[FLEET_NUMBER] == "53702" ||
    bus[FLEET_NUMBER] == "53703" ||
    bus[FLEET_NUMBER] == "53706" ||
    bus[FLEET_NUMBER] == "54131" ||
    bus[FLEET_NUMBER] == "54132" ||
    bus[FLEET_NUMBER] == "54134" ||
    bus[FLEET_NUMBER] == "54135" ||
    bus[FLEET_NUMBER] == "54136" ||
    bus[FLEET_NUMBER] == "54137" ||
    bus[FLEET_NUMBER] == "54246" ||
    bus[FLEET_NUMBER] == "54304" ||
    bus[FLEET_NUMBER] == "54309" ||
    bus[FLEET_NUMBER] == "84060" ||
    bus[FLEET_NUMBER] == "84064" ||
    // EAST SCOTLAND 08/03/25
    bus[FLEET_NUMBER] == "10678" ||
    bus[FLEET_NUMBER] == "11540" ||
    bus[FLEET_NUMBER] == "19370" ||
    bus[FLEET_NUMBER] == "28603" ||
    bus[FLEET_NUMBER] == "28649" ||
    bus[FLEET_NUMBER] == "48152" ||
    bus[FLEET_NUMBER] == "50513" ||
    bus[FLEET_NUMBER] == "50514" ||
    bus[FLEET_NUMBER] == "54277" ||
    bus[FLEET_NUMBER] == "54278" ||
    bus[FLEET_NUMBER] == "54280" ||
    bus[FLEET_NUMBER] == "80220" ||
    // WEST SCOTLAND 08/03/25
    bus[FLEET_NUMBER] == "10512" ||
    bus[FLEET_NUMBER] == "10914" ||
    bus[FLEET_NUMBER] == "22169" ||
    bus[FLEET_NUMBER] == "28660" ||
    bus[FLEET_NUMBER] == "28663" ||
    bus[FLEET_NUMBER] == "28666" ||
    bus[FLEET_NUMBER] == "28702" ||
    bus[FLEET_NUMBER] == "36705" ||
    bus[FLEET_NUMBER] == "37252" ||
    bus[FLEET_NUMBER] == "37494" ||
    bus[FLEET_NUMBER] == "47838" ||
    bus[FLEET_NUMBER] == "50410" ||
    bus[FLEET_NUMBER] == "64012" ||
    // NORTH EAST 08/03/25
    bus[FLEET_NUMBER] == "19437" ||
    bus[FLEET_NUMBER] == "19444" ||
    bus[FLEET_NUMBER] == "19642" ||
    bus[FLEET_NUMBER] == "19643" ||
    bus[FLEET_NUMBER] == "19644" ||
    bus[FLEET_NUMBER] == "22574" ||
    bus[FLEET_NUMBER] == "22874" ||
    bus[FLEET_NUMBER] == "22883" ||
    bus[FLEET_NUMBER] == "22885" ||
    bus[FLEET_NUMBER] == "22890" ||
    bus[FLEET_NUMBER] == "26063" ||
    bus[FLEET_NUMBER] == "26064" ||
    bus[FLEET_NUMBER] == "27164" ||
    bus[FLEET_NUMBER] == "27179" ||
    bus[FLEET_NUMBER] == "27242" ||
    bus[FLEET_NUMBER] == "27244" ||
    bus[FLEET_NUMBER] == "27716" ||
    bus[FLEET_NUMBER] == "27796" ||
    bus[FLEET_NUMBER] == "27805" ||
    bus[FLEET_NUMBER] == "27809" ||
    bus[FLEET_NUMBER] == "27883" ||
    bus[FLEET_NUMBER] == "28001" ||
    bus[FLEET_NUMBER] == "36197" ||
    bus[FLEET_NUMBER] == "39720" ||
    bus[FLEET_NUMBER] == "39730"
  );
}

function isKRequirement(bus) {
  return (
    // BLUEBIRD
    // EAST SCOTLAND
    bus[FLEET_NUMBER] == "10586" ||
    bus[FLEET_NUMBER] == "10672" ||
    bus[FLEET_NUMBER] == "10673" ||
    bus[FLEET_NUMBER] == "10676" ||
    bus[FLEET_NUMBER] == "10681" ||
    bus[FLEET_NUMBER] == "10683" ||
    bus[FLEET_NUMBER] == "48217" ||
    bus[FLEET_NUMBER] == "48218" ||
    bus[FLEET_NUMBER] == "80000" ||
    bus[FLEET_NUMBER] == "80214" ||
    bus[FLEET_NUMBER] == "80225" ||
    bus[FLEET_NUMBER] == "80228" ||
    // WEST SCOTLAND
    bus[FLEET_NUMBER] == "47845" ||
    bus[FLEET_NUMBER] == "50253" ||
    // NORTH EAST
    bus[FLEET_NUMBER] == "26278" ||
    bus[FLEET_NUMBER] == "26292" ||
    bus[FLEET_NUMBER] == "27159" ||
    bus[FLEET_NUMBER] == "27772" ||
    bus[FLEET_NUMBER] == "27884" ||
    bus[FLEET_NUMBER] == "28003" ||
    bus[FLEET_NUMBER] == "28018" ||
    bus[FLEET_NUMBER] == "44017"
  );
}

function isUnknown(bus) {
  return bus[FLEET_NUMBER] >= 90000 || bus[FLEET_NUMBER] < 10000;
}

function isOutOfService(bus) {
  return bus[OUT_OF_SERVICE] === "True" || bus[CANCELLED] === "True";
}

function isNotinService(bus) {
  return (
    bus[AIMED_ORIGIN_STOP_DEPARTURE_TIME] == "" &&
    bus[OPERATING_COMPANY] !== "SCLK"
  );
}

function getIcon(bus) {
  let icon =
    "https://cdn.glitch.global/dc77986a-ecf1-4edf-b412-157ef949d5bf/unknown.png?v=1656527101597";

  if (!bus[SERVICE_NUMBER]) {
    icon =
      "https://cdn.glitch.global/dc77986a-ecf1-4edf-b412-157ef949d5bf/unknown.png?v=1656527101597";
  }

  if (isRRequirement(bus)) {
    icon =
      "https://cdn.glitch.global/e1e2eeec-eb4b-44f3-80bd-33a3554b84bb/unknown_rreq.png?v=1737806517252";
  }

  if (isKRequirement(bus)) {
    icon =
      "https://cdn.glitch.global/e1e2eeec-eb4b-44f3-80bd-33a3554b84bb/unknown_kreq.png?v=1737806515212";
  }

  if (isBRequirement(bus)) {
    icon =
      "https://cdn.glitch.global/e1e2eeec-eb4b-44f3-80bd-33a3554b84bb/unknown_breq.png?v=1737806512275";
  }

  if (isUnknown(bus)) {
    icon =
      "https://cdn.glitch.global/dc77986a-ecf1-4edf-b412-157ef949d5bf/unknown1.png?v=1656526895623";
  }

  if (isMegabus(bus)) {
    icon =
      "https://cdn.glitch.com/dc77986a-ecf1-4edf-b412-157ef949d5bf%2Fmegabus.png?v=1632352758341";
  }

  return icon;
}

function createBusInfo(bus) {
  const iconUrl = getIcon(bus);
  const now = new Date();
  const updatedTime = new Date(0);
  updatedTime.setUTCSeconds(bus[UPDATE_TIME] / 1000);
  const diffMs = now - updatedTime;
  const formattedTime = updatedTime.toLocaleString("en-GB", {
    timeZone: "UTC",
  });
  let seconds = Math.floor(diffMs / 1000);
  let minutes = Math.floor(seconds / 60);
  let hours = Math.floor(minutes / 60);
  let days = Math.floor(hours / 24);

  hours = hours - days * 24;
  minutes = minutes - days * 24 * 60 - hours * 60;
  seconds = seconds - days * 24 * 60 * 60 - hours * 60 * 60 - minutes * 60;

  return {
    title:
      bus[SERVICE_NUMBER] +
      " - " +
      bus[DIRECTION] +
      " - " +
      (bus[DESTINATION_DISPLAY] ? bus[DESTINATION_DISPLAY] + " - " : "") +
      bus[OPERATING_COMPANY] +
      " - " +
      bus[FLEET_NUMBER] +
      " Last Seen: " +
      formattedTime,
    info:
      (bus[AIMED_ORIGIN_STOP_DEPARTURE_TIME] == "" &&
      bus[OPERATING_COMPANY] !== "SCLK"
        ? "<b>Not in Service </b>" + "(" + bus[SERVICE_NUMBER] + ")"
        : "<b>Service: </b>" +
          (bus[SERVICE_NUMBER] ? bus[SERVICE_NUMBER] : "N/A") +
          (bus[DESTINATION_DISPLAY]
            ? " to <b>" + bus[DESTINATION_DISPLAY] + "</b>"
            : " to <b>" + bus[FINAL_STOP] + "</b>")) +
      "<br><b>Fleet No: </b>" +
      bus[FLEET_NUMBER] +
      " (" +
      bus[OPERATING_COMPANY] +
      ")" +
      "<br/><b>Last Seen: </b>" +
      (days == "0" ? "" : days + " days ") +
      (hours == "0" ? "" : hours + " hrs ") +
      (minutes == "0" ? "" : minutes + " min ") +
      (seconds == "1" ? seconds + " sec " : seconds + " secs ") +
      "ago" +
      "<br><b>Heading: </b>" +
      bus[HEADING] +
      "°",
    label: {
      color: isNotinService(bus)
        ? "#FF0000"
        : isMegabus(bus)
        ? "#FFFF00"
        : "#000000",
      fontWeight: "bold",
      fontSize: "11px",
      text: bus[FLEET_NUMBER],
    },
    timeDiffInMins: diffMs,
    icon: createBusIcon(iconUrl),
  };
}

function getBusIconColour(bus) {
  if (bus[CAPACITY] == "R") {
    return DEFAULT;
  } else if (bus[CAPACITY] == "A") {
    return DEFAULT;
  } else if (bus[CAPACITY] == "G") {
    return DEFAULT;
  } else if (bus[CAPACITY] == "S") {
    return DEFAULT;
  } else if (bus[CAPACITY] == "X") {
    return DEFAULT;
  } else {
    return DEFAULT;
  }
}

function setupMarkerInfoWindow(marker, busInfo) {
  if (marker.infoWindow === undefined) {
    marker.infoWindow = new google.maps.InfoWindow();
    google.maps.event.addListener(marker, "click", function (e) {
      marker.infoWindow.open(map, marker);
      removeRoutePathLine(marker);
      selectedMarker = marker;
    });
    google.maps.event.addListener(marker.infoWindow, "closeclick", function () {
      removeRoutePathLine(marker);
      marker.setIcon(createBusIcon(getIcon(marker.bus)));
      selectedMarker = null;
      selectedBus = null;
    });
  }
  marker.infoWindow.setContent(busInfo.info);
}

function removeRoutePathLine(marker) {
  if (marker == null) {
    return;
  }

  if (marker.routePathLine != null) {
    marker.routePathLine.setMap(null);
    marker.routePathLine = null;
  }

  removeMarkers(marker.pointMarkers);
}

function hasOriginInformation(bus) {
  return (
    bus[ORIGIN_STOP_REFERENCE] != null &&
    bus[ORIGIN_STOP_REFERENCE] !== "" &&
    timestampToDate(bus[AIMED_ORIGIN_STOP_DEPARTURE_TIME]) !== ""
  );
}

function createBusMarker(bus) {
  const busInfo = createBusInfo(bus);
  const markerLatLng = new google.maps.LatLng(bus[LATITUDE], bus[LONGITUDE]);
  const marker = new google.maps.Marker({
    position: markerLatLng,
    map: map,
    title: busInfo.title,
    icon: busInfo.icon,
    shape: { coords: [12, 25, 12, 40, 53, 40, 53, 25], type: "poly" },
    label: busInfo.label,
    optimized: false,
    zIndex: 99999999,
  });
  marker.bus = bus;
  marker.addListener(
    "click",
    function (e) {
      abortXhr();
      if (hasOriginInformation(bus) && !notSeenForSometime(bus)) {
        loadRoute(
          marker,
          bus[ORIGIN_STOP_REFERENCE],
          bus[AIMED_ORIGIN_STOP_DEPARTURE_TIME]
        );
      }
      selectedBus = bus;
    },
    { passive: true }
  );
  markers[bus[FLEET_NUMBER]] = marker;
  setupMarkerInfoWindow(marker, bus);
}

function loadRoute(marker, stopReference, stopDepartureTime) {
  if (
    stopReference != null &&
    stopReference !== "" &&
    stopDepartureTime != null &&
    stopDepartureTime !== ""
  ) {
    const targetDepartureTime = toLocalISOString(
      timestampToDate(stopDepartureTime)
    );

    loadJSONPOST(
      UKBUS_API_PREFIX + "/tis/v3/service-timetable-query",
      JSON.stringify({
        ServiceId: marker.bus[SERVICE_ID],
        GenericDayPattern: "targetDateOnly",
        Departure: {
          TargetDepartureTime: { value: targetDepartureTime },
          DepartureStopLabel: stopReference,
        },
        ResponseCharacteristics: {
          MaxLaterTimetableColumns: { value: 1 },
          TripEvents: {
            TimingInformationPoints: true,
            NonTimingInformationPoints: true,
          },
          VehicleLegPaths: true,
          StopCoordinates: true,
          IncludeSituations: false,
          GenerateKML: false,
        },
        RequestId: "bus-route-timetable-query-stagecoach",
      }),
      function (response) {
        if (response.ResponseMessages == null) {
          marker.routeResponse = response;

          loadXml(
            marker.bus[KML_URL],
            function success(message) {
              marker.kmlDocument = message;
              processKmL(marker);
              renderRouteList(marker);
            },
            function error() {
              marker.kmlDocument = null;
            }
          );
        } else {
          marker.routeResponse = null;
          console.log("No Route found using origin");
        }
      },
      function (xhr) {
        console.log("Error loading route: " + xhr.status);
      }
    );
  }
}

function createBusIcon(iconUrl) {
  return {
    url: iconUrl,
    size: new google.maps.Size(66, 66),
    origin: new google.maps.Point(0, 0),
    anchor: new google.maps.Point(33, 33),
  };
}

function findBusClosestPointIndex(marker) {
  let closestPointIndex = 0;
  let shortestDistance = null;

  // Find the nearest point
  for (let i = 0; i < marker.pointsWithStops.length; i++) {
    let stopLocation = marker.pointsWithStops[i];
    if (shortestDistance == null) {
      shortestDistance = distanceInKm(
        marker.bus[LATITUDE],
        marker.bus[LONGITUDE],
        stopLocation.Latitude,
        stopLocation.Longitude
      );
      closestPointIndex = 0;
    } else if (
      distanceInKm(
        marker.bus[LATITUDE],
        marker.bus[LONGITUDE],
        stopLocation.Latitude,
        stopLocation.Longitude
      ) < shortestDistance
    ) {
      shortestDistance = distanceInKm(
        marker.bus[LATITUDE],
        marker.bus[LONGITUDE],
        stopLocation.Latitude,
        stopLocation.Longitude
      );
      closestPointIndex = i;
    }
    //console.log(stopLocation.Name + " " + distanceInKm(marker.bus[LATITUDE], marker.bus[LONGITUDE], stopLocation.Geocode.Latitude, stopLocation.Geocode.Longitude));
  }
  return closestPointIndex;
}

function calculateBusNextStop(marker, closestPointIndex) {
  // If the nearest point isn't a stop we can just use the a stop value we've already worked out
  if (marker.pointsWithStops[closestPointIndex].Stop === undefined) {
    if (marker.pointsWithStops[closestPointIndex].NextStop === undefined) {
      return marker.pointsWithStops[closestPointIndex];
    }
    return marker.pointsWithStops[closestPointIndex].NextStop;
  }

  const aheadArrivedBehind = aheadArrivedBehindDestination(
    marker.bus[LATITUDE],
    marker.bus[LONGITUDE],
    marker.pointsWithStops[closestPointIndex]
  );

  if (aheadArrivedBehind === ARRIVED) {
    // Bus is at the stop
    return marker.pointsWithStops[closestPointIndex];
  } else if (
    aheadArrivedBehind === AHEAD &&
    marker.pointsWithStops[closestPointIndex].NextStop !== undefined
  ) {
    // Bus is past the stop, and there's another stop to come
    return marker.pointsWithStops[closestPointIndex].NextStop;
  }

  // Bus is behind the stop or there's no more stops to come
  return marker.pointsWithStops[closestPointIndex];
}

function calculateBusBearing(marker, closestPointIndex) {
  const aheadArrivedBehind = aheadArrivedBehindDestination(
    marker.bus[LATITUDE],
    marker.bus[LONGITUDE],
    marker.pointsWithStops[closestPointIndex]
  );

  // If we're behind the point we want the bearing from the previous point to this one
  if (aheadArrivedBehind === BEHIND && closestPointIndex > 0) {
    return marker.pointsWithStops[closestPointIndex - 1].pointAheadBearing;
  }

  return marker.pointsWithStops[closestPointIndex].pointAheadBearing;
}

function aheadArrivedBehindDestination(latitude, longitude, point) {
  const distanceFromPoint = distanceInKm(
    latitude,
    longitude,
    point.Latitude,
    point.Longitude
  );
  if (distanceFromPoint <= BOUNDARY_DISTANCE) {
    return ARRIVED;
  }

  const distanceFromBehind = distanceInKm(
    latitude,
    longitude,
    point.boundaryPointBehind.Latitude,
    point.boundaryPointBehind.Longitude
  );
  const distanceFromAhead = distanceInKm(
    latitude,
    longitude,
    point.boundaryPointAhead.Latitude,
    point.boundaryPointAhead.Longitude
  );

  if (distanceFromAhead < distanceFromBehind) {
    return AHEAD;
  }

  return BEHIND;
}

function scrollTo(element, to, duration) {
  let start = element.scrollTop,
    change = to - start,
    currentTime = 0,
    increment = 20;

  let animateScroll = function () {
    currentTime += increment;
    element.scrollTop = Math.easeInOutQuad(
      currentTime,
      start,
      change,
      duration
    );
    if (currentTime < duration) {
      setTimeout(animateScroll, increment);
    }
  };
  animateScroll();
}

Math.easeInOutQuad = function (
  currentTime,
  startValue,
  changeInValue,
  duration
) {
  currentTime /= duration / 2;
  if (currentTime < 1)
    return (changeInValue / 2) * currentTime * currentTime + startValue;
  currentTime--;
  return (
    (-changeInValue / 2) * (currentTime * (currentTime - 2) - 1) + startValue
  );
};

function updateBusMarker(bus) {
  const busInfo = createBusInfo(bus);
  const markerLatLng = new google.maps.LatLng(bus[LATITUDE], bus[LONGITUDE]);
  const marker = markers[bus[FLEET_NUMBER]];

  marker.setPosition(markerLatLng);
  setupMarkerInfoWindow(marker, busInfo);
  // if (marker.icon !== busInfo.icon) {
  //     marker.setIcon(busInfo.icon);
  // }

  marker.bus = bus;

  if (selectedBus != null) {
    if (selectedBus[FLEET_NUMBER] === bus[FLEET_NUMBER]) {
      if (
        selectedBus[SERVICE_ID] !== bus[SERVICE_ID] ||
        selectedBus[ORIGIN_STOP_REFERENCE] !== bus[ORIGIN_STOP_REFERENCE] ||
        selectedBus[DIRECTION] !== bus[DIRECTION] ||
        selectedBus[AIMED_ORIGIN_STOP_DEPARTURE_TIME] !==
          bus[AIMED_ORIGIN_STOP_DEPARTURE_TIME]
      ) {
        loadRoute(
          marker,
          bus[ORIGIN_STOP_REFERENCE],
          bus[AIMED_ORIGIN_STOP_DEPARTURE_TIME]
        );
      } else if (
        marker.routeResponse != null &&
        (selectedBus[LATITUDE] !== bus[LATITUDE] ||
          selectedBus[LONGITUDE] !== bus[LONGITUDE])
      ) {
        // load the estimates

        loadJSONPOST(
          UKBUS_API_PREFIX + "/adc/estimated-timetable",
          JSON.stringify({
            EstimatedTimetableRequest: {
              header: { retailOperation: "", channel: "", ipAddress: "" },
              service: selectedBus[SERVICE_NUMBER],
              direction: selectedBus[DIRECTION],
              originDepartureTime: timestampToDate(
                selectedBus[AIMED_ORIGIN_STOP_DEPARTURE_TIME]
              ),
              originStopPointLabel: selectedBus[ORIGIN_STOP_REFERENCE],
            },
          }),
          function (response) {
            marker.estimatedTimetableResponse = response;
            renderRouteList(marker);
          },
          function (xhr) {
            console.log("et failed:" + xhr);
            if (marker.pointsWithStops != null) {
              renderRouteList(marker);
            }
          }
        );
      }
      selectedBus = bus;
    }
  }
}

function markBuses(data) {
  // console.log("Retrieved: " + data.services.length + " buses.");

  for (let busIndex in data.services) {
    for (let item in markers) {
      if (
        data.services.find((ob) => {
          return ob[FLEET_NUMBER] === item;
        })
      ) {
      } else {
        markers[item].setMap(null);
        delete markers[item];
      }
    }

    const bus = data.services[busIndex];
    if (!bus.hasOwnProperty(LATITUDE)) {
      continue;
    }

    if (bus[FLEET_NUMBER] in markers) {
      updateBusMarker(bus);
    } else {
      createBusMarker(bus);
    }
  }
}

function outlineViewport() {
  const bounds = map.getBounds();
  const ne = bounds.getNorthEast();
  const sw = bounds.getSouthWest();

  const viewportPoints = [
    ne,
    new google.maps.LatLng(ne.lat(), sw.lng()),
    sw,
    new google.maps.LatLng(sw.lat(), ne.lng()),
    ne,
  ];
  // strokeOpacity = 0 , if don't want to show the border moving.
  if (viewportBox) {
    viewportBox.setPath(viewportPoints);
  } else {
    viewportBox = new google.maps.Polyline({
      path: viewportPoints,
      strokeColor: "#ff0000",
      strokeOpacity: 1.0,
      strokeWeight: 4,
    });
    viewportBox.setMap(map);
  }
}

function withQuery(parameterName, value) {
  if (value == null) {
    return "";
  }
  return "?" + parameterName + "=" + value;
}

function andParam(parameterName, value) {
  if (value == null) {
    return "";
  }
  return "&" + parameterName + "=" + value;
}

function buildVehicleQueryString(mapBounds) {
  const baseUrl = SCG_API_PREFIX + "/vehicle-tracking/v1/vehicles";

  if (selectedMarker != null) {
    return (
      baseUrl +
      withQuery(
        "services",
        ":" +
          selectedMarker.bus[OPERATING_COMPANY] +
          ":" +
          selectedMarker.bus[SERVICE_NUMBER] +
          ":" +
          ":"
      )
    );
  }

  // console.log("bounds: " + mapBounds);
  const opco = document.getElementById("opco");
  const fleetNumber = document.getElementById("fleetNumber");
  const serviceNumber = document.getElementById("serviceNumber");
  const useAppSettings = document.getElementById("appSettingsToggle");

  // if(opco){
  //      console.log(opco.value);
  // }
  const ne = mapBounds.getNorthEast();
  const sw = mapBounds.getSouthWest();

  let url =
    baseUrl +
    withQuery("latsw", sw.lat()) +
    andParam("lngsw", sw.lng()) +
    andParam("latne", ne.lat()) +
    andParam("lngne", ne.lng()) +
    andParam("clip", "true");

  if (useAppSettings && useAppSettings.checked) {
    url = url + andParam("client_version", "UKBUS_APP");
  }

  // andParam('descriptive_fields', 'true');

  // "short opco" is now the first parameter - we won't know this so leave it blank and start with a separating ":"
  let serviceFilter = ":";
  if (opco && opco.value !== "All Op-Co") {
    serviceFilter += opco.value + ":";
  } else {
    serviceFilter += ":";
  }

  if (serviceNumber && serviceNumber.value !== "") {
    serviceFilter += serviceNumber.value + ":";
  } else {
    serviceFilter += ":";
  }

  if (serviceFilter !== ":::") {
    url = url + andParam("services", serviceFilter);
  }

  return url;
}

function locateBuses() {
  const mapBounds = map.getBounds();
  if (mapBounds !== undefined) {
    loadJSON(buildVehicleQueryString(mapBounds), markBuses, function (xhr) {
      console.log("Error retrieving vehicles: " + xhr.status);
    });
  }
}

function initMap(currentLocation) {
  map = new google.maps.Map(document.getElementById("map"), {
    center: new google.maps.LatLng(
      currentLocation.coords.latitude,
      currentLocation.coords.longitude
    ),
    zoom: 12,
    mapTypeId: google.maps.MapTypeId.ROADMAP,
    mapTypeControl: true,
    streetViewControl: false,
  });
  const trafficLayer = new google.maps.TrafficLayer();
  trafficLayer.setMap(map);

  locateBuses();
  refreshInterval = setInterval(locateBuses, 5000);

  map.addListener("drag", function () {
    if (refreshInterval != null) {
      abortXhr();
      clearInterval(refreshInterval);
    }
  });

  map.addListener("dragend", function () {
    refreshInterval = setInterval(locateBuses, 5000);
  });

  map.addListener("idle", function () {
    locateBuses();
    locateStops();
  });

  const filterControlsDiv = document.createElement("div");
  new FilterControls(filterControlsDiv);

  filterControlsDiv.index = 1;
  map.controls[google.maps.ControlPosition.TOP_RIGHT].push(filterControlsDiv);
}

function getLocation() {
  if ("ontouchstart" in window) {
    navigator.geolocation.getCurrentPosition(initMap, function (error) {
      const defaultLocation = {
        coords: { latitude: "56.472", longitude: "-2.9307" },
      };
      initMap(defaultLocation);
    });
  } else {
    const defaultLocation = {
      coords: { latitude: "56.472", longitude: "-2.9307" },
    };
    initMap(defaultLocation);
  }
}
