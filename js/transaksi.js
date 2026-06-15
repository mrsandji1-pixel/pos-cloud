// ===================== TRANSAKSI.JS (Dengan Fitur Diskon Baru) =====================
let cart = [];
let diskon1Percent = 0;   // diskon dalam persen
let diskon2Nominal = 0;   // diskon dalam rupiah
let searchTimer = null;

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
}

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
    cart.push({ barcode: product.barcode, nama: product.nama, harga: product.harga_jual||0, qty: 1, stok: product.stok||0, diskon: 0 });
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

// ========== FUNGSI DISKON PER ITEM (tetap) ==========
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

// ========== DISKON GLOBAL BARU ==========
function updateDiskon1Percent(val) {
  diskon1Percent = parseFloat(val) || 0;
  if (diskon1Percent < 0) diskon1Percent = 0;
  if (diskon1Percent > 100) diskon1Percent = 100;
  renderCart();
}

function updateDiskon2Nominal(val) {
  diskon2Nominal = parseInt(val) || 0;
  if (diskon2Nominal < 0) diskon2Nominal = 0;
  // batasan akan diterapkan di renderCart agar total >= 0
  renderCart();
}

// ========== RENDER CART DENGAN SUBTOTAL & DUA DISKON ==========
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

  // --- SUBTOTAL ---
  const subRow = tbody.insertRow();
  subRow.innerHTML = `<td colspan="4" style="text-align:right; font-weight:bold;">SUBTOTAL</td>
                      <td style="font-weight:bold;">Rp${subtotal.toLocaleString('id')}</td>`;

  // --- DISKON 1 (%) ---
  const diskon1Amount = Math.round(subtotal * diskon1Percent / 100);
  const diskon1Row = tbody.insertRow();
  diskon1Row.innerHTML = `<td colspan="3" style="text-align:right;">Diskon 1 (%)</td>
    <td>
      <input type="number" id="diskon1PercentInput" min="0" max="100" value="${diskon1Percent}" 
             style="width:60px;" oninput="updateDiskon1Percent(this.value)"> %
    </td>
    <td>Rp${diskon1Amount.toLocaleString('id')}</td>`;

  // --- DISKON 2 (Rp) ---
  // Batasi diskon2Nominal agar total tidak negatif
  const maxDiskon2 = Math.max(0, subtotal - diskon1Amount);
  if (diskon2Nominal > maxDiskon2) diskon2Nominal = maxDiskon2;
  const diskon2Row = tbody.insertRow();
  diskon2Row.innerHTML = `<td colspan="3" style="text-align:right;">Diskon 2 (Rp)</td>
    <td>
      Rp <input type="number" id="diskon2NominalInput" min="0" value="${diskon2Nominal}" 
             style="width:80px;" oninput="updateDiskon2Nominal(this.value)">
    </td>
    <td></td>`;

  // --- TOTAL ---
  const totalSetelahDiskon = subtotal - diskon1Amount - diskon2Nominal;
  const totalRow = tbody.insertRow();
  totalRow.innerHTML = `<td colspan="4" style="text-align:right; font-weight:bold;">TOTAL</td>
                        <td style="font-weight:bold;" id="totalCartCell">Rp${totalSetelahDiskon.toLocaleString('id')}</td>`;

  // update span totalCart (jika digunakan di tempat lain)
  const totalSpan = document.getElementById('totalCart');
  if (totalSpan) totalSpan.textContent = totalSetelahDiskon.toLocaleString('id');

  hitungKembalian();
}

function changeQty(i,d) { let q = cart[i].qty + d; if (q<1) q=1; if (q>cart[i].stok) { alert('Stok tidak cukup'); q=cart[i].stok; } cart[i].qty = q; renderCart(); }
function updateQty(i,q) { q = parseInt(q)||1; if (q>cart[i].stok) { alert('Stok tidak cukup'); q=cart[i].stok; } cart[i].qty = q; renderCart(); }
function hapusCartItem(i) { cart.splice(i,1); renderCart(); }

function hitungKembalian() {
  const t = parseInt(document.getElementById('totalCart').textContent.replace(/\D/g,''))||0;
  const b = parseInt(document.getElementById('bayar').value)||0;
  document.getElementById('kembalian').textContent = Math.max(0,b-t).toLocaleString('id');
}

