const TOKEN_KEY = 'drawer_stock_admin_token';

const LOW_STOCK_THRESHOLD = 3;
const CRITICAL_THRESHOLD = 1;

const productsGrid = document.getElementById('productsGrid');
const emptyState = document.getElementById('emptyState');
const loginBtn = document.getElementById('loginBtn');
const logoutBtn = document.getElementById('logoutBtn');
const adminActions = document.getElementById('adminActions');
const addProductSection = document.getElementById('addProductSection');
const addForm = document.getElementById('addForm');
const loadingOverlay = document.getElementById('loadingOverlay');
const adminBar = document.getElementById('adminBar');
const searchInput = document.getElementById('searchInput');
const btnAddProduct = document.getElementById('btnAddProduct');
const statActive = document.getElementById('statActive');
const statLow = document.getElementById('statLow');
const statDepleted = document.getElementById('statDepleted');
let allProducts = [];

function isLocalhost() {
  return ['localhost', '127.0.0.1'].includes(window.location.hostname);
}

function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}

function setToken(token) {
  if (token) localStorage.setItem(TOKEN_KEY, token);
  else localStorage.removeItem(TOKEN_KEY);
}

function updateAdminUI() {
  const isAdmin = !!getToken();
  if (!isLocalhost()) {
    if (adminBar) adminBar.setAttribute('hidden', '');
    if (addProductSection) addProductSection.setAttribute('hidden', '');
    if (btnAddProduct) btnAddProduct.setAttribute('hidden', '');
    return;
  }
  if (adminBar) adminBar.removeAttribute('hidden');
  if (btnAddProduct) btnAddProduct.removeAttribute('hidden');
  if (loginBtn) {
    if (isAdmin) loginBtn.setAttribute('hidden', '');
    else loginBtn.removeAttribute('hidden');
  }
  if (adminActions) {
    if (isAdmin) adminActions.removeAttribute('hidden');
    else adminActions.setAttribute('hidden', '');
  }
  if (addProductSection && !isAdmin) addProductSection.setAttribute('hidden', '');
}

function getStockStatus(quantity) {
  if (quantity === 0) return 'sold-out';
  if (quantity <= CRITICAL_THRESHOLD) return 'critical';
  if (quantity <= LOW_STOCK_THRESHOLD) return 'low-stock';
  return 'in-stock';
}

function getStatusLabel(status) {
  switch (status) {
    case 'in-stock':
      return 'STOKTA VAR';
    case 'low-stock':
      return 'DÜŞÜK STOK';
    case 'critical':
      return 'KRİTİK SEVİYE';
    case 'sold-out':
      return 'TÜKENDİ';
    default:
      return '';
  }
}

function updateStats(products) {
  const active = products.filter((p) => p.quantity > 0).length;
  const low = products.filter(
    (p) => p.quantity > 0 && p.quantity <= LOW_STOCK_THRESHOLD
  ).length;
  const depleted = products.filter((p) => p.quantity === 0).length;

  if (statActive) statActive.textContent = active;
  if (statLow) statLow.textContent = low;
  if (statDepleted) statDepleted.textContent = depleted;
}

async function parseJsonResponse(res) {
  const text = await res.text();
  if (!text || text.trim().startsWith('<')) {
    throw new Error('Sunucu beklenmeyen yanıt döndürdü. Sayfayı yenileyip tekrar deneyin.');
  }
  try {
    return JSON.parse(text);
  } catch {
    throw new Error('Sunucu beklenmeyen yanıt döndürdü. Sayfayı yenileyip tekrar deneyin.');
  }
}

async function fetchProducts() {
  const res = await fetch('/api/products');
  if (!res.ok) throw new Error('Failed to load products');
  return parseJsonResponse(res);
}

async function login(password) {
  const res = await fetch('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ password }),
  });
  const data = await parseJsonResponse(res);
  if (!res.ok) throw new Error(data.error || 'Login failed');
  setToken(data.token);
  updateAdminUI();
}

async function addProduct(name, imageUrl, quantity) {
  const token = getToken();
  if (!token) return;
  const res = await fetch('/api/products', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ name, imageUrl: imageUrl || '', quantity: Number(quantity) }),
  });
  const data = await parseJsonResponse(res);
  if (!res.ok) throw new Error(data.error || 'Failed to add product');
  return data;
}

