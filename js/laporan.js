let chartInstance = null;
let topProductsChart = null;

function setDefaultDateFilter() {
  const t = new Date().toISOString().slice(0, 10);
  document.getElementById('tglAwal').value = t;
  document.getElementById('tglAkhir').value = t;
}

function filterToday() { setDefaultDateFilter(); muatLaporan(); }
function filterThisWeek() {
  const n = new Date(), d = n.getDay(), s = new Date(n);
  s.setDate(n.getDate() - d + (d === 0 ? -6 : 1));
  const e = new Date(s); e.setDate(s.getDate() + 6);
  document.getElementById('tglAwal').value = s.toISOString().slice(0, 10);
  document.getElementById('tglAkhir').value = e.toISOString().slice(0, 10);
  muatLaporan();
}
function filterMTD() {
  const n = new Date();
  document.getElementById('tglAwal').value = new Date(n.getFullYear(), n.getMonth(), 1).toISOString().slice(0, 10);
  document.getElementById('tglAkhir').value = n.toISOString().slice(0, 10);
  muatLaporan();
}
function filterYTD() {
  const n = new Date();
  document.getElementById('tglAwal').value = new Date(n.getFullYear(), 0, 1).toISOString().slice(0, 10);
  document.getElementById('tglAkhir').value = n.toISOString().slice(0, 10);
  muatLaporan();
}

async function muatLaporan() {
  const a = document.getElementById('tglAwal').value, b = document.getElementById('tglAkhir').value;
  if (!a || !b) return;
  const all = await getAllTransactions(a + 'T00:00:00', b + 'T23:59:59');
  const tbody = document.querySelector('#reportTable tbody');
  tbody.innerHTML = '';
  if (!all.length) {
    tbody.innerHTML = '<tr><td colspan="5">Tidak ada transaksi</td></tr>';
  } else {
    all.forEach(t => {
      const row = tbody.insertRow();
      row.innerHTML = `<td>${t.no_invoice}</td><td>${new Date(t.tanggal).toLocaleDateString('id-ID')}</td><td>${t.customer || '-'}</td><td>Rp${t.total.toLocaleString('id')}</td><td>
        <button class="btn-sm" onclick="viewInvoice('${t.no_invoice}')">👁️</button>
        <button class="btn-sm" onclick="cetakUlang('${t.no_invoice}')">🖨️</button>
        <button class="btn-sm btn-danger" onclick="hapusTransaksi('${t.no_invoice}')">🗑</button>
      </td>`;
    });
  }
  document.getElementById('totalTransaksi').textContent = all.length;
  document.getElementById('totalPendapatan').textContent = 'Rp' + all.reduce((s, t) => s + t.total, 0).toLocaleString('id');
  renderChart(all, 'daily', a, b);
  renderTopProductsChart(all);
}

async function hapusTransaksi(noInv) {
  if (!confirm(`Hapus transaksi ${noInv}? Stok akan dikembalikan.`)) return;
  const trx = await getTransaction(noInv);
  if (!trx) return alert('Transaksi tidak ditemukan');
  try {
    for (let item of trx.items) {
      const { data: prod } = await supabaseClient.from('products').select('stok').eq('barcode', item.barcode).single();
      if (prod) {
        await supabaseClient.from('products').update({ stok: prod.stok + item.qty }).eq('barcode', item.barcode);
      }
    }
    await deleteTransaction(noInv);
    await supabaseClient.storage.from('invoices').remove([`${noInv}.pdf`]);
    alert('Transaksi dihapus');
    muatLaporan();
  } catch (e) { alert('Gagal menghapus: ' + e.message); }
}

function renderChart(trans, mode, start, end) {
  if (chartInstance) chartInstance.destroy();
  const ctx = document.getElementById('chartPenjualan')?.getContext('2d');
  if (!ctx) return;
  let labels, data;
  if (mode === 'hourly') {
    const hourly = {};
    trans.forEach(t => { const hr = new Date(t.tanggal).getHours(); hourly[hr] = (hourly[hr] || 0) + t.total; });
    labels = Array.from({ length: 24 }, (_, i) => i + ':00');
    data = labels.map((_, i) => hourly[i] || 0);
  } else if (mode === 'daily') {
    const daily = {}; const s = new Date(start), e = new Date(end);
    for (let d = new Date(s); d <= e; d.setDate(d.getDate() + 1)) { daily[d.toISOString().slice(0, 10)] = 0; }
    trans.forEach(t => { const k = t.tanggal.slice(0, 10); if (daily[k] !== undefined) daily[k] += t.total; });
    const keys = Object.keys(daily).sort();
    labels = keys.map(k => new Date(k).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' }));
    data = keys.map(k => daily[k]);
  }
  chartInstance = new Chart(ctx, {
    type: 'bar',
    data: { labels, datasets: [{ label: 'Penjualan (Rp)', data, backgroundColor: '#009688', borderRadius: 4 }] },
    options: { responsive: true, maintainAspectRatio: false, scales: { y: { beginAtZero: true, ticks: { callback: v => 'Rp' + v.toLocaleString('id') } } } }
  });
}

function renderTopProductsChart(trans) {
  if (topProductsChart) topProductsChart.destroy();
  const ctx = document.getElementById('chartTopProducts')?.getContext('2d');
  if (!ctx) return;
  const sales = {};
  trans.forEach(t => { if (t.items) t.items.forEach(i => { const k = i.nama || i.barcode; if (!sales[k]) sales[k] = { nama: i.nama, qty: 0 }; sales[k].qty += i.qty || 1; }); });
  const sorted = Object.values(sales).sort((a, b) => b.qty - a.qty).slice(0, 10);
  const colors = ['#e53935', '#1e88e5', '#fdd835', '#8e24aa', '#fb8c00', '#d81b60', '#00acc1', '#7cb342', '#5e35b1', '#ffb300'];
  topProductsChart = new Chart(ctx, {
    type: 'pie',
    data: { labels: sorted.map(p => p.nama), datasets: [{ data: sorted.map(p => p.qty), backgroundColor: colors.slice(0, sorted.length), borderWidth: 1 }] },
    options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom', labels: { boxWidth: 12, font: { size: 10 } } } } }
  });
}

async function viewInvoice(no) {
  const url = await getInvoiceURL(no);
  if (url) window.open(url, '_blank');
  else alert('Tidak tersedia');
}

async function cetakUlang(no) {
  const url = await getInvoiceURL(no);
  if (url) {
    const pw = window.open(url, '_blank');
    if (pw) pw.addEventListener('load', () => pw.print(), { once: true });
  } else viewInvoice(no);
}

function exportCSV() {
  const tbody = document.querySelector('#reportTable tbody');
  let csv = 'No Invoice,Tanggal,Customer,Total\n';
  tbody.querySelectorAll('tr').forEach(row => {
    const cells = row.querySelectorAll('td');
    if (cells.length >= 4) {
      csv += `"${cells[0].textContent}","${cells[1].textContent}","${cells[2].textContent}","${cells[3].textContent.replace('Rp ', '').replace(/\./g, '')}"\n`;
    }
  });
  const blob = new Blob([csv], { type: 'text/csv' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'laporan.csv';
  a.click();
}