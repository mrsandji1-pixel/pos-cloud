// ===================== TRANSAKSI.JS (Lengkap: Pencarian, Diskon, Struk Rinci) =====================
let cart = [];
let searchTimer = null;
let appSettings = {};

async function setupTransaksi() {
  try {
    appSettings = await getSettings();
  } catch (e) {
    console.warn('Gagal ambil settings, gunakan default:', e);
    appSettings = { diskon_item_enabled: true, diskon_total_enabled: true };
  }

  // Hapus semua totalCart statis
  document.querySelectorAll('#totalCart').forEach(el => el.remove());

  // Nominal cepat
  const nominalDiv = document.getElementById('nominalButtons');
  nominalDiv.innerHTML = '';
  [100000, 50000, 20000, 10000, 5000, 2000, 1000, 500, 200].forEach(n => {
    const btn = document.createElement('button');
    btn.className = 'nominal-btn';
    btn.textContent = 'Rp ' + n.toLocaleString('id');
    btn.onclick = () => {
      document.getElementById('bayar').value = (parseInt(document.getElementById('bayar').value) || 0) + n;
      hitungKembalian();
    };
    nominalDiv.appendChild(btn);
  });

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
    searchInput.oninput = () => searchProductFn(searchInput.value);
  }

  renderCart();
}

// ========== PENCARIAN PRODUK (BERFUNGSI PENUH) ==========
function searchProductFn(query) {
  clearTimeout(searchTimer);
  const div = document.getElementById('searchResults');
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
          ${p.foto ? `<img src="${p.foto}" class="search-item-img">` : '<div class="search-item-img" style="background:#e0e0e0;display:flex;align-items:center;justify-content:center;">📦</div>'}
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
      div.innerHTML = '<div class="search-item">Terjadi kesalahan</div>';
      div.style.display = 'block';
    }
  }, 300);
}

