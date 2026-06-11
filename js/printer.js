// ===================== PRINTER.JS (Nonaktifkan Logo, Fokus Header Normal) =====================
let bluetoothDevice = null;
let bluetoothCharacteristic = null;

async function sambungPrinter() {
  try {
    bluetoothDevice = await navigator.bluetooth.requestDevice({
      acceptAllDevices: true,
      optionalServices: ['000018f0-0000-1000-8000-00805f9b34fb']
    });
    const server = await bluetoothDevice.gatt.connect();
    const service = await server.getPrimaryService('000018f0-0000-1000-8000-00805f9b34fb');
    bluetoothCharacteristic = await service.getCharacteristic('00002af1-0000-1000-8000-00805f9b34fb');
    updateStatusPrinter(true);
    alert('Printer terhubung!');
    await simpanPengaturanCetak();
  } catch (e) {
    console.error(e);
    updateStatusPrinter(false);
    alert('Gagal terhubung: ' + e.message);
  }
}

async function putusPrinter() {
  if (bluetoothDevice && bluetoothDevice.gatt.connected) {
    await bluetoothDevice.gatt.disconnect();
    bluetoothDevice = null;
    bluetoothCharacteristic = null;
    updateStatusPrinter(false);
    alert('Koneksi printer diputus');
  }
}

function updateStatusPrinter(connected) {
  const elements = [
    { led: 'ledTrans', text: 'printerStatusText', btn: 'btnPutusTrans' },
    { led: 'ledSetting', text: 'printerStatusTextSetting', btn: 'btnPutusSetting' }
  ];
  elements.forEach(el => {
    const led = document.getElementById(el.led);
    const text = document.getElementById(el.text);
    const btn = document.getElementById(el.btn);
    if (led) led.className = `led ${connected ? 'led-green' : 'led-red'}`;
    if (text) text.textContent = connected ? 'Printer terhubung' : 'Printer tidak terhubung';
    if (btn) btn.style.display = connected ? 'inline-block' : 'none';
  });
}

// Kirim teks ke printer tanpa logo
async function cetakStrukKePrinter(logoBase64, teks) {
  if (!bluetoothCharacteristic) {
    alert('Printer tidak terhubung');
    return;
  }
  try {
    // Reset printer ke default
    const reset = new Uint8Array([0x1B, 0x40]);
    await bluetoothCharacteristic.writeValue(reset);
    await new Promise(r => setTimeout(r, 50));

    // *** LOGO DINONAKTIFKAN SEMENTARA ***
    // if (logoBase64) { ... } // dilewati

    // Kirim teks per baris dengan jeda 50ms antar baris
    const encoder = new TextEncoder();
    const lines = teks.split('\n');
    for (let i = 0; i < lines.length; i++) {
      let line = lines[i];
      if (i < lines.length - 1) line += '\n';
      const data = encoder.encode(line);
      for (let j = 0; j < data.byteLength; j += 256) {
        const chunk = data.slice(j, j + 256);
        await bluetoothCharacteristic.writeValue(chunk);
      }
      await new Promise(r => setTimeout(r, 50));
    }

    // Tambah 3 baris kosong sebelum potong kertas (batas bawah)
    const extraFeed = encoder.encode('\n\n\n');
    await bluetoothCharacteristic.writeValue(extraFeed);
    await new Promise(r => setTimeout(r, 50));

    // Potong kertas
    const cut = encoder.encode('\x1B\x69');
    await bluetoothCharacteristic.writeValue(cut);
    await new Promise(r => setTimeout(r, 100));

    alert('Cetak berhasil');
  } catch (e) {
    console.error(e);
    alert('Gagal cetak: ' + e.message);
  }
}

async function getLebarKertasAktif() {
  const settings = await getSettings();
  return parseInt(settings.kertas_lebar) || 80;
}

