// ===================== PRINTER BLUETOOTH =====================
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

async function cetakViaBluetooth(pdfBlob) {
  if (!bluetoothCharacteristic) {
    alert('Printer tidak terhubung');
    return;
  }
  try {
    const arrayBuffer = await pdfBlob.arrayBuffer();
    const chunkSize = 512;
    for (let i = 0; i < arrayBuffer.byteLength; i += chunkSize) {
      const chunk = arrayBuffer.slice(i, i + chunkSize);
      await bluetoothCharacteristic.writeValue(chunk);
    }
    alert('Cetak via Bluetooth berhasil');
  } catch (e) {
    console.error(e);
    alert('Gagal cetak: ' + e.message);
  }
}

async function testPrint() {
  const { jsPDF } = window.jspdf;
  const lebar = parseInt(document.getElementById('kertasLebar')?.value) || 80;
  const doc = new jsPDF({ unit: 'mm', format: [lebar, 40] });
  doc.setFontSize(10);
  doc.text('Test Print', 3, 10);
  doc.setFontSize(8);
  doc.text('Printer: ' + (document.getElementById('printerPilihan')?.value || 'default'), 3, 18);
  doc.text('Lebar: ' + lebar + 'mm', 3, 24);
  doc.text(new Date().toLocaleString('id-ID'), 3, 30);
  const blob = doc.output('blob');

  if (bluetoothDevice && bluetoothCharacteristic) {
    await cetakViaBluetooth(blob);
  } else {
    const url = URL.createObjectURL(blob);
    const pw = window.open(url, '_blank');
    if (pw) pw.addEventListener('load', () => pw.print(), { once: true });
  }
}