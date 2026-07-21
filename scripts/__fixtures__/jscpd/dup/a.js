function computeTotals(rows) {
  let sum = 0; let count = 0;
  for (const r of rows) { sum += r.value; count += 1; }
  return { sum, count, avg: count ? sum / count : 0 };
}
module.exports = { computeTotals };
