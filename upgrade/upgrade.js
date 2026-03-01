import { isPro, openPaymentPage, getProStatus } from "../shared/license.js";

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

  document.getElementById("backToSettings").addEventListener("click", (e) => {
    e.preventDefault();
    chrome.runtime.openOptionsPage();
  });
}

init();
