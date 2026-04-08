const fs = require('node:fs');
const path = require('node:path');

const DATA_DIR = path.join(__dirname, '..', 'data');
const WISHLIST_PATH = path.join(DATA_DIR, 'wishlist.json');
const WISHLIST_ITEMS_PATH = path.join(DATA_DIR, 'wishlist_items.json');
const WISHLIST_VOTES_PATH = path.join(DATA_DIR, 'wishlist_votes.json');

function readJson(filePath, fallbackValue) {
  if (!fs.existsSync(filePath)) return fallbackValue;
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function writeJson(filePath, value) {
  fs.writeFileSync(filePath, JSON.stringify(value, null, 2));
}

function migrateLegacyWishlist() {
  const legacy = readJson(WISHLIST_PATH, null);
  if (!legacy || !Array.isArray(legacy.items)) {
    console.log('No legacy wishlist data found, skipping wishlist migration.');
    return;
  }

  const currentItems = readJson(WISHLIST_ITEMS_PATH, []);
  const currentVotes = readJson(WISHLIST_VOTES_PATH, []);
  if (Array.isArray(currentItems) && currentItems.length > 0) {
    console.log(`Skipping wishlist item migration because ${path.basename(WISHLIST_ITEMS_PATH)} already has data.`);
    return;
  }
  if (Array.isArray(currentVotes) && currentVotes.length > 0) {
    console.log(`Skipping wishlist vote migration because ${path.basename(WISHLIST_VOTES_PATH)} already has data.`);
    return;
  }

  const items = [];
  const votes = [];

  for (const item of legacy.items) {
    items.push({
      id: item.id,
      name: item.name,
      addedBy: item.addedBy,
      addedAt: item.addedAt,
    });
    for (const userId of item.votes || []) {
      votes.push({
        itemId: item.id,
        userId,
        value: 1,
      });
    }
  }

  writeJson(WISHLIST_ITEMS_PATH, items);
  writeJson(WISHLIST_VOTES_PATH, votes);
  console.log(`Migrated ${items.length} wishlist items to ${path.basename(WISHLIST_ITEMS_PATH)}.`);
  console.log(`Migrated ${votes.length} wishlist votes to ${path.basename(WISHLIST_VOTES_PATH)}.`);
}

function validateJsonDataFiles() {
  const files = [
    'products.json',
    'users.json',
    'consumptions.json',
    'reservations.json',
    'wishlist_items.json',
    'wishlist_votes.json',
  ];

  for (const file of files) {
    const filePath = path.join(DATA_DIR, file);
    const parsed = readJson(filePath, []);
    if (!Array.isArray(parsed)) {
      throw new TypeError(`${file} must contain a JSON array.`);
    }
    console.log(`${file}: ${parsed.length} records`);
  }
}

function run() {
  console.log('Running JSON migration/validation...');
  migrateLegacyWishlist();
  validateJsonDataFiles();
  console.log('Done.');
}

run();
