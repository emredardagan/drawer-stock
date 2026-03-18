const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const express = require('express');
const crypto = require('crypto');
const { createClient } = require('@supabase/supabase-js');

const app = express();
const PORT = process.env.PORT || 3009;
const HOST = process.env.HOST || '0.0.0.0';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY || '';

if (!supabaseUrl || !supabaseKey) {
  console.error('Supabase URL or Key is missing in environment variables');
}

// Only create client if URL and Key are provided to avoid crashing on boot
const supabase = (supabaseUrl && supabaseKey) ? createClient(supabaseUrl, supabaseKey) : null;

// Helper to check if DB is configured
function checkDb(req, res, next) {
  if (!supabase) {
    return res.status(500).json({ error: 'Database not configured. Please set Supabase environment variables.' });
  }
  next();
}

app.use('/api', checkDb);

const RESERVATION_DURATION_MS = 30 * 60 * 1000; // 30 minutes

const FORTUNES = [
  'Bu bisküviyi yiyen kişinin bugün toplantısı erken biter.',
  'Müdür bugün yanından geçerken gülümseyecek.',
  'Kodun ilk seferde hatasız derlenecek.',
  'Bugün bir kahve molası daha hak edeceksin.',
  'Öğleden sonra beklenmedik bir övgü alacaksın.',
  'Bu atıştırmalık seni akşama taşır.',
  'Bugün ekran başında gözün yorulmayacak.',
  'Bir sonraki PR\'ın ilk incelemede onaylanacak.',
  'Ofisteki en enerjik sen olacaksın.',
  'Bugün kimse "toplantıyı erteleyelim" demeyecek.',
];

const ALERT_FUN_MESSAGES = [
  '"{product}" acil lazım; tek bir dileğim var: "{product}" geri gelsin!',
  '"{product}" stok gelsin de ne olursa olsun, bu ürün şart!',
  '"{product}" bitti… çekmece boşaldı, kalbim sıkıştı – lütfen doldurun!',
  '"{product}" olmadan ofiste hayat zor. Acil tedarik!',
  '"{product}" için bir paket bile yeter; ben aç kalmayayım.',
  'Uyarı: "{product}" tükendi, moral desteğe ihtiyacım var.',
  '"{product}" stok gelirse ilk ben alırım, söz veriyorum!',
  '"{product}" seni özledim, Drawer\'a sesleniyorum!',
  '"{product}" için acil stok talebi – gönüllü bir atıştırmalık sever.',
  'Tek isteğim "{product}" tekrar gelsin. G E L S İ N !',
  '"{product}" yoksa çekmece boş, ruhum boş – doldurun lütfen!',
  '"{product}" olmazsa olmaz, haberiniz olsun.',
];

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin';
if (!process.env.ADMIN_PASSWORD) {
  console.warn('Uyarı: ADMIN_PASSWORD tanımlı değil, varsayılan "admin" kullanılıyor. Gerçek kullanım için .env dosyasında ADMIN_PASSWORD ayarlayın.');
}

const ADMIN_TOKEN = crypto.createHash('sha256').update(ADMIN_PASSWORD).digest('hex');

const userTokens = new Map(); // In-memory cache for user tokens

app.use(express.json());

function isLocalRequest(req) {
  const host = (req.headers.host || '').toLowerCase();
  return host.startsWith('localhost') || host.startsWith('127.0.0.1');
}

function sendDbError(req, res, error, context) {
  const message =
    (error && (error.message || error.error_description || error.details)) ||
    String(error || 'Unknown database error');
  const code = error && (error.code || error.status || error.statusCode);

  console.error('[DB]', context || 'Unhandled', { message, code });
  if (error && error.stack) console.error(error.stack);

  const payload = { error: 'Database error' };
  if (isLocalRequest(req)) {
    payload.details = message;
    if (code != null) payload.code = code;
  }
  return res.status(500).json(payload);
}

async function cleanupExpiredReservations() {
  const now = new Date().toISOString();
  try {
    const { error } = await supabase
      .from('reservations')
      .delete()
      .lt('expiresAt', now);

    if (error) {
      console.error('[Reservations] Error cleaning up expired reservations:', error.message || error);
    }
  } catch (err) {
    console.error('[Reservations] Error cleaning up expired reservations (fetch/network):', err && err.message ? err.message : err);
    if (err && err.stack) console.error(err.stack);
  }
}

