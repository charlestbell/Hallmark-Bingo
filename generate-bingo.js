const fs = require("fs");
const PDFDocument = require("pdfkit");
const path = require("path");

// Create output directory if it doesn't exist
const outputDir = "output";
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir);
}

// Read and parse source.txt
const sourceContent = fs.readFileSync("source.txt", "utf-8");
const lines = sourceContent.split("\n").filter((line) => line.trim());

// Parse items - remove numbers and dots, clean up
const items = lines.map((line) => {
  // Remove leading numbers and dots/periods
  const match = line.match(/^\d+\.\s*(.+)$/);
  if (match) {
    return match[1].trim();
  }
  // Fallback: remove any leading number and period if regex didn't match
  return line.replace(/^\d+\.\s*/, "").trim();
});

// Validate we have enough items
const SQUARES_NEEDED = 25; // 5x5 grid = 25 squares
const OTHER_SQUARES_NEEDED = 24; // 25 total - 1 center = 24

if (items.length < SQUARES_NEEDED) {
  console.error(
    `Error: Need at least ${SQUARES_NEEDED} items, but only found ${items.length} items in source.txt`
  );
  process.exit(1);
}

// Item #1 (index 0) is the center square
const centerItem = items[0];
// Items #2 onwards (indices 1+) are for the other squares
const otherItems = items.slice(1);

// Function to shuffle array
function shuffleArray(array) {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

// Function to generate a unique bingo card
function generateBingoCard(cardNumber) {
  // Select 24 random items from the available items (items #2 onwards)
  const shuffled = shuffleArray(otherItems);
  const selectedItems = shuffled.slice(0, OTHER_SQUARES_NEEDED);

  // Create 5x5 grid
  const grid = [];
  let itemIndex = 0;

  for (let row = 0; row < 5; row++) {
    grid[row] = [];
    for (let col = 0; col < 5; col++) {
      if (row === 2 && col === 2) {
        // Center square gets item #1
        grid[row][col] = centerItem;
      } else {
        grid[row][col] = selectedItems[itemIndex++];
      }
    }
  }

  return grid;
}

// Function to draw a bingo card on the provided PDF document
function drawBingoCardPage(doc, grid) {
  // Add background image (if it exists) - placed first so it appears behind all content
  const backgroundPath = path.join(__dirname, "Background.png");
  if (fs.existsSync(backgroundPath)) {
    const pageWidth = doc.page.width;
    const pageHeight = doc.page.height;
    // Draw background image to cover the entire page
    doc.image(backgroundPath, 0, 0, {
      width: pageWidth,
      height: pageHeight,
    });
  }

  // Title - commented out since it's in the background image
  // doc
  //   .fontSize(36)
  //   .font("Helvetica-Bold")
  //   .text("Hallmark Trope", { align: "center" });

  // doc.fontSize(48).font("Helvetica-Bold").text("Bingo", { align: "center" });

  // Calculate grid dimensions with thin borders on all sides
  const borderSize = 20;
  const pageWidth = doc.page.width;
  const pageHeight = doc.page.height;

  // Available space after borders
  const availableWidth = pageWidth - 2 * borderSize;
  const availableHeight = pageHeight - 2 * borderSize;

  // Use the smaller dimension to ensure square grid fits
  const gridSize = Math.min(availableWidth, availableHeight);
  const cellSize = gridSize / 5;

  // Vertical offset to adjust grid position (72 points = 1 inch)
  const verticalOffset = 88;

  // Center the grid with 1/4" minimum borders (centered if larger borders needed)
  const startX = (pageWidth - gridSize) / 2;
  const startY = (pageHeight - gridSize) / 2 + verticalOffset;

  // Draw grid
  for (let row = 0; row < 5; row++) {
    for (let col = 0; col < 5; col++) {
      const x = startX + col * cellSize;
      const y = startY + row * cellSize;

      // Draw cell border
      doc.rect(x, y, cellSize, cellSize).stroke();

      // Center square gets special treatment (can add background color if desired)
      if (row === 2 && col === 2) {
        doc
          .rect(x, y, cellSize, cellSize)
          .fillOpacity(0.1)
          .fill("gray")
          .fillOpacity(1);
      }

      // Add text - bold, centered horizontally and vertically
      const text = grid[row][col];
      const padding = 5;
      const textWidth = cellSize - padding * 2;
      const textHeight = cellSize - padding * 2;

      // Calculate text height to properly center vertically
      const fontSize = 11;
      doc.font("Helvetica-Bold").fontSize(fontSize);

      // Get the height of wrapped text
      const lines = doc.heightOfString(text, { width: textWidth });

      // Calculate center position
      const centerX = x + cellSize / 2;
      const centerY = y + cellSize / 2;
      const textStartY = centerY - lines / 2;

      // Draw centered text
      doc
        .fillColor("black")
        .font("Helvetica-Bold")
        .text(text, x + padding, textStartY, {
          width: textWidth,
          align: "center",
        });
    }
  }

  return doc;
}

// Generate 20 unique bingo cards into a single multipage PDF
console.log("Generating 20 unique bingo cards...");

const combinedFilename = path.join(outputDir, "bingo-cards.pdf");
const combinedStream = fs.createWriteStream(combinedFilename);
const doc = new PDFDocument({
  size: "LETTER",
  margins: { top: 10, bottom: 10, left: 10, right: 10 },
});
doc.pipe(combinedStream);

// Store used combinations to ensure uniqueness
const usedCards = new Set();

for (let i = 1; i <= 20; i++) {
  let card;
  let cardKey;
  let attempts = 0;

  // Ensure each card is unique by checking its signature
  do {
    card = generateBingoCard(i);
    // Create a unique key from the sorted items (excluding center)
    const items = [];
    for (let row = 0; row < 5; row++) {
      for (let col = 0; col < 5; col++) {
        if (!(row === 2 && col === 2)) {
          items.push(card[row][col]);
        }
      }
    }
    cardKey = items.sort().join("|");
    attempts++;

    if (attempts > 1000) {
      console.warn(`Warning: Card ${i} uniqueness check took many attempts`);
      break;
    }
  } while (usedCards.has(cardKey));

  usedCards.add(cardKey);

  if (i > 1) {
    doc.addPage();
  }
  drawBingoCardPage(doc, card);
  console.log(`Added card ${i.toString().padStart(2, "0")} to combined PDF`);
}

doc.end();

console.log(`All 20 bingo cards generated in ${combinedFilename}`);
