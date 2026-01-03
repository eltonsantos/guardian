import {
  storageGet, storageSet,
  normalizeDomain, normalizeKeyword,
  isLikelyDomain, isKeywordAllowed,
  derivePasswordHash, sha256Hex,
  safeUrlForDisplay
} from "../shared/utils.js";

import { rebuildDynamicRules } from "../shared/rules.js";
import { hasPassword, verifyCredential } from "../shared/auth.js";

let unlockedUntil = 0;
function isUnlocked(){ return Date.now() < unlockedUntil; }
function setUnlocked(minutes=10){ unlockedUntil = Date.now() + minutes*60*1000; }

async function isSetupComplete(){
  const { setupComplete } = await storageGet(["setupComplete"]);
  return Boolean(setupComplete);
}

async function refreshIncognitoStatus(){
  const statusEl = document.getElementById("incognitoStatus");
  const hintEl = document.getElementById("incognitoHint");
  if(!statusEl || !hintEl) return;

  try{
    const allowed = await chrome.extension.isAllowedIncognitoAccess();
    statusEl.textContent = allowed ? "Enabled" : "Not enabled";
    statusEl.classList.toggle("ok", allowed);
    statusEl.classList.toggle("warn", !allowed);
    hintEl.textContent = allowed
      ? "Guardian can enforce blocking in Incognito windows."
      : "To block in Incognito, open chrome://extensions → Guardian → enable 'Allow in Incognito'.";
  }catch(e){
    statusEl.textContent = "Unknown";
    hintEl.textContent = "Unable to detect Incognito permission in this context.";
  }
}

async function requireUnlockedOrPrompt(){
  const { lockEnabled, pwHashHex } = await storageGet(["lockEnabled","pwHashHex"]);
  if(lockEnabled === false) return true;
  // If lock enabled but no password set yet, allow setup
  if(!pwHashHex) return true;
  if(isUnlocked()) return true;
  alert("Guardian settings are locked. Go to Protection tab and unlock with your password.");
  return false;
}

function setTab(name){
  document.querySelectorAll(".navbtn").forEach(b=>b.classList.toggle("active", b.dataset.tab===name));
  ["rules","protection","logs","about"].forEach(t=>{
    document.getElementById(`tab-${t}`).style.display = (t===name) ? "block" : "none";
  });
}

async function refreshHeader(){
  const { enabled, setupComplete } = await storageGet(["enabled","setupComplete"]);
  const en = enabled !== false;
  document.getElementById("enabledToggle").checked = en;
  const badge = document.getElementById("statusBadge");
  badge.classList.toggle("on", en);
  badge.classList.toggle("off", !en);
  badge.textContent = (setupComplete ? (en ? "Protection ON" : "Protection OFF") : "Setup required");
}

function renderList(container, items, onDelete){
  container.innerHTML = "";
  const arr = Array.isArray(items) ? items : [];
  if(!arr.length){
    const p = document.createElement("div");
    p.className = "small";
    p.textContent = "No items.";
    container.appendChild(p);
    return;
  }
  arr.forEach((val, idx)=>{
    const row = document.createElement("div");
    row.className = "chip";
    const span = document.createElement("span");
    span.textContent = val;
    const meta = document.createElement("div");
    meta.className = "meta";
    const del = document.createElement("button");
    del.className = "btn";
    del.textContent = "Remove";
    del.addEventListener("click", ()=> onDelete(idx));
    meta.appendChild(del);
    row.appendChild(span);
    row.appendChild(meta);
    container.appendChild(row);
  });
}

async function refreshRules(){
  const data = await storageGet(["blockedDomains","blockedKeywords","allowDomains"]);
  renderList(document.getElementById("blockedDomainsList"), data.blockedDomains, async (idx)=>{
    if(!(await requireUnlockedOrPrompt())) return;
    const { blockedDomains, blockedSubdomains } = await storageGet(["blockedDomains","blockedSubdomains"]);
    const bd = (blockedDomains||[]).slice();
    const dom = normalizeDomain(bd[idx] || "");
    bd.splice(idx,1);
    const bs = (blockedSubdomains||[]).filter(d => normalizeDomain(d)!==dom);
    await storageSet({ blockedDomains: bd, blockedSubdomains: bs });
    refreshRules();
  });
  renderList(document.getElementById("blockedKeywordsList"), data.blockedKeywords, async (idx)=>{
    if(!(await requireUnlockedOrPrompt())) return;
    const { blockedKeywords } = await storageGet(["blockedKeywords"]);
    const bk = (blockedKeywords||[]).slice(); bk.splice(idx,1);
    await storageSet({ blockedKeywords: bk });
    refreshRules();
  });
  renderList(document.getElementById("allowDomainsList"), data.allowDomains, async (idx)=>{
    if(!(await requireUnlockedOrPrompt())) return;
    const { allowDomains, allowSubdomains } = await storageGet(["allowDomains","allowSubdomains"]);
    const ad = (allowDomains||[]).slice();
    const dom = normalizeDomain(ad[idx] || "");
    ad.splice(idx,1);
    const as = (allowSubdomains||[]).filter(d => normalizeDomain(d)!==dom);
    await storageSet({ allowDomains: ad, allowSubdomains: as });
    refreshRules();
  });
}

