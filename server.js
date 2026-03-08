const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const express = require('express');
const fs = require('fs');
const crypto = require('crypto');

const app = express();
const PORT = process.env.PORT || 3009;
const HOST = process.env.HOST || '0.0.0.0';
const DATA_PATH = path.join(__dirname, 'data', 'products.json');
const USERS_PATH = path.join(__dirname, 'data', 'users.json');
const RESERVATIONS_PATH = path.join(__dirname, 'data', 'reservations.json');
const CONSUMPTIONS_PATH = path.join(__dirname, 'data', 'consumptions.json');
const RESERVATION_DURATION_MS = 60 * 60 * 1000;

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

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin';
if (!process.env.ADMIN_PASSWORD) {
  console.warn('Uyarı: ADMIN_PASSWORD tanımlı değil, varsayılan "admin" kullanılıyor. Gerçek kullanım için .env dosyasında ADMIN_PASSWORD ayarlayın.');
}

const adminTokens = new Set();
const userTokens = new Map();

app.use(express.json());

function readProducts() {
  const raw = fs.readFileSync(DATA_PATH, 'utf8');
  return JSON.parse(raw);
}

function writeProducts(products) {
  fs.writeFileSync(DATA_PATH, JSON.stringify(products, null, 2), 'utf8');
}

function readUsers() {
  try {
    const raw = fs.readFileSync(USERS_PATH, 'utf8');
    return JSON.parse(raw);
  } catch (err) {
    if (err.code === 'ENOENT') return [];
    throw err;
  }
}

function writeUsers(users) {
  fs.writeFileSync(USERS_PATH, JSON.stringify(users, null, 2), 'utf8');
}

function readReservations() {
  try {
    const raw = fs.readFileSync(RESERVATIONS_PATH, 'utf8');
    return JSON.parse(raw);
  } catch (err) {
    if (err.code === 'ENOENT') return [];
    throw err;
  }
}

function writeReservations(reservations) {
  fs.writeFileSync(RESERVATIONS_PATH, JSON.stringify(reservations, null, 2), 'utf8');
}

function getActiveReservations(reservations, productId) {
  const now = new Date().toISOString();
  return reservations.filter(
    (r) => r.productId === productId && r.expiresAt > now
  );
}

function getReservedQuantity(reservations, productId) {
  return getActiveReservations(reservations, productId).reduce((sum, r) => sum + (r.quantity || 0), 0);
}

function readConsumptions() {
  try {
    const raw = fs.readFileSync(CONSUMPTIONS_PATH, 'utf8');
    return JSON.parse(raw);
  } catch (err) {
    if (err.code === 'ENOENT') return [];
    throw err;
  }
}

function writeConsumptions(consumptions) {
  fs.writeFileSync(CONSUMPTIONS_PATH, JSON.stringify(consumptions, null, 2), 'utf8');
}

function loadUserTokens() {
  try {
    const users = readUsers();
    users.forEach((u) => {
      if (u.token) userTokens.set(u.token, u.id);
    });
  } catch (err) {
    // ignore
  }
}
loadUserTokens();

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

