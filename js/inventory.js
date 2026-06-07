// ===================== INVENTORY.JS =====================
function setupInventory() {
  document.getElementById('prodBarcode').onkeydown = e => {
    if (e.key === 'Enter') { e.preventDefault(); cariAtauTambahProduk(); }
  };
}

let currentBarcode = null;
let fotoDihapus = false;

async function cariAtauTambahProduk() {
  if (!currentUser) return;
  const barcode = document.getElementById('prodBarcode').value.trim();
  if (!barcode) return;
  currentBarcode = barcode;
  document.getElementById('productForm').style.display = 'block';
  fotoDihapus = false;
  const product = await getProductByBarcode(barcode);
  const isAdmin = currentUser.role === 'admin';
  if (product) {
    isiFormProduk(product, false, isAdmin);
    if (product.foto) {
      document.getElementById('fotoPreview').src = product.foto;
      document.getElementById('fotoPreviewContainer').style.display = 'block';
    } else {
      document.getElementById('fotoPreviewContainer').style.display = 'none';
    }
  } else {
    if (!isAdmin) { alert('Produk tidak ditemukan'); tutupFormProduk(); return; }
    isiFormProduk({ barcode, nama:'', kategori:'', keterangan:'', harga_beli:0, harga_jual:0, stok:0, foto:null }, true, true);
    document.getElementById('fotoPreviewContainer').style.display = 'none';
  }
  if (isAdmin) document.getElementById('prodNama').focus();
  else {
    ['prodNama','prodKategori','prodKeterangan','prodHargaBeli','prodHargaJual','perubahanStok'].forEach(id => {
      document.getElementById(id).readOnly = true;
    });
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
    reader.onload = e => {
      document.getElementById('fotoPreview').src = e.target.result;
      document.getElementById('fotoPreviewContainer').style.display = 'block';
    };
    reader.readAsDataURL(f);
    fotoDihapus = false;
  }
}

function hapusFoto() {
  if (!currentUser || currentUser.role !== 'admin') return;
  document.getElementById('fotoPreview').src = '';
  document.getElementById('fotoPreviewContainer').style.display = 'none';
  document.getElementById('prodFoto').value = '';
  fotoDihapus = true;
}

function isiFormProduk(produk, isNew, isAdmin) {
  document.getElementById('formTitle').textContent = isAdmin ? (isNew ? 'Tambah Baru' : 'Update') : 'Detail';
  document.getElementById('prodNama').value = produk.nama || '';
  document.getElementById('prodKategori').value = produk.kategori || '';
  document.getElementById('prodKeterangan').value = produk.keterangan || '';
  document.getElementById('prodHargaBeli').value = produk.harga_beli || 0;
  document.getElementById('prodHargaJual').value = produk.harga_jual || 0;
  document.getElementById('stokSaatIni').textContent = produk.stok || 0;
  document.getElementById('perubahanStok').value = 0;
  hitungStokAkhir();
  if (isAdmin) {
    document.getElementById('btnHapusProduk').style.display = isNew ? 'none' : 'inline-block';
    document.getElementById('btnSimpanProduk').style.display = 'inline-block';
    document.getElementById('btnHapusFoto').style.display = 'block';
    ['prodNama','prodKategori','prodKeterangan','prodHargaBeli','prodHargaJual','perubahanStok','prodFoto'].forEach(id => {
      document.getElementById(id).readOnly = false;
      document.getElementById(id).disabled = false;
    });
    document.getElementById('btnSimpanProduk').onclick = async () => {
      if (!currentBarcode) return;
      let foto = produk.foto || null;
      if (fotoDihapus) foto = null;
      else {
        const fi = document.getElementById('prodFoto');
        if (fi.files[0]) foto = await toBase64(fi.files[0]);
      }
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
        tutupFormProduk();
        refreshProductList();
      } catch (e) { alert('Gagal: ' + e.message); }
    };
    document.getElementById('btnHapusProduk').onclick = async () => {
      if (confirm('Hapus?')) {
        await deleteProduct(currentBarcode);
        alert('Dihapus');
        tutupFormProduk();
        refreshProductList();
      }
    };
  }
}

