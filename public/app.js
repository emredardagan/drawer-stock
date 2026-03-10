const TOKEN_KEY = 'drawer_stock_admin_token';
const USER_TOKEN_KEY = 'drawer_stock_user_token';
const MOOD_KEY = 'drawer_stock_mood';

const MOOD_TEXTS = {
  stressed: 'Sana sert bir kraker lazım, hıncını ondan çıkar.',
  happy: 'Bu mutluluğu bir çikolata ile taçlandır.',
  sleepy: 'Şekerli bir şeyler ye de kendine gel.',
  hungry: 'Hızlı bir atıştırmalık tam sana göre.',
  neutral: 'Ne yesen gider – stoktakilere göz at.',
};

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
const statReserved = document.getElementById('statReserved');
const userRegisterBtn = document.getElementById('userRegisterBtn');
const userBadge = document.getElementById('userBadge');
const userNickname = document.getElementById('userNickname');
const userLogoutBtn = document.getElementById('userLogoutBtn');
const registerOverlay = document.getElementById('registerOverlay');
const registerClose = document.getElementById('registerClose');
const registerForm = document.getElementById('registerForm');
const adminLoginOverlay = document.getElementById('adminLoginOverlay');
const adminLoginClose = document.getElementById('adminLoginClose');
const adminLoginForm = document.getElementById('adminLoginForm');
const adminPasswordInput = document.getElementById('adminPassword');
const adminPasswordToggle = document.getElementById('adminPasswordToggle');
const adminLoginError = document.getElementById('adminLoginError');
const reserveOverlay = document.getElementById('reserveOverlay');
const reserveClose = document.getElementById('reserveClose');
const reserveForm = document.getElementById('reserveForm');
const reserveProductName = document.getElementById('reserveProductName');
const reserveQuantity = document.getElementById('reserveQuantity');
const wishlistBtn = document.getElementById('wishlistBtn');
const wishlistOverlay = document.getElementById('wishlistOverlay');
const wishlistClose = document.getElementById('wishlistClose');
const wishlistBody = document.getElementById('wishlistBody');
const wishlistEmpty = document.getElementById('wishlistEmpty');
const wishlistList = document.getElementById('wishlistList');
const fortuneOverlay = document.getElementById('fortuneOverlay');
const fortuneText = document.getElementById('fortuneText');
const fortuneCloseBtn = document.getElementById('fortuneCloseBtn');
const leaderboardBtn = document.getElementById('leaderboardBtn');
const leaderboardOverlay = document.getElementById('leaderboardOverlay');
const leaderboardClose = document.getElementById('leaderboardClose');
const leaderboardTabUser = document.getElementById('leaderboardTabUser');
const leaderboardTabDept = document.getElementById('leaderboardTabDept');
const leaderboardList = document.getElementById('leaderboardList');
const leaderboardEmpty = document.getElementById('leaderboardEmpty');
const emergencyBtn = document.getElementById('emergencyBtn');
const luckyBtn = document.getElementById('luckyBtn');
const luckyOverlay = document.getElementById('luckyOverlay');
const luckyClose = document.getElementById('luckyClose');
const luckySpinner = document.getElementById('luckySpinner');
const luckyResult = document.getElementById('luckyResult');
const luckyResultProduct = document.getElementById('luckyResultProduct');
const luckyResultName = document.getElementById('luckyResultName');
const luckyResultActions = document.getElementById('luckyResultActions');
const moodOverlay = document.getElementById('moodOverlay');
const moodOptions = document.getElementById('moodOptions');
const footerMoodBar = document.getElementById('footerMoodBar');
const footerMoodText = document.getElementById('footerMoodText');
const footerMoodPrompt = document.getElementById('footerMoodPrompt');
const footerMoodLabel = document.getElementById('footerMoodLabel');
const footerMoodIconPrompt = document.getElementById('footerMoodIconPrompt');
const footerMoodIconTip = document.getElementById('footerMoodIconTip');
const moodSelectBtn = document.getElementById('moodSelectBtn');
const moodChangeBtn = document.getElementById('moodChangeBtn');
const wishlistItemsBtn = document.getElementById('wishlistItemsBtn');
const wishlistItemsOverlay = document.getElementById('wishlistItemsOverlay');
const wishlistItemsClose = document.getElementById('wishlistItemsClose');
const wishlistItemsLoginPrompt = document.getElementById('wishlistItemsLoginPrompt');
const wishlistItemsAddForm = document.getElementById('wishlistItemsAddForm');
const wishlistItemName = document.getElementById('wishlistItemName');
const wishlistItemsList = document.getElementById('wishlistItemsList');
const wishlistItemsEmpty = document.getElementById('wishlistItemsEmpty');
let allProducts = [];
let leaderboardBy = 'user';
let reserveProduct = null;
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

