const http = require('http');
const fs = require('fs');
const path = require('path');
const { WebSocketServer } = require('ws');

// Đọc cấu hình từ file .env (nếu có); biến môi trường đặt sẵn trên shell được ưu tiên hơn
try { process.loadEnvFile(path.join(__dirname, '.env')); } catch { }

const PORT = process.env.PORT || 3000;
// BASE_ROUTE: toàn bộ app (trang, file, phòng /:id) nằm dưới tiền tố này, vd. /nes/
let BASE = (process.env.BASE_ROUTE || '/').trim();
if (!BASE.startsWith('/')) BASE = '/' + BASE;
if (!BASE.endsWith('/')) BASE += '/';
// WS_PATH: đường dẫn WebSocket, tính từ BASE_ROUTE (vd. BASE=/nes/ + WS_PATH=/ws -> /nes/ws)
const WS_PATH = BASE + (process.env.WS_PATH || '/ws').trim().replace(/^\/+/, '');
const ROOT = path.join(__dirname, 'public');
const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.nes': 'application/octet-stream',
  '.zip': 'application/zip'
};

const server = http.createServer((req, res) => {
  let pathname;
  try { pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname); }
  catch { res.writeHead(400); return res.end('Bad request'); }
  if (pathname === BASE.slice(0, -1) && BASE !== '/') { res.writeHead(302, { Location: BASE }); return res.end(); }
  if (!pathname.startsWith(BASE)) { res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }); return res.end('Not found'); }
  pathname = pathname.slice(BASE.length - 1);                   // bỏ tiền tố, giữ dấu / đầu
  if (pathname.endsWith('/') || !path.extname(pathname)) pathname = '/index.html'; // /:id trả về trang chính
  const file = path.join(ROOT, pathname);
  if (file !== ROOT && !file.startsWith(ROOT + path.sep)) { res.writeHead(403); return res.end('Forbidden'); }
  fs.readFile(file, (err, data) => {
    if (err) { res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }); return res.end('Not found'); }
    res.writeHead(200, { 'Content-Type': TYPES[path.extname(file).toLowerCase()] || 'application/octet-stream' });
    // báo cho trang biết đường dẫn WebSocket hiện tại
    if (path.extname(file).toLowerCase() === '.html') data = data.toString('utf8')
      .replace('<meta name="ws-path" content="/ws">', '<meta name="ws-path" content="' + WS_PATH.replace(/"/g, '') + '">')
      .replace('<meta name="base-route" content="/">', '<meta name="base-route" content="' + BASE.replace(/"/g, '') + '">');
    res.end(data);
  });
});

// Phòng chơi 2 người + khán giả: server chỉ quản lý chỗ ngồi và chuyển tiếp tin nhắn.
// Mỗi người tự chạy giả lập của mình; ai vào/ra cũng không làm người còn lại bị dừng.
// Người vào khi phòng đã đủ 2 người sẽ là khán giả: nhận ROM + trạng thái từ người chơi cũ nhất (players[0]),
// rồi nhận phím của cả hai người chơi để chạy theo. Có người chơi thoát thì khán giả vào sớm nhất được thay.
const rooms = new Map(); // mã phòng -> { players: [ws] (tối đa 2, mỗi ws có .slot = 0 | 1), specs: [ws] }
const MAX_SPECS = 20;
let nextId = 1;
const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
function newCode() {
  let c;
  do { c = Array.from({ length: 6 }, () => CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)]).join(''); }
  while (rooms.has(c));
  return c;
}
function send(ws, obj) { if (ws && ws.readyState === 1) ws.send(JSON.stringify(obj)); }
function peerOf(ws) {
  const r = ws.room && rooms.get(ws.room);
  return r && r.players.find(m => m !== ws);
}
// nhờ người chơi cũ nhất gửi ROM + trạng thái cho các khán giả chưa được gửi
function askFeeder(r) {
  const feeder = r.players[0];
  if (!feeder || r.players.length < 2) return;
  for (const s of r.specs) if (!s.fed) send(feeder, { t: 'specjoined', id: s.id });
}
// còn chỗ trống thì đưa khán giả vào sớm nhất lên chơi
function fillSeats(r) {
  let promoted = false;
  while (r.players.length < 2 && r.specs.length) {
    const sp = r.specs.shift();
    const other = r.players[0];
    sp.spec = false; sp.slot = other ? 1 - other.slot : 0;
    r.players.push(sp);
    send(sp, { t: 'promoted', slot: sp.slot, solo: !other });
    if (other) send(other, { t: 'peerjoined' });
    promoted = true;
  }
  if (promoted) for (const s of r.specs) { s.fed = false; send(s, { t: 'resync' }); } // trạng thái cũ không còn khớp
  askFeeder(r);
}
function leave(ws) {
  const code = ws.room; if (!code) return;
  ws.room = null; ws.feeding = false; ws.feedTo = null;
  const r = rooms.get(code); if (!r) return;
  if (ws.spec) { ws.spec = false; r.specs = r.specs.filter(m => m !== ws); return; }
  r.players = r.players.filter(m => m !== ws);
  for (const m of r.players) send(m, { t: 'peerleft' });
  fillSeats(r);
  if (!r.players.length && !r.specs.length) rooms.delete(code);
}
const RELAY = new Set(['rom', 'romend', 'snap', 'snapend', 'ready', 'go', 'in', 'rtc']);
const FEED = new Set(['rom', 'romend', 'snap', 'snapend']); // gửi riêng cho 1 khán giả khi người chơi đang "feed"

