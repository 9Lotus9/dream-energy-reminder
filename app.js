const MAX_ENERGY = 100;
const RECOVERY_MS = 2 * 60 * 1000;
const STORAGE_KEY = "dream-clear-energy-record";

const elements = {
  time: document.querySelector("#last-used-time"), energy: document.querySelector("#remaining-energy"),
  value: document.querySelector("#energy-value"), fill: document.querySelector("#progress-fill"),
  message: document.querySelector("#recovery-message"), badge: document.querySelector("#status-badge"),
  notificationButton: document.querySelector("#notification-button"), notificationCopy: document.querySelector("#notification-copy"), toast: document.querySelector("#toast")
};
let record = null;
let notifiedForCurrentRecord = false;
let pushSubscription = null;
const pushServer = window.PUSH_SERVER_URL;

function pad(value) { return String(value).padStart(2, "0"); }
function localDateTime(date) { return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`; }
function showToast(message) { elements.toast.textContent = message; elements.toast.classList.add("show"); setTimeout(() => elements.toast.classList.remove("show"), 2800); }
function currentEnergy() { if (!record) return null; return Math.min(MAX_ENERGY, record.energy + Math.floor(Math.max(0, Date.now() - record.time) / RECOVERY_MS)); }
function formatRemaining(ms) { const totalSeconds = Math.ceil(ms / 1000); return `${Math.floor(totalSeconds / 60)} 分 ${pad(totalSeconds % 60)} 秒`; }
function updateDisplay() {
  const energy = currentEnergy();
  if (energy === null) return;
  elements.value.textContent = energy;
  elements.fill.style.width = `${energy}%`;
  if (energy >= MAX_ENERGY) {
    elements.badge.textContent = "体力已满"; elements.message.textContent = "体力已恢复至 100 点，快去闯关吧！";
    if (!notifiedForCurrentRecord) { notifyFull(); notifiedForCurrentRecord = true; }
    return;
  }
  const nextPointAt = record.time + (Math.floor((Date.now() - record.time) / RECOVERY_MS) + 1) * RECOVERY_MS;
  const fullAt = record.time + (MAX_ENERGY - record.energy) * RECOVERY_MS;
  elements.badge.textContent = "恢复中";
  elements.message.textContent = `${formatRemaining(nextPointAt - Date.now())} 后恢复 1 点 · ${new Date(fullAt).toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" })} 满体`;
}
function notifyFull() {
  showToast("体力已经恢复满啦！");
  if ("Notification" in window && Notification.permission === "granted") new Notification("梦幻消除战体力已满", { body: "体力已恢复至 100 点，快去闯关吧！", icon: "icon-192.svg" });
}
async function saveRecord() {
  const energy = Number(elements.energy.value); const time = new Date(elements.time.value).getTime();
  if (!elements.time.value || !Number.isInteger(energy) || energy < 0 || energy > MAX_ENERGY) { showToast("请填写正确的时间和 0–100 的体力值"); return; }
  record = { time, energy }; notifiedForCurrentRecord = false; localStorage.setItem(STORAGE_KEY, JSON.stringify(record)); updateDisplay();
  const synced = await schedulePushReminder();
  showToast(synced ? "已开始计算，满体提醒已同步" : "已开始计算；请点击开启提醒以同步满体通知");
}
function base64ToUint8Array(value) { const padded = `${value}${"=".repeat((4 - value.length % 4) % 4)}`.replace(/-/g, "+").replace(/_/g, "/"); return Uint8Array.from(atob(padded), c => c.charCodeAt(0)); }
async function schedulePushReminder() {
  if (!pushSubscription || !record || !pushServer || record.energy >= MAX_ENERGY) return false;
  const fullAt = record.time + (MAX_ENERGY - record.energy) * RECOVERY_MS;
  try {
    const response = await fetch(`${pushServer}/schedule`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ subscription: pushSubscription.toJSON(), fullAt }), keepalive: true });
    return response.ok;
  } catch { return false; }
}
function updateNotificationUI() {
  if (!("Notification" in window)) { elements.notificationButton.disabled = true; elements.notificationCopy.textContent = "此浏览器不支持系统通知。"; return; }
  const granted = Notification.permission === "granted"; elements.notificationButton.textContent = granted && pushSubscription ? "后台提醒已开启" : "开启后台提醒"; elements.notificationCopy.textContent = granted && pushSubscription ? "满体时间已同步到后台，关闭应用后也会提醒。" : "请开启并同步后台满体提醒。";
}
document.querySelector("#save-record").addEventListener("click", saveRecord);
document.querySelector("#use-current-time").addEventListener("click", () => { elements.time.value = localDateTime(new Date()); showToast("已填入现在时间"); });
document.querySelector("#decrease").addEventListener("click", () => { elements.energy.value = Math.max(0, (Number(elements.energy.value) || 0) - 1); });
document.querySelector("#increase").addEventListener("click", () => { elements.energy.value = Math.min(MAX_ENERGY, (Number(elements.energy.value) || 0) + 1); });
elements.notificationButton.addEventListener("click", async () => {
  if (!("Notification" in window)) return;
  const permission = await Notification.requestPermission(); updateNotificationUI();
  if (permission !== "granted") { showToast("请在浏览器设置中允许通知"); return; }
  try {
    if (!pushServer || !("PushManager" in window)) throw new Error("unsupported");
    const registration = await navigator.serviceWorker.ready;
    const { publicKey } = await (await fetch(`${pushServer}/config`)).json();
    pushSubscription = await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: base64ToUint8Array(publicKey) });
    const synced = await schedulePushReminder(); updateNotificationUI();
    showToast(synced ? "已开启并同步后台满体提醒" : "通知权限已开启，但后台同步失败，请检查网络后重试");
  } catch { showToast("请先添加到主屏幕后，再开启后台提醒"); }
});
try { record = JSON.parse(localStorage.getItem(STORAGE_KEY)); } catch { record = null; }
if (record) { elements.time.value = localDateTime(new Date(record.time)); elements.energy.value = record.energy; updateDisplay(); } else { elements.time.value = localDateTime(new Date()); }
updateNotificationUI(); setInterval(updateDisplay, 1000);
if ("serviceWorker" in navigator) navigator.serviceWorker.register("sw.js").then(async registration => { pushSubscription = await registration.pushManager.getSubscription(); updateNotificationUI(); });
