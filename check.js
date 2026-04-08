const fs = require('node:fs/promises');
const path = require('node:path');

async function readJson(relativePath) {
  const fullPath = path.join(__dirname, relativePath);
  const raw = await fs.readFile(fullPath, 'utf8');
  return JSON.parse(raw);
}

async function check() {
  const consumptions = await readJson('data/consumptions.json');
  const wishlistItems = await readJson('data/wishlist_items.json');
  const wishlistVotes = await readJson('data/wishlist_votes.json');

  console.log('Consumptions sample:', consumptions.slice(0, 2));
  console.log('Wishlist items sample:', wishlistItems.slice(0, 2));
  console.log('Wishlist votes sample:', wishlistVotes.slice(0, 2));
}

check().catch((error) => {
  console.error('JSON check failed:', error);
  process.exit(1);
});
