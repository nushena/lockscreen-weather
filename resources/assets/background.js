import { getWeatherConfig, setWeatherConfig } from "./weather-config.js";

const IMAGE_DIR_NAME = "image";
const RESOURCE_IMAGE_DIR_NAME = "resources/image";
const DEFAULT_BG_COLOR = "#000000";
const HISTORY_LIMIT = 20;

function hasNeutralinoFilesystem() {
  return typeof Neutralino !== "undefined" && Neutralino?.filesystem;
}

function normalizeText(value) {
  return String(value ?? "").trim();
}

function normalizeStoredPath(value) {
  const normalized = normalizeText(value).replace(/\\/g, "/");
  return normalized.replace(/^\.\//, "").replace(/^\/+/, "");
}

function nowId() {
  return `bg_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

function guessImageExtension(fileNameOrUrl, fallback = ".jpg") {
  const text = normalizeText(fileNameOrUrl);
  const match = text.match(/\.(png|jpg|jpeg|webp|gif|bmp)(?:\?|#|$)/i);
  if (!match) {
    return fallback;
  }
  return `.${match[1].toLowerCase().replace("jpeg", "jpg")}`;
}

function joinPath(base, name) {
  const root = normalizeText(base);
  if (!root) {
    return name;
  }
  const sep = root.includes("\\") ? "\\" : "/";
  return `${root.replace(/[\\/]+$/, "")}${sep}${name}`;
}

function cwdRoot() {
  return typeof NL_CWD === "string" ? NL_CWD : "";
}

async function ensureImageDir() {
  if (!hasNeutralinoFilesystem()) {
    return;
  }

  const targets = [
    joinPath(cwdRoot(), IMAGE_DIR_NAME),
    joinPath(cwdRoot(), RESOURCE_IMAGE_DIR_NAME),
  ];

  for (const target of targets) {
    try {
      await Neutralino.filesystem.createDirectory(target);
    } catch {
      // 已存在或无权限时，让后续写入自行报错
    }
  }
}

async function fileExists(path) {
  if (!hasNeutralinoFilesystem()) {
    return false;
  }

  try {
    const stat = await Neutralino.filesystem.getStats(path);
    return Boolean(stat);
  } catch {
    return false;
  }
}

function setBodyBackgroundCss(imageUrl) {
  if (!document?.body) {
    return;
  }

  document.body.style.backgroundColor = DEFAULT_BG_COLOR;
  document.body.style.backgroundImage = imageUrl ? `url("${imageUrl}")` : "none";
  document.body.style.backgroundSize = "cover";
  document.body.style.backgroundPosition = "center";
  document.body.style.backgroundRepeat = "no-repeat";
}

function makeFileUrl(absolutePath) {
  const relativePath = normalizeStoredPath(absolutePath);
  if (!relativePath) {
    return "";
  }

  const fileName = relativePath.replace(/^image\//, "");
  return `./image/${fileName}`;
}

function resourceImagePath(relativePath) {
  const normalized = normalizeStoredPath(relativePath);
  return joinPath(cwdRoot(), `resources/${normalized}`);
}

function historyDedup(list) {
  const seen = new Set();
  const result = [];
  for (const item of list) {
    const path = normalizeStoredPath(item?.path);
    if (!item?.id || !path) {
      continue;
    }
    const key = path;
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    result.push({
      ...item,
      path,
    });
  }
  return result;
}

function trimHistory(list) {
  return list.slice(0, HISTORY_LIMIT);
}

async function saveBackgroundConfig(config, background) {
  return await setWeatherConfig({
    ...config,
    background,
  });
}

async function pruneMissingHistory(config) {
  const bg = config?.background;
  const history = Array.isArray(bg?.history) ? bg.history : [];
  if (!history.length) {
    return config;
  }

  const kept = [];
  for (const item of history) {
    const relativePath = normalizeStoredPath(item?.path);
    if (!relativePath) {
      continue;
    }

    const absolutePath = joinPath(cwdRoot(), relativePath);
    if (await fileExists(absolutePath)) {
      kept.push({
        ...item,
        path: relativePath,
      });
    }
  }

  if (kept.length === history.length) {
    return config;
  }

  const current = normalizeStoredPath(bg.current);
  const hasCurrent = kept.some((item) => normalizeStoredPath(item.path) === current);
  const nextBackground = {
    ...bg,
    current: hasCurrent ? current : "",
    mode: hasCurrent ? bg.mode : current ? "black" : bg.mode,
    history: kept,
  };

  return await saveBackgroundConfig(config, nextBackground);
}

export async function applyBackgroundFromConfig() {
  const config = await pruneMissingHistory(await getWeatherConfig());
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

  const current = normalizeText(bg.current);
  const normalizedCurrent = normalizeStoredPath(current);
  if (!normalizedCurrent) {
    setBodyBackgroundCss("");
    return;
  }

  const absolutePath = joinPath(cwdRoot(), normalizedCurrent);
  const ok = await fileExists(absolutePath);
  if (!ok) {
    // 文件丢失：回退黑色并清空 current
    await setWeatherConfig({
      ...config,
      background: {
        ...bg,
        current: "",
        mode: "black",
      },
    });
    setBodyBackgroundCss("");
    return;
  }

  setBodyBackgroundCss(makeFileUrl(normalizedCurrent));
}

export async function setBackgroundMode(mode) {
  const config = await getWeatherConfig();
  const bg = config.background;
  await saveBackgroundConfig(config, {
    ...bg,
    mode,
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
  const config = await pruneMissingHistory(await getWeatherConfig());
  return {
    ...config.background,
    current: normalizeStoredPath(config.background?.current),
    history: (config.background?.history ?? []).map((item) => ({
      ...item,
      path: normalizeStoredPath(item?.path),
    })),
  };
}

export async function importCustomWallpaper(file) {
  if (!file) {
    throw new Error("未选择文件");
  }

  const config = await getWeatherConfig();
  const bg = config.background;

  await ensureImageDir();

  const ext = guessImageExtension(file.name, ".jpg");
  const fileName = `custom_${Date.now()}${ext}`;
  const relativePath = normalizeStoredPath(`${IMAGE_DIR_NAME}/${fileName}`);
  const absolutePath = joinPath(cwdRoot(), relativePath);
  const resourcePath = resourceImagePath(relativePath);

  const buffer = await file.arrayBuffer();

  if (!hasNeutralinoFilesystem()) {
    throw new Error("当前环境不支持文件系统写入");
  }

  await Neutralino.filesystem.writeBinaryFile(absolutePath, buffer);
  await Neutralino.filesystem.writeBinaryFile(resourcePath, buffer);

  const nextHistory = trimHistory(
    historyDedup([
      { id: nowId(), path: relativePath, createdAt: Date.now() },
      ...(bg.history ?? []),
    ]),
  );

  const nextConfig = await saveBackgroundConfig(config, {
    ...bg,
    current: relativePath,
    history: nextHistory,
  });

  setBodyBackgroundCss(makeFileUrl(relativePath));
  return nextConfig.background;
}

export async function applyHistoryItem(relativePath) {
  const config = await pruneMissingHistory(await getWeatherConfig());
  const bg = config.background;
  const next = normalizeStoredPath(relativePath);
  if (!next) {
    throw new Error("图片路径为空");
  }

  const absolutePath = joinPath(cwdRoot(), next);
  const ok = await fileExists(absolutePath);
  if (!ok) {
    throw new Error("图片文件不存在");
  }

  const nextConfig = await saveBackgroundConfig(config, {
    ...bg,
    current: next,
  });

  setBodyBackgroundCss(makeFileUrl(next));
  return nextConfig.background;
}

export async function deleteHistoryItem(relativePath) {
  const config = await pruneMissingHistory(await getWeatherConfig());
  const bg = config.background;
  const target = normalizeStoredPath(relativePath);
  if (!target) {
    return bg;
  }

  const absolutePath = joinPath(cwdRoot(), target);
  const resourcePath = resourceImagePath(target);

  if (hasNeutralinoFilesystem()) {
    try {
      if (await fileExists(absolutePath)) {
        await Neutralino.filesystem.remove(absolutePath);
      }
      if (await fileExists(resourcePath)) {
        await Neutralino.filesystem.remove(resourcePath);
      }
    } catch (error) {
      throw new Error(`删除文件失败：${error?.message || error}`);
    }
  }

  const nextHistory = (bg.history ?? []).filter(
    (item) => normalizeStoredPath(item?.path) !== target,
  );
  const deletingCurrent = normalizeStoredPath(bg.current) === target;

  const nextConfig = await saveBackgroundConfig(config, {
    ...bg,
    current: deletingCurrent ? "" : bg.current,
    mode: deletingCurrent ? "black" : bg.mode,
    history: nextHistory,
  });

  if (deletingCurrent) {
    setBodyBackgroundCss("");
  }

  return nextConfig.background;
}