async function addDomain(){
  if(!(await requireUnlockedOrPrompt())) return;
  const input = document.getElementById("addDomain");
  const dom = normalizeDomain(input.value);
  if(!isLikelyDomain(dom)){ alert("Invalid domain. Example: example.com"); return; }
  const { blockedDomains, blockedSubdomains } = await storageGet(["blockedDomains","blockedSubdomains"]);
  const bd = Array.isArray(blockedDomains) ? blockedDomains : [];
  const bs = Array.isArray(blockedSubdomains) ? blockedSubdomains : [];
  if(!bd.includes(dom)) bd.unshift(dom);
  if(!bs.includes(dom)) bs.unshift(dom);
  await storageSet({ blockedDomains: bd, blockedSubdomains: bs });
  input.value = "";
  refreshRules();
}

async function addKeyword(){
  if(!(await requireUnlockedOrPrompt())) return;
  const input = document.getElementById("addKeyword");
  const kw = normalizeKeyword(input.value);
  if(!isKeywordAllowed(kw)){ alert("Keyword must have at least 3 characters."); return; }
  const { blockedKeywords } = await storageGet(["blockedKeywords"]);
  const bk = Array.isArray(blockedKeywords) ? blockedKeywords : [];
  if(!bk.includes(kw)) bk.unshift(kw);
  await storageSet({ blockedKeywords: bk });
  input.value = "";
  refreshRules();
}

async function addAllowDomain(){
  if(!(await requireUnlockedOrPrompt())) return;
  const input = document.getElementById("addAllowDomain");
  const dom = normalizeDomain(input.value);
  if(!isLikelyDomain(dom)){ alert("Invalid domain. Example: trusted.com"); return; }
  const { allowDomains, allowSubdomains } = await storageGet(["allowDomains","allowSubdomains"]);
  const ad = Array.isArray(allowDomains) ? allowDomains : [];
  const as = Array.isArray(allowSubdomains) ? allowSubdomains : [];
  if(!ad.includes(dom)) ad.unshift(dom);
  if(!as.includes(dom)) as.unshift(dom);
  await storageSet({ allowDomains: ad, allowSubdomains: as });
  input.value = "";
  refreshRules();
}

async function rebuildNow(){
  if(!(await requireUnlockedOrPrompt())) return;
  const el = document.getElementById("rebuildStatus");
  el.textContent = "Rebuilding rules...";
  await rebuildDynamicRules();
  el.textContent = "Done.";
  setTimeout(()=> el.textContent="", 1500);
}