document.addEventListener('click', e => {
  const s = document.getElementById('searchProduct');
  const r = document.getElementById('searchResults');
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
  if (!appSettings.diskon_item_enabled) {
    alert('Fitur diskon per item tidak diaktifkan.');
    return;
  }
  const item = cart[index];
  const diskon = prompt(
    `Diskon untuk ${item.nama} (Rp ${item.harga.toLocaleString('id')})\nMasukkan nilai diskon (akhiri dengan % untuk persen, atau angka untuk nominal):`,
    item.diskon || '0'
  );
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

// ========== RENDER KERANJANG + DISKON TOTAL ==========
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
        ${appSettings.diskon_item_enabled ? `<button class="btn-sm" onclick="editDiskonItem(${idx})" title="Diskon">💲</button>` : ''}
        <button class="btn-sm" onclick="lihatDetailProduk('${item.barcode}')">ℹ️</button>
        <button class="btn-sm btn-danger" onclick="hapusCartItem(${idx})">✕</button>
      </td>
    `;
  });

  let container = document.getElementById('diskonContainer');
  if (!container) {
    container = document.createElement('div');
    container.id = 'diskonContainer';
    const cartTable = document.getElementById('cartTable');
    cartTable.parentNode.insertBefore(container, cartTable.nextSibling);
  }

  if (appSettings.diskon_total_enabled) {
    container.innerHTML = `
      <div style="margin-top:12px; text-align:right; font-size:14px;">
        <div><strong>SUBTOTAL: Rp<span id="subtotal1Display">${subtotalItemNetto.toLocaleString('id')}</span></strong></div>
        <div style="margin-top:4px;">
          Diskon: 
          <input type="number" id="inputDiskon" min="0" max="99999999" step="1" value="${parseInt(document.getElementById('inputDiskon')?.value) || 0}"
                 style="width:130px; text-align:right;" 
                 oninput="updateTotalDariDiskon()" 
                 onkeypress="return event.charCode >= 48 && event.charCode <= 57" 
                 placeholder="0"> rupiah
        </div>
        <div style="margin-top:6px; font-size:16px; font-weight:bold;" id="totalContainer">
          TOTAL: Rp<span id="totalCart">0</span>
        </div>
      </div>
    `;
  } else {
    container.innerHTML = `
      <div style="margin-top:12px; text-align:right; font-size:16px; font-weight:bold;">
        TOTAL: Rp<span id="totalCart">${subtotalItemNetto.toLocaleString('id')}</span>
      </div>
    `;
  }

  updateTotalDariDiskon();
}

function updateTotalDariDiskon() {
  const subtotal1 = cart.reduce((sum, item) => sum + (item.harga * item.qty) - (item.diskon || 0), 0);
  const totalEl = document.getElementById('totalCart');
  if (appSettings.diskon_total_enabled) {
    const diskonInput = document.getElementById('inputDiskon');
    if (!diskonInput) return;
    let diskon = parseInt(diskonInput.value) || 0;
    if (diskon > 99999999) { diskon = 99999999; diskonInput.value = diskon; }
    if (diskon > subtotal1) { diskon = subtotal1; diskonInput.value = diskon; }
    const total = Math.max(0, subtotal1 - diskon);
    if (totalEl) totalEl.textContent = total.toLocaleString('id');
  } else {
    if (totalEl) totalEl.textContent = subtotal1.toLocaleString('id');
  }
  hitungKembalian();
}

function changeQty(i, d) {
  let q = cart[i].qty + d;
  if (q < 1) q = 1;
  if (q > cart[i].stok) { alert('Stok tidak cukup'); q = cart[i].stok; }
  cart[i].qty = q;
  renderCart();
}
function updateQty(i, q) {
  q = parseInt(q) || 1;
  if (q > cart[i].stok) { alert('Stok tidak cukup'); q = cart[i].stok; }
  cart[i].qty = q;
  renderCart();
}
function hapusCartItem(i) { cart.splice(i, 1); renderCart(); }

function hitungKembalian() {
  const t = parseInt(document.getElementById('totalCart')?.textContent.replace(/\D/g, '') || 0);
  const b = parseInt(document.getElementById('bayar').value) || 0;
  document.getElementById('kembalian').textContent = Math.max(0, b - t).toLocaleString('id');
}

// ========== BAYAR & CETAK ==========
async function bayarDanCetak() {
  if (!cart.length) { alert('Keranjang kosong'); return; }
  const cust = document.getElementById('custName').value.trim();

  const subtotal1 = cart.reduce((sum, item) => sum + (item.harga * item.qty) - (item.diskon || 0), 0);
  let totalDiskon = 0;
  if (appSettings.diskon_total_enabled) {
    totalDiskon = parseInt(document.getElementById('inputDiskon')?.value) || 0;
    if (totalDiskon > subtotal1) totalDiskon = subtotal1;
  }
  const grandTotal = subtotal1 - totalDiskon;

  const totalEl = document.getElementById('totalCart');
  if (!totalEl) return alert('Total tidak ditemukan');
  if (parseInt(totalEl.textContent.replace(/\D/g, '')) !== grandTotal) {
    totalEl.textContent = grandTotal.toLocaleString('id');
  }

  const bayar = parseInt(document.getElementById('bayar').value) || 0;
  if (bayar < grandTotal) { alert('Pembayaran kurang'); return; }
  const kembali = bayar - grandTotal;
  const now = new Date();
  const no = `INV-${now.toISOString().slice(0,10).replace(/-/g,'')}-${now.toTimeString().slice(0,8).replace(/:/g,'')}`;

  const items = cart.map(i => ({
    barcode: i.barcode, nama: i.nama, harga: i.harga, qty: i.qty,
    subtotal: i.harga * i.qty, diskon: i.diskon || 0,
    netto: (i.harga * i.qty) - (i.diskon || 0)
  }));

  const trx = {
    no_invoice: no,
    tanggal: now.toISOString(),
    customer: cust,
    items,
    total: grandTotal,
    bayar,
    kembali
  };
  try {
    const { error: colErr } = await supabaseClient.from('transactions').select('totalDiskon').limit(1);
    if (!colErr) trx.totalDiskon = totalDiskon;
  } catch (e) {}

  try {
    for (let i of cart) {
      const { data: prod } = await supabaseClient.from('products').select('stok').eq('barcode', i.barcode).single();
      if (prod) await supabaseClient.from('products').update({ stok: Math.max(0, prod.stok - i.qty) }).eq('barcode', i.barcode);
    }
    await insertTransaction(trx);

    const toko = await getSettings();
    const lebarKertas = parseInt(toko.kertas_lebar) || 80;
    const marginKiri = 3, marginKanan = 3;
    const xItem = marginKiri, xQty = lebarKertas * 0.4, xHarga = lebarKertas * 0.65, xSubtotal = lebarKertas - marginKanan;
    let tinggiHeader = 28; if (toko.logo) tinggiHeader = 40;
    const tinggiItem = cart.length * 5;
    const tinggiDiskonBaris = totalDiskon > 0 ? 5 : 0;
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
    if (totalDiskon > 0) {
      doc.text('Diskon:', xItem, y);
      doc.text('-Rp' + totalDiskon.toLocaleString('id'), xSubtotal, y, { align: 'right' });
      y += 5;
    }
    doc.setFontSize(9);
    doc.text('TOTAL:', xItem, y);
    doc.text('Rp' + grandTotal.toLocaleString('id'), xSubtotal, y, { align: 'right' });
    y += 6;
    doc.setFontSize(8);
    doc.text('Bayar:', xItem, y);
    doc.text('Rp' + bayar.toLocaleString('id'), xSubtotal, y, { align: 'right' });
    y += 5;
    doc.text('Kembali:', xItem, y);
    doc.text('Rp' + kembali.toLocaleString('id'), xSubtotal, y, { align: 'right' });
    y += 5;
    if (toko.footer) {
      doc.setFontSize(7);
      doc.text(toko.footer, lebarKertas / 2, y, { align: 'center' });
    }

    const pdfBlob = doc.output('blob');
    await uploadInvoicePDF(no, pdfBlob);
    if (workingDirHandle) {
      try {
        const fh = await workingDirHandle.getFileHandle(no + '.pdf', { create: true });
        const w = await fh.createWritable();
        await w.write(pdfBlob);
        await w.close();
      } catch (e) {}
    }

    // ========== STRUK BLUETOOTH (RINCIAN DISKON LENGKAP) ==========
    if (bluetoothDevice && bluetoothCharacteristic) {
      const teksStruk = buatStrukTeks(cart, subtotal1, totalDiskon, grandTotal, bayar, kembali, toko, no, cust);
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

    cart = [];
    if (appSettings.diskon_total_enabled) document.getElementById('inputDiskon').value = '0';
    renderCart();
    document.getElementById('bayar').value = '0';
    document.getElementById('custName').value = '';
    hitungKembalian();

    alert(`✅ Berhasil!\nNo: ${no}\nTotal: Rp${grandTotal.toLocaleString('id')}\nKembali: Rp${kembali.toLocaleString('id')}`);
  } catch (e) {
    alert('❌ Gagal: ' + e.message);
  }
}

// ========== FUNGSI STRUK TEKS UNTUK BLUETOOTH ==========
function buatStrukTeks(cart, subtotal1, totalDiskon, grandTotal, bayar, kembali, toko, no, cust) {
  const lebar = 32; // karakter per baris
  const garis = '='.repeat(lebar);
  const garisTipis = '-'.repeat(lebar);

  let teks = '';
  // Header
  teks += toko.nama.padStart((lebar + toko.nama.length) / 2) + '\n';
  if (toko.alamat) teks += toko.alamat.padStart((lebar + toko.alamat.length) / 2) + '\n';
  teks += 'No: ' + no + '\n';
  teks += 'Tgl : ' + new Date().toLocaleString('id-ID') + '\n';
  teks += 'Customer: ' + (cust || '-') + '\n';
  teks += garis + '\n';

  // Daftar item
  teks += 'Item'.padEnd(20) + 'Qty'.padStart(4) + 'Harga'.padStart(8) + '\n';
  teks += garisTipis + '\n';
  cart.forEach(i => {
    const sub = i.harga * i.qty;
    const netto = sub - (i.diskon || 0);
    let baris = i.nama.substring(0, 17).padEnd(18) +
               i.qty.toString().padStart(4) +
               i.harga.toLocaleString('id').padStart(8);
    teks += baris + '\n';
    if (i.diskon) {
      teks += '  Diskon item: -Rp' + i.diskon.toLocaleString('id') + '\n';
    }
  });
  teks += garisTipis + '\n';

  // Rincian total
  teks += 'Subtotal : Rp ' + subtotal1.toLocaleString('id').padStart(10) + '\n';
  if (totalDiskon > 0) {
    teks += 'Diskon   : -Rp ' + totalDiskon.toLocaleString('id').padStart(10) + '\n';
  }
  teks += garis + '\n';
  teks += 'TOTAL    : Rp ' + grandTotal.toLocaleString('id').padStart(10) + '\n';
  teks += 'Bayar    : Rp ' + bayar.toLocaleString('id').padStart(10) + '\n';
  teks += 'Kembali  : Rp ' + kembali.toLocaleString('id').padStart(10) + '\n';
  if (toko.footer) {
    teks += '\n' + toko.footer + '\n';
  }
  teks += garis + '\n';
  teks += 'Terima kasih\n';

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