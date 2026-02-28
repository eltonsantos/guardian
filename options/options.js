import {
  storageGet, storageSet,
  normalizeDomain, normalizeKeyword,
  isLikelyDomain, isKeywordAllowed,
  derivePasswordHash, sha256Hex,
  safeUrlForDisplay
} from "../shared/utils.js";

import { rebuildDynamicRules } from "../shared/rules.js";
import { hasPassword, verifyCredential } from "../shared/auth.js";
import { isPro, activateLocalKey, openPaymentPage, getProStatus } from "../shared/license.js";
import { detectDNS, getDNSStatus, getDNSHistory, getProtectionScore } from "../shared/dns-detector.js";

let unlockedUntil = 0;
function isUnlocked() { return Date.now() < unlockedUntil; }
function setUnlocked(minutes = 10) { unlockedUntil = Date.now() + minutes * 60 * 1000; }

const ALL_TABS = ["rules", "protection", "network", "logs", "subscription", "about"];

async function isSetupComplete() {
  const { setupComplete } = await storageGet(["setupComplete"]);
  return Boolean(setupComplete);
}

async function refreshIncognitoStatus() {
  const statusEl = document.getElementById("incognitoStatus");
  const hintEl = document.getElementById("incognitoHint");
  if (!statusEl || !hintEl) return;

  try {
    const allowed = await chrome.extension.isAllowedIncognitoAccess();
    statusEl.textContent = allowed ? "Enabled" : "Not enabled";
    statusEl.classList.toggle("ok", allowed);
    statusEl.classList.toggle("warn", !allowed);
    hintEl.textContent = allowed
      ? "Guardian can enforce blocking in Incognito windows."
      : "To block in Incognito, open chrome://extensions \u2192 Guardian \u2192 enable 'Allow in Incognito'.";
  } catch (_) {
    statusEl.textContent = "Unknown";
    hintEl.textContent = "Unable to detect Incognito permission in this context.";
  }
}

async function requireUnlockedOrPrompt() {
  const { lockEnabled, pwHashHex } = await storageGet(["lockEnabled", "pwHashHex"]);
  if (lockEnabled === false) return true;
  if (!pwHashHex) return true;
  if (isUnlocked()) return true;
  alert("Guardian settings are locked. Go to Protection tab and unlock with your password.");
  return false;
}

function setTab(name) {
  document.querySelectorAll(".navbtn").forEach(b => b.classList.toggle("active", b.dataset.tab === name));
  ALL_TABS.forEach(t => {
    const el = document.getElementById(`tab-${t}`);
    if (el) el.style.display = (t === name) ? "block" : "none";
  });

  if (name === "network") refreshNetworkTab();
  if (name === "subscription") refreshSubscriptionTab();
}

async function refreshHeader() {
  const { enabled, setupComplete } = await storageGet(["enabled", "setupComplete"]);
  const en = enabled !== false;
  document.getElementById("enabledToggle").checked = en;
  const badge = document.getElementById("statusBadge");
  badge.classList.toggle("on", en);
  badge.classList.toggle("off", !en);
  badge.textContent = (setupComplete ? (en ? "Protection ON" : "Protection OFF") : "Setup required");

  const pro = await isPro();
  const proBadge = document.getElementById("proBadgeTop");
  if (proBadge) proBadge.classList.toggle("hidden", !pro);
}

function renderList(container, items, onDelete) {
  container.innerHTML = "";
  const arr = Array.isArray(items) ? items : [];
  if (!arr.length) {
    const p = document.createElement("div");
    p.className = "small";
    p.textContent = "No items.";
    container.appendChild(p);
    return;
  }
  arr.forEach((val, idx) => {
    const row = document.createElement("div");
    row.className = "chip";
    const span = document.createElement("span");
    span.textContent = val;
    const meta = document.createElement("div");
    meta.className = "meta";
    const del = document.createElement("button");
    del.className = "btn";
    del.textContent = "Remove";
    del.addEventListener("click", () => onDelete(idx));
    meta.appendChild(del);
    row.appendChild(span);
    row.appendChild(meta);
    container.appendChild(row);
  });
}