function getUserToken() {
  return localStorage.getItem(USER_TOKEN_KEY);
}

function setUserToken(token) {
  if (token) localStorage.setItem(USER_TOKEN_KEY, token);
  else localStorage.removeItem(USER_TOKEN_KEY);
}

function getToastContainer() {
  let el = document.getElementById('toastContainer');
  if (el) return el;
  el = document.createElement('div');
  el.id = 'toastContainer';
  el.className = 'toast-container';
  document.body.appendChild(el);
  return el;
}

function showToast(message, variant = 'info') {
  const container = getToastContainer();
  const toast = document.createElement('div');
  toast.className = 'toast toast-' + (variant || 'info');
  toast.setAttribute('role', 'status');
  toast.textContent = String(message || '');
  container.appendChild(toast);

  globalThis.requestAnimationFrame(() => toast.classList.add('show'));
  const ttl = variant === 'error' ? 4500 : 2800;
  globalThis.setTimeout(() => {
    toast.classList.remove('show');
    globalThis.setTimeout(() => toast.remove(), 250);
  }, ttl);
}

function updateUserUI() {
  const token = getUserToken();
  if (userRegisterBtn) {
    if (token) {
      userRegisterBtn.setAttribute('hidden', '');
    } else {
      userRegisterBtn.removeAttribute('hidden');
    }
  }
  if (userBadge) {
    if (token) userBadge.removeAttribute('hidden');
    else userBadge.setAttribute('hidden', '');
  }
  if (userNickname && token) {
    fetch('/api/me', {
      headers: { Authorization: 'Bearer ' + token },
    })
      .then((r) => r.ok ? r.json() : null)
      .then((data) => {
        if (data && data.user) userNickname.textContent = data.user.nickname;
      })
      .catch(() => {});
  }
}

function openRegisterModal() {
  if (!registerOverlay) return;
  registerOverlay.removeAttribute('hidden');
  registerOverlay.setAttribute('aria-hidden', 'false');
}

function closeRegisterModal() {
  if (!registerOverlay) return;
  registerOverlay.setAttribute('hidden', '');
  registerOverlay.setAttribute('aria-hidden', 'true');
}

function openReserveModal(product) {
  if (!getUserToken()) {
    openRegisterModal();
    return;
  }
  reserveProduct = product;
  if (reserveProductName) reserveProductName.textContent = product.name;
  if (reserveQuantity) {
    reserveQuantity.max = product.availableQuantity ?? product.quantity ?? 1;
    reserveQuantity.value = Math.min(1, product.availableQuantity ?? 1);
  }
  if (reserveOverlay) {
    reserveOverlay.removeAttribute('hidden');
    reserveOverlay.setAttribute('aria-hidden', 'false');
  }
}

function closeReserveModal() {
  reserveProduct = null;
  if (reserveOverlay) {
    reserveOverlay.setAttribute('hidden', '');
    reserveOverlay.setAttribute('aria-hidden', 'true');
  }
}

