/* Owner-present read-only Google reports. Access tokens remain in memory only. */
const metricsSettingsKey = '2pro-google-report-settings';
const GSC_SCOPE = 'https://www.googleapis.com/auth/webmasters.readonly';
const GA4_SCOPE = 'https://www.googleapis.com/auth/analytics.readonly';
let gscToken = '', ga4Token = '', metricsData = null, gisReady = false;

function metricsMessage(message, status) {
  $('metrics-message').textContent = message;
  if (status) $('metrics-status').textContent = status;
}
function saveMetricsSettings() {
  localStorage.setItem(metricsSettingsKey, JSON.stringify({ clientId: $('google-client-id').value.trim(), site: $('gsc-property').value.trim(), property: $('ga4-property').value.trim() }));
}
function metricBase() {
  const base = localStorage.getItem('2pro-public-reader-url');
  if (!base) throw new Error('Hãy kết nối Worker WordPress ở đầu trang trước.');
  return cleanWorkerUrl(base);
}
function currentClientId() {
  const value = $('google-client-id').value.trim();
  if (!/^[a-zA-Z0-9-]+\.apps\.googleusercontent\.com$/.test(value)) throw new Error('Google Client ID chưa đúng.');
  saveMetricsSettings();
  return value;
}
function updateMetricsButton() { $('metrics-refresh').disabled = !gscToken && !ga4Token; }

async function loadGIS() {
  if (window.google?.accounts?.oauth2) { gisReady = true; return; }
  await new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.onload = resolve;
    script.onerror = () => reject(new Error('Không tải được cửa sổ kết nối Google.'));
    document.head.appendChild(script);
  });
  gisReady = true;
}

async function connectGoogle(kind) {
  try {
    metricBase();
    const clientId = currentClientId();
    if (!gisReady) { await loadGIS(); metricsMessage('Google đã sẵn sàng. Bấm lại nút kết nối để mở cửa sổ cấp quyền.', 'Sẵn sàng'); return; }
    const scope = kind === 'gsc' ? GSC_SCOPE : GA4_SCOPE;
    const client = window.google.accounts.oauth2.initTokenClient({
      client_id: clientId,
      scope,
      callback: result => {
        if (result.error || !result.access_token || !String(result.scope || '').split(' ').includes(scope)) {
          metricsMessage('Google chưa cấp đủ quyền chỉ đọc. Hãy thử kết nối lại.', 'Chưa kết nối');
          return;
        }
        if (kind === 'gsc') gscToken = result.access_token;
        else ga4Token = result.access_token;
        updateMetricsButton();
        metricsMessage(`${gscToken ? 'GSC đã kết nối' : 'GSC chưa kết nối'} · ${ga4Token ? 'GA4 đã kết nối' : 'GA4 chưa kết nối'}. Bấm Cập nhật số liệu.`, 'Đã kết nối');
      }
    });
    client.requestAccessToken({ prompt: 'consent' });
  } catch (error) { metricsMessage(error.message, 'Chưa kết nối'); }
}

async function privateGet(path, token) {
  const result = await fetch(metricBase() + path, { headers: { Authorization: 'Bearer ' + token }, cache: 'no-store' });
  const body = await result.json().catch(() => ({}));
  if (!result.ok) throw new Error(body.error || `Worker trả mã ${result.status}.`);
  return body;
}

