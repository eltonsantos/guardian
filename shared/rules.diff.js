// Replace ONLY the rule builders below in your existing shared/rules.js

function buildDomainRule(domain, idx){
  return {
    id: makeId(1, idx),
    priority: 1,
    action: { type: "redirect", redirect: { extensionPath: "/blocked/blocked-domain.html" } },
    condition: { domains: [domain], resourceTypes: ["main_frame"] }
  };
}

function buildSubdomainRule(domain, idx){
  const re = `^https?:\/\/([a-z0-9-]+\.)+${escapeRegex(domain)}(\/|$)`;
  return {
    id: makeId(2, idx),
    priority: 1,
    action: { type: "redirect", redirect: { extensionPath: "/blocked/blocked-domain.html" } },
    condition: { regexFilter: re, resourceTypes: ["main_frame"] }
  };
}

function buildKeywordRule(keyword, idx){
  const re = `^https?:\/\/.*${escapeRegex(keyword)}.*$`;
  return {
    id: makeId(3, idx),
    priority: 1,
    action: { type: "redirect", redirect: { extensionPath: "/blocked/blocked-keyword.html" } },
    condition: { regexFilter: re, resourceTypes: ["main_frame"] }
  };
}