// Middleware: Require Admin
function requireAdmin(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  const token = authHeader.split(' ')[1];
  if (token !== ADMIN_TOKEN) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  next();
}

// Middleware: Require User
async function requireUser(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  const token = authHeader.split(' ')[1];
  
  // Check in-memory cache first
  if (userTokens.has(token)) {
    req.user = userTokens.get(token);
    return next();
  }

  // Check database
  const { data: user, error } = await supabase
    .from('users')
    .select('*')
    .eq('token', token)
    .single();

  if (error || !user) {
    return res.status(403).json({ error: 'Forbidden' });
  }

  userTokens.set(token, user);
  req.user = user;
  next();
}

// --- API Endpoints ---

// Get lucky product
app.get('/api/products/lucky', async (req, res) => {
  await cleanupExpiredReservations();

  const { data: products, error } = await supabase
    .from('products')
    .select('*')
    .gt('quantity', 0);

  if (error) {
    return sendDbError(req, res, error, 'GET /api/products/lucky -> products');
  }

  if (!products || products.length === 0) {
    return res.status(404).json({ error: 'No available products' });
  }

  const { data: reservations, error: reservationsError } = await supabase
    .from('reservations')
    .select('productId');

  if (reservationsError) {
    return sendDbError(req, res, reservationsError, 'GET /api/products/lucky -> reservations');
  }

  const reservedCountByProductId = new Map();
  (reservations || []).forEach((r) => {
    reservedCountByProductId.set(
      r.productId,
      (reservedCountByProductId.get(r.productId) || 0) + 1
    );
  });

  const availableProducts = products
    .map((p) => {
      const reservedQuantity = reservedCountByProductId.get(p.id) || 0;
      const availableQuantity = (p.quantity || 0) - reservedQuantity;
      return { ...p, reservedQuantity, availableQuantity };
    })
    .filter((p) => p.availableQuantity > 0);

  if (availableProducts.length === 0) {
    return res.status(404).json({ error: 'No available products' });
  }

  const randomProduct = availableProducts[Math.floor(Math.random() * availableProducts.length)];
  const randomFortune = FORTUNES[Math.floor(Math.random() * FORTUNES.length)];

  res.json({
    product: randomProduct,
    fortune: randomFortune,
  });
});

// Get products
app.get('/api/products', async (req, res) => {
  await cleanupExpiredReservations();
  const { data: products, error } = await supabase
    .from('products')
    .select('*');

  if (error) {
    return sendDbError(req, res, error, 'GET /api/products -> products');
  }

  const { data: reservations, error: reservationsError } = await supabase
    .from('reservations')
    .select('productId');

  if (reservationsError) {
    return sendDbError(req, res, reservationsError, 'GET /api/products -> reservations');
  }

  const reservedCountByProductId = new Map();
  (reservations || []).forEach((r) => {
    reservedCountByProductId.set(
      r.productId,
      (reservedCountByProductId.get(r.productId) || 0) + 1
    );
  });

  const enriched = (products || []).map((p) => {
    const reservedQuantity = reservedCountByProductId.get(p.id) || 0;
    const availableQuantity = (p.quantity || 0) - reservedQuantity;
    return { ...p, reservedQuantity, availableQuantity };
  });

  res.json(enriched);
});

// Admin Login
app.post('/api/auth/login', (req, res) => {
  const { password } = req.body;
  if (password === ADMIN_PASSWORD) {
    res.json({ token: ADMIN_TOKEN });
  } else {
    res.status(401).json({ error: 'Invalid password' });
  }
});

// User Register / Login
app.post('/api/register', async (req, res) => {
  let { nickname, department } = req.body;
  if (!nickname) {
    return res.status(400).json({ error: 'Nickname is required' });
  }
  nickname = nickname.trim();
  department = (department || '').trim();

  // Check if user exists
  const { data: existingUser } = await supabase
    .from('users')
    .select('*')
    .ilike('nickname', nickname)
    .single();

  if (existingUser) {
    // If exists, just return their token (login)
    userTokens.set(existingUser.token, existingUser);
    return res.json({ token: existingUser.token, user: existingUser });
  }

  // Create new user
  const newUser = {
    id: crypto.randomBytes(8).toString('hex'),
    nickname,
    department,
    createdAt: new Date().toISOString(),
    token: crypto.randomBytes(16).toString('hex'),
  };

  const { error } = await supabase.from('users').insert([newUser]);
  if (error) {
    return res.status(500).json({ error: 'Failed to create user' });
  }

  userTokens.set(newUser.token, newUser);
  res.json({ token: newUser.token, user: newUser });
});

