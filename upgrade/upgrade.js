import { isPro, activateLocalKey, openPaymentPage, getProStatus } from "../shared/license.js";

async function init() {
  const status = await getProStatus();

  if (status.isPro) {
    const subBtn = document.getElementById("subscribeBtn");
    subBtn.textContent = "Active";
    subBtn.disabled = true;
    subBtn.classList.remove("primary");
  }

  document.getElementById("subscribeBtn").addEventListener("click", () => {
    openPaymentPage();
  });

  document.getElementById("activateBtn").addEventListener("click", async () => {
    const input = document.getElementById("licenseKeyInput");
    const statusEl = document.getElementById("activateStatus");
    const key = (input.value || "").trim();

    if (!key) {
      statusEl.textContent = "Please enter a license key.";
      statusEl.style.color = "var(--danger)";
      return;
    }

    const result = await activateLocalKey(key);
    if (result.ok) {
      statusEl.textContent = "License activated! Guardian Pro is now active.";
      statusEl.style.color = "var(--success)";
      input.value = "";
      setTimeout(() => location.reload(), 1500);
    } else {
      statusEl.textContent = "Invalid license key. Format: GPRO-XXXX-XXXX-XXXX";
      statusEl.style.color = "var(--danger)";
    }
  });

  document.getElementById("backToSettings").addEventListener("click", (e) => {
    e.preventDefault();
    chrome.runtime.openOptionsPage();
  });
}

init();