async function loadWishlist() {
  const token = getUserToken();
  if (!token || !wishlistList) return;
  try {
    const res = await fetch('/api/reservations', {
      headers: { Authorization: 'Bearer ' + token },
    });
    const data = await parseJsonResponse(res);
    const list = Array.isArray(data) ? data : [];
    wishlistList.innerHTML = '';
    if (wishlistEmpty) wishlistEmpty.hidden = list.length > 0;
    list.forEach((r) => {
      const li = document.createElement('li');
      li.className = 'wishlist-item';
      const name = document.createElement('span');
      name.className = 'wishlist-item-name';
      name.textContent = (r.productName || 'Ürün') + ' × ' + (r.quantity || 1);
      const cancelBtn = document.createElement('button');
      cancelBtn.type = 'button';
      cancelBtn.className = 'btn btn-outline btn-sm';
      cancelBtn.textContent = 'İptal';
      cancelBtn.addEventListener('click', async () => {
        try {
          const r2 = await fetch('/api/reservations/' + r.id, {
            method: 'DELETE',
            headers: { Authorization: 'Bearer ' + token },
          });
          if (r2.ok) {
            loadWishlist();
            loadProducts();
          }
        } catch (e) {
          alert(e.message);
        }
      });
      li.appendChild(name);
      li.appendChild(cancelBtn);
      wishlistList.appendChild(li);
    });
  } catch (err) {
    if (wishlistEmpty) wishlistEmpty.hidden = false;
    wishlistEmpty.textContent = 'Yüklenemedi.';
  }
}

function openWishlistModal() {
  if (!getUserToken()) {
    openRegisterModal();
    return;
  }
  loadWishlist();
  if (wishlistOverlay) {
    wishlistOverlay.removeAttribute('hidden');
    wishlistOverlay.setAttribute('aria-hidden', 'false');
  }
}

function closeWishlistModal() {
  if (wishlistOverlay) {
    wishlistOverlay.setAttribute('hidden', '');
    wishlistOverlay.setAttribute('aria-hidden', 'true');
  }
}

async function loadWishlistItems() {
  if (!wishlistItemsList) return;
  const token = getUserToken();
  const adminToken = getToken();
  if (wishlistItemsLoginPrompt) wishlistItemsLoginPrompt.hidden = !!token;
  if (wishlistItemsAddForm) wishlistItemsAddForm.hidden = !token;
  try {
    const headers = {};
    if (token) headers.Authorization = 'Bearer ' + token;
    const res = await fetch('/api/wishlist-items', { headers });
    const data = await parseJsonResponse(res);
    const items = (data && data.items) ? data.items : [];
    wishlistItemsList.innerHTML = '';
    if (wishlistItemsEmpty) {
      wishlistItemsEmpty.hidden = items.length > 0;
      wishlistItemsEmpty.textContent = 'Henüz öneri yok. Giriş yapıp ilk öneriyi sen ekle!';
    }
    items.forEach((item) => {
      const li = document.createElement('li');
      li.className = 'wishlist-items-item';
      const content = document.createElement('div');
      content.className = 'wishlist-items-item-content';
      const name = document.createElement('div');
      name.className = 'wishlist-items-item-name';
      name.textContent = item.name || '—';
      const meta = document.createElement('div');
      meta.className = 'wishlist-items-item-meta';
      if (item.addedByNickname) {
        const by = document.createElement('span');
        by.className = 'wishlist-items-item-by';
        by.textContent = item.addedByNickname + ' önerdi';
        meta.appendChild(by);
      }
      if (item.voteCount != null) {
        const votes = document.createElement('span');
        votes.className = 'wishlist-items-item-votes';
        votes.textContent = item.voteCount + ' oy';
        meta.appendChild(votes);
      }
      content.appendChild(name);
      content.appendChild(meta);
      const actionBtn = document.createElement('button');
      actionBtn.type = 'button';
      if (adminToken) {
        actionBtn.className = 'wishlist-items-vote-btn wishlist-items-received-btn';
        actionBtn.setAttribute('aria-label', 'Alındı olarak işaretle ve listeden kaldır');
        actionBtn.innerHTML = '<span class="wishlist-items-vote-icon">✓</span><span class="wishlist-items-vote-label">Alındı</span>';
        actionBtn.addEventListener('click', async () => {
          try {
            const r = await fetch('/api/wishlist-items/' + item.id, {
              method: 'DELETE',
              headers: { Authorization: 'Bearer ' + adminToken },
            });
            await parseJsonResponse(r);
            if (r.ok) loadWishlistItems();
            else alert('Kaldırılamadı.');
          } catch (e) {
            alert(e.message || 'Kaldırılamadı.');
          }
        });
      } else {
        actionBtn.className = 'wishlist-items-vote-btn' + (item.hasVoted ? ' voted' : '');
        actionBtn.setAttribute('aria-label', item.hasVoted ? 'Oyu kaldır' : 'Oy ver');
        actionBtn.innerHTML = item.hasVoted
          ? '<span class="wishlist-items-vote-icon">✓</span><span class="wishlist-items-vote-label">Oyladım</span>'
          : '<span class="wishlist-items-vote-icon">↑</span><span class="wishlist-items-vote-label">Oy ver</span>';
        actionBtn.addEventListener('click', async () => {
          if (!token) {
            closeWishlistItemsModal();
            openRegisterModal();
            return;
          }
          try {
            const r = await fetch('/api/wishlist-items/' + item.id + '/vote', {
              method: 'POST',
              headers: { Authorization: 'Bearer ' + token },
            });
            await parseJsonResponse(r);
            if (r.ok) loadWishlistItems();
          } catch (e) {
            alert(e.message || 'Oy verilemedi.');
          }
        });
      }
      li.appendChild(content);
      li.appendChild(actionBtn);
      wishlistItemsList.appendChild(li);
    });
  } catch (err) {
    if (wishlistItemsEmpty) {
      wishlistItemsEmpty.hidden = false;
      wishlistItemsEmpty.textContent = 'Yüklenemedi.';
    }
  }
}

