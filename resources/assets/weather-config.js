const DEFAULT_CONFIG = {
  adcode: "",
  city: "",
  lang: "zh",
  theme: "dark",
  background: {
    mode: "black",
    apiUrl: "https://picsum.photos/1920/1080",
    current: "",
    history: [],
  },
};

const CONFIG_FILE_NAME = "weather-config.json";
const USER_CONFIG_DIR_NAME = "lockscreen-weather";

let cachedConfigCandidates = null;
let lastConfigPath = "";

function normalizeText(value) {
  return String(value ?? "").trim();
}

function normalizeBackgroundMode(value) {
  const mode = String(value ?? "").trim().toLowerCase();
  if (mode === "api" || mode === "api-random") {
    return "api-random";
  }
  return "black";
}

function normalizeBackground(input) {
  const apiUrl = normalizeText(input?.apiUrl);
  return {
    mode: normalizeBackgroundMode(input?.mode),
    apiUrl: apiUrl || DEFAULT_CONFIG.background.apiUrl,
    current: "",
    currentDataUrl: "",
    history: [],
  };
}

function normalizeTheme(value) {
  const theme = String(value ?? "").trim().toLowerCase();
  if (theme === "light") {
    return "light";
  }
  return DEFAULT_CONFIG.theme;
}

function normalizeConfig(input) {
  return {
    adcode: normalizeText(input?.adcode),
    city: normalizeText(input?.city),
    lang: input?.lang === "en" ? "en" : DEFAULT_CONFIG.lang,
    theme: normalizeTheme(input?.theme),
    background: normalizeBackground(input?.background),
  };
}

function hasNeutralinoFilesystem() {
  return typeof Neutralino !== "undefined" && Neutralino?.filesystem;
}

function dirname(path) {
  const value = String(path ?? "").trim();
  const slashIndex = Math.max(value.lastIndexOf("\\"), value.lastIndexOf("/"));
  return slashIndex > 0 ? value.slice(0, slashIndex) : "";
}

function joinPath(base, fileName) {
  const root = String(base ?? "").trim();
  if (!root) {
    return fileName;
  }
  const sep = root.includes("\\") ? "\\" : "/";
  return `${root.replace(/[\\/]+$/, "")}${sep}${fileName}`;
}

