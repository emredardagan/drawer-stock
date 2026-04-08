const fs = require('node:fs/promises');
const path = require('node:path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const express = require('express');
const crypto = require('node:crypto');

const app = express();
const PORT = process.env.PORT || 3009;
const HOST = process.env.HOST || '0.0.0.0';
const DATA_DIR = path.join(__dirname, 'data');

const TABLE_FILES = {
  products: 'products.json',
  users: 'users.json',
  consumptions: 'consumptions.json',
  reservations: 'reservations.json',
  wishlist_items: 'wishlist_items.json',
  wishlist_votes: 'wishlist_votes.json',
};

const db = {
  products: [],
  users: [],
  consumptions: [],
  reservations: [],
  wishlist_items: [],
  wishlist_votes: [],
};

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
  '"{product}" bitti... çekmece boşaldı, kalbim sıkıştı - lütfen doldurun!',
  '"{product}" olmadan ofiste hayat zor. Acil tedarik!',
  '"{product}" için bir paket bile yeter; ben aç kalmayayım.',
  'Uyarı: "{product}" tükendi, moral desteğe ihtiyacım var.',
  '"{product}" stok gelirse ilk ben alırım, söz veriyorum!',
  '"{product}" seni özledim, Drawer\'a sesleniyorum!',
  '"{product}" için acil stok talebi - gönüllü bir atıştırmalık sever.',
  'Tek isteğim "{product}" tekrar gelsin. G E L S I N !',
  '"{product}" yoksa çekmece boş, ruhum boş - doldurun lütfen!',
  '"{product}" olmazsa olmaz, haberiniz olsun.',
];

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin';
if (!process.env.ADMIN_PASSWORD) {
  console.warn('Uyarı: ADMIN_PASSWORD tanımlı değil, varsayılan "admin" kullanılıyor. Gerçek kullanım için .env dosyasında ADMIN_PASSWORD ayarlayın.');
}

const ADMIN_TOKEN = crypto.createHash('sha256').update(ADMIN_PASSWORD).digest('hex');
const userTokens = new Map();

const TEAMS_WEBHOOK_URL = process.env.TEAMS_WEBHOOK_URL || '';
const WISHLIST_VOTE_THRESHOLD = 5;
if (TEAMS_WEBHOOK_URL.trim()) {
  console.log('[Wishlist] Teams webhook configured (URL length:', TEAMS_WEBHOOK_URL.length, ')');
} else {
  console.log('[Wishlist] Teams webhook not configured (set TEAMS_WEBHOOK_URL in .env to enable)');
}

app.use(express.json());

function getDataPath(tableName) {
  return path.join(DATA_DIR, TABLE_FILES[tableName]);
}

async function readTable(tableName) {
  const filePath = getDataPath(tableName);
  try {
    const raw = await fs.readFile(filePath, 'utf8');
    if (!raw.trim()) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    if (error?.code === 'ENOENT') {
      return [];
    }
    throw error;
  }
}

async function writeTable(tableName, rows) {
  const filePath = getDataPath(tableName);
  await fs.writeFile(filePath, JSON.stringify(rows, null, 2), 'utf8');
}

async function bootstrapDb() {
  const tableNames = Object.keys(TABLE_FILES);
  for (const tableName of tableNames) {
    db[tableName] = await readTable(tableName);
  }
  for (const user of db.users) {
    if (user?.token) userTokens.set(user.token, user);
  }
}

function isLocalRequest(req) {
  const host = (req.headers.host || '').toLowerCase();
  return host.startsWith('localhost') || host.startsWith('127.0.0.1');
}

function sendDataError(req, res, error, context) {
  const message = error?.message || String(error || 'Unknown data error');
  console.error('[DATA]', context || 'Unhandled', { message });
  if (error?.stack) console.error(error.stack);

  const payload = { error: 'Data access error' };
  if (isLocalRequest(req)) {
    payload.details = message;
  }
  return res.status(500).json(payload);
}

async function cleanupExpiredReservations() {
  const now = Date.now();
  const before = db.reservations.length;
  db.reservations = db.reservations.filter((reservation) => {
    const expiresAt = Date.parse(reservation.expiresAt || '');
    return Number.isFinite(expiresAt) && expiresAt > now;
  });
  if (db.reservations.length !== before) {
    await writeTable('reservations', db.reservations);
  }
}

