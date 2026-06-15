// ===================== TRANSAKSI.JS (Dengan Fitur Diskon) =====================
let cart = [];
let searchTimer = null;
let totalDiskon = 0; // diskon total dalam rupiah

function setupTransaksi() {
  const nominalDiv = document.getElementById('nominalButtons');
  nominalDiv.innerHTML = '';
  [100000,50000,20000,10000,5000,2000,1000,500,200].forEach(n => {
    const btn = document.createElement('button'); btn.className = 'nominal-btn'; btn.textContent = 'Rp '+n.toLocaleString('id');
    btn.onclick = () => { document.getElementById('bayar').value = (parseInt(document.getElementById('bayar').value)||0) + n; hitungKembalian(); };
    nominalDiv.appendChild(btn);
  });

  document.getElementById('scanInputTrans').onkeydown = e => {
    if (e.key==='Enter') { e.preventDefault(); const b = e.target.value.trim(); if (b) { e.target.value=''; tambahProdukDariScan(b); } }
  };

  // === BUAT ELEMEN RINGKASAN SUBTOTAL & DISKON (sekali saja) ===
  const cartTable = document.getElementById('cartTable');
  if (cartTable && !document.getElementById('cartSummaryContainer')) {
    const container = document.createElement('div');
    container.id = 'cartSummaryContainer';
    container.style.cssText = 'margin-top:10px; font-size:14px;';
    container.innerHTML = `
      <div style="margin-bottom:5px; display:flex; justify-content:space-between;">
        <span>SUBTOTAL</span>
        <span id="subtotalCart" style="font-weight:bold;">0</span>
      </div>
      <div style="margin-bottom:5px; display:flex; justify-content:space-between; align-items:center;">
        <span>DISKON</span>
        <input type="number" id="diskonTotalInput" min="0" max="99000000" value="0" style="width:100px; text-align:right;" placeholder="0">
        <span style="margin-left:5px;">rupiah</span>
      </div>
      <div style="display:flex; justify-content:space-between; font-size:16px; font-weight:bold;">
        <span>TOTAL</span>
        <span id="totalCart">0</span>
      </div>
    `;
    cartTable.parentNode.insertBefore(container, cartTable.nextSibling);

    // Event listener untuk input diskon
    document.getElementById('diskonTotalInput').addEventListener('input', function(e) {
      let val = parseInt(this.value) || 0;
      const max = 99000000;
      if (val > max) val = max;
      // Dapatkan subtotal saat ini
      const subtotal = cart.reduce((sum, item) => sum + (item.harga * item.qty) - (item.diskon || 0), 0);
      if (val > subtotal) val = subtotal;
      this.value = val;
      totalDiskon = val;
      hitungTotalDanKembalian();
    });
  }
}

// ... (fungsi tambahProdukDariScan, searchProductFn, dsb tidak berubah) ...

// ========== FUNGSI DISKON ITEM ==========
function editDiskonItem(index) {
  const item = cart[index];
  const diskon = prompt(`Diskon untuk ${item.nama} (Rp ${item.harga.toLocaleString('id')})\nMasukkan nilai diskon (akhiri dengan % untuk persen, atau angka untuk nominal):`, item.diskon || '0');
  if (diskon === null) return;
  let nilai = 0;
  if (diskon.endsWith('%')) {
    const persen = parseFloat(diskon);
    if (isNaN(persen)) return alert('Persentase tidak valid');
    nilai = Math.round((persen / 100) * item.harga * item.qty);
  } else {
    nilai = parseInt(diskon) || 0;
  }
  item.diskon = Math.max(0, Math.min(nilai, item.harga * item.qty));
  renderCart();
}

function renderCart() {
  const tbody = document.querySelector('#cartTable tbody');
  tbody.innerHTML = '';
  let subtotal = 0;
  cart.forEach((item, idx) => {
    const sub = item.harga * item.qty;
    const diskon = item.diskon || 0;
    const netto = sub - diskon;
    subtotal += netto;
    const row = tbody.insertRow();
    row.innerHTML = `
      <td>${item.nama}</td>
      <td>Rp${item.harga.toLocaleString('id')}</td>
      <td>
        <div class="qty-control">
          <button onclick="changeQty(${idx},-1)">−</button>
          <input type="number" min="1" value="${item.qty}" onchange="updateQty(${idx},this.value)" style="width:50px">
          <button onclick="changeQty(${idx},1)">+</button>
        </div>
      </td>
      <td>
        Rp${sub.toLocaleString('id')}
        ${diskon > 0 ? `<br><small style="color:#e53935;">Diskon: -Rp${diskon.toLocaleString('id')}</small>` : ''}
      </td>
      <td>
        <button class="btn-sm" onclick="editDiskonItem(${idx})" title="Diskon">💲</button>
        <button class="btn-sm" onclick="lihatDetailProduk('${item.barcode}')">ℹ️</button>
        <button class="btn-sm btn-danger" onclick="hapusCartItem(${idx})">✕</button>
      </td>
    `;
  });

  // === UPDATE ELEMEN RINGKASAN ===
  const subtotalEl = document.getElementById('subtotalCart');
  const diskonInput = document.getElementById('diskonTotalInput');
  const totalEl = document.getElementById('totalCart');

  if (subtotalEl) subtotalEl.textContent = 'Rp' + subtotal.toLocaleString('id');

  if (diskonInput) {
    // Batasi diskon tidak melebihi subtotal atau 99000000
    const maxAllowed = Math.min(subtotal, 99000000);
    if (totalDiskon > maxAllowed) totalDiskon = maxAllowed;
    diskonInput.value = totalDiskon;
    // Update max attribute agar sesuai subtotal (opsional)
    diskonInput.max = maxAllowed;
  }

  if (totalEl) {
    const totalAkhir = Math.max(0, subtotal - totalDiskon);
    totalEl.textContent = 'Rp' + totalAkhir.toLocaleString('id');
  }

  hitungKembalian();
}

function hitungTotalDanKembalian() {
  const subtotal = cart.reduce((sum, item) => sum + (item.harga * item.qty) - (item.diskon || 0), 0);
  const totalEl = document.getElementById('totalCart');
  if (totalEl) {
    const total = Math.max(0, subtotal - totalDiskon);
    totalEl.textContent = 'Rp' + total.toLocaleString('id');
  }
  hitungKembalian();
}

// ... (changeQty, updateQty, hapusCartItem, hitungKembalian tidak berubah) ...

function bayarDanCetak() {
  // ... (fungsi tidak berubah, totalDiskon sudah global) ...
}

// ... (fungsi lihatDetailProduk tidak berubah) ...