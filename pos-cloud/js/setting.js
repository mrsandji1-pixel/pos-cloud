async function muatProfilToko() {
  const settings = await getSettings();
  if (settings) {
    document.getElementById('tokoNama').value = settings.nama || '';
    document.getElementById('tokoAlamat').value = settings.alamat || '';
    document.getElementById('tokoTelp').value = settings.telp || '';
    document.getElementById('tokoFooter').value = settings.footer || '';
    document.getElementById('kertasLebar').value = settings.kertas_lebar || '80';
    document.getElementById('jenisKertas').value = settings.jenis_kertas || 'thermal';
    document.getElementById('printerPilihan').value = settings.printer || 'default';
    document.getElementById('labelWidth').value = settings.label_width || 50;
    document.getElementById('labelHeight').value = settings.label_height || 30;
    document.getElementById('labelGap').value = settings.label_gap || 3;
    document.getElementById('labelCols').value = settings.label_cols || 1;
    toggleLabelSettings();
    if (settings.logo) {
      document.getElementById('logoPreview').src = settings.logo;
      document.getElementById('logoPreviewContainer').style.display = 'block';
    } else {
      document.getElementById('logoPreviewContainer').style.display = 'none';
    }
  }
}

function previewLogoToko() {
  const f = document.getElementById('tokoLogo').files[0];
  if (f) {
    const reader = new FileReader();
    reader.onload = e => {
      document.getElementById('logoPreview').src = e.target.result;
      document.getElementById('logoPreviewContainer').style.display = 'block';
    };
    reader.readAsDataURL(f);
    logoTokoDihapus = false;
  }
}

function hapusLogoToko() {
  document.getElementById('logoPreview').src = '';
  document.getElementById('logoPreviewContainer').style.display = 'none';
  document.getElementById('tokoLogo').value = '';
  logoTokoDihapus = true;
}

async function simpanProfil() {
  if (!currentUser || currentUser.role !== 'admin') return;
  const nama = document.getElementById('tokoNama').value;
  const alamat = document.getElementById('tokoAlamat').value;
  const telp = document.getElementById('tokoTelp').value;
  const footer = document.getElementById('tokoFooter').value;
  const kertasLebar = document.getElementById('kertasLebar').value;
  const jenisKertas = document.getElementById('jenisKertas').value;
  const printer = document.getElementById('printerPilihan').value;
  const lw = parseFloat(document.getElementById('labelWidth').value) || 50;
  const lh = parseFloat(document.getElementById('labelHeight').value) || 30;
  const lg = parseFloat(document.getElementById('labelGap').value) || 3;
  const lc = parseInt(document.getElementById('labelCols').value) || 1;
  let logo = null;
  if (!logoTokoDihapus) {
    const fi = document.getElementById('tokoLogo');
    if (fi.files[0]) {
      logo = await toBase64(fi.files[0]);
    } else {
      const s = await getSettings();
      logo = s.logo || null;
    }
  }
  await updateSettings({ nama, alamat, telp, logo, footer, kertas_lebar: kertasLebar, jenis_kertas: jenisKertas, printer, label_width: lw, label_height: lh, label_gap: lg, label_cols: lc });
  alert('Profil disimpan');
  logoTokoDihapus = false;
  document.getElementById('tokoLogo').value = '';
  await muatProfilToko();
}

async function simpanPengaturanCetak() {
  const s = await getSettings();
  await updateSettings({
    ...s,
    kertas_lebar: document.getElementById('kertasLebar').value,
    jenis_kertas: document.getElementById('jenisKertas').value,
    printer: document.getElementById('printerPilihan').value,
    label_width: parseFloat(document.getElementById('labelWidth').value) || 50,
    label_height: parseFloat(document.getElementById('labelHeight').value) || 30,
    label_gap: parseFloat(document.getElementById('labelGap').value) || 3,
    label_cols: parseInt(document.getElementById('labelCols').value) || 1
  });
  alert('Pengaturan cetak disimpan');
}

function toggleLabelSettings() {
  document.getElementById('labelSettings').style.display = document.getElementById('jenisKertas').value === 'label' ? 'block' : 'none';
}

async function testPrint() {
  const { jsPDF } = window.jspdf;
  const lebar = parseInt(document.getElementById('kertasLebar').value) || 80;
  const doc = new jsPDF({ unit: 'mm', format: [lebar, 40] });
  doc.setFontSize(10); doc.text('Test Print', 3, 10);
  doc.setFontSize(8); doc.text('Printer: ' + document.getElementById('printerPilihan').value, 3, 18);
  doc.text('Lebar: ' + lebar + 'mm', 3, 24);
  doc.text(new Date().toLocaleString('id-ID'), 3, 30);
  const blob = doc.output('blob');
  const url = URL.createObjectURL(blob);
  const pw = window.open(url, '_blank');
  if (pw) pw.addEventListener('load', () => pw.print(), { once: true });
}

function aturHakAkses() {
  const isAdmin = currentUser && currentUser.role === 'admin';
  document.getElementById('manajemenProfilSection').style.display = isAdmin ? 'block' : 'none';
  document.getElementById('manajemenUserSection').style.display = isAdmin ? 'block' : 'none';
  document.getElementById('manajemenDataSection').style.display = isAdmin ? 'block' : 'none';
  document.getElementById('thAksi').style.display = isAdmin ? '' : 'none';
  if (activeTab === 'inventory') refreshProductList();
}

function lihatDetailProduk(barcode) {
  (async () => {
    const p = await getProductByBarcode(barcode);
    if (!p) return;
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

async function pilihFolder() {
  try {
    const d = await window.showDirectoryPicker();
    workingDirHandle = d;
    document.getElementById('folderPath').textContent = d.name;
    alert('Dipilih');
  } catch (e) {
    if (e.name !== 'AbortError') alert('Gagal');
  }
}

async function backupData() {
  // Implementasi backup ZIP bisa ditambahkan
}

async function restoreData() {
  // Implementasi restore ZIP bisa ditambahkan
}