function escapeForDoubleQuotedPowerShell(value) {
  return String(value ?? "").replace(/`/g, "``").replace(/"/g, '`"');
}

function looksLikeExecutablePath(path) {
  return /[\\/][^\\/]+\.(exe|scr)$/i.test(String(path ?? "").trim());
}

function getExecutablePathFromGlobals() {
  const values = [
    typeof NL_PATH === "string" ? NL_PATH : "",
    ...(Array.isArray(globalThis?.NL_ARGS) ? globalThis.NL_ARGS : []),
  ];

  return values.map((item) => String(item ?? "").trim()).find(looksLikeExecutablePath) || "";
}

function readCommandOutput(result) {
  return normalizeText(result?.stdOut ?? result?.stdout ?? result?.output ?? "");
}

function isSystemDirectory(path) {
  const normalized = String(path ?? "")
    .replace(/\//g, "\\")
    .toLowerCase()
    .replace(/\\+$/, "");
  return /\\windows\\system32$|\\windows\\syswow64$/.test(normalized);
}

function isUsableWorkingDirectory(path) {
  const normalized = normalizeText(path);
  return normalized && !/^[a-z]:$/i.test(normalized) && !isSystemDirectory(normalized);
}

function uniqueItems(items) {
  return [...new Set(items.filter(Boolean))];
}

async function ensureParentDirectory(filePath) {
  const parentDir = dirname(filePath);
  if (!parentDir || typeof Neutralino === "undefined" || !Neutralino?.filesystem) {
    return;
  }

  try {
    await Neutralino.filesystem.createDirectory(parentDir);
  } catch {
    // Directory may already exist or may be created by the host environment.
  }
}

async function getExecutablePathFromParentProcess() {
  if (typeof Neutralino === "undefined" || !Neutralino?.os?.execCommand) {
    return "";
  }

  const script = [
    "$pidToCheck=$PID",
    "for($i=0;$i -lt 8;$i++){",
    "$p=Get-CimInstance Win32_Process -Filter \"ProcessId=$pidToCheck\"",
    "if(!$p){break}",
    "$path=$p.ExecutablePath",
    "if($path -and $path -notmatch '\\\\(powershell|pwsh|cmd|conhost)\\.exe$'){$path;break}",
    "$pidToCheck=$p.ParentProcessId",
    "}",
  ].join(";");
  const command = `powershell -NoProfile -ExecutionPolicy Bypass -Command "${escapeForDoubleQuotedPowerShell(script)}"`;

  try {
    const output = readCommandOutput(await Neutralino.os.execCommand(command));
    const candidate = output.split(/\r?\n/).map(normalizeText).find(looksLikeExecutablePath);
    return candidate || "";
  } catch {
    return "";
  }
}

async function getUserConfigDirectory() {
  if (typeof Neutralino === "undefined" || !Neutralino?.os?.execCommand) {
    return "";
  }

  const script = `[Environment]::GetFolderPath('ApplicationData')`;
  const command = `powershell -NoProfile -ExecutionPolicy Bypass -Command "${escapeForDoubleQuotedPowerShell(script)}"`;

  try {
    const appDataDir = readCommandOutput(await Neutralino.os.execCommand(command));
    return appDataDir ? joinPath(appDataDir, USER_CONFIG_DIR_NAME) : "";
  } catch {
    return "";
  }
}

async function configCandidates() {
  if (cachedConfigCandidates) {
    return cachedConfigCandidates;
  }

  const candidates = [];
  const globalExecutablePath = getExecutablePathFromGlobals();
  if (globalExecutablePath) {
    candidates.push(joinPath(dirname(globalExecutablePath), CONFIG_FILE_NAME));
  }

  const parentExecutablePath = await getExecutablePathFromParentProcess();
  if (parentExecutablePath) {
    candidates.push(joinPath(dirname(parentExecutablePath), CONFIG_FILE_NAME));
  }

  const userConfigDir = await getUserConfigDirectory();
  if (userConfigDir) {
    candidates.push(joinPath(userConfigDir, CONFIG_FILE_NAME));
  }

  candidates.push(CONFIG_FILE_NAME);

  if (typeof NL_CWD === "string" && isUsableWorkingDirectory(NL_CWD)) {
    candidates.push(joinPath(NL_CWD, CONFIG_FILE_NAME));
  }

  cachedConfigCandidates = uniqueItems(candidates);
  return cachedConfigCandidates;
}

async function readConfig() {
  if (!hasNeutralinoFilesystem()) {
    return DEFAULT_CONFIG;
  }

  const candidates = await configCandidates();
  for (const candidate of candidates) {
    try {
      const raw = await Neutralino.filesystem.readFile(candidate);
      if (!raw.trim()) {
        continue;
      }
      const normalized = normalizeConfig(JSON.parse(raw));
      lastConfigPath = candidate;
      return normalized;
    } catch {
      continue;
    }
  }

  return DEFAULT_CONFIG;
}

async function writeConfig(config) {
  const normalized = normalizeConfig(config);

  if (!hasNeutralinoFilesystem()) {
    throw new Error("Neutralino 文件系统不可用，无法写入配置文件。");
  }

  const candidates = await configCandidates();
  let lastError = null;

  for (const targetPath of candidates) {
    try {
      await ensureParentDirectory(targetPath);
      await Neutralino.filesystem.writeFile(targetPath, `${JSON.stringify(normalized, null, 2)}\n`);
      lastConfigPath = targetPath;
      return normalized;
    } catch (error) {
      lastError = error;
      continue;
    }
  }

  throw new Error(
    `配置写入失败，已尝试：${candidates.join("、")}${lastError ? `；最后错误：${lastError?.message || lastError}` : ""}`,
  );
}

async function clearConfig() {
  return await writeConfig(DEFAULT_CONFIG);
}

export async function getWeatherConfigPath() {
  if (lastConfigPath) {
    return lastConfigPath;
  }

  const paths = await configCandidates();
  return paths[0] || CONFIG_FILE_NAME;
}

export async function getWeatherConfigPaths() {
  return await configCandidates();
}

export async function getWeatherConfig() {
  return await readConfig();
}

export async function setWeatherConfig(nextConfig) {
  return await writeConfig(nextConfig);
}

export async function clearWeatherConfig() {
  return await clearConfig();
}

export async function buildWeatherApiUrl(baseUrl) {
  const url = new URL(baseUrl);
  const { adcode, city, lang } = await getWeatherConfig();

  if (adcode) {
    url.searchParams.set("adcode", adcode);
  }

  if (city) {
    url.searchParams.set("city", city);
  }

  url.searchParams.set("lang", lang);
  return url.toString();
}