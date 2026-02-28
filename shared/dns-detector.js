import { storageGet, storageSet } from "./utils.js";

const DNS_STATUS_KEY = "dnsStatus";
const DNS_HISTORY_KEY = "dnsHistory";

const DNS_PROVIDERS = [
  {
    name: "NextDNS",
    url: "https://test.nextdns.io",
    parse: "json",
    detect(data) {
      return data && data.status === "ok";
    }
  },
  {
    name: "OpenDNS",
    url: "https://welcome.opendns.com/",
    parse: "text",
    detect(text) {
      return typeof text === "string" && text.includes("OpenDNS");
    }
  },
  {
    name: "CleanBrowsing",
    url: "https://cleanbrowsing.org/ip/",
    parse: "text",
    detect(text) {
      return typeof text === "string" && text.includes("CleanBrowsing");
    }
  },
  {
    name: "Quad9",
    url: "https://on.quad9.net/",
    parse: "text",
    detect(text) {
      return typeof text === "string" && text.includes("Quad9");
    }
  }
];

async function probe(provider) {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 5000);
    const res = await fetch(provider.url, {
      signal: controller.signal,
      cache: "no-store"
    });
    clearTimeout(timer);
    if (!res.ok) return { provider: provider.name, active: false };
    const data = provider.parse === "json" ? await res.json() : await res.text();
    return { provider: provider.name, active: provider.detect(data) };
  } catch (_) {
    return { provider: provider.name, active: false };
  }
}

export async function detectDNS() {
  const results = await Promise.all(DNS_PROVIDERS.map(probe));
  const active = results.find(r => r.active);
  const status = {
    active: Boolean(active),
    provider: active ? active.provider : null,
    checkedAt: new Date().toISOString(),
    results
  };
  await storageSet({ [DNS_STATUS_KEY]: status });
  await appendHistory(status);
  return status;
}

export async function getDNSStatus() {
  const data = await storageGet([DNS_STATUS_KEY]);
  return data[DNS_STATUS_KEY] || { active: false, provider: null, checkedAt: null, results: [] };
}

export async function getDNSHistory() {
  const data = await storageGet([DNS_HISTORY_KEY]);
  return Array.isArray(data[DNS_HISTORY_KEY]) ? data[DNS_HISTORY_KEY] : [];
}

async function appendHistory(status) {
  const history = await getDNSHistory();
  history.unshift({
    active: status.active,
    provider: status.provider,
    checkedAt: status.checkedAt
  });
  if (history.length > 50) history.length = 50;
  await storageSet({ [DNS_HISTORY_KEY]: history });
}

export function getProtectionScore(dnsStatus, extensionEnabled, lockEnabled) {
  let score = 0;
  if (extensionEnabled) score += 30;
  if (lockEnabled) score += 20;
  if (dnsStatus && dnsStatus.active) score += 50;
  return score;
}
