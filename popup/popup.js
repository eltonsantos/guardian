import { storageGet, storageSet, normalizeDomain, normalizeKeyword, isLikelyDomain, isKeywordAllowed } from "../shared/utils.js";
import { hasPassword, verifyCredential } from "../shared/auth.js";
import { isPro, openPaymentPage } from "../shared/license.js";
import { getDNSStatus, getProtectionScore } from "../shared/dns-detector.js";

let unlockedUntil = 0;
function isUnlocked() { return Date.now() < unlockedUntil; }
function setUnlocked(minutes = 10) { unlockedUntil = Date.now() + minutes * 60 * 1000; }

async function refresh() {
  const data = await storageGet(["enabled", "blockedCount", "blockLog", "setupComplete", "installedAt", "lockEnabled"]);
  const pw = await hasPassword();
  const setupDone = Boolean(data.setupComplete) && pw;

  const installedEl = document.getElementById("installedAt");
  if (installedEl && data.installedAt) {
    const d = new Date(data.installedAt);
    installedEl.textContent = `Installed: ${d.toLocaleDateString()} ${d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`;
  }

  if (!setupDone) {
    document.getElementById("setupGate")?.classList.remove("hidden");
    document.getElementById("mainUI")?.classList.add("hidden");
    document.getElementById("enabledToggle").checked = false;
    const badge = document.getElementById("statusBadge");
    badge.classList.remove("on");
    badge.classList.add("off");
    badge.textContent = "Setup required";
    return;
  }

  document.getElementById("setupGate")?.classList.add("hidden");
  document.getElementById("mainUI")?.classList.remove("hidden");
  const enabled = data.enabled !== false;

  const badge = document.getElementById("statusBadge");
  document.getElementById("enabledToggle").checked = enabled;
  badge.classList.toggle("on", enabled);
  badge.classList.toggle("off", !enabled);
  badge.textContent = enabled ? "Protection ON" : "Protection OFF";

  document.getElementById("blockedCount").textContent = String(data.blockedCount || 0);

  const log = Array.isArray(data.blockLog) ? data.blockLog : [];
  try {
    document.getElementById("lastBlocked").textContent = log.length ? new URL(log[0].url).hostname : "\u2014";
  } catch (_) {
    document.getElementById("lastBlocked").textContent = "\u2014";
  }

  const pro = await isPro();
  const proBadge = document.getElementById("proBadge");
  const dnsCard = document.getElementById("dnsStatusCard");
  const upgradeCta = document.getElementById("upgradeCta");

  if (pro) {
    proBadge?.classList.remove("hidden");
    dnsCard?.classList.remove("hidden");
    upgradeCta?.classList.add("hidden");
    await refreshDNSStatus(enabled, data.lockEnabled !== false);
  } else {
    proBadge?.classList.add("hidden");
    dnsCard?.classList.add("hidden");
    upgradeCta?.classList.remove("hidden");
  }
}

async function refreshDNSStatus(extensionEnabled, lockEnabled) {
  const dnsStatus = await getDNSStatus();
  const dot = document.getElementById("dnsDot");
  const label = document.getElementById("dnsLabel");
  const scoreEl = document.getElementById("protectionScore");

  if (dnsStatus.active) {
    dot.className = "dns-dot active";
    label.textContent = `Active (${dnsStatus.provider})`;
  } else if (dnsStatus.checkedAt) {
    dot.className = "dns-dot inactive";
    label.textContent = "Not detected";
  } else {
    dot.className = "dns-dot unknown";
    label.textContent = "Not checked yet";
  }

  const score = getProtectionScore(dnsStatus, extensionEnabled, lockEnabled);
  scoreEl.textContent = `${score}%`;
}

