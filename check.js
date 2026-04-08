const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY;
const supabaseCacheControl = process.env.SUPABASE_CACHE_CONTROL || 'max-age=43200';

const supabase = createClient(supabaseUrl, supabaseKey, {
  global: {
    headers: {
      'Cache-Control': supabaseCacheControl,
    },
  },
});

async function check() {
  const { data: c, error: e1 } = await supabase.from('consumptions').select('*').limit(2);
  console.log('Consumptions:', c, e1);

  const { data: v, error: e2 } = await supabase.from('wishlist_items').select('*').limit(2);
  console.log('Wishlist items:', v, e2);
  
  const { data: vv, error: e3 } = await supabase.from('wishlist_votes').select('*').limit(2);
  console.log('Wishlist votes:', vv, e3);
}

check();
