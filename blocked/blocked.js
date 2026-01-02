import { storageGet, storageSet } from "../shared/utils.js";

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
})();
