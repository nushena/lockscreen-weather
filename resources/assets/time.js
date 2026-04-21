export const pad2 = (value) => String(value).padStart(2, "0");

export function renderTime(hourEl, minuteEl, secondEl, dateEl) {
  const now = new Date();
  hourEl.textContent = pad2(now.getHours());
  minuteEl.textContent = pad2(now.getMinutes());
  secondEl.textContent = pad2(now.getSeconds());

  const weekday = ["周日", "周一", "周二", "周三", "周四", "周五", "周六"][now.getDay()];
  dateEl.textContent = `${now.getFullYear()} · ${pad2(now.getMonth() + 1)} · ${pad2(now.getDate())} · ${weekday}`;
}
