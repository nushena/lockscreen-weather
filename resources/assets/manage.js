import { clearWeatherConfig, getWeatherConfig, setWeatherConfig } from "./weather-config.js";

const formEl = document.getElementById("manageForm");
const adcodeEl = document.getElementById("adcode");
const cityEl = document.getElementById("city");
const clearEl = document.getElementById("clearButton");
const statusEl = document.getElementById("manageStatus");

function setStatus(text) {
  statusEl.textContent = text;
}

async function fillForm() {
  const config = await getWeatherConfig();
  adcodeEl.value = config.adcode;
  cityEl.value = config.city;
}

await fillForm();
setStatus("保存后，主页面会直接读取本地 JSON 配置。");

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
    setStatus("已清空配置，主页面将回到客户端 IP 自动定位。");
  } catch (error) {
    setStatus(`清空失败：${error.message}`);
  }
});
