import { storageGet, normalizeDomain, normalizeKeyword, isLikelyDomain, isKeywordAllowed } from "./utils.js";

function makeId(prefix, index){ return prefix * 100000 + index + 1; }
function escapeRegex(str){ return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); }

function buildDomainRule(domain, idx){
  // Usa regexFilter para capturar a URL e passar via regexSubstitution
  const re = `^(https?:\\/\\/${escapeRegex(domain)}\\/.*)$|^(https?:\\/\\/${escapeRegex(domain)})$`;
  return {
    id: makeId(1, idx),
    priority: 1,
    action: { 
      type: "redirect", 
      redirect: { 
        regexSubstitution: chrome.runtime.getURL(`/blocked/blocked.html?type=domain&match=${encodeURIComponent(domain)}&url=\\1\\2`)
      } 
    },
    condition: { regexFilter: re, resourceTypes: ["main_frame"] }
  };
}
function buildSubdomainRule(domain, idx){
  const re = `^(https?:\\/\\/([a-z0-9-]+\\.)+${escapeRegex(domain)}(\\/.*)?)$`;
  return {
    id: makeId(2, idx),
    priority: 1,
    action: { 
      type: "redirect", 
      redirect: { 
        regexSubstitution: chrome.runtime.getURL(`/blocked/blocked.html?type=subdomain&match=${encodeURIComponent(domain)}&url=\\1`)
      } 
    },
    condition: { regexFilter: re, resourceTypes: ["main_frame"] }
  };
}
function buildKeywordRule(keyword, idx){
  const re = `^(https?:\\/\\/.*${escapeRegex(keyword)}.*)$`;
  return {
    id: makeId(3, idx),
    priority: 1,
    action: { 
      type: "redirect", 
      redirect: { 
        regexSubstitution: chrome.runtime.getURL(`/blocked/blocked.html?type=keyword&match=${encodeURIComponent(keyword)}&url=\\1`)
      } 
    },
    condition: { regexFilter: re, resourceTypes: ["main_frame"], isUrlFilterCaseSensitive: false }
  };
}
function buildAllowDomainRule(domain, idx){
  return {
    id: makeId(9, idx),
    priority: 10,
    action: { type: "allow" },
    condition: { requestDomains: [domain], resourceTypes: ["main_frame"] }
  };
}
function buildAllowSubdomainRule(domain, idx){
  const re = `^https?:\\/\\/([a-z0-9-]+\\.)+${escapeRegex(domain)}(\\/|$)`;
  return {
    id: makeId(8, idx),
    priority: 10,
    action: { type: "allow" },
    condition: { regexFilter: re, resourceTypes: ["main_frame"] }
  };
}

function buildAllowUrlRule(url, idx){
  // Anchored exact-match rule (allow). Uses regexFilter to avoid urlFilter escaping differences.
  const re = `^${escapeRegex(url)}$`;
  return {
    id: makeId(7, idx),
    priority: 100,
    action: { type: "allow" },
    condition: { regexFilter: re, resourceTypes: ["main_frame"], isUrlFilterCaseSensitive: false }
  };
}

function buildAllowDomainTempRule(domain, idx){
  return {
    id: makeId(6, idx),
    priority: 90,
    action: { type: "allow" },
    condition: { requestDomains: [domain], resourceTypes: ["main_frame"] }
  };
}