function getEnrichedProducts() {
  const reservedCountByProductId = new Map();
  db.reservations.forEach((reservation) => {
    reservedCountByProductId.set(
      reservation.productId,
      (reservedCountByProductId.get(reservation.productId) || 0) + 1
    );
  });

  return db.products.map((product) => {
    const reservedQuantity = reservedCountByProductId.get(product.id) || 0;
    const availableQuantity = (product.quantity || 0) - reservedQuantity;
    return { ...product, reservedQuantity, availableQuantity };
  });
}

function getBearerToken(authHeader) {
  if (!authHeader?.startsWith('Bearer ')) return '';
  return authHeader.split(' ')[1] || '';
}

// Middleware: Require Admin
function requireAdmin(req, res, next) {
  const token = getBearerToken(req.headers.authorization);
  if (!token) return res.status(401).json({ error: 'Unauthorized' });
  if (token !== ADMIN_TOKEN) return res.status(403).json({ error: 'Forbidden' });
  return next();
}

// Middleware: Require User
function requireUser(req, res, next) {
  const token = getBearerToken(req.headers.authorization);
  if (!token) return res.status(401).json({ error: 'Unauthorized' });

  const cached = userTokens.get(token);
  const user = cached || db.users.find((item) => item.token === token) || null;
  if (!user) return res.status(403).json({ error: 'Forbidden' });

  userTokens.set(token, user);
  req.user = user;
  return next();
}

// --- API Endpoints ---

// Get lucky product
app.get('/api/products/lucky', async (req, res) => {
  try {
    await cleanupExpiredReservations();
    const availableProducts = getEnrichedProducts().filter((product) => product.availableQuantity > 0);
    if (availableProducts.length === 0) {
      return res.status(404).json({ error: 'No available products' });
    }

    const randomProduct = availableProducts[Math.floor(Math.random() * availableProducts.length)];
    const randomFortune = FORTUNES[Math.floor(Math.random() * FORTUNES.length)];
    return res.json({ product: randomProduct, fortune: randomFortune });
  } catch (error) {
    return sendDataError(req, res, error, 'GET /api/products/lucky');
  }
});

// Get products
app.get('/api/products', async (req, res) => {
  try {
    await cleanupExpiredReservations();
    return res.json(getEnrichedProducts());
  } catch (error) {
    return sendDataError(req, res, error, 'GET /api/products');
  }
});

// Admin Login
app.post('/api/auth/login', (req, res) => {
  const { password } = req.body;
  if (password === ADMIN_PASSWORD) {
    return res.json({ token: ADMIN_TOKEN });
  }
  return res.status(401).json({ error: 'Invalid password' });
});

// User Register / Login
app.post('/api/register', async (req, res) => {
  try {
    let { nickname, department } = req.body;
    if (!nickname) return res.status(400).json({ error: 'Nickname is required' });

    nickname = String(nickname).trim();
    department = (department || '').trim();
    const nicknameLower = nickname.toLowerCase();

    const existingUser = db.users.find(
      (user) => String(user.nickname || '').toLowerCase() === nicknameLower
    );
    if (existingUser) {
      userTokens.set(existingUser.token, existingUser);
      return res.json({ token: existingUser.token, user: existingUser });
    }

    const newUser = {
      id: crypto.randomBytes(8).toString('hex'),
      nickname,
      department: department || null,
      createdAt: new Date().toISOString(),
      token: crypto.randomBytes(16).toString('hex'),
    };

    db.users.push(newUser);
    await writeTable('users', db.users);
    userTokens.set(newUser.token, newUser);
    return res.json({ token: newUser.token, user: newUser });
  } catch (error) {
    return sendDataError(req, res, error, 'POST /api/register');
  }
});

// Get current user
app.get('/api/me', (req, res) => {
  const token = getBearerToken(req.headers.authorization);
  if (!token) return res.status(401).json({ error: 'Unauthorized' });

  const user = userTokens.get(token) || db.users.find((item) => item.token === token);
  if (!user) return res.status(404).json({ error: 'User not found' });
  return res.json({ user });
});