async function refreshRules() {
  const data = await storageGet(["blockedDomains", "blockedKeywords", "allowDomains"]);
  renderList(document.getElementById("blockedDomainsList"), data.blockedDomains, async (idx) => {
    if (!(await requireUnlockedOrPrompt())) return;
    const { blockedDomains, blockedSubdomains } = await storageGet(["blockedDomains", "blockedSubdomains"]);
    const bd = (blockedDomains || []).slice();
    const dom = normalizeDomain(bd[idx] || "");
    bd.splice(idx, 1);
    const bs = (blockedSubdomains || []).filter(d => normalizeDomain(d) !== dom);
    await storageSet({ blockedDomains: bd, blockedSubdomains: bs });
    refreshRules();
  });
  renderList(document.getElementById("blockedKeywordsList"), data.blockedKeywords, async (idx) => {
    if (!(await requireUnlockedOrPrompt())) return;
    const { blockedKeywords } = await storageGet(["blockedKeywords"]);
    const bk = (blockedKeywords || []).slice(); bk.splice(idx, 1);
    await storageSet({ blockedKeywords: bk });
    refreshRules();
  });
  renderList(document.getElementById("allowDomainsList"), data.allowDomains, async (idx) => {
    if (!(await requireUnlockedOrPrompt())) return;
    const { allowDomains, allowSubdomains } = await storageGet(["allowDomains", "allowSubdomains"]);
    const ad = (allowDomains || []).slice();
    const dom = normalizeDomain(ad[idx] || "");
    ad.splice(idx, 1);
    const as = (allowSubdomains || []).filter(d => normalizeDomain(d) !== dom);
    await storageSet({ allowDomains: ad, allowSubdomains: as });
    refreshRules();
  });
}

async function addDomain() {
  if (!(await requireUnlockedOrPrompt())) return;
  const input = document.getElementById("addDomain");
  const dom = normalizeDomain(input.value);
  if (!isLikelyDomain(dom)) { alert("Invalid domain. Example: example.com"); return; }
  const { blockedDomains, blockedSubdomains } = await storageGet(["blockedDomains", "blockedSubdomains"]);
  const bd = Array.isArray(blockedDomains) ? blockedDomains : [];
  const bs = Array.isArray(blockedSubdomains) ? blockedSubdomains : [];
  if (!bd.includes(dom)) bd.unshift(dom);
  if (!bs.includes(dom)) bs.unshift(dom);
  await storageSet({ blockedDomains: bd, blockedSubdomains: bs });
  input.value = "";
  refreshRules();
}

async function addKeyword() {
  if (!(await requireUnlockedOrPrompt())) return;
  const input = document.getElementById("addKeyword");
  const kw = normalizeKeyword(input.value);
  if (!isKeywordAllowed(kw)) { alert("Keyword must have at least 3 characters."); return; }
  const { blockedKeywords } = await storageGet(["blockedKeywords"]);
  const bk = Array.isArray(blockedKeywords) ? blockedKeywords : [];
  if (!bk.includes(kw)) bk.unshift(kw);
  await storageSet({ blockedKeywords: bk });
  input.value = "";
  refreshRules();
}

async function addAllowDomain() {
  if (!(await requireUnlockedOrPrompt())) return;
  const input = document.getElementById("addAllowDomain");
  const dom = normalizeDomain(input.value);
  if (!isLikelyDomain(dom)) { alert("Invalid domain. Example: trusted.com"); return; }
  const { allowDomains, allowSubdomains } = await storageGet(["allowDomains", "allowSubdomains"]);
  const ad = Array.isArray(allowDomains) ? allowDomains : [];
  const as = Array.isArray(allowSubdomains) ? allowSubdomains : [];
  if (!ad.includes(dom)) ad.unshift(dom);
  if (!as.includes(dom)) as.unshift(dom);
  await storageSet({ allowDomains: ad, allowSubdomains: as });
  input.value = "";
  refreshRules();
}

async function rebuildNow() {
  if (!(await requireUnlockedOrPrompt())) return;
  const el = document.getElementById("rebuildStatus");
  el.textContent = "Rebuilding rules...";
  await rebuildDynamicRules();
  el.textContent = "Done.";
  setTimeout(() => el.textContent = "", 1500);
}

async function refreshLogs() {
  const { blockLog } = await storageGet(["blockLog"]);
  const list = document.getElementById("logsList");
  list.innerHTML = "";
  const arr = Array.isArray(blockLog) ? blockLog : [];
  if (!arr.length) {
    const p = document.createElement("div");
    p.className = "small";
    p.textContent = "No logs.";
    list.appendChild(p);
    return;
  }
  arr.forEach(item => {
    const div = document.createElement("div");
    div.className = "chip";
    const left = document.createElement("span");
    left.textContent = safeUrlForDisplay(item.url);
    const meta = document.createElement("div");
    meta.className = "meta";
    const s = document.createElement("span");
    s.className = "small";
    s.textContent = new Date(item.at).toLocaleString();
    meta.appendChild(s);
    div.appendChild(left);
    div.appendChild(meta);
    list.appendChild(div);
  });
}

