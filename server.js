const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const express = require('express');
const fs = require('fs');
const crypto = require('crypto');
const admin = require('firebase-admin');

const app = express();
const PORT = process.env.PORT || 3009;
const HOST = process.env.HOST || '0.0.0.0';
const DATA_PATH = path.join(__dirname, 'data', 'products.json');
const USERS_PATH = path.join(__dirname, 'data', 'users.json');
const RESERVATIONS_PATH = path.join(__dirname, 'data', 'reservations.json');
const CONSUMPTIONS_PATH = path.join(__dirname, 'data', 'consumptions.json');
const WISHLIST_PATH = path.join(__dirname, 'data', 'wishlist.json');
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

const adminTokens = new Set();
const userTokens = new Map();

app.use(express.json());

// --- FIREBASE INIT ---
let db = null;
try {
  let serviceAccount = null;
  if (process.env.FIREBASE_SERVICE_ACCOUNT) {
    try {
      serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
    } catch (e) {
      console.error('Failed to parse FIREBASE_SERVICE_ACCOUNT');
    }
  } else {
    const saPath = path.join(__dirname, 'firebase-service-account.json');
    if (fs.existsSync(saPath)) {
      serviceAccount = require(saPath);
    }
  }

  if (serviceAccount) {
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      databaseURL: process.env.FIREBASE_DATABASE_URL || 'https://drawer-stock-default-rtdb.europe-west1.firebasedatabase.app'
    });
    db = admin.database();
    console.log('[Firebase] Initialized successfully.');
  } else {
    console.warn('[Firebase] Warning: serviceAccount not found. Migration needs FIREBASE_SERVICE_ACCOUNT env var or firebase-service-account.json.');
  }
} catch (err) {
  console.error('[Firebase] Initialization error:', err);
}

function toArray(val) {
  if (!val) return [];
  if (Array.isArray(val)) return val.filter(Boolean);
  return Object.values(val).filter(Boolean);
}

async function readProducts() {
  if (!db) return JSON.parse(fs.readFileSync(DATA_PATH, 'utf8'));
  const snap = await db.ref('products').once('value');
  return toArray(snap.val());
}

async function writeProducts(products) {
  if (!db) return fs.writeFileSync(DATA_PATH, JSON.stringify(products, null, 2), 'utf8');
  await db.ref('products').set(products);
}

async function readUsers() {
  if (!db) {
    try { return JSON.parse(fs.readFileSync(USERS_PATH, 'utf8')); }
    catch (err) { if (err.code === 'ENOENT') return []; throw err; }
  }
  const snap = await db.ref('users').once('value');
  return toArray(snap.val());
}

async function writeUsers(users) {
  if (!db) return fs.writeFileSync(USERS_PATH, JSON.stringify(users, null, 2), 'utf8');
  await db.ref('users').set(users);
}

async function readReservations() {
  if (!db) {
    try { return JSON.parse(fs.readFileSync(RESERVATIONS_PATH, 'utf8')); }
    catch (err) { if (err.code === 'ENOENT') return []; throw err; }
  }
  const snap = await db.ref('reservations').once('value');
  return toArray(snap.val());
}

async function writeReservations(reservations) {
  if (!db) return fs.writeFileSync(RESERVATIONS_PATH, JSON.stringify(reservations, null, 2), 'utf8');
  await db.ref('reservations').set(reservations);
}

async function cleanupExpiredReservations() {
  try {
    const reservations = await readReservations();
    const now = new Date().toISOString();
    const active = reservations.filter((r) => r.expiresAt > now);
    if (active.length !== reservations.length) {
      await writeReservations(active);
      console.log('[Reservations] Removed', reservations.length - active.length, 'expired reservation(s).');
    }
  } catch (err) {
    console.error('[Reservations] Cleanup failed:', err.message);
  }
}

async function readConsumptions() {
  if (!db) {
    try { return JSON.parse(fs.readFileSync(CONSUMPTIONS_PATH, 'utf8')); }
    catch (err) { if (err.code === 'ENOENT') return []; throw err; }
  }
  const snap = await db.ref('consumptions').once('value');
  return toArray(snap.val());
}

async function writeConsumptions(consumptions) {
  if (!db) return fs.writeFileSync(CONSUMPTIONS_PATH, JSON.stringify(consumptions, null, 2), 'utf8');
  await db.ref('consumptions').set(consumptions);
}

async function readWishlist() {
  if (!db) {
    try {
      const raw = fs.readFileSync(WISHLIST_PATH, 'utf8');
      const data = JSON.parse(raw);
      return Array.isArray(data.items) ? data : { items: [] };
    } catch (err) { if (err.code === 'ENOENT') return { items: [] }; throw err; }
  }
  const snap = await db.ref('wishlist').once('value');
  const items = toArray(snap.val());
  return { items };
}

