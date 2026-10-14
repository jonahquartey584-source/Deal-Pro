// Builds the downloadable PDFs: a multi-page deal pack for one deal, and a deal pack for a set of Deal Finder
// results. The page loads this file only when someone clicks a PDF button. It does no calculations of its own:
// every figure is worked out in the page and passed in, so the PDF always matches what the member sees.
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";

const RED = [224, 20, 43], INK = [21, 23, 26], MUTED = [91, 96, 106], LINE = [217, 219, 224], PALE = [245, 245, 247];
const M = 18; // page margin, mm
const clean = (s) => String(s ?? "").replace(/[‘’]/g, "'").replace(/[“”]/g, '"').replace(/→/g, "->")
  .replace(/[^\x20-\x7E£–—·• -ÿ]/g, "").replace(/[ \t]+/g, " ").trim();

function begin(opts) {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const P = { doc, W: doc.internal.pageSize.getWidth(), H: doc.internal.pageSize.getHeight(), y: M, ...opts };
  return P;
}
const room = (P, h) => { if (P.y + h > P.H - 22) { P.doc.addPage(); P.y = M + 4; } };
const newPage = (P) => { P.doc.addPage(); P.y = M + 4; };
const text = (P, s, { size = 10, bold = false, color = INK, x = M, align = "left" } = {}) => {
  P.doc.setFont("helvetica", bold ? "bold" : "normal"); P.doc.setFontSize(size); P.doc.setTextColor(...color);
  P.doc.text(clean(s), x, P.y, { align });
};
function heading(P, s) { room(P, 16); text(P, s, { size: 14, bold: true }); P.y += 2.5; P.doc.setDrawColor(...RED); P.doc.setLineWidth(0.6); P.doc.line(M, P.y, M + 14, P.y); P.y += 7; }
function sub(P, s) { room(P, 9); text(P, s, { size: 10.5, bold: true }); P.y += 5.5; }
function para(P, s, { size = 10, color = INK, bold = false, gap = 3 } = {}) {
  P.doc.setFont("helvetica", bold ? "bold" : "normal"); P.doc.setFontSize(size);
  const lh = size * 0.48;
  for (const line of P.doc.splitTextToSize(clean(s), P.W - 2 * M)) { room(P, lh); text(P, line, { size, color, bold }); P.y += lh; }
  P.y += gap;
}
function bullets(P, list, o = {}) {
  for (const item of (list || []).filter(Boolean)) {
    P.doc.setFontSize(o.size || 10); P.doc.setFont("helvetica", "normal");
    const lines = P.doc.splitTextToSize(clean(item), P.W - 2 * M - 5), lh = (o.size || 10) * 0.48;
    lines.forEach((line, i) => { room(P, lh); if (i === 0) text(P, "-", { size: o.size || 10, color: RED, x: M + 1 }); text(P, line, { size: o.size || 10, x: M + 5 }); P.y += lh; });
    P.y += 1.2;
  }
  P.y += 2;
}
function strip(P, items) { // a row of key figures
  const n = items.length, w = (P.W - 2 * M) / n, h = 20;
  room(P, h + 4);
  items.forEach(([label, value, tone], i) => {
    const x = M + i * w;
    P.doc.setFillColor(...PALE); P.doc.setDrawColor(...LINE); P.doc.setLineWidth(0.2); P.doc.roundedRect(x, P.y, w - 3, h, 1.5, 1.5, "FD");
    P.doc.setFont("helvetica", "normal"); P.doc.setFontSize(8); P.doc.setTextColor(...MUTED); P.doc.text(clean(label).toUpperCase(), x + 3, P.y + 6);
    P.doc.setFont("helvetica", "bold"); P.doc.setFontSize(value.length > 14 ? 11 : 14); P.doc.setTextColor(...(tone === "bad" ? [180, 35, 24] : INK)); P.doc.text(clean(value), x + 3, P.y + 14);
  });
  P.y += h + 6;
}
function table(P, head, body, columnStyles = {}, fontSize = 9) {
  if (!body.length) return;
  autoTable(P.doc, {
    startY: P.y, head: head ? [head.map(clean)] : undefined, body: body.map((r) => r.map(clean)), margin: { left: M, right: M, top: M + 4, bottom: 22 },
    styles: { font: "helvetica", fontSize, cellPadding: 2, textColor: INK, lineColor: LINE, lineWidth: 0.1, overflow: "linebreak", valign: "top" },
    headStyles: { fillColor: PALE, textColor: INK, fontStyle: "bold" }, alternateRowStyles: { fillColor: [251, 251, 252] }, columnStyles,
  });
  P.y = P.doc.lastAutoTable.finalY + 6;
}
function link(P, label, url, x = M) {
  const safe = /^https:\/\//.test(url || "") ? url : "";
  if (!safe) { text(P, label, { size: 9.5 }); return; }
  P.doc.setFont("helvetica", "normal"); P.doc.setFontSize(9.5); P.doc.setTextColor(0, 94, 184);
  P.doc.textWithLink(clean(label).slice(0, 90), x, P.y, { url: safe });
}