async function updateProduct(id, payload) {
  const token = getToken();
  if (!token) return;
  const res = await fetch(`/api/products/${id}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
  });
  const data = await parseJsonResponse(res);
  if (!res.ok) throw new Error(data.error || 'Failed to update');
  return data;
}

async function deleteProduct(id) {
  const token = getToken();
  if (!token) return;
  const res = await fetch(`/api/products/${id}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  });
  const data = await parseJsonResponse(res);
  if (!res.ok) throw new Error(data.error || 'Failed to delete');
  return data;
}

function renderProduct(product, isAdmin) {
  const status = getStockStatus(product.quantity);
  const card = document.createElement('div');
  card.className = 'product-card' + (status === 'sold-out' ? ' sold-out' : '');

  const imgWrap = document.createElement('div');
  imgWrap.className = 'product-image-wrap';
  if (product.imageUrl) {
    const img = document.createElement('img');
    img.src = product.imageUrl;
    img.alt = product.name;
    img.onerror = () => {
      const span = document.createElement('span');
      span.className = 'placeholder';
      span.textContent = '📦';
      imgWrap.innerHTML = '';
      imgWrap.appendChild(span);
      imgWrap.appendChild(createStatusBadge(status));
    };
    imgWrap.appendChild(img);
  } else {
    const span = document.createElement('span');
    span.className = 'placeholder';
    span.textContent = '📦';
    imgWrap.appendChild(span);
  }

  const statusBadge = createStatusBadge(status);
  statusBadge.textContent = getStatusLabel(status);
  imgWrap.appendChild(statusBadge);

  const body = document.createElement('div');
  body.className = 'product-body';

  const nameEl = document.createElement('h3');
  nameEl.className = 'product-name';
  nameEl.textContent = product.name;
  body.appendChild(nameEl);

  const qtyEl = document.createElement('span');
  qtyEl.className = 'product-quantity ' + status;
  qtyEl.textContent = product.quantity + ' adet';
  body.appendChild(qtyEl);

  if (isAdmin) {
    const qtyWrap = document.createElement('div');
    qtyWrap.className = 'product-qty-edit';
    const qtyInput = document.createElement('input');
    qtyInput.type = 'number';
    qtyInput.min = '0';
    qtyInput.value = product.quantity;
    qtyInput.className = 'qty-input';
    qtyInput.setAttribute('aria-label', 'Stok miktarı');
    const updateBtn = document.createElement('button');
    updateBtn.type = 'button';
    updateBtn.className = 'btn-update-qty';
    updateBtn.textContent = 'Güncelle';
    updateBtn.addEventListener('click', async () => {
      const val = parseInt(qtyInput.value, 10);
      if (Number.isNaN(val) || val < 0) return;
      try {
        await updateProduct(product.id, { quantity: val });
        loadProducts();
      } catch (e) {
        alert(e.message);
      }
    });
    qtyWrap.appendChild(qtyInput);
    qtyWrap.appendChild(updateBtn);
    body.appendChild(qtyWrap);

    const delBtn = document.createElement('button');
    delBtn.type = 'button';
    delBtn.className = 'delete-btn';
    delBtn.textContent = 'Sil';
    delBtn.addEventListener('click', async () => {
      if (!confirm('Bu ürünü silmek istediğinize emin misiniz?')) return;
      try {
        await deleteProduct(product.id);
        loadProducts();
      } catch (e) {
        alert(e.message);
      }
    });
    body.appendChild(delBtn);
  } else if (status === 'sold-out') {
    const btn = document.createElement('span');
    btn.className = 'btn-stock-expected';
    btn.textContent = 'Stok Bekleniyor';
    body.appendChild(btn);
  }

  card.appendChild(imgWrap);
  card.appendChild(body);
  return card;
}

function createStatusBadge(status) {
  const badge = document.createElement('span');
  badge.className = 'product-status-badge ' + status;
  badge.setAttribute('aria-label', getStatusLabel(status));
  return badge;
}

function filterProducts(products, query) {
  if (!query || !query.trim()) return products;
  const q = query.trim().toLowerCase();
  return products.filter(
    (p) => p.name.toLowerCase().includes(q)
  );
}

