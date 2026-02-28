import { detectDNS } from "../shared/dns-detector.js";
import { storageSet } from "../shared/utils.js";

const DNS_INFO = {
  opendns: { name: "OpenDNS FamilyShield", primary: "208.67.222.123", secondary: "208.67.220.123" },
  cleanbrowsing: { name: "CleanBrowsing Family", primary: "185.228.168.168", secondary: "185.228.169.168" },
  nextdns: { name: "NextDNS", primary: "Custom (see nextdns.io)", secondary: "Custom (see nextdns.io)" },
  quad9: { name: "Quad9", primary: "9.9.9.9", secondary: "149.112.112.112" }
};

let routers = [];
let currentStep = 1;
let selectedDNS = "opendns";
let selectedRouter = 0;

async function loadRouters() {
  const res = await fetch(chrome.runtime.getURL("assets/routers.json"));
  routers = await res.json();
}

function showStep(n) {
  currentStep = n;
  for (let i = 1; i <= 5; i++) {
    const el = document.getElementById(`step${i}`);
    if (el) el.classList.toggle("hidden", i !== n);
  }
  document.getElementById("stepDone").classList.toggle("hidden", n !== 6);
  updateProgress();
}

function updateProgress() {
  const pct = Math.min(((currentStep - 1) / 5) * 100, 100);
  document.getElementById("progressFill").style.width = `${pct}%`;

  const indicators = document.getElementById("stepIndicators");
  indicators.innerHTML = "";
  for (let i = 1; i <= 5; i++) {
    const dot = document.createElement("div");
    dot.className = "step-dot";
    if (i < currentStep) dot.classList.add("done");
    if (i === currentStep) dot.classList.add("active");
    dot.textContent = i;
    indicators.appendChild(dot);
  }
}

function renderRouterGrid() {
  const grid = document.getElementById("routerGrid");
  grid.innerHTML = "";
  routers.forEach((r, idx) => {
    const btn = document.createElement("button");
    btn.className = "router-btn" + (idx === selectedRouter ? " selected" : "");
    btn.textContent = r.brand;
    btn.addEventListener("click", () => {
      selectedRouter = idx;
      grid.querySelectorAll(".router-btn").forEach(b => b.classList.remove("selected"));
      btn.classList.add("selected");
    });
    grid.appendChild(btn);
  });
}

function renderStep3() {
  const router = routers[selectedRouter];
  const dns = DNS_INFO[selectedDNS];
  const ipInput = document.getElementById("routerIp");
  ipInput.value = router.defaultIp;

  const summary = document.getElementById("dnsSummary");
  summary.innerHTML = `
    <div class="h2">DNS to configure</div>
    <div style="margin-top:8px;">
      <strong>${dns.name}</strong><br/>
      <span class="small">Primary DNS: <code>${dns.primary}</code></span><br/>
      <span class="small">Secondary DNS: <code>${dns.secondary}</code></span>
    </div>
  `;

  const list = document.getElementById("stepsList");
  list.innerHTML = "";
  router.steps.forEach(step => {
    const li = document.createElement("li");
    let text = step;
    if (selectedDNS !== "opendns") {
      text = text.replace(/208\.67\.222\.123/g, dns.primary);
      text = text.replace(/208\.67\.220\.123/g, dns.secondary);
      text = text.replace(/OpenDNS FamilyShield/g, dns.name);
    }
    li.textContent = text;
    list.appendChild(li);
  });
}

function setupChecklist() {
  const checkboxes = [document.getElementById("chk1"), document.getElementById("chk2"), document.getElementById("chk3")];
  const nextBtn = document.getElementById("next4");
  const update = () => {
    nextBtn.disabled = !checkboxes.every(c => c.checked);
  };
  checkboxes.forEach(c => c.addEventListener("change", update));
}

async function runVerification() {
  const resultEl = document.getElementById("verifyResult");
  resultEl.innerHTML = '<div class="small">Checking DNS configuration...</div>';

  const status = await detectDNS();

  if (status.active) {
    resultEl.innerHTML = `
      <div class="verify-success">
        <strong>DNS protection is active</strong>
        <span class="small">Provider detected: ${status.provider}</span>
      </div>
    `;
  } else {
    resultEl.innerHTML = `
      <div class="verify-warning">
        <strong>No secure DNS detected</strong>
        <span class="small">This could mean the DNS hasn't propagated yet. Try rebooting your router and checking again in a few minutes.</span>
        <span class="small">You can also continue and check later from the Guardian Pro dashboard.</span>
      </div>
    `;
  }
}

async function finishWizard() {
  await storageSet({ routerSetupComplete: true, routerSetupAt: new Date().toISOString() });
  showStep(6);
}

async function init() {
  await loadRouters();
  renderRouterGrid();
  updateProgress();
  setupChecklist();

  document.querySelectorAll('input[name="dns"]').forEach(r => {
    r.addEventListener("change", (e) => { selectedDNS = e.target.value; });
  });

  document.getElementById("next1").addEventListener("click", () => { showStep(2); });
  document.getElementById("back2").addEventListener("click", () => { showStep(1); });
  document.getElementById("next2").addEventListener("click", () => { renderStep3(); showStep(3); });
  document.getElementById("back3").addEventListener("click", () => { showStep(2); });
  document.getElementById("next3").addEventListener("click", () => { showStep(4); });
  document.getElementById("back4").addEventListener("click", () => { showStep(3); });
  document.getElementById("next4").addEventListener("click", () => { showStep(5); });
  document.getElementById("back5").addEventListener("click", () => { showStep(4); });

  document.getElementById("openRouter").addEventListener("click", () => {
    const ip = document.getElementById("routerIp").value.trim();
    if (ip) chrome.tabs.create({ url: `http://${ip}` });
  });

  document.getElementById("verifyBtn").addEventListener("click", runVerification);
  document.getElementById("finishBtn").addEventListener("click", finishWizard);

  document.getElementById("doneBtn").addEventListener("click", () => {
    chrome.runtime.openOptionsPage();
  });

  document.getElementById("backToSettings").addEventListener("click", (e) => {
    e.preventDefault();
    chrome.runtime.openOptionsPage();
  });
}

init();
