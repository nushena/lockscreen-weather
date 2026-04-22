import { clearWeatherConfig, getWeatherConfig, setWeatherConfig } from "./weather-config.js";
import {
  getBackgroundState,
  setBackgroundApiUrl,
  setBackgroundMode,
} from "./background.js";

const formEl = document.getElementById("manageForm");
const adcodeEl = document.getElementById("adcode");
const cityEl = document.getElementById("city");
const themeEl = document.getElementById("theme");
const clearEl = document.getElementById("clearButton");
const statusEl = document.getElementById("manageFormStatus");

const bgStatusEl = document.getElementById("bgStatus");
const bgApiUrlEl = document.getElementById("bgApiUrl");
const bgApiBlockEl = document.getElementById("bgApiBlock");

function normalizeStatusType(type) {
  return ["success", "error", "pending", "info"].includes(type) ? type : "info";
}

function setStatusState(element, text, type = "info") {
  if (!element) {
    return;
  }

  const normalizedType = normalizeStatusType(type);
  element.textContent = text;
  element.dataset.state = normalizedType;
}

function setStatus(text, type = "info") {
  setStatusState(statusEl, text, type);
}

function setBgStatus(text, type = "info") {
  setStatusState(bgStatusEl, text, type);
}

function selectedBgMode() {
  const el = document.querySelector('input[name="bgMode"]:checked');
  return el?.value || "black";
}

function setSelectedBgMode(mode) {
  const normalized = String(mode ?? "black");
  for (const radio of document.querySelectorAll('input[name="bgMode"]')) {
    radio.checked = radio.value === normalized;
  }
}

function applyModeVisibility(mode) {
  if (bgApiBlockEl) {
    bgApiBlockEl.hidden = mode !== "api-random";
  }
}

async function fillBackgroundForm() {
  const bg = await getBackgroundState();
  setSelectedBgMode(bg?.mode || "black");
  if (bgApiUrlEl) {
    bgApiUrlEl.value = bg?.apiUrl || "";
  }
  applyModeVisibility(bg?.mode || "black");
}

async function fillForm() {
  const config = await getWeatherConfig();
  adcodeEl.value = config.adcode;
  cityEl.value = config.city;
  if (themeEl) {
    themeEl.value = config.theme === "light" ? "light" : "dark";
  }
}

await fillForm();
await fillBackgroundForm();
setStatus("保存后会立即写入本地配置。", "info");
setBgStatus("切换背景模式后，下次启动锁屏会自动生效。", "info");

formEl.addEventListener("submit", async (event) => {
  event.preventDefault();

  try {
    const currentConfig = await getWeatherConfig();
    const config = await setWeatherConfig({
      ...currentConfig,
      adcode: adcodeEl.value,
      city: cityEl.value,
      theme: themeEl?.value === "light" ? "light" : "dark",
    });

    await fillForm();
    setStatus(
      config.adcode || config.city
        ? "保存成功。"
        : "配置已清空，锁屏将回到 IP 自动定位。",
      "success",
    );
  } catch (error) {
    setStatus(`保存失败：${error.message}`, "error");
  }
});

clearEl.addEventListener("click", async () => {
  try {
    await clearWeatherConfig();
    formEl.reset();
    await fillForm();
    await fillBackgroundForm();
    setStatus("配置已清空，锁屏将回到 IP 自动定位。", "success");
  } catch (error) {
    setStatus(`清空失败：${error.message}`, "error");
  }
});

for (const radio of document.querySelectorAll('input[name="bgMode"]')) {
  radio.addEventListener("change", async () => {
    try {
      const mode = selectedBgMode();
      await setBackgroundMode(mode);
      applyModeVisibility(mode);
      setBgStatus(`背景模式已切换为${mode === "api-random" ? "API 随机壁纸" : "默认黑色"}。`, "success");
    } catch (error) {
      setBgStatus(`切换失败：${error.message}`, "error");
    }
  });
}

bgApiUrlEl?.addEventListener("change", async () => {
  try {
    await setBackgroundApiUrl(bgApiUrlEl.value);
    setBgStatus("随机壁纸地址保存成功。", "success");
  } catch (error) {
    setBgStatus(`保存失败：${error.message}`, "error");
  }
});
