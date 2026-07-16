// ===================== INVENTORY.JS (Cache + Kamera + Kompresi + Tombol Batal) =====================
let currentBarcode = null, fotoDihapus = false;
let capturedPhotoBase64 = null;
let allProductsCache = null; // cache produk

function setupInventory() {
  document.getElementById('prodBarcode').onkeydown = e => {
    if (e.key === 'Enter') { e.preventDefault(); cariAtauTambahProduk(); }
  };

  const fotoInput = document.getElementById('prodFoto');
  if (fotoInput) {
    const wrapper = document.createElement('div');
    wrapper.style.display = 'flex'; wrapper.style.gap = '8px'; wrapper.style.alignItems = 'center';
    fotoInput.parentNode.insertBefore(wrapper, fotoInput);
    wrapper.appendChild(fotoInput);

    const btnKamera = document.createElement('button');
    btnKamera.type = 'button'; btnKamera.className = 'btn btn-sm'; btnKamera.textContent = '📷 Ambil Foto';
    btnKamera.onclick = bukaKamera;
    wrapper.appendChild(btnKamera);
  }
}

// ========== MODAL KAMERA ==========
function bukaKamera() {
  const modal = document.createElement('div');
  modal.id = 'kameraModal';
  modal.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.8);display:flex;align-items:center;justify-content:center;z-index:9999;flex-direction:column;';
  modal.innerHTML = `
    <video id="kameraVideo" autoplay playsinline style="width:100%;max-width:400px;border-radius:8px;"></video>
    <div style="margin-top:12px;display:flex;gap:8px;">
      <button id="btnCapture" class="btn btn-sm">📸 Ambil Gambar</button>
      <button id="btnBatalKamera" class="btn btn-sm btn-danger">Batal</button>
    </div>
    <canvas id="kameraCanvas" style="display:none;"></canvas>
  `;
  document.body.appendChild(modal);

  const video = document.getElementById('kameraVideo');
  const canvas = document.getElementById('kameraCanvas');
  let stream;

  navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } })
    .then(s => { stream = s; video.srcObject = stream; })
    .catch(err => { alert('Gagal mengakses kamera: ' + err.message); document.body.removeChild(modal); });

  document.getElementById('btnCapture').onclick = () => {
    canvas.width = video.videoWidth; canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d'); ctx.drawImage(video, 0, 0);

    const maxSize = 800;
    let { width, height } = canvas;
    if (width > maxSize || height > maxSize) {
      const ratio = Math.min(maxSize / width, maxSize / height);
      width = Math.round(width * ratio); height = Math.round(height * ratio);
    }
    const resizeCanvas = document.createElement('canvas');
    resizeCanvas.width = width; resizeCanvas.height = height;
    const resizeCtx = resizeCanvas.getContext('2d');
    resizeCtx.drawImage(canvas, 0, 0, width, height);
    capturedPhotoBase64 = resizeCanvas.toDataURL('image/jpeg', 0.7);

    if (stream) stream.getTracks().forEach(track => track.stop());
    document.body.removeChild(modal);

    document.getElementById('fotoPreview').src = capturedPhotoBase64;
    document.getElementById('fotoPreviewContainer').style.display = 'block';
    fotoDihapus = false;
    document.getElementById('prodFoto').value = '';
  };

  document.getElementById('btnBatalKamera').onclick = () => {
    if (stream) stream.getTracks().forEach(track => track.stop());
    document.body.removeChild(modal);
  };
}

