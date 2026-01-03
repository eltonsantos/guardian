import { rebuildDynamicRules } from "../shared/rules.js";

chrome.runtime.onInstalled.addListener(async () => {
  const defaults = {
    // Setup-first: Guardian stays disabled until a password is created.
    enabled: false,
    setupComplete: false,
    // Recommended defaults (applied immediately after setup is completed)
    recommendedBlockedDomains: ["xvideos.com", "spankbang.com", "onlyfans.com", "pornhub.com", "xhamster.com", "redtube.com", "youporn.com"],
    recommendedBlockedKeywords: ["porn", "xxx", "gore", "violence", "onlyfans", "spankbang", "xvideos", "pornhub", "xhamster", "redtube", "youporn"],
    blockedDomains: [],
    blockedSubdomains: [],
    blockedKeywords: [],
    allowDomains: [],
    allowSubdomains: [],
    tempAllowDomains: [],
    tempAllowUrls: [],
    blockLog: [],
    blockedCount: 0,
    lockEnabled: true,
    blockIncognito: true
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

  // Force onboarding / password setup on install or update
  try{
    await chrome.runtime.openOptionsPage();
  }catch(e){ /* ignore */ }
});

chrome.storage.onChanged.addListener(async (changes, area) => {
  if(area !== "local") return;
  const keys = Object.keys(changes);
  const triggers = [
    "enabled",
    "blockedDomains","blockedSubdomains","blockedKeywords",
    "allowDomains","allowSubdomains",
    "tempAllowDomains","tempAllowUrls"
  ];
  if(keys.some(k => triggers.includes(k))){
    await rebuildDynamicRules();
  }
});