const wss = new WebSocketServer({ server, path: WS_PATH, maxPayload: 1 << 20 });
wss.on('connection', ws => {
  ws.room = null; ws.slot = 0; ws.id = nextId++; ws.spec = false; ws.fed = false; ws.feeding = false; ws.feedTo = null;
  ws.on('message', (raw, isBinary) => {
    if (isBinary) {
      if (ws.spec) return;
      const o = ws.feeding ? ws.feedTo : peerOf(ws);          // dữ liệu nhị phân của ROM/trạng thái
      if (o && o.readyState === 1) o.send(raw, { binary: true });
      return;
    }
    let m; try { m = JSON.parse(raw); } catch { return; }
    if (!m || typeof m.t !== 'string') return;
    if (m.t === 'create') {
      leave(ws);
      const code = newCode();
      ws.slot = 0; rooms.set(code, { players: [ws], specs: [] }); ws.room = code;
      send(ws, { t: 'created', room: code, slot: 0 });
    } else if (m.t === 'join') {
      leave(ws);
      const code = String(m.room || '').toUpperCase().trim();
      const r = rooms.get(code);
      if (!r) return send(ws, { t: 'error', msg: 'Phòng ' + code + ' không tồn tại.' });
      if (r.players.length >= 2) {                            // đủ người chơi -> làm khán giả
        if (r.specs.length >= MAX_SPECS) return send(ws, { t: 'error', msg: 'Phòng đã đầy.' });
        ws.room = code; ws.spec = true; ws.fed = false;
        r.specs.push(ws);
        send(ws, { t: 'spectating' });
        askFeeder(r);
      } else {
        const other = r.players[0];
        ws.slot = other.slot === 0 ? 1 : 0;
        r.players.push(ws); ws.room = code;
        send(ws, { t: 'joined', slot: ws.slot });
        send(other, { t: 'peerjoined' });
      }
    } else if (ws.spec) {
      if (m.t === 'leave') leave(ws);                         // khán giả chỉ được rời phòng
    } else if (m.t === 'feed') {
      const r = ws.room && rooms.get(ws.room);
      ws.feeding = true; ws.feedTo = (r && r.specs.find(s => s.id === m.id)) || null;
    } else if (m.t === 'feedend') {
      if (ws.feedTo) ws.feedTo.fed = true;
      ws.feeding = false; ws.feedTo = null;
    } else if (RELAY.has(m.t)) {
      if (ws.feeding && FEED.has(m.t)) return send(ws.feedTo, m);
      if (m.t === 'in') {                                     // khán giả nhận phím của cả hai người chơi
        const r = ws.room && rooms.get(ws.room);
        if (r) for (const s of r.specs) send(s, { t: 'in', f: m.f, v: m.v, s: ws.slot });
      }
      send(peerOf(ws), m);
    } else if (m.t === 'leave') {
      leave(ws);
    }
  });
  ws.on('close', () => leave(ws));
  ws.on('error', () => { });
});

server.listen(PORT, () => console.log(`Server chạy tại http://localhost:${PORT}${BASE} (thư mục gốc: ${BASE}, WebSocket: ${WS_PATH})`));
