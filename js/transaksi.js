// ===================== TRANSAKSI.JS (Dengan Fitur Diskon) =====================
let cart = [];
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

// ========== FUNGSI DISKON ==========
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
  item.diskon = Math.max(0, Math.min(nilai, item.harga * item.qty)); // diskon tidak boleh melebihi subtotal
  renderCart();
}

let totalDiskon = 0; // diskon total dalam rupiah

function setDiskonTotal() {
  const input = prompt('Masukkan diskon total (akhiri dengan % untuk persen, atau angka untuk nominal):', totalDiskon || '0');
  if (input === null) return;
  const subtotal = cart.reduce((sum, item) => sum + (item.harga * item.qty) - (item.diskon || 0), 0);
  let nilai = 0;
  if (input.endsWith('%')) {
    const persen = parseFloat(input);
    if (isNaN(persen)) return alert('Persentase tidak valid');
    nilai = Math.round((persen / 100) * subtotal);
  } else {
    nilai = parseInt(input) || 0;
  }
  totalDiskon = Math.max(0, Math.min(nilai, subtotal));
  renderCart();
}

function renderCart() {
  const tbody = document.querySelector('#cartTable tbody'); tbody.innerHTML = '';
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

  // Tampilkan total setelah diskon item
  let totalSetelahDiskon = subtotal - totalDiskon;
  document.getElementById('totalCart').textContent = Math.max(0, totalSetelahDiskon).toLocaleString('id');

  // Tambahkan baris diskon total di tabel (opsional, bisa juga di bawah total)
  const diskonRow = tbody.insertRow();
  diskonRow.innerHTML = `
    <td colspan="4" style="text-align:right; font-weight:bold;">Diskon Total:
      <button class="btn-sm" onclick="setDiskonTotal()">💲</button>
      ${totalDiskon > 0 ? ` -Rp${totalDiskon.toLocaleString('id')}` : ''}
    </td>
    <td></td>
  `;

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
  const total = parseInt(document.getElementById('totalCart').textContent.replace(/\D/g,''));
  const bayar = parseInt(document.getElementById('bayar').value)||0;
  if (bayar < total) { alert('Kurang'); return; }
  const kembali = bayar - total;
  const now = new Date();
  const no = `INV-${now.toISOString().slice(0,10).replace(/-/g,'')}-${now.toTimeString().slice(0,8).replace(/:/g,'')}`;
  // items dengan diskon
  const items = cart.map(i => ({
    barcode: i.barcode, nama: i.nama, harga: i.harga, qty: i.qty,
    subtotal: i.harga * i.qty, diskon: i.diskon || 0, netto: (i.harga * i.qty) - (i.diskon || 0)
  }));
  const trx = { no_invoice: no, tanggal: now.toISOString(), customer: cust, items, total, bayar, kembali, totalDiskon };
  try {
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
    let tinggiHeader = 28; if (toko.logo) tinggiHeader = 40;
    const tinggiItem = cart.length*5;
    const tinggiTotalBayar = 15;
    const tinggiFooter = toko.footer?12:0;
    const marginBawah = 15;
    const tinggiTotal = tinggiHeader + tinggiItem + tinggiTotalBayar + tinggiFooter + marginBawah;

    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ unit:'mm', format:[lebarKertas, tinggiTotal] });
    let y = 8;
    if (toko.logo) {
      try { const fmt = toko.logo.startsWith('data:image/png')?'PNG':'JPEG'; doc.addImage(toko.logo, fmt, marginKiri, 5, 14, 14); y = 22; } catch(e) {}
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
    doc.text('Total:', xItem, y); doc.text('Rp'+total.toLocaleString('id'), xSubtotal, y, { align:'right' }); y+=5;
    if (totalDiskon) {
      doc.setFontSize(7);
      doc.text('Diskon Total: -Rp'+totalDiskon.toLocaleString('id'), xItem+5, y-5);
      doc.setFontSize(8);
    }
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

    if (bluetoothDevice && bluetoothCharacteristic) {
      const teksStruk = buatStrukTeks(cart, total, bayar, kembali, toko, no, cust, totalDiskon);
      await cetakStrukKePrinter(toko.logo || null, teksStruk);
    } else {
      const blobUrl = URL.createObjectURL(pdfBlob);
      const a = document.createElement('a'); a.href = blobUrl; a.target = '_blank'; a.style.display = 'none';
      document.body.appendChild(a); a.click(); document.body.removeChild(a);
      setTimeout(() => { const pw = window.open(blobUrl, '_blank'); if (pw) pw.addEventListener('load', () => pw.print(), { once: true }); }, 500);
    }

    cart = []; totalDiskon = 0; renderCart();
    document.getElementById('bayar').value = '0'; document.getElementById('custName').value = ''; hitungKembalian();
    alert(`✅ Berhasil!\nNo: ${no}\nTotal: Rp${total.toLocaleString('id')}\nKembali: Rp${kembali.toLocaleString('id')}`);
  } catch (e) { alert('❌ Gagal: '+e.message); }
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