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
    // Inisialisasi printer (ESC/POS)
    const init = '\x1B\x40'; // ESC @
    const teksLengkap = init + teks + '\n\n\n\n\x1Bm'; // potong kertas
    const encoder = new TextEncoder();
    const data = encoder.encode(teksLengkap);
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
  const charWidth = lebar === 80 ? 47 : 32;
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
  const is80mm = lebar === 80;
  const charWidth = is80mm ? 47 : 32;
  const garis = '-'.repeat(charWidth);
  const garisDouble = '='.repeat(charWidth);

  // Lebar kolom
  let lebarItem, lebarQty, lebarHarga, lebarSubtotal, lebarLabel, lebarNilai;
  if (is80mm) {
    lebarItem = 21;
    lebarQty = 5;
    lebarHarga = 11;
    lebarSubtotal = 10;
    lebarLabel = 10;
    lebarNilai = 12;
  } else {
    // 58mm
    lebarItem = 11;
    lebarQty = 3;
    lebarHarga = 7;   // tanpa "Rp"
    lebarSubtotal = 11; // dengan "Rp"
    lebarLabel = 8;
    lebarNilai = 9;
  }

  let struk = '';
  // Nama toko (center)
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

  // Header tabel
  const headerItem = 'Item'.padEnd(lebarItem).substring(0, lebarItem);
  const headerQty = 'Qty'.padStart(lebarQty).substring(0, lebarQty);
  const headerHarga = 'Harga'.padStart(lebarHarga).substring(0, lebarHarga);
  const headerSub = 'Sub'.padStart(lebarSubtotal).substring(0, lebarSubtotal);
  const header = headerItem + headerQty + headerHarga + headerSub;
  struk += header.substring(0, charWidth) + '\n';
  struk += garis + '\n';

  // Item
  cart.forEach(item => {
    const nama = (item.nama || '').length > lebarItem ? item.nama.substring(0, lebarItem) : item.nama.padEnd(lebarItem);
    const qty = item.qty.toString();
    // Qty center
    const qtyPad = Math.floor((lebarQty - qty.length) / 2);
    const qtyStr = ' '.repeat(qtyPad) + qty + ' '.repeat(lebarQty - qty.length - qtyPad);

    let hargaStr, subStr;
    if (is80mm) {
      hargaStr = ('Rp' + item.harga.toLocaleString('id')).slice(-lebarHarga).padStart(lebarHarga);
      subStr = ('Rp' + (item.harga * item.qty).toLocaleString('id')).slice(-lebarSubtotal).padStart(lebarSubtotal);
    } else {
      // 58mm: Harga tanpa "Rp"
      hargaStr = item.harga.toLocaleString('id').padStart(lebarHarga);
      // Subtotal dengan "Rp"
      const subValue = 'Rp' + (item.harga * item.qty).toLocaleString('id');
      subStr = subValue.slice(-lebarSubtotal).padStart(lebarSubtotal);
    }

    let row = nama + qtyStr + hargaStr + subStr;
    if (row.length > charWidth) row = row.substring(0, charWidth);
    struk += row + '\n';
  });

  struk += garis + '\n';

  // Total, Bayar, Kembali
  const labelTotal = 'Total'.padEnd(lebarLabel);
  const labelBayar = 'Bayar'.padEnd(lebarLabel);
  const labelKembali = 'Kembali'.padEnd(lebarLabel);
  const nilaiTotal = ('Rp' + total.toLocaleString('id')).slice(-lebarNilai).padStart(lebarNilai);
  const nilaiBayar = ('Rp' + bayar.toLocaleString('id')).slice(-lebarNilai).padStart(lebarNilai);
  const nilaiKembali = ('Rp' + kembali.toLocaleString('id')).slice(-lebarNilai).padStart(lebarNilai);

  struk += labelTotal + ': ' + nilaiTotal + '\n';
  struk += labelBayar + ': ' + nilaiBayar + '\n';
  struk += labelKembali + ': ' + nilaiKembali + '\n';

  if (toko.footer) {
    const footer = toko.footer.length > charWidth ? toko.footer.substring(0, charWidth) : toko.footer;
    const padding = Math.floor((charWidth - footer.length) / 2);
    struk += '\n' + ' '.repeat(padding) + footer + '\n';
  }
  struk += garisDouble + '\n';

  return struk;
}