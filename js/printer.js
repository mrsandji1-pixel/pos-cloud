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
    if (led) led.className = `led ${connected ? 'led-green' : 'led-red'}`;
    if (text) text.textContent = connected ? 'Printer terhubung' : 'Printer tidak terhubung';
    if (btn) btn.style.display = connected ? 'inline-block' : 'none';
  });
}

// Fungsi cetak: hanya mengirim teks yang sudah diformat (tidak membuat teks sendiri)
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

    // (Logo bisa diaktifkan kembali jika diperlukan, saat ini dilewati)

    // Kirim teks per baris dengan jeda
    const encoder = new TextEncoder();
    const lines = teks.split('\n');
    for (let i = 0; i < lines.length; i++) {
      let line = lines[i];
      if (i < lines.length - 1) line += '\n';
      const data = encoder.encode(line);
      // Kirim dalam chunk 256 byte
      for (let j = 0; j < data.byteLength; j += 256) {
        const chunk = data.slice(j, j + 256);
        await bluetoothCharacteristic.writeValue(chunk);
      }
      await new Promise(r => setTimeout(r, 50));
    }

    // Beri jarak 3 baris sebelum potong kertas
    const extraFeed = encoder.encode('\n\n\n');
    await bluetoothCharacteristic.writeValue(extraFeed);
    await new Promise(r => setTimeout(r, 50));

    // Potong kertas (perintah ESC/POS partial cut)
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

// ⚠️ Fungsi buatStrukTeks SUDAH DIHAPUS dari sini.
// Sekarang hanya ada di transaksi.js (versi 9 parameter).