async function clearLogs() {
  if (!(await requireUnlockedOrPrompt())) return;
  await storageSet({ blockLog: [], blockedCount: 0 });
  refreshLogs();
  refreshHeader();
}

async function refreshProtection() {
  const data = await storageGet(["lockEnabled", "blockIncognito"]);
  document.getElementById("lockToggle").checked = data.lockEnabled !== false;
  const bi = document.getElementById("blockIncognitoToggle");
  if (bi) bi.checked = data.blockIncognito !== false;
}

async function setPassword() {
  const p1 = document.getElementById("pw1").value;
  const p2 = document.getElementById("pw2").value;
  if (!p1 || p1.length < 8) { document.getElementById("pwStatus").textContent = "Password must be at least 8 characters."; return; }
  if (p1 !== p2) { document.getElementById("pwStatus").textContent = "Passwords do not match."; return; }

  const { pwSaltB64, pwHashHex, setupComplete, recommendedBlockedDomains, recommendedBlockedKeywords } = await storageGet([
    "pwSaltB64", "pwHashHex", "setupComplete", "recommendedBlockedDomains", "recommendedBlockedKeywords"
  ]);

  if (pwHashHex) {
    if (!isUnlocked()) {
      document.getElementById("pwStatus").textContent = "You must unlock first to change your password. Use your current password or recovery code/phrase below.";
      return;
    }
  }

  const res = await derivePasswordHash(p1, pwSaltB64);
  await storageSet({ pwSaltB64: res.saltB64, pwHashHex: res.hashHex, lockEnabled: true });

  document.getElementById("pw1").value = "";
  document.getElementById("pw2").value = "";

  if (!setupComplete) {
    const recD = Array.isArray(recommendedBlockedDomains) ? recommendedBlockedDomains : [];
    const recK = Array.isArray(recommendedBlockedKeywords) ? recommendedBlockedKeywords : [];
    await storageSet({
      setupComplete: true,
      enabled: true,
      blockedDomains: recD,
      blockedSubdomains: recD,
      blockedKeywords: recK
    });
    document.getElementById("pwStatus").textContent = "Password created. Setup completed and protection enabled.";
  } else {
    document.getElementById("pwStatus").textContent = "Password saved.";
  }
  setUnlocked(15);
  await refreshHeader();
  await refreshRules();
  await refreshIncognitoStatus();
}

async function genRecovery() {
  const { pwHashHex } = await storageGet(["pwHashHex"]);
  if (pwHashHex && !(await requireUnlockedOrPrompt())) return;

  const res = await fetch(chrome.runtime.getURL("assets/wordlist.json"));
  const words = await res.json();

  const codes = [];
  const part = () => Math.random().toString(36).slice(2, 6).toUpperCase();
  for (let i = 0; i < 10; i++) codes.push(`${part()}-${part()}-${part()}`);

  const phrase = [];
  for (let i = 0; i < 12; i++) phrase.push(words[Math.floor(Math.random() * words.length)]);
  const phraseStr = phrase.join(" ");

  const codeHashes = [];
  for (const c of codes) codeHashes.push(await sha256Hex(c));
  const phraseHash = await sha256Hex(phraseStr);

  await storageSet({ recoveryCodeHashes: codeHashes, recoveryPhraseHash: phraseHash });

  document.getElementById("recoveryCodes").textContent = codes.join("\n");
  document.getElementById("recoveryPhrase").textContent = phraseStr;
  setUnlocked(15);
}

async function authenticate() {
  const v = document.getElementById("authValue").value.trim();
  if (!v) { document.getElementById("authStatus").textContent = "Enter password or recovery code/phrase."; return; }
  const res = await verifyCredential(v);
  if (res.ok) {
    setUnlocked(20);
    document.getElementById("authStatus").textContent = res.method === "recovery_code"
      ? "Unlocked (recovery code used). Code invalidated."
      : "Unlocked for 20 minutes.";
    document.getElementById("authValue").value = "";
    return;
  }
  document.getElementById("authStatus").textContent = "Authentication failed.";
}

