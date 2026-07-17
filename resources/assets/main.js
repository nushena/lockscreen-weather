import { renderTime } from "./time.js";
import { updateWeather, WEATHER_REFRESH_MS } from "./weather-ui.js";
import { applyBackgroundFromConfig } from "./background.js";
import { getWeatherConfig } from "./weather-config.js";
import { fetchJson } from "./native-json.js";

const HOTBOARD_API_URL = "https://uapis.cn/api/v1/misc/hotboard?type=weibo";
const REFRESH_INTERVAL_MS = WEATHER_REFRESH_MS;

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

function pad2(value) {
  return String(value).padStart(2, "0");
}

function formatHotSearchUpdateTime(updateTime) {
  const raw = String(updateTime ?? "").trim();
  if (!raw) {
    return "";
  }

  // 兼容时间戳（秒 / 毫秒）与常见日期字符串
  let date;
  if (/^\d+$/.test(raw)) {
    const num = Number(raw);
    date = new Date(raw.length <= 10 ? num * 1000 : num);
  } else {
    date = new Date(raw.includes("T") ? raw : raw.replace(/-/g, "/"));
  }

  if (Number.isNaN(date.getTime())) {
    return raw;
  }

  return `${date.getFullYear()}年${pad2(date.getMonth() + 1)}月${pad2(date.getDate())}日 ${pad2(date.getHours())}:${pad2(date.getMinutes())}:${pad2(date.getSeconds())}`;
}

function renderHotSearchUpdate(updateEl, updateTime) {
  if (!updateEl) {
    return;
  }

  const formatted = formatHotSearchUpdateTime(updateTime);
  if (!formatted) {
    updateEl.textContent = "";
    updateEl.hidden = true;
    return;
  }

  updateEl.textContent = `更新时间 ${formatted}`;
  updateEl.hidden = false;
}

function showHotSearchPanel() {
  if (hotSearchPanelEl) {
    hotSearchPanelEl.hidden = false;
  }
}

function hasHotSearchContent() {
  return Boolean(hotSearchListEl?.children?.length);
}

function ensureShellVisible() {
  if (contentEl) {
    contentEl.hidden = false;
  }
  if (footerEl) {
    footerEl.hidden = false;
  }
}

function startClock() {
  renderTime(hourEl, minuteEl, secondEl, dateEl);
  setInterval(() => {
    renderTime(hourEl, minuteEl, secondEl, dateEl);
  }, 1000);
}

async function loadHotSearches() {
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
      // 空数据：首屏保持隐藏；刷新时保留旧列表
      return hasHotSearchContent();
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
    // 失败不拆旧内容，谁先到谁显示的渐进策略
    return false;
  }
}

async function loadWeather() {
  return await updateWeather({
    weatherEl,
    weatherDetailsEl,
    weatherAlertEl,
    alertPanelEl,
    statusEl,
  });
}

async function loadBackground() {
  try {
    return await applyBackgroundFromConfig();
  } catch (error) {
    console.error("背景应用失败:", error);
    return false;
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

async function bootstrapScreen() {
  // 1. 底盘立刻可见：时间 + 黑底
  ensureShellVisible();
  startClock();
  applyThemeFromConfig().catch((error) => {
    console.error("主题应用失败:", error);
  });

  // 2. 三路并行，谁先到谁先显示；失败立即再试一次
  refreshWithRetry(loadWeather, "天气");
  refreshWithRetry(loadHotSearches, "微博热搜");
  refreshWithRetry(loadBackground, "背景");

  // 3. 仅天气 / 热搜进入 5 分钟刷新；背景只在启动时处理
  runRefreshLoop(loadWeather, "天气");
  runRefreshLoop(loadHotSearches, "微博热搜");
}

bootstrapScreen().catch((error) => {
  console.error("锁屏启动失败:", error);
});