async function testPrint() {
  const lebar = await getLebarKertasAktif();
  const charWidth = lebar === 80 ? 47 : 32;
  const garis = '='.repeat(charWidth);

  let teks = '';
  teks += garis + '\n';
  teks += '   TEST PRINT\n';
  teks += garis + '\n';
  teks += 'Lebar: ' + lebar + 'mm\n';
  teks += 'Tanggal: ' + new Date().toLocaleDateString('id-ID') + '\n';
  teks += garis + '\n';

  if (bluetoothDevice && bluetoothCharacteristic) {
    await cetakStrukKePrinter(null, teks);
  } else {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ unit: 'mm', format: [lebar, 40] });
    doc.setFontSize(10);
    doc.text('Test Print', 3, 10);
    doc.text('Lebar: ' + lebar + 'mm', 3, 18);
    doc.text(new Date().toLocaleDateString('id-ID'), 3, 24);
    const blob = doc.output('blob');
    const url = URL.createObjectURL(blob);
    const pw = window.open(url, '_blank');
    if (pw) pw.addEventListener('load', () => pw.print(), { once: true });
  }
}

function buatStrukTeks(cart, total, bayar, kembali, toko, noInv, cust) {
  const lebar = parseInt(toko.kertas_lebar) || 80;
  const is80mm = lebar === 80;
  const charWidth = is80mm ? 47 : 32;
  const garis = '-'.repeat(charWidth);
  const garisDouble = '='.repeat(charWidth);
  const lebarItem = is80mm ? 21 : 10;
  const lebarQty = is80mm ? 5 : 4;
  const lebarHarga = is80mm ? 11 : 9;
  const lebarSubtotal = is80mm ? 10 : 9;

  let struk = '';
  if (toko.nama) {
    const nama = toko.nama.length > charWidth ? toko.nama.substring(0, charWidth) : toko.nama;
    const padding = Math.floor((charWidth - nama.length) / 2);
    struk += ' '.repeat(padding) + nama + '\n';
  }
  if (toko.alamat) {
    const alamat = toko.alamat.length > charWidth ? toko.alamat.substring(0, charWidth) : toko.alamat;
    struk += alamat + '\n';
  }
  struk += 'No: ' + noInv + '\n';
  struk += 'Tanggal: ' + new Date().toLocaleString('id-ID') + '\n';
  struk += 'Customer: ' + (cust || '-') + '\n';
  struk += garis + '\n';

  const header = 'Item'.padEnd(lebarItem).substring(0, lebarItem) +
                 'Qty'.padStart(lebarQty) +
                 'Harga'.padStart(lebarHarga) +
                 'Sub'.padStart(lebarSubtotal);
  struk += header.substring(0, charWidth) + '\n';
  struk += garis + '\n';

  cart.forEach(item => {
    const nama = (item.nama || '').length > lebarItem ? item.nama.substring(0, lebarItem) : item.nama.padEnd(lebarItem);
    const qty = item.qty.toString().padStart(lebarQty);
    const harga = ('Rp' + item.harga.toLocaleString('id')).slice(-lebarHarga).padStart(lebarHarga);
    const sub = ('Rp' + (item.harga * item.qty).toLocaleString('id')).slice(-lebarSubtotal).padStart(lebarSubtotal);
    let row = nama + qty + harga + sub;
    if (row.length > charWidth) row = row.substring(0, charWidth);
    struk += row + '\n';
  });

  struk += garis + '\n';

  const lebarNilai = is80mm ? 12 : 9;
  const totalStr = ('Rp' + total.toLocaleString('id')).slice(-lebarNilai).padStart(lebarNilai);
  const bayarStr = ('Rp' + bayar.toLocaleString('id')).slice(-lebarNilai).padStart(lebarNilai);
  const kembaliStr = ('Rp' + kembali.toLocaleString('id')).slice(-lebarNilai).padStart(lebarNilai);

  const labelWidth = is80mm ? 10 : 9;
  struk += 'Total'.padEnd(labelWidth) + ': ' + totalStr + '\n';
  struk += 'Bayar'.padEnd(labelWidth) + ': ' + bayarStr + '\n';
  struk += 'Kembali'.padEnd(labelWidth) + ': ' + kembaliStr + '\n';

  if (toko.footer) {
    const footer = toko.footer.length > charWidth ? toko.footer.substring(0, charWidth) : toko.footer;
    const padding = Math.floor((charWidth - footer.length) / 2);
    struk += '\n' + ' '.repeat(padding) + footer + '\n';
  }
  struk += garisDouble + '\n';

  return struk;
}