async function bayarDanCetak() {
  if (!cart.length) { alert('Kosong'); return; }
  const cust = document.getElementById('custName').value.trim();

  // Hitung ulang subtotal & total dari state diskon saat ini
  const subtotal = cart.reduce((sum, i) => sum + (i.harga * i.qty - (i.diskon||0)), 0);
  const diskon1Amount = Math.round(subtotal * diskon1Percent / 100);
  const maxDiskon2 = Math.max(0, subtotal - diskon1Amount);
  if (diskon2Nominal > maxDiskon2) diskon2Nominal = maxDiskon2;
  const totalSetelahDiskon = subtotal - diskon1Amount - diskon2Nominal;

  const bayar = parseInt(document.getElementById('bayar').value)||0;
  if (bayar < totalSetelahDiskon) { alert('Uang kurang'); return; }
  const kembali = bayar - totalSetelahDiskon;

  const now = new Date();
  const no = `INV-${now.toISOString().slice(0,10).replace(/-/g,'')}-${now.toTimeString().slice(0,8).replace(/:/g,'')}`;

  const items = cart.map(i => ({
    barcode: i.barcode, nama: i.nama, harga: i.harga, qty: i.qty,
    subtotal: i.harga * i.qty, diskon: i.diskon || 0, netto: (i.harga * i.qty) - (i.diskon || 0)
  }));

  const trx = {
    no_invoice: no,
    tanggal: now.toISOString(),
    customer: cust,
    items,
    subtotal,
    diskon1_percent: diskon1Percent,
    diskon1_amount: diskon1Amount,
    diskon2_amount: diskon2Nominal,
    total: totalSetelahDiskon,
    totalDiskon: diskon1Amount + diskon2Nominal, // total diskon global
    bayar,
    kembali
  };

  try {
    // Update stok
    for (let i of cart) {
      const { data: prod } = await supabaseClient.from('products').select('stok').eq('barcode', i.barcode).single();
      if (prod) {
        await supabaseClient.from('products').update({ stok: Math.max(0, prod.stok - i.qty) }).eq('barcode', i.barcode);
      }
    }
    await insertTransaction(trx);

    const toko = await getSettings();
    const lebarKertas = parseInt(toko.kertas_lebar)||80;
    const marginKiri = 3, marginKanan = 3;
    const areaCetak = lebarKertas - marginKiri - marginKanan;
    const xItem = marginKiri, xQty = lebarKertas*0.4, xHarga = lebarKertas*0.65, xSubtotal = lebarKertas-marginKanan;

    // Hitung tinggi dinamis
    let tinggiHeader = 28; if (toko.logo) tinggiHeader = 40;
    let barisDiskon = 0;
    if (diskon1Amount > 0) barisDiskon++;
    if (diskon2Nominal > 0) barisDiskon++;
    const tinggiItem = cart.length * 5;
    const tinggiTotalBayar = 15 + (barisDiskon * 5);
    const tinggiFooter = toko.footer ? 12 : 0;
    const marginBawah = 15;
    const tinggiTotal = tinggiHeader + tinggiItem + tinggiTotalBayar + tinggiFooter + marginBawah;

    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ unit:'mm', format:[lebarKertas, tinggiTotal] });
    let y = 8;
    if (toko.logo) {
      try { doc.addImage(toko.logo, 'PNG', marginKiri, 5, 14, 14); y = 22; } catch(e) {}
    }
    doc.setFontSize(9); doc.text(toko.nama||'TOKO', marginKiri, y);
    doc.setFontSize(7); y+=5;
    doc.text(toko.alamat||'', marginKiri, y); y+=5;
    doc.text('No: '+no, marginKiri, y); y+=5;
    doc.text('Tanggal: '+now.toLocaleString('id-ID'), marginKiri, y); y+=5;
    doc.text('Customer: '+(cust||'-'), marginKiri, y); y+=8;

    doc.text('Item', xItem, y); doc.text('Qty', xQty, y, { align:'center' }); doc.text('Harga', xHarga, y, { align:'right' }); doc.text('Subtotal', xSubtotal, y, { align:'right' });
    y+=4; doc.line(marginKiri, y, xSubtotal, y); y+=3;
    cart.forEach(i => {
      const sub = i.harga * i.qty;
      doc.text(i.nama, xItem, y, { maxWidth: xQty-xItem-2 });
      doc.text(i.qty.toString(), xQty, y, { align:'center' });
      doc.text('Rp'+i.harga.toLocaleString('id'), xHarga, y, { align:'right' });
      doc.text('Rp'+(sub - (i.diskon||0)).toLocaleString('id'), xSubtotal, y, { align:'right' });
      if (i.diskon) {
        y += 4;
        doc.setFontSize(6);
        doc.text(`  Diskon: -Rp${i.diskon.toLocaleString('id')}`, xItem+5, y);
        doc.setFontSize(7);
      }
      y+=5;
    });
    doc.line(marginKiri, y, xSubtotal, y); y+=4;

    // Subtotal
    doc.setFontSize(8);
    doc.text('Subtotal:', xItem, y); doc.text('Rp'+subtotal.toLocaleString('id'), xSubtotal, y, { align:'right' }); y+=5;

    // Diskon 1
    if (diskon1Amount > 0) {
      doc.setFontSize(7);
      doc.text(`Diskon 1 (${diskon1Percent}%): -Rp${diskon1Amount.toLocaleString('id')}`, xItem+5, y);
      y+=5;
    }

    // Diskon 2
    if (diskon2Nominal > 0) {
      doc.setFontSize(7);
      doc.text(`Diskon 2: -Rp${diskon2Nominal.toLocaleString('id')}`, xItem+5, y);
      y+=5;
    }

    // Total, Bayar, Kembali
    doc.setFontSize(8);
    doc.text('Total:', xItem, y); doc.text('Rp'+totalSetelahDiskon.toLocaleString('id'), xSubtotal, y, { align:'right' }); y+=5;
    doc.text('Bayar:', xItem, y); doc.text('Rp'+bayar.toLocaleString('id'), xSubtotal, y, { align:'right' }); y+=5;
    doc.text('Kembali:', xItem, y); doc.text('Rp'+kembali.toLocaleString('id'), xSubtotal, y, { align:'right' }); y+=5;

    if (toko.footer) {
      doc.setFontSize(7);
      doc.text(toko.footer, lebarKertas/2, y, { align:'center', maxWidth:areaCetak });
      y+=8;
    }

    const pdfBlob = doc.output('blob');
    await uploadInvoicePDF(no, pdfBlob);
    if (workingDirHandle) {
      try { const fh = await workingDirHandle.getFileHandle(no+'.pdf',{create:true}); const w = await fh.createWritable(); await w.write(pdfBlob); await w.close(); } catch(e) {}
    }

    // Cetak / tampilkan
    if (bluetoothDevice && bluetoothCharacteristic) {
      // Update panggil buatStrukTeks dengan parameter baru (pastikan fungsi tsb disesuaikan)
      const teksStruk = buatStrukTeks(cart, subtotal, diskon1Percent, diskon1Amount, diskon2Nominal, totalSetelahDiskon, bayar, kembali, toko, no, cust);
      await cetakStrukKePrinter(toko.logo || null, teksStruk);
    } else {
      const blobUrl = URL.createObjectURL(pdfBlob);
      const a = document.createElement('a'); a.href = blobUrl; a.target = '_blank'; a.style.display = 'none';
      document.body.appendChild(a); a.click(); document.body.removeChild(a);
      setTimeout(() => { const pw = window.open(blobUrl, '_blank'); if (pw) pw.addEventListener('load', () => pw.print(), { once: true }); }, 500);
    }

    // Reset
    cart = [];
    diskon1Percent = 0;
    diskon2Nominal = 0;
    renderCart();
    document.getElementById('bayar').value = '0';
    document.getElementById('custName').value = '';
    hitungKembalian();
    alert(`✅ Berhasil!\nNo: ${no}\nTotal: Rp${totalSetelahDiskon.toLocaleString('id')}\nKembali: Rp${kembali.toLocaleString('id')}`);
  } catch (e) {
    alert('❌ Gagal: '+e.message);
  }
}

function lihatDetailProduk(barcode) {
  (async () => {
    const p = await getProductByBarcode(barcode); if (!p) return alert('Produk tidak ditemukan');
    document.getElementById('detailNama').textContent = p.nama||'';
    document.getElementById('detailBarcode').textContent = p.barcode||'';
    document.getElementById('detailKategori').textContent = p.kategori||'-';
    document.getElementById('detailKeterangan').textContent = p.keterangan||'-';
    document.getElementById('detailHargaJual').textContent = 'Rp'+(p.harga_jual||0).toLocaleString('id');
    document.getElementById('detailStok').textContent = p.stok||0;
    const img = document.getElementById('detailFoto');
    if (p.foto) { img.src = p.foto; img.style.display = 'block'; } else img.style.display = 'none';
    document.getElementById('productDetailModal').style.display = 'flex';
  })();
}