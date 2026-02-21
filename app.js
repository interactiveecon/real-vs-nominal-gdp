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

  // quiz (predict-first)
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

let chartNom = null;
let chartReal = null;
let chartDef = null;

let outputsUnlocked = false;

function setStatus(msg) {
  if (els.status) els.status.textContent = msg;
}

function money(x) { return x.toFixed(0); }
function pct(x) { return isFinite(x) ? (100 * x).toFixed(1) + "%" : "—"; }
function defl(x) { return isFinite(x) ? x.toFixed(1) : "—"; }

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
  refreshExitPrompts(); // make exit questions reflect base year + scenario
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
  names.forEach(q => document.querySelectorAll(`input[name="${q}"]`).forEach(r => { r.checked = false; }));
}

function clearPredictQuiz() {
  clearRadios(["q1","q2","q3"]);
  if (els.quizStatus) els.quizStatus.textContent = "";
  [els.fb_q1, els.fb_q2, els.fb_q3].forEach(x => {
    if (!x) return;
    x.textContent = "";
    x.classList.remove("good","bad");
  });
  lockOutputs();
  setStatus("Answer the prediction questions to unlock the results.");
}

function checkPredictQuiz() {
  // Correct answers (no deflator references):
  // q1 prices-only -> nominal ↑, real unchanged (b)
  // q2 quantities-only -> nominal ↑, real ↑ (a)
  // q3 nominal ↑, real flat -> higher prices (b)
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
    if (els.quizStatus) els.quizStatus.textContent = "Unlocked ✓ Now explore with shocks and sliders.";
    unlockOutputs();
    setStatus("Unlocked. Try price-only vs quantity-only changes and compare nominal vs real.");
  } else {
    if (els.quizStatus) els.quizStatus.textContent = "Not yet—fix the incorrect items and try again.";
    lockOutputs();
  }
}

/* ---------- Inputs binding ---------- */
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

/* ---------- Computation ---------- */
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

/* ---------- Rendering ---------- */
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

/* ---------- Shocks ---------- */
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
  updateAll();
  refreshExitPrompts();
}

function applyInflationShock() {
  const factor = 1.25;
  for (let t = 1; t < 3; t++) {
    state[t].pA = Math.min(50, Math.round(state[t].pA * factor));
    state[t].pB = Math.min(50, Math.round(state[t].pB * factor));
  }
  syncUIFromState();
  setStatus("Applied a price-only shock in Years 2–3 (quantities unchanged).");
}

function applyQuantityShock() {
  const factor = 1.20;
  for (let t = 1; t < 3; t++) {
    state[t].qA = Math.min(200, Math.round(state[t].qA * factor));
    state[t].qB = Math.min(200, Math.round(state[t].qB * factor));
  }
  syncUIFromState();
  setStatus("Applied a quantity-only shock in Years 2–3 (prices unchanged).");
}

/* ---------- Exit Ticket ---------- */
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

  // pick a non-base year label for the contrast
  const nonBase = (b + 1) % 3;
  const nonBaseLabel = YEARS[nonBase];

  if (els.exitQ1Title) {
    els.exitQ1Title.textContent =
      `1) Real GDP uses base-year prices. If you increase prices in the base year (${baseLabel}) only (quantities fixed), what happens to Real GDP across years?`;
  }

  // Scenario-specific: compare real GDP from Year 1 to Year 2 (given current base year)
  const series = computeSeries();
  const r0 = series.real[0];
  const r1 = series.real[1];
  let trend = "unchanged";
  if (r1 > r0 * 1.001) trend = "increases";
  if (r1 < r0 * 0.999) trend = "decreases";

  if (els.exitQ2Title) {
    els.exitQ2Title.textContent =
      `2) Using the current base year (${baseLabel}), from Year 1 to Year 2, Real GDP mostly:`;
  }

  // store correct answers on the DOM for simplicity
  // e1 correct: Real GDP increases in all years when base-year prices rise
  // e2 correct depends on computed trend
  els.exitCard.dataset.e1 = "a";
  els.exitCard.dataset.e2 = (trend === "increases") ? "a" : (trend === "decreases") ? "b" : "c";
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
      ? "✓ Correct: Real GDP uses base-year prices, so changing base-year prices changes Real GDP in every year (given quantities)."
      : "Not quite. Because Real GDP uses base-year prices, changing the base-year prices affects Real GDP in every year."
  );

  setFeedback(els.fb_e2, ok2,
    ok2
      ? "✓ Correct for this scenario (given your chosen base year and current quantities)."
      : "Not quite. Look at the Real GDP column (base-year prices) for Year 1 vs Year 2."
  );

  if (els.exitStatus) {
    els.exitStatus.textContent = (ok1 && ok2) ? "Exit ticket complete ✓" : "Not yet—fix the incorrect item(s) and try again.";
  }
}

/* ---------- Scenario control ---------- */
function newScenario() {
  scenarioSnapshot = generateScenario();
  state = scenarioSnapshot.map(y => ({ ...y }));
  syncUIFromState();
  clearPredictQuiz();
  clearExit();
}

function resetToScenario() {
  if (!scenarioSnapshot) return;
  state = scenarioSnapshot.map(y => ({ ...y }));
  syncUIFromState();
  clearPredictQuiz();
  clearExit();
}

/* ---------- Init ---------- */
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

  els.inflationShockBtn.addEventListener("click", () => { if (outputsUnlocked) applyInflationShock(); });
  els.quantityShockBtn.addEventListener("click", () => { if (outputsUnlocked) applyQuantityShock(); });

  // Predict quiz buttons
  els.checkQuizBtn.addEventListener("click", checkPredictQuiz);
  els.resetQuizBtn.addEventListener("click", clearPredictQuiz);

  // Exit ticket buttons
  els.checkExitBtn.addEventListener("click", checkExit);
  els.resetExitBtn.addEventListener("click", clearExit);

  // start locked
  clearPredictQuiz();
  clearExit();
}

init();
