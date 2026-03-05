const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const express = require('express');
const fs = require('fs');
const crypto = require('crypto');

const app = express();
const PORT = process.env.PORT || 3009;
const HOST = process.env.HOST || '0.0.0.0';
const DATA_PATH = path.join(__dirname, 'data', 'products.json');

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin';
if (!process.env.ADMIN_PASSWORD) {
  console.warn('Uyarı: ADMIN_PASSWORD tanımlı değil, varsayılan "admin" kullanılıyor. Gerçek kullanım için .env dosyasında ADMIN_PASSWORD ayarlayın.');
}

const adminTokens = new Set();

app.use(express.json());

function readProducts() {
  const raw = fs.readFileSync(DATA_PATH, 'utf8');
  return JSON.parse(raw);
}

function writeProducts(products) {
  fs.writeFileSync(DATA_PATH, JSON.stringify(products, null, 2), 'utf8');
}

function requireAdmin(req, res, next) {
  const authHeader = req.headers.authorization;
  const token = authHeader && authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
  if (!token || !adminTokens.has(token)) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
}

app.get('/api/products', (req, res) => {
  try {
    const products = readProducts();
    res.json(products);
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

app.post('/api/products', requireAdmin, (req, res) => {
  const { name, imageUrl, quantity } = req.body || {};
  if (!name || quantity == null) {
    return res.status(400).json({ error: 'name and quantity required' });
  }
  try {
    const products = readProducts();
    const id = crypto.randomBytes(8).toString('hex');
    const product = {
      id,
      name: String(name),
      imageUrl: imageUrl ? String(imageUrl) : '',
      quantity: Number(quantity) || 0,
    };
    products.push(product);
    writeProducts(products);
    res.json(products);
  } catch (err) {
    res.status(500).json({ error: 'Failed to save product' });
  }
});

app.patch('/api/products/:id', requireAdmin, (req, res) => {
  const { id } = req.params;
  const { name, imageUrl, quantity } = req.body || {};
  try {
    const products = readProducts();
    const index = products.findIndex((p) => p.id === id);
    if (index === -1) return res.status(404).json({ error: 'Product not found' });
    if (quantity != null) products[index].quantity = Number(quantity) || 0;
    if (name !== undefined) products[index].name = String(name);
    if (imageUrl !== undefined) products[index].imageUrl = String(imageUrl);
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
