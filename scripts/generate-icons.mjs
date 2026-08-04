import fs from 'fs';
import path from 'path';
import sharp from 'sharp';
import toIco from 'to-ico';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const svgPath = path.join(root, 'website/public/favicon.svg');
const svg = fs.readFileSync(svgPath);

const sizes = [16, 24, 32, 48, 64, 128, 256, 512];
const pngBuffers = {};

for (const size of sizes) {
  const buf = await sharp(svg)
    .resize(size, size, { fit: 'contain', background: { r: 7, g: 7, b: 8, alpha: 1 } })
    .png()
    .toBuffer();
  pngBuffers[size] = buf;
}

fs.mkdirSync(path.join(root, 'build'), { recursive: true });
fs.mkdirSync(path.join(root, 'public'), { recursive: true });

// Window / taskbar PNGs
fs.writeFileSync(path.join(root, 'public/icon.png'), pngBuffers[256]);
fs.writeFileSync(path.join(root, 'public/icon-512.png'), pngBuffers[512]);
fs.writeFileSync(path.join(root, 'build/icon.png'), pngBuffers[256]);
fs.writeFileSync(path.join(root, 'build/icon-512.png'), pngBuffers[512]);

// Favicon for the renderer
fs.copyFileSync(svgPath, path.join(root, 'public/icon.svg'));
fs.copyFileSync(svgPath, path.join(root, 'public/favicon.svg'));

const ico = await toIco([pngBuffers[16], pngBuffers[24], pngBuffers[32], pngBuffers[48], pngBuffers[64], pngBuffers[128], pngBuffers[256]]);
fs.writeFileSync(path.join(root, 'build/icon.ico'), ico);
fs.writeFileSync(path.join(root, 'public/icon.ico'), ico);

console.log('Icons written to build/ and public/');