// Get reservations
app.get('/api/reservations', requireUser, async (req, res) => {
  try {
    await cleanupExpiredReservations();
    const reservations = db.reservations.filter((reservation) => reservation.userId === req.user.id);
    const productIds = Array.from(new Set(reservations.map((reservation) => reservation.productId)));
    if (productIds.length === 0) return res.json([]);

    const nameById = new Map(
      db.products.filter((product) => productIds.includes(product.id)).map((product) => [product.id, product.name])
    );

    const grouped = new Map();
    reservations.forEach((reservation) => {
      const key = reservation.productId;
      const existing = grouped.get(key);
      if (!existing) {
        grouped.set(key, {
          id: key,
          productId: key,
          productName: nameById.get(key) || 'Ürün',
          quantity: 1,
          reservationIds: [reservation.id],
          expiresAt: reservation.expiresAt,
        });
        return;
      }
      existing.quantity += 1;
      existing.reservationIds.push(reservation.id);
      if (existing.expiresAt < reservation.expiresAt) existing.expiresAt = reservation.expiresAt;
    });

    return res.json(Array.from(grouped.values()));
  } catch (error) {
    return sendDataError(req, res, error, 'GET /api/reservations');
  }
});

// Create reservation
app.post('/api/reservations', requireUser, async (req, res) => {
  try {
    const { productId } = req.body;
    if (!productId) return res.status(400).json({ error: 'productId is required' });

    const requestedQty = Math.max(1, Number.parseInt(req.body?.quantity, 10) || 1);
    const product = db.products.find((item) => item.id === productId);
    if (!product) return res.status(404).json({ error: 'Product not found' });

    await cleanupExpiredReservations();
    const activeReservationsCount = db.reservations.filter((reservation) => reservation.productId === productId).length;
    const availableQty = (product.quantity || 0) - activeReservationsCount;

    if (availableQty <= 0 || requestedQty > availableQty) {
      return res.status(400).json({ error: 'Not enough available stock to reserve' });
    }

    const expiresAt = new Date(Date.now() + RESERVATION_DURATION_MS).toISOString();
    const newReservations = Array.from({ length: requestedQty }).map(() => ({
      id: crypto.randomBytes(8).toString('hex'),
      productId,
      userId: req.user.id,
      expiresAt,
    }));

    db.reservations.push(...newReservations);
    await writeTable('reservations', db.reservations);

    return res.json({
      id: productId,
      productId,
      productName: product.name,
      quantity: requestedQty,
      reservationIds: newReservations.map((reservation) => reservation.id),
      expiresAt,
    });
  } catch (error) {
    return sendDataError(req, res, error, 'POST /api/reservations');
  }
});

// Delete reservation
app.delete('/api/reservations/:id', requireUser, async (req, res) => {
  try {
    const productId = req.params.id;
    const before = db.reservations.length;
    db.reservations = db.reservations.filter(
      (reservation) => !(reservation.productId === productId && reservation.userId === req.user.id)
    );
    if (db.reservations.length !== before) {
      await writeTable('reservations', db.reservations);
    }
    return res.json({ success: true });
  } catch (error) {
    return sendDataError(req, res, error, 'DELETE /api/reservations/:id');
  }
});

// Take product
app.post('/api/products/:id/take', requireUser, async (req, res) => {
  try {
    const productId = req.params.id;
    const reservationId = req.body?.reservationId;
    const product = db.products.find((item) => item.id === productId);
    if (!product) return res.status(404).json({ error: 'Product not found' });

    await cleanupExpiredReservations();

    if (reservationId) {
      const reservationIndex = db.reservations.findIndex((reservation) => reservation.id === reservationId);
      const reservation = reservationIndex >= 0 ? db.reservations[reservationIndex] : null;
      if (!reservation || reservation.productId !== productId || reservation.userId !== req.user.id) {
        return res.status(400).json({ error: 'Invalid or expired reservation' });
      }
      db.reservations.splice(reservationIndex, 1);
      await writeTable('reservations', db.reservations);
    } else {
      const activeReservationsCount = db.reservations.filter((reservation) => reservation.productId === productId).length;
      const availableQty = (product.quantity || 0) - activeReservationsCount;
      if (availableQty <= 0) {
        return res.status(400).json({ error: 'Product is fully reserved or out of stock' });
      }
    }

    if ((product.quantity || 0) <= 0) return res.status(400).json({ error: 'Out of stock' });

    product.quantity -= 1;
    await writeTable('products', db.products);

    const consumption = {
      id: crypto.randomBytes(8).toString('hex'),
      productId: product.id,
      productName: product.name,
      userId: req.user.id,
      nickname: req.user.nickname,
      department: req.user.department,
      at: new Date().toISOString(),
    };
    db.consumptions.push(consumption);
    await writeTable('consumptions', db.consumptions);

    const fortune = FORTUNES[Math.floor(Math.random() * FORTUNES.length)];
    return res.json({ success: true, product: { ...product }, fortune });
  } catch (error) {
    return sendDataError(req, res, error, 'POST /api/products/:id/take');
  }
});

