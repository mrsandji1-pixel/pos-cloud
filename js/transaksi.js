// ===================== TRANSAKSI.JS (Diskon Manual + Setting) =====================
let cart = [];
let searchTimer = null;
let appSettings = {}; // cache pengaturan dari getSettings()

async function setupTransaksi() {
  // Ambil pengaturan terbaru
  try {
    appSettings = await getSettings();
  } catch (e) {
    console.warn('Gagal ambil settings, gunakan default:', e);
    appSettings = { diskon_item_enabled: true, diskon_total_enabled: true };
  }

  // Hapus totalCart statis jika ada
  const oldTotal = document.getElementById('totalCart');
  if (oldTotal) oldTotal.remove();

  // Tombol nominal cepat
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

  renderCart(); // render pertama kali
}

// --- Pencarian & Tambah Produk ---
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

function searchProductFn(query) {
  clearTimeout(searchTimer);
  const div = document.getElementById('searchResults');
  if (!query || query.length < 2) { div.style.display = 'none'; return; }
  searchTimer = setTimeout(async () => {
    const q = query.trim();
    const { data, error } = await supabaseClient
      .from('products')
      .select('*')
      .or(`nama.ilike.%${q}%,barcode.ilike.%${q}%,kategori.ilike.%${q}%`)
      .order('nama')
      .limit(15);
    if (error) { console.error(error); div.innerHTML = '<div class="search-item">Gagal mencari</div>'; div.style.display = 'block'; return; }
    if (!data || data.length === 0) { div.innerHTML = '<div class="search-item">Tidak ditemukan</div>'; div.style.display = 'block'; return; }
    div.innerHTML = data.map(p => `
      <div class="search-item" data-barcode="${p.barcode}">
        ${p.foto ? `<img src="${p.foto}" class="search-item-img">` : '<div class="search-item-img" style="background:#e0e0e0;display:flex;align-items:center;justify-content:center;">📦</div>'}
        <div><strong>${p.nama}</strong><br><small>${p.barcode} | Stok:${p.stok} | Rp${(p.harga_jual||0).toLocaleString('id')}</small></div>
      </div>
    `).join('');
    div.style.display = 'block';
    div.querySelectorAll('.search-item[data-barcode]').forEach(item => {
      item.onclick = () => { div.style.display = 'none'; document.getElementById('searchProduct').value = ''; tambahProdukKeCart(item.dataset.barcode); };
    });
  }, 300);
}

document.addEventListener('click', e => {
  const s = document.getElementById('searchProduct'), r = document.getElementById('searchResults');
  if (e.target !== s && !r.contains(e.target)) r.style.display = 'none';
});
function tambahProdukKeCart(barcode) { tambahProdukDariScan(barcode); }

// --- Diskon Per Item (hanya jika fitur aktif) ---
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

// --- Render Cart dengan Field Diskon Manual (jika fitur total diskon aktif) ---
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

  // Container diskon total (hanya jika fitur aktif)
  let container = document.getElementById('diskonContainer');
  if (appSettings.diskon_total_enabled) {
    if (!container) {
      container = document.createElement('div');
      container.id = 'diskonContainer';
      const cartTable = document.getElementById('cartTable');
      cartTable.parentNode.insertBefore(container, cartTable.nextSibling);
    }
    container.innerHTML = `
      <div style="margin-top:12px; text-align:right; font-size:14px;">
        <strong>SUBTOTAL: Rp<span id="subtotalDisplay">${subtotalItemNetto.toLocaleString('id')}</span></strong><br>
        <div style="margin-top:4px;">
          Diskon: 
          <input type="number" id="inputDiskon" min="0" max="99999999" step="1" value="${parseInt(document.getElementById('inputDiskon')?.value) || 0}"
                 style="width:130px; text-align:right;" 
                 oninput="updateTotalDariDiskon()" 
                 onkeypress="return event.charCode >= 48 && event.charCode <= 57" 
                 placeholder="0"> rupiah
        </div>
        <div style="margin-top:6px; font-size:16px; font-weight:bold;">
          TOTAL: Rp<span id="totalCart">0</span>
        </div>
      </div>
    `;
  } else {
    // Jika diskon total tidak aktif, hapus container dan tampilkan total sederhana
    if (container) container.remove();
    // Pastikan ada elemen totalCart
    let totalEl = document.getElementById('totalCart');
    if (!totalEl) {
      totalEl = document.createElement('div');
      totalEl.id = 'totalCart';
      totalEl.style.textAlign = 'right';
      totalEl.style.fontSize = '16px';
      totalEl.style.fontWeight = 'bold';
      totalEl.style.marginTop = '8px';
      document.getElementById('cartTable').parentNode.appendChild(totalEl);
    }
    totalEl.textContent = subtotalItemNetto.toLocaleString('id');
  }

  updateTotalDariDiskon();
}

function updateTotalDariDiskon() {
  const subtotal = cart.reduce((sum, item) => sum + (item.harga * item.qty) - (item.diskon || 0), 0);
  if (appSettings.diskon_total_enabled) {
    const diskonInput = document.getElementById('inputDiskon');
    if (!diskonInput) return;

    let diskon = parseInt(diskonInput.value) || 0;
    if (diskon > 99999999) {
      diskon = 99999999;
      diskonInput.value = diskon;
    }
    if (diskon > subtotal) {
      diskon = subtotal;
      diskonInput.value = diskon;
    }
    const total = Math.max(0, subtotal - diskon);
    const totalEl = document.getElementById('totalCart');
    if (totalEl) totalEl.textContent = total.toLocaleString('id');
  } else {
    // tanpa diskon total, total = subtotal
    const totalEl = document.getElementById('totalCart');
    if (totalEl) totalEl.textContent = subtotal.toLocaleString('id');
  }
  hitungKembalian();
}

