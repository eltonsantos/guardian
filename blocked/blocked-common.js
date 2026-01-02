import { storageGet, storageSet } from "../shared/utils.js";

export function getReferrerUrl(){
  return document.referrer || "";
}

export async function logBlocked(refUrl, reason){
  if(!refUrl) return;
  const { blockLog, blockedCount } = await storageGet(["blockLog","blockedCount"]);
  const arr = Array.isArray(blockLog) ? blockLog : [];
  arr.unshift({ url: refUrl, reason, at: new Date().toISOString() });
  await storageSet({
    blockLog: arr.slice(0,200),
    blockedCount: (blockedCount || 0) + 1
  });
}

export function bindActions(){
  document.getElementById("backBtn")?.addEventListener("click", ()=>history.back());
  document.getElementById("settingsBtn")?.addEventListener("click", ()=>chrome.runtime.openOptionsPage());
}
