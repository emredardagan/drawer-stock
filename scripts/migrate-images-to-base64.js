/**
 * One-time script: convert product imageUrl from http(s) URL to base64 data URL.
 * Run: node scripts/migrate-images-to-base64.js
 */
const path = require('path');
const fs = require('fs');

const DATA_PATH = path.join(__dirname, '..', 'data', 'products.json');

async function imageUrlToBase64(url) {
  if (!url || typeof url !== 'string') return url;
  const trimmed = url.trim();
  if (!trimmed.startsWith('http://') && !trimmed.startsWith('https://')) return url;
  try {
    const res = await fetch(trimmed, { redirect: 'follow' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const contentType = res.headers.get('content-type') || 'image/jpeg';
    const buffer = Buffer.from(await res.arrayBuffer());
    const base64 = buffer.toString('base64');
    return `data:${contentType.split(';')[0]};base64,${base64}`;
  } catch (err) {
    console.warn('Image URL to base64 failed:', err.message);
    return url;
  }
}

async function main() {
  const raw = fs.readFileSync(DATA_PATH, 'utf8');
  const products = JSON.parse(raw);
  let changed = 0;
  for (const p of products) {
    const url = p.imageUrl;
    if (url && (url.startsWith('http://') || url.startsWith('https://'))) {
      console.log('Converting:', p.name, url.slice(0, 50) + '...');
      p.imageUrl = await imageUrlToBase64(url);
      changed++;
    }
  }
  if (changed > 0) {
    fs.writeFileSync(DATA_PATH, JSON.stringify(products, null, 2), 'utf8');
    console.log('Updated', changed, 'product(s).');
  } else {
    console.log('No URL images to convert.');
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
