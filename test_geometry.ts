import { getInnerEdgesAtY, getHoleSections, getPanelPoints, createRoofPoints, HoleSection } from "./server/utils";

// Test config matching user screenshot: 601mm wide, 720mm tall, left angle 9.45°
const w = 601;
const h = 720;
const ls = 90;
const rs = 90;
const ts = 90;
const bs = 90;
const arwL = 90;
const arwR = 90;
const angledLeft = true;
const angledRight = false;
const lcw = 100;
const lch = Math.round(Math.tan(9.45 * Math.PI / 180) * 100);
const rcw = 0;
const rch = 0;

console.log(`Door: ${w}x${h}mm, Left angle: lcw=${lcw}, lch=${lch}`);
console.log(`Borders: ls=${ls}, rs=${rs}, ts=${ts}, bs=${bs}`);

// Test getInnerEdgesAtY at bottom
const edge90 = getInnerEdgesAtY(bs, w, h, ls, rs, ts, bs, arwL, arwR, angledLeft, angledRight, lcw, lch, rcw, rch, 0);
console.log(`Inner edges at y=${bs}: left=${edge90.leftInner.toFixed(2)}, right=${edge90.rightInner.toFixed(2)}`);

// Inner edges at panel top
const edgeTop = getInnerEdgesAtY(h - ts, w, h, ls, rs, ts, bs, arwL, arwR, angledLeft, angledRight, lcw, lch, rcw, rch, 0);
console.log(`Inner edges at y=${h-ts}: left=${edgeTop.leftInner.toFixed(2)}, right=${edgeTop.rightInner.toFixed(2)}`);

// Test hole sections with 1 mid-rail at 360mm from bottom, 100mm tall
const midRails = [{ positionFromBottom: 360, dimension: 100 }];
const sections = getHoleSections(midRails, h, bs, ts, 1);
console.log(`\nHole sections with mid-rail:`);
sections.forEach((s, i) => console.log(`  Section ${i}: bottom=${s.bottom}, top=${s.top}, isTop=${s.isTop}`));

// Panel points per section
for (let i = 0; i < sections.length; i++) {
  const pts = getPanelPoints(sections[i], w, h, ls, rs, ts, bs, arwL, arwR, angledLeft, angledRight, lcw, lch, rcw, rch, 0);
  console.log(`\nPanel ${i} points (${pts.length} total):`);
  pts.forEach((p, j) => console.log(`  [${j}] x=${p.x.toFixed(2)}, y=${p.y.toFixed(2)}`));
}

// Without mid-rails
const sectionsNone = getHoleSections([], h, bs, ts, 1);
console.log(`\nHole sections (no mid-rail): bottom=${sectionsNone[0]?.bottom}, top=${sectionsNone[0]?.top}`);
const ptsNone = getPanelPoints(sectionsNone[0], w, h, ls, rs, ts, bs, arwL, arwR, angledLeft, angledRight, lcw, lch, rcw, rch, 0);
console.log(`Panel points (no mid-rail) - ${ptsNone.length} total:`);
ptsNone.forEach((p, j) => console.log(`  [${j}] x=${p.x.toFixed(2)}, y=${p.y.toFixed(2)}`));
