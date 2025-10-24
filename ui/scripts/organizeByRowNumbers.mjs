import fs from "fs";
import path from "path";

const ROOT = process.cwd();
const MAIN_DIR = path.join(ROOT, "..", "Main");
const ALL_DIR = path.join(ROOT, "public", "ranges", "Main", "all");

// Row number to position mapping
const ROW_MAPPING = {
  // UTG ranges: rows 1-9
  1: "UTG", 2: "UTG", 3: "UTG", 4: "UTG", 5: "UTG", 6: "UTG", 7: "UTG", 8: "UTG", 9: "UTG",
  
  // UTG1 ranges: rows 10-18
  10: "UTG1", 11: "UTG1", 12: "UTG1", 13: "UTG1", 14: "UTG1", 15: "UTG1", 16: "UTG1", 17: "UTG1", 18: "UTG1",
  
  // LJ ranges: rows 22-29
  22: "LJ", 23: "LJ", 24: "LJ", 25: "LJ", 26: "LJ", 27: "LJ", 28: "LJ", 29: "LJ",
  
  // HJ ranges: rows 32-39
  32: "HJ", 33: "HJ", 34: "HJ", 35: "HJ", 36: "HJ", 37: "HJ", 38: "HJ", 39: "HJ",
  
  // CO ranges: rows 41-48
  41: "CO", 42: "CO", 43: "CO", 44: "CO", 45: "CO", 46: "CO", 47: "CO", 48: "CO",
  
  // BTN ranges: rows 50-59
  50: "BTN", 51: "BTN", 52: "BTN", 53: "BTN", 54: "BTN", 55: "BTN", 56: "BTN", 57: "BTN", 58: "BTN", 59: "BTN",
  
  // SB ranges: rows 61-70
  61: "SB", 62: "SB", 63: "SB", 64: "SB", 65: "SB", 66: "SB", 67: "SB", 68: "SB", 69: "SB", 70: "SB",
  
  // BB strategy: rows 72-84
  72: "BB", 73: "BB", 74: "BB", 75: "BB", 76: "BB", 77: "BB", 78: "BB", 79: "BB", 80: "BB", 81: "BB", 82: "BB", 83: "BB", 84: "BB"
};

function extractRowNumber(filename) {
  // Try to extract row number from filename
  // Look for patterns like "row1", "1.png", "image1", Excel cell references, etc.
  const patterns = [
    /row(\d+)/i,
    /^(\d+)\./,
    /image(\d+)/i,
    /(\d+)_/,
    /_(\d+)\./,
    /(\d+)\.png$/i,
    /(\d+)\.jpg$/i,
    /(\d+)\.jpeg$/i,
    // Excel cell reference patterns like Main_A27_vml_6.png
    /Main_[A-Z](\d+)_/i,
    // Direct row number patterns
    /_(\d+)\.png$/i
  ];
  
  for (const pattern of patterns) {
    const match = filename.match(pattern);
    if (match) {
      return parseInt(match[1]);
    }
  }
  
  return null;
}

function createDirectoryStructure() {
  // Create the all directory
  if (!fs.existsSync(ALL_DIR)) {
    fs.mkdirSync(ALL_DIR, { recursive: true });
    console.log("Created directory:", ALL_DIR);
  }
  
  // Create position subdirectories
  const positions = [...new Set(Object.values(ROW_MAPPING))];
  for (const position of positions) {
    const posDir = path.join(ALL_DIR, position);
    if (!fs.existsSync(posDir)) {
      fs.mkdirSync(posDir, { recursive: true });
      console.log("Created directory:", posDir);
    }
  }
}

function organizeImages() {
  console.log("Organizing images by row numbers...");
  
  // Create directory structure
  createDirectoryStructure();
  
  let moved = 0;
  let skipped = 0;
  let conflicts = 0;
  
  // Look for images in the Main directory and its subdirectories
  function processDirectory(dir) {
    if (!fs.existsSync(dir)) {
      console.log(`Directory not found: ${dir}`);
      return;
    }
    
    const items = fs.readdirSync(dir);
    
    for (const item of items) {
      const itemPath = path.join(dir, item);
      const stat = fs.statSync(itemPath);
      
      if (stat.isDirectory()) {
        // Skip the 'all' directory to avoid recursion
        if (item !== 'all') {
          processDirectory(itemPath);
        }
      } else if (item.toLowerCase().match(/\.(png|jpg|jpeg)$/)) {
        console.log(`Found image: ${item}`);
        const rowNumber = extractRowNumber(item);
        console.log(`  Extracted row number: ${rowNumber}`);
        
        if (rowNumber && ROW_MAPPING[rowNumber]) {
          const position = ROW_MAPPING[rowNumber];
          const targetDir = path.join(ALL_DIR, position);
          const targetPath = path.join(targetDir, item);
          
          try {
            if (fs.existsSync(targetPath)) {
              console.log(`Conflict: ${item} already exists in ${position}/`);
              conflicts++;
            } else {
              fs.copyFileSync(itemPath, targetPath);
              console.log(`Moved: ${item} -> all/${position}/`);
              moved++;
            }
          } catch (error) {
            console.error(`Error moving ${item}:`, error.message);
          }
        } else {
          console.log(`Skipped: ${item} (row number ${rowNumber} not in mapping)`);
          skipped++;
        }
      }
    }
  }
  
  // Process the Main directory
  processDirectory(MAIN_DIR);
  
  console.log(`\nDone. Moved: ${moved}  Skipped: ${skipped}  Conflicts: ${conflicts}`);
}

// Run the organization
organizeImages();