async function lockNow() {
  unlockedUntil = 0;
  document.getElementById("authStatus").textContent = "Locked.";
}

async function toggleEnabled(e) {
  const setupDone = await isSetupComplete();
  if (!setupDone) {
    await refreshHeader();
    setTab("protection");
    alert("Complete password setup first.");
    return;
  }
  if (!(await requireUnlockedOrPrompt())) {
    await refreshHeader();
    return;
  }
  await storageSet({ enabled: e.target.checked });
  await refreshHeader();
}

async function toggleLock(e) {
  const { pwHashHex } = await storageGet(["pwHashHex"]);
  if (pwHashHex && !(await requireUnlockedOrPrompt())) {
    await refreshProtection();
    return;
  }
  const setupDone = await isSetupComplete();
  if (!setupDone && !e.target.checked) {
    e.target.checked = true;
    await storageSet({ lockEnabled: true });
    return;
  }
  await storageSet({ lockEnabled: e.target.checked });
}

async function toggleIncognitoBlock(e) {
  const setupDone = await isSetupComplete();
  if (!setupDone) {
    e.target.checked = true;
    await storageSet({ blockIncognito: true });
    setTab("protection");
    alert("Complete password setup first.");
    return;
  }
  if (!(await requireUnlockedOrPrompt())) {
    await refreshProtection();
    return;
  }
  await storageSet({ blockIncognito: e.target.checked });
}

// --- Network tab (Pro) ---

async function refreshNetworkTab() {
  const pro = await isPro();
  const gate = document.getElementById("networkProGate");
  const content = document.getElementById("networkContent");

  if (!pro) {
    gate?.classList.remove("hidden");
    if (content) content.style.opacity = "0.3";
    if (content) content.style.pointerEvents = "none";
    return;
  }

  gate?.classList.add("hidden");
  if (content) content.style.opacity = "1";
  if (content) content.style.pointerEvents = "auto";

  const dnsStatus = await getDNSStatus();
  const dot = document.getElementById("optDnsDot");
  const label = document.getElementById("optDnsLabel");
  const timeEl = document.getElementById("optDnsTime");

  if (dnsStatus.active) {
    dot.className = "dns-indicator active";
    label.textContent = `Active \u2014 ${dnsStatus.provider}`;
  } else if (dnsStatus.checkedAt) {
    dot.className = "dns-indicator inactive";
    label.textContent = "Not detected";
  } else {
    dot.className = "dns-indicator unknown";
    label.textContent = "Not checked yet";
  }

  if (dnsStatus.checkedAt) {
    const d = new Date(dnsStatus.checkedAt);
    timeEl.textContent = `Last checked: ${d.toLocaleString()}`;
  }

  const { enabled, lockEnabled } = await storageGet(["enabled", "lockEnabled"]);
  const score = getProtectionScore(dnsStatus, enabled !== false, lockEnabled !== false);
  document.getElementById("scoreValue").textContent = `${score}%`;

  const circle = document.getElementById("scoreCircle");
  if (score >= 80) circle.className = "score-circle high";
  else if (score >= 50) circle.className = "score-circle medium";
  else circle.className = "score-circle low";

  const breakdown = document.getElementById("scoreBreakdown");
  breakdown.innerHTML = `
    <div class="score-item"><span class="score-dot ${enabled !== false ? "on" : "off"}"></span> Extension: ${enabled !== false ? "ON" : "OFF"} (+30)</div>
    <div class="score-item"><span class="score-dot ${lockEnabled !== false ? "on" : "off"}"></span> Lock: ${lockEnabled !== false ? "ON" : "OFF"} (+20)</div>
    <div class="score-item"><span class="score-dot ${dnsStatus.active ? "on" : "off"}"></span> DNS: ${dnsStatus.active ? "Active" : "Inactive"} (+50)</div>
  `;

  const history = await getDNSHistory();
  const histList = document.getElementById("dnsHistoryList");
  histList.innerHTML = "";
  if (!history.length) {
    histList.innerHTML = '<div class="small">No history yet.</div>';
  } else {
    history.slice(0, 20).forEach(h => {
      const div = document.createElement("div");
      div.className = "chip";
      const left = document.createElement("span");
      left.textContent = h.active ? `Active (${h.provider})` : "Not detected";
      left.style.color = h.active ? "var(--success)" : "var(--muted)";
      const meta = document.createElement("div");
      meta.className = "meta";
      const s = document.createElement("span");
      s.className = "small";
      s.textContent = new Date(h.checkedAt).toLocaleString();
      meta.appendChild(s);
      div.appendChild(left);
      div.appendChild(meta);
      histList.appendChild(div);
    });
  }
}

