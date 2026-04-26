const TMP_DIR = ".tmp";
const TMP_FILE_PREFIX = "nl-fetch-";

function hasNeutralinoNative() {
  return typeof Neutralino !== "undefined" && Neutralino?.os?.execCommand && Neutralino?.filesystem;
}

function escapeForSingleQuotedPowerShell(value) {
  return String(value ?? "").replace(/'/g, "''");
}

function escapeForDoubleQuotedPowerShell(value) {
  return String(value ?? "").replace(/`/g, "``").replace(/"/g, '`"');
}

function stripUtf8Bom(text) {
  return typeof text === "string" ? text.replace(/^\uFEFF/, "") : text;
}

async function ensureTmpDir() {
  try {
    await Neutralino.filesystem.createDirectory(TMP_DIR);
  } catch {
    return;
  }
}

function buildTempFilePath() {
  const suffix = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  return `${TMP_DIR}/${TMP_FILE_PREFIX}${suffix}.json`;
}

async function removeFileIfExists(path) {
  try {
    await Neutralino.filesystem.remove(path);
  } catch {
    return;
  }
}

async function fetchJsonViaNative(url, timeoutMs) {
  await ensureTmpDir();

  const outputPath = buildTempFilePath();
  const escapedUrl = escapeForSingleQuotedPowerShell(url);
  const escapedOutputPath = escapeForSingleQuotedPowerShell(outputPath.replace(/\//g, "\\"));
  const timeoutSeconds = Math.max(5, Math.ceil(timeoutMs / 1000));
  const script = [
    "$ProgressPreference='SilentlyContinue'",
    "[Net.ServicePointManager]::SecurityProtocol=[Net.SecurityProtocolType]::Tls12",
    `$response = Invoke-RestMethod -Uri '${escapedUrl}' -TimeoutSec ${timeoutSeconds} -Headers @{ Accept = 'application/json' }`,
    `$json = $response | ConvertTo-Json -Depth 20`,
    `[System.IO.File]::WriteAllText('${escapedOutputPath}', $json, [System.Text.Encoding]::UTF8)`,
  ].join("; ");
  const command = `powershell -NoProfile -ExecutionPolicy Bypass -Command \"${escapeForDoubleQuotedPowerShell(script)}\"`;

  try {
    await Neutralino.os.execCommand(command);
    const raw = stripUtf8Bom(await Neutralino.filesystem.readFile(outputPath));
    return JSON.parse(raw);
  } finally {
    await removeFileIfExists(outputPath);
  }
}

async function fetchJsonViaBrowser(url, timeoutMs) {
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

export async function fetchJson(url, timeoutMs = 15000) {
  if (!hasNeutralinoNative()) {
    return await fetchJsonViaBrowser(url, timeoutMs);
  }

  try {
    return await fetchJsonViaNative(url, timeoutMs);
  } catch (nativeError) {
    try {
      return await fetchJsonViaBrowser(url, timeoutMs);
    } catch (browserError) {
      console.error("请求失败:", { url, nativeError, browserError });
      throw new Error("请求失败，请稍后重试");
    }
  }
}