async function writeWishlist(data) {
  if (!db) {
    const obj = typeof data === 'object' && data !== null ? data : { items: [] };
    if (!Array.isArray(obj.items)) obj.items = [];
    return fs.writeFileSync(WISHLIST_PATH, JSON.stringify(obj, null, 2), 'utf8');
  }
  const items = (data && Array.isArray(data.items)) ? data.items : [];
  await db.ref('wishlist').set(items);
}

async function loadUserTokens() {
  try {
    const users = await readUsers();
    users.forEach((u) => {
      if (u.token) userTokens.set(u.token, u.id);
    });
  } catch (err) {
    // ignore
  }
}
loadUserTokens(); // will start async execution

function requireAdmin(req, res, next) {
  const authHeader = req.headers.authorization;
  const token = authHeader && authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
  if (!token || !adminTokens.has(token)) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
}

function requireUser(req, res, next) {
  const authHeader = req.headers.authorization;
  const token = authHeader && authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
  if (!token || !userTokens.has(token)) {
    return res.status(401).json({ error: 'Unauthorized', code: 'USER_REQUIRED' });
  }
  req.userId = userTokens.get(token);
  next();
}

function getUserFromToken(authHeader) {
  const token = authHeader && authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
  if (!token || !userTokens.has(token)) return null;
  return userTokens.get(token);
}

async function imageUrlToBase64(url) {
  if (!url || typeof url !== 'string') return url;
  const trimmed = url.trim();
  if (!trimmed.startsWith('http://') && !trimmed.startsWith('https://')) return url;
  try {
    const res = await fetch(trimmed, { redirect: 'follow' });
    if (!res.ok) return url;
    const contentType = res.headers.get('content-type') || 'image/jpeg';
    const buffer = Buffer.from(await res.arrayBuffer());
    const base64 = buffer.toString('base64');
    return `data:${contentType.split(';')[0]};base64,${base64}`;
  } catch (err) {
    console.warn('Image URL to base64 failed:', err.message);
    return url;
  }
}

app.get('/api/products/lucky', async (req, res) => {
  try {
    const products = await readProducts();
    const reservations = await readReservations();
    const now = new Date().toISOString();
    const active = reservations.filter((r) => r.expiresAt > now);
    const available = products.filter((p) => {
      const qty = Number(p.quantity) || 0;
      const reserved = active.filter((r) => r.productId === p.id).reduce((s, r) => s + (r.quantity || 0), 0);
      return qty - reserved > 0;
    });
    if (available.length === 0) {
      return res.status(404).json({ error: 'No product available', message: 'Stokta ürün yok.' });
    }
    const product = available[Math.floor(Math.random() * available.length)];
    res.json({ product });
  } catch (err) {
    res.status(500).json({ error: 'Failed to pick product' });
  }
});

app.get('/api/products', async (req, res) => {
  try {
    const products = await readProducts();
    const reservations = await readReservations();
    const now = new Date().toISOString();
    const activeReservations = reservations.filter((r) => r.expiresAt > now);
    const withAvailable = products.map((p) => {
      const reserved = activeReservations
        .filter((r) => r.productId === p.id)
        .reduce((sum, r) => sum + (r.quantity || 0), 0);
      const quantity = Number(p.quantity) || 0;
      return {
        ...p,
        availableQuantity: Math.max(0, quantity - reserved),
        reservedQuantity: reserved,
      };
    });
    res.json(withAvailable);
  } catch (err) {
    res.status(500).json({ error: 'Failed to read products' });
  }
});

app.post('/api/auth/login', (req, res) => {
  const { password } = req.body || {};
  if (password !== ADMIN_PASSWORD) {
    return res.status(401).json({ error: 'Invalid password' });
  }
  const token = crypto.randomBytes(16).toString('hex');
  adminTokens.add(token);
  res.json({ token });
});

