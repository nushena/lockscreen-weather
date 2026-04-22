const DEFAULT_CONFIG = {
  adcode: "",
  city: "",
  lang: "zh",
  background: {
    mode: "black",
    apiUrl: "https://picsum.photos/1920/1080",
    current: "",
    history: [],
  },
};

const CONFIG_FILE_NAME = "weather-config.json";

function normalizeText(value) {
  return String(value ?? "").trim();
}

function normalizeBackgroundMode(value) {
  const mode = String(value ?? "").trim().toLowerCase();
  if (mode === "api" || mode === "api-random") {
    return "api-random";
  }
  if (mode === "custom") {
    return "custom";
  }
  return "black";
}

function normalizeBackgroundHistory(input) {
  const list = Array.isArray(input) ? input : [];
  return list
    .map((item) => ({
      id: normalizeText(item?.id),
      path: normalizeText(item?.path),
      dataUrl: normalizeText(item?.dataUrl),
      createdAt: Number(item?.createdAt) || Date.now(),
    }))
    .filter((item) => item.id && (item.path || item.dataUrl));
}

function normalizeBackground(input) {
  const apiUrl = normalizeText(input?.apiUrl);
  return {
    mode: normalizeBackgroundMode(input?.mode),
    apiUrl: apiUrl || DEFAULT_CONFIG.background.apiUrl,
    current: normalizeText(input?.current),
    currentDataUrl: normalizeText(input?.currentDataUrl),
    history: normalizeBackgroundHistory(input?.history),
  };
}

function normalizeConfig(input) {
  return {
    adcode: normalizeText(input?.adcode),
    city: normalizeText(input?.city),
    lang: input?.lang === "en" ? "en" : DEFAULT_CONFIG.lang,
    background: normalizeBackground(input?.background),
  };
}

function hasNeutralinoFilesystem() {
  return typeof Neutralino !== "undefined" && Neutralino?.filesystem;
}

function dirname(path) {
  return String(path ?? "").replace(/[\\/][^\\/]*$/, "");
}

function joinPath(base, fileName) {
  const root = String(base ?? "").trim();
  if (!root) {
    return fileName;
  }
  const sep = root.includes("\\") ? "\\" : "/";
  return `${root.replace(/[\\/]+$/, "")}${sep}${fileName}`;
}

function configCandidates() {
  const candidates = [];

  if (typeof NL_CWD === "string" && NL_CWD.trim()) {
    candidates.push(joinPath(NL_CWD, CONFIG_FILE_NAME));
  }

  if (typeof NL_PATH === "string" && NL_PATH.trim()) {
    const appDir = dirname(NL_PATH);
    if (appDir) {
      candidates.push(joinPath(appDir, CONFIG_FILE_NAME));
    }
  }

  candidates.push(CONFIG_FILE_NAME);
  return [...new Set(candidates)];
}

async function readConfig() {
  if (!hasNeutralinoFilesystem()) {
    return DEFAULT_CONFIG;
  }

  for (const candidate of configCandidates()) {
    try {
      const raw = await Neutralino.filesystem.readFile(candidate);
      if (!raw.trim()) {
        return DEFAULT_CONFIG;
      }
      return normalizeConfig(JSON.parse(raw));
    } catch {
      continue;
    }
  }

  return DEFAULT_CONFIG;
}

async function writeConfig(config) {
  const normalized = normalizeConfig(config);

  if (!hasNeutralinoFilesystem()) {
    return normalized;
  }

  const targetPath = configCandidates()[0];
  await Neutralino.filesystem.writeFile(targetPath, `${JSON.stringify(normalized, null, 2)}\n`);
  return normalized;
}

async function clearConfig() {
  return await writeConfig(DEFAULT_CONFIG);
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
