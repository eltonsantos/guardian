import { rebuildDynamicRules } from "../shared/rules.js";

chrome.runtime.onInstalled.addListener(async () => {
  const defaults = {
    enabled: true,
    blockedDomains: ["xvideos.com", "spankbang.com", "onlyfans.com", "pornhub.com", "xhamster.com", "redtube.com", "youporn.com"],
    blockedSubdomains: ["xvideos.com", "spankbang.com", "onlyfans.com", "pornhub.com", "xhamster.com", "redtube.com", "youporn.com"],
    blockedKeywords: ["porn", "xxx", "gore", "violence", "onlyfans", "spankbang", "xvideos", "pornhub", "xhamster", "redtube", "youporn"],
    allowDomains: [],
    allowSubdomains: [],
    blockLog: [],
    blockedCount: 0,
    lockEnabled: true
  };

  const current = await chrome.storage.local.get(Object.keys(defaults));
  const toSet = {};
  for (const k of Object.keys(defaults)){
    if (typeof current[k] === "undefined") toSet[k] = defaults[k];
  }
  
  if (Object.keys(toSet).length) {
    await chrome.storage.local.set(toSet);
    // O onChanged listener será disparado automaticamente e chamará rebuildDynamicRules
  } else {
    // Se não há nada para definir, precisamos chamar manualmente
    await rebuildDynamicRules();
  }
});

chrome.storage.onChanged.addListener(async (changes, area) => {
  if(area !== "local") return;
  const keys = Object.keys(changes);
  const triggers = ["enabled","blockedDomains","blockedSubdomains","blockedKeywords","allowDomains","allowSubdomains"];
  if(keys.some(k => triggers.includes(k))){
    await rebuildDynamicRules();
  }
});
