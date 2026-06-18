// ===================== TRANSAKSI.JS (Final - Struk Rapi) =====================
let cart = [];
let searchTimer = null;
let appSettings = {};
let isAdmin = false;
let totalDiskonValue = 0;
let bayarValue = 0;

async function setupTransaksi() {
  isAdmin = (currentUser && currentUser.role === 'admin');

  try {
    appSettings = await getSettings();
  } catch (e) {
    console.warn('Gagal ambil settings, gunakan default:', e);
    appSettings = { diskon_item_enabled: true, diskon_total_enabled: true };
  }

  // Hapus elemen statis yang tidak diperlukan
  const staticTotalBox = document.querySelector('#page-transaksi .total-box');
  if (staticTotalBox) staticTotalBox.remove();
  document.querySelectorAll('#totalCart').forEach(el => el.remove());

  // Sembunyikan area pembayaran lama dan kembalian lama
  const oldPembayaranGroup = document.getElementById('pembayaranGroup');
  if (oldPembayaranGroup) oldPembayaranGroup.style.display = 'none';
  const oldKembalian = document.querySelector('#page-transaksi #kembalian');
  if (oldKembalian && oldKembalian.parentElement) {
    oldKembalian.parentElement.style.display = 'none';
  }
  const oldNominal = document.getElementById('nominalButtons');
  if (oldNominal) oldNominal.remove();

  // Buat container ringkasan di bawah cartTable
  let summaryContainer = document.getElementById('summaryContainer');
  if (!summaryContainer) {
    summaryContainer = document.createElement('div');
    summaryContainer.id = 'summaryContainer';
    summaryContainer.style.cssText = 'background: #f0f4f8; padding: 12px; border-radius: 8px; margin-top: 8px;';
    const cartTable = document.getElementById('cartTable');
    cartTable.parentNode.insertBefore(summaryContainer, cartTable.nextSibling);
  }
  summaryContainer.innerHTML = `
    <div id="diskonContainer"></div>
    <div id="pembayaranSummary" style="display:flex; justify-content:space-between; align-items:center; margin-top:8px; border-top:1px solid #d0d8e0; padding-top:8px;">
      <div>
        <strong style="font-size:16px;">PEMBAYARAN:</strong>
        <button class="btn btn-tunai" id="btnTunai" onclick="bukaPopupTunai()">TUNAI</button>
      </div>
      <div style="text-align:right;">
        <div style="font-weight:bold;">BAYAR: Rp <span id="bayarDisplay">0</span></div>
        <div style="font-weight:bold;">Kembalian: Rp <span id="kembalianDisplay">0</span></div>
      </div>
    </div>
  `;

  bayarValue = 0;
  updateBayarDisplay();

  document.getElementById('scanInputTrans').onkeydown = e => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const b = e.target.value.trim();
      if (b) {
        e.target.value = '';
        tambahProdukDariScan(b);
      }
    }
  };

  const searchInput = document.getElementById('searchProduct');
  if (searchInput) {
    searchInput.oninput = function() {
      searchProductFn(this.value);
    };
  }

  totalDiskonValue = 0;
  renderCart();
}

function updateBayarDisplay() {
  const display = document.getElementById('bayarDisplay');
  if (display) display.textContent = bayarValue.toLocaleString('id');
  hitungKembalian();
}

// ========== POP-UP TUNAI ==========
function bukaPopupTunai() { /* ... tidak berubah ... */ }
function tambahNominalPopup(nominal) { /* ... */ }

// ========== PENCARIAN & TAMBAH PRODUK ==========
function searchProductFn(query) { /* ... tidak berubah ... */ }
document.addEventListener('click', e => { /* ... */ });
async function tambahProdukDariScan(barcode) { /* ... */ }
function tambahProdukKeCart(barcode) { tambahProdukDariScan(barcode); }

// ========== DISKON PER ITEM ==========
function editDiskonItem(index) { /* ... tidak berubah ... */ }

// ========== POP-UP DISKON TOTAL ==========
function bukaPopupDiskonTotal() { /* ... tidak berubah ... */ }

