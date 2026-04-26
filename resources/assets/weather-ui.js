import {
  collectDetails,
  collectForecastSummary,
  collectHourlySummary,
  collectLifeIndexSummary,
  pickWeatherText,
} from "./weather-format.js";
import { buildWeatherApiUrl } from "./weather-config.js";
import { fetchJson } from "./native-json.js";

export const API_URL = "https://uapis.cn/api/v1/misc/weather";
export const WEATHER_REFRESH_MS = 5 * 60 * 1000;

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
    const requestUrl = await buildWeatherApiUrl(API_URL);

    const data = await fetchJson(requestUrl, 15000);
    const payload = data?.data && typeof data.data === "object" ? data.data : data;

    weatherEl.textContent = pickWeatherText(payload);
    renderWeatherDetails(weatherDetailsEl, alertPanelEl, weatherAlertEl, payload);

    const city = [payload?.province, payload?.city, payload?.district].filter(Boolean).join(" / ");
    const nowTime = new Date().toLocaleString();
    const reportTime = ` · 更新于 ${nowTime}`;
    statusEl.textContent = `${city || "自动定位"}${reportTime}`;
    return true;
  } catch (error) {
    console.error("天气获取失败:", error);
    statusEl.textContent = "天气更新失败，稍后自动重试";
    return false;
  }
}
