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

// Function to create PDF for a bingo card
function createBingoCardPDF(cardNumber, grid) {
  const doc = new PDFDocument({
    size: "LETTER",
    margins: { top: 50, bottom: 50, left: 50, right: 50 },
  });

  const filename = path.join(
    outputDir,
    `bingo-card-${cardNumber.toString().padStart(2, "0")}.pdf`
  );
  doc.pipe(fs.createWriteStream(filename));

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

  doc.moveDown(14);

  // Calculate grid dimensions
  const pageWidth =
    doc.page.width - doc.page.margins.left - doc.page.margins.right;
  const gridSize = Math.min(pageWidth * 0.9, 450);
  const cellSize = gridSize / 5;
  const startX = (doc.page.width - gridSize) / 2;
  let startY = doc.y;

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
      const fontSize = 9;
      doc.fontSize(fontSize).font("Helvetica-Bold");

      // Get the height of wrapped text
      const lines = doc.heightOfString(text, { width: textWidth });

      // Calculate center position
      const centerX = x + cellSize / 2;
      const centerY = y + cellSize / 2;
      const textStartY = centerY - lines / 2;

      // Draw centered text
      doc.fillColor("black").text(text, x + padding, textStartY, {
        width: textWidth,
        align: "center",
      });
    }
  }

  doc.end();

  return filename;
}

// Generate 15 unique bingo cards
console.log("Generating 15 unique bingo cards...");

// Store used combinations to ensure uniqueness
const usedCards = new Set();

for (let i = 1; i <= 15; i++) {
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

  const filename = createBingoCardPDF(i, card);
  console.log(`Created ${filename}`);
}

console.log("All 15 bingo cards generated successfully!");
