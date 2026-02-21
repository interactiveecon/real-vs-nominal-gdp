/* global generateScenario, Chart */

const YEARS = ["Year 1", "Year 2", "Year 3"];

const els = {
  baseYear: document.getElementById("baseYear"),
  scenarioBtn: document.getElementById("scenarioBtn"),
  inflationShockBtn: document.getElementById("inflationShockBtn"),
  quantityShockBtn: document.getElementById("quantityShockBtn"),
  resetBtn: document.getElementById("resetBtn"),
  status: document.getElementById("status"),
  outTable: document.getElementById("outTable"),
  explain: document.getElementById("explain"),

  // rubric
  ruleNom: document.getElementById("ruleNom"),
  ruleReal: document.getElementById("ruleReal"),
  ruleDef: document.getElementById("ruleDef")
};

// App state: for each year, store pA,qA,pB,qB
let state = null;
let scenarioSnapshot = null;

// Charts
let chartNom = null;
let chartReal = null;
let chartDef = null;

function setStatus(msg) {
  if (els.status) els.status.textContent = msg;
}

function money(x) {
  // not actual dollars; just formatting
  return x.toFixed(0);
}

function pct(x) {
  if (!isFinite(x)) return "—";
  return (100 * x).toFixed(1) + "%";
}

function defl(x) {
  if (!isFinite(x)) return "—";
  return x.toFixed(1);
}

function resetRubric() {
  [els.ruleNom, els.ruleReal, els.ruleDef].filter(Boolean).forEach(el => {
    el.classList.remove("done");
    const icon = el.querySelector(".rubric-icon");
    if (icon) icon.textContent = "○";
  });
}

function completeRubric() {
  [els.ruleNom, els.ruleReal, els.ruleDef].filter(Boolean).forEach(el => {
    el.classList.add("done");
    const icon = el.querySelector(".rubric-icon");
    if (icon) icon.textContent = "✓";
  });
}

function bindPair(rangeId, numberId, getVal, setVal) {
  const r = document.getElementById(rangeId);
  const n = document.getElementById(numberId);

  function syncFrom(v) {
    const vv = Number(v);
    r.value = vv;
    n.value = vv;
    setVal(vv);
    updateAll();
  }

  r.addEventListener("input", () => syncFrom(r.value));
  n.addEventListener("input", () => syncFrom(n.value));

  // initialize
  const initV = getVal();
  r.value = initV;
  n.value = initV;
}

function setupBindings() {
  for (let t = 0; t < 3; t++) {
    bindPair(`pA${t}_r`, `pA${t}_n`, () => state[t].pA, v => state[t].pA = v);
    bindPair(`qA${t}_r`, `qA${t}_n`, () => state[t].qA, v => state[t].qA = v);
    bindPair(`pB${t}_r`, `pB${t}_n`, () => state[t].pB, v => state[t].pB = v);
    bindPair(`qB${t}_r`, `qB${t}_n`, () => state[t].qB, v => state[t].qB = v);
  }
}

function computeSeries() {
  const b = Number(els.baseYear.value); // base year index

  const basePrices = {
    pA: state[b].pA,
    pB: state[b].pB
  };

  const nominal = [];
  const real = [];
  const deflator = [];

  for (let t = 0; t < 3; t++) {
    const nom = state[t].pA * state[t].qA + state[t].pB * state[t].qB;
    const rea = basePrices.pA * state[t].qA + basePrices.pB * state[t].qB;
    const def = (rea === 0) ? NaN : (nom / rea) * 100;

    nominal.push(nom);
    real.push(rea);
    deflator.push(def);
  }

  // growth rates
  const realGrowth = [NaN, (real[1] - real[0]) / real[0], (real[2] - real[1]) / real[1]];
  const infl = [NaN, (deflator[1] - deflator[0]) / deflator[0], (deflator[2] - deflator[1]) / deflator[1]];

  return { nominal, real, deflator, realGrowth, infl };
}