function openWishlistItemsModal() {
  if (wishlistItemsOverlay) {
    wishlistItemsOverlay.removeAttribute('hidden');
    wishlistItemsOverlay.setAttribute('aria-hidden', 'false');
  }
  loadWishlistItems();
}

function closeWishlistItemsModal() {
  if (wishlistItemsOverlay) {
    wishlistItemsOverlay.setAttribute('hidden', '');
    wishlistItemsOverlay.setAttribute('aria-hidden', 'true');
  }
}

function showFortune(text) {
  if (fortuneText) fortuneText.textContent = text || '';
  if (fortuneOverlay) {
    fortuneOverlay.removeAttribute('hidden');
    fortuneOverlay.setAttribute('aria-hidden', 'false');
  }
}

function closeFortuneModal() {
  if (fortuneOverlay) {
    fortuneOverlay.setAttribute('hidden', '');
    fortuneOverlay.setAttribute('aria-hidden', 'true');
  }
}

async function loadLeaderboard(by) {
  leaderboardBy = by || leaderboardBy;
  if (!leaderboardList) return;
  try {
    const res = await fetch('/api/leaderboard?by=' + encodeURIComponent(leaderboardBy));
    const data = await parseJsonResponse(res);
    const list = (data && data.list) ? data.list : [];
    leaderboardList.innerHTML = '';
    if (leaderboardEmpty) leaderboardEmpty.hidden = list.length > 0;
    list.forEach((entry, index) => {
      const li = document.createElement('li');
      li.className = 'leaderboard-item';
      const rank = document.createElement('span');
      rank.className = 'leaderboard-rank';
      rank.textContent = '#' + (index + 1);
      const label = document.createElement('span');
      label.className = 'leaderboard-label';
      label.textContent = entry.label || '—';
      const count = document.createElement('span');
      count.className = 'leaderboard-count';
      count.textContent = entry.count + ' adet';
      li.appendChild(rank);
      li.appendChild(label);
      li.appendChild(count);
      leaderboardList.appendChild(li);
    });
    if (leaderboardTabUser && leaderboardTabDept) {
      leaderboardTabUser.classList.toggle('active', leaderboardBy === 'user');
      leaderboardTabDept.classList.toggle('active', leaderboardBy === 'department');
    }
  } catch (err) {
    if (leaderboardEmpty) {
      leaderboardEmpty.hidden = false;
      leaderboardEmpty.textContent = 'Yüklenemedi.';
    }
  }
}

function openLeaderboardModal() {
  loadLeaderboard(leaderboardBy);
  if (leaderboardOverlay) {
    leaderboardOverlay.removeAttribute('hidden');
    leaderboardOverlay.setAttribute('aria-hidden', 'false');
  }
}

function closeLeaderboardModal() {
  if (leaderboardOverlay) {
    leaderboardOverlay.setAttribute('hidden', '');
    leaderboardOverlay.setAttribute('aria-hidden', 'true');
  }
}

function getStoredMood() {
  try {
    return sessionStorage.getItem(MOOD_KEY) || '';
  } catch (e) {
    return '';
  }
}

function setStoredMood(mood) {
  try {
    if (mood) sessionStorage.setItem(MOOD_KEY, mood);
    else sessionStorage.removeItem(MOOD_KEY);
  } catch (e) {}
}