// Get current user
app.get('/api/me', async (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  const token = authHeader.split(' ')[1];

  const { data: user, error } = await supabase
    .from('users')
    .select('*')
    .eq('token', token)
    .single();

  if (error || !user) {
    return res.status(404).json({ error: 'User not found' });
  }

  res.json(user);
});

// Get reservations
app.get('/api/reservations', requireUser, async (req, res) => {
  await cleanupExpiredReservations();
  const { data: reservations, error } = await supabase
    .from('reservations')
    .select('*')
    .eq('userId', req.user.id);

  if (error) {
    return sendDbError(req, res, error, 'GET /api/reservations -> reservations');
  }

  const productIds = Array.from(new Set((reservations || []).map((r) => r.productId)));
  if (productIds.length === 0) return res.json([]);

  const { data: products, error: productsError } = await supabase
    .from('products')
    .select('id,name')
    .in('id', productIds);

  if (productsError) {
    return sendDbError(req, res, productsError, 'GET /api/reservations -> products');
  }

  const nameById = new Map((products || []).map((p) => [p.id, p.name]));

  // Group per product so UI can show "Ürün × N" and cancel in one go.
  const grouped = new Map();
  (reservations || []).forEach((r) => {
    const key = r.productId;
    const existing = grouped.get(key);
    if (!existing) {
      grouped.set(key, {
        id: key, // delete endpoint uses this
        productId: key,
        productName: nameById.get(key) || 'Ürün',
        quantity: 1,
        reservationIds: [r.id],
        expiresAt: r.expiresAt,
      });
      return;
    }
    existing.quantity += 1;
    existing.reservationIds.push(r.id);
    // keep the latest expiry for display/debug
    if (existing.expiresAt < r.expiresAt) existing.expiresAt = r.expiresAt;
  });

  res.json(Array.from(grouped.values()));
});

// Create reservation
app.post('/api/reservations', requireUser, async (req, res) => {
  const { productId } = req.body;
  if (!productId) {
    return res.status(400).json({ error: 'productId is required' });
  }

  const requestedQtyRaw = req.body && req.body.quantity;
  const requestedQty = Math.max(1, parseInt(requestedQtyRaw, 10) || 1);

  const { data: product } = await supabase
    .from('products')
    .select('*')
    .eq('id', productId)
    .single();

  if (!product) {
    return res.status(404).json({ error: 'Product not found' });
  }

  await cleanupExpiredReservations();

  const { data: reservations } = await supabase
    .from('reservations')
    .select('*')
    .eq('productId', productId);

  const activeReservationsCount = reservations ? reservations.length : 0;
  const availableQty = product.quantity - activeReservationsCount;

  if (availableQty <= 0) {
    return res.status(400).json({ error: 'Not enough available stock to reserve' });
  }

  if (requestedQty > availableQty) {
    return res.status(400).json({ error: 'Not enough available stock to reserve' });
  }

  const expiresAt = new Date(Date.now() + RESERVATION_DURATION_MS).toISOString();
  const newReservations = Array.from({ length: requestedQty }).map(() => ({
    id: crypto.randomBytes(8).toString('hex'),
    productId,
    userId: req.user.id,
    expiresAt,
  }));

  const { error } = await supabase.from('reservations').insert(newReservations);
  if (error) {
    return res.status(500).json({ error: 'Failed to create reservation' });
  }

  // Return grouped shape expected by the UI.
  res.json({
    id: productId,
    productId,
    productName: product.name,
    quantity: requestedQty,
    reservationIds: newReservations.map((r) => r.id),
    expiresAt,
  });
});

