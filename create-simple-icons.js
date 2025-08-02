// Simple script to create basic PNG icons using Canvas API
// Run this in a browser console or as a Node.js script with canvas library

const fs = require('fs').promises;
const { createCanvas } = require('canvas');

const sizes = [72, 96, 128, 144, 152, 192, 384, 512];

const createIcon = (size) => {
  const canvas = createCanvas(size, size);
  const ctx = canvas.getContext('2d');
  
  // Clear canvas
  ctx.clearRect(0, 0, size, size);
  
  // Background circle
  ctx.fillStyle = '#4a9eff';
  ctx.beginPath();
  ctx.arc(size/2, size/2, size/2 - size*0.1, 0, 2 * Math.PI);
  ctx.fill();
  
  // White checklist lines
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = size * 0.02;
  
  const startY = size * 0.3;
  const lineHeight = size * 0.12;
  const leftMargin = size * 0.25;
  const rightMargin = size * 0.75;
  
  // Draw checklist lines
  for (let i = 0; i < 3; i++) {
    const y = startY + (i * lineHeight);
    ctx.beginPath();
    ctx.moveTo(leftMargin, y);
    ctx.lineTo(rightMargin, y);
    ctx.stroke();
  }
  
  // Draw checkmarks
  ctx.strokeStyle = '#22c55e';
  ctx.lineWidth = size * 0.025;
  ctx.lineCap = 'round';
  
  // First checkmark
  ctx.beginPath();
  ctx.moveTo(size * 0.18, startY - size * 0.01);
  ctx.lineTo(size * 0.21, startY + size * 0.02);
  ctx.lineTo(size * 0.26, startY - size * 0.03);
  ctx.stroke();
  
  // Second checkmark
  ctx.beginPath();
  ctx.moveTo(size * 0.18, startY + lineHeight - size * 0.01);
  ctx.lineTo(size * 0.21, startY + lineHeight + size * 0.02);
  ctx.lineTo(size * 0.26, startY + lineHeight - size * 0.03);
  ctx.stroke();
  
  return canvas.toBuffer('image/png');
};

const generateIcons = async () => {
  try {
    await fs.mkdir('./icons', { recursive: true });
    
    for (const size of sizes) {
      const buffer = createIcon(size);
      await fs.writeFile(`./icons/icon-${size}x${size}.png`, buffer);
      console.log(`Created icon-${size}x${size}.png`);
    }
    
    console.log('All icons created successfully!');
  } catch (error) {
    console.error('Error creating icons:', error);
  }
};

if (typeof module !== 'undefined' && module.exports) {
  generateIcons();
} else {
  console.log('Run this script with Node.js and canvas library installed');
}