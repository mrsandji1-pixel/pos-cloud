// ===================== APP.JS (INISIALISASI & NAVIGASI) =====================
// activeTab sudah dideklarasikan di supabase-config.js, jadi jangan deklarasi ulang di sini

// Service worker
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register("data:application/javascript;base64,self.addEventListener('fetch', e => { e.respondWith(fetch(e.request).catch(() => caches.match(e.request))) })");
  });
}

// Prevent back button
window.addEventListener('popstate', (e) => {
  if (confirm('Keluar dari aplikasi?')) {
    logout();
  } else {
    history.pushState(null, null, location.href);
  }
});
history.pushState(null, null, location.href);

// Warning before unload
window.addEventListener('beforeunload', (e) => {
  if (typeof cart !== 'undefined' && cart && cart.length > 0) {
    e.preventDefault();
    e.returnValue = '';
  }
});

// Inisialisasi
async function initApp() {
  const { data: admin } = await supabaseClient.from('users').select('*').eq('username', 'admin').single();
  if (!admin) {
    await supabaseClient.from('users').upsert({ username: 'admin', password_hash: ADMIN_HASH, role: 'admin' });
  }
  if (!checkSession()) {
    document.getElementById('loginOverlay').style.display = 'flex';
  }
}

// Navigasi tab
document.querySelectorAll('.tab-btn').forEach(b => {
  b.addEventListener('click', () => {
    if (!currentUser) return;
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.querySelectorAll('.tab-btn').forEach(x => x.classList.remove('active'));
    document.getElementById('page-' + b.dataset.page).classList.add('active');
    b.classList.add('active');
    activeTab = b.dataset.page; // activeTab dideklarasikan di supabase-config.js
    if (activeTab === 'laporan') {
      setDefaultDateFilter();
      muatLaporan();
    }
    if (activeTab === 'setting') {
      muatProfilToko();
      tampilkanUserList();
      aturHakAkses();
    }
    if (activeTab === 'inventory') refreshProductList();
    if (activeTab === 'transaksi') document.getElementById('scanInputTrans').focus();
  });
});

initApp();