// Delete reservation
app.delete('/api/reservations/:id', requireUser, async (req, res) => {
  const { id } = req.params;
  // `id` is productId in the grouped UI list; delete all of the user's active reservations for that product.
  const { error } = await supabase
    .from('reservations')
    .delete()
    .eq('productId', id)
    .eq('userId', req.user.id);

  if (error) {
    return res.status(500).json({ error: 'Failed to delete reservation' });
  }

  res.json({ success: true });
});

// Take product
app.post('/api/products/:id/take', requireUser, async (req, res) => {
  const { id } = req.params;
  const { reservationId } = req.body;

  const { data: product } = await supabase
    .from('products')
    .select('*')
    .eq('id', id)
    .single();

  if (!product) {
    return res.status(404).json({ error: 'Product not found' });
  }

  await cleanupExpiredReservations();

  if (reservationId) {
    const { data: reservation } = await supabase
      .from('reservations')
      .select('*')
      .eq('id', reservationId)
      .single();

    if (!reservation || reservation.productId !== id || reservation.userId !== req.user.id) {
      return res.status(400).json({ error: 'Invalid or expired reservation' });
    }
    await supabase.from('reservations').delete().eq('id', reservationId);
  } else {
    const { data: reservations } = await supabase
      .from('reservations')
      .select('*')
      .eq('productId', id);
    
    const activeReservationsCount = reservations ? reservations.length : 0;
    const availableQty = product.quantity - activeReservationsCount;

    if (availableQty <= 0) {
      return res.status(400).json({ error: 'Product is fully reserved or out of stock' });
    }
  }

  if (product.quantity <= 0) {
    return res.status(400).json({ error: 'Out of stock' });
  }

  // Update product quantity
  await supabase
    .from('products')
    .update({ quantity: product.quantity - 1 })
    .eq('id', id);

  // Record consumption
  const consumption = {
    id: crypto.randomBytes(8).toString('hex'),
    productId: product.id,
    productName: product.name,
    userId: req.user.id,
    nickname: req.user.nickname,
    department: req.user.department,
    at: new Date().toISOString(),
  };

  await supabase.from('consumptions').insert([consumption]);

  const fortune = FORTUNES[Math.floor(Math.random() * FORTUNES.length)];
  res.json({ success: true, product: { ...product, quantity: product.quantity - 1 }, fortune });
});

// Emergency alert
app.post('/api/alert/emergency', requireUser, async (req, res) => {
  const { productId } = req.body;
  if (!productId) {
    return res.status(400).json({ error: 'productId is required' });
  }

  const { data: product } = await supabase
    .from('products')
    .select('*')
    .eq('id', productId)
    .single();

  if (!product) {
    return res.status(404).json({ error: 'Product not found' });
  }

  if (product.quantity > 0) {
    return res.status(400).json({ error: 'Product is not out of stock!' });
  }

  const webhookUrl = process.env.TEAMS_WEBHOOK_URL;
  if (!webhookUrl) {
    return res.status(500).json({ error: 'Webhook URL not configured' });
  }

  try {
    const randomTemplate = ALERT_FUN_MESSAGES[Math.floor(Math.random() * ALERT_FUN_MESSAGES.length)];
    const funMessage = randomTemplate.replace(/{product}/g, product.name);
    const appUrl = process.env.APP_PUBLIC_URL || `http://${req.headers.host}`;

    const isSlack = webhookUrl.includes('slack.com');
    const payload = isSlack
      ? { text: `🚨 UYARI 🚨\nÜrün: ${product.name}\nGönderen: ${req.user.nickname}\n\n*${funMessage}*\n\n${appUrl}` }
      : {
          "@type": "MessageCard",
          "@context": "http://schema.org/extensions",
          "themeColor": "FF0000",
          "summary": `Acil Stok Talebi: ${product.name}`,
          "text": `Ürün: ${product.name}<br/>Gönderen: ${req.user.nickname}<br/><br/><b>${funMessage}</b><br/><br/><a href="${appUrl}">${appUrl}</a>`,
          "potentialAction": [
            {
              "@type": "OpenUri",
              "name": "Uygulamaya Git",
              "targets": [{ os: "default", uri: appUrl }]
            }
          ]
        };

    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      throw new Error(`Webhook responded with ${response.status}`);
    }

    res.json({ success: true });
  } catch (err) {
    console.error('Webhook error:', err);
    res.status(500).json({ error: 'Failed to send alert' });
  }
});

