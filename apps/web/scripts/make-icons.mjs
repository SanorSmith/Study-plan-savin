// Draws the Study Plan icon (same notebook-and-badge as the Android app) into public/icons.
import sharp from "sharp";

const art = `
  <path fill="#fff" d="M34,28h40a4,4 0 0 1 4,4v44a4,4 0 0 1 -4,4h-40a4,4 0 0 1 -4,-4v-44a4,4 0 0 1 4,-4z"/>
  <path fill="#6C4CF1" d="M38,38h32v4h-32z"/><path fill="#6C4CF1" d="M38,50h32v4h-32z"/><path fill="#6C4CF1" d="M38,62h18v4h-18z"/>
  <circle cx="72" cy="72" r="14" fill="#FFB703"/>
  <path d="M65,72l5,5l9,-10" fill="none" stroke="#fff" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>`;

// "any": rounded tile. "maskable": full-bleed so the phone can crop it to any shape; art stays in the safe middle.
const any = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 108 108"><rect width="108" height="108" rx="24" fill="#6C4CF1"/>${art}</svg>`;
const maskable = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 108 108"><rect width="108" height="108" fill="#6C4CF1"/>${art}</svg>`;

// The kid web app gets its own color so the two icons are easy to tell apart on a home screen.
const kidArt = art.replace(/#6C4CF1/g, "#F59E0B").replace('fill="#FFB703"', 'fill="#6C4CF1"');
const kidAny = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 108 108"><rect width="108" height="108" rx="24" fill="#FFF3D6"/>${kidArt}</svg>`;
const kidMaskable = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 108 108"><rect width="108" height="108" fill="#FFF3D6"/>${kidArt}</svg>`;

for (const [name, svg, size] of [["icon-192", any, 192], ["icon-512", any, 512], ["maskable-512", maskable, 512], ["apple-touch-icon", maskable, 180],
  ["kid-icon-192", kidAny, 192], ["kid-icon-512", kidAny, 512], ["kid-maskable-512", kidMaskable, 512], ["kid-apple-touch-icon", kidMaskable, 180]]) {
  await sharp(Buffer.from(svg)).resize(size, size).png().toFile(`public/icons/${name}.png`);
}
