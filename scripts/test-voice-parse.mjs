// Quick manual test — run: node scripts/test-voice-parse.mjs

const transcript =
  "OK I have About $370,963 in institutional total bond market LX trust UB which is a vanguard fund OK and then I have a Vanguard funds called institutional 500 LDXTR unit B And I have $465,878 in there I also have a Institutional total international stock market ITUB and I have $398,577 And then I have a Retire savings trust to also in Vanguard and that's $73,968 And then there's a Vanguard font that is DFFVX and I have 3010 scares I also have the VWENX or Wellington font admiral and I have foreign at 87,788 Dollars in that font";

function normalizeNumberCommas(text) {
  return text.replace(/(\d),(\d{3}(?:,\d{3})*(?:\.\d+)?)/g, (_, left, right) => {
    return left + right.replace(/,/g, "");
  });
}

function splitSegments(transcript) {
  const cleaned = normalizeNumberCommas(transcript);
  return cleaned
    .split(/\b(?:ok|and then|i also have|also have|plus|then)\b|\.\s+|\n+|;\s*/i)
    .map((s) => s.trim())
    .filter((s) => s.length > 3);
}

function parseDollars(segment) {
  const normalized = normalizeNumberCommas(segment).toLowerCase();
  const dollarSign = normalized.match(/\$\s*([\d,]+(?:\.\d+)?)/);
  if (dollarSign) return parseFloat(dollarSign[1].replace(/,/g, ""));
  const dollarsWord = normalized.match(/([\d,]+(?:\.\d+)?)\s*dollars?/);
  if (dollarsWord) return parseFloat(dollarsWord[1].replace(/,/g, ""));
  const inAmount = normalized.match(/(?:about|roughly|around|have|that's|at)\s+\$?\s*([\d,]+(?:\.\d+)?)/);
  if (inAmount) return parseFloat(inAmount[1].replace(/,/g, ""));
  return undefined;
}

function parseShares(segment) {
  const m = segment.match(/([\d,]+(?:\.\d+)?)\s+(?:shares?|scares?)/i);
  if (m) return parseFloat(m[1].replace(/,/g, ""));
  return undefined;
}

const segments = splitSegments(transcript);
console.log("Segments:", segments.length);
segments.forEach((s, i) => {
  const d = parseDollars(s);
  const sh = parseShares(s);
  if (d || sh) console.log(`[${i}] $${d} | ${sh} shares | ${s.slice(0, 80)}`);
});
