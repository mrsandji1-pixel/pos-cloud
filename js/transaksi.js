// ===================== TRANSAKSI.JS (Final + Ringkasan 58mm) =====================
let cart = [];
let searchTimer = null;
let appSettings = {};
let isAdmin = false;
let totalDiskonValue = 0;
let bayarValue = 0;

// Cache settings untuk mempercepat loading
let cachedSettings = null;

async function setupTransaksi() {
  isAdmin = (currentUser && currentUser.role === 'admin');

  // Ambil pengaturan (gunakan cache jika ada)
  try {
    if (cachedSettings) {
      appSettings = cachedSettings;
    } else {
      appSettings = await getSettings();
      cachedSettings = appSettings; // simpan untuk pemakaian berikutnya
    }
  } catch (e) {
    console.warn('Gagal ambil settings, gunakan default:', e);
    appSettings = { diskon_item_enabled: true, diskon_total_enabled: true };
  }

  // Hapus elemen statis yang tidak diperlukan
  const staticTotalBox = document.querySelector('#page-transaksi .total-box');
  if (staticTotalBox) staticTotalBox.remove();
  document.querySelectorAll('#totalCart').forEach(el => el.remove());

  // Sembunyikan area pembayaran lama & kembalian lama
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
  }

  bayarValue = 0;
  updateBayarDisplay();

  // Event listener scan barcode
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

  // Event listener pencarian produk
  const searchInput = document.getElementById('searchProduct');
  if (searchInput) {
    searchInput.oninput = () => searchProductFn(searchInput.value);
    searchInput.onfocus = () => searchProductFn(searchInput.value);
  }

  totalDiskonValue = 0;
  renderCart(); // render awal (keranjang masih kosong)
}

function updateBayarDisplay() {
  const display = document.getElementById('bayarDisplay');
  if (display) display.textContent = bayarValue.toLocaleString('id');
  hitungKembalian();
}

// ========== POP-UP TUNAI ==========
function bukaPopupTunai() {
  const modal = document.createElement('div');
  modal.id = 'popupTunaiModal';
  modal.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.5);display:flex;align-items:center;justify-content:center;z-index:9999;';
  modal.innerHTML = `
    <div style="background:#fff;padding:20px;border-radius:8px;width:300px;text-align:center;">
      <h3>Pembayaran Tunai</h3>
      <div id="popupNominalGrid" style="display:grid; grid-template-columns:1fr 1fr 1fr; gap:8px; margin-bottom:12px;">
        ${[100000,50000,20000,10000,5000,2000,1000,500,200].map(n => 
          `<button class="nominal-btn-popup" onclick="tambahNominalPopup(${n})">Rp ${n.toLocaleString('id')}</button>`
        ).join('')}
      </div>
      <input type="number" id="inputBayarPopup" value="${bayarValue}" placeholder="0" style="width:100%;padding:8px;box-sizing:border-box;text-align:right;" onfocus="this.select()">
      <div style="margin-top:10px;">
        <button id="btnSimpanTunai" class="btn-sm">Simpan</button>
        <button id="btnBatalTunai" class="btn-sm btn-danger">Batal</button>
      </div>
    </div>
  `;
  document.body.appendChild(modal);

  document.getElementById('btnSimpanTunai').onclick = () => {
    const nilai = parseInt(document.getElementById('inputBayarPopup').value) || 0;
    if (nilai < 0) { alert('Nilai tidak boleh negatif'); return; }
    bayarValue = nilai;
    updateBayarDisplay();
    document.body.removeChild(modal);
  };

  document.getElementById('btnBatalTunai').onclick = () => {
    document.body.removeChild(modal);
  };

  setTimeout(() => document.getElementById('inputBayarPopup').focus(), 100);
}

function tambahNominalPopup(nominal) {
  const input = document.getElementById('inputBayarPopup');
  input.value = (parseInt(input.value) || 0) + nominal;
}