function openMoodModal() {
  if (moodOverlay) {
    moodOverlay.removeAttribute('hidden');
    moodOverlay.setAttribute('aria-hidden', 'false');
  }
}

function closeMoodModal() {
  if (moodOverlay) {
    moodOverlay.setAttribute('hidden', '');
    moodOverlay.setAttribute('aria-hidden', 'true');
  }
}

function applyMoodUI(mood) {
  const text = MOOD_TEXTS[mood] || '';
  if (!footerMoodBar) return;
  if (text) {
    footerMoodBar.classList.add('mood-bar-has-suggestion');
    if (footerMoodIconPrompt) footerMoodIconPrompt.setAttribute('hidden', '');
    if (footerMoodIconTip) footerMoodIconTip.removeAttribute('hidden');
    if (footerMoodPrompt) footerMoodPrompt.setAttribute('hidden', '');
    if (footerMoodLabel) footerMoodLabel.removeAttribute('hidden');
    if (footerMoodText) {
      footerMoodText.textContent = text;
      footerMoodText.removeAttribute('hidden');
    }
    if (moodSelectBtn) moodSelectBtn.setAttribute('hidden', '');
    if (moodChangeBtn) moodChangeBtn.removeAttribute('hidden');
  } else {
    footerMoodBar.classList.remove('mood-bar-has-suggestion');
    if (footerMoodIconPrompt) footerMoodIconPrompt.removeAttribute('hidden');
    if (footerMoodIconTip) footerMoodIconTip.setAttribute('hidden', '');
    if (footerMoodPrompt) footerMoodPrompt.removeAttribute('hidden');
    if (footerMoodLabel) footerMoodLabel.setAttribute('hidden', '');
    if (footerMoodText) footerMoodText.setAttribute('hidden', '');
    if (moodSelectBtn) moodSelectBtn.removeAttribute('hidden');
    if (moodChangeBtn) moodChangeBtn.setAttribute('hidden', '');
  }
}

function openLuckyModal() {
  if (!luckyOverlay) return;
  if (luckySpinner) {
    luckySpinner.removeAttribute('hidden');
    luckySpinner.setAttribute('aria-hidden', 'false');
  }
  if (luckyResult) {
    luckyResult.setAttribute('hidden', '');
    luckyResultProduct.innerHTML = '';
    if (luckyResultName) luckyResultName.textContent = '';
  }
  luckyOverlay.removeAttribute('hidden');
  luckyOverlay.setAttribute('aria-hidden', 'false');
}

function closeLuckyModal() {
  if (luckyOverlay) {
    luckyOverlay.setAttribute('hidden', '');
    luckyOverlay.setAttribute('aria-hidden', 'true');
  }
}

async function pickLucky() {
  openLuckyModal();
  const duration = 1500;
  const start = Date.now();
  try {
    const res = await fetch('/api/products/lucky');
    const data = await parseJsonResponse(res);
    const elapsed = Date.now() - start;
    const remaining = Math.max(0, duration - elapsed);
    await new Promise((r) => setTimeout(r, remaining));
    if (res.ok && data.product) {
      if (luckySpinner) {
        luckySpinner.setAttribute('hidden', '');
        luckySpinner.setAttribute('aria-hidden', 'true');
      }
      if (luckyResult) {
        luckyResult.removeAttribute('hidden');
        if (luckyResultProduct) {
          if (data.product.imageUrl) {
            const img = document.createElement('img');
            img.src = data.product.imageUrl;
            img.alt = data.product.name;
            img.className = 'lucky-product-img';
            luckyResultProduct.appendChild(img);
          } else {
            const span = document.createElement('span');
            span.className = 'lucky-product-placeholder';
            span.textContent = '📦';
            luckyResultProduct.appendChild(span);
          }
        }
        if (luckyResultName) luckyResultName.textContent = data.product.name;
        if (luckyResultActions) {
          luckyResultActions.innerHTML = '';
          const product = data.product;
          const reserveBtn = document.createElement('button');
          reserveBtn.type = 'button';
          reserveBtn.className = 'btn btn-reserve';
          reserveBtn.textContent = 'Rezerve et';
          reserveBtn.addEventListener('click', () => {
            openReserveModal(product);
            closeLuckyModal();
          });
          const takeBtn = document.createElement('button');
          takeBtn.type = 'button';
          takeBtn.className = 'btn btn-take';
          takeBtn.textContent = 'Aldım';
          takeBtn.addEventListener('click', () => {
            closeLuckyModal();
            takeProduct(product.id);
          });
          luckyResultActions.appendChild(reserveBtn);
          luckyResultActions.appendChild(takeBtn);
        }
      }
    } else {
      closeLuckyModal();
      alert(data.message || data.error || 'Stokta ürün yok.');
    }
  } catch (err) {
    closeLuckyModal();
    alert(err.message || 'Seçim yapılamadı.');
  }
}