// ========== CARI / TAMBAH PRODUK ==========
async function cariAtauTambahProduk() {
  if (!currentUser) return;
  const barcode = document.getElementById('prodBarcode').value.trim(); if (!barcode) return;
  currentBarcode = barcode; document.getElementById('productForm').style.display = 'block';
  fotoDihapus = false; capturedPhotoBase64 = null;

  const product = await getProductByBarcode(barcode);
  const isAdmin = currentUser.role === 'admin';
  if (product) {
    isiFormProduk(product, false, isAdmin);
    if (product.foto) {
      document.getElementById('fotoPreview').src = product.foto;
      document.getElementById('fotoPreviewContainer').style.display = 'block';
    } else document.getElementById('fotoPreviewContainer').style.display = 'none';
  } else {
    if (!isAdmin) { alert('Produk tidak ditemukan'); tutupFormProduk(); return; }
    isiFormProduk({ barcode, nama: '', kategori: '', keterangan: '', harga_beli: 0, harga_jual: 0, stok: 0, foto: null }, true, true);
    document.getElementById('fotoPreviewContainer').style.display = 'none';
  }
  if (isAdmin) document.getElementById('prodNama').focus();
  else {
    ['prodNama','prodKategori','prodKeterangan','prodHargaBeli','prodHargaJual','perubahanStok'].forEach(id => document.getElementById(id).readOnly = true);
    document.getElementById('btnSimpanProduk').style.display = 'none';
    document.getElementById('btnHapusProduk').style.display = 'none';
    document.getElementById('btnHapusFoto').style.display = 'none';
    document.getElementById('prodFoto').disabled = true;
  }
}

function previewFoto() {
  if (!currentUser || currentUser.role !== 'admin') return;
  const f = document.getElementById('prodFoto').files[0];
  if (f) {
    const reader = new FileReader();
    reader.onload = e => { document.getElementById('fotoPreview').src = e.target.result; document.getElementById('fotoPreviewContainer').style.display = 'block'; };
    reader.readAsDataURL(f);
    fotoDihapus = false; capturedPhotoBase64 = null;
  }
}

function hapusFoto() {
  if (!currentUser || currentUser.role !== 'admin') return;
  document.getElementById('fotoPreview').src = ''; document.getElementById('fotoPreviewContainer').style.display = 'none';
  document.getElementById('prodFoto').value = ''; fotoDihapus = true; capturedPhotoBase64 = null;
}

function isiFormProduk(produk, isNew, isAdmin) {
  document.getElementById('formTitle').textContent = isAdmin ? (isNew ? 'Tambah Baru' : 'Update') : 'Detail';
  document.getElementById('prodNama').value = produk.nama || '';
  document.getElementById('prodKategori').value = produk.kategori || '';
  document.getElementById('prodKeterangan').value = produk.keterangan || '';
  document.getElementById('prodHargaBeli').value = produk.harga_beli || 0;
  document.getElementById('prodHargaJual').value = produk.harga_jual || 0;
  document.getElementById('stokSaatIni').textContent = produk.stok || 0;
  document.getElementById('perubahanStok').value = 0; hitungStokAkhir();

  // ---- Tombol Batal ----
  let btnBatal = document.getElementById('btnBatalProduk');
  if (!btnBatal) {
    btnBatal = document.createElement('button'); btnBatal.id = 'btnBatalProduk'; btnBatal.className = 'btn btn-danger'; btnBatal.textContent = 'Batal';
    btnBatal.onclick = tutupFormProduk;
    const btnSimpan = document.getElementById('btnSimpanProduk');
    if (btnSimpan && btnSimpan.parentNode) btnSimpan.parentNode.insertBefore(btnBatal, btnSimpan.nextSibling);
    else document.getElementById('productForm').appendChild(btnBatal);
  }
  btnBatal.style.display = 'inline-block';

  if (isAdmin) {
    document.getElementById('btnHapusProduk').style.display = isNew ? 'none' : 'inline-block';
    document.getElementById('btnSimpanProduk').style.display = 'inline-block';
    document.getElementById('btnHapusFoto').style.display = 'block';
    ['prodNama','prodKategori','prodKeterangan','prodHargaBeli','prodHargaJual','perubahanStok','prodFoto'].forEach(id => { document.getElementById(id).readOnly = false; document.getElementById(id).disabled = false; });

    document.getElementById('btnSimpanProduk').onclick = async () => {
      if (!currentBarcode) return;
      let foto = produk.foto || null;
      if (fotoDihapus) foto = null;
      else if (capturedPhotoBase64) foto = capturedPhotoBase64;
      else { const fi = document.getElementById('prodFoto'); if (fi.files[0]) foto = await toBase64(fi.files[0]); }

      const data = {
        barcode: currentBarcode,
        nama: document.getElementById('prodNama').value.trim(),
        kategori: document.getElementById('prodKategori').value.trim(),
        keterangan: document.getElementById('prodKeterangan').value.trim(),
        harga_beli: parseFloat(document.getElementById('prodHargaBeli').value) || 0,
        harga_jual: parseFloat(document.getElementById('prodHargaJual').value) || 0,
        stok: (parseInt(document.getElementById('stokSaatIni').textContent)||0) + (parseInt(document.getElementById('perubahanStok').value)||0),
        foto
      };
      try {
        await upsertProduct(data);
        alert('Disimpan');
        allProductsCache = null; // hapus cache
        tutupFormProduk();
        refreshProductList();
      } catch (e) { alert('Gagal: ' + e.message); }
    };

    document.getElementById('btnHapusProduk').onclick = async () => {
      if (confirm('Hapus?')) {
        await deleteProduct(currentBarcode);
        alert('Dihapus');
        allProductsCache = null; // hapus cache
        tutupFormProduk();
        refreshProductList();
      }
    };
  } else {
    document.getElementById('btnSimpanProduk').style.display = 'none';
    document.getElementById('btnHapusProduk').style.display = 'none';
    document.getElementById('btnHapusFoto').style.display = 'none';
  }
}

