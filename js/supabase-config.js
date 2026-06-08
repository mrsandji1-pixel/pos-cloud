// Supabase Configuration
const SUPABASE_URL = 'https://cnpofyfgcmbvmvkvqwzn.supabase.co';   // GANTI
const SUPABASE_ANON_KEY = 'sb_publishable_gG5sImRjUWFEACKhu7F3vg_0z25eK0t'; // GANTI
const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Global variables
let currentUser = null;
let workingDirHandle = null;
let logoTokoDihapus = false;
let activeTab = 'transaksi';

// ===================== SUPABASE FUNCTIONS =====================
async function getSettings() {
  const { data } = await supabaseClient.from('settings').select('*').eq('id', 1).single();
  return data || {};
}

async function updateSettings(s) { await supabaseClient.from('settings').upsert({ id: 1, ...s }); }

async function getAllProducts() {
  const { data } = await supabaseClient.from('products').select('*').order('nama');
  return data || [];
}

async function getProductByBarcode(barcode) {
  const { data } = await supabaseClient.from('products').select('*').eq('barcode', barcode).single();
  return data || null;
}

async function upsertProduct(p) {
  const { error } = await supabaseClient.from('products').upsert(p);
  if (error) throw error;
}

async function deleteProduct(barcode) {
  const { error } = await supabaseClient.from('products').delete().eq('barcode', barcode);
  if (error) throw error;
}

async function getAllTransactions(start, end) {
  let q = supabaseClient.from('transactions').select('*').order('tanggal', { ascending: false });
  if (start) q = q.gte('tanggal', start);
  if (end) { const e = new Date(end); e.setDate(e.getDate()+1); q = q.lt('tanggal', e.toISOString()); }
  const { data } = await q;
  return data || [];
}

async function getTransaction(noInv) {
  const { data } = await supabaseClient.from('transactions').select('*').eq('no_invoice', noInv).single();
  return data || null;
}

async function insertTransaction(trx) {
  const { error } = await supabaseClient.from('transactions').insert(trx);
  if (error) throw error;
}

async function deleteTransaction(noInv) {
  const { error } = await supabaseClient.from('transactions').delete().eq('no_invoice', noInv);
  if (error) throw error;
}

async function uploadInvoicePDF(no, blob) {
  await supabaseClient.storage.from('invoices').upload(`${no}.pdf`, blob, { contentType:'application/pdf', upsert:true });
}

async function getInvoiceURL(no) {
  const { data } = supabaseClient.storage.from('invoices').getPublicUrl(`${no}.pdf`);
  return data?.publicUrl || null;
}

function toBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// ===================== FUNGSI BARU UNTUK UPLOAD FOTO PRODUK =====================
async function uploadProductPhoto(file) {
  const fileName = `${Date.now()}_${file.name}`;
  const { data, error } = await supabaseClient.storage
    .from('product-photos')
    .upload(fileName, file, { cacheControl: '3600', upsert: true });

  if (error) throw error;

  // Dapatkan URL publik
  const { data: urlData } = supabaseClient.storage
    .from('product-photos')
    .getPublicUrl(fileName);

  return urlData.publicUrl;
}

async function removeProductPhoto(url) {
  // Ekstrak nama file dari URL
  const fileName = url.split('/').pop();
  if (fileName) {
    await supabaseClient.storage.from('product-photos').remove([fileName]);
  }
}