async function sendEmergencyAlert(productId) {
  if (!getUserToken()) {
    openRegisterModal();
    return;
  }
  try {
    const headers = { 'Content-Type': 'application/json' };
    const token = getUserToken();
    if (token) headers.Authorization = 'Bearer ' + token;
    const res = await fetch('/api/alert/emergency', {
      method: 'POST',
      headers,
      body: JSON.stringify(productId ? { productId } : {}),
    });
    const data = await parseJsonResponse(res);
    if (res.ok) {
      showToast('Uyarı Drawer kanalına gönderildi.', 'success');
    } else if (res.status === 401 && data && data.code === 'USER_REQUIRED') {
      openRegisterModal();
      showToast('Rumuz girmeden uyarı gönderemezsin.', 'error');
    } else {
      showToast(data.error || data.message || 'Uyarı gönderilemedi. Webhook tanımlı mı?', 'error');
    }
  } catch (err) {
    showToast(err.message || 'Uyarı gönderilemedi.', 'error');
  }
}

async function takeProduct(productId) {
  if (!getUserToken()) {
    openRegisterModal();
    return;
  }
  try {
    const res = await fetch('/api/products/' + productId + '/take', {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + getUserToken() },
    });
    const data = await parseJsonResponse(res);
    if (res.ok && data.fortune) {
      loadProducts();
      showFortune(data.fortune);
    } else {
      alert(data.error || 'Ürün alınamadı.');
    }
  } catch (err) {
    alert(err.message || 'Ürün alınamadı.');
  }
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
  const reserved = products.reduce((sum, p) => sum + (p.reservedQuantity ?? 0), 0);

  if (statActive) statActive.textContent = active;
  if (statLow) statLow.textContent = low;
  if (statDepleted) statDepleted.textContent = depleted;
  if (statReserved) statReserved.textContent = reserved;
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
  const available = product.availableQuantity ?? product.quantity ?? 0;
  const reserved = product.reservedQuantity ?? 0;
  const status = getStockStatus(available);
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
  let qtyText = (product.quantity ?? 0) + ' adet';
  if (reserved > 0) qtyText += ' (' + reserved + ' rezerve)';
  qtyEl.textContent = qtyText;
  body.appendChild(qtyEl);

  const hasUser = !!getUserToken();
  if (hasUser && available >= 1) {
    const actionsWrap = document.createElement('div');
    actionsWrap.className = 'product-card-actions';
    const reserveBtn = document.createElement('button');
    reserveBtn.type = 'button';
    reserveBtn.className = 'btn btn-reserve';
    reserveBtn.textContent = 'Rezerve et';
    reserveBtn.addEventListener('click', () => openReserveModal(product));
    actionsWrap.appendChild(reserveBtn);
    const takeBtn = document.createElement('button');
    takeBtn.type = 'button';
    takeBtn.className = 'btn btn-take';
    takeBtn.textContent = 'Aldım';
    takeBtn.addEventListener('click', () => takeProduct(product.id));
    actionsWrap.appendChild(takeBtn);
    body.appendChild(actionsWrap);
  }

  if (status === 'sold-out') {
    const alertBtn = document.createElement('button');
    alertBtn.type = 'button';
    alertBtn.className = 'btn btn-emergency-sm';
    alertBtn.textContent = 'Uyarı gönder';
    alertBtn.addEventListener('click', () => sendEmergencyAlert(product.id));
    body.appendChild(alertBtn);
  }

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