async function checkDnsNow() {
  const label = document.getElementById("optDnsLabel");
  label.textContent = "Checking...";
  await detectDNS();
  await refreshNetworkTab();
}

// --- Subscription tab ---

async function refreshSubscriptionTab() {
  const status = await getProStatus();
  const indicator = document.getElementById("planIndicator");
  const label = document.getElementById("planLabel");
  const detail = document.getElementById("planDetail");
  const upgradeBtn = document.getElementById("subUpgradeBtn");

  if (status.isPro) {
    indicator.className = "plan-indicator active";
    label.textContent = "Guardian Pro";
    detail.textContent = status.provider === "extpay"
      ? "Managed via ExtensionPay/Stripe."
      : `License key: ${status.key || "Active"}`;
    upgradeBtn.textContent = "Active";
    upgradeBtn.disabled = true;
  } else {
    indicator.className = "plan-indicator free";
    label.textContent = "Free";
    detail.textContent = "Upgrade to unlock network protection features.";
    upgradeBtn.disabled = false;
  }
}

async function activateLicense() {
  const input = document.getElementById("optLicenseKey");
  const statusEl = document.getElementById("optActivateStatus");
  const key = (input.value || "").trim();

  if (!key) {
    statusEl.textContent = "Please enter a license key.";
    statusEl.style.color = "var(--danger)";
    return;
  }

  const result = await activateLocalKey(key);
  if (result.ok) {
    statusEl.textContent = "License activated! Guardian Pro is now active.";
    statusEl.style.color = "var(--success)";
    input.value = "";
    await refreshHeader();
    await refreshSubscriptionTab();
    await refreshNetworkTab();
  } else {
    statusEl.textContent = "Invalid license key. Format: GPRO-XXXX-XXXX-XXXX";
    statusEl.style.color = "var(--danger)";
  }
}

// --- Event listeners ---

document.querySelectorAll(".navbtn").forEach(b => b.addEventListener("click", () => setTab(b.dataset.tab)));

document.getElementById("enabledToggle").addEventListener("change", toggleEnabled);

document.getElementById("addDomainBtn").addEventListener("click", addDomain);
document.getElementById("addKeywordBtn").addEventListener("click", addKeyword);
document.getElementById("addAllowDomainBtn").addEventListener("click", addAllowDomain);

document.getElementById("addDomain").addEventListener("keydown", (e) => { if (e.key === "Enter") addDomain(); });
document.getElementById("addKeyword").addEventListener("keydown", (e) => { if (e.key === "Enter") addKeyword(); });
document.getElementById("addAllowDomain").addEventListener("keydown", (e) => { if (e.key === "Enter") addAllowDomain(); });

document.getElementById("rebuildBtn").addEventListener("click", rebuildNow);

document.getElementById("clearLogsBtn").addEventListener("click", clearLogs);

document.getElementById("lockToggle").addEventListener("change", toggleLock);
document.getElementById("blockIncognitoToggle").addEventListener("change", toggleIncognitoBlock);
document.getElementById("setPwBtn").addEventListener("click", setPassword);
document.getElementById("genRecoveryBtn").addEventListener("click", genRecovery);
document.getElementById("authBtn").addEventListener("click", authenticate);
document.getElementById("lockNowBtn").addEventListener("click", lockNow);

document.getElementById("checkDnsBtn")?.addEventListener("click", checkDnsNow);
document.getElementById("openWizardBtn")?.addEventListener("click", () => {
  chrome.tabs.create({ url: chrome.runtime.getURL("wizard/wizard.html") });
});

document.getElementById("networkUpgradeBtn")?.addEventListener("click", () => openPaymentPage());
document.getElementById("subUpgradeBtn")?.addEventListener("click", () => openPaymentPage());
document.getElementById("optActivateBtn")?.addEventListener("click", activateLicense);

(async function init() {
  await refreshHeader();
  await refreshRules();
  await refreshLogs();
  await refreshProtection();
  await refreshIncognitoStatus();

  const setupDone = await isSetupComplete();
  const pw = await hasPassword();
  if (!setupDone || !pw) {
    setTab("protection");
    const banner = document.getElementById("setupBanner");
    if (banner) banner.hidden = false;
    return;
  }
  setTab("rules");
})();
