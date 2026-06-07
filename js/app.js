// ===================== APP.JS =====================
let activeTab = 'transaksi';

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register("data:application/javascript;base64,self.addEventListener('fetch', e => { e.respondWith(fetch(e.request).catch(() => caches.match(e.request))) })");
  });
}

document.querySelectorAll('.tab-btn').forEach(b => {
  b.addEventListener('click', () => {
    if (!currentUser) return;
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.querySelectorAll('.tab-btn').forEach(x => x.classList.remove('active'));
    document.getElementById('page-' + b.dataset.page).classList.add('active');
    b.classList.add('active');
    activeTab = b.dataset.page;
    if (activeTab === 'laporan') { setDefaultDateFilter(); muatLaporan(); }
    if (activeTab === 'setting') { muatProfilToko(); tampilkanUserList(); aturHakAkses(); }
    if (activeTab === 'inventory') refreshProductList();
    if (activeTab === 'transaksi') document.getElementById('scanInputTrans').focus();
  });
});

window.addEventListener('popstate', (e) => {
  if (confirm('Keluar dari aplikasi?')) { logout(); }
  else { history.pushState(null, null, location.href); }
});
history.pushState(null, null, location.href);

function initApp() {
  checkSession();
}
initApp();