// Leaderboard
app.get('/api/leaderboard', async (req, res) => {
  const by = (req.query.by || 'user').toLowerCase();
  const isDepartment = by === 'department';
  
  const { data: consumptions, error } = await supabase
    .from('consumptions')
    .select('*');

  if (error) {
    return sendDbError(req, res, error, 'GET /api/leaderboard -> consumptions');
  }

  const map = new Map();
  consumptions.forEach((c) => {
    const key = isDepartment ? (c.department || 'Belirsiz') : (c.userId || '');
    const label = isDepartment ? (c.department || 'Belirsiz') : (c.nickname || 'Anonim');
    if (!map.has(key)) map.set(key, { id: key, label, count: 0 });
    map.get(key).count += 1;
  });

  const list = Array.from(map.values()).sort((a, b) => b.count - a.count);
  res.json({ by: isDepartment ? 'department' : 'user', list });
});

// --- Admin Endpoints ---

// Create product
app.post('/api/products', requireAdmin, async (req, res) => {
  const { name, type, imageUrl, quantity } = req.body;
  if (!name) return res.status(400).json({ error: 'Name is required' });

  const newProduct = {
    id: crypto.randomBytes(8).toString('hex'),
    name,
    type: type || 'Diğer',
    imageUrl: imageUrl || '',
    quantity: parseInt(quantity, 10) || 0,
  };

  const { error } = await supabase.from('products').insert([newProduct]);
  if (error) {
    return res.status(500).json({ error: 'Failed to create product' });
  }

  res.json(newProduct);
});

// Update product
app.patch('/api/products/:id', requireAdmin, async (req, res) => {
  const { id } = req.params;
  const updates = req.body;

  if (updates.quantity !== undefined) {
    updates.quantity = parseInt(updates.quantity, 10);
  }

  const { data: product, error } = await supabase
    .from('products')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error || !product) {
    return res.status(404).json({ error: 'Product not found or update failed' });
  }

  res.json(product);
});

// Delete product
app.delete('/api/products/:id', requireAdmin, async (req, res) => {
  const { id } = req.params;
  const { error } = await supabase.from('products').delete().eq('id', id);
  
  if (error) {
    return res.status(500).json({ error: 'Failed to delete product' });
  }

  res.json({ success: true });
});

// --- Wishlist Endpoints ---

const TEAMS_WEBHOOK_URL = process.env.TEAMS_WEBHOOK_URL || '';
const WISHLIST_VOTE_THRESHOLD = 5;
if (TEAMS_WEBHOOK_URL.trim()) {
  console.log('[Wishlist] Teams webhook configured (URL length:', TEAMS_WEBHOOK_URL.length, ')');
} else {
  console.log('[Wishlist] Teams webhook not configured (set TEAMS_WEBHOOK_URL in .env to enable)');
}

// Helper to get user from token without requiring it
async function getUserFromToken(authHeader) {
  if (!authHeader || !authHeader.startsWith('Bearer ')) return null;
  const token = authHeader.split(' ')[1];
  if (userTokens.has(token)) return userTokens.get(token).id;
  const { data: user } = await supabase.from('users').select('id').eq('token', token).single();
  return user ? user.id : null;
}

// Fetch wishlist items with vote counts (for internal use)
async function getWishlistItemsWithVoteCounts() {
  const { data: items, error: itemsError } = await supabase.from('wishlist_items').select('*');
  if (itemsError || !items) return [];
  const { data: votes, error: votesError } = await supabase.from('wishlist_votes').select('*');
  if (votesError || !votes) return items.map(i => ({ ...i, upvoteCount: 0, downvoteCount: 0 }));
  return items.map(item => {
    const itemVotes = votes.filter(v => v.itemId === item.id);
    const upvoteCount = itemVotes.filter(v => ((v.value ?? 1) === 1)).length;
    const downvoteCount = itemVotes.filter(v => ((v.value ?? 1) === -1)).length;
    return { ...item, upvoteCount, downvoteCount };
  });
}

