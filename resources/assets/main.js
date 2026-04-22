import { renderTime } from "./time.js";
import { updateWeather, WEATHER_REFRESH_MS } from "./weather-ui.js";
import { applyBackgroundFromConfig } from "./background.js";
import { getWeatherConfig } from "./weather-config.js";

const HOTBOARD_API_URL = "https://uapis.cn/api/v1/misc/hotboard?type=weibo";
const HOTBOARD_REFRESH_MS = 5 * 60 * 1000;
const HOTBOARD_FALLBACK = [
  ["xxxxxxxxx", "100w"],
  ["xxxxxxxx", "80w"],
  ["xxxxxxxxxx", "76w"],
  ["xxxxxxxxx", "68w"],
  ["xxxxxxxx", "61w"],
  ["xxxxxxxxxx", "55w"],
  ["xxxxxxxxx", "48w"],
  ["xxxxxxxx", "42w"],
  ["xxxxxxxxxx", "37w"],
  ["xxxxxxxxx", "31w"],
  ["xxxxxxxx", "28w"],
  ["xxxxxxxxxx", "26w"],
  ["xxxxxxxxx", "24w"],
  ["xxxxxxxx", "22w"],
  ["xxxxxxxxxx", "20w"],
];

const hourEl = document.getElementById("hour");
const minuteEl = document.getElementById("minute");
const secondEl = document.getElementById("second");
const dateEl = document.getElementById("date");
const weatherEl = document.getElementById("weather");
const weatherDetailsEl = document.getElementById("weatherDetails");
const weatherAlertEl = document.getElementById("weatherAlert");
const alertPanelEl = document.getElementById("alertPanel");
const statusEl = document.getElementById("status");
const hotSearchListEl = document.getElementById("hotSearchList");
const hotSearchUpdateEl = document.getElementById("hotSearchUpdate");

function formatHotValue(value) {
  const num = Number(value);
  if (!Number.isFinite(num)) {
    return String(value ?? "");
  }

  if (num >= 10000) {
    const scaled = (num / 10000).toFixed(num >= 100000 ? 0 : 1);
    return `${scaled.replace(/\.0$/, "")}w`;
  }

  return String(Math.round(num));
}

function renderHotSearches(listEl, items) {
  listEl.innerHTML = items
    .slice(0, 15)
    .map(([title, heat], index) => {
      const safeTitle = String(title ?? "");
      const safeHeat = String(heat ?? "");
      return `<li class="hot-search-item"><span class="hot-search-rank">${index + 1}.</span><span class="hot-search-title">${safeTitle}</span><span class="hot-search-heat">${safeHeat}</span></li>`;
    })
    .join("");
}

function renderHotSearchUpdate(updateEl, updateTime) {
  if (!updateTime) {
    updateEl.textContent = "";
    updateEl.hidden = true;
    return;
  }

  updateEl.textContent = `更新时间 ${updateTime}`;
  updateEl.hidden = false;
}

async function fetchJsonWithTimeout(url, timeoutMs = 15000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      method: "GET",
      mode: "cors",
      cache: "no-store",
      credentials: "omit",
      headers: {
        Accept: "application/json",
      },
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    return await response.json();
  } finally {
    clearTimeout(timer);
  }
}

async function loadHotSearches() {
  renderHotSearches(hotSearchListEl, HOTBOARD_FALLBACK);
  renderHotSearchUpdate(hotSearchUpdateEl, "");

  try {
    let data;
    try {
      data = await fetchJsonWithTimeout(HOTBOARD_API_URL, 15000);
    } catch {
      data = await fetchJsonWithTimeout(HOTBOARD_API_URL, 20000);
    }

    const items = (data?.list ?? [])
      .slice(0, 15)
      .map((item) => [item?.title ?? "", formatHotValue(item?.hot_value)]);

    if (items.length) {
      renderHotSearches(hotSearchListEl, items);
    }

    renderHotSearchUpdate(hotSearchUpdateEl, data?.update_time ?? "");
  } catch (error) {
    console.error("热搜获取失败:", error);
    const reason = error?.name === "AbortError" ? "请求超时" : error.message;
    renderHotSearchUpdate(hotSearchUpdateEl, `更新失败：${reason}`);
  }
}

async function applyThemeFromConfig() {
  const config = await getWeatherConfig();
  document.body.classList.toggle("light-theme", config?.theme === "light");
}

renderTime(hourEl, minuteEl, secondEl, dateEl);
loadHotSearches();
applyThemeFromConfig().catch((error) => {
  console.error("主题应用失败:", error);
});
applyBackgroundFromConfig().catch((error) => {
  console.error("背景应用失败:", error);
});
updateWeather({ weatherEl, weatherDetailsEl, weatherAlertEl, alertPanelEl, statusEl });
setInterval(() => renderTime(hourEl, minuteEl, secondEl, dateEl), 1000);
setInterval(() => updateWeather({ weatherEl, weatherDetailsEl, weatherAlertEl, alertPanelEl, statusEl }), WEATHER_REFRESH_MS);
