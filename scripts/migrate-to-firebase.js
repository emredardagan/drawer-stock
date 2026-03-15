const fs = require('fs');
const path = require('path');
const admin = require('firebase-admin');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const DATA_DIR = path.join(__dirname, '..', 'data');
const serviceAccountPath = path.join(__dirname, '..', 'firebase-service-account.json');

console.log('--- Firebase Data Migration ---');

let serviceAccount = null;
if (process.env.FIREBASE_SERVICE_ACCOUNT) {
  try { serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT); } catch (e) {}
} else if (fs.existsSync(serviceAccountPath)) {
  serviceAccount = require(serviceAccountPath);
}

if (!serviceAccount) {
  console.error('Error: No Firebase credentials found.');
  console.error('Provide FIREBASE_SERVICE_ACCOUNT env var or firebase-service-account.json at root.');
  process.exit(1);
}

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: process.env.FIREBASE_DATABASE_URL || 'https://drawer-stock-default-rtdb.europe-west1.firebasedatabase.app'
});

const db = admin.database();

function readLocal(file, defaultReturn = []) {
  const p = path.join(DATA_DIR, file);
  if (!fs.existsSync(p)) return defaultReturn;
  try {
    return JSON.parse(fs.readFileSync(p, 'utf8'));
  } catch (err) {
    return defaultReturn;
  }
}

async function migrate() {
  try {
    const products = readLocal('products.json', []);
    const users = readLocal('users.json', []);
    const reservations = readLocal('reservations.json', []);
    const consumptions = readLocal('consumptions.json', []);
    const wishlistData = readLocal('wishlist.json', { items: [] });
    const wishlist = Array.isArray(wishlistData.items) ? wishlistData.items : [];

    console.log(`Migrating ${products.length} products...`);
    await db.ref('products').set(products);

    console.log(`Migrating ${users.length} users...`);
    await db.ref('users').set(users);

    console.log(`Migrating ${reservations.length} reservations...`);
    await db.ref('reservations').set(reservations);

    console.log(`Migrating ${consumptions.length} consumptions...`);
    await db.ref('consumptions').set(consumptions);

    console.log(`Migrating ${wishlist.length} wishlist items...`);
    await db.ref('wishlist').set(wishlist);

    console.log('✅ Migration completed successfully!');
    process.exit(0);
  } catch (err) {
    console.error('❌ Migration failed:', err);
    process.exit(1);
  }
}

migrate();
