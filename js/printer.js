// ===================== PRINTER BLUETOOTH =====================
let bluetoothDevice = null;
let bluetoothCharacteristic = null;

async function sambungPrinter() {
  try {
    // Minta perangkat Bluetooth
    bluetoothDevice = await navigator.bluetooth.requestDevice({
      acceptAllDevices: true,
      optionalServices: ['000018f0-0000-1000-8000-00805f9b34fb']
    });

    // Hubungkan ke GATT server
    const server = await bluetoothDevice.gatt.connect();
    
    // Dapatkan service printer (UUID umum untuk printer thermal)
    const service = await server.getPrimaryService('000018f0-0000-1000-8000-00805f9b34fb');
    
    // Dapatkan characteristic untuk mengirim data
    bluetoothCharacteristic = await service.getCharacteristic('00002af1-0000-1000-8000-00805f9b34fb');
    
    updateStatusPrinter(true);
    alert('Printer terhubung!');
    await simpanPengaturanCetak();

    // Tangani jika koneksi terputus
    bluetoothDevice.addEventListener('gattserverdisconnected', () => {
      updateStatusPrinter(false);
      alert('Koneksi printer terputus');
      bluetoothDevice = null;
      bluetoothCharacteristic = null;
    });

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

// Fungsi untuk mengirim teks ke printer Bluetooth
async function cetakTeksKePrinter(teks) {
  if (!bluetoothCharacteristic) {
    alert('Printer tidak terhubung');
    return;
  }
  try {
    const encoder = new TextEncoder();
    // Tambahkan perintah potong kertas (ESC/POS) jika diperlukan
    const cutCommand = new Uint8Array([0x1D, 0x56, 0x41, 0x10]); // GS V A
    const data = encoder.encode(teks);
    const fullData = new Uint8Array(data.length + cutCommand.length);
    fullData.set(data);
    fullData.set(cutCommand, data.length);
    
    // Kirim per chunk (512 byte)
    const chunkSize = 512;
    for (let i = 0; i < fullData.byteLength; i += chunkSize) {
      const chunk = fullData.slice(i, i + chunkSize);
      await bluetoothCharacteristic.writeValue(chunk);
    }
    alert('Cetak berhasil');
  } catch (e) {
    console.error(e);
    alert('Gagal cetak: ' + e.message);
  }
}

// Test print dengan teks
async function testPrint() {
  const lebar = parseInt(document.getElementById('kertasLebar')?.value) || 80;
  let teks = '';
  teks += '====================\n';
  teks += '   TEST PRINT\n';
  teks += '====================\n';
  teks += 'Printer: ' + (document.getElementById('printerPilihan')?.value || 'default') + '\n';
  teks += 'Lebar  : ' + lebar + 'mm\n';
  teks += 'Tanggal: ' + new Date().toLocaleString('id-ID') + '\n';
  teks += '====================\n';
  teks += 'Jika teks ini tercetak\n';
  teks += 'maka printer berfungsi\n';
  teks += 'dengan baik.\n';
  teks += '====================\n';

  if (bluetoothDevice && bluetoothCharacteristic) {
    await cetakTeksKePrinter(teks);
  } else {
    // Fallback: buka PDF di tab baru
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

// Fungsi untuk membuat struk teks (dari cart)
function buatStrukTeks(cart, total, bayar, kembali, toko, noInv, cust) {
  let struk = '';
  struk += toko.nama || 'TOKO';
  struk += '\n';
  if (toko.alamat) {
    struk += toko.alamat + '\n';
  }
  struk += 'No: ' + noInv + '\n';
  struk += 'Tanggal: ' + new Date().toLocaleString('id-ID') + '\n';
  struk += 'Customer: ' + (cust || '-') + '\n';
  struk += '------------------------------\n';
  struk += 'Item          Qty  Harga   Sub\n';
  struk += '------------------------------\n';

  cart.forEach(item => {
    const nama = item.nama.padEnd(12).substring(0, 12);
    const qty = item.qty.toString().padStart(3);
    const harga = ('Rp' + item.harga.toLocaleString('id')).padStart(8);
    const sub = ('Rp' + (item.harga * item.qty).toLocaleString('id')).padStart(9);
    struk += `${nama} ${qty} ${harga} ${sub}\n`;
  });

  struk += '------------------------------\n';
  struk += 'Total : ' + ('Rp' + total.toLocaleString('id')).padStart(12) + '\n';
  struk += 'Bayar : ' + ('Rp' + bayar.toLocaleString('id')).padStart(12) + '\n';
  struk += 'Kembali: ' + ('Rp' + kembali.toLocaleString('id')).padStart(12) + '\n';
  if (toko.footer) {
    struk += '\n' + toko.footer + '\n';
  }
  struk += '==============================\n';
  return struk;
}