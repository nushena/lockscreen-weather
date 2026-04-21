export function formatNumber(value, unit = "") {
  if (value === null || value === undefined || value === "") {
    return null;
  }
  const num = Number(value);
  if (!Number.isFinite(num)) {
    return String(value);
  }
  const text = Number.isInteger(num) ? String(num) : num.toFixed(1).replace(/\.0$/, "");
  return `${text}${unit}`;
}

export function collectDetails(data) {
  const items = [];
  const push = (label, value, unit = "") => {
    const formatted = formatNumber(value, unit);
    if (formatted !== null) {
      items.push(`${label} ${formatted}`);
    }
  };

  if (data?.province || data?.city || data?.district) {
    const area = [data?.province, data?.city, data?.district].filter(Boolean).join(" / ");
    items.push(area);
  }

  if (data?.adcode) {
    items.push(`Adcode ${data.adcode}`);
  }

  push("体感", data?.feels_like, "°C");
  push("风向", data?.wind_direction);
  push("风力", data?.wind_power);
  push("湿度", data?.humidity, "%");
  push("能见度", data?.visibility, "km");
  push("气压", data?.pressure, "hPa");
  push("紫外线", data?.uv);
  push("降水", data?.precipitation, "mm");
  push("云量", data?.cloud, "%");
  push("AQI", data?.aqi);

  if (data?.aqi_category) {
    items.push(`AQI ${data.aqi_category}`);
  }

  if (data?.aqi_primary) {
    items.push(`主要污染物 ${data.aqi_primary}`);
  }

  return items;
}

export function collectForecastSummary(data) {
  const forecast = data?.forecast?.[0];
  if (!forecast) {
    return [];
  }

  const items = [];
  const push = (label, value, unit = "") => {
    const formatted = formatNumber(value, unit);
    if (formatted !== null) {
      items.push(`${label} ${formatted}`);
    }
  };

  if (forecast.date) {
    items.push(`预报 ${forecast.date}`);
  }
  if (forecast.week) {
    items.push(forecast.week);
  }
  push("最高", forecast.temp_max, "°C");
  push("最低", forecast.temp_min, "°C");
  if (forecast.weather_day) {
    items.push(`白天 ${forecast.weather_day}`);
  }
  if (forecast.weather_night) {
    items.push(`夜间 ${forecast.weather_night}`);
  }
  if (forecast.sunrise) {
    items.push(`日出 ${forecast.sunrise}`);
  }
  if (forecast.sunset) {
    items.push(`日落 ${forecast.sunset}`);
  }
  return items;
}

export function collectHourlySummary(data) {
  const hourly = data?.hourly_forecast?.[0];
  if (!hourly) {
    return [];
  }

  const items = [];
  const push = (label, value, unit = "") => {
    const formatted = formatNumber(value, unit);
    if (formatted !== null) {
      items.push(`${label} ${formatted}`);
    }
  };

  if (hourly.time) {
    items.push(`小时 ${hourly.time}`);
  }
  if (hourly.weather) {
    items.push(hourly.weather);
  }
  push("温度", hourly.temperature, "°C");
  push("体感", hourly.feels_like, "°C");
  push("风速", hourly.wind_speed, "km/h");
  push("湿度", hourly.humidity, "%");
  push("降水", hourly.precip, "mm");
  push("降水概率", hourly.pop, "%");
  return items;
}

export function collectLifeIndexSummary(data) {
  const indices = data?.life_indices;
  if (!indices) {
    return [];
  }

  const order = [
    "clothing",
    "uv",
    "car_wash",
    "drying",
    "exercise",
    "travel",
    "umbrella",
    "air_purifier",
    "pollen",
  ];
  const labels = {
    clothing: "穿衣",
    uv: "紫外线",
    car_wash: "洗车",
    drying: "晾晒",
    exercise: "运动",
    travel: "出行",
    umbrella: "雨伞",
    air_purifier: "净化器",
    pollen: "花粉",
  };

  return order
    .map((key) => {
      const item = indices[key];
      if (!item) {
        return null;
      }
      const pieces = [labels[key]];
      if (item.level) {
        pieces.push(item.level);
      }
      if (item.brief) {
        pieces.push(item.brief);
      }
      return pieces.join(" ");
    })
    .filter(Boolean);
}

export function pickWeatherText(data) {
  const temperature = Number(data?.temperature);
  const weather = String(data?.weather ?? "").trim();
  const fallbackTemp = Number.isFinite(temperature) ? Math.round(temperature) : null;
  const tempText = fallbackTemp === null ? "--°C" : `${fallbackTemp}°C`;
  const weatherText = weather || "天气未知";
  return `${tempText} / ${weatherText}`;
}
