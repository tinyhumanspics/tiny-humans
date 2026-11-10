// Valentine's theme artwork (owner, Nov 10): the logo's heart layer (public/brand/valentines/decor.webp, on the
// Original logo's 1012 x 896 canvas), the email logo (440 px, on the board color) and the email chalk strip
// (1200 x 96), all with the site's own chalk texture. Also prints the intro animation's heart strokes
// (config/logo/valentines-drawing.ts). Usage from the repo root: node scripts/theme-assets-valentines.mjs <out dir>
// The two email JPEGs go into lib/email/assets.ts as base64 (EMAIL_IMAGES.valentines). Uses sharp (installed by Next).
import fs from "node:fs";
import sharp from "sharp";
const out = process.argv[2];
const HEART = "M24 40 C14 32 6 26 6.5 17 C7 10 14 6.5 19 9 C21.5 10.3 23 12.5 24 15 C25.3 12 27.5 9.5 31 8.5 C37 7 42.5 11.5 41.5 18.5 C40.5 26 33 32 24.5 40.5";
const W = 1012, H = 896;
const hearts = [
  { x: 100, y: 118, s: 150, r: -16, c: "#ff4f6d" },
  { x: 868, y: 118, s: 165, r: 14, c: "#ff8fb3" },
  { x: 722, y: 46, s: 70, r: -10, c: "#ff4f6d" },
  { x: 300, y: 42, s: 58, r: 8, c: "#ffb3cb" },
  { x: 976, y: 300, s: 58, r: 18, c: "#ffc2d4" },
  { x: 62, y: 560, s: 82, r: -12, c: "#ff8fb3" },
  { x: 966, y: 596, s: 64, r: 10, c: "#ff4f6d" },
];
function heartSvg(h, i) {
  const k = h.s / 48;
  const t = `translate(${h.x} ${h.y}) rotate(${h.r}) scale(${k}) translate(-24 -24)`;
  return `<clipPath id="c${i}"><path d="${HEART} Z" transform="${t}"/></clipPath>
  <g clip-path="url(#c${i})"><rect x="${h.x - h.s}" y="${h.y - h.s}" width="${h.s * 2}" height="${h.s * 2}" fill="url(#hatch${i})"/></g>
  <pattern id="hatch${i}" width="15" height="15" patternUnits="userSpaceOnUse" patternTransform="rotate(${35 + h.r})"><rect width="15" height="15" fill="${h.c}" opacity="0.32"/><line x1="0" y1="0" x2="0" y2="15" stroke="${h.c}" stroke-width="9" opacity="0.95"/></pattern>
  <path d="${HEART}" transform="${t}" fill="none" stroke="${h.c}" stroke-width="${3.2 / k * 4.2}" stroke-linecap="round" stroke-linejoin="round"/>`;
}
const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">${hearts.map(heartSvg).join("")}</svg>`;
(async () => {
  // chalk grain: the site's own chalk mask, tiled, cut into the hearts' alpha
  const tile = await sharp("public/textures/chalk-mask.webp").resize(300, 300).png().toBuffer();
  const mask = await sharp({ create: { width: W, height: H, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } }).composite([{ input: tile, tile: true }]).png().toBuffer();
  const raw = await sharp(Buffer.from(svg)).png().toBuffer();
  const decor = await sharp(raw).composite([{ input: mask, blend: "dest-in" }]).png().toBuffer();
  fs.mkdirSync("public/brand/valentines", { recursive: true });
  await sharp(decor).webp({ quality: 86, alphaQuality: 90 }).toFile("public/brand/valentines/decor.webp");
  // preview + email logo: Original layers + hearts on the raspberry board, 440 px wide
  const layers = ["rays", "sun", "cloud"].map((k) => ({ input: `public/brand/default/${k}.webp` }));
  const full = await sharp({ create: { width: W, height: H, channels: 4, background: "#7a2648" } }).composite([...layers, { input: decor }, { input: "public/brand/default/text.webp" }]).png().toBuffer();
  await sharp(full).toFile(out + "/valentines-logo-full.png");
  const logo = await sharp(full).resize(440).jpeg({ quality: 84, mozjpeg: true }).toBuffer();
  fs.writeFileSync(out + "/tiny-humans-logo-valentines.jpg", logo);
  // the chalk strip under the email header: Valentine drawings on the board color, 1200 x 96
  const shapes = {
    heart: [HEART],
    twoHearts: ["M18 36 C11 30 5 26 5.5 19.5 C6 14.5 11 12 14.8 13.8 C16.6 14.7 17.5 16.2 18 18 C18.8 16 20.5 14.2 23 13.5 C27.5 12.4 31 15.5 30.4 20.5 C29.8 26 24.5 30.5 18.3 36.5", "M31 24 C35 19.5 39 18.8 41.5 20.6 C44 22.4 43.8 26.4 41 29.3 C38.6 31.8 34.8 33.6 31.2 35.5 C30.6 32.6 30.2 28 31 24"],
    xo: ["M6 15 L19 33", "M19 15 L6 33", "M34.5 14.5 C27 14.5 25.5 33.5 34.5 33.5 C42.5 33.5 42.5 14.5 35 14.5"],
    rose: ["M24 17 C27 15 26 11.5 23 12.5 C19.5 13.5 19.5 19 24 20 C30 21 31 12.5 26 9.5 C20 6.5 14 11.5 15 18.5 C16 24.5 22 26.5 27.5 24.5", "M23 25 C24 31 23 37 24 44", "M23.6 35 C27.5 31 32.5 31 35 33 C32 36 27.8 36.3 23.8 35"],
    loveLetter: ["M7 13 L41 13 L41 36 L7 36 Z", "M7.5 14 L24 25 L40.5 14", "M24 33 C20 30 17.5 26 17.8 22.8 C18 20.5 20.5 19.4 22.3 20.4 C23.2 20.9 23.7 21.6 24 22.5 C24.4 21.5 25.2 20.7 26.4 20.3 C28.6 19.7 30.6 21.3 30.2 23.8 C29.8 26.3 27.3 28.2 24 31"],
    heartArrow: [HEART, "M5 39 L43 9", "M43 9 L36.5 9.8 M43 9 L42.2 15.5", "M5 39 L4 33.5 M5 39 L10.5 40"],
  };
  const row = [["heart", "#ff6b81", -12], ["rose", "#ff9cbc", 8], ["xo", "#ffd3df", -4], ["loveLetter", "#ffd3df", 6], ["twoHearts", "#ff9cbc", -6], ["heartArrow", "#ff6b81", 10], ["heart", "#ff9cbc", 12], ["xo", "#ffd3df", 4], ["rose", "#ff6b81", -8], ["twoHearts", "#ffd3df", 6]];
  const strip = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="96" viewBox="0 0 1200 96">${row.map(([n, c, r], i) => {
    const x = 20 + i * 117 + (i % 2 ? 14 : 0), y = i % 2 ? 30 : 16;
    return `<g transform="translate(${x} ${y}) rotate(${r} 24 24)" fill="none" stroke="${c}" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round">${shapes[n].map((d) => `<path d="${d}"/>`).join("")}</g>`;
  }).join("")}</svg>`;
  const tile2 = await sharp("public/textures/chalk-mask.webp").resize(96, 96).png().toBuffer();
  const mask2 = await sharp({ create: { width: 1200, height: 96, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } }).composite([{ input: tile2, tile: true }]).png().toBuffer();
  const doodles = await sharp(await sharp(Buffer.from(strip)).png().toBuffer()).composite([{ input: mask2, blend: "dest-in" }]).png().toBuffer();
  const stripJpg = await sharp({ create: { width: 1200, height: 96, channels: 4, background: "#7a2648" } }).composite([{ input: doodles }]).jpeg({ quality: 82, mozjpeg: true }).toBuffer();
  fs.writeFileSync(out + "/tiny-humans-chalk-valentines.jpg", stripJpg);
  const m = await sharp(logo).metadata();
  console.log("decor", fs.statSync("public/brand/valentines/decor.webp").size, "logo", m.width, m.height, logo.length, "strip", stripJpg.length);
  // the intro animation: one zigzag stroke over each heart (reveals the decor layer before the lettering)
  const strokes = hearts.map((h, i) => {
    const half = h.s * 0.62, x0 = Math.max(0, h.x - half), x1 = Math.min(W, h.x + half), y0 = Math.max(0, h.y - half), y1 = Math.min(H, h.y + half);
    const pts = []; for (let x = x0, up = true; x <= x1 + 1; x += 27.3, up = !up) pts.push([x, up ? y0 : y1]);
    let len = 0; for (let j = 1; j < pts.length; j++) len += Math.hypot(pts[j][0] - pts[j - 1][0], pts[j][1] - pts[j - 1][1]);
    return { id: `decor${i}`, d: pts.map(([x, y], j) => `${j ? "L" : "M"}${x.toFixed(1)} ${y.toFixed(1)}`).join(" "), length: Math.round(len), width: 44, start: +(1.36 + i * 0.035).toFixed(3), duration: +Math.min(0.3, 0.12 + len / 12000).toFixed(3) };
  });
  fs.writeFileSync(out + "/decor-strokes.json", JSON.stringify(strokes, null, 1));
})();