function renderProducts(products) {
  const isAdmin = !!getToken();
  const query = searchInput ? searchInput.value : '';
  const filtered = filterProducts(products, query);

  productsGrid.innerHTML = '';
  if (filtered.length === 0) {
    const empty = document.createElement('p');
    empty.className = 'empty-state';
    empty.id = 'emptyState';
    empty.innerHTML =
      query.trim()
        ? '<span class="empty-icon" aria-hidden="true">🔍</span>Arama sonucu bulunamadı.'
        : '<span class="empty-icon" aria-hidden="true">📭</span>Henüz ürün yok. Admin girişi yapıp ekleyebilirsiniz.';
    productsGrid.appendChild(empty);
    return;
  }

  filtered.forEach((p) => productsGrid.appendChild(renderProduct(p, isAdmin)));
}

async function loadProducts() {
  try {
    if (emptyState) emptyState.textContent = 'Yükleniyor…';
    const products = await fetchProducts();
    allProducts = products;
    updateStats(products);
    renderProducts(products);
  } catch (e) {
    if (emptyState) emptyState.textContent = 'Ürünler yüklenemedi. Sayfayı yenileyin.';
  }
}

if (loginBtn) {
  loginBtn.addEventListener('click', async () => {
    const password = prompt('Admin şifresi:');
    if (!password) return;
    try {
      await login(password);
      loadProducts();
    } catch (e) {
      alert(e.message);
    }
  });
}

if (logoutBtn) {
  logoutBtn.addEventListener('click', () => {
    setToken(null);
    updateAdminUI();
    loadProducts();
  });
}

if (addForm) {
  addForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = document.getElementById('productName').value.trim();
    const imageUrl = document.getElementById('imageUrl').value.trim();
    const quantity = document.getElementById('quantity').value;
    if (!name) return;
    try {
      await addProduct(name, imageUrl, quantity);
      addForm.reset();
      document.getElementById('quantity').value = 1;
      if (addProductSection) addProductSection.setAttribute('hidden', '');
      loadProducts();
    } catch (err) {
      alert(err.message);
    }
  });
}

if (searchInput) {
  searchInput.addEventListener('input', () => renderProducts(allProducts));
  searchInput.addEventListener('keyup', (e) => {
    if (e.key === 'Enter') renderProducts(allProducts);
  });
}

if (btnAddProduct) {
  btnAddProduct.addEventListener('click', () => {
    if (addProductSection) {
      if (addProductSection.hasAttribute('hidden')) {
        addProductSection.removeAttribute('hidden');
        addProductSection.scrollIntoView({ behavior: 'smooth' });
      } else {
        addProductSection.setAttribute('hidden', '');
      }
    }
  });
}

const viewGridBtn = document.querySelector('.view-btn.view-grid');
const viewListBtn = document.querySelector('.view-btn.view-list');
if (viewGridBtn && viewListBtn && productsGrid) {
  viewGridBtn.addEventListener('click', () => {
    productsGrid.classList.remove('view-list');
    viewGridBtn.classList.add('active');
    viewListBtn.classList.remove('active');
  });
  viewListBtn.addEventListener('click', () => {
    productsGrid.classList.add('view-list');
    viewListBtn.classList.add('active');
    viewGridBtn.classList.remove('active');
  });
}

if (loadingOverlay) {
  setTimeout(() => {
    loadingOverlay.classList.add('hide');
    setTimeout(() => loadingOverlay.remove(), 350);
  }, 1500);
}

const donateBtn = document.getElementById('donateBtn');
const donateOverlay = document.getElementById('donateOverlay');
const donateClose = document.getElementById('donateClose');

function openDonateModal() {
  if (!donateOverlay) return;
  donateOverlay.removeAttribute('hidden');
  donateOverlay.setAttribute('aria-hidden', 'false');
  document.body.style.overflow = 'hidden';
}

function closeDonateModal() {
  if (!donateOverlay) return;
  donateOverlay.setAttribute('hidden', '');
  donateOverlay.setAttribute('aria-hidden', 'true');
  document.body.style.overflow = '';
}

if (donateBtn) {
  donateBtn.addEventListener('click', openDonateModal);
}
if (donateClose) {
  donateClose.addEventListener('click', closeDonateModal);
}
if (donateOverlay) {
  donateOverlay.addEventListener('click', (e) => {
    if (e.target === donateOverlay) closeDonateModal();
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && donateOverlay.getAttribute('aria-hidden') === 'false') {
      closeDonateModal();
    }
  });
}

updateAdminUI();
loadProducts();