// Emergency alert
app.post('/api/alert/emergency', requireUser, async (req, res) => {
  const { productId } = req.body;
  if (!productId) return res.status(400).json({ error: 'productId is required' });

  const product = db.products.find((item) => item.id === productId);
  if (!product) return res.status(404).json({ error: 'Product not found' });
  if ((product.quantity || 0) > 0) return res.status(400).json({ error: 'Product is not out of stock!' });

  const webhookUrl = process.env.TEAMS_WEBHOOK_URL;
  if (!webhookUrl) return res.status(500).json({ error: 'Webhook URL not configured' });

  try {
    const randomTemplate = ALERT_FUN_MESSAGES[Math.floor(Math.random() * ALERT_FUN_MESSAGES.length)];
    const funMessage = randomTemplate.replaceAll('{product}', product.name);
    const appUrl = process.env.APP_PUBLIC_URL || `http://${req.headers.host}`;

    const isSlack = webhookUrl.includes('slack.com');
    const payload = isSlack
      ? { text: `🚨 UYARI 🚨\nÜrün: ${product.name}\nGönderen: ${req.user.nickname}\n\n*${funMessage}*\n\n${appUrl}` }
      : {
          '@type': 'MessageCard',
          '@context': 'http://schema.org/extensions',
          themeColor: 'FF0000',
          summary: `Acil Stok Talebi: ${product.name}`,
          text: `Ürün: ${product.name}<br/>Gönderen: ${req.user.nickname}<br/><br/><b>${funMessage}</b><br/><br/><a href="${appUrl}">${appUrl}</a>`,
          potentialAction: [
            {
              '@type': 'OpenUri',
              name: 'Uygulamaya Git',
              targets: [{ os: 'default', uri: appUrl }],
            },
          ],
        };

    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!response.ok) throw new Error(`Webhook responded with ${response.status}`);
    return res.json({ success: true });
  } catch (error) {
    console.error('Webhook error:', error);
    return res.status(500).json({ error: 'Failed to send alert' });
  }
});

// Leaderboard
app.get('/api/leaderboard', (req, res) => {
  const by = String(req.query.by || 'user').toLowerCase();
  const isDepartment = by === 'department';

  const map = new Map();
  db.consumptions.forEach((consumption) => {
    const key = isDepartment ? (consumption.department || 'Belirsiz') : (consumption.userId || '');
    const label = isDepartment ? (consumption.department || 'Belirsiz') : (consumption.nickname || 'Anonim');
    if (!map.has(key)) map.set(key, { id: key, label, count: 0 });
    map.get(key).count += 1;
  });

  const list = Array.from(map.values()).sort((a, b) => b.count - a.count);
  return res.json({ by: isDepartment ? 'department' : 'user', list });
});

// --- Admin Endpoints ---

// Create product
app.post('/api/products', requireAdmin, async (req, res) => {
  try {
    const { name, type, imageUrl, quantity } = req.body;
    if (!name) return res.status(400).json({ error: 'Name is required' });

    const newProduct = {
      id: crypto.randomBytes(8).toString('hex'),
      name,
      type: type || 'Diğer',
      imageUrl: imageUrl || '',
      quantity: Number.parseInt(quantity, 10) || 0,
    };

    db.products.push(newProduct);
    await writeTable('products', db.products);
    return res.json(newProduct);
  } catch (error) {
    return sendDataError(req, res, error, 'POST /api/products');
  }
});

