/* The public WordPress sync runs only when this dashboard is open. */
const workerKey = '2pro-public-reader-url';
let liveBusy = false;

function cleanWorkerUrl(value) {
  const parsed = new URL(value.trim());
  if (parsed.protocol !== 'https:' || parsed.search || parsed.hash || (parsed.pathname !== '/' && parsed.pathname !== '')) {
    throw new Error('Nhập địa chỉ HTTPS gốc của Worker, không kèm đường dẫn.');
  }
  return parsed.origin;
}

function liveStatus(message, badge) {
  $('live-message').textContent = message;
  if (badge) $('live-status').textContent = badge;
}

async function checkWorker(base) {
  const response = await fetch(base + '/health', { cache: 'no-store' });
  if (!response.ok || (await response.json()).service !== '2pro-public-reader') throw new Error('Địa chỉ này chưa trả về dịch vụ đọc 2Pro.');
}

async function readCatalog(base, type) {
  const collected = [];
  for (let page = 1; page <= 100; page++) {
    liveStatus(`Đang đọc ${type === 'blog' ? 'bài viết' : 'sản phẩm'}: trang ${page}, đã nhận ${fmt(collected.length)} URL…`, 'Đang đồng bộ');
    const response = await fetch(`${base}/api/catalog?type=${type}&page=${page}&per_page=100`, { cache: 'no-store' });
    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      throw new Error(body.error || `Dịch vụ trả mã ${response.status}.`);
    }
    const result = await response.json();
    if (!Array.isArray(result.items) || result.type !== type) throw new Error('Cấu trúc dữ liệu không đúng.');
    for (const item of result.items) {
      try {
        const host = new URL(item.url).hostname;
        if (host === '2pro.biz' || host === 'www.2pro.biz') collected.push(item);
      } catch { /* Skip a malformed URL. */ }
    }
    if (!result.hasMore) return collected;
  }
  throw new Error('Dừng ở giới hạn 100 trang dữ liệu; chưa lưu bản quét chưa đầy đủ.');
}

async function syncLive(silent = false) {
  if (liveBusy) return;
  const base = localStorage.getItem(workerKey);
  if (!base) { if (!silent) liveStatus('Hãy lưu địa chỉ Worker trước.', 'Chưa kết nối'); return; }
  liveBusy = true;
  $('sync-live').disabled = true;
  try {
    await checkWorker(base);
    const blogs = await readCatalog(base, 'blog');
    const products = await readCatalog(base, 'product');
    const pages = dedupePages([...blogs, ...products]);
    const at = new Date().toISOString();
    state.livePages = pages;
    state.liveSyncedAt = at;
    try { await dbWrite(state); }
    catch { liveStatus('Đã tải nội dung nhưng trình duyệt không lưu được cho lần sau. Hãy kiểm tra dung lượng lưu trữ.', 'Chỉ dùng phiên này'); render(); return; }
    render();
    liveStatus(`Đã đọc ${fmt(blogs.length)} bài viết và ${fmt(products.length)} sản phẩm công khai lúc ${new Date(at).toLocaleString('vi-VN')}.`, 'Đã đồng bộ');
  } catch (error) {
    liveStatus(`Chưa đồng bộ được: ${error.message}. Dữ liệu cũ vẫn được giữ.`, 'Lỗi kết nối');
  } finally {
    liveBusy = false;
    $('sync-live').disabled = false;
  }
}

$('save-worker').onclick = async () => {
  try {
    const base = cleanWorkerUrl($('worker-url').value);
    liveStatus('Đang kiểm tra địa chỉ…', 'Đang kiểm tra');
    await checkWorker(base);
    localStorage.setItem(workerKey, base);
    liveStatus('Đã lưu địa chỉ. Bấm “Đồng bộ ngay” để quét nội dung.', 'Sẵn sàng');
  } catch (error) { liveStatus(`Không lưu được: ${error.message}`, 'Chưa kết nối'); }
};
$('sync-live').onclick = () => syncLive();

window.appReady.then(() => {
  const saved = localStorage.getItem(workerKey);
  if (!saved) return;
  $('worker-url').value = saved;
  const last = Date.parse(state.liveSyncedAt || '') || 0;
  if (Date.now() - last >= 24 * 60 * 60 * 1000) syncLive(true);
  else liveStatus(`Lần quét gần nhất: ${new Date(last).toLocaleString('vi-VN')}.`, 'Đã kết nối');
});