function updateTable(series) {
  const { nominal, real, deflator, realGrowth, infl } = series;

  els.outTable.innerHTML = "";
  for (let t = 0; t < 3; t++) {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${YEARS[t]}</td>
      <td>${money(nominal[t])}</td>
      <td>${money(real[t])}</td>
      <td>${defl(deflator[t])}</td>
      <td>${t === 0 ? "—" : pct(realGrowth[t])}</td>
      <td>${t === 0 ? "—" : pct(infl[t])}</td>
    `;
    els.outTable.appendChild(tr);
  }
}

function makeChart(ctx, label, data) {
  return new Chart(ctx, {
    type: "line",
    data: {
      labels: YEARS,
      datasets: [{ label, data }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: true,
      plugins: {
        legend: { display: false },
        tooltip: { enabled: true }
      },
      scales: {
        x: { grid: { display: false } },
        y: { grid: { display: true } }
      }
    }
  });
}

function updateCharts(series) {
  const { nominal, real, deflator } = series;

  if (!chartNom) {
    chartNom = makeChart(document.getElementById("chartNom"), "Nominal GDP", nominal);
    chartReal = makeChart(document.getElementById("chartReal"), "Real GDP", real);
    chartDef = makeChart(document.getElementById("chartDef"), "GDP Deflator", deflator);
    return;
  }

  chartNom.data.datasets[0].data = nominal;
  chartReal.data.datasets[0].data = real;
  chartDef.data.datasets[0].data = deflator;

  chartNom.update();
  chartReal.update();
  chartDef.update();
}

function updateExplanation(series) {
  const { nominal, real, deflator, realGrowth, infl } = series;

  const b = Number(els.baseYear.value);
  const baseLabel = YEARS[b];

  const msg =
    `Base year is <strong>${baseLabel}</strong>. Real GDP uses prices from the base year and current quantities. ` +
    `If nominal GDP rises but real GDP is flat, the change is mostly <strong>prices</strong> (inflation). ` +
    `If real GDP rises, the change reflects higher <strong>quantities</strong> (more real production). ` +
    `The GDP deflator summarizes the overall price level for domestically produced output.`;

  const y2 = `From Year 1 → Year 2: real growth ${isFinite(realGrowth[1]) ? pct(realGrowth[1]) : "—"}, deflator inflation ${isFinite(infl[1]) ? pct(infl[1]) : "—"}.`;
  const y3 = `From Year 2 → Year 3: real growth ${isFinite(realGrowth[2]) ? pct(realGrowth[2]) : "—"}, deflator inflation ${isFinite(infl[2]) ? pct(infl[2]) : "—"}.`;

  els.explain.innerHTML = `${msg}<br><br><strong>${y2}</strong><br><strong>${y3}</strong>`;
}

function updateAll() {
  const series = computeSeries();
  updateTable(series);
  updateCharts(series);
  updateExplanation(series);
  completeRubric();
}

function applyInflationShock() {
  // Multiply prices in Year 2 and Year 3 by a factor; keep quantities unchanged.
  const factor = 1.25;
  for (let t = 1; t < 3; t++) {
    state[t].pA = Math.min(50, Math.round(state[t].pA * factor));
    state[t].pB = Math.min(50, Math.round(state[t].pB * factor));
  }
  // sync inputs to state
  syncUIFromState();
  setStatus("Applied an inflation shock: prices increased in Years 2–3 (quantities unchanged).");
}

function applyQuantityShock() {
  // Multiply quantities in Year 2 and Year 3 by a factor; keep prices unchanged.
  const factor = 1.20;
  for (let t = 1; t < 3; t++) {
    state[t].qA = Math.min(200, Math.round(state[t].qA * factor));
    state[t].qB = Math.min(200, Math.round(state[t].qB * factor));
  }
  syncUIFromState();
  setStatus("Applied a quantity shock: quantities increased in Years 2–3 (prices unchanged).");
}

function syncUIFromState() {
  // Write state values into range + number inputs without rebinding.
  // (We set both and then call updateAll.)
  for (let t = 0; t < 3; t++) {
    const pairs = [
      [`pA${t}_r`, `pA${t}_n`, state[t].pA],
      [`qA${t}_r`, `qA${t}_n`, state[t].qA],
      [`pB${t}_r`, `pB${t}_n`, state[t].pB],
      [`qB${t}_r`, `qB${t}_n`, state[t].qB]
    ];
    for (const [rid, nid, val] of pairs) {
      const r = document.getElementById(rid);
      const n = document.getElementById(nid);
      r.value = val;
      n.value = val;
    }
  }
  updateAll();
}

function newScenario() {
  scenarioSnapshot = generateScenario();
  // deep copy
  state = scenarioSnapshot.map(y => ({ ...y }));
  resetRubric();
  syncUIFromState();
  setStatus("New scenario generated. Try changing only prices or only quantities and compare nominal vs real.");
}

function resetToScenario() {
  if (!scenarioSnapshot) return;
  state = scenarioSnapshot.map(y => ({ ...y }));
  resetRubric();
  syncUIFromState();
  setStatus("Reset to the original scenario.");
}

function init() {
  // initial scenario
  scenarioSnapshot = generateScenario();
  state = scenarioSnapshot.map(y => ({ ...y }));

  setupBindings();

  els.baseYear.addEventListener("change", () => {
    resetRubric();
    updateAll();
    setStatus("Base year changed. Real GDP recalculated using the new base-year prices.");
  });

  els.scenarioBtn.addEventListener("click", newScenario);
  els.resetBtn.addEventListener("click", resetToScenario);
  els.inflationShockBtn.addEventListener("click", applyInflationShock);
  els.quantityShockBtn.addEventListener("click", applyQuantityShock);

  resetRubric();
  updateAll();
  setStatus("Ready. Adjust prices/quantities and watch nominal vs real respond.");
}

init();