// Update product
app.patch('/api/products/:id', requireAdmin, async (req, res) => {
  try {
    const product = db.products.find((item) => item.id === req.params.id);
    if (!product) return res.status(404).json({ error: 'Product not found or update failed' });

    const updates = req.body || {};
    if (updates.quantity !== undefined) {
      const parsed = Number.parseInt(updates.quantity, 10);
      updates.quantity = Number.isNaN(parsed) ? product.quantity : parsed;
    }

    Object.assign(product, updates);
    await writeTable('products', db.products);
    return res.json(product);
  } catch (error) {
    return sendDataError(req, res, error, 'PATCH /api/products/:id');
  }
});

// Delete product
app.delete('/api/products/:id', requireAdmin, async (req, res) => {
  try {
    const before = db.products.length;
    db.products = db.products.filter((product) => product.id !== req.params.id);
    if (db.products.length === before) {
      return res.status(404).json({ error: 'Product not found' });
    }
    await writeTable('products', db.products);
    return res.json({ success: true });
  } catch (error) {
    return sendDataError(req, res, error, 'DELETE /api/products/:id');
  }
});

// --- Wishlist Endpoints ---

function getUserFromToken(authHeader) {
  const token = getBearerToken(authHeader);
  if (!token) return null;
  const user = userTokens.get(token) || db.users.find((item) => item.token === token);
  return user ? user.id : null;
}

function getWishlistItemsWithVoteCounts() {
  return db.wishlist_items.map((item) => {
    const itemVotes = db.wishlist_votes.filter((vote) => vote.itemId === item.id);
    const upvoteCount = itemVotes.filter((vote) => (vote.value ?? 1) === 1).length;
    const downvoteCount = itemVotes.filter((vote) => (vote.value ?? 1) === -1).length;
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
    const items = getWishlistItemsWithVoteCounts();
    const overUpThreshold = items.filter((item) => (item.upvoteCount || 0) >= WISHLIST_VOTE_THRESHOLD);
    const overDownThreshold = items.filter((item) => (item.downvoteCount || 0) >= WISHLIST_VOTE_THRESHOLD);
    const parts = [];

    if (overUpThreshold.length > 0) {
      const itemPhrases = overUpThreshold.map((item) => `bir ${item.name}'im olsa`).join(', ');
      parts.push(`İş yerinde çalışanlar bilgisayar karşısına dizilmiş oturuyorlar. O çalışanlar aklından geçiriyor; benim de ${itemPhrases} diyor.\n\nSıradaki bağışınızda bu ürünleri almayı düşünebilirsiniz!`);
    }
    if (overDownThreshold.length > 0) {
      const itemNames = overDownThreshold.map((item) => item.name).join(', ');
      const isimWord = overDownThreshold.length === 1 ? 'ismi' : 'isimleri';
      parts.push(`Ben söylemiyorum oylar söylüyor ${itemNames}, istenmiyor. Bir daha ${isimWord} dahi geçmemeli.\n\nAlmayı düşünüyorsanız sakin sakin sakin ha!`);
    }
    if (parts.length === 0) return;

    const response = await fetch(TEAMS_WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: parts.join('\n\n---\n\n') }),
    });
    if (response.ok) {
      const sent = [...overUpThreshold, ...overDownThreshold].map((item) => item.name);
      console.log('[Wishlist] Teams webhook sent for', sent.join(', '));
    } else {
      const bodyText = await response.text().catch(() => '');
      console.error('[Wishlist] Teams webhook non-OK:', response.status, response.statusText, bodyText);
    }
  } catch (error) {
    console.error('[Wishlist] Teams webhook error:', error.message);
  }
}

// Get wishlist items
app.get('/api/wishlist-items', (req, res) => {
  const userId = getUserFromToken(req.headers.authorization);

  const withNicknames = db.wishlist_items.map((item) => {
    const itemVotes = db.wishlist_votes.filter((vote) => vote.itemId === item.id);
    const upvoteCount = itemVotes.filter((vote) => (vote.value ?? 1) === 1).length;
    const downvoteCount = itemVotes.filter((vote) => (vote.value ?? 1) === -1).length;
    const voteScore = itemVotes.reduce((sum, vote) => sum + (vote.value ?? 1), 0);
    const myVoteRow = userId ? itemVotes.find((vote) => vote.userId === userId) : null;
    const myVote = myVoteRow ? (myVoteRow.value ?? 1) : 0;
    const addedByUser = db.users.find((user) => user.id === item.addedBy);

    return {
      ...item,
      addedByNickname: addedByUser ? addedByUser.nickname : null,
      voteScore,
      upvoteCount,
      downvoteCount,
      myVote,
      voteCount: upvoteCount,
      hasVoted: userId ? myVote !== 0 : false,
    };
  });

  const sorted = [...withNicknames].sort((a, b) => (b.voteScore || 0) - (a.voteScore || 0));
  return res.json({ items: sorted });
});

