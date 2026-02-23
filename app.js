/* global generateScenario, Chart */

const YEARS = ["Year 1", "Year 2", "Year 3"];
const Y_AXIS_MAX = 20000; // static axis: 2 goods * (Pmax 50) * (Qmax 200) = 20000

const els = {
  baseYear: document.getElementById("baseYear"),
  scenarioBtn: document.getElementById("scenarioBtn"),
  resetBtn: document.getElementById("resetBtn"),
  status: document.getElementById("status"),
  outTable: document.getElementById("outTable"),
  explain: document.getElementById("explain"),

  // rubric
  ruleNom: document.getElementById("ruleNom"),
  ruleReal: document.getElementById("ruleReal"),
  ruleDef: document.getElementById("ruleDef"),

  // predict-first quiz
  checkQuizBtn: document.getElementById("checkQuizBtn"),
  resetQuizBtn: document.getElementById("resetQuizBtn"),
  quizStatus: document.getElementById("quizStatus"),
  fb_q1: document.getElementById("fb_q1"),
  fb_q2: document.getElementById("fb_q2"),
  fb_q3: document.getElementById("fb_q3"),

  // lock
  lockedWrap: document.getElementById("lockedWrap"),

  // exit ticket
  exitCard: document.getElementById("exitCard"),
  exitQ1Title: document.getElementById("exitQ1Title"),
  exitQ2Title: document.getElementById("exitQ2Title"),
  checkExitBtn: document.getElementById("checkExitBtn"),
  resetExitBtn: document.getElementById("resetExitBtn"),
  exitStatus: document.getElementById("exitStatus"),
  fb_e1: document.getElementById("fb_e1"),
  fb_e2: document.getElementById("fb_e2")
};

let state = null;
let scenarioSnapshot = null;

let chartNR = null;
let outputsUnlocked = false;

function setStatus(msg) {
  if (els.status) els.status.textContent = msg;
}

function money(x) { return x.toFixed(0); }

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
  if (els.exitCard) els.exitCard.classList.add("hidden");
  resetRubric();
}