function metricUrl(input) {
  try { const url = new URL(input); url.hash = ''; url.search = ''; return url.origin.toLowerCase() + url.pathname.replace(/\/$/, '').toLowerCase(); }
  catch { return ''; }
}
function mergeMetrics(gsc, ga4) {
  const map = new Map();
  const get = url => { const key = metricUrl(url); if (!key) return null; if (!map.has(key)) map.set(key, { url: key, gsc: { current: null, previous: null }, ga4: { current: null, previous: null } }); return map.get(key); };
  if (gsc) for (const period of ['current', 'previous']) for (const row of gsc[period].rows) {
    const target = get(row.url); if (!target) continue;
    if (!target.sourceUrl || (!row.url.includes('#') && target.sourceUrl.includes('#'))) target.sourceUrl = row.url;
    const old = target.gsc[period] || { clicks: 0, impressions: 0, position: 0 };
    const impressions = old.impressions + row.impressions;
    target.gsc[period] = { clicks: old.clicks + row.clicks, impressions, position: impressions ? (old.position * old.impressions + row.position * row.impressions) / impressions : 0 };
  }
  if (ga4) for (const period of ['current', 'previous']) for (const row of ga4[period].rows) {
    if (!['2pro.biz', 'www.2pro.biz'].includes(row.host.toLowerCase()) || !row.path.startsWith('/')) continue;
    const target = get('https://' + row.host.toLowerCase() + row.path); if (!target) continue;
    if (!target.ga4[period]) target.ga4[period] = { sessions: 0, engagedSessions: 0 };
    target.ga4[period].sessions += row.sessions;
    target.ga4[period].engagedSessions += row.engagedSessions;
  }
  return [...map.values()];
}
function percent(current, previous) {
  if (!previous) return current ? 'mới' : '—';
  const value = Math.round((current - previous) / previous * 100);
  return (value > 0 ? '+' : '') + value + '%';
}
function needsReview(row) {
  const gNow = row.gsc.current?.clicks || 0, gPrev = row.gsc.previous?.clicks || 0;
  const aNow = row.ga4.current?.sessions || 0, aPrev = row.ga4.previous?.sessions || 0;
  return (gPrev >= 10 && gNow <= gPrev * .7) || (aPrev >= 20 && aNow <= aPrev * .7);
}
function titleFor(url) { return analysisPages().find(p => metricUrl(p.url) === metricUrl(url))?.title || url; }

function renderMetrics() {
  if (!metricsData) return;
  const titleMap = new Map(analysisPages().map(p => [metricUrl(p.url), p.title]));
  const title = url => titleMap.get(metricUrl(url)) || url;
  const filter = fold($('metrics-filter').value.trim()), sort = $('metrics-sort').value;
  const rows = metricsData.rows.filter(r => !filter || fold(title(r.url) + ' ' + r.url).includes(filter));
  const clicks = r => r.gsc.current?.clicks || 0, lost = r => (r.gsc.previous?.clicks || 0) - clicks(r);
  rows.sort((a, b) => sort === 'gain' ? lost(a) - lost(b) : sort === 'clicks' ? clicks(b) - clicks(a) : sort === 'decline' ? lost(b) - lost(a) : Number(needsReview(b)) - Number(needsReview(a)) || lost(b) - lost(a));
  const range = metricsData.range;
  $('metrics-period').textContent = `Kỳ mới: ${range.current.start} → ${range.current.end}. Kỳ trước: ${range.previous.start} → ${range.previous.end}. ${metricsData.limited ? 'Có nguồn đã chạm giới hạn dòng.' : ''}`;
  $('metrics-list').innerHTML = rows.length ? rows.slice(0, 300).map(r => {
    const gc = r.gsc.current?.clicks || 0, gp = r.gsc.previous?.clicks || 0;
    const ac = r.ga4.current?.sessions || 0, ap = r.ga4.previous?.sessions || 0;
    return `<button class="metrics-row" type="button" data-metrics-url="${esc(r.url)}"><span class="metrics-row-main"><strong>${esc(title(r.url))}</strong><small>${esc(r.url)}</small></span><span class="metrics-numbers"><span>GSC clicks <strong>${gscToken ? fmt(gc) : '—'}</strong><small>${gscToken ? esc(percent(gc, gp)) : 'Chưa kết nối'}</small></span><span>GA4 Organic <strong>${ga4Token ? fmt(ac) : '—'}</strong><small>${ga4Token ? esc(percent(ac, ap)) + ' phiên' : 'Chưa kết nối'}</small></span><span class="${needsReview(r) ? 'review-flag' : 'steady-flag'}">${needsReview(r) ? 'Cần kiểm tra' : 'Theo dõi'}</span></span></button>`;
  }).join('') : 'Không có URL phù hợp trong báo cáo.';
}