function openAdminLoginOverlay() {
  if (!adminLoginOverlay) return;
  if (adminPasswordInput) {
    adminPasswordInput.value = '';
    adminPasswordInput.classList.remove('admin-password-visible');
    adminPasswordInput.focus();
  }
  if (adminPasswordToggle) {
    adminPasswordToggle.textContent = 'Göster';
    adminPasswordToggle.setAttribute('aria-label', 'Şifreyi göster');
  }
  if (adminLoginError) {
    adminLoginError.textContent = '';
    adminLoginError.setAttribute('hidden', '');
  }
  adminLoginOverlay.removeAttribute('hidden');
  adminLoginOverlay.setAttribute('aria-hidden', 'false');
}

function closeAdminLoginOverlay() {
  if (!adminLoginOverlay) return;
  adminLoginOverlay.setAttribute('hidden', '');
  adminLoginOverlay.setAttribute('aria-hidden', 'true');
}

if (loginBtn) {
  loginBtn.addEventListener('click', () => openAdminLoginOverlay());
}

if (adminLoginOverlay) {
  adminLoginOverlay.addEventListener('click', (e) => {
    if (e.target === adminLoginOverlay) closeAdminLoginOverlay();
  });
}

if (adminLoginClose) {
  adminLoginClose.addEventListener('click', () => closeAdminLoginOverlay());
}

if (adminPasswordToggle && adminPasswordInput) {
  adminPasswordToggle.addEventListener('click', () => {
    const visible = adminPasswordInput.classList.toggle('admin-password-visible');
    adminPasswordToggle.textContent = visible ? 'Gizle' : 'Göster';
    adminPasswordToggle.setAttribute('aria-label', visible ? 'Şifreyi gizle' : 'Şifreyi göster');
  });
}

if (adminLoginForm && adminPasswordInput && adminLoginError) {
  adminLoginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const password = adminPasswordInput.value;
    if (!password) return;
    adminLoginError.textContent = '';
    adminLoginError.setAttribute('hidden', '');
    try {
      await login(password);
      closeAdminLoginOverlay();
      loadProducts();
    } catch (e) {
      adminLoginError.textContent = e.message || 'Giriş başarısız.';
      adminLoginError.removeAttribute('hidden');
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
updateUserUI();
loadProducts();

setInterval(() => {
  loadProducts();
  if (wishlistOverlay && wishlistOverlay.getAttribute('aria-hidden') === 'false') {
    loadWishlist();
  }
  if (wishlistItemsOverlay && wishlistItemsOverlay.getAttribute('aria-hidden') === 'false') {
    loadWishlistItems();
  }
}, 2 * 60 * 1000);

const storedMood = getStoredMood();
if (storedMood && MOOD_TEXTS[storedMood]) {
  applyMoodUI(storedMood);
}

if (moodOptions) {
  moodOptions.querySelectorAll('.mood-option').forEach((btn) => {
    btn.addEventListener('click', () => {
      const mood = btn.dataset.mood || '';
      setStoredMood(mood);
      applyMoodUI(mood);
      closeMoodModal();
    });
  });
}
if (moodSelectBtn) moodSelectBtn.addEventListener('click', openMoodModal);
if (moodChangeBtn) moodChangeBtn.addEventListener('click', openMoodModal);
if (moodOverlay) {
  moodOverlay.addEventListener('click', (e) => {
    if (e.target === moodOverlay) closeMoodModal();
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && moodOverlay.getAttribute('aria-hidden') === 'false') closeMoodModal();
  });
}

if (userRegisterBtn) userRegisterBtn.addEventListener('click', openRegisterModal);
if (userLogoutBtn) {
  userLogoutBtn.addEventListener('click', () => {
    setUserToken(null);
    updateUserUI();
    loadProducts();
  });
}
if (registerForm) {
  registerForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const nickname = document.getElementById('registerNickname').value.trim();
    const department = document.getElementById('registerDepartment').value.trim();
    if (!nickname) return;
    try {
      const res = await fetch('/api/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nickname, department: department || undefined }),
      });
      const data = await parseJsonResponse(res);
      if (data.token) {
        setUserToken(data.token);
        updateUserUI();
        closeRegisterModal();
        registerForm.reset();
        loadProducts();
      } else {
        alert(data.error || 'Giriş yapılamadı.');
      }
    } catch (err) {
      alert(err.message || 'Giriş yapılamadı.');
    }
  });
}
if (registerClose) registerClose.addEventListener('click', closeRegisterModal);
if (registerOverlay) {
  registerOverlay.addEventListener('click', (e) => {
    if (e.target === registerOverlay) closeRegisterModal();
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && registerOverlay.getAttribute('aria-hidden') === 'false') closeRegisterModal();
  });
}

