// ===================== PRINTER.JS (Dengan Logo) =====================
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

// Konversi base64 ke bitmap monokrom (array byte)
async function base64ToBitmap(base64, maxWidth) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      // Skala gambar ke lebar maksimal (dalam pixel printer, biasanya 384 untuk 80mm)
      const scale = maxWidth / img.width;
      canvas.width = maxWidth;
      canvas.height = Math.round(img.height * scale);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const pixels = imageData.data;
      const bytes = [];
      // Setiap byte mewakili 8 pixel horizontal (0 = putih, 1 = hitam)
      for (let y = 0; y < canvas.height; y++) {
        for (let x = 0; x < canvas.width; x += 8) {
          let byte = 0;
          for (let bit = 0; bit < 8; bit++) {
            const px = x + bit;
            if (px < canvas.width) {
              const idx = (y * canvas.width + px) * 4;
              const r = pixels[idx], g = pixels[idx + 1], b = pixels[idx + 2];
              // Konversi ke grayscale, jika > 128 dianggap putih (0)
              const gray = 0.299 * r + 0.587 * g + 0.114 * b;
              if (gray < 128) byte |= (1 << (7 - bit));
            }
          }
          bytes.push(byte);
        }
      }
      resolve({ width: canvas.width, height: canvas.height, data: bytes });
    };
    img.onerror = reject;
    img.src = base64;
  });
}

// Kirim perintah cetak bitmap (ESC/POS GS v 0)
function sendBitmapCommand(width, height, data) {
  const w = Math.ceil(width / 8);
  const xL = w & 0xFF;
  const xH = (w >> 8) & 0xFF;
  const yL = height & 0xFF;
  const yH = (height >> 8) & 0xFF;
  return new Uint8Array([0x1D, 0x76, 0x30, 0x00, xL, xH, yL, yH, ...data]);
}

// Fungsi utama mengirim struk (logo + teks) ke printer
async function cetakStrukKePrinter(logoBase64, teks) {
  if (!bluetoothCharacteristic) {
    alert('Printer tidak terhubung');
    return;
  }
  try {
    const lebar = await getLebarKertasAktif();
    const maxWidth = lebar === 80 ? 384 : 256; // 384 dot = 48 byte, 256 dot = 32 byte (standar ESC/POS)

    // Kirim logo jika ada
    if (logoBase64) {
      const bitmap = await base64ToBitmap(logoBase64, maxWidth);
      const cmd = sendBitmapCommand(bitmap.width, bitmap.height, bitmap.data);
      await bluetoothCharacteristic.writeValue(cmd);
      // Jeda setelah logo
      await new Promise(r => setTimeout(r, 500));
      // Feed beberapa baris
      const feed = new TextEncoder().encode('\n\n');
      await bluetoothCharacteristic.writeValue(feed);
      await new Promise(r => setTimeout(r, 100));
    }

    // Kirim teks
    const encoder = new TextEncoder();
    const lines = teks.split('\n');
    for (let i = 0; i < lines.length; i++) {
      let line = lines[i];
      if (i < lines.length - 1) line += '\n';
      const data = encoder.encode(line);
      for (let j = 0; j < data.byteLength; j += 256) {
        const chunk = data.slice(j, j + 256);
        await bluetoothCharacteristic.writeValue(chunk);
        await new Promise(r => setTimeout(r, 20));
      }
      await new Promise(r => setTimeout(r, 60));
    }

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
  teks += 'Printer: ' + (document.getElementById('printerPilihan')?.value || 'default') + '\n';
  teks += 'Lebar  : ' + lebar + 'mm (' + charWidth + ' karakter)\n';
  teks += 'Tanggal: ' + new Date().toLocaleString('id-ID') + '\n';
  teks += garis + '\n';
  teks += 'Jika teks ini tercetak dengan benar\n';
  teks += 'maka printer berfungsi baik.\n';
  teks += 'Setting karakter sudah sesuai.\n';
  teks += garis + '\n';

  if (bluetoothDevice && bluetoothCharacteristic) {
    // Test print tidak pakai logo
    await cetakStrukKePrinter(null, teks);
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