// ========== PENCARIAN PRODUK ==========
function searchProductFn(query) {
  clearTimeout(searchTimer);
  const div = document.getElementById('searchResults');
  if (!div) return;
  if (!query || query.length < 2) {
    div.style.display = 'none';
    return;
  }
  searchTimer = setTimeout(async () => {
    const q = query.trim();
    try {
      const { data, error } = await supabaseClient
        .from('products')
        .select('*')
        .or(`nama.ilike.%${q}%,barcode.ilike.%${q}%,kategori.ilike.%${q}%`)
        .order('nama')
        .limit(15);
      if (error) {
        console.error(error);
        div.innerHTML = '<div class="search-item">Gagal mencari</div>';
        div.style.display = 'block';
        return;
      }
      if (!data || data.length === 0) {
        div.innerHTML = '<div class="search-item">Tidak ditemukan</div>';
        div.style.display = 'block';
        return;
      }
      div.innerHTML = data.map(p => `
        <div class="search-item" data-barcode="${p.barcode}">
          ${p.foto ? `<img src="${p.foto}" class="search-item-img">` : '<div class="search-item-img" style="background:#e0e0e0;">📦</div>'}
          <div><strong>${p.nama}</strong><br><small>${p.barcode} | Stok:${p.stok} | Rp${(p.harga_jual||0).toLocaleString('id')}</small></div>
        </div>
      `).join('');
      div.style.display = 'block';
      div.querySelectorAll('.search-item[data-barcode]').forEach(item => {
        item.onclick = () => {
          div.style.display = 'none';
          document.getElementById('searchProduct').value = '';
          tambahProdukKeCart(item.dataset.barcode);
        };
      });
    } catch (err) {
      console.error(err);
      div.innerHTML = '<div class="search-item">Terjadi kesalahan</div>';
      div.style.display = 'block';
    }
  }, 300);
}

document.addEventListener('click', e => {
  const s = document.getElementById('searchProduct'), r = document.getElementById('searchResults');
  if (s && r && e.target !== s && !r.contains(e.target)) r.style.display = 'none';
});

// ========== TAMBAH PRODUK ==========
async function tambahProdukDariScan(barcode) {
  let clean = barcode.replace(/[^a-zA-Z0-9\-_]/g, '');
  if (!clean) return;
  let product = await getProductByBarcode(clean);
  if (!product) {
    const { data } = await supabaseClient.from('products').select('*').or(`barcode.ilike.%${clean}%,nama.ilike.%${clean}%`).limit(1);
    product = data?.[0] || null;
  }
  if (!product) { alert(`Produk "${clean}" tidak ditemukan.`); return; }
  if (product.stok <= 0) { alert(`Stok "${product.nama}" habis.`); return; }
  const existing = cart.find(i => i.barcode === product.barcode);
  if (existing) {
    if (existing.qty < product.stok) existing.qty++;
    else { alert('Stok tidak mencukupi'); return; }
  } else {
    cart.push({ barcode: product.barcode, nama: product.nama, harga: product.harga_jual || 0, qty: 1, stok: product.stok || 0, diskon: 0 });
  }
  renderCart();
}
function tambahProdukKeCart(barcode) { tambahProdukDariScan(barcode); }

// ========== DISKON PER ITEM ==========
function editDiskonItem(index) {
  if (!isAdmin) { alert('Hanya admin yang dapat mengubah diskon.'); return; }
  if (appSettings.diskon_item_enabled === false) { alert('Fitur diskon per item dinonaktifkan.'); return; }
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

// ========== POP-UP DISKON TOTAL ==========
function bukaPopupDiskonTotal() {
  if (!isAdmin) return;
  if (appSettings.diskon_total_enabled === false) {
    alert('Fitur diskon total dinonaktifkan oleh pengaturan.');
    return;
  }
  const modal = document.createElement('div');
  modal.id = 'popupDiskonModal';
  modal.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.5);display:flex;align-items:center;justify-content:center;z-index:9999;';
  modal.innerHTML = `
    <div style="background:#fff;padding:20px;border-radius:8px;width:300px;text-align:center;">
      <h3>Diskon Tambahan</h3>
      <input type="text" id="inputDiskonPopup" placeholder="Nominal atau persen (contoh: 5000 atau 10%)" style="width:100%;padding:8px;box-sizing:border-box;">
      <div style="margin-top:10px;">
        <button id="btnSimpanDiskon" class="btn-sm">Simpan</button>
        <button id="btnBatalDiskon" class="btn-sm btn-danger">Batal</button>
      </div>
    </div>
  `;
  document.body.appendChild(modal);

  document.getElementById('btnSimpanDiskon').onclick = () => {
    const input = document.getElementById('inputDiskonPopup').value.trim();
    let nilai = 0;
    if (input.endsWith('%')) {
      const persen = parseFloat(input);
      if (isNaN(persen)) { alert('Persentase tidak valid'); return; }
      const subtotal1 = cart.reduce((sum, item) => sum + (item.harga * item.qty) - (item.diskon || 0), 0);
      nilai = Math.round((persen / 100) * subtotal1);
    } else {
      nilai = parseInt(input) || 0;
    }
    if (nilai < 0) nilai = 0;
    totalDiskonValue = nilai;
    document.body.removeChild(modal);
    renderCart();
  };
  document.getElementById('btnBatalDiskon').onclick = () => document.body.removeChild(modal);
}

