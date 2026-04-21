const MODE_MANAGE = "manage";
const MODE_SCREEN = "screen";

function hasNeutralino() {
  return typeof Neutralino !== "undefined";
}

function normalizeRuntimeArg(rawArg) {
  const normalized = String(rawArg ?? "")
    .trim()
    .toLowerCase()
    .replace(/\\/g, "/");

  if (/^[a-z]:\/?$/.test(normalized)) {
    return `/${normalized[0]}`;
  }

  return normalized;
}

function parseRuntimeMode() {
  const args = Array.isArray(window.NL_ARGS) ? window.NL_ARGS : [];
  const normalized = args.map((item) => normalizeRuntimeArg(item));
  const flag = normalized.find(
    (item) =>
      item.startsWith("/c") || item.startsWith("/s") || item.startsWith("/p"),
  );

  if (!flag || flag.startsWith("/c")) {
    return MODE_MANAGE;
  }

  if (flag.startsWith("/s")) {
    return MODE_SCREEN;
  }

  if (flag.startsWith("/p")) {
    return "preview";
  }

  return MODE_MANAGE;
}

function pageName() {
  const path = String(window.location.pathname ?? "").toLowerCase();
  if (path.endsWith("manage.html")) {
    return MODE_MANAGE;
  }
  return MODE_SCREEN;
}

function targetPathForMode(targetMode) {
  return targetMode === MODE_MANAGE ? "/manage.html" : "/index.html";
}

async function switchPage(targetMode) {
  const target = targetPathForMode(targetMode);
  const current = String(window.location.pathname ?? "");
  if (current.toLowerCase().endsWith(target.toLowerCase())) {
    return false;
  }
  window.location.replace(target);
  return true;
}

function applyRuntimeClass(mode) {
  if (!document?.body) {
    return;
  }

  document.body.classList.toggle("screen-page", mode === MODE_SCREEN);
  document.body.classList.toggle("manage-page", mode === MODE_MANAGE);
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function ensureScreenWindow(confirmScreen) {
  await Neutralino.window.show().catch(() => {});
  await Neutralino.window.focus().catch(() => {});
  await Neutralino.window.setBorderless(true);
  await Neutralino.window.setAlwaysOnTop(true);
  await Neutralino.window.setFullScreen();

  if (!confirmScreen) {
    return;
  }

  await sleep(120);
  const isFullScreen = await Neutralino.window
    .isFullScreen()
    .catch(() => false);
  if (isFullScreen) {
    return;
  }

  await Neutralino.window.focus().catch(() => {});
  await Neutralino.window.setFullScreen();
  await sleep(120);
}

async function applyWindowMode(mode, { confirmScreen = false } = {}) {
  if (!hasNeutralino()) {
    return;
  }

  if (mode === MODE_SCREEN) {
    await ensureScreenWindow(confirmScreen);
    return;
  }

  await Neutralino.window.exitFullScreen().catch(() => {});
  await Neutralino.window.setBorderless(false);
  await Neutralino.window.setAlwaysOnTop(false);
  await Neutralino.window.setSize({
    width: 900,
    height: 640,
    minWidth: 640,
    minHeight: 460,
  });
  await Neutralino.window.center();
}

async function bootstrap() {
  if (!hasNeutralino()) {
    return;
  }

  Neutralino.init();
  const mode = parseRuntimeMode();

  if (mode === "preview") {
    await Neutralino.app.exit();
    return;
  }

  const switched = await switchPage(mode);
  if (switched) {
    return;
  }

  applyRuntimeClass(mode);
  await applyWindowMode(mode, { confirmScreen: mode === MODE_SCREEN });

  if (mode !== MODE_SCREEN) {
    await Neutralino.window.show().catch(() => {});
    await Neutralino.window.focus().catch(() => {});
  }
}

bootstrap().catch(async (error) => {
  console.error("Neutralino 初始化失败:", error);
  if (hasNeutralino()) {
    await Neutralino.debug
      .log(`Neutralino 初始化失败: ${error?.message || error}`, "ERROR")
      .catch(() => {});
  }
});
