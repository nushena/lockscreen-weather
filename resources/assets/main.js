import { renderTime } from "./time.js";
import { updateWeather, WEATHER_REFRESH_MS } from "./weather-ui.js";
import { applyBackgroundFromConfig } from "./background.js";
import { getWeatherConfig } from "./weather-config.js";
import { fetchJson } from "./native-json.js";
import { preloadItems } from "./preload-utils.js";

const HOTBOARD_API_URL = "https://uapis.cn/api/v1/misc/hotboard?type=weibo";
const REFRESH_INTERVAL_MS = WEATHER_REFRESH_MS;
const LOCKSCREEN_READY_EVENT = "lockscreen-ready";

const hourEl = document.getElementById("hour");
const minuteEl = document.getElementById("minute");
const secondEl = document.getElementById("second");
const dateEl = document.getElementById("date");
const weatherEl = document.getElementById("weather");
const weatherDetailsEl = document.getElementById("weatherDetails");
const weatherAlertEl = document.getElementById("weatherAlert");
const alertPanelEl = document.getElementById("alertPanel");
const statusEl = document.getElementById("status");
const hotSearchPanelEl = document.querySelector(".hot-search-panel");
const hotSearchListEl = document.getElementById("hotSearchList");
const hotSearchUpdateEl = document.getElementById("hotSearchUpdate");
const contentEl = document.querySelector(".content");
const footerEl = document.querySelector(".footer");

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

function showHotSearchPanel() {
  if (hotSearchPanelEl) {
    hotSearchPanelEl.hidden = false;
  }
}

function hideHotSearchPanel() {
  if (hotSearchPanelEl) {
    hotSearchPanelEl.hidden = true;
  }
  hotSearchListEl.innerHTML = "";
  renderHotSearchUpdate(hotSearchUpdateEl, "");
}

function hideContentBeforePreload() {
  if (contentEl) {
    contentEl.hidden = true;
  }
  if (footerEl) {
    footerEl.hidden = true;
  }
}

function showContentAfterPreload() {
  if (contentEl) {
    contentEl.hidden = false;
  }
  if (footerEl) {
    footerEl.hidden = false;
  }
}

async function loadHotSearches() {
  document.body.classList.add("hot-search-loading");
  hideHotSearchPanel();

  try {
    const data = await fetchJson(HOTBOARD_API_URL, 15000);
    const list = Array.isArray(data?.list)
      ? data.list
      : Array.isArray(data?.data?.list)
        ? data.data.list
        : [];

    const items = list
      .slice(0, 15)
      .map((item) => [item?.title ?? "", formatHotValue(item?.hot_value)]);

    if (!items.length) {
      hideHotSearchPanel();
      return true;
    }

    renderHotSearches(hotSearchListEl, items);
    renderHotSearchUpdate(
      hotSearchUpdateEl,
      data?.update_time ?? data?.data?.update_time ?? "",
    );
    showHotSearchPanel();
    return true;
  } catch (error) {
    console.error("微博热搜获取失败:", error);
    hideHotSearchPanel();
    return false;
  } finally {
    document.body.classList.remove("hot-search-loading");
  }
}

async function refreshWithRetry(task, label) {
  try {
    const success = await task();
    if (success) {
      return true;
    }

    console.error(`${label}刷新失败后立即重试一次`);
    return await task();
  } catch (error) {
    console.error(`${label}刷新异常:`, error);
    return false;
  }
}

async function runRefreshLoop(
  task,
  label,
  initialDelayMs = REFRESH_INTERVAL_MS,
) {
  if (initialDelayMs > 0) {
    await new Promise((resolve) => setTimeout(resolve, initialDelayMs));
  }

  while (true) {
    await refreshWithRetry(task, label);
    await new Promise((resolve) => setTimeout(resolve, REFRESH_INTERVAL_MS));
  }
}

async function applyThemeFromConfig() {
  const config = await getWeatherConfig();
  document.body.classList.toggle("light-theme", config?.theme === "light");
}

async function preloadWeather() {
  const success = await updateWeather({
    weatherEl,
    weatherDetailsEl,
    weatherAlertEl,
    alertPanelEl,
    statusEl,
  });

  if (!success) {
    throw new Error("天气预加载失败");
  }
}

async function preloadHotSearches() {
  const success = await loadHotSearches();

  if (!success) {
    throw new Error("热搜预加载失败");
  }
}

async function preloadBackground() {
  await applyBackgroundFromConfig();
}

async function preloadScreenContent() {
  return await preloadItems(
    [
      { key: "weather", task: preloadWeather },
      { key: "hotSearch", task: preloadHotSearches },
      { key: "background", task: preloadBackground },
    ],
    2,
  );
}

function hideWeatherPanel() {
  weatherEl.textContent = "";
  weatherDetailsEl.innerHTML = "";
  weatherAlertEl.textContent = "";
  alertPanelEl.hidden = true;
}

async function bootstrapScreen() {
  hideContentBeforePreload();
  renderTime(hourEl, minuteEl, secondEl, dateEl);
  applyThemeFromConfig().catch((error) => {
    console.error("主题应用失败:", error);
  });

  let weatherOk = false;
  let hotSearchOk = false;

  try {
    const preloadResult = await preloadScreenContent();

    const weatherResult = preloadResult.items.find(
      (item) => item.key === "weather",
    );
    weatherOk = weatherResult?.ok ?? false;

    const hotSearchResult = preloadResult.items.find(
      (item) => item.key === "hotSearch",
    );
    hotSearchOk = hotSearchResult?.ok ?? false;
  } catch (error) {
    console.error("首屏预加载失败:", error);
  }

  if (!weatherOk) {
    hideWeatherPanel();
    statusEl.textContent = "";
  }

  if (!hotSearchOk) {
    hideHotSearchPanel();
  }

  showContentAfterPreload();
  window.dispatchEvent(new Event(LOCKSCREEN_READY_EVENT));

  runRefreshLoop(
    () =>
      updateWeather({
        weatherEl,
        weatherDetailsEl,
        weatherAlertEl,
        alertPanelEl,
        statusEl,
      }),
    "天气",
  );
  runRefreshLoop(loadHotSearches, "微博热搜");
}

bootstrapScreen().catch((error) => {
  console.error("锁屏启动失败:", error);
  window.dispatchEvent(new Event(LOCKSCREEN_READY_EVENT));
});