// ========== RENDER CART ==========
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

function changeQty(i, d) { let q = cart[i].qty + d; if (q < 1) q = 1; if (q > cart[i].stok) { alert('Stok tidak cukup'); q = cart[i].stok; } cart[i].qty = q; renderCart(); }
function updateQty(i, q) { q = parseInt(q) || 1; if (q > cart[i].stok) { alert('Stok tidak cukup'); q = cart[i].stok; } cart[i].qty = q; renderCart(); }
function hapusCartItem(i) { cart.splice(i, 1); renderCart(); }

function hitungKembalian() {
  const totalTeks = document.getElementById('totalCart')?.textContent || '0';
  const t = parseInt(totalTeks.replace(/\D/g, '')) || 0;
  const kembali = Math.max(0, bayarValue - t);
  const el = document.getElementById('kembalianDisplay');
  if (el) el.textContent = kembali.toLocaleString('id');
}

// ========== BAYAR & CETAK (DENGAN VALIDASI STOK) ==========
async function bayarDanCetak() {
  if (!cart.length) { alert('Keranjang kosong'); return; }
  const cust = document.getElementById('custName').value.trim();

  // 1. Cek ulang stok saat ini untuk setiap item, batalkan jika kurang
  for (let item of cart) {
    const { data: current } = await supabaseClient.from('products').select('stok').eq('barcode', item.barcode).single();
    if (!current || current.stok < item.qty) {
      alert(`Stok "${item.nama}" tidak mencukupi!\nTersedia: ${current?.stok || 0}\nDiminta: ${item.qty}\n\nSilakan kurangi atau hapus.`);
      return; // batalkan transaksi
    }
  }

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
    // 2. Kurangi stok setelah transaksi sukses
    for (let i of cart) {
      const { data: prod } = await supabaseClient.from('products').select('stok').eq('barcode', i.barcode).single();
      if (prod) {
        await supabaseClient.from('products').update({ stok: Math.max(0, prod.stok - i.qty) }).eq('barcode', i.barcode);
      }
    }
    await insertTransaction(trx);

    const toko = appSettings; // gunakan settings yang sudah dicache
    const lebarKertas = parseInt(toko.kertas_lebar) || 80;
    const marginKiri = 3, marginKanan = 3;
    const xItem = marginKiri, xQty = lebarKertas * 0.4, xHarga = lebarKertas * 0.65, xSubtotal = lebarKertas - marginKanan;
    let tinggiHeader = 28; if (toko.logo) tinggiHeader = 40;
    const tinggiItem = cart.length * 5;
    const tinggiDiskonBaris = totalDiskonValue > 0 ? 5 : 0;
    const tinggiTotalBayar = 20 + tinggiDiskonBaris;
    const tinggiFooter = toko.footer ? 12 : 0;
    const tinggiTotal = tinggiHeader + tinggiItem + tinggiTotalBayar + tinggiFooter + 15;

    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ unit: 'mm', format: [lebarKertas, tinggiTotal] });
    let y = 8;
    if (toko.logo) {
      try {
        const fmt = toko.logo.startsWith('data:image/png') ? 'PNG' : 'JPEG';
        doc.addImage(toko.logo, fmt, marginKiri, 5, 14, 14);
        y = 22;
      } catch (e) {}
    }
    doc.setFontSize(9); doc.text(toko.nama || 'TOKO', marginKiri, y);
    doc.setFontSize(7); y += 5;
    doc.text(toko.alamat || '', marginKiri, y); y += 5;
    doc.text('No: ' + no, marginKiri, y); y += 5;
    doc.text('Tanggal: ' + now.toLocaleString('id-ID'), marginKiri, y); y += 5;
    doc.text('Customer: ' + (cust || '-'), marginKiri, y); y += 8;

    doc.text('Item', xItem, y); doc.text('Qty', xQty, y, { align: 'center' }); doc.text('Harga', xHarga, y, { align: 'right' }); doc.text('Subtotal', xSubtotal, y, { align: 'right' });
    y += 4; doc.line(marginKiri, y, xSubtotal, y); y += 3;
    cart.forEach(i => {
      const sub = i.harga * i.qty;
      doc.text(i.nama, xItem, y, { maxWidth: xQty - xItem - 2 });
      doc.text(i.qty.toString(), xQty, y, { align: 'center' });
      doc.text('Rp' + i.harga.toLocaleString('id'), xHarga, y, { align: 'right' });
      doc.text('Rp' + (sub - (i.diskon || 0)).toLocaleString('id'), xSubtotal, y, { align: 'right' });
      if (i.diskon) {
        y += 4;
        doc.setFontSize(6);
        doc.text(`  Diskon item: -Rp${i.diskon.toLocaleString('id')}`, xItem + 5, y);
        doc.setFontSize(7);
      }
      y += 5;
    });
    doc.line(marginKiri, y, xSubtotal, y); y += 4;
    doc.text('Subtotal:', xItem, y);
    doc.text('Rp' + subtotal1.toLocaleString('id'), xSubtotal, y, { align: 'right' });
    y += 5;
    if (totalDiskonValue > 0) {
      doc.text('Diskon:', xItem, y);
      doc.text('-Rp' + totalDiskonValue.toLocaleString('id'), xSubtotal, y, { align: 'right' });
      y += 5;
    }
    doc.setFontSize(9);
    doc.text('TOTAL:', xItem, y);
    doc.text('Rp' + grandTotal.toLocaleString('id'), xSubtotal, y, { align: 'right' });
    y += 6;
    doc.setFontSize(8);
    doc.text('Bayar:', xItem, y); doc.text('Rp' + bayarValue.toLocaleString('id'), xSubtotal, y, { align: 'right' }); y += 5;
    doc.text('Kembali:', xItem, y); doc.text('Rp' + kembali.toLocaleString('id'), xSubtotal, y, { align: 'right' }); y += 5;
    if (toko.footer) {
      doc.setFontSize(7);
      doc.text(toko.footer, lebarKertas / 2, y, { align: 'center' });
    }

    const pdfBlob = doc.output('blob');
    await uploadInvoicePDF(no, pdfBlob);
    if (workingDirHandle) {
      try {
        const fh = await workingDirHandle.getFileHandle(no + '.pdf', { create: true });
        const w = await fh.createWritable(); await w.write(pdfBlob); await w.close();
      } catch (e) {}
    }

    if (bluetoothDevice && bluetoothCharacteristic) {
      const teksStruk = buatStrukTeks(cart, subtotal1, totalDiskonValue, grandTotal, bayarValue, kembali, toko, no, cust);
      await cetakStrukKePrinter(toko.logo || null, teksStruk);
    } else {
      const blobUrl = URL.createObjectURL(pdfBlob);
      const a = document.createElement('a'); a.href = blobUrl; a.target = '_blank'; a.style.display = 'none';
      document.body.appendChild(a); a.click(); document.body.removeChild(a);
      setTimeout(() => {
        const pw = window.open(blobUrl, '_blank');
        if (pw) pw.addEventListener('load', () => pw.print(), { once: true });
      }, 500);
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

// ========== STRUK TEKS (DIPERBAIKI UNTUK 58mm) ==========
function buatStrukTeks(cart, subtotal1, totalDiskon, grandTotal, bayar, kembali, toko, no, cust) {
  const lebarKertas = parseInt(toko.kertas_lebar) || 80;
  const is80mm = lebarKertas === 80;
  const charWidth = is80mm ? 48 : 32;
  const lebarItem = is80mm ? 20 : 12;
  const lebarQty = is80mm ? 4 : 3;
  const lebarHarga = is80mm ? 10 : 8;
  const lebarSubtotal = is80mm ? 11 : 8;

  function padRight(text, length) {
    if (text.length > length) return text.substring(0, length);
    return text + ' '.repeat(length - text.length);
  }
  function padLeft(text, length) {
    if (text.length > length) return text.substring(0, length);
    return ' '.repeat(length - text.length) + text;
  }
  // Fungsi bantu untuk baris ringkasan
  function formatSummary(label, value, isDiscount = false) {
    const labelMax = is80mm ? 16 : 10; // lebar maksimal label
    let lbl = label.substring(0, labelMax).padEnd(labelMax);
    let val = (isDiscount ? '-Rp' : 'Rp') + value.toLocaleString('id');
    // Geser 3 karakter ke kiri pada 58mm
    if (!is80mm) {
      lbl = label.substring(0, labelMax - 3).padEnd(labelMax - 3); // lebih pendek 3 char
    }
    const spaceAvailable = charWidth - lbl.length;
    if (val.length > spaceAvailable) {
      // Potong jika tidak muat (darurat)
      val = val.substring(0, spaceAvailable);
    }
    return lbl + val.padStart(spaceAvailable);
  }

  let teks = '';
  teks += (toko.nama || 'TOKO') + '\n';
  if (toko.alamat) teks += toko.alamat + '\n';
  teks += 'No: ' + no + '\n';
  teks += 'Tanggal: ' + new Date().toLocaleString('id-ID') + '\n';
  teks += 'Customer: ' + (cust || '-') + '\n';
  teks += '-'.repeat(charWidth) + '\n';

  const header = padRight('Item', lebarItem) + padLeft('Qty', lebarQty) + padLeft('Harga', lebarHarga) + padLeft('Subtotal', lebarSubtotal);
  teks += header + '\n';
  teks += '-'.repeat(charWidth) + '\n';

  cart.forEach(i => {
    const sub = i.harga * i.qty;
    const netto = sub - (i.diskon || 0);
    const hargaStr = 'Rp' + i.harga.toLocaleString('id');
    const nettoStr = 'Rp' + netto.toLocaleString('id');
    const qtyStr = i.qty.toString();

    let nama = i.nama || '';
    const parts = [];
    while (nama.length > lebarItem) {
      parts.push(nama.substring(0, lebarItem));
      nama = nama.substring(lebarItem);
    }
    parts.push(nama);

    teks += padRight(parts[0], lebarItem) + padLeft(qtyStr, lebarQty) + padLeft(hargaStr, lebarHarga) + padLeft(nettoStr, lebarSubtotal) + '\n';
    for (let p = 1; p < parts.length; p++) {
      teks += padRight(parts[p], lebarItem) + '\n';
    }
    if (i.diskon) {
      teks += '  Diskon item: -Rp' + i.diskon.toLocaleString('id') + '\n';
    }
  });

  teks += '-'.repeat(charWidth) + '\n';
  teks += formatSummary('Subtotal:', subtotal1) + '\n';
  if (totalDiskon > 0) {
    teks += formatSummary('Diskon:', totalDiskon, true) + '\n';
  }
  teks += formatSummary('TOTAL:', grandTotal) + '\n';
  teks += formatSummary('Bayar:', bayar) + '\n';
  teks += formatSummary('Kembali:', kembali) + '\n';
  if (toko.footer) {
    teks += '\n' + toko.footer + '\n';
  }
  teks += '='.repeat(charWidth) + '\n';
  return teks;
}

function lihatDetailProduk(barcode) {
  (async () => {
    const p = await getProductByBarcode(barcode);
    if (!p) return alert('Produk tidak ditemukan');
    document.getElementById('detailNama').textContent = p.nama || '';
    document.getElementById('detailBarcode').textContent = p.barcode || '';
    document.getElementById('detailKategori').textContent = p.kategori || '-';
    document.getElementById('detailKeterangan').textContent = p.keterangan || '-';
    document.getElementById('detailHargaJual').textContent = 'Rp' + (p.harga_jual || 0).toLocaleString('id');
    document.getElementById('detailStok').textContent = p.stok || 0;
    const img = document.getElementById('detailFoto');
    if (p.foto) { img.src = p.foto; img.style.display = 'block'; } else img.style.display = 'none';
    document.getElementById('productDetailModal').style.display = 'flex';
  })();
}

// Fungsi untuk dipanggil dari setting.js setelah simpan pengaturan
function invalidateSettingsCache() {
  cachedSettings = null;
}