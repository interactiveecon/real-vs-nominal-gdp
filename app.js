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
  ruleDef: document.getElementById("ruleDef"),

  // quiz
  checkQuizBtn: document.getElementById("checkQuizBtn"),
  resetQuizBtn: document.getElementById("resetQuizBtn"),
  quizStatus: document.getElementById("quizStatus"),
  fb_q1: document.getElementById("fb_q1"),
  fb_q2: document.getElementById("fb_q2"),
  fb_q3: document.getElementById("fb_q3"),

  // lock
  lockedWrap: document.getElementById("lockedWrap")
};

// App state: for each year, store pA,qA,pB,qB
let state = null;
let scenarioSnapshot = null;

// Charts
let chartNom = null;
let chartReal = null;
let chartDef = null;

// Quiz correctness gate
let outputsUnlocked = false;

function setStatus(msg) {
  if (els.status) els.status.textContent = msg;
}

function money(x) {
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

function lockOutputs() {
  outputsUnlocked = false;
  if (els.lockedWrap) els.lockedWrap.classList.add("locked");
  resetRubric();
}

function unlockOutputs() {
  outputsUnlocked = true;
  if (els.lockedWrap) els.lockedWrap.classList.remove("locked");
  // Update outputs immediately once unlocked
  updateAll();
}

function getSelected(name) {
  const el = document.querySelector(`input[name="${name}"]:checked`);
  return el ? el.value : null;
}

function setFeedback(el, ok, msg) {
  if (!el) return;
  el.classList.remove("good", "bad");
  el.classList.add(ok ? "good" : "bad");
  el.textContent = msg;
}

function clearQuiz() {
  ["q1","q2","q3"].forEach(q => {
    document.querySelectorAll(`input[name="${q}"]`).forEach(r => { r.checked = false; });
  });
  if (els.quizStatus) els.quizStatus.textContent = "";
  if (els.fb_q1) els.fb_q1.textContent = "";
  if (els.fb_q2) els.fb_q2.textContent = "";
  if (els.fb_q3) els.fb_q3.textContent = "";
  [els.fb_q1, els.fb_q2, els.fb_q3].forEach(x => x && x.classList.remove("good","bad"));
  lockOutputs();
  setStatus("Answer the prediction questions to unlock the results.");
}

function checkQuiz() {
  // Correct answers:
  // q1: prices only -> nominal up, real unchanged, deflator up (b)
  // q2: quantities only -> nominal up, real up, deflator unchanged (a)
  // q3: nominal up, real flat -> higher prices (b)
  const ans = { q1: "b", q2: "a", q3: "b" };

  const a1 = getSelected("q1");
  const a2 = getSelected("q2");
  const a3 = getSelected("q3");

  let ok1 = (a1 === ans.q1);
  let ok2 = (a2 === ans.q2);
  let ok3 = (a3 === ans.q3);

  // Feedback messages (short + rule-based)
  setFeedback(els.fb_q1, ok1,
    ok1 ? "✓ Correct: nominal uses current prices; real uses base prices, so price-only changes don’t change real." :
          "Not quite. If only prices rise, nominal rises; real (base prices) does not; deflator rises."
  );
  setFeedback(els.fb_q2, ok2,
    ok2 ? "✓ Correct: higher quantities raise both nominal and real; price level (deflator) stays about the same." :
          "Not quite. If only quantities rise, both nominal and real rise; deflator stays roughly unchanged."
  );
  setFeedback(els.fb_q3, ok3,
    ok3 ? "✓ Correct: if real is flat, the rise in nominal is mainly prices (inflation)." :
          "Not quite. Nominal up with real flat points to higher prices, not higher quantities."
  );

  const allAnswered = (a1 && a2 && a3);
  const allCorrect = (ok1 && ok2 && ok3);

  if (!allAnswered) {
    if (els.quizStatus) els.quizStatus.textContent = "Answer all three questions, then check again.";
    lockOutputs();
    return;
  }

  if (allCorrect) {
    if (els.quizStatus) els.quizStatus.textContent = "Unlocked ✓ Now explore with shocks and sliders.";
    unlockOutputs();
    setStatus("Unlocked. Now experiment: apply price-only vs quantity-only shocks and compare nominal vs real.");
  } else {
    if (els.quizStatus) els.quizStatus.textContent = "Not yet—fix the incorrect items and try again.";
    lockOutputs();
  }
}

function bindPair(rangeId, numberId, getVal, setVal) {
  const r = document.getElementById(rangeId);
  const n = document.getElementById(numberId);

  function syncFrom(v) {
    const vv = Number(v);
    r.value = vv;
    n.value = vv;
    setVal(vv);
    if (outputsUnlocked) updateAll();
  }

  r.addEventListener("input", () => syncFrom(r.value));
  n.addEventListener("input", () => syncFrom(n.value));

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
  const b = Number(els.baseYear.value);

  const basePrices = { pA: state[b].pA, pB: state[b].pB };

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
    data: { labels: YEARS, datasets: [{ label, data }] },
    options: {
      responsive: true,
      maintainAspectRatio: true,
      plugins: { legend: { display: false } },
      scales: { x: { grid: { display: false } }, y: { grid: { display: true } } }
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
  const { realGrowth, infl } = series;
  const b = Number(els.baseYear.value);
  const baseLabel = YEARS[b];

  const msg =
    `Base year is <strong>${baseLabel}</strong>. Real GDP uses base-year prices and current quantities. ` +
    `If nominal rises but real is flat, the change is mostly <strong>prices</strong>. ` +
    `If real rises, the economy produced more <strong>stuff</strong> (quantities).`;

  const y2 = `Year 1 → Year 2: real growth ${isFinite(realGrowth[1]) ? pct(realGrowth[1]) : "—"}, deflator inflation ${isFinite(infl[1]) ? pct(infl[1]) : "—"}.`;
  const y3 = `Year 2 → Year 3: real growth ${isFinite(realGrowth[2]) ? pct(realGrowth[2]) : "—"}, deflator inflation ${isFinite(infl[2]) ? pct(infl[2]) : "—"}.`;

  els.explain.innerHTML = `${msg}<br><br><strong>${y2}</strong><br><strong>${y3}</strong>`;
}

function updateAll() {
  if (!outputsUnlocked) return;
  const series = computeSeries();
  updateTable(series);
  updateCharts(series);
  updateExplanation(series);
  completeRubric();
}

function applyInflationShock() {
  const factor = 1.25;
  for (let t = 1; t < 3; t++) {
    state[t].pA = Math.min(50, Math.round(state[t].pA * factor));
    state[t].pB = Math.min(50, Math.round(state[t].pB * factor));
  }
  syncUIFromState();
  setStatus("Applied an inflation shock: prices increased in Years 2–3 (quantities unchanged).");
}

function applyQuantityShock() {
  const factor = 1.20;
  for (let t = 1; t < 3; t++) {
    state[t].qA = Math.min(200, Math.round(state[t].qA * factor));
    state[t].qB = Math.min(200, Math.round(state[t].qB * factor));
  }
  syncUIFromState();
  setStatus("Applied a quantity shock: quantities increased in Years 2–3 (prices unchanged).");
}

function syncUIFromState() {
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
  state = scenarioSnapshot.map(y => ({ ...y }));
  resetRubric();
  syncUIFromState();
  clearQuiz(); // re-lock outputs and clear answers
}

function resetToScenario() {
  if (!scenarioSnapshot) return;
  state = scenarioSnapshot.map(y => ({ ...y }));
  resetRubric();
  syncUIFromState();
  clearQuiz(); // re-lock outputs and clear answers
}

function init() {
  scenarioSnapshot = generateScenario();
  state = scenarioSnapshot.map(y => ({ ...y }));

  setupBindings();

  els.baseYear.addEventListener("change", () => {
    resetRubric();
    if (outputsUnlocked) {
      updateAll();
      setStatus("Base year changed. Real GDP recalculated using the new base-year prices.");
    }
  });

  els.scenarioBtn.addEventListener("click", newScenario);
  els.resetBtn.addEventListener("click", resetToScenario);
  els.inflationShockBtn.addEventListener("click", () => { if (outputsUnlocked) applyInflationShock(); });
  els.quantityShockBtn.addEventListener("click", () => { if (outputsUnlocked) applyQuantityShock(); });

  // quiz buttons
  els.checkQuizBtn.addEventListener("click", checkQuiz);
  els.resetQuizBtn.addEventListener("click", clearQuiz);

  // start locked
  clearQuiz();
  setStatus("Answer the prediction questions to unlock the results.");
}

init();
