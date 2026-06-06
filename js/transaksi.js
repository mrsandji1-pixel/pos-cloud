// ===================== FILE: js/transaksi.js =====================
let cart = [];

function setupTransaksi() {
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
        tambahProdukKeCart(b);
      }
    }
  };
}

async function tambahProdukKeCart(barcode) {
  let p = await getProductByBarcode(barcode);
  if (!p) {
    const clean = barcode.replace(/[^a-zA-Z0-9\-_]/g, '');
    if (clean !== barcode) p = await getProductByBarcode(clean);
  }
  if (!p) {
    const all = await getAllProducts();
    p = all.find(x => x.barcode.includes(barcode) || barcode.includes(x.barcode) || x.nama.toLowerCase().includes(barcode.toLowerCase()));
  }
  if (!p) { alert('Produk tidak ditemukan'); return; }
  if (p.stok <= 0) { alert('Stok habis'); return; }
  const ex = cart.find(i => i.barcode === p.barcode);
  if (ex) {
    if (ex.qty < p.stok) ex.qty++;
    else { alert('Stok tidak cukup'); return; }
  } else {
    cart.push({ barcode: p.barcode, nama: p.nama, harga: p.harga_jual || 0, qty: 1, stok: p.stok || 0 });
  }
  renderCart();
}

async function searchProductFn(query) {
  const div = document.getElementById('searchResults');
  if (!query || query.length < 1) { div.style.display = 'none'; return; }
  const all = await getAllProducts();
  const q = query.toLowerCase();
  const filtered = all.filter(p => (p.nama || '').toLowerCase().includes(q) || (p.barcode || '').toLowerCase().includes(q) || (p.kategori || '').toLowerCase().includes(q)).slice(0, 10);
  if (!filtered.length) {
    div.innerHTML = '<div class="search-item">Tidak ditemukan</div>';
    div.style.display = 'block';
    return;
  }
  div.innerHTML = filtered.map(p => `<div class="search-item" data-barcode="${p.barcode}">${p.foto ? `<img src="${p.foto}" class="search-item-img">` : '<div class="search-item-img" style="background:#e0e0e0;display:flex;align-items:center;justify-content:center;">📦</div>'}<div><strong>${p.nama}</strong><br><small>${p.barcode} | Stok:${p.stok} | Rp${(p.harga_jual || 0).toLocaleString('id')}</small></div></div>`).join('');
  div.style.display = 'block';
  div.querySelectorAll('.search-item[data-barcode]').forEach(i => {
    i.onclick = () => {
      div.style.display = 'none';
      document.getElementById('searchProduct').value = '';
      tambahProdukKeCart(i.dataset.barcode);
    };
  });
}

document.addEventListener('click', e => {
  const s = document.getElementById('searchProduct'), r = document.getElementById('searchResults');
  if (e.target !== s && !r.contains(e.target)) r.style.display = 'none';
});

function renderCart() {
  const tbody = document.querySelector('#cartTable tbody');
  tbody.innerHTML = '';
  let total = 0;
  cart.forEach((item, idx) => {
    const sub = item.harga * item.qty;
    total += sub;
    const row = tbody.insertRow();
    row.innerHTML = `<td>${item.nama}</td><td>Rp${item.harga.toLocaleString('id')}</td><td><div class="qty-control"><button onclick="changeQty(${idx},-1)">−</button><input type="number" min="1" value="${item.qty}" onchange="updateQty(${idx},this.value)" style="width:50px"><button onclick="changeQty(${idx},1)">+</button></div></td><td>Rp${sub.toLocaleString('id')}</td><td><button class="btn-sm" onclick="lihatDetailProduk('${item.barcode}')">ℹ️</button> <button class="btn-sm btn-danger" onclick="hapusCartItem(${idx})">✕</button></td>`;
  });
  document.getElementById('totalCart').textContent = total.toLocaleString('id');
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
  const t = parseInt(document.getElementById('totalCart').textContent.replace(/\D/g, '')) || 0;
  const b = parseInt(document.getElementById('bayar').value) || 0;
  document.getElementById('kembalian').textContent = Math.max(0, b - t).toLocaleString('id');
}