// Add to wishlist
app.post('/api/wishlist-items', requireUser, async (req, res) => {
  try {
    const { name } = req.body;
    if (!name?.trim()) return res.status(400).json({ error: 'Name is required' });

    const newItem = {
      id: crypto.randomBytes(8).toString('hex'),
      name: name.trim(),
      addedBy: req.user.id,
      addedAt: new Date().toISOString(),
    };
    db.wishlist_items.push(newItem);
    await writeTable('wishlist_items', db.wishlist_items);
    return res.json({ ...newItem, votes: [] });
  } catch (error) {
    return sendDataError(req, res, error, 'POST /api/wishlist-items');
  }
});

// Vote wishlist item
app.post('/api/wishlist-items/:id/vote', requireUser, async (req, res) => {
  try {
    const itemId = req.params.id;
    const userId = req.user.id;
    const requestedValueRaw = req.body?.value;
    const requestedValue =
      requestedValueRaw === undefined || requestedValueRaw === null
        ? 1
        : Number.parseInt(requestedValueRaw, 10);

    if (![-1, 0, 1].includes(requestedValue)) {
      return res.status(400).json({ error: 'Invalid vote value' });
    }

    const existingIndex = db.wishlist_votes.findIndex(
      (vote) => vote.itemId === itemId && vote.userId === userId
    );
    const hasExistingVote = existingIndex >= 0;
    const existingValue = hasExistingVote ? (db.wishlist_votes[existingIndex].value ?? 1) : 0;

    if (requestedValue === 0) {
      if (hasExistingVote) {
        db.wishlist_votes.splice(existingIndex, 1);
        await writeTable('wishlist_votes', db.wishlist_votes);
      }
      return res.json({ success: true });
    }

    if (hasExistingVote) {
      if (existingValue === requestedValue) {
        db.wishlist_votes.splice(existingIndex, 1);
      } else {
        db.wishlist_votes[existingIndex].value = requestedValue;
      }
      await writeTable('wishlist_votes', db.wishlist_votes);
      notifyTeamsWishlistOverThreshold().catch((error) => {
        console.error('[Wishlist] notifyTeamsWishlistOverThreshold threw:', error.message);
      });
      return res.json({ success: true });
    }

    db.wishlist_votes.push({ itemId, userId, value: requestedValue });
    await writeTable('wishlist_votes', db.wishlist_votes);
    notifyTeamsWishlistOverThreshold().catch((error) => {
      console.error('[Wishlist] notifyTeamsWishlistOverThreshold threw:', error.message);
    });
    return res.json({ success: true });
  } catch (error) {
    return sendDataError(req, res, error, 'POST /api/wishlist-items/:id/vote');
  }
});

// Delete wishlist item (Admin only)
app.delete('/api/wishlist-items/:id', requireAdmin, async (req, res) => {
  try {
    const itemId = req.params.id;
    db.wishlist_votes = db.wishlist_votes.filter((vote) => vote.itemId !== itemId);
    db.wishlist_items = db.wishlist_items.filter((item) => item.id !== itemId);
    await writeTable('wishlist_votes', db.wishlist_votes);
    await writeTable('wishlist_items', db.wishlist_items);
    return res.json({ success: true });
  } catch (error) {
    return sendDataError(req, res, error, 'DELETE /api/wishlist-items/:id');
  }
});

// Serve static files
app.use(express.static('public'));

bootstrapDb()
  .then(() => {
    if (require.main === module) {
      app.listen(PORT, HOST, () => {
        console.log(`Server is running on http://${HOST}:${PORT}`);
      });
    }
  })
  .catch((error) => {
    console.error('Failed to initialize JSON data storage:', error);
    process.exit(1);
  });

module.exports = app;
