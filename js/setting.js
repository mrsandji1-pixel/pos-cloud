// ===================== SETTING.JS =====================
async function muatProfilToko() {
  const s = await getSettings();
  if (s) {
    document.getElementById('tokoNama').value = s.nama || '';
    document.getElementById('tokoAlamat').value = s.alamat || '';
    document.getElementById('tokoTelp').value = s.telp || '';
    document.getElementById('tokoFooter').value = s.footer || '';
    document.getElementById('kertasLebar').value = s.kertas_lebar || '80';
    document.getElementById('jenisKertas').value = s.jenis_kertas || 'thermal';
    document.getElementById('printerPilihan').value = s.printer || 'default';
    document.getElementById('labelWidth').value = s.label_width || 50;
    document.getElementById('labelHeight').value = s.label_height || 30;
    document.getElementById('labelGap').value = s.label_gap || 3;
    document.getElementById('labelCols').value = s.label_cols || 1;
    toggleLabelSettings();
    if (s.logo) {
      document.getElementById('logoPreview').src = s.logo;
      document.getElementById('logoPreviewContainer').style.display = 'block';
    } else {
      document.getElementById('logoPreviewContainer').style.display = 'none';
    }
  }
}

function toggleLabelSettings() {
  document.getElementById('labelSettings').style.display = document.getElementById('jenisKertas').value === 'label' ? 'block' : 'none';
}

function previewLogoToko() {
  const f = document.getElementById('tokoLogo').files[0];
  if (f) { const r = new FileReader(); r.onload = e => { document.getElementById('logoPreview').src = e.target.result; document.getElementById('logoPreviewContainer').style.display='block'; }; r.readAsDataURL(f); logoTokoDihapus=false; }
}

function hapusLogoToko() {
  document.getElementById('logoPreview').src=''; document.getElementById('logoPreviewContainer').style.display='none'; document.getElementById('tokoLogo').value=''; logoTokoDihapus=true;
}

async function simpanProfil() {
  if (!currentUser || currentUser.role!=='admin') return;
  const nama = document.getElementById('tokoNama').value;
  const alamat = document.getElementById('tokoAlamat').value;
  const telp = document.getElementById('tokoTelp').value;
  const footer = document.getElementById('tokoFooter').value;
  const kertasLebar = document.getElementById('kertasLebar').value;
  const jenisKertas = document.getElementById('jenisKertas').value;
  const printer = document.getElementById('printerPilihan').value;
  const lw = parseFloat(document.getElementById('labelWidth').value)||50;
  const lh = parseFloat(document.getElementById('labelHeight').value)||30;
  const lg = parseFloat(document.getElementById('labelGap').value)||3;
  const lc = parseInt(document.getElementById('labelCols').value)||1;
  let logo = null;
  if (!logoTokoDihapus) {
    const fi = document.getElementById('tokoLogo');
    if (fi.files[0]) { logo = await toBase64(fi.files[0]); }
    else { const s = await getSettings(); logo = s.logo||null; }
  }
  await updateSettings({ nama, alamat, telp, logo, footer, kertas_lebar:kertasLebar, jenis_kertas:jenisKertas, printer, label_width:lw, label_height:lh, label_gap:lg, label_cols:lc });
  alert('Profil disimpan'); logoTokoDihapus=false; document.getElementById('tokoLogo').value=''; await muatProfilToko();
}

async function simpanPengaturanCetak() {
  const s = await getSettings();
  await updateSettings({ ...s, kertas_lebar: document.getElementById('kertasLebar').value, jenis_kertas: document.getElementById('jenisKertas').value, printer: document.getElementById('printerPilihan').value, label_width: parseFloat(document.getElementById('labelWidth').value)||50, label_height: parseFloat(document.getElementById('labelHeight').value)||30, label_gap: parseFloat(document.getElementById('labelGap').value)||3, label_cols: parseInt(document.getElementById('labelCols').value)||1 });
  alert('Pengaturan cetak disimpan');
}

function aturHakAkses() {
  const isAdmin = currentUser && currentUser.role === 'admin';
  document.getElementById('manajemenProfilSection').style.display = isAdmin ? 'block' : 'none';
  document.getElementById('manajemenUserSection').style.display = isAdmin ? 'block' : 'none';
  document.getElementById('manajemenDataSection').style.display = isAdmin ? 'block' : 'none';
  document.getElementById('thAksi').style.display = isAdmin ? '' : 'none';
  if (activeTab === 'inventory') refreshProductList();
}

async function pilihFolder() { try { const d = await window.showDirectoryPicker(); workingDirHandle = d; document.getElementById('folderPath').textContent = d.name; alert('Dipilih'); } catch(e) { if (e.name!=='AbortError') alert('Gagal'); } }
async function backupData() { alert('Fitur backup masih dalam pengembangan.'); }
async function restoreData() { alert('Fitur restore masih dalam pengembangan.'); }
function resetDatabase() { if (confirm('Reset semua data?')) { alert('Silakan gunakan dashboard Supabase untuk reset.'); } }