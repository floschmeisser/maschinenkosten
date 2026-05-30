const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const svgPath = path.join(__dirname, '..', 'public', 'assets', 'logo.svg');
const svg = fs.readFileSync(svgPath);

console.log('SVG loaded, size:', svg.length);

async function run() {
  await sharp(svg).resize(192, 192).png().toFile(path.join(__dirname, '..', 'public', 'assets', 'icon-192.png'));
  console.log('icon-192.png done');
  await sharp(svg).resize(512, 512).png().toFile(path.join(__dirname, '..', 'public', 'assets', 'icon-512.png'));
  console.log('icon-512.png done');
}

run().catch((err) => {
  console.error('Error:', err.message);
  process.exit(1);
});
