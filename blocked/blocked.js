import { storageGet, storageSet, normalizeDomain } from "../shared/utils.js";
import { verifyCredential } from "../shared/auth.js";

function getBlockInfo(){
  const params = new URLSearchParams(window.location.search);
  const type = params.get("type") || "";
  const match = params.get("match") || "";
  const url = params.get("url") || document.referrer || "";
  return { type, match, url };
}

function formatReason(type, match){
  switch(type){
    case "domain":
      return `Domínio bloqueado: ${match}`;
    case "subdomain":
      return `Subdomínio bloqueado: *.${match}`;
    case "keyword":
      return `Palavra-chave bloqueada: "${match}"`;
    default:
      return "Regra de proteção Guardian";
  }
}

function truncateUrl(url, maxLen = 60){
  if(url.length <= maxLen) return url;
  return url.substring(0, maxLen) + "...";
}

(async function(){
  const { type, match, url } = getBlockInfo();
  
  let host = "—";
  let displayUrl = "—";
  
  if(url){
    try{ 
      const parsed = new URL(url);
      host = parsed.hostname;
      displayUrl = truncateUrl(url);
    }catch(e){
      displayUrl = truncateUrl(url);
    }
  }
  
  document.getElementById("blockedUrl").textContent = displayUrl;
  document.getElementById("blockedUrl").title = url; // tooltip com URL completa
  document.getElementById("domain").textContent = host;
  document.getElementById("reason").textContent = formatReason(type, match);
  document.getElementById("time").textContent = new Date().toLocaleString();

  if(url){
    const { blockLog, blockedCount } = await storageGet(["blockLog","blockedCount"]);
    const arr = Array.isArray(blockLog) ? blockLog : [];
    arr.unshift({ 
      url, 
      type: type || "unknown",
      match: match || "",
      reason: formatReason(type, match), 
      at: new Date().toISOString() 
    });
    await storageSet({ blockLog: arr.slice(0,200), blockedCount: (blockedCount||0)+1 });
  }

  document.getElementById("backBtn").addEventListener("click", ()=> history.back());
  document.getElementById("settingsBtn").addEventListener("click", ()=> chrome.runtime.openOptionsPage());

  // Unlock-gated allow actions
  const unlockBtn = document.getElementById("unlockBtn");
  const unlockValue = document.getElementById("unlockValue");
  const unlockStatus = document.getElementById("unlockStatus");
  const allow10Btn = document.getElementById("allow10Btn");
  const allowDomainBtn = document.getElementById("allowDomainBtn");

  let unlocked = false;
  async function doUnlock(){
    const v = (unlockValue?.value || "").trim();
    if(!v){ unlockStatus.textContent = "Digite a senha ou recovery."; return; }
    const res = await verifyCredential(v);
    if(!res.ok){
      unlockStatus.textContent = "Autenticação falhou.";
      unlocked = false;
      allow10Btn.disabled = true;
      allowDomainBtn.disabled = true;
      return;
    }
    unlocked = true;
    unlockStatus.textContent = "Autenticado. Escolha uma opção de liberação.";
    allow10Btn.disabled = false;
    allowDomainBtn.disabled = false;
    unlockValue.value = "";
  }

  unlockBtn?.addEventListener("click", doUnlock);
  unlockValue?.addEventListener("keydown", (e)=>{ if(e.key==="Enter") doUnlock(); });

  async function allowFor10Minutes(){
    if(!unlocked) return;
    if(!url){ unlockStatus.textContent = "URL desconhecida."; return; }
    const until = Date.now() + 10*60*1000;
    const { tempAllowUrls } = await storageGet(["tempAllowUrls"]);
    const arr = Array.isArray(tempAllowUrls) ? tempAllowUrls : [];
    arr.unshift({ url, until });
    await storageSet({ tempAllowUrls: arr.slice(0,200) });
    // Navigate to the original URL
    window.location.replace(url);
  }

  async function allowThisDomain(){
    if(!unlocked) return;
    if(!host || host === "—"){ unlockStatus.textContent = "Domínio desconhecido."; return; }
    const domain = normalizeDomain(host);
    const { allowDomains, allowSubdomains } = await storageGet(["allowDomains","allowSubdomains"]);
    const ad = Array.isArray(allowDomains) ? allowDomains : [];
    const as = Array.isArray(allowSubdomains) ? allowSubdomains : [];
    if(!ad.includes(domain)) ad.unshift(domain);
    if(!as.includes(domain)) as.unshift(domain);
    await storageSet({ allowDomains: ad, allowSubdomains: as });
    window.location.replace(url || `https://${domain}/`);
  }

  allow10Btn?.addEventListener("click", allowFor10Minutes);
  allowDomainBtn?.addEventListener("click", allowThisDomain);
})();