function unlockOutputs() {
  outputsUnlocked = true;
  if (els.lockedWrap) els.lockedWrap.classList.remove("locked");
  if (els.exitCard) els.exitCard.classList.remove("hidden");
  updateAll();
  refreshExitPrompts();
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

function clearRadios(names) {
  names.forEach(q =>
    document.querySelectorAll(`input[name="${q}"]`).forEach(r => { r.checked = false; })
  );
}

/* -------------------------
   Predict-first quiz (only required once per page load)
------------------------- */
function clearPredictQuizUI() {
  clearRadios(["q1","q2","q3"]);
  if (els.quizStatus) els.quizStatus.textContent = "";
  [els.fb_q1, els.fb_q2, els.fb_q3].forEach(x => {
    if (!x) return;
    x.textContent = "";
    x.classList.remove("good","bad");
  });
}

function requirePredictQuizOnce() {
  // called only at initial page load
  clearPredictQuizUI();
  lockOutputs();
  setStatus("Answer the prediction questions to unlock the results.");
}

function checkPredictQuiz() {
  const ans = { q1: "b", q2: "a", q3: "b" };

  const a1 = getSelected("q1");
  const a2 = getSelected("q2");
  const a3 = getSelected("q3");

  const ok1 = (a1 === ans.q1);
  const ok2 = (a2 === ans.q2);
  const ok3 = (a3 === ans.q3);

  setFeedback(els.fb_q1, ok1,
    ok1 ? "✓ Correct: nominal uses current prices; real uses base-year prices, so price-only changes don’t change real." :
          "Not quite. If only prices rise (quantities fixed), nominal rises but real (base-year prices) is unchanged."
  );
  setFeedback(els.fb_q2, ok2,
    ok2 ? "✓ Correct: higher quantities raise both nominal and real when prices are fixed." :
          "Not quite. If only quantities rise (prices fixed), both nominal and real rise."
  );
  setFeedback(els.fb_q3, ok3,
    ok3 ? "✓ Correct: nominal up with real flat points to higher prices (not higher quantities)." :
          "Not quite. If real is flat, the rise in nominal is mainly prices."
  );

  const allAnswered = (a1 && a2 && a3);
  const allCorrect = (ok1 && ok2 && ok3);

  if (!allAnswered) {
    if (els.quizStatus) els.quizStatus.textContent = "Answer all three questions, then check again.";
    lockOutputs();
    return;
  }

  if (allCorrect) {
    if (els.quizStatus) els.quizStatus.textContent = "Unlocked ✓";
    unlockOutputs();
    setStatus("Unlocked. Now try changing only prices vs only quantities and compare nominal vs real.");
  } else {
    if (els.quizStatus) els.quizStatus.textContent = "Not yet—fix the incorrect items and try again.";
    lockOutputs();
  }
}

/* -------------------------
   Inputs binding
------------------------- */
function bindPair(rangeId, numberId, getVal, setVal) {
  const r = document.getElementById(rangeId);
  const n = document.getElementById(numberId);

  function syncFrom(v) {
    const vv = Number(v);
    r.value = vv;
    n.value = vv;
    setVal(vv);
    if (outputsUnlocked) {
      updateAll();
      refreshExitPrompts();
    }
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

/* -------------------------
   Computation
------------------------- */
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

  const realGrowth = [
    NaN,
    (real[0] === 0) ? NaN : (real[1] - real[0]) / real[0],
    (real[1] === 0) ? NaN : (real[2] - real[1]) / real[1]
  ];

  const inflation = [
    NaN,
    (deflator[0] === 0) ? NaN : (deflator[1] - deflator[0]) / deflator[0],
    (deflator[1] === 0) ? NaN : (deflator[2] - deflator[1]) / deflator[1]
  ];

  return { nominal, real, deflator, realGrowth, inflation };
}

/* -------------------------
   Rendering
------------------------- */
function fmtPct(x) {
  return isFinite(x) ? (100 * x).toFixed(1) + "%" : "—";
}
function fmtDef(x) {
  return isFinite(x) ? x.toFixed(1) : "—";
}

function updateTable(series) {
  const { nominal, real, deflator, inflation, realGrowth } = series;

  els.outTable.innerHTML = "";
  for (let t = 0; t < 3; t++) {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${YEARS[t]}</td>
      <td>${state[t].pA}</td><td>${state[t].qA}</td>
      <td>${state[t].pB}</td><td>${state[t].qB}</td>
      <td>${money(nominal[t])}</td>
      <td>${money(real[t])}</td>
      <td>${fmtDef(deflator[t])}</td>
      <td>${t === 0 ? "—" : fmtPct(inflation[t])}</td>
      <td>${t === 0 ? "—" : fmtPct(realGrowth[t])}</td>
    `;
    els.outTable.appendChild(tr);
  }
}

function makeNRChart() {
  const ctx = document.getElementById("chartNR");
  const series = computeSeries();

  return new Chart(ctx, {
    type: "line",
    data: {
      labels: YEARS,
      datasets: [
        { label: "Nominal GDP", data: series.nominal },
        { label: "Real GDP", data: series.real }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: true,
      plugins: { legend: { display: true } },
      scales: {
        x: { grid: { display: false } },
        y: {
          min: 0,
          max: Y_AXIS_MAX,   // keep static axis
          grid: { display: true },
          ticks: { maxTicksLimit: 6 }
        }
      }
    }
  });
}

function updateChart(series) {
  if (!chartNR) {
    chartNR = makeNRChart();
    return;
  }
  chartNR.data.datasets[0].data = series.nominal;
  chartNR.data.datasets[1].data = series.real;
  chartNR.update();
}

function updateExplanation() {
  const b = Number(els.baseYear.value);
  const baseLabel = YEARS[b];

  els.explain.innerHTML =
    `Base year is <strong>${baseLabel}</strong>. Real GDP uses base-year prices and current quantities. ` +
    `Changing a <em>non–base-year</em> price changes nominal GDP but does not change real GDP. ` +
    `Changing a quantity changes both nominal and real GDP.`;
}

function updateAll() {
  if (!outputsUnlocked) return;
  const series = computeSeries();
  updateTable(series);
  updateChart(series);   // chart reads series.nominal/series.real
  updateExplanation();
  completeRubric();
}

/* -------------------------
   Exit Ticket
------------------------- */
function clearExit() {
  clearRadios(["e1","e2"]);
  if (els.exitStatus) els.exitStatus.textContent = "";
  [els.fb_e1, els.fb_e2].forEach(x => {
    if (!x) return;
    x.textContent = "";
    x.classList.remove("good","bad");
  });
}

function refreshExitPrompts() {
  if (!outputsUnlocked) return;

  const b = Number(els.baseYear.value);
  const baseLabel = YEARS[b];

  if (els.exitQ1Title) {
    els.exitQ1Title.textContent =
      `1) Real GDP uses base-year prices. If you increase prices in the base year (${baseLabel}) only (quantities fixed), what happens to Real GDP across years?`;
  }

  // Exit Q2: classify Year1->Year2 as mostly prices vs mostly quantities vs both
  const basePrices = { pA: state[b].pA, pB: state[b].pB };

  const dQ_A = state[1].qA - state[0].qA;
  const dQ_B = state[1].qB - state[0].qB;

  const qtyEffect = basePrices.pA * dQ_A + basePrices.pB * dQ_B;
  const priceEffect = (state[1].pA - state[0].pA) * state[1].qA + (state[1].pB - state[0].pB) * state[1].qB;

  const absQ = Math.abs(qtyEffect);
  const absP = Math.abs(priceEffect);

  let correct;
  if (absQ < 1e-6 && absP < 1e-6) correct = "c";
  else if (absP > 1.5 * absQ) correct = "a";   // mostly prices
  else if (absQ > 1.5 * absP) correct = "b";   // mostly quantities
  else correct = "c";                          // both about equally

  if (els.exitQ2Title) {
    els.exitQ2Title.textContent =
      `2) From Year 1 → Year 2 (with base year ${baseLabel}), the change in GDP is driven mostly by:`;
  }

  els.exitCard.dataset.e1 = "a";
  els.exitCard.dataset.e2 = correct;
}

function checkExit() {
  if (!outputsUnlocked) return;

  const a1 = getSelected("e1");
  const a2 = getSelected("e2");

  if (!a1 || !a2) {
    if (els.exitStatus) els.exitStatus.textContent = "Answer both exit questions, then check again.";
    return;
  }

  const ans1 = els.exitCard.dataset.e1;
  const ans2 = els.exitCard.dataset.e2;

  const ok1 = (a1 === ans1);
  const ok2 = (a2 === ans2);

  setFeedback(els.fb_e1, ok1,
    ok1
      ? "✓ Correct: changing base-year prices changes Real GDP in every year (those prices are used for all years)."
      : "Not quite. Real GDP uses base-year prices for every year, so changing base-year prices changes Real GDP in every year."
  );

  setFeedback(els.fb_e2, ok2,
    ok2
      ? "✓ Correct for this scenario."
      : "Not quite. Compare quantity changes (at base prices) versus price changes (at Year 2 quantities)."
  );

  if (els.exitStatus) {
    els.exitStatus.textContent = (ok1 && ok2) ? "Exit ticket complete ✓" : "Not yet—fix the incorrect item(s) and try again.";
  }
}

/* -------------------------
   Scenario control
------------------------- */
function syncUIFromState() {
  for (let t = 0; t < 3; t++) {
    const pairs = [
      [`pA${t}_r`, `pA${t}_n`, state[t].pA],
      [`qA${t}_r`, `qA${t}_n`, state[t].qA],
      [`pB${t}_r`, `pB${t}_n`, state[t].pB],
      [`qB${t}_r`, `qB${t}_n`, state[t].qB]
    ];
    for (const [rid, nid, val] of pairs) {
      document.getElementById(rid).value = val;
      document.getElementById(nid).value = val;
    }
  }
  if (outputsUnlocked) {
    updateAll();
    refreshExitPrompts();
  }
}

function newScenario() {
  scenarioSnapshot = generateScenario();
  state = scenarioSnapshot.map(y => ({ ...y }));
  syncUIFromState();
  clearExit();
  // IMPORTANT: do NOT relock outputs once unlocked
  if (!outputsUnlocked) {
    setStatus("New scenario generated. Complete Predict first to unlock.");
  } else {
    setStatus("New scenario generated (still unlocked).");
  }
}

function resetToScenario() {
  if (!scenarioSnapshot) return;
  state = scenarioSnapshot.map(y => ({ ...y }));
  syncUIFromState();
  clearExit();
  if (!outputsUnlocked) {
    setStatus("Reset to scenario. Complete Predict first to unlock.");
  } else {
    setStatus("Reset to scenario (still unlocked).");
  }
}

/* -------------------------
   Init
------------------------- */
function init() {
  scenarioSnapshot = generateScenario();
  state = scenarioSnapshot.map(y => ({ ...y }));

  setupBindings();

  els.baseYear.addEventListener("change", () => {
    resetRubric();
    if (outputsUnlocked) {
      updateAll();
      refreshExitPrompts();
      setStatus("Base year changed. Real GDP recalculated using the new base-year prices.");
    }
  });

  els.scenarioBtn.addEventListener("click", newScenario);
  els.resetBtn.addEventListener("click", resetToScenario);

  els.checkQuizBtn.addEventListener("click", checkPredictQuiz);
  els.resetQuizBtn.addEventListener("click", clearPredictQuizUI); // clears UI only, does NOT relock if already unlocked

  els.checkExitBtn.addEventListener("click", checkExit);
  els.resetExitBtn.addEventListener("click", clearExit);

  // Require predict-first only on initial load
  requirePredictQuizOnce();
  clearExit();
}

init();