app.post('/api/register', async (req, res) => {
  const { nickname, department } = req.body || {};
  const nick = typeof nickname === 'string' ? nickname.trim() : '';
  if (!nick) {
    return res.status(400).json({ error: 'nickname required' });
  }
  try {
    const users = await readUsers();
    const dept = department != null ? String(department).trim() : '';
    let user = users.find((u) => u.nickname.toLowerCase() === nick.toLowerCase());
    const token = crypto.randomBytes(16).toString('hex');
    if (user) {
      user.department = dept;
      user.token = token;
      userTokens.set(token, user.id);
      await writeUsers(users);
      return res.json({ token, user: { id: user.id, nickname: user.nickname, department: user.department } });
    }
    const id = crypto.randomBytes(8).toString('hex');
    user = {
      id,
      nickname: nick,
      department: dept,
      createdAt: new Date().toISOString(),
      token,
    };
    users.push(user);
    await writeUsers(users);
    userTokens.set(token, id);
    res.status(201).json({ token, user: { id: user.id, nickname: user.nickname, department: user.department } });
  } catch (err) {
    res.status(500).json({ error: 'Failed to register' });
  }
});

app.get('/api/me', async (req, res) => {
  const userId = getUserFromToken(req.headers.authorization);
  if (!userId) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  try {
    const users = await readUsers();
    const user = users.find((u) => u.id === userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    res.json({ user: { id: user.id, nickname: user.nickname, department: user.department || '' } });
  } catch (err) {
    res.status(500).json({ error: 'Failed to read user' });
  }
});

app.get('/api/reservations', requireUser, async (req, res) => {
  try {
    const reservations = await readReservations();
    const now = new Date().toISOString();
    const products = await readProducts();
    const myActive = reservations.filter(
      (r) => r.userId === req.userId && r.expiresAt > now
    );
    const withProduct = myActive.map((r) => {
      const product = products.find((p) => p.id === r.productId);
      return {
        ...r,
        productName: product ? product.name : '',
      };
    });
    res.json(withProduct);
  } catch (err) {
    res.status(500).json({ error: 'Failed to read reservations' });
  }
});

app.post('/api/reservations', requireUser, async (req, res) => {
  const { productId, quantity } = req.body || {};
  const qty = Math.max(1, Math.floor(Number(quantity)) || 1);
  if (!productId) {
    return res.status(400).json({ error: 'productId required' });
  }
  try {
    const products = await readProducts();
    const product = products.find((p) => p.id === productId);
    if (!product) return res.status(404).json({ error: 'Product not found' });
    const reservations = await readReservations();
    const now = new Date().toISOString();
    const active = reservations.filter((r) => r.expiresAt > now && r.productId === productId);
    const reserved = active.reduce((sum, r) => sum + (r.quantity || 0), 0);
    const available = Math.max(0, (Number(product.quantity) || 0) - reserved);
    if (available < qty) {
      return res.status(400).json({ error: 'Not enough available to reserve', available });
    }
    const expiresAt = new Date(Date.now() + RESERVATION_DURATION_MS).toISOString();
    const id = crypto.randomBytes(8).toString('hex');
    const reservation = {
      id,
      productId,
      userId: req.userId,
      quantity: qty,
      expiresAt,
      createdAt: now,
    };
    reservations.push(reservation);
    await writeReservations(reservations);
    res.status(201).json(reservation);
  } catch (err) {
    res.status(500).json({ error: 'Failed to create reservation' });
  }
});

app.delete('/api/reservations/:id', requireUser, async (req, res) => {
  const { id } = req.params;
  try {
    let reservations = await readReservations();
    const removed = reservations.find((r) => r.id === id && r.userId === req.userId);
    if (!removed) return res.status(404).json({ error: 'Reservation not found' });
    reservations = reservations.filter((r) => r.id !== id || r.userId !== req.userId);
    await writeReservations(reservations);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete reservation' });
  }
});

app.post('/api/products/:id/take', requireUser, async (req, res) => {
  const { id: productId } = req.params;
  try {
    const products = await readProducts();
    const product = products.find((p) => p.id === productId);
    if (!product) return res.status(404).json({ error: 'Product not found' });
    const reservations = await readReservations();
    const now = new Date().toISOString();
    const active = reservations.filter((r) => r.expiresAt > now && r.productId === productId);
    const reserved = active.reduce((sum, r) => sum + (r.quantity || 0), 0);
    const quantity = Number(product.quantity) || 0;
    const available = Math.max(0, quantity - reserved);
    if (available < 1) {
      return res.status(400).json({ error: 'Not enough available', available: 0 });
    }
    const users = await readUsers();
    const user = users.find((u) => u.id === req.userId);
    const nickname = user ? user.nickname : '';
    const department = user ? (user.department || '') : '';
    product.quantity = Math.max(0, quantity - 1);
    await writeProducts(products);
    const consumptions = await readConsumptions();
    const cId = crypto.randomBytes(8).toString('hex');
    consumptions.push({
      id: cId,
      productId,
      productName: product.name,
      userId: req.userId,
      nickname,
      department,
      at: now,
    });
    await writeConsumptions(consumptions);
    const fortune = FORTUNES[Math.floor(Math.random() * FORTUNES.length)];
    res.json({
      success: true,
      fortune,
      product: {
        id: product.id,
        name: product.name,
        quantity: product.quantity,
        type: product.type,
      },
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to take product' });
  }
});

app.post('/api/alert/emergency', requireUser, async (req, res) => {
  const webhookUrl = process.env.SLACK_WEBHOOK_URL || process.env.TEAMS_WEBHOOK_URL;
  if (!webhookUrl || !webhookUrl.trim()) {
    return res.status(503).json({ error: 'Webhook not configured', configured: false });
  }
  const { productId } = req.body || {};
  try {
    const users = await readUsers();
    const user = users.find((u) => u.id === req.userId);
    const nickname = user && user.nickname ? user.nickname : 'Anonim';

    const products = await readProducts();
    const reservations = await readReservations();
    const now = new Date().toISOString();
    const activeReservations = reservations.filter((r) => r.expiresAt > now);
    let product = null;
    let reservedCount = 0;
    if (productId) {
      product = products.find((p) => p.id === productId);
      if (product) {
        reservedCount = activeReservations.filter((r) => r.productId === productId).reduce((sum, r) => sum + (r.quantity || 0), 0);
      }
    }
    if (!product) {
      const depleted = products.filter((p) => (Number(p.quantity) || 0) === 0);
      if (depleted.length === 0) {
        return res.status(400).json({ error: 'No depleted product to alert', message: 'Tükenen ürün yok.' });
      }
      let maxReserved = 0;
      for (const p of depleted) {
        const r = activeReservations.filter((x) => x.productId === p.id).reduce((s, x) => s + (x.quantity || 0), 0);
        if (r >= maxReserved) {
          maxReserved = r;
          product = p;
          reservedCount = r;
        }
      }
    }
    const productName = product ? product.name : 'Çekmece';
    const funTemplate = ALERT_FUN_MESSAGES[Math.floor(Math.random() * ALERT_FUN_MESSAGES.length)];
    const funMessage = String(funTemplate).split('{product}').join(productName);
    const appUrl = process.env.APP_PUBLIC_URL || `http://${req.headers.host}`;
    const isSlack = (webhookUrl || '').includes('slack.com');
    const payload = isSlack
      ? { text: `🚨 UYARI 🚨\nÜrün: ${productName}\nGönderen: ${nickname}\n\n*${funMessage}*\n\n${appUrl}` }
      : {
          '@type': 'MessageCard',
          '@context': 'http://schema.org/extensions',
          summary: `🚨 UYARI: ${productName} stok uyarısı`,
          title: `🚨 UYARI: ${productName}`,
          text: `Ürün: ${productName}<br/>Gönderen: ${nickname}<br/><br/><b>${funMessage}</b><br/><br/><a href="${appUrl}">${appUrl}</a>`,
          potentialAction: [
            {
              '@type': 'OpenUri',
              name: 'Drawer Stock’u aç',
              targets: [{ os: 'default', uri: appUrl }],
            },
          ],
        };
    fetch(webhookUrl.trim(), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
      .then((r) => {
        if (!r.ok) throw new Error('Webhook returned ' + r.status);
        res.json({ ok: true, product: productName, reservedCount });
      })
      .catch((err) => {
        res.status(502).json({ error: 'Webhook failed', message: err.message });
      });
  } catch (err) {
    res.status(500).json({ error: 'Failed to send alert', message: err.message });
  }
});

app.get('/api/leaderboard', async (req, res) => {
  const by = (req.query.by || 'user').toLowerCase();
  const isDepartment = by === 'department';
  try {
    const consumptions = await readConsumptions();
    const map = new Map();
    consumptions.forEach((c) => {
      const key = isDepartment ? (c.department || 'Belirsiz') : (c.userId || '');
      const label = isDepartment ? (c.department || 'Belirsiz') : (c.nickname || 'Anonim');
      if (!map.has(key)) map.set(key, { id: key, label, count: 0 });
      map.get(key).count += 1;
    });
    const list = Array.from(map.values()).sort((a, b) => b.count - a.count);
    res.json({ by: isDepartment ? 'department' : 'user', list });
  } catch (err) {
    res.status(500).json({ error: 'Failed to read leaderboard' });
  }
});

app.post('/api/products', requireAdmin, async (req, res) => {
  const { name, imageUrl, quantity, type } = req.body || {};
  if (!name || quantity == null) {
    return res.status(400).json({ error: 'name and quantity required' });
  }
  try {
    const resolvedImageUrl = imageUrl ? await imageUrlToBase64(String(imageUrl)) : '';
    const products = await readProducts();
    const id = crypto.randomBytes(8).toString('hex');
    const product = {
      id,
      name: String(name),
      imageUrl: resolvedImageUrl,
      quantity: Number(quantity) || 0,
    };
    if (type) product.type = String(type);
    products.push(product);
    await writeProducts(products);
    res.json(products);
  } catch (err) {
    res.status(500).json({ error: 'Failed to save product' });
  }
});

app.patch('/api/products/:id', requireAdmin, async (req, res) => {
  const { id } = req.params;
  const { name, imageUrl, quantity, type } = req.body || {};
  try {
    const products = await readProducts();
    const index = products.findIndex((p) => p.id === id);
    if (index === -1) return res.status(404).json({ error: 'Product not found' });
    if (quantity != null) products[index].quantity = Number(quantity) || 0;
    if (name !== undefined) products[index].name = String(name);
    if (imageUrl !== undefined) products[index].imageUrl = String(imageUrl);
    if (type !== undefined) products[index].type = String(type);
    await writeProducts(products);
    res.json(products);
  } catch (err) {
    res.status(500).json({ error: 'Failed to update product' });
  }
});

app.delete('/api/products/:id', requireAdmin, async (req, res) => {
  const { id } = req.params;
  try {
    let products = await readProducts();
    products = products.filter((p) => p.id !== id);
    await writeProducts(products);
    res.json(products);
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete product' });
  }
});

app.get('/api/wishlist-items', async (req, res) => {
  try {
    const userId = getUserFromToken(req.headers.authorization);
    const { items } = await readWishlist();
    const users = await readUsers();
    const withNicknames = items.map((item) => {
      const addedByUser = users.find((u) => u.id === item.addedBy);
      const votes = Array.isArray(item.votes) ? item.votes : [];
      return {
        ...item,
        addedByNickname: addedByUser ? addedByUser.nickname : null,
        voteCount: votes.length,
        hasVoted: userId ? votes.includes(userId) : false,
      };
    });
    const sorted = withNicknames.sort((a, b) => (b.voteCount || 0) - (a.voteCount || 0));
    res.json({ items: sorted });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to read wishlist' });
  }
});

app.post('/api/wishlist-items', requireUser, async (req, res) => {
  const { name } = req.body || {};
  const trimmed = typeof name === 'string' ? name.trim() : '';
  if (!trimmed) {
    return res.status(400).json({ error: 'name required', message: 'Ürün adı gerekli.' });
  }
  try {
    const data = await readWishlist();
    const id = crypto.randomBytes(8).toString('hex');
    const now = new Date().toISOString();
    const item = {
      id,
      name: trimmed,
      addedBy: req.userId,
      addedAt: now,
      votes: [],
    };
    data.items.push(item);
    await writeWishlist(data);
    res.status(201).json(item);
  } catch (err) {
    res.status(500).json({ error: 'Failed to add wishlist item' });
  }
});

app.post('/api/wishlist-items/:id/vote', requireUser, async (req, res) => {
  const { id } = req.params;
  try {
    const data = await readWishlist();
    const item = data.items.find((i) => i.id === id);
    if (!item) return res.status(404).json({ error: 'Wishlist item not found' });
    const votes = Array.isArray(item.votes) ? item.votes : [];
    const idx = votes.indexOf(req.userId);
    if (idx >= 0) {
      votes.splice(idx, 1);
    } else {
      votes.push(req.userId);
    }
    item.votes = votes;
    await writeWishlist(data);
    res.json({ voted: idx < 0, voteCount: votes.length });
  } catch (err) {
    res.status(500).json({ error: 'Failed to vote' });
  }
});

app.delete('/api/wishlist-items/:id', requireAdmin, async (req, res) => {
  const { id } = req.params;
  try {
    const data = await readWishlist();
    const before = data.items.length;
    data.items = data.items.filter((i) => i.id !== id);
    if (data.items.length === before) {
      return res.status(404).json({ error: 'Wishlist item not found' });
    }
    await writeWishlist(data);
    res.json({ removed: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to remove wishlist item' });
  }
});

app.use(express.static('public'));

const CLEANUP_INTERVAL_MS = 5 * 60 * 1000;
setInterval(cleanupExpiredReservations, CLEANUP_INTERVAL_MS);
cleanupExpiredReservations(); // run once on startup

app.listen(PORT, HOST, () => {
  console.log(`Drawer Stock running at http://localhost:${PORT}`);
  if (HOST === '0.0.0.0') {
    console.log(`  (network: http://<this-machine-ip>:${PORT})`);
  }
});