// Header and footer on every page, and the PREVIEW mark on unfinished packs.
function finish(P, { footerLeft, brand = "Deal Pro", watermark = false }) {
  const { doc } = P, pages = doc.getNumberOfPages();
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i);
    if (i > 1) { doc.setFont("helvetica", "bold"); doc.setFontSize(9); doc.setTextColor(...RED); doc.text(brand, M, 12); doc.setDrawColor(...LINE); doc.setLineWidth(0.2); doc.line(M, 14.5, P.W - M, 14.5); }
    doc.setDrawColor(...LINE); doc.setLineWidth(0.2); doc.line(M, P.H - 16, P.W - M, P.H - 16);
    doc.setFont("helvetica", "normal"); doc.setFontSize(8); doc.setTextColor(...MUTED);
    doc.text(clean(footerLeft).slice(0, 80), M, P.H - 11);
    doc.text(`Made with Deal Pro  |  Page ${i} of ${pages}`, P.W - M, P.H - 11, { align: "right" });
    if (watermark) {
      doc.saveGraphicsState(); doc.setGState(new doc.GState({ opacity: 0.1 }));
      doc.setFont("helvetica", "bold"); doc.setFontSize(90); doc.setTextColor(...RED); doc.text("PREVIEW", P.W / 2, P.H / 2 + 20, { angle: 35, align: "center" });
      doc.restoreGraphicsState();
    }
  }
}
const topBar = (P, left, right) => {
  text(P, "Deal Pro", { size: 12, bold: true, color: RED }); text(P, right, { size: 9, color: MUTED, x: P.W - M, align: "right" });
  P.y += 4; P.doc.setDrawColor(...LINE); P.doc.setLineWidth(0.2); P.doc.line(M, P.y, P.W - M, P.y); P.y += 9;
};
const DISCLAIMER = "This summary is not financial, legal or investment advice. Figures are rough estimates, are not verified and are not a forecast. Check every detail independently, and take your own advice, before committing money.";