// ========== RENDER CART (dengan box ringkasan) ==========
function renderCart() {
  const tbody = document.querySelector('#cartTable tbody');
  tbody.innerHTML = '';

  let subtotalItemNetto = 0;
  cart.forEach((item, idx) => {
    const sub = item.harga * item.qty;
    const diskon = item.diskon || 0;
    const netto = sub - diskon;
    subtotalItemNetto += netto;

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
        ${(isAdmin && appSettings.diskon_item_enabled !== false) ? `<button class="btn-sm" onclick="editDiskonItem(${idx})" title="Diskon">💲</button>` : ''}
        <button class="btn-sm" onclick="lihatDetailProduk('${item.barcode}')">ℹ️</button>
        <button class="btn-sm btn-danger" onclick="hapusCartItem(${idx})">✕</button>
      </td>
    `;
  });

  const diskonContainer = document.getElementById('diskonContainer');
  if (!diskonContainer) return;

  if (totalDiskonValue > subtotalItemNetto) totalDiskonValue = subtotalItemNetto;
  const total = subtotalItemNetto - totalDiskonValue;

  if (isAdmin && appSettings.diskon_total_enabled !== false) {
    diskonContainer.innerHTML = `
      <div style="text-align:right; font-size:14px;">
        <div><strong>SUBTOTAL: Rp<span id="subtotal1Display">${subtotalItemNetto.toLocaleString('id')}</span></strong></div>
        <div style="display:flex; justify-content:space-between; align-items:center; margin-top:6px;">
          <button class="btn-sm" style="background:#ff9800; color:white; border:none; font-weight:bold;" onclick="bukaPopupDiskonTotal()">💲 Diskon Lagi</button>
          ${totalDiskonValue > 0 ? `<span style="color:#e53935; font-weight:bold;">-Rp${totalDiskonValue.toLocaleString('id')}</span>` : '<span></span>'}
        </div>
        <div style="margin-top:6px; font-size:16px; font-weight:bold;">
          TOTAL: Rp<span id="totalCart">${total.toLocaleString('id')}</span>
        </div>
      </div>
    `;
  } else {
    diskonContainer.innerHTML = `
      <div style="text-align:right; font-size:16px; font-weight:bold;">
        TOTAL: Rp<span id="totalCart">${subtotalItemNetto.toLocaleString('id')}</span>
      </div>
    `;
  }

  hitungKembalian();
}

function changeQty(i, d) { /* ... */ }
function updateQty(i, q) { /* ... */ }
function hapusCartItem(i) { cart.splice(i, 1); renderCart(); }

function hitungKembalian() {
  const totalTeks = document.getElementById('totalCart')?.textContent || '0';
  const t = parseInt(totalTeks.replace(/\D/g, '')) || 0;
  const kembali = Math.max(0, bayarValue - t);
  const el = document.getElementById('kembalianDisplay');
  if (el) el.textContent = kembali.toLocaleString('id');
}

// ========== BAYAR & CETAK ==========
async function bayarDanCetak() {
  if (!cart.length) { alert('Keranjang kosong'); return; }
  const cust = document.getElementById('custName').value.trim();

  const subtotal1 = cart.reduce((sum, item) => sum + (item.harga * item.qty) - (item.diskon || 0), 0);
  const grandTotal = subtotal1 - totalDiskonValue;

  const totalEl = document.getElementById('totalCart');
  if (!totalEl) return alert('Total tidak ditemukan');
  if (parseInt(totalEl.textContent.replace(/\D/g, '')) !== grandTotal) totalEl.textContent = grandTotal.toLocaleString('id');

  if (bayarValue < grandTotal) { alert('Pembayaran kurang'); return; }
  const kembali = bayarValue - grandTotal;
  const now = new Date();
  const no = `INV-${now.toISOString().slice(0,10).replace(/-/g,'')}-${now.toTimeString().slice(0,8).replace(/:/g,'')}`;

  const items = cart.map(i => ({
    barcode: i.barcode, nama: i.nama, harga: i.harga, qty: i.qty,
    subtotal: i.harga * i.qty, diskon: i.diskon || 0, netto: (i.harga * i.qty) - (i.diskon || 0)
  }));

  const trx = {
    no_invoice: no, tanggal: now.toISOString(), customer: cust, items,
    total: grandTotal, bayar: bayarValue, kembali
  };
  try {
    const { data: colCheck, error: colError } = await supabaseClient.from('transactions').select('totalDiskon').limit(1);
    if (!colError) trx.totalDiskon = totalDiskonValue;
  } catch (e) {}

  try {
    for (let i of cart) {
      const { data: prod } = await supabaseClient.from('products').select('stok').eq('barcode', i.barcode).single();
      if (prod) {
        await supabaseClient.from('products').update({ stok: Math.max(0, prod.stok - i.qty) }).eq('barcode', i.barcode);
      }
    }
    await insertTransaction(trx);

    const toko = await getSettings();
    // === PDF (tidak berubah) ===
    // ... (potongan kode PDF sama seperti sebelumnya) ...

    if (bluetoothDevice && bluetoothCharacteristic) {
      const teksStruk = buatStrukTeks(cart, subtotal1, totalDiskonValue, grandTotal, bayarValue, kembali, toko, no, cust);
      await cetakStrukKePrinter(toko.logo || null, teksStruk);
    } else {
      // fallback ke PDF
    }

    // Reset
    cart = [];
    totalDiskonValue = 0;
    bayarValue = 0;
    updateBayarDisplay();
    renderCart();
    document.getElementById('custName').value = '';
    hitungKembalian();
    alert(`✅ Berhasil!\nNo: ${no}\nTotal: Rp${grandTotal.toLocaleString('id')}\nKembali: Rp${kembali.toLocaleString('id')}`);
  } catch (e) {
    alert('❌ Gagal: ' + e.message);
  }
}

// ================== STRUK TEKS (DIPERBAIKI) ==================
function buatStrukTeks(cart, subtotal1, totalDiskon, grandTotal, bayar, kembali, toko, no, cust) {
  const lebarKertas = parseInt(toko.kertas_lebar) || 80;
  const is80mm = lebarKertas === 80;
  const charWidth = is80mm ? 48 : 32;       // karakter per baris (dapat disesuaikan dengan printer)
  const lebarItem = is80mm ? 20 : 12;
  const lebarQty = is80mm ? 4 : 3;
  const lebarHarga = is80mm ? 10 : 8;
  const lebarSubtotal = is80mm ? 11 : 8;

  // Fungsi bantu
  function padRight(text, length) {
    if (text.length > length) return text.substring(0, length);
    return text + ' '.repeat(length - text.length);
  }
  function padLeft(text, length) {
    if (text.length > length) return text.substring(0, length);
    return ' '.repeat(length - text.length) + text;
  }

  let teks = '';
  teks += (toko.nama || 'TOKO') + '\n';
  if (toko.alamat) teks += toko.alamat + '\n';
  teks += 'No: ' + no + '\n';
  teks += 'Tanggal: ' + new Date().toLocaleString('id-ID') + '\n';
  teks += 'Customer: ' + (cust || '-') + '\n';
  teks += '-'.repeat(charWidth) + '\n';

  // Header
  const header = padRight('Item', lebarItem) + padLeft('Qty', lebarQty) + padLeft('Harga', lebarHarga) + padLeft('Subtotal', lebarSubtotal);
  teks += header + '\n';
  teks += '-'.repeat(charWidth) + '\n';

  cart.forEach(i => {
    const sub = i.harga * i.qty;
    const netto = sub - (i.diskon || 0);
    const hargaStr = 'Rp' + i.harga.toLocaleString('id');
    const nettoStr = 'Rp' + netto.toLocaleString('id');
    const qtyStr = i.qty.toString();

    // Pecah nama jika terlalu panjang
    let nama = i.nama || '';
    const parts = [];
    while (nama.length > lebarItem) {
      parts.push(nama.substring(0, lebarItem));
      nama = nama.substring(lebarItem);
    }
    parts.push(nama); // sisa

    // Baris pertama: nama + qty + harga + subtotal
    teks += padRight(parts[0], lebarItem) + padLeft(qtyStr, lebarQty) + padLeft(hargaStr, lebarHarga) + padLeft(nettoStr, lebarSubtotal) + '\n';
    // Baris sisa (hanya nama, indent)
    for (let p = 1; p < parts.length; p++) {
      teks += padRight(parts[p], lebarItem) + '\n';
    }

    if (i.diskon) {
      teks += '  Diskon item: -Rp' + i.diskon.toLocaleString('id') + '\n';
    }
  });

  teks += '-'.repeat(charWidth) + '\n';
  teks += 'Subtotal:'.padEnd(25) + 'Rp' + subtotal1.toLocaleString('id') + '\n';
  if (totalDiskon > 0) {
    teks += 'Diskon:'.padEnd(25) + '-Rp' + totalDiskon.toLocaleString('id') + '\n';
  }
  teks += 'TOTAL:'.padEnd(25) + 'Rp' + grandTotal.toLocaleString('id') + '\n';
  teks += 'Bayar:'.padEnd(25) + 'Rp' + bayar.toLocaleString('id') + '\n';
  teks += 'Kembali:'.padEnd(25) + 'Rp' + kembali.toLocaleString('id') + '\n';
  if (toko.footer) {
    teks += '\n' + toko.footer + '\n';
  }
  teks += '='.repeat(charWidth) + '\n';
  return teks;
}

function lihatDetailProduk(barcode) { /* ... tidak berubah ... */ }