// Resize public/icons/icon-source.png into the PNG sizes the PWA needs.
// Run after replacing the source: `node scripts/gen-icons.mjs`
import sharp from 'sharp';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const dir = join(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'icons');
const src = readFileSync(join(dir, 'icon-source.png'));

const targets = [
  { file: 'icon-192.png', size: 192 },
  { file: 'icon-512.png', size: 512 },
  { file: 'maskable-512.png', size: 512 },
  { file: 'apple-touch-icon.png', size: 180 },
];

for (const { file, size } of targets) {
  await sharp(src).resize(size, size).png().toFile(join(dir, file));
  console.log(`wrote ${file} (${size}x${size})`);
}
