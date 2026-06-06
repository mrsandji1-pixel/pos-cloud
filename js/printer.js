let bluetoothDevice = null;
let bluetoothCharacteristic = null;

async function sambungPrinter() {
  try {
    bluetoothDevice = await navigator.bluetooth.requestDevice({
      acceptAllDevices: true,
      optionalServices: ['000018f0-0000-1000-8000-00805f9b34fb'] // Generic printer service
    });
    const server = await bluetoothDevice.gatt.connect();
    const service = await server.getPrimaryService('000018f0-0000-1000-8000-00805f9b34fb');
    bluetoothCharacteristic = await service.getCharacteristic('00002af1-0000-1000-8000-00805f9b34fb');

    updateStatusPrinter(true);
    alert('Printer terhubung!');
  } catch (e) {
    console.error(e);
    updateStatusPrinter(false);
    alert('Gagal menghubungkan printer: ' + e.message);
  }
}

function putusPrinter() {
  if (bluetoothDevice && bluetoothDevice.gatt.connected) {
    bluetoothDevice.gatt.disconnect();
  }
  bluetoothDevice = null;
  bluetoothCharacteristic = null;
  updateStatusPrinter(false);
}

function updateStatusPrinter(connected) {
  // Update LED di tab Transaksi
  const ledTrans = document.getElementById('ledTrans');
  const statusText = document.getElementById('printerStatusText');
  const btnPutus = document.getElementById('btnPutusTrans');
  if (ledTrans) {
    ledTrans.className = 'led ' + (connected ? 'led-green' : 'led-red');
    statusText.textContent = connected ? 'Printer terhubung' : 'Printer tidak terhubung';
    btnPutus.style.display = connected ? 'inline-block' : 'none';
  }
  // Update di tab Setting
  const ledSet = document.getElementById('ledSetting');
  const btnSambung = document.getElementById('btnSambungPrinter');
  const btnPutusSet = document.getElementById('btnPutusPrinter');
  if (ledSet) {
    ledSet.className = 'led ' + (connected ? 'led-green' : 'led-red');
    btnSambung.style.display = connected ? 'none' : 'inline-block';
    btnPutusSet.style.display = connected ? 'inline-block' : 'none';
  }
}

async function cetakViaBluetooth(pdfBlob) {
  if (!bluetoothCharacteristic) throw new Error('Printer tidak terhubung');
  const arrayBuffer = await pdfBlob.arrayBuffer();
  const chunkSize = 512;
  for (let i = 0; i < arrayBuffer.byteLength; i += chunkSize) {
    const chunk = arrayBuffer.slice(i, i + chunkSize);
    await bluetoothCharacteristic.writeValue(chunk);
  }
}

async function testPrintBluetooth() {
  if (!bluetoothCharacteristic) return alert('Hubungkan printer dulu');
  const encoder = new TextEncoder();
  const testText = '\x1B\x40\x1B\x21\x00Test Print Bluetooth\n\n';
  await bluetoothCharacteristic.writeValue(encoder.encode(testText));
  alert('Test print berhasil');
}