export async function rebuildDynamicRules(){
  const data = await storageGet([
    "enabled",
    "blockedDomains","blockedSubdomains","blockedKeywords",
    "allowDomains","allowSubdomains",
    "tempAllowDomains","tempAllowUrls"
  ]);
  const enabled = data.enabled !== false; // default ON

  // Normaliza e deduplica todos os arrays para evitar IDs duplicados
  const blockedDomainsRaw = Array.isArray(data.blockedDomains) ? data.blockedDomains : [];
  const blockedSubdomainsRaw = Array.isArray(data.blockedSubdomains) ? data.blockedSubdomains : [];
  const blockedKeywordsRaw = Array.isArray(data.blockedKeywords) ? data.blockedKeywords : [];
  const allowDomainsRaw = Array.isArray(data.allowDomains) ? data.allowDomains : [];
  const allowSubdomainsRaw = Array.isArray(data.allowSubdomains) ? data.allowSubdomains : [];

  // Deduplica após normalização
  const uniqueBlockedDomains = [...new Set(blockedDomainsRaw.map(normalizeDomain).filter(isLikelyDomain))];
  const uniqueBlockedSubdomains = [...new Set(blockedSubdomainsRaw.map(normalizeDomain).filter(isLikelyDomain))];
  const uniqueBlockedKeywords = [...new Set(blockedKeywordsRaw.map(normalizeKeyword).filter(isKeywordAllowed))];
  const uniqueAllowDomains = [...new Set(allowDomainsRaw.map(normalizeDomain).filter(isLikelyDomain))];
  const uniqueAllowSubdomains = [...new Set(allowSubdomainsRaw.map(normalizeDomain).filter(isLikelyDomain))];

  // Temporary allowlists (with expiry)
  const now = Date.now();
  const tempAllowDomainsRaw = Array.isArray(data.tempAllowDomains) ? data.tempAllowDomains : [];
  const tempAllowUrlsRaw = Array.isArray(data.tempAllowUrls) ? data.tempAllowUrls : [];

  const tempDomains = tempAllowDomainsRaw
    .filter(x => x && typeof x.domain === "string" && typeof x.until === "number" && x.until > now)
    .map(x => normalizeDomain(x.domain))
    .filter(isLikelyDomain);

  const tempUrls = tempAllowUrlsRaw
    .filter(x => x && typeof x.url === "string" && typeof x.until === "number" && x.until > now)
    .map(x => x.url.trim())
    .filter(u => /^https?:\/\//i.test(u));

  const existing = await chrome.declarativeNetRequest.getDynamicRules();
  const removeIds = existing.map(r => r.id);

  if(!enabled){
    if(removeIds.length){
      await chrome.declarativeNetRequest.updateDynamicRules({ removeRuleIds: removeIds, addRules: [] });
    }
    return;
  }

  const allowRules = [];
  uniqueAllowDomains.forEach((d,i)=>allowRules.push(buildAllowDomainRule(d,i)));
  uniqueAllowSubdomains.forEach((d,i)=>allowRules.push(buildAllowSubdomainRule(d,i)));

  const tempAllowRules = [];
  [...new Set(tempDomains)].forEach((d,i)=>tempAllowRules.push(buildAllowDomainTempRule(d,i)));
  [...new Set(tempUrls)].forEach((u,i)=>tempAllowRules.push(buildAllowUrlRule(u,i)));

  const blockRules = [];
  uniqueBlockedDomains.forEach((d,i)=>blockRules.push(buildDomainRule(d,i)));
  uniqueBlockedSubdomains.forEach((d,i)=>blockRules.push(buildSubdomainRule(d,i)));
  uniqueBlockedKeywords.forEach((k,i)=>blockRules.push(buildKeywordRule(k,i)));

  await chrome.declarativeNetRequest.updateDynamicRules({
    removeRuleIds: removeIds,
    addRules: [...tempAllowRules, ...allowRules, ...blockRules]
  });

  // Best-effort cleanup (non-blocking)
  try{
    const cleanedDomains = tempAllowDomainsRaw.filter(x => x && typeof x.until === "number" && x.until > now);
    const cleanedUrls = tempAllowUrlsRaw.filter(x => x && typeof x.until === "number" && x.until > now);
    if(cleanedDomains.length !== tempAllowDomainsRaw.length || cleanedUrls.length !== tempAllowUrlsRaw.length){
      await chrome.storage.local.set({ tempAllowDomains: cleanedDomains, tempAllowUrls: cleanedUrls });
    }
  }catch(e){ /* ignore */ }
}
