import { getWeatherConfig, setWeatherConfig } from "./weather-config.js";

const DEFAULT_BG_COLOR = "#000000";

function normalizeText(value) {
  return String(value ?? "").trim();
}

function setBodyBackgroundCss(imageUrl) {
  if (!document?.body) {
    return;
  }

  const isScreenPage = document.body.classList.contains("screen-page");
  if (!isScreenPage) {
    document.body.style.backgroundColor = DEFAULT_BG_COLOR;
    document.body.style.backgroundImage = "none";
    document.body.style.backgroundSize = "";
    document.body.style.backgroundPosition = "";
    document.body.style.backgroundRepeat = "";
    return;
  }

  document.body.style.backgroundColor = DEFAULT_BG_COLOR;
  document.body.style.backgroundImage = imageUrl ? `url("${imageUrl}")` : "none";
  document.body.style.backgroundSize = "cover";
  document.body.style.backgroundPosition = "center";
  document.body.style.backgroundRepeat = "no-repeat";
}

async function saveBackgroundConfig(config, background) {
  return await setWeatherConfig({
    ...config,
    background,
  });
}

export async function applyBackgroundFromConfig() {
  const config = await getWeatherConfig();
  const bg = config?.background;

  if (!bg || bg.mode === "black") {
    setBodyBackgroundCss("");
    return;
  }

  if (bg.mode === "api-random") {
    const url = normalizeText(bg.apiUrl);
    if (!url) {
      setBodyBackgroundCss("");
      return;
    }
    setBodyBackgroundCss(url);
    return;
  }

  await saveBackgroundConfig(config, {
    ...bg,
    mode: "black",
    current: "",
    currentDataUrl: "",
    history: [],
  });
  setBodyBackgroundCss("");
}

export async function setBackgroundMode(mode) {
  const config = await getWeatherConfig();
  const bg = config.background;
  const normalizedMode = mode === "api-random" ? "api-random" : "black";
  await saveBackgroundConfig(config, {
    ...bg,
    mode: normalizedMode,
    current: "",
    currentDataUrl: "",
    history: [],
  });
}

export async function setBackgroundApiUrl(apiUrl) {
  const config = await getWeatherConfig();
  const bg = config.background;
  await saveBackgroundConfig(config, {
    ...bg,
    apiUrl: normalizeText(apiUrl),
  });
}

export async function getBackgroundState() {
  const config = await getWeatherConfig();
  const mode = config.background?.mode === "api-random" ? "api-random" : "black";
  return {
    ...config.background,
    mode,
    current: "",
    currentDataUrl: "",
    history: [],
  };
}