app.get('/api/products/lucky', (req, res) => {
  try {
    const products = readProducts();
    const reservations = readReservations();
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

app.get('/api/products', (req, res) => {
  try {
    const products = readProducts();
    const reservations = readReservations();
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

app.post('/api/register', (req, res) => {
  const { nickname, department } = req.body || {};
  const nick = typeof nickname === 'string' ? nickname.trim() : '';
  if (!nick) {
    return res.status(400).json({ error: 'nickname required' });
  }
  try {
    const users = readUsers();
    const dept = department != null ? String(department).trim() : '';
    let user = users.find((u) => u.nickname.toLowerCase() === nick.toLowerCase());
    const token = crypto.randomBytes(16).toString('hex');
    if (user) {
      user.department = dept;
      user.token = token;
      userTokens.set(token, user.id);
      writeUsers(users);
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
    writeUsers(users);
    userTokens.set(token, id);
    res.status(201).json({ token, user: { id: user.id, nickname: user.nickname, department: user.department } });
  } catch (err) {
    res.status(500).json({ error: 'Failed to register' });
  }
});

app.get('/api/me', (req, res) => {
  const userId = getUserFromToken(req.headers.authorization);
  if (!userId) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  try {
    const users = readUsers();
    const user = users.find((u) => u.id === userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    res.json({ user: { id: user.id, nickname: user.nickname, department: user.department || '' } });
  } catch (err) {
    res.status(500).json({ error: 'Failed to read user' });
  }
});

app.get('/api/reservations', requireUser, (req, res) => {
  try {
    const reservations = readReservations();
    const now = new Date().toISOString();
    const products = readProducts();
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

app.post('/api/reservations', requireUser, (req, res) => {
  const { productId, quantity } = req.body || {};
  const qty = Math.max(1, Math.floor(Number(quantity)) || 1);
  if (!productId) {
    return res.status(400).json({ error: 'productId required' });
  }
  try {
    const products = readProducts();
    const product = products.find((p) => p.id === productId);
    if (!product) return res.status(404).json({ error: 'Product not found' });
    const reservations = readReservations();
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
    writeReservations(reservations);
    res.status(201).json(reservation);
  } catch (err) {
    res.status(500).json({ error: 'Failed to create reservation' });
  }
});

app.delete('/api/reservations/:id', requireUser, (req, res) => {
  const { id } = req.params;
  try {
    const reservations = readReservations();
    const removed = reservations.find((r) => r.id === id && r.userId === req.userId);
    if (!removed) return res.status(404).json({ error: 'Reservation not found' });
    const next = reservations.filter((r) => r.id !== id || r.userId !== req.userId);
    writeReservations(next);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete reservation' });
  }
});

app.post('/api/products/:id/take', requireUser, (req, res) => {
  const { id: productId } = req.params;
  try {
    const products = readProducts();
    const product = products.find((p) => p.id === productId);
    if (!product) return res.status(404).json({ error: 'Product not found' });
    const reservations = readReservations();
    const now = new Date().toISOString();
    const active = reservations.filter((r) => r.expiresAt > now && r.productId === productId);
    const reserved = active.reduce((sum, r) => sum + (r.quantity || 0), 0);
    const quantity = Number(product.quantity) || 0;
    const available = Math.max(0, quantity - reserved);
    if (available < 1) {
      return res.status(400).json({ error: 'Not enough available', available: 0 });
    }
    const users = readUsers();
    const user = users.find((u) => u.id === req.userId);
    const nickname = user ? user.nickname : '';
    const department = user ? (user.department || '') : '';
    product.quantity = Math.max(0, quantity - 1);
    writeProducts(products);
    const consumptions = readConsumptions();
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
    writeConsumptions(consumptions);
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

app.post('/api/alert/emergency', (req, res) => {
  const webhookUrl = process.env.SLACK_WEBHOOK_URL || process.env.TEAMS_WEBHOOK_URL;
  if (!webhookUrl || !webhookUrl.trim()) {
    return res.status(503).json({ error: 'Webhook not configured', configured: false });
  }
  const { productId } = req.body || {};
  try {
    const products = readProducts();
    const reservations = readReservations();
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
    let text = '🚨 *Patron, çekmece boşaldı!*';
    text += '\n• Ürün: *' + productName + '*';
    if (reservedCount > 0) {
      text += '\n• Bu ürün için wishlist\'te ' + reservedCount + ' adet rezervasyon bekliyor.';
    }
    const isSlack = (webhookUrl || '').includes('slack.com');
    const payload = isSlack
      ? { text }
      : { '@type': 'MessageCard', title: 'Patron, çekmece boşaldı!', text: productName + (reservedCount > 0 ? ' – ' + reservedCount + ' rezervasyon bekliyor.' : '') };
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

app.get('/api/leaderboard', (req, res) => {
  const by = (req.query.by || 'user').toLowerCase();
  const isDepartment = by === 'department';
  try {
    const consumptions = readConsumptions();
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
    const products = readProducts();
    const id = crypto.randomBytes(8).toString('hex');
    const product = {
      id,
      name: String(name),
      imageUrl: resolvedImageUrl,
      quantity: Number(quantity) || 0,
    };
    if (type) product.type = String(type);
    products.push(product);
    writeProducts(products);
    res.json(products);
  } catch (err) {
    res.status(500).json({ error: 'Failed to save product' });
  }
});

app.patch('/api/products/:id', requireAdmin, (req, res) => {
  const { id } = req.params;
  const { name, imageUrl, quantity, type } = req.body || {};
  try {
    const products = readProducts();
    const index = products.findIndex((p) => p.id === id);
    if (index === -1) return res.status(404).json({ error: 'Product not found' });
    if (quantity != null) products[index].quantity = Number(quantity) || 0;
    if (name !== undefined) products[index].name = String(name);
    if (imageUrl !== undefined) products[index].imageUrl = String(imageUrl);
    if (type !== undefined) products[index].type = String(type);
    writeProducts(products);
    res.json(products);
  } catch (err) {
    res.status(500).json({ error: 'Failed to update product' });
  }
});

app.delete('/api/products/:id', requireAdmin, (req, res) => {
  const { id } = req.params;
  try {
    const products = readProducts().filter((p) => p.id !== id);
    writeProducts(products);
    res.json(products);
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete product' });
  }
});

app.use(express.static('public'));

app.listen(PORT, HOST, () => {
  console.log(`Drawer Stock running at http://localhost:${PORT}`);
  if (HOST === '0.0.0.0') {
    console.log(`  (network: http://<this-machine-ip>:${PORT})`);
  }
});
