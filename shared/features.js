import { isPro } from "./license.js";

const PRO_FEATURES = new Set([
  "dns_detection",
  "router_wizard",
  "network_alerts",
  "protection_score",
  "advanced_logs"
]);

export function isProFeature(featureName) {
  return PRO_FEATURES.has(featureName);
}

export async function canUseFeature(featureName) {
  if (!PRO_FEATURES.has(featureName)) return true;
  return await isPro();
}

export async function requirePro(featureName) {
  if (!PRO_FEATURES.has(featureName)) return true;
  const pro = await isPro();
  if (!pro) {
    chrome.tabs.create({
      url: chrome.runtime.getURL("/upgrade/upgrade.html")
    });
    return false;
  }
  return true;
}
