// scripts/organizeFromMain.mjs
// Normalizes any PNGs found anywhere under public/ranges/Main into:
//   public/ranges/Main/7max/open/<POS>/<STACK>.png

import fs from "fs";
import path from "path";

const ROOT = process.cwd();
const MAIN_ROOT = path.join(ROOT, "public", "ranges", "Main");
const DEST_ROOT = path.join(MAIN_ROOT, "7max", "open");

const POS_ALIASES = new Map([
  ["UTG1","UTG"], ["UTG2","LJ"], ["UTG3","HJ"],
  ["UTG","UTG"], ["MP","LJ"], ["LJ","LJ"], ["HJ","HJ"],
  ["CO","CO"], ["BTN","BTN"], ["SB","SB"], ["BB","BB"]
]);

const VALID_STACKS = new Set(["15","20","25","30","40","50","60","80","100"]);
const VALID_BUCKETS = new Set([...VALID_STACKS].map(n => `${n}bb`));

// Common name patterns:
//   "UTG_25bb.png", "utg-25.png", "MP RFI 40bb.PNG", "BTN-open_100.PNG"
//   Also try to pull clues from parent folder names.
const RX_NAME = /^(UTG\d?|MP|LJ|HJ|CO|BTN|SB|BB)[ _-]?(?:RFI|OPEN)?[ _-]?(\d{2,3})(?:bb)?\.(png|PNG)$/i;

function ensureDir(p) { fs.mkdirSync(p, { recursive: true }); }
function normPos(raw) { return POS_ALIASES.get(String(raw).toUpperCase()) || String(raw).toUpperCase(); }
function normBucket(n) {
  const s = String(Number(n));        // strip leading zeros
  if (!VALID_STACKS.has(s)) return null;
  return `${s}bb`;
}

// Walk all files under MAIN_ROOT
function walk(dir, out=[]) {
  for (const entry of fs.readdirSync(dir, { withFileTypes:true })) {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(p, out);
    else if (entry.isFile() && /\.png$/i.test(entry.name)) out.push(p);
  }
  return out;
}

function inferFromPath(fileAbs) {
  const rel = path.relative(MAIN_ROOT, fileAbs);
  const base = path.basename(fileAbs);
  // 1) Try filename
  let m = base.match(RX_NAME);
  if (m) {
    return { pos: normPos(m[1]), bucket: normBucket(m[2]) };
  }
  // 2) Try parent folders + filename hints
  const parts = rel.split(path.sep).map(s => s.toUpperCase());
  const posGuess = parts.find(p => POS_ALIASES.has(p));
  const stackGuess = parts.find(p => /^\d{2,3}(?:BB)?$/.test(p)) || base.toUpperCase();
  const stackNum = (stackGuess.match(/(\d{2,3})/) || [])[1];
  return { pos: posGuess ? normPos(posGuess) : null, bucket: stackNum ? normBucket(stackNum) : null };
}

function main() {
  if (!fs.existsSync(MAIN_ROOT)) {
    console.error(`Not found: ${MAIN_ROOT}`);
    process.exit(1);
  }

  const files = walk(MAIN_ROOT);
  let moved = 0, skipped = 0, conflicted = 0;

  for (const src of files) {
    // Skip files already in the normalized place
    if (src.includes(path.join("7max","open"+path.sep))) continue;

    const { pos, bucket } = inferFromPath(src);

    if (!pos || !bucket) {
      console.warn(`Skip (no pos/stack): ${path.relative(MAIN_ROOT, src)}`);
      skipped++; continue;
    }

    const destDir = path.join(DEST_ROOT, pos);
    const dest = path.join(destDir, `${bucket}.png`);
    ensureDir(destDir);

    if (fs.existsSync(dest)) {
      // If a file already exists, keep the existing one and skip (or rename with suffix if you prefer)
      console.warn(`Conflict (exists): ${path.relative(ROOT, dest)}  <- keep existing, skip ${path.basename(src)}`);
      skipped++; conflicted++; continue;
    }

    fs.renameSync(src, dest);
    console.log(`→ ${path.relative(ROOT, dest)}`);
    moved++;
  }

  console.log(`\nDone. Moved: ${moved}  Skipped: ${skipped}  Conflicts: ${conflicted}`);
}

main();