// --- Qty & Hapus ---
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
  const totalTeks = document.getElementById('totalCart')?.textContent || '0';
  const t = parseInt(totalTeks.replace(/\D/g, '')) || 0;
  const b = parseInt(document.getElementById('bayar').value) || 0;
  document.getElementById('kembalian').textContent = Math.max(0, b - t).toLocaleString('id');
}

// --- Bayar & Cetak ---
async function bayarDanCetak() {
  if (!cart.length) { alert('Keranjang kosong'); return; }
  const cust = document.getElementById('custName').value.trim();
  const totalEl = document.getElementById('totalCart');
  if (!totalEl) return alert('Total tidak ditemukan');
  const total = parseInt(totalEl.textContent.replace(/\D/g, '')) || 0;
  const bayar = parseInt(document.getElementById('bayar').value) || 0;
  if (bayar < total) { alert('Pembayaran kurang'); return; }
  const kembali = bayar - total;
  const now = new Date();
  const no = `INV-${now.toISOString().slice(0,10).replace(/-/g,'')}-${now.toTimeString().slice(0,8).replace(/:/g,'')}`;

  // Ambil diskon total dari field (jika fitur aktif), jika tidak 0
  let totalDiskon = 0;
  if (appSettings.diskon_total_enabled) {
    totalDiskon = parseInt(document.getElementById('inputDiskon')?.value) || 0;
  }

  const items = cart.map(i => ({
    barcode: i.barcode,
    nama: i.nama,
    harga: i.harga,
    qty: i.qty,
    subtotal: i.harga * i.qty,
    diskon: i.diskon || 0,
    netto: (i.harga * i.qty) - (i.diskon || 0)
  }));

  // Siapkan objek transaksi
  const trx = {
    no_invoice: no,
    tanggal: now.toISOString(),
    customer: cust,
    items,
    total,
    bayar,
    kembali
  };

  // Hanya tambahkan totalDiskon jika kolom ada (dengan pengecekan aman)
  try {
    // Cek apakah kolom totalDiskon ada di tabel transactions
    const { data: colCheck, error: colError } = await supabaseClient
      .from('transactions')
      .select('totalDiskon')
      .limit(1);
    if (!colError) {
      trx.totalDiskon = totalDiskon;
    }
  } catch (e) {
    // Kolom mungkin tidak ada, abaikan
  }

  try {
    // Update stok
    for (let i of cart) {
      const { data: prod } = await supabaseClient.from('products').select('stok').eq('barcode', i.barcode).single();
      if (prod) {
        await supabaseClient.from('products').update({ stok: Math.max(0, prod.stok - i.qty) }).eq('barcode', i.barcode);
      }
    }

    await insertTransaction(trx);

    // ----- Cetak Struk -----
    const toko = await getSettings();
    const lebarKertas = parseInt(toko.kertas_lebar) || 80;
    const marginKiri = 3, marginKanan = 3;
    const areaCetak = lebarKertas - marginKiri - marginKanan;
    const xItem = marginKiri, xQty = lebarKertas * 0.4, xHarga = lebarKertas * 0.65, xSubtotal = lebarKertas - marginKanan;
    let tinggiHeader = 28; if (toko.logo) tinggiHeader = 40;
    const tinggiItem = cart.length * 5;
    const tinggiTotalBayar = 15;
    const tinggiFooter = toko.footer ? 12 : 0;
    const marginBawah = 15;
    const tinggiTotal = tinggiHeader + tinggiItem + tinggiTotalBayar + tinggiFooter + marginBawah;

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
        doc.text(`  Diskon: -Rp${i.diskon.toLocaleString('id')}`, xItem + 5, y);
        doc.setFontSize(7);
      }
      y += 5;
    });
    doc.line(marginKiri, y, xSubtotal, y); y += 4;
    if (totalDiskon > 0) {
      doc.setFontSize(7);
      doc.text(`Diskon: -Rp${totalDiskon.toLocaleString('id')}`, xItem + 5, y - 2);
      doc.setFontSize(9);
    }
    doc.text('Total:', xItem, y); doc.text('Rp' + total.toLocaleString('id'), xSubtotal, y, { align: 'right' }); y += 5;
    doc.text('Bayar:', xItem, y); doc.text('Rp' + bayar.toLocaleString('id'), xSubtotal, y, { align: 'right' }); y += 5;
    doc.text('Kembali:', xItem, y); doc.text('Rp' + kembali.toLocaleString('id'), xSubtotal, y, { align: 'right' }); y += 5;
    if (toko.footer) {
      doc.setFontSize(7);
      doc.text(toko.footer, lebarKertas / 2, y, { align: 'center', maxWidth: areaCetak });
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

    if (bluetoothDevice && bluetoothCharacteristic) {
      const teksStruk = buatStrukTeks(cart, total, bayar, kembali, toko, no, cust, totalDiskon);
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
    if (appSettings.diskon_total_enabled) {
      document.getElementById('inputDiskon').value = '0';
    }
    renderCart();
    document.getElementById('bayar').value = '0';
    document.getElementById('custName').value = '';
    hitungKembalian();

    alert(`✅ Berhasil!\nNo: ${no}\nTotal: Rp${total.toLocaleString('id')}\nKembali: Rp${kembali.toLocaleString('id')}`);
  } catch (e) {
    alert('❌ Gagal: ' + e.message);
  }
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