async function refreshMetrics() {
  if (!gscToken && !ga4Token) return;
  saveMetricsSettings();
  const site = $('gsc-property').value.trim(), property = $('ga4-property').value.trim();
  if (gscToken && !['sc-domain:2pro.biz', 'https://2pro.biz/', 'https://www.2pro.biz/'].includes(site)) { metricsMessage('Nhập đúng tên GSC property của 2pro.biz.', 'Thiếu thông tin'); return; }
  if (ga4Token && !/^\d{5,15}$/.test(property)) { metricsMessage('Nhập GA4 Property ID dạng số.', 'Thiếu thông tin'); return; }
  $('metrics-refresh').disabled = true;
  try {
    metricsMessage('Đang đọc dữ liệu Google…', 'Đang cập nhật');
    const [gsc, ga4] = await Promise.all([
      gscToken ? privateGet('/api/gsc?site=' + encodeURIComponent(site), gscToken) : null,
      ga4Token ? privateGet('/api/ga4?property=' + encodeURIComponent(property), ga4Token) : null
    ]);
    metricsData = { range: gsc?.range || ga4?.range, rows: mergeMetrics(gsc, ga4), limited: Boolean(gsc?.current.limited || gsc?.previous.limited || ga4?.current.limited || ga4?.previous.limited) };
    renderMetrics();
    metricsMessage(`Đã đọc ${fmt(metricsData.rows.length)} URL. Chọn một URL để xem chi tiết.`, 'Đã cập nhật');
  } catch (error) { metricsMessage(`Không lấy được báo cáo: ${error.message}`, 'Có lỗi'); }
  finally { updateMetricsButton(); }
}

async function showMetricDetail(url) {
  const row = metricsData?.rows.find(r => r.url === url); if (!row) return;
  const box = $('metrics-detail'); box.textContent = 'Đang đọc query GSC…';
  try {
    const site = $('gsc-property').value.trim();
    const data = gscToken && row.sourceUrl ? await privateGet('/api/gsc/queries?site=' + encodeURIComponent(site) + '&url=' + encodeURIComponent(row.sourceUrl), gscToken) : { rows: [] };
    const qs = data.rows.sort((a, b) => b.clicks - a.clicks || b.impressions - a.impressions).slice(0, 30);
    box.innerHTML = `<h3>${esc(titleFor(row.url))}</h3><a href="${esc(row.url)}" target="_blank" rel="noopener noreferrer">${esc(row.url)}</a><p class="meta">GSC: ${gscToken ? fmt(row.gsc.current?.clicks || 0) + ' clicks' : 'chưa kết nối'}. GA4 Organic Search: ${ga4Token ? fmt(row.ga4.current?.sessions || 0) + ' phiên' : 'chưa kết nối'}.</p><h4>Query GSC trong kỳ mới</h4>${qs.length ? `<ol class="mini-list">${qs.map(q => `<li>${esc(q.query)} · ${fmt(q.clicks)} clicks · ${fmt(q.impressions)} hiển thị · vị trí ${fmt(q.position)}</li>`).join('')}</ol>` : '<p class="meta">Chưa có query được trả về cho URL này.</p>'}<p class="meta">Biến động là tín hiệu cần kiểm tra; chưa xác định nguyên nhân xếp hạng. Query hiếm có thể không xuất hiện trong API.</p>`;
  } catch (error) { box.textContent = 'Không đọc được query: ' + error.message; }
}

$('connect-gsc').onclick = () => connectGoogle('gsc');
$('connect-ga4').onclick = () => connectGoogle('ga4');
$('metrics-refresh').onclick = refreshMetrics;
$('metrics-filter').oninput = renderMetrics;
$('metrics-sort').onchange = renderMetrics;
$('metrics-list').onclick = event => { const item = event.target.closest('[data-metrics-url]'); if (item) showMetricDetail(item.dataset.metricsUrl); };
try {
  const settings = JSON.parse(localStorage.getItem(metricsSettingsKey) || '{}');
  $('google-client-id').value = settings.clientId || '';
  $('gsc-property').value = settings.site || '';
  $('ga4-property').value = settings.property || '';
} catch { /* Browser storage may be disabled. */ }
document.querySelector('[data-tab="metrics"]').addEventListener('click', () => loadGIS().catch(error => metricsMessage(error.message, 'Có lỗi')));
