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
let selectedTypeFilter = '';
let sortOrder = 'desc';

function normalizeType(value) {
  if (value == null) return '';
  return String(value).trim();
}

function setSelectedTypeFilter(typeValue) {
  selectedTypeFilter = normalizeType(typeValue);
  document.querySelectorAll('.type-filter-btn').forEach((btn) => {
    const btnType = normalizeType(btn.dataset.type);
    const isActive = btnType === selectedTypeFilter;
    btn.classList.toggle('active', isActive);
    btn.setAttribute('aria-pressed', isActive ? 'true' : 'false');
  });
}

function setSortOrder(order) {
  sortOrder = order === 'asc' ? 'asc' : 'desc';
  document.querySelectorAll('.sort-order-btn').forEach((btn) => {
    const isActive = (btn.dataset.order || '') === sortOrder;
    btn.classList.toggle('active', isActive);
    btn.setAttribute('aria-pressed', isActive ? 'true' : 'false');
  });
}

function isLocalhost() {
  return ['localhost', '127.0.0.1'].includes(globalThis.location.hostname);
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

async function addProduct(name, imageUrl, quantity, type) {
  const token = getToken();
  if (!token) return;
  const payload = { name, imageUrl: imageUrl || '', quantity: Number(quantity) };
  if (type) payload.type = type;
  const res = await fetch('/api/products', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
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

  const nameRow = document.createElement('div');
  nameRow.className = 'product-name-row';

  const nameEl = document.createElement('h3');
  nameEl.className = 'product-name';
  nameEl.textContent = product.name;
  nameRow.appendChild(nameEl);

  const productType = normalizeType(product.type);
  if (productType) {
    const typeBadge = document.createElement('span');
    const t = productType.toLowerCase();
    const isSweet = t === 'tatlı';
    const isSalty = t === 'tuzlu';
    let variantClass = '';
    let icon = '';
    if (isSweet) {
      variantClass = ' sweet';
      icon = '🍩';
    } else if (isSalty) {
      variantClass = ' salty';
      icon = '🥨';
    }
    typeBadge.className = 'product-type-badge product-type-badge-icon-only' + variantClass;
    typeBadge.textContent = icon;
    typeBadge.setAttribute('aria-label', productType);
    nameRow.appendChild(typeBadge);
  }
  body.appendChild(nameRow);

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
      const val = Number.parseInt(qtyInput.value, 10);
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

function filterProducts(products, query, typeFilter) {
  let filtered = products;

  const typeVal = normalizeType(typeFilter);
  if (typeVal) {
    filtered = filtered.filter((p) => normalizeType(p.type) === typeVal);
  }

  if (!query || !query.trim()) return filtered;
  const q = query.trim().toLowerCase();
  return filtered.filter((p) => p.name.toLowerCase().includes(q));
}

function renderProducts(products) {
  const isAdmin = !!getToken();
  const query = searchInput ? searchInput.value : '';
  let filtered = filterProducts(products, query, selectedTypeFilter);
  const cmp = (a, b) => (a.quantity ?? 0) - (b.quantity ?? 0);
  filtered = [...filtered].sort(sortOrder === 'asc' ? cmp : (a, b) => -cmp(a, b));

  productsGrid.innerHTML = '';
  if (filtered.length === 0) {
    const empty = document.createElement('p');
    empty.className = 'empty-state';
    empty.id = 'emptyState';
    let emptyHtml =
      '<span class="empty-icon" aria-hidden="true">📭</span>Henüz ürün yok. Admin girişi yapıp ekleyebilirsiniz.';
    if (selectedTypeFilter) {
      emptyHtml = '<span class="empty-icon" aria-hidden="true">📭</span>Bu filtrede ürün bulunamadı.';
    }
    if (query.trim()) {
      emptyHtml = '<span class="empty-icon" aria-hidden="true">🔍</span>Arama sonucu bulunamadı.';
    }
    empty.innerHTML = emptyHtml;
    productsGrid.appendChild(empty);
    updateStats(filtered);
    return;
  }

  updateStats(filtered);
  filtered.forEach((p) => productsGrid.appendChild(renderProduct(p, isAdmin)));
}

async function loadProducts() {
  try {
    if (emptyState) emptyState.textContent = 'Yükleniyor…';
    const products = await fetchProducts();
    allProducts = products;
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
    const type = document.getElementById('productType').value.trim() || undefined;
    if (!name) return;
    try {
      await addProduct(name, imageUrl, quantity, type);
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

document.querySelectorAll('.type-filter-btn').forEach((btn) => {
  btn.addEventListener('click', () => {
    setSelectedTypeFilter(btn.dataset.type || '');
    renderProducts(allProducts);
  });
});

document.querySelectorAll('.sort-order-btn').forEach((btn) => {
  btn.addEventListener('click', () => {
    setSortOrder(btn.dataset.order || 'desc');
    renderProducts(allProducts);
  });
});

setSelectedTypeFilter('');
setSortOrder('desc');
