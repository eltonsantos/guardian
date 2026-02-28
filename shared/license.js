import { storageGet, storageSet } from "./utils.js";
import ExtPay from "./ExtPay.js";

const LICENSE_KEY = "guardianProLicense";
const LICENSE_CACHE_KEY = "guardianProCache";
const EXTPAY_ID = "guardian-pro";

let _extpay = null;

function getExtPay() {
  if (_extpay) return _extpay;
  if (!EXTPAY_ID) return null;
  try {
    _extpay = ExtPay(EXTPAY_ID);
    return _extpay;
  } catch (_) { /* ExtPay not available */ }
  return null;
}

export function initLicense() {
  const ep = getExtPay();
  if (ep && typeof ep.startBackground === "function") {
    ep.startBackground();
  }
}

export async function isPro() {
  const ep = getExtPay();
  if (ep) {
    try {
      const user = await ep.getUser();
      const paid = Boolean(user.paid);
      await storageSet({ [LICENSE_CACHE_KEY]: { paid, ts: Date.now() } });
      return paid;
    } catch (_) {
      const cache = (await storageGet([LICENSE_CACHE_KEY]))[LICENSE_CACHE_KEY];
      return Boolean(cache && cache.paid);
    }
  }
  const data = await storageGet([LICENSE_KEY]);
  return validateLocalKey(data[LICENSE_KEY]);
}

export async function getProStatus() {
  const pro = await isPro();
  const data = await storageGet([LICENSE_KEY, LICENSE_CACHE_KEY]);
  return {
    isPro: pro,
    key: data[LICENSE_KEY] || null,
    cached: data[LICENSE_CACHE_KEY] || null,
    provider: EXTPAY_ID ? "extpay" : "local"
  };
}

export async function activateLocalKey(key) {
  const k = (key || "").trim().toUpperCase();
  if (!validateLocalKey(k)) {
    return { ok: false, reason: "invalid_key" };
  }
  await storageSet({ [LICENSE_KEY]: k });
  return { ok: true };
}

export async function deactivateLocalKey() {
  await chrome.storage.local.remove(LICENSE_KEY);
}

export function openPaymentPage() {
  const ep = getExtPay();
  if (ep) {
    ep.openPaymentPage();
    return;
  }
  chrome.tabs.create({
    url: chrome.runtime.getURL("/upgrade/upgrade.html")
  });
}

export function openTrialPage() {
  const ep = getExtPay();
  if (ep && typeof ep.openTrialPage === "function") {
    ep.openTrialPage(7);
    return;
  }
  chrome.tabs.create({
    url: chrome.runtime.getURL("/upgrade/upgrade.html")
  });
}

function validateLocalKey(key) {
  if (!key || typeof key !== "string") return false;
  const k = key.trim().toUpperCase();
  const pattern = /^GPRO-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/;
  if (!pattern.test(k)) return false;
  const parts = k.replace("GPRO-", "").replace(/-/g, "");
  let sum = 0;
  for (let i = 0; i < parts.length - 1; i++) {
    sum += parts.charCodeAt(i);
  }
  const check = sum % 36;
  const expected = check < 10
    ? String.fromCharCode(48 + check)
    : String.fromCharCode(65 + check - 10);
  return parts[parts.length - 1] === expected;
}

export function generateLicenseKey() {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  const randomPart = () => {
    let s = "";
    for (let i = 0; i < 4; i++) s += chars[Math.floor(Math.random() * chars.length)];
    return s;
  };
  const p1 = randomPart();
  const p2 = randomPart();
  const base = p1 + p2;
  let sum = 0;
  for (let i = 0; i < base.length; i++) sum += base.charCodeAt(i);
  const check = sum % 36;
  const checkChar = check < 10
    ? String.fromCharCode(48 + check)
    : String.fromCharCode(65 + check - 10);
  const p3 = base.slice(0, 3) + checkChar;
  return `GPRO-${p1}-${p2}-${p3}`;
}
