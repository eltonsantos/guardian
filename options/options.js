import {
  storageGet, storageSet,
  normalizeDomain, normalizeKeyword,
  isLikelyDomain, isKeywordAllowed,
  derivePasswordHash, sha256Hex,
  safeUrlForDisplay
} from "../shared/utils.js";

import { rebuildDynamicRules } from "../shared/rules.js";

let unlockedUntil = 0;
function isUnlocked(){ return Date.now() < unlockedUntil; }
function setUnlocked(minutes=10){ unlockedUntil = Date.now() + minutes*60*1000; }

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
  const { enabled } = await storageGet(["enabled"]);
  const en = enabled !== false;
  document.getElementById("enabledToggle").checked = en;
  const badge = document.getElementById("statusBadge");
  badge.classList.toggle("on", en);
  badge.classList.toggle("off", !en);
  badge.textContent = en ? "Protection ON" : "Protection OFF";
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
  const data = await storageGet(["lockEnabled"]);
  document.getElementById("lockToggle").checked = data.lockEnabled !== false;
}

async function setPassword(){
  const p1 = document.getElementById("pw1").value;
  const p2 = document.getElementById("pw2").value;
  if(!p1 || p1.length < 8){ document.getElementById("pwStatus").textContent = "Password must be at least 8 characters."; return; }
  if(p1 !== p2){ document.getElementById("pwStatus").textContent = "Passwords do not match."; return; }

  const { pwSaltB64 } = await storageGet(["pwSaltB64"]);
  const res = await derivePasswordHash(p1, pwSaltB64); // keeps existing salt if present
  await storageSet({ pwSaltB64: res.saltB64, pwHashHex: res.hashHex });

  document.getElementById("pw1").value = "";
  document.getElementById("pw2").value = "";
  document.getElementById("pwStatus").textContent = "Password saved.";
  setUnlocked(15);
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
  const data = await storageGet(["pwSaltB64","pwHashHex","recoveryCodeHashes","recoveryPhraseHash"]);

  // Password
  if(data.pwHashHex && data.pwSaltB64){
    const { hashHex } = await derivePasswordHash(v, data.pwSaltB64);
    if(hashHex === data.pwHashHex){
      setUnlocked(20);
      document.getElementById("authStatus").textContent = "Unlocked for 20 minutes.";
      document.getElementById("authValue").value = "";
      return;
    }
  }

  // Recovery code (single-use)
  const h = await sha256Hex(v);
  const codes = Array.isArray(data.recoveryCodeHashes) ? data.recoveryCodeHashes : [];
  const idx = codes.indexOf(h);
  if(idx >= 0){
    codes.splice(idx, 1);
    await storageSet({ recoveryCodeHashes: codes });
    setUnlocked(20);
    document.getElementById("authStatus").textContent = "Unlocked (recovery code used). Code invalidated.";
    document.getElementById("authValue").value = "";
    return;
  }

  // Recovery phrase
  if(data.recoveryPhraseHash && h === data.recoveryPhraseHash){
    setUnlocked(20);
    document.getElementById("authStatus").textContent = "Unlocked (recovery phrase verified).";
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
  await storageSet({ lockEnabled: e.target.checked });
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
document.getElementById("setPwBtn").addEventListener("click", setPassword);
document.getElementById("genRecoveryBtn").addEventListener("click", genRecovery);
document.getElementById("authBtn").addEventListener("click", authenticate);
document.getElementById("lockNowBtn").addEventListener("click", lockNow);

(async function init(){
  await refreshHeader();
  await refreshRules();
  await refreshLogs();
  await refreshProtection();
  setTab("rules");
})();
