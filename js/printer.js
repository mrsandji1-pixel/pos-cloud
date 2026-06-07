// ===================== PRINTER.JS =====================
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

    if (led) {
      led.className = `led ${connected ? 'led-green' : 'led-red'}`;
    }
    if (text) {
      text.textContent = connected ? 'Printer terhubung' : 'Printer tidak terhubung';
    }
    if (btn) {
      btn.style.display = connected ? 'inline-block' : 'none';
    }
  });
}

async function cetakTeksKePrinter(teks) {
  if (!bluetoothCharacteristic) {
    alert('Printer tidak terhubung');
    return;
  }
  try {
    const encoder = new TextEncoder();
    const data = encoder.encode(teks + '\n\n\n\n');
    const chunkSize = 512;
    for (let i = 0; i < data.byteLength; i += chunkSize) {
      const chunk = data.slice(i, i + chunkSize);
      await bluetoothCharacteristic.writeValue(chunk);
    }
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
  // 58mm = 22 karakter, 80mm = 47 karakter
  const charWidth = lebar === 80 ? 47 : 22;
  const garis = '='.repeat(charWidth);

  let teks = '';
  teks += garis + '\n';
  teks += '   TEST PRINT\n';
  teks += garis + '\n';
  teks += 'Printer: ' + (document.getElementById('printerPilihan')?.value || 'default') + '\n';
  teks += 'Lebar  : ' + lebar + 'mm (' + charWidth + ' karakter)\n';
  teks += 'Tanggal: ' + new Date().toLocaleString('id-ID') + '\n';
  teks += garis + '\n';
  teks += 'Jika teks ini tercetak dengan benar\n';
  teks += 'maka printer berfungsi baik.\n';
  teks += 'Setting karakter sudah sesuai.\n';
  teks += garis + '\n';

  if (bluetoothDevice && bluetoothCharacteristic) {
    await cetakTeksKePrinter(teks);
  } else {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ unit: 'mm', format: [lebar, 40] });
    doc.setFontSize(10);
    doc.text('Test Print', 3, 10);
    doc.text('Printer: ' + (document.getElementById('printerPilihan')?.value || 'default'), 3, 18);
    doc.text('Lebar: ' + lebar + 'mm', 3, 24);
    doc.text(new Date().toLocaleString('id-ID'), 3, 30);
    const blob = doc.output('blob');
    const url = URL.createObjectURL(blob);
    const pw = window.open(url, '_blank');
    if (pw) pw.addEventListener('load', () => pw.print(), { once: true });
  }
}

function buatStrukTeks(cart, total, bayar, kembali, toko, noInv, cust) {
  const lebar = parseInt(toko.kertas_lebar) || 80;
  const charWidth = lebar === 80 ? 47 : 22;
  const garis = '-'.repeat(charWidth);
  const garisDouble = '='.repeat(charWidth);

  let struk = '';
  // Nama toko (center)
  if (toko.nama) {
    const nama = toko.nama.length > charWidth ? toko.nama.substring(0, charWidth) : toko.nama;
    const padding = Math.floor((charWidth - nama.length) / 2);
    struk += ' '.repeat(padding) + nama + '\n';
  }
  // Alamat
  if (toko.alamat) {
    const alamat = toko.alamat.length > charWidth ? toko.alamat.substring(0, charWidth) : toko.alamat;
    struk += alamat + '\n';
  }
  struk += 'No: ' + noInv + '\n';
  struk += 'Tanggal: ' + new Date().toLocaleString('id-ID') + '\n';
  struk += 'Customer: ' + (cust || '-') + '\n';
  struk += garis + '\n';

  // Header tabel
  const header = 'Item'.padEnd(23).substring(0,23) +   // lebih lebar untuk 80mm
                 'Qty'.padStart(6) +
                 'Harga'.padStart(12) +
                 'Subtotal'.padStart(10);
  struk += header.substring(0, charWidth) + '\n';
  struk += garis + '\n';

  // Item
  cart.forEach(item => {
    const nama = (item.nama || '').length > 23 ? item.nama.substring(0,23) : item.nama.padEnd(23);
    const qty = item.qty.toString().padStart(6);
    const harga = ('Rp' + item.harga.toLocaleString('id')).slice(-12).padStart(12);
    const sub = ('Rp' + (item.harga * item.qty).toLocaleString('id')).slice(-10).padStart(10);
    let row = nama + qty + harga + sub;
    if (row.length > charWidth) row = row.substring(0, charWidth);
    struk += row + '\n';
  });

  struk += garis + '\n';

  // Total, bayar, kembali
  const totalStr = ('Rp' + total.toLocaleString('id')).slice(-12).padStart(12);
  const bayarStr = ('Rp' + bayar.toLocaleString('id')).slice(-12).padStart(12);
  const kembaliStr = ('Rp' + kembali.toLocaleString('id')).slice(-12).padStart(12);

  struk += 'Total     : ' + totalStr + '\n';
  struk += 'Bayar     : ' + bayarStr + '\n';
  struk += 'Kembali   : ' + kembaliStr + '\n';

  if (toko.footer) {
    const footer = toko.footer.length > charWidth ? toko.footer.substring(0, charWidth) : toko.footer;
    const padding = Math.floor((charWidth - footer.length) / 2);
    struk += '\n' + ' '.repeat(padding) + footer + '\n';
  }
  struk += garisDouble + '\n';

  return struk;
}