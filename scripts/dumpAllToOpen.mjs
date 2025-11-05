// scripts/dumpAllToOpen.mjs
//
// Purpose: Copy every range image already under public/ranges/Main/** into
//          public/ranges/Main/7max/open/<POS>/, where <POS> is parsed from
//          the filename (e.g., "80bb_utg_vs_utg_Main_X4.png" -> UTG).
//
// Usage (from project root or /ui):
//   node scripts/dumpAllToOpen.mjs --dry         # preview actions
//   node scripts/dumpAllToOpen.mjs               # perform copy
//   node scripts/dumpAllToOpen.mjs --overwrite   # overwrite existing files
//
// Notes:
// - The script SKIPS the destination subtree so it won't re-process files it already copied.
// - Supported positions: utg, lj, mp, hj, co, btn, sb, bb (case-insensitive).
// - Supported image extensions: .png .jpg .jpeg .webp

import fs from "fs";
import fsp from "fs/promises";
import path from "path";
import url from "url";

const __filename = url.fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Root is the project folder that contains /public
// If you run from /ui, ROOT will be that; if from repo root, this still works.
const ROOT = process.cwd();

// Source: everything under public/ranges/Main
const SRC = path.join(ROOT, "public", "ranges", "Main");

// Destination root we want to skip while walking
const DEST_ROOT = path.join(ROOT, "public", "ranges", "Main", "7max");

// Final destination for "open" charts
const OPEN_DEST = path.join(DEST_ROOT, "open");

const DRY = process.argv.includes("--dry");
const OVERWRITE = process.argv.includes("--overwrite");

// Recognize image files
const IMG_EXTS = new Set([".png", ".jpg", ".jpeg", ".webp"]);

// Position parsing: we treat the **first** position token before "_vs_"
// e.g. "80bb_utg_vs_utg_Main_X4.png" => UTG
// Covers: utg, lj, mp, hj, co, btn, sb, bb
const POS_RE = /(?:^|_)(utg|lj|mp|hj|co|btn|sb|bb)(?=_vs_)/i;

// Map normalized token -> canonical folder name
const POS_CANON = {
  utg: "UTG",
  lj:  "LJ",
  mp:  "LJ", // if your images use "mp" instead of "lj", store under LJ
  hj:  "HJ",
  co:  "CO",
  btn: "BTN",
  sb:  "SB",
  bb:  "BB",
};

function rel(p) {
  return path.relative(ROOT, p);
}

async function exists(p) {
  try {
    await fsp.access(p, fs.constants.F_OK);
    return true;
  } catch {
    return false;
  }
}

// Walk all files under a directory, but **skip** DEST_ROOT subtree entirely
async function* walk(dir) {
  // Normalize with trailing separator to avoid partial-prefix issues
  const destNorm = ensureSep(DEST_ROOT);
  const dirNorm = ensureSep(dir);
  if (dirNorm.startsWith(destNorm)) return;

  const entries = await fsp.readdir(dir, { withFileTypes: true });
  for (const e of entries) {
    const full = path.join(dir, e.name);
    const fullNorm = ensureSep(full);

    // Skip destination subtree on each step
    if (fullNorm.startsWith(destNorm)) continue;

    if (e.isDirectory()) {
      yield* walk(full);
    } else if (e.isFile()) {
      yield full;
    }
  }
}

function ensureSep(p) {
  let s = path.resolve(p);
  if (!s.endsWith(path.sep)) s += path.sep;
  return s;
}

function getPosFromFilename(filename) {
  const base = path.basename(filename);
  const m = base.match(POS_RE);
  if (!m) return null;
  const raw = m[1].toLowerCase();
  return POS_CANON[raw] || null;
}

async function ensureDir(dir) {
  if (!(await exists(dir))) {
    if (DRY) {
      console.log(`[DRY mkdir] ${rel(dir)}`);
    } else {
      await fsp.mkdir(dir, { recursive: true });
    }
  }
}

async function copyFile(src, dest) {
  await ensureDir(path.dirname(dest));
  if (await exists(dest)) {
    if (OVERWRITE) {
      if (DRY) {
        console.log(`[DRY overwrite] ${rel(src)} -> ${rel(dest)}`);
      } else {
        await fsp.copyFile(src, dest);
      }
      return "overwrote";
    }
    console.log(`Conflict (exists): ${rel(dest)}`);
    return "conflict";
  } else {
    if (DRY) {
      console.log(`[DRY] ${rel(src)} -> ${rel(dest)}`);
    } else {
      await fsp.copyFile(src, dest);
    }
    return "moved";
  }
}

(async function main() {
  // Basic sanity check
  if (!(await exists(SRC))) {
    console.error(`Source not found: ${rel(SRC)}`);
    process.exit(1);
  }

  let moved = 0;
  let skipped = 0;
  let conflicts = 0;
  let overwrote = 0;

  for await (const file of walk(SRC)) {
    const ext = path.extname(file).toLowerCase();
    if (!IMG_EXTS.has(ext)) {
      skipped++;
      continue;
    }

    const pos = getPosFromFilename(file);
    if (!pos) {
      // No recognizable position token; skip silently (or uncomment to log)
      // console.log(`Skip (no position): ${path.basename(file)}`);
      skipped++;
      continue;
    }

    const destDir = path.join(OPEN_DEST, pos);
    const dest = path.join(destDir, path.basename(file));

    const res = await copyFile(file, dest);
    if (res === "moved") moved++;
    else if (res === "conflict") conflicts++;
    else if (res === "overwrote") overwrote++;
  }

  console.log(`\nDone. Moved: ${moved}${OVERWRITE ? `  Overwrote: ${overwrote}` : ""}  Skipped: ${skipped}  Conflicts: ${conflicts}`);
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
