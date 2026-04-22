import { clearWeatherConfig, getWeatherConfig, setWeatherConfig } from "./weather-config.js";
import {
  deleteHistoryItem,
  getBackgroundState,
  importCustomWallpaper,
  setBackgroundApiUrl,
  setBackgroundMode,
} from "./background.js";

const formEl = document.getElementById("manageForm");
const adcodeEl = document.getElementById("adcode");
const cityEl = document.getElementById("city");
const clearEl = document.getElementById("clearButton");
const statusEl = document.getElementById("manageStatus");

const bgStatusEl = document.getElementById("bgStatus");
const bgApiUrlEl = document.getElementById("bgApiUrl");
const bgPickButtonEl = document.getElementById("bgPickButton");
const bgFileInputEl = document.getElementById("bgFileInput");
const bgHistoryEl = document.getElementById("bgHistory");
const bgHistoryEmptyEl = document.getElementById("bgHistoryEmpty");
const bgApiBlockEl = document.getElementById("bgApiBlock");
const bgCustomBlockEl = document.getElementById("bgCustomBlock");

function setStatus(text) {
  statusEl.textContent = text;
}

function setBgStatus(text) {
  if (!bgStatusEl) {
    return;
  }
  bgStatusEl.textContent = text;
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
  if (bgCustomBlockEl) {
    bgCustomBlockEl.hidden = mode !== "custom";
  }
}

function fileUrlFromRelative(relativePath) {
  const normalized = String(relativePath ?? "")
    .trim()
    .replace(/\\/g, "/")
    .replace(/^\.\//, "")
    .replace(/^\/+/, "");
  if (!normalized) {
    return "";
  }

  return `./image/${normalized.replace(/^image\//, "")}`;
}

function renderBackgroundHistory(background) {
  if (!bgHistoryEl || !bgHistoryEmptyEl) {
    return;
  }

  const history = Array.isArray(background?.history) ? background.history : [];
  bgHistoryEmptyEl.hidden = history.length > 0;

  bgHistoryEl.innerHTML = history
    .map((item) => {
      const path = String(item?.path ?? "");
      const src = fileUrlFromRelative(path);
      const safePath = path.replace(/"/g, "&quot;");
      return `\
      <div class="bg-item" data-path="${safePath}">
        <img class="bg-thumb" src="${src}" alt="历史壁纸" loading="lazy" onerror="this.dataset.failed='1'; this.alt='历史壁纸加载失败';" />
        <button class="bg-delete" type="button" data-action="delete" data-path="${safePath}">删除</button>
      </div>`;
    })
    .join("");
}

async function fillBackgroundForm() {
  const bg = await getBackgroundState();
  setSelectedBgMode(bg?.mode || "black");
  if (bgApiUrlEl) {
    bgApiUrlEl.value = bg?.apiUrl || "";
  }
  applyModeVisibility(bg?.mode || "black");
  renderBackgroundHistory(bg);
}

async function fillForm() {
  const config = await getWeatherConfig();
  adcodeEl.value = config.adcode;
  cityEl.value = config.city;
}

await fillForm();
await fillBackgroundForm();
setStatus("保存后，主页面会直接读取本地 JSON 配置。");
setBgStatus("切换背景模式后，主页面下次启动会自动生效。");

formEl.addEventListener("submit", async (event) => {
  event.preventDefault();

  try {
    const config = await setWeatherConfig({
      adcode: adcodeEl.value,
      city: cityEl.value,
    });

    await fillForm();
    setStatus(
      config.adcode || config.city
        ? "已保存配置，主页面会直接读取这份 JSON。"
        : "已保存为空配置，主页面将回到客户端 IP 自动定位。",
    );
  } catch (error) {
    setStatus(`保存失败：${error.message}`);
  }
});

clearEl.addEventListener("click", async () => {
  try {
    await clearWeatherConfig();
    formEl.reset();
    await fillForm();
    await fillBackgroundForm();
    setStatus("已清空配置，主页面将回到客户端 IP 自动定位。");
  } catch (error) {
    setStatus(`清空失败：${error.message}`);
  }
});

for (const radio of document.querySelectorAll('input[name="bgMode"]')) {
  radio.addEventListener("change", async () => {
    try {
      const mode = selectedBgMode();
      await setBackgroundMode(mode);
      applyModeVisibility(mode);
      setBgStatus(`已切换背景模式：${mode}`);
    } catch (error) {
      setBgStatus(`切换失败：${error.message}`);
    }
  });
}

bgApiUrlEl?.addEventListener("change", async () => {
  try {
    await setBackgroundApiUrl(bgApiUrlEl.value);
    setBgStatus("已保存 API 地址。");
  } catch (error) {
    setBgStatus(`保存失败：${error.message}`);
  }
});

bgPickButtonEl?.addEventListener("click", () => {
  bgFileInputEl?.click();
});

bgFileInputEl?.addEventListener("change", async () => {
  const file = bgFileInputEl.files?.[0];
  if (!file) {
    return;
  }

  try {
    setBgStatus("正在导入壁纸...");
    const bg = await importCustomWallpaper(file);
    await setBackgroundMode("custom");
    setSelectedBgMode("custom");
    renderBackgroundHistory(bg);
    setBgStatus("已导入并应用自定义壁纸（图片已复制到 image/）。");
  } catch (error) {
    setBgStatus(`导入失败：${error.message}`);
  } finally {
    bgFileInputEl.value = "";
  }
});

bgHistoryEl?.addEventListener("click", async (event) => {
  const target = event.target;
  const action = target?.getAttribute?.("data-action");
  const path = target?.getAttribute?.("data-path");

  if (action === "delete") {
    try {
      setBgStatus("正在删除...");
      const bg = await deleteHistoryItem(path);
      renderBackgroundHistory(bg);
      setBgStatus("已删除（同时删除 image/ 下的实体文件）。");
    } catch (error) {
      setBgStatus(`删除失败：${error.message}`);
    }
    return;
  }
});
