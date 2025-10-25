import fs from "fs";
import path from "path";

const ROOT = process.cwd();
const ALL_DIR = path.join(ROOT, "public", "ranges", "Main", "all");
const THREEBET_DIR = path.join(ROOT, "public", "ranges", "Main", "3bet");

// 3bet row numbers
const THREEBET_ROWS = [11, 22, 23, 32, 33, 34, 41, 42, 43, 44, 50, 51, 52, 53, 54, 61, 62, 63, 64, 65, 66, 73, 74, 75, 76, 77, 78, 79, 80, 81];

// Row number to position mapping (same as before)
const ROW_MAPPING = {
  // UTG ranges: rows 1-9 (but we only want 11 for 3bet)
  11: "UTG",
  
  // UTG1 ranges: rows 10-18 (but we only want 11 for 3bet)
  // 11: "UTG1", // Already handled above
  
  // LJ ranges: rows 22-29 (but we only want 22-23 for 3bet)
  22: "LJ", 23: "LJ",
  
  // HJ ranges: rows 32-39 (but we only want 32-34 for 3bet)
  32: "HJ", 33: "HJ", 34: "HJ",
  
  // CO ranges: rows 41-48 (but we only want 41-44 for 3bet)
  41: "CO", 42: "CO", 43: "CO", 44: "CO",
  
  // BTN ranges: rows 50-59 (but we only want 50-54 for 3bet)
  50: "BTN", 51: "BTN", 52: "BTN", 53: "BTN", 54: "BTN",
  
  // SB ranges: rows 61-70 (but we only want 61-66 for 3bet)
  61: "SB", 62: "SB", 63: "SB", 64: "SB", 65: "SB", 66: "SB",
  
  // BB ranges: rows 72-84 (but we only want 73-81 for 3bet)
  73: "BB", 74: "BB", 75: "BB", 76: "BB", 77: "BB", 78: "BB", 79: "BB", 80: "BB", 81: "BB"
};

function extractRowNumber(filename) {
  // Try to extract row number from filename
  const patterns = [
    /Main_[A-Z](\d+)_/i
  ];
  
  for (const pattern of patterns) {
    const match = filename.match(pattern);
    if (match) {
      return parseInt(match[1]);
    }
  }
  
  return null;
}

console.log("Moving 3bet images to organized folders...");

let moved = 0;
let skipped = 0;

// Get all position folders in the all directory
const positionFolders = fs.readdirSync(ALL_DIR, { withFileTypes: true })
  .filter(dirent => dirent.isDirectory())
  .map(dirent => dirent.name);

for (const positionFolder of positionFolders) {
  const sourceDir = path.join(ALL_DIR, positionFolder);
  const files = fs.readdirSync(sourceDir);
  
  for (const file of files) {
    if (file.toLowerCase().endsWith('.png')) {
      const rowNumber = extractRowNumber(file);
      
      if (rowNumber && THREEBET_ROWS.includes(rowNumber) && ROW_MAPPING[rowNumber]) {
        const targetPosition = ROW_MAPPING[rowNumber];
        const targetDir = path.join(THREEBET_DIR, targetPosition);
        const targetPath = path.join(targetDir, file);
        const sourcePath = path.join(sourceDir, file);
        
        try {
          if (fs.existsSync(targetPath)) {
            console.log(`Conflict: ${file} already exists in 3bet/${targetPosition}/`);
            skipped++;
          } else {
            fs.copyFileSync(sourcePath, targetPath);
            console.log(`Moved: ${file} -> 3bet/${targetPosition}/`);
            moved++;
          }
        } catch (error) {
          console.error(`Error moving ${file}:`, error.message);
        }
      }
    }
  }
}

console.log(`\nDone. Moved: ${moved}  Skipped: ${skipped}`);