// Send wishlist items with >=5 upvotes or >=5 downvotes to Teams via webhook (fire-and-forget)
async function notifyTeamsWishlistOverThreshold() {
  if (!TEAMS_WEBHOOK_URL || !String(TEAMS_WEBHOOK_URL).trim()) {
    console.warn('[Wishlist] Teams webhook skipped: TEAMS_WEBHOOK_URL is not set. Set it in .env and restart the server.');
    return;
  }
  try {
    const items = await getWishlistItemsWithVoteCounts();
    const overUpThreshold = items.filter(i => (i.upvoteCount || 0) >= WISHLIST_VOTE_THRESHOLD);
    const overDownThreshold = items.filter(i => (i.downvoteCount || 0) >= WISHLIST_VOTE_THRESHOLD);
    const parts = [];
    if (overUpThreshold.length > 0) {
      const itemPhrases = overUpThreshold.map(i => `bir ${i.name}'im olsa`).join(', ');
      parts.push(`İş yerinde çalışanlar bilgisayar karşısına dizilmiş oturuyorlar. O çalışanlar aklından geçiriyor; benim de ${itemPhrases} diyor.\n\nSıradaki bağışınızda bu ürünleri almayı düşünebilirsiniz!`);
    }
    if (overDownThreshold.length > 0) {
      const itemNames = overDownThreshold.map(i => i.name).join(', ');
      const isimWord = overDownThreshold.length === 1 ? 'ismi' : 'isimleri';
      parts.push(`Ben söylemiyorum oylar söylüyor ${itemNames}, istenmiyor. Bir daha ${isimWord} dahi geçmemeli.\n\nAlmayı düşünüyorsanız sakin sakin sakin ha!`);
    }
    if (parts.length === 0) return;
    const text = parts.join('\n\n---\n\n');
    const payload = { text };
    const resp = await fetch(TEAMS_WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    if (!resp.ok) {
      const bodyText = await resp.text().catch(() => '');
      console.error('[Wishlist] Teams webhook non-OK:', resp.status, resp.statusText, bodyText);
    } else {
      const sent = [...overUpThreshold, ...overDownThreshold].map(i => i.name);
      console.log('[Wishlist] Teams webhook sent for', sent.join(', '));
    }
  } catch (err) {
    console.error('[Wishlist] Teams webhook error:', err.message);
  }
}

// Get wishlist items
app.get('/api/wishlist-items', async (req, res) => {
  const userId = await getUserFromToken(req.headers.authorization);

  const { data: items, error: itemsError } = await supabase
    .from('wishlist_items')
    .select('*');

  if (itemsError) {
    return sendDbError(req, res, itemsError, 'GET /api/wishlist-items -> wishlist_items');
  }

  const { data: votes, error: votesError } = await supabase
    .from('wishlist_votes')
    .select('*');

  if (votesError) {
    return sendDbError(req, res, votesError, 'GET /api/wishlist-items -> wishlist_votes');
  }

  const { data: users, error: usersError } = await supabase
    .from('users')
    .select('id, nickname');

  if (usersError) {
    return sendDbError(req, res, usersError, 'GET /api/wishlist-items -> users');
  }

  // Map votes to items
  const withNicknames = items.map(item => {
    const itemVotes = votes.filter(v => v.itemId === item.id);
    const upvoteCount = itemVotes.filter(v => ((v.value ?? 1) === 1)).length;
    const downvoteCount = itemVotes.filter(v => ((v.value ?? 1) === -1)).length;
    const voteScore = itemVotes.reduce((sum, v) => sum + (v.value ?? 1), 0);
    const myVoteRow = userId ? itemVotes.find(v => v.userId === userId) : null;
    const myVote = myVoteRow ? (myVoteRow.value ?? 1) : 0;
    const addedByUser = users.find(u => u.id === item.addedBy);
    return {
      ...item,
      addedByNickname: addedByUser ? addedByUser.nickname : null,
      // New voting fields
      voteScore,
      upvoteCount,
      downvoteCount,
      myVote,
      // Backwards-compatible fields
      voteCount: upvoteCount,
      hasVoted: userId ? myVote !== 0 : false,
    };
  });

  const sorted = withNicknames.sort((a, b) => (b.voteScore || 0) - (a.voteScore || 0));
  res.json({ items: sorted });
});

// Add to wishlist
app.post('/api/wishlist-items', requireUser, async (req, res) => {
  const { name } = req.body;
  if (!name || !name.trim()) {
    return res.status(400).json({ error: 'Name is required' });
  }

  const newItem = {
    id: crypto.randomBytes(8).toString('hex'),
    name: name.trim(),
    addedBy: req.user.id,
    addedAt: new Date().toISOString()
  };

  const { error } = await supabase.from('wishlist_items').insert([newItem]);
  if (error) {
    return res.status(500).json({ error: 'Failed to add wishlist item' });
  }

  res.json({ ...newItem, votes: [] });
});

// Vote wishlist item
app.post('/api/wishlist-items/:id/vote', requireUser, async (req, res) => {
  const { id } = req.params;
  const userId = req.user.id;

  const requestedValueRaw = req.body && req.body.value;
  // Backwards compatibility: if no body is sent, treat it as old "toggle upvote".
  const requestedValue =
    requestedValueRaw === undefined || requestedValueRaw === null
      ? 1
      : Number.parseInt(requestedValueRaw, 10);

  // Only allow -1, 0, 1
  if (![ -1, 0, 1 ].includes(requestedValue)) {
    return res.status(400).json({ error: 'Invalid vote value' });
  }

  const { data: existingVote, error: existingVoteError } = await supabase
    .from('wishlist_votes')
    .select('*')
    .eq('itemId', id)
    .eq('userId', userId)
    .single();

  // Supabase returns an error for "no rows" in .single(); ignore that case.
  const hasExistingVote = !!existingVote && !existingVoteError;
  const existingValue = hasExistingVote ? (existingVote.value ?? 1) : 0;

  try {
    if (requestedValue === 0) {
      if (hasExistingVote) {
        const { error: delError } = await supabase
          .from('wishlist_votes')
          .delete()
          .eq('itemId', id)
          .eq('userId', userId);
        if (delError) return sendDbError(req, res, delError, 'POST /api/wishlist-items/:id/vote -> delete');
      }
      return res.json({ success: true });
    }

    if (hasExistingVote) {
      if (existingValue === requestedValue) {
        // Toggle off
        const { error: delError } = await supabase
          .from('wishlist_votes')
          .delete()
          .eq('itemId', id)
          .eq('userId', userId);
        if (delError) return sendDbError(req, res, delError, 'POST /api/wishlist-items/:id/vote -> toggle delete');
        return res.json({ success: true });
      }

      // Switch direction
      const { error: updateError } = await supabase
        .from('wishlist_votes')
        .update({ value: requestedValue })
        .eq('itemId', id)
        .eq('userId', userId);
      if (updateError) return sendDbError(req, res, updateError, 'POST /api/wishlist-items/:id/vote -> update');
      notifyTeamsWishlistOverThreshold().catch(err => {
        console.error('[Wishlist] notifyTeamsWishlistOverThreshold threw:', err.message);
      });
      return res.json({ success: true });
    }

    // New vote
    const { error: insertError } = await supabase
      .from('wishlist_votes')
      .insert([{ itemId: id, userId, value: requestedValue }]);
    if (insertError) return sendDbError(req, res, insertError, 'POST /api/wishlist-items/:id/vote -> insert');

    // Notify Teams when any wishlist item reaches 5 upvotes or 5 downvotes (fire-and-forget)
    if (requestedValue === 1 || requestedValue === -1) {
      notifyTeamsWishlistOverThreshold().catch(err => {
        console.error('[Wishlist] notifyTeamsWishlistOverThreshold threw:', err.message);
      });
    }

    return res.json({ success: true });
  } catch (err) {
    return sendDbError(req, res, err, 'POST /api/wishlist-items/:id/vote -> unhandled');
  }
});

// Delete wishlist item (Admin only)
app.delete('/api/wishlist-items/:id', requireAdmin, async (req, res) => {
  const { id } = req.params;
  
  // Delete votes first due to foreign key constraints (if any, though we didn't specify them in schema, it's good practice)
  await supabase.from('wishlist_votes').delete().eq('itemId', id);
  
  const { error } = await supabase.from('wishlist_items').delete().eq('id', id);
  if (error) {
    return res.status(500).json({ error: 'Failed to delete wishlist item' });
  }

  res.json({ success: true });
});

// Serve static files
app.use(express.static('public'));

if (require.main === module) {
  app.listen(PORT, HOST, () => {
    console.log(`Server is running on http://${HOST}:${PORT}`);
  });
}

module.exports = app;
