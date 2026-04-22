import {
  collectDetails,
  collectForecastSummary,
  collectHourlySummary,
  collectLifeIndexSummary,
  pickWeatherText,
} from "./weather-format.js";
import { buildWeatherApiUrl } from "./weather-config.js";

export const API_URL = "https://uapis.cn/api/v1/misc/weather";
export const WEATHER_REFRESH_MS = 30 * 60 * 1000;

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

export function renderWeatherDetails(weatherDetailsEl, alertPanelEl, weatherAlertEl, data) {
  const details = [
    ...collectDetails(data),
    ...collectForecastSummary(data),
    ...collectHourlySummary(data),
    ...collectLifeIndexSummary(data),
  ].slice(0, 12);

  weatherDetailsEl.innerHTML = details.map((item) => `<span class="weather-chip">${item}</span>`).join("");

  const alert = data?.alerts?.[0];
  if (alert) {
    const parts = [alert.level, alert.type, alert.title].filter(Boolean).join(" · ");
    weatherAlertEl.textContent = alert.text ? `${parts} — ${alert.text}` : parts;
    alertPanelEl.hidden = false;
    weatherAlertEl.hidden = false;
  } else {
    weatherAlertEl.textContent = "";
    alertPanelEl.hidden = true;
    weatherAlertEl.hidden = true;
  }
}

export async function updateWeather({ weatherEl, weatherDetailsEl, weatherAlertEl, alertPanelEl, statusEl }) {
  try {
    statusEl.textContent = "正在更新天气…";
    const requestUrl = await buildWeatherApiUrl(API_URL);

    let data;
    try {
      data = await fetchJsonWithTimeout(requestUrl, 15000);
    } catch (firstError) {
      data = await fetchJsonWithTimeout(requestUrl, 20000);
    }

    weatherEl.textContent = pickWeatherText(data);
    renderWeatherDetails(weatherDetailsEl, alertPanelEl, weatherAlertEl, data);

    const city = [data?.province, data?.city, data?.district].filter(Boolean).join(" / ");
    let nowTime=new Date().toLocaleString();
    const reportTime = ` · 更新于 ${nowTime}`;
    statusEl.textContent = `${city || "自动定位"}${reportTime}`;
  } catch (error) {
    console.error("天气获取失败:", error);
    weatherEl.textContent = "天气暂不可用";
    weatherDetailsEl.innerHTML = "";
    alertPanelEl.hidden = true;
    weatherAlertEl.hidden = true;
    const reason = error?.name === "AbortError" ? "请求超时" : error.message;
    statusEl.textContent = `天气更新失败: ${reason}，稍后自动重试`;
  }
}
