// ===================== SETTING.JS (tanpa deklarasi ulang) =====================
window.logoTokoDihapus = false;

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
  } else {
    document.getElementById('tokoNama').value = '';
    document.getElementById('tokoAlamat').value = '';
    document.getElementById('tokoTelp').value = '';
    document.getElementById('tokoFooter').value = '';
    document.getElementById('kertasLebar').value = '80';
    document.getElementById('jenisKertas').value = 'thermal';
    document.getElementById('printerPilihan').value = 'default';
    document.getElementById('labelWidth').value = 50;
    document.getElementById('labelHeight').value = 30;
    document.getElementById('labelGap').value = 3;
    document.getElementById('labelCols').value = 1;
    toggleLabelSettings();
    document.getElementById('logoPreviewContainer').style.display = 'none';
  }
}

function toggleLabelSettings() {
  const jenis = document.getElementById('jenisKertas').value;
  document.getElementById('labelSettings').style.display = jenis === 'label' ? 'block' : 'none';
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
    window.logoTokoDihapus = false;
  }
}

function hapusLogoToko() {
  document.getElementById('logoPreview').src = '';
  document.getElementById('logoPreviewContainer').style.display = 'none';
  document.getElementById('tokoLogo').value = '';
  window.logoTokoDihapus = true;
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
  if (!window.logoTokoDihapus) {
    const fi = document.getElementById('tokoLogo');
    if (fi.files[0]) {
      logo = await toBase64(fi.files[0]);
    } else {
      const s = await getSettings();
      logo = s.logo || null;
    }
  }

  await updateSettings({
    nama, alamat, telp, logo, footer,
    kertas_lebar: kertasLebar,
    jenis_kertas: jenisKertas,
    printer,
    label_width: lw, label_height: lh, label_gap: lg, label_cols: lc
  });

  alert('Profil disimpan!');
  window.logoTokoDihapus = false;
  document.getElementById('tokoLogo').value = '';
  if (typeof invalidateSettingsCache === 'function') {
    invalidateSettingsCache();
  }
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
  alert('Pengaturan cetak disimpan!');
  if (typeof invalidateSettingsCache === 'function') {
    invalidateSettingsCache();
  }
}

function aturHakAkses() {
  const isAdmin = currentUser && currentUser.role === 'admin';
  document.getElementById('manajemenProfilSection').style.display = isAdmin ? 'block' : 'none';
  document.getElementById('manajemenUserSection').style.display = isAdmin ? 'block' : 'none';
  document.getElementById('manajemenDataSection').style.display = isAdmin ? 'block' : 'none';
  document.getElementById('thAksi').style.display = isAdmin ? '' : 'none';
  if (activeTab === 'inventory') refreshProductList();
}

async function pilihFolder() {
  try {
    const d = await window.showDirectoryPicker();
    workingDirHandle = d;
    document.getElementById('folderPath').textContent = d.name;
    alert('Folder dipilih!');
  } catch (e) {
    if (e.name !== 'AbortError') alert('Gagal memilih folder');
  }
}

// ========== BACKUP DATA (tanpa PDF) ==========
async function backupData() {
  try {
    const zip = new JSZip();
    
    const { data: users } = await supabaseClient.from('users').select('*');
    const { data: products } = await supabaseClient.from('products').select('*');
    const { data: transactions } = await supabaseClient.from('transactions').select('*');
    const { data: settings } = await supabaseClient.from('settings').select('*');

    zip.file('users.json', JSON.stringify(users || []));
    zip.file('products.json', JSON.stringify(products || []));
    zip.file('transactions.json', JSON.stringify(transactions || []));
    zip.file('settings.json', JSON.stringify(settings || []));

    const blob = await zip.generateAsync({ type: 'blob' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `backup_${new Date().toISOString().slice(0, 10)}.zip`;
    a.click();
  } catch (e) {
    alert('Gagal backup: ' + e.message);
  }
}

// ========== RESTORE DATA (tanpa PDF) ==========
async function restoreData() {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = '.zip';
  input.onchange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    try {
      const zip = await JSZip.loadAsync(file);
      let restored = { users: 0, products: 0, transactions: 0, settings: 0 };

      if (zip.files['users.json']) {
        const text = await zip.files['users.json'].async('text');
        const users = JSON.parse(text);
        if (users.length > 0) {
          const { error } = await supabaseClient.from('users').upsert(users, { onConflict: 'username' });
          if (!error) restored.users = users.length;
        }
      }

      if (zip.files['products.json']) {
        const text = await zip.files['products.json'].async('text');
        const products = JSON.parse(text);
        if (products.length > 0) {
          const { error } = await supabaseClient.from('products').upsert(products, { onConflict: 'barcode' });
          if (!error) restored.products = products.length;
        }
      }

      if (zip.files['transactions.json']) {
        const text = await zip.files['transactions.json'].async('text');
        const transactions = JSON.parse(text);
        if (transactions.length > 0) {
          const { error } = await supabaseClient.from('transactions').upsert(transactions, { onConflict: 'no_invoice' });
          if (!error) restored.transactions = transactions.length;
        }
      }

      if (zip.files['settings.json']) {
        const text = await zip.files['settings.json'].async('text');
        const settings = JSON.parse(text);
        if (settings.length > 0) {
          const { error } = await supabaseClient.from('settings').upsert(settings, { onConflict: 'id' });
          if (!error) restored.settings = settings.length;
        }
      }

      alert(`Restore berhasil!\nUsers: ${restored.users}\nProducts: ${restored.products}\nTransactions: ${restored.transactions}\nSettings: ${restored.settings}`);
      if (typeof invalidateSettingsCache === 'function') {
        invalidateSettingsCache();
      }
      location.reload();
    } catch (err) {
      alert('Gagal restore: ' + err.message);
    }
  };
  input.click();
}

function resetDatabase() {
  if (confirm('Reset semua data? Semua data akan terhapus permanen.')) {
    alert('Fitur reset harus dilakukan melalui dashboard Supabase. Hapus semua data di tabel secara manual.');
  }
}