/* ================= one deal: the deal pack ================= */
export function buildDealPack(d) {
  const P = begin();
  const tag = d.nda ? "Pre-NDA" : "Full";
  // 1. Cover
  topBar(P, "Deal Pro", `Investment summary  |  ${tag}  |  ${d.date}`);
  P.y += 6; text(P, d.name || "Untitled deal", { size: 24, bold: true }); P.y += 9;
  para(P, `${d.area}  |  ${d.strategy} opportunity  |  ${d.units.length} unit${d.units.length > 1 ? "s" : ""}`, { size: 11, color: MUTED, gap: 8 });
  strip(P, [["Upfront cash", d.upfront], ["Surplus at 80%", d.surplus80, d.surplus80Neg ? "bad" : ""], ["Break-even", d.breakEven]]);
  if (d.ai) {
    sub(P, "AI deal analysis");
    para(P, `${d.ai.verdict}${d.ai.score != null ? `  |  ${d.ai.score}/100` : ""}`, { size: 12, bold: true, gap: 1 });
    if (d.ai.summary) para(P, d.ai.summary);
  }
  sub(P, "Inside this pack");
  bullets(P, ["The deal: units, rent, deposits and the property details", "The numbers: illustrative monthly surplus at 60%, 80% and 100% occupancy, and the assumptions",
    d.ai ? "AI analysis: verdict, risks, missing information and next actions" : "", "Due diligence: the status of each check and the evidence gathered", "Next steps and terms"]);
  para(P, DISCLAIMER, { size: 8.5, color: MUTED });

  // 2. The deal
  newPage(P); heading(P, "The deal");
  para(P, "A rental business opportunity, not a purchase of the property. Terms are as advertised by the landlord and need written confirmation.");
  table(P, ["Unit", "Rent incl. bills", "Deposit", "Nightly rate (model)"], d.units.map((u) => [u.label, u.rent, u.dep, u.rate]), { 1: { halign: "right" }, 2: { halign: "right" }, 3: { halign: "right" } });
  if (d.units.length > 1) table(P, ["All units", ""], [["Rent", d.totalRent], ["Deposits", d.totalDeposits], ["Upfront", d.upfront]], { 1: { halign: "right" } });
  sub(P, "Property");
  table(P, null, [["Location", d.area], ["Strategy", d.strategy], ["Units", String(d.units.length)], ...(d.nda ? [["Exact address", "Released after the terms of business are signed"]] : [["Address", d.address || d.area]])], { 0: { cellWidth: 40, fontStyle: "bold" } });
  if (!d.nda && d.listings && d.listings.length) { sub(P, "Source listings"); d.listings.forEach((l) => { room(P, 6); link(P, l.label, l.url); P.y += 5.5; }); P.y += 3; }

  // 3. The numbers
  newPage(P); heading(P, "The numbers");
  sub(P, "Illustrative monthly surplus");
  table(P, ["Per unit", ...d.occ, "Break-even"], d.scen.map((s) => [s.label, ...s.vals, s.be]), Object.fromEntries([1, 2, 3, 4].map((i) => [i, { halign: "right" }])));
  para(P, d.assumptions, { size: 9, color: MUTED });
  if (d.ai) {
    if (d.ai.occupancy && d.ai.occupancy.length) { sub(P, "AI occupancy scenarios"); table(P, ["Occupancy", "Monthly profit"], d.ai.occupancy, { 1: { halign: "right" } }); }
    if (d.ai.stress && d.ai.stress.length) { sub(P, "Stress tests"); table(P, ["Scenario", "Result", "Still works?"], d.ai.stress); }
    if (d.ai.metrics && d.ai.metrics.length) { sub(P, "Key figures for this strategy"); table(P, null, d.ai.metrics, { 0: { cellWidth: 70, fontStyle: "bold" } }); }
  }

  // 4. AI analysis (only when the deal has one)
  if (d.ai) {
    newPage(P); heading(P, "AI analysis");
    para(P, `${d.ai.verdict}${d.ai.score != null ? `  |  ${d.ai.score}/100` : ""}`, { size: 13, bold: true, gap: 1 });
    if (d.ai.summary) para(P, d.ai.summary);
    if (d.ai.betterStrategy) { sub(P, "Another strategy may suit this better"); para(P, d.ai.betterStrategy); }
    if (d.ai.risks && d.ai.risks.length) { sub(P, "Risks"); bullets(P, d.ai.risks); }
    if (d.ai.assumptions && d.ai.assumptions.length) { sub(P, "Assumptions"); bullets(P, d.ai.assumptions); }
    if (d.ai.missing && d.ai.missing.length) { sub(P, "Information still missing"); bullets(P, d.ai.missing); }
    if (d.ai.next && d.ai.next.length) { sub(P, "Next actions"); bullets(P, d.ai.next); }
  }

  // 5. Due diligence
  newPage(P); heading(P, "Due diligence");
  const done = d.dd.filter((x) => x.done).length;
  para(P, `${done} of ${d.dd.length} checks are marked as clear. Each check is listed with its status and the evidence gathered so far.`);
  table(P, ["Check", "Status", "Notes", "Evidence"], d.dd.map((x) => [x.title, x.status, x.note || "-", x.evidence && x.evidence.length ? x.evidence.join(", ") : "None yet"]), { 0: { cellWidth: 48 }, 1: { cellWidth: 26 } }, 8.5);

  // 6. Next steps and terms
  room(P, 70); if (P.y > 140) newPage(P); heading(P, "Next steps and terms");
  para(P, `Sourcing fee: ${d.fee || "on request"}.`, { bold: true });
  para(P, "The full address and landlord introduction are released after you sign the terms of business and pay the reservation fee.");
  bullets(P, ["Review this summary and the figures with your own advisers", "Confirm the terms in writing with the landlord", "Sign the terms of business to receive the full address and landlord introduction", "Complete the due diligence checks that are still open"]);
  para(P, d.biz ? `Offered by ${d.biz}${d.redress ? `  |  Redress scheme: ${d.redress}` : ""}.` : "Sourcing business not set.", { size: 9, color: MUTED });
  para(P, DISCLAIMER, { size: 8.5, color: MUTED });

  finish(P, { footerLeft: `${(d.name || "").toUpperCase()}  |  ${d.nda ? "PRE-NDA SUMMARY" : "FULL SUMMARY"}`, watermark: !d.final });
  return P.doc;
}