async function refreshLogs(){
  const { blockLog } = await storageGet(["blockLog"]);
  const list = document.getElementById("logsList");
  list.innerHTML = "";
  const arr = Array.isArray(blockLog) ? blockLog : [];
  if(!arr.length){
    const p = document.createElement("div");
    p.className = "small";
    p.textContent = "No logs.";
    list.appendChild(p);
    return;
  }
  arr.forEach(item=>{
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

async function clearLogs(){
  if(!(await requireUnlockedOrPrompt())) return;
  await storageSet({ blockLog: [], blockedCount: 0 });
  refreshLogs();
  refreshHeader();
}

async function refreshProtection(){
  const data = await storageGet(["lockEnabled","blockIncognito"]);
  document.getElementById("lockToggle").checked = data.lockEnabled !== false;
  const bi = document.getElementById("blockIncognitoToggle");
  if(bi) bi.checked = data.blockIncognito !== false;
}

async function toggleBlockIncognito(e){
  const setupDone = await isSetupComplete();
  if(!setupDone){
    await refreshProtection();
    alert("Complete password setup first.");
    return;
  }
  if(!(await requireUnlockedOrPrompt())){
    await refreshProtection();
    return;
  }
  await storageSet({ blockIncognito: e.target.checked });
  await refreshProtection();
  await refreshIncognitoStatus();
}

async function setPassword(){
  const p1 = document.getElementById("pw1").value;
  const p2 = document.getElementById("pw2").value;
  if(!p1 || p1.length < 8){ document.getElementById("pwStatus").textContent = "Password must be at least 8 characters."; return; }
  if(p1 !== p2){ document.getElementById("pwStatus").textContent = "Passwords do not match."; return; }

  const { pwSaltB64, setupComplete, recommendedBlockedDomains, recommendedBlockedKeywords } = await storageGet([
    "pwSaltB64","setupComplete","recommendedBlockedDomains","recommendedBlockedKeywords"
  ]);
  const res = await derivePasswordHash(p1, pwSaltB64); // keeps existing salt if present
  await storageSet({ pwSaltB64: res.saltB64, pwHashHex: res.hashHex, lockEnabled: true });

  document.getElementById("pw1").value = "";
  document.getElementById("pw2").value = "";
  // First-run: complete setup and optionally apply recommended defaults
  if(!setupComplete){
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
  }else{
    document.getElementById("pwStatus").textContent = "Password saved.";
  }
  setUnlocked(15);
  await refreshHeader();
  await refreshRules();
  await refreshIncognitoStatus();
}

async function genRecovery(){
  const { pwHashHex } = await storageGet(["pwHashHex"]);
  if(pwHashHex && !(await requireUnlockedOrPrompt())) return;

  const res = await fetch(chrome.runtime.getURL("assets/wordlist.json"));
  const words = await res.json();

  const codes = [];
  const part = () => Math.random().toString(36).slice(2,6).toUpperCase();
  for(let i=0;i<10;i++) codes.push(`${part()}-${part()}-${part()}`);

  const phrase = [];
  for(let i=0;i<12;i++) phrase.push(words[Math.floor(Math.random()*words.length)]);
  const phraseStr = phrase.join(" ");

  const codeHashes = [];
  for(const c of codes) codeHashes.push(await sha256Hex(c));
  const phraseHash = await sha256Hex(phraseStr);

  await storageSet({ recoveryCodeHashes: codeHashes, recoveryPhraseHash: phraseHash });

  document.getElementById("recoveryCodes").textContent = codes.join("\n");
  document.getElementById("recoveryPhrase").textContent = phraseStr;
  setUnlocked(15);
}

async function authenticate(){
  const v = document.getElementById("authValue").value.trim();
  if(!v){ document.getElementById("authStatus").textContent = "Enter password or recovery code/phrase."; return; }
  const res = await verifyCredential(v);
  if(res.ok){
    setUnlocked(20);
    document.getElementById("authStatus").textContent = res.method === "recovery_code"
      ? "Unlocked (recovery code used). Code invalidated."
      : "Unlocked for 20 minutes.";
    document.getElementById("authValue").value = "";
    return;
  }
  document.getElementById("authStatus").textContent = "Authentication failed.";
}

async function lockNow(){
  unlockedUntil = 0;
  document.getElementById("authStatus").textContent = "Locked.";
}

async function toggleEnabled(e){
  const setupDone = await isSetupComplete();
  if(!setupDone){
    // Setup-first: prevent enabling/disabling until password exists
    await refreshHeader();
    setTab("protection");
    alert("Complete password setup first.");
    return;
  }
  if(!(await requireUnlockedOrPrompt())){
    await refreshHeader();
    return;
  }
  await storageSet({ enabled: e.target.checked });
  await refreshHeader();
}

async function toggleLock(e){
  const { pwHashHex } = await storageGet(["pwHashHex"]);
  if(pwHashHex && !(await requireUnlockedOrPrompt())){
    await refreshProtection();
    return;
  }
  // Never allow disabling lock before setup is complete
  const setupDone = await isSetupComplete();
  if(!setupDone && !e.target.checked){
    e.target.checked = true;
    await storageSet({ lockEnabled: true });
    return;
  }
  await storageSet({ lockEnabled: e.target.checked });
}

async function toggleIncognitoBlock(e){
  const setupDone = await isSetupComplete();
  if(!setupDone){
    e.target.checked = true;
    await storageSet({ blockIncognito: true });
    setTab("protection");
    alert("Complete password setup first.");
    return;
  }
  if(!(await requireUnlockedOrPrompt())){
    await refreshProtection();
    return;
  }
  await storageSet({ blockIncognito: e.target.checked });
}

document.querySelectorAll(".navbtn").forEach(b=> b.addEventListener("click", ()=> setTab(b.dataset.tab)));

document.getElementById("enabledToggle").addEventListener("change", toggleEnabled);

document.getElementById("addDomainBtn").addEventListener("click", addDomain);
document.getElementById("addKeywordBtn").addEventListener("click", addKeyword);
document.getElementById("addAllowDomainBtn").addEventListener("click", addAllowDomain);

document.getElementById("addDomain").addEventListener("keydown", (e)=>{ if(e.key==="Enter") addDomain(); });
document.getElementById("addKeyword").addEventListener("keydown", (e)=>{ if(e.key==="Enter") addKeyword(); });
document.getElementById("addAllowDomain").addEventListener("keydown", (e)=>{ if(e.key==="Enter") addAllowDomain(); });

document.getElementById("rebuildBtn").addEventListener("click", rebuildNow);

document.getElementById("clearLogsBtn").addEventListener("click", clearLogs);

document.getElementById("lockToggle").addEventListener("change", toggleLock);
document.getElementById("blockIncognitoToggle").addEventListener("change", toggleIncognitoBlock);
document.getElementById("setPwBtn").addEventListener("click", setPassword);
document.getElementById("genRecoveryBtn").addEventListener("click", genRecovery);
document.getElementById("authBtn").addEventListener("click", authenticate);
document.getElementById("lockNowBtn").addEventListener("click", lockNow);

(async function init(){
  await refreshHeader();
  await refreshRules();
  await refreshLogs();
  await refreshProtection();
  await refreshIncognitoStatus();

  const setupDone = await isSetupComplete();
  const pw = await hasPassword();
  if(!setupDone || !pw){
    setTab("protection");
    const banner = document.getElementById("setupBanner");
    if(banner) banner.hidden = false;
    return;
  }
  setTab("rules");
})();
