// A small helper module to generate plausible scenarios.
// We store and return a "scenario snapshot" so Reset works.

function randInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function clamp(v, lo, hi) {
  return Math.max(lo, Math.min(hi, v));
}

function generateScenario() {
  // Prices: 4..25, Quantities: 20..140 (reasonable ranges)
  // Build in mild trend + random noise so scenarios feel “economic”.
  const base = {
    A: { p: randInt(6, 18), q: randInt(40, 120) },
    B: { p: randInt(4, 16), q: randInt(30, 110) }
  };

  // Create three years with some random movement.
  // Year 1 is baseline; year 2 and 3 perturb both P and Q.
  const years = [0,1,2].map(t => {
    const pA = clamp(base.A.p + randInt(-2, 4) + t*randInt(0,2), 1, 50);
    const qA = clamp(base.A.q + randInt(-12, 18) + t*randInt(-4, 10), 0, 200);
    const pB = clamp(base.B.p + randInt(-2, 4) + t*randInt(0,2), 1, 50);
    const qB = clamp(base.B.q + randInt(-12, 18) + t*randInt(-4, 10), 0, 200);

    return { pA, qA, pB, qB };
  });

  return years;
}
