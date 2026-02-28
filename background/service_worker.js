import { rebuildDynamicRules } from "../shared/rules.js";
import { initLicense } from "../shared/license.js";
import { detectDNS, getDNSStatus } from "../shared/dns-detector.js";
import { storageGet } from "../shared/utils.js";
import { canUseFeature } from "../shared/features.js";

const DNS_CHECK_ALARM = "guardian-dns-check";
const DNS_CHECK_INTERVAL_MINUTES = 360; // 6 hours

initLicense();

chrome.runtime.onInstalled.addListener(async (details) => {
  const defaults = {
    enabled: false,
    setupComplete: false,
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
  for (const k of Object.keys(defaults)) {
    if (typeof current[k] === "undefined") toSet[k] = defaults[k];
  }

  if (details.reason === "install") {
    toSet.installedAt = new Date().toISOString();
  }

  if (Object.keys(toSet).length) {
    await chrome.storage.local.set(toSet);
  } else {
    await rebuildDynamicRules();
  }

  await chrome.alarms.create(DNS_CHECK_ALARM, {
    delayInMinutes: 1,
    periodInMinutes: DNS_CHECK_INTERVAL_MINUTES
  });

  try {
    await chrome.runtime.openOptionsPage();
  } catch (_) { /* ignore */ }
});

chrome.storage.onChanged.addListener(async (changes, area) => {
  if (area !== "local") return;
  const keys = Object.keys(changes);
  const triggers = [
    "enabled",
    "blockedDomains", "blockedSubdomains", "blockedKeywords",
    "allowDomains", "allowSubdomains",
    "tempAllowDomains", "tempAllowUrls"
  ];
  if (keys.some(k => triggers.includes(k))) {
    await rebuildDynamicRules();
  }
});

chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name !== DNS_CHECK_ALARM) return;

  const canCheck = await canUseFeature("dns_detection");
  if (!canCheck) return;

  const prevStatus = await getDNSStatus();
  const newStatus = await detectDNS();

  if (prevStatus.active && !newStatus.active) {
    try {
      await chrome.notifications.create("dns-warning", {
        type: "basic",
        iconUrl: "assets/icon128.png",
        title: "Guardian Pro — DNS Alert",
        message: "Secure DNS is no longer active on your network. Your protection may have been changed.",
        priority: 2
      });
    } catch (_) { /* notifications may not be available */ }
  }
});