function tutupFormProduk() {
  document.getElementById('productForm').style.display = 'none';
  document.getElementById('prodBarcode').value = '';
  document.getElementById('prodBarcode').focus();
  currentBarcode = null;
  document.getElementById('fotoPreviewContainer').style.display = 'none';
  document.getElementById('prodFoto').value = '';
  fotoDihapus = false;
  ['prodNama','prodKategori','prodKeterangan','prodHargaBeli','prodHargaJual','perubahanStok','prodFoto'].forEach(id => {
    document.getElementById(id).readOnly = false;
    document.getElementById(id).disabled = false;
  });
  document.getElementById('btnSimpanProduk').style.display = 'inline-block';
  document.getElementById('btnHapusProduk').style.display = 'none';
  document.getElementById('btnHapusFoto').style.display = 'block';
}

function hitungStokAkhir() {
  const a = parseInt(document.getElementById('stokSaatIni').textContent) || 0;
  const b = parseInt(document.getElementById('perubahanStok').value) || 0;
  document.getElementById('stokAkhir').textContent = a + b;
}

async function refreshProductList() {
  const all = await getAllProducts();
  document.getElementById('productCount').textContent = all.length;
  const tbody = document.querySelector('#productListTable tbody');
  tbody.innerHTML = '';
  if (!all.length) {
    tbody.innerHTML = '<tr><td colspan="7">Belum ada produk</td></tr>';
    return;
  }
  const isAdmin = currentUser && currentUser.role === 'admin';
  const thAksi = document.getElementById('thAksi');
  if (thAksi) thAksi.style.display = isAdmin ? '' : 'none';
  all.forEach(p => {
    const row = tbody.insertRow();
    const namaCell = `<td style="display:flex;align-items:center;gap:6px;">${p.foto ? `<img src="${p.foto}" style="width:30px;height:30px;border-radius:4px;object-fit:cover;">` : '<div style="width:30px;height:30px;background:#e0e0e0;border-radius:4px;display:flex;align-items:center;justify-content:center;">📦</div>'}${p.nama||''}</td>`;
    const aksi = isAdmin ? `<button class="btn-sm" onclick="editProdukDariDaftar('${p.barcode}')">✏️</button> <button class="btn-sm btn-danger" onclick="hapusProdukDariDaftar('${p.barcode}')">🗑</button>` : '';
    row.innerHTML = `<td>${p.barcode||''}</td>${namaCell}<td>${p.kategori||'-'}</td><td>${p.keterangan||'-'}</td><td>Rp${(p.harga_jual||0).toLocaleString('id')}</td><td>${p.stok||0}</td><td>${aksi}</td>`;
  });
}

function filterProductList() {
  const query = document.getElementById('invSearch').value.toLowerCase();
  getAllProducts().then(all => {
    const filtered = all.filter(p => (p.nama||'').toLowerCase().includes(query) || (p.barcode||'').toLowerCase().includes(query));
    const tbody = document.querySelector('#productListTable tbody');
    tbody.innerHTML = '';
    if (!filtered.length) {
      tbody.innerHTML = '<tr><td colspan="7">Tidak ditemukan</td></tr>';
      return;
    }
    filtered.forEach(p => {
      const row = tbody.insertRow();
      const namaCell = `<td style="display:flex;align-items:center;gap:6px;">${p.foto ? `<img src="${p.foto}" style="width:30px;height:30px;border-radius:4px;object-fit:cover;">` : '<div style="width:30px;height:30px;background:#e0e0e0;border-radius:4px;display:flex;align-items:center;justify-content:center;">📦</div>'}${p.nama||''}</td>`;
      row.innerHTML = `<td>${p.barcode||''}</td>${namaCell}<td>${p.kategori||'-'}</td><td>${p.keterangan||'-'}</td><td>Rp${(p.harga_jual||0).toLocaleString('id')}</td><td>${p.stok||0}</td><td></td>`;
    });
  });
}

async function editProdukDariDaftar(b) {
  if (!currentUser || currentUser.role !== 'admin') return;
  document.getElementById('prodBarcode').value = b;
  cariAtauTambahProduk();
}

async function hapusProdukDariDaftar(b) {
  if (!currentUser || currentUser.role !== 'admin') return;
  if (!confirm('Hapus produk ini?')) return;
  await deleteProduct(b);
  refreshProductList();
}