const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Supabase URL or Key is missing in .env file');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

const DATA_DIR = path.join(__dirname, '..', 'data');

async function migrate() {
  console.log('Starting migration...');

  // 1. Migrate Products
  try {
    const products = JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'products.json'), 'utf8'));
    if (products.length > 0) {
      const { error } = await supabase.from('products').upsert(products);
      if (error) throw error;
      console.log(`Migrated ${products.length} products.`);
    }
  } catch (err) {
    console.error('Error migrating products:', err.message);
  }

  // 2. Migrate Users
  try {
    const users = JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'users.json'), 'utf8'));
    if (users.length > 0) {
      const { error } = await supabase.from('users').upsert(users);
      if (error) throw error;
      console.log(`Migrated ${users.length} users.`);
    }
  } catch (err) {
    console.error('Error migrating users:', err.message);
  }

  // 3. Migrate Consumptions
  try {
    const consumptions = JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'consumptions.json'), 'utf8'));
    if (consumptions.length > 0) {
      const { error } = await supabase.from('consumptions').upsert(consumptions);
      if (error) throw error;
      console.log(`Migrated ${consumptions.length} consumptions.`);
    }
  } catch (err) {
    console.error('Error migrating consumptions:', err.message);
  }

  // 4. Migrate Reservations
  try {
    if (fs.existsSync(path.join(DATA_DIR, 'reservations.json'))) {
      const reservations = JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'reservations.json'), 'utf8'));
      if (reservations.length > 0) {
        const { error } = await supabase.from('reservations').upsert(reservations);
        if (error) throw error;
        console.log(`Migrated ${reservations.length} reservations.`);
      }
    }
  } catch (err) {
    console.error('Error migrating reservations:', err.message);
  }

  // 5. Migrate Wishlist
  try {
    if (fs.existsSync(path.join(DATA_DIR, 'wishlist.json'))) {
      const wishlistData = JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'wishlist.json'), 'utf8'));
      const items = wishlistData.items || [];
      
      const dbItems = [];
      const dbVotes = [];

      for (const item of items) {
        dbItems.push({
          id: item.id,
          name: item.name,
          addedBy: item.addedBy,
          addedAt: item.addedAt
        });

        if (item.votes && item.votes.length > 0) {
          for (const userId of item.votes) {
            dbVotes.push({
              itemId: item.id,
              userId: userId
            });
          }
        }
      }

      if (dbItems.length > 0) {
        const { error: itemsError } = await supabase.from('wishlist_items').upsert(dbItems);
        if (itemsError) throw itemsError;
        console.log(`Migrated ${dbItems.length} wishlist items.`);
      }

      if (dbVotes.length > 0) {
        const { error: votesError } = await supabase.from('wishlist_votes').upsert(dbVotes);
        if (votesError) throw votesError;
        console.log(`Migrated ${dbVotes.length} wishlist votes.`);
      }
    }
  } catch (err) {
    console.error('Error migrating wishlist:', err.message);
  }

  console.log('Migration finished!');
}

migrate();