function tutupFormProduk() {
  document.getElementById('productForm').style.display = 'none'; document.getElementById('prodBarcode').value = ''; document.getElementById('prodBarcode').focus();
  currentBarcode = null; document.getElementById('fotoPreviewContainer').style.display = 'none'; document.getElementById('prodFoto').value = '';
  fotoDihapus = false; capturedPhotoBase64 = null;
  ['prodNama','prodKategori','prodKeterangan','prodHargaBeli','prodHargaJual','perubahanStok','prodFoto'].forEach(id => { document.getElementById(id).readOnly = false; document.getElementById(id).disabled = false; });
  document.getElementById('btnSimpanProduk').style.display = 'inline-block'; document.getElementById('btnHapusProduk').style.display = 'none'; document.getElementById('btnHapusFoto').style.display = 'block';
  const btnBatal = document.getElementById('btnBatalProduk'); if (btnBatal) btnBatal.style.display = 'none';
}

function hitungStokAkhir() { const a = parseInt(document.getElementById('stokSaatIni').textContent)||0, b = parseInt(document.getElementById('perubahanStok').value)||0; document.getElementById('stokAkhir').textContent = a + b; }

// ========== DAFTAR PRODUK (dengan cache) ==========
function renderProductTable(products) {
  const tbody = document.querySelector('#productListTable tbody'); tbody.innerHTML = '';
  document.getElementById('productCount').textContent = products.length;
  if (!products.length) { tbody.innerHTML = '<tr><td colspan="8">Tidak ada produk</td></tr>'; return; }
  const isAdmin = currentUser && currentUser.role === 'admin';
  document.getElementById('thAksi').style.display = isAdmin ? '' : 'none';
  products.forEach(p => {
    const row = tbody.insertRow();
    const namaCell = `<td style="display:flex;align-items:center;gap:6px;">${p.foto ? `<img src="${p.foto}" style="width:30px;height:30px;border-radius:4px;object-fit:cover;">` : '<div style="width:30px;height:30px;background:#e0e0e0;border-radius:4px;display:flex;align-items:center;justify-content:center;">📦</div>'}${p.nama||''}</td>`;
    const aksi = (isAdmin ? `<button class="btn-sm" onclick="editProdukDariDaftar('${p.barcode}')">✏️</button> <button class="btn-sm btn-danger" onclick="hapusProdukDariDaftar('${p.barcode}')">🗑</button> ` : '') + `<button class="btn-sm" onclick="cetakLabelQR('${p.barcode}')">🏷️ QR</button>`;
    row.innerHTML = `<td>${p.barcode||''}</td>${namaCell}<td>${p.kategori||'-'}</td><td>${p.keterangan||'-'}</td><td>Rp${(p.harga_jual||0).toLocaleString('id')}</td><td>${p.stok||0}</td><td>${aksi}</td>`;
  });
}