async function bayarDanCetak() {
  if (!cart.length) { alert('Kosong'); return; }
  const cust = document.getElementById('custName').value.trim();
  const total = parseInt(document.getElementById('totalCart').textContent.replace(/\D/g, ''));
  const bayar = parseInt(document.getElementById('bayar').value) || 0;
  if (bayar < total) { alert('Kurang'); return; }
  const kembali = bayar - total;
  const now = new Date();
  const no = `INV-${now.toISOString().slice(0, 10).replace(/-/g, '')}-${now.toTimeString().slice(0, 8).replace(/:/g, '')}`;
  const trx = { no_invoice: no, tanggal: now.toISOString(), customer: cust, items: cart.map(i => ({ barcode: i.barcode, nama: i.nama, harga: i.harga, qty: i.qty, subtotal: i.harga * i.qty })), total, bayar, kembali };
  try {
    // Kurangi stok
    for (let i of cart) {
      const { data: prod } = await supabaseClient.from('products').select('stok').eq('barcode', i.barcode).single();
      if (prod) {
        await supabaseClient.from('products').update({ stok: Math.max(0, prod.stok - i.qty) }).eq('barcode', i.barcode);
      }
    }
    await insertTransaction(trx);

    const toko = await getSettings();
    const lebarKertas = parseInt(toko.kertas_lebar) || 80;

    // PDF fallback
    const { jsPDF } = window.jspdf;
    const marginKiri = 3, marginKanan = 3;
    const areaCetak = lebarKertas - marginKiri - marginKanan;
    const xItem = marginKiri, xQty = lebarKertas * 0.4, xHarga = lebarKertas * 0.65, xSubtotal = lebarKertas - marginKanan;
    let tinggiHeader = 28; if (toko.logo) tinggiHeader = 40;
    const tinggiItem = cart.length * 5;
    const tinggiTotalBayar = 15;
    const tinggiFooter = toko.footer ? 12 : 0;
    const marginBawah = 15;
    const tinggiTotal = tinggiHeader + tinggiItem + tinggiTotalBayar + tinggiFooter + marginBawah;

    const doc = new jsPDF({ unit: 'mm', format: [lebarKertas, tinggiTotal] });
    let y = 8;
    if (toko.logo) {
      try {
        const fmt = toko.logo.startsWith('data:image/png') ? 'PNG' : 'JPEG';
        doc.addImage(toko.logo, fmt, marginKiri, 5, 14, 14);
        y = 22;
      } catch (e) { }
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
      doc.text(i.nama, xItem, y, { maxWidth: xQty - xItem - 2 });
      doc.text(i.qty.toString(), xQty, y, { align: 'center' });
      doc.text('Rp' + i.harga.toLocaleString('id'), xHarga, y, { align: 'right' });
      doc.text('Rp' + (i.harga * i.qty).toLocaleString('id'), xSubtotal, y, { align: 'right' });
      y += 5;
    });
    doc.line(marginKiri, y, xSubtotal, y); y += 4;
    doc.text('Total:', xItem, y); doc.text('Rp' + total.toLocaleString('id'), xSubtotal, y, { align: 'right' }); y += 5;
    doc.text('Bayar:', xItem, y); doc.text('Rp' + bayar.toLocaleString('id'), xSubtotal, y, { align: 'right' }); y += 5;
    doc.text('Kembali:', xItem, y); doc.text('Rp' + kembali.toLocaleString('id'), xSubtotal, y, { align: 'right' }); y += 5;
    if (toko.footer) {
      doc.setFontSize(7);
      doc.text(toko.footer, lebarKertas / 2, y, { align: 'center', maxWidth: areaCetak });
      y += 8;
    }
    const pdfBlob = doc.output('blob');
    await uploadInvoicePDF(no, pdfBlob);
    if (workingDirHandle) {
      try {
        const fh = await workingDirHandle.getFileHandle(no + '.pdf', { create: true });
        const w = await fh.createWritable(); await w.write(pdfBlob); await w.close();
      } catch (e) { }
    }

    // Pencetakan
    if (bluetoothDevice && bluetoothCharacteristic) {
      const teksStruk = buatStrukTeks(cart, total, bayar, kembali, toko, no, cust);
      await cetakTeksKePrinter(teksStruk);
    } else {
      const url = URL.createObjectURL(pdfBlob);
      const pw = window.open(url, '_blank');
      if (pw) pw.addEventListener('load', () => pw.print(), { once: true });
    }

    cart = []; renderCart();
    document.getElementById('bayar').value = '0'; document.getElementById('custName').value = ''; hitungKembalian();
    alert(`✅ Berhasil!\nNo: ${no}\nTotal: Rp${total.toLocaleString('id')}\nKembali: Rp${kembali.toLocaleString('id')}`);
  } catch (e) { alert('❌ Gagal: ' + e.message); }
}