if (reserveForm) {
  reserveForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!reserveProduct || !getUserToken()) return;
    const qty = Math.max(1, parseInt(reserveQuantity.value, 10) || 1);
    try {
      const res = await fetch('/api/reservations', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer ' + getUserToken(),
        },
        body: JSON.stringify({ productId: reserveProduct.id, quantity: qty }),
      });
      const data = await parseJsonResponse(res);
      if (res.ok) {
        closeReserveModal();
        loadProducts();
      } else {
        alert(data.error || 'Rezervasyon yapılamadı.');
      }
    } catch (err) {
      alert(err.message || 'Rezervasyon yapılamadı.');
    }
  });
}
if (reserveClose) reserveClose.addEventListener('click', closeReserveModal);
if (reserveOverlay) {
  reserveOverlay.addEventListener('click', (e) => {
    if (e.target === reserveOverlay) closeReserveModal();
  });
}

if (wishlistBtn) wishlistBtn.addEventListener('click', openWishlistModal);
if (wishlistClose) wishlistClose.addEventListener('click', closeWishlistModal);
if (wishlistOverlay) {
  wishlistOverlay.addEventListener('click', (e) => {
    if (e.target === wishlistOverlay) closeWishlistModal();
  });
}

if (wishlistItemsBtn) wishlistItemsBtn.addEventListener('click', openWishlistItemsModal);
if (wishlistItemsClose) wishlistItemsClose.addEventListener('click', closeWishlistItemsModal);
if (wishlistItemsOverlay) {
  wishlistItemsOverlay.addEventListener('click', (e) => {
    if (e.target === wishlistItemsOverlay) closeWishlistItemsModal();
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && wishlistItemsOverlay.getAttribute('aria-hidden') === 'false') {
      closeWishlistItemsModal();
    }
  });
}
if (wishlistItemsAddForm) {
  wishlistItemsAddForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const token = getUserToken();
    if (!token) {
      openRegisterModal();
      return;
    }
    const name = wishlistItemName ? wishlistItemName.value.trim() : '';
    if (!name) return;
    try {
      const res = await fetch('/api/wishlist-items', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer ' + token,
        },
        body: JSON.stringify({ name }),
      });
      const data = await parseJsonResponse(res);
      if (res.ok) {
        if (wishlistItemName) wishlistItemName.value = '';
        loadWishlistItems();
      } else {
        alert(data.message || data.error || 'Eklenemedi.');
      }
    } catch (err) {
      alert(err.message || 'Eklenemedi.');
    }
  });
}

if (fortuneCloseBtn) fortuneCloseBtn.addEventListener('click', closeFortuneModal);
if (fortuneOverlay) {
  fortuneOverlay.addEventListener('click', (e) => {
    if (e.target === fortuneOverlay) closeFortuneModal();
  });
}

if (leaderboardBtn) leaderboardBtn.addEventListener('click', openLeaderboardModal);
if (leaderboardClose) leaderboardClose.addEventListener('click', closeLeaderboardModal);
if (leaderboardOverlay) {
  leaderboardOverlay.addEventListener('click', (e) => {
    if (e.target === leaderboardOverlay) closeLeaderboardModal();
  });
}
if (leaderboardTabUser) leaderboardTabUser.addEventListener('click', () => { loadLeaderboard('user'); });
if (leaderboardTabDept) leaderboardTabDept.addEventListener('click', () => { loadLeaderboard('department'); });

if (emergencyBtn) emergencyBtn.addEventListener('click', () => sendEmergencyAlert());
if (luckyBtn) luckyBtn.addEventListener('click', pickLucky);
if (luckyClose) luckyClose.addEventListener('click', closeLuckyModal);
if (luckyOverlay) {
  luckyOverlay.addEventListener('click', (e) => {
    if (e.target === luckyOverlay) closeLuckyModal();
  });
}

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