async function refreshProductList() {
  try {
    const all = await getAllProducts();
    allProductsCache = all; // simpan cache
    renderProductTable(all);
    document.getElementById('invSearch').value = '';
  } catch (e) {
    console.error(e);
    document.querySelector('#productListTable tbody').innerHTML = '<tr><td colspan="8">Gagal memuat data</td></tr>';
  }
}

let filterTimer = null;
function filterProductList() {
  clearTimeout(filterTimer);
  filterTimer = setTimeout(async () => {
    const query = document.getElementById('invSearch')?.value.trim();
    if (!query) {
      if (allProductsCache) renderProductTable(allProductsCache);
      else await refreshProductList();
      return;
    }
    // Jika ada cache, kita filter dari cache (cukup cepat)
    if (allProductsCache) {
      const filtered = allProductsCache.filter(p => 
        (p.nama||'').toLowerCase().includes(query.toLowerCase()) ||
        (p.barcode||'').toLowerCase().includes(query.toLowerCase()) ||
        (p.kategori||'').toLowerCase().includes(query.toLowerCase())
      );
      renderProductTable(filtered);
      return;
    }
    // Fallback ke API
    try {
      const { data, error } = await supabaseClient
        .from('products')
        .select('*')
        .or(`nama.ilike.%${query}%,barcode.ilike.%${query}%,kategori.ilike.%${query}%`)
        .order('nama').limit(50);
      if (error) throw error;
      renderProductTable(data || []);
    } catch (e) {
      console.error(e);
      document.querySelector('#productListTable tbody').innerHTML = '<tr><td colspan="8">Gagal mencari data</td></tr>';
    }
  }, 300);
}

async function editProdukDariDaftar(b) { if (!currentUser || currentUser.role !== 'admin') return; document.getElementById('prodBarcode').value = b; cariAtauTambahProduk(); }
async function hapusProdukDariDaftar(b) { if (!currentUser || currentUser.role !== 'admin') return; if (!confirm('Hapus?')) return; await deleteProduct(b); allProductsCache = null; refreshProductList(); }

function generateBarcode() {
  const now = new Date();
  const y = now.getFullYear().toString().slice(-2);
  const m = ('0'+(now.getMonth()+1)).slice(-2);
  const d = ('0'+now.getDate()).slice(-2);
  const h = ('0'+now.getHours()).slice(-2);
  const i = ('0'+now.getMinutes()).slice(-2);
  const s = ('0'+now.getSeconds()).slice(-2);
  document.getElementById('prodBarcode').value = y+m+d+h+i+s;
  cariAtauTambahProduk();
}

// ========== CETAK LABEL QR ==========
async function cetakLabelQR(barcode) {
  const product = await getProductByBarcode(barcode);
  if (!product) return alert('Produk tidak ditemukan');
  const nama = product.nama || 'Produk';
  const harga = 'Rp ' + (product.harga_jual||0).toLocaleString('id');
  const barcodeText = product.barcode||'';
  const tglCetak = new Date().toLocaleDateString('id-ID',{day:'numeric',month:'short',year:'numeric'});
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(barcodeText)}`;
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({orientation:'landscape', unit:'mm', format:[33,15]});
  const qrImage = new Image(); qrImage.crossOrigin = 'Anonymous';
  qrImage.onload = () => {
    doc.addImage(qrImage,'PNG',2,2,9,9);
    doc.setFontSize(5); const namaLines = doc.splitTextToSize(nama,23); doc.text(namaLines,12,3);
    doc.setFontSize(6); doc.setFont(undefined,'bold'); doc.text(harga,12,9);
    doc.setFontSize(3); doc.setFont(undefined,'normal'); doc.text(barcodeText,2,12);
    doc.setFontSize(2); doc.text(tglCetak,12,12);
    const blob = doc.output('blob'); const url = URL.createObjectURL(blob); window.open(url,'_blank');
  };
  qrImage.onerror = () => alert('Gagal memuat QR code.');
  qrImage.src = qrUrl;
}