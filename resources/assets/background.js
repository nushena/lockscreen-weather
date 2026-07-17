import { getWeatherConfig, setWeatherConfig } from "./weather-config.js";

const DEFAULT_BG_COLOR = "#000000";
const IMAGE_LOAD_TIMEOUT_MS = 20000;

let activeObjectUrl = "";

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

function revokeActiveObjectUrl() {
  if (activeObjectUrl) {
    URL.revokeObjectURL(activeObjectUrl);
    activeObjectUrl = "";
  }
}

function waitForImage(url, timeoutMs = IMAGE_LOAD_TIMEOUT_MS) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    let settled = false;

    const finish = (handler) => {
      if (settled) {
        return;
      }
      settled = true;
      window.clearTimeout(timer);
      image.onload = null;
      image.onerror = null;
      handler();
    };

    const timer = window.setTimeout(() => {
      finish(() => reject(new Error("图片加载超时")));
    }, timeoutMs);

    image.onload = () => finish(() => resolve(url));
    image.onerror = () => finish(() => reject(new Error("图片加载失败")));
    image.src = url;
  });
}

async function resolveImageViaFetch(apiUrl) {
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), IMAGE_LOAD_TIMEOUT_MS);

  try {
    const response = await fetch(apiUrl, {
      method: "GET",
      mode: "cors",
      cache: "no-store",
      credentials: "omit",
      redirect: "follow",
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const blob = await response.blob();
    if (!blob || blob.size <= 0) {
      throw new Error("图片内容为空");
    }

    // 兼容未声明 image/* 但实际是图片的接口
    if (blob.type && !blob.type.startsWith("image/") && !blob.type.includes("octet-stream")) {
      throw new Error(`非图片类型: ${blob.type}`);
    }

    const objectUrl = URL.createObjectURL(blob);
    try {
      await waitForImage(objectUrl);
      return objectUrl;
    } catch (error) {
      URL.revokeObjectURL(objectUrl);
      throw error;
    }
  } finally {
    window.clearTimeout(timer);
  }
}

async function resolveImageViaElement(apiUrl) {
  // 浏览器会跟随 302/203 等跳转；直出图片也可直接加载
  await waitForImage(apiUrl);
  return apiUrl;
}

async function resolveBackgroundImage(apiUrl) {
  try {
    return await resolveImageViaFetch(apiUrl);
  } catch (fetchError) {
    console.error("背景图 fetch 失败，回退到 Image 加载:", fetchError);
    return await resolveImageViaElement(apiUrl);
  }
}

async function applyResolvedBackgroundImage(imageUrl) {
  const previousObjectUrl = activeObjectUrl;
  if (imageUrl.startsWith("blob:")) {
    activeObjectUrl = imageUrl;
  } else {
    activeObjectUrl = "";
  }

  setBodyBackgroundCss(imageUrl);

  if (previousObjectUrl && previousObjectUrl !== activeObjectUrl) {
    URL.revokeObjectURL(previousObjectUrl);
  }
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
    revokeActiveObjectUrl();
    setBodyBackgroundCss("");
    return true;
  }

  if (bg.mode === "api-random") {
    const url = normalizeText(bg.apiUrl);
    if (!url) {
      revokeActiveObjectUrl();
      setBodyBackgroundCss("");
      return false;
    }

    try {
      const resolvedUrl = await resolveBackgroundImage(url);
      await applyResolvedBackgroundImage(resolvedUrl);
      return true;
    } catch (error) {
      console.error("背景图应用失败，保持黑色背景:", error);
      // 失败时维持黑底，不影响时钟与其它模块
      revokeActiveObjectUrl();
      setBodyBackgroundCss("");
      return false;
    }
  }

  await saveBackgroundConfig(config, {
    ...bg,
    mode: "black",
  });
  revokeActiveObjectUrl();
  setBodyBackgroundCss("");
  return true;
}

export async function setBackgroundMode(mode) {
  const config = await getWeatherConfig();
  const bg = config.background;
  const normalizedMode = mode === "api-random" ? "api-random" : "black";
  await saveBackgroundConfig(config, {
    ...bg,
    mode: normalizedMode,
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
  };
}