async function quickAdd() {
  const input = document.getElementById("quickAdd");
  const raw = input.value.trim();
  if (!raw) return;

  const domain = normalizeDomain(raw);
  const kw = normalizeKeyword(raw);

  if (isLikelyDomain(domain)) {
    const { blockedDomains, blockedSubdomains } = await storageGet(["blockedDomains", "blockedSubdomains"]);
    const bd = Array.isArray(blockedDomains) ? blockedDomains : [];
    const bs = Array.isArray(blockedSubdomains) ? blockedSubdomains : [];
    if (!bd.includes(domain)) bd.unshift(domain);
    if (!bs.includes(domain)) bs.unshift(domain);
    await storageSet({ blockedDomains: bd, blockedSubdomains: bs });
    input.value = "";
    await refresh();
    return;
  }

  if (isKeywordAllowed(kw)) {
    const { blockedKeywords } = await storageGet(["blockedKeywords"]);
    const bk = Array.isArray(blockedKeywords) ? blockedKeywords : [];
    if (!bk.includes(kw)) bk.unshift(kw);
    await storageSet({ blockedKeywords: bk });
    input.value = "";
    await refresh();
    return;
  }

  document.getElementById("quickHint").textContent = "Invalid input. Use a domain like example.com or a keyword with 3+ characters.";
  setTimeout(() => document.getElementById("quickHint").textContent = "Domains must look like example.com. Keywords require 3+ characters.", 2200);
}

document.getElementById("enabledToggle").addEventListener("change", async (e) => {
  const data = await storageGet(["setupComplete", "lockEnabled", "pwHashHex"]);
  const setupDone = Boolean(data.setupComplete) && Boolean(data.pwHashHex);

  if (!setupDone) {
    e.target.checked = false;
    await refresh();
    return;
  }

  if (data.lockEnabled !== false && data.pwHashHex) {
    if (!isUnlocked()) {
      e.target.checked = !e.target.checked;
      showUnlockModal();
      return;
    }
  }

  await storageSet({ enabled: e.target.checked });
  await refresh();
});

document.getElementById("addBtn").addEventListener("click", quickAdd);
document.getElementById("quickAdd").addEventListener("keydown", (e) => { if (e.key === "Enter") quickAdd(); });

document.getElementById("openOptions").addEventListener("click", async (e) => {
  e.preventDefault();
  await chrome.runtime.openOptionsPage();
});
document.getElementById("openGuidePopup")?.addEventListener("click", (e) => {
  e.preventDefault();
  chrome.tabs.create({ url: chrome.runtime.getURL("guide/guide.html") });
});

document.getElementById("openOptions2")?.addEventListener("click", async () => {
  await chrome.runtime.openOptionsPage();
});

document.getElementById("openRules").addEventListener("click", async () => chrome.runtime.openOptionsPage());
document.getElementById("openProtection").addEventListener("click", async () => chrome.runtime.openOptionsPage());
document.getElementById("openLogs").addEventListener("click", async () => chrome.runtime.openOptionsPage());

document.getElementById("upgradeBtn")?.addEventListener("click", () => {
  openPaymentPage();
});

function showUnlockModal() {
  const modal = document.getElementById("unlockModal");
  if (modal) modal.classList.remove("hidden");
  document.getElementById("unlockValue")?.focus();
}

function hideUnlockModal() {
  const modal = document.getElementById("unlockModal");
  if (modal) modal.classList.add("hidden");
  const input = document.getElementById("unlockValue");
  if (input) input.value = "";
  const status = document.getElementById("unlockStatus");
  if (status) status.textContent = "";
}

async function doUnlock() {
  const input = document.getElementById("unlockValue");
  const status = document.getElementById("unlockStatus");
  const v = (input?.value || "").trim();

  if (!v) {
    if (status) status.textContent = "Enter password or recovery code/phrase.";
    return;
  }

  const res = await verifyCredential(v);
  if (res.ok) {
    setUnlocked(20);
    hideUnlockModal();
    if (status) status.textContent = "";
    return;
  }

  if (status) status.textContent = "Authentication failed.";
}

document.getElementById("unlockBtn")?.addEventListener("click", doUnlock);
document.getElementById("unlockValue")?.addEventListener("keydown", (e) => { if (e.key === "Enter") doUnlock(); });
document.getElementById("unlockCancel")?.addEventListener("click", hideUnlockModal);
document.getElementById("unlockModal")?.addEventListener("click", (e) => {
  if (e.target.id === "unlockModal") hideUnlockModal();
});

refresh();