/* ================= Deal Finder results: a pack of several deals ================= */
export function buildFinderPack(f) {
  const P = begin();
  topBar(P, "Deal Pro", `Property deal pack  |  ${f.date}${f.preNDA ? "  |  Pre-NDA" : ""}`);
  P.y += 6; text(P, `${f.deals.length} property deal${f.deals.length === 1 ? "" : "s"}`, { size: 24, bold: true }); P.y += 9;
  para(P, [f.location, f.mode, f.strategy].filter(Boolean).join("  |  "), { size: 11, color: MUTED, gap: 4 });
  if (f.criteria && f.criteria.length) { sub(P, "Search criteria"); bullets(P, f.criteria); }
  if (f.notes) { sub(P, "Investor criteria"); para(P, f.notes); }
  sub(P, "At a glance");
  const head = ["#", "Deal", "Area", f.buy ? "Price" : "Rent pcm", f.keyHead || "Key figure", ...(f.hasMv ? ["MV (est.)", "BMV"] : []), ...(f.hasScore ? ["AI"] : [])];
  table(P, head, f.deals.map((x) => [String(x.n), x.type, x.area, x.price, x.key, ...(f.hasMv ? [x.mv || "-", x.bmv || "-"] : []), ...(f.hasScore ? [x.score || "-"] : [])]),
    { 0: { cellWidth: 9 }, 3: { halign: "right" } }, 8.5);
  para(P, DISCLAIMER, { size: 8.5, color: MUTED });

  // One block per deal, two to a page.
  newPage(P);
  f.deals.forEach((x) => {
    room(P, 118);
    P.doc.setFillColor(...PALE); P.doc.rect(M, P.y - 5, P.W - 2 * M, 10, "F");
    text(P, `Deal ${x.n}  |  ${x.type}`, { size: 12, bold: true, x: M + 2 }); text(P, x.price, { size: 12, bold: true, x: P.W - M - 2, align: "right" }); P.y += 9;
    para(P, [x.area, x.site ? `Listed on ${x.site}` : "", x.listed].filter(Boolean).join("  |  "), { size: 9, color: MUTED, gap: 2 });
    if (x.score) para(P, `AI score ${x.score}${x.verdict ? `  |  ${x.verdict}` : ""}${x.reason ? `  |  ${x.reason}` : ""}`, { size: 9.5, bold: true, gap: 2 });
    table(P, null, x.lines.map((l) => [l]), { 0: { cellWidth: P.W - 2 * M } }, 8.5);
    if (x.url) { link(P, "Open the original listing", x.url); P.y += 6; }
    if (x.checked) para(P, x.checked, { size: 8.5, color: MUTED });
    P.y += 4;
  });
  finish(P, { footerLeft: `PROPERTY DEAL PACK  |  ${f.deals.length} DEAL${f.deals.length === 1 ? "" : "S"}${f.preNDA ? "  |  PRE-NDA" : ""}` });
  return P.doc;
}

export const toBlob = (doc) => doc.output("blob");
