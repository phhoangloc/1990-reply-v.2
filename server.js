const http = require('http');
const fs = require('fs');
const path = require('path');
const { WebSocketServer } = require('ws');

const PORT = process.env.PORT || 3000;
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
  if (pathname.endsWith('/') || !path.extname(pathname)) pathname = '/index.html'; // /:id trả về trang chính
  const file = path.join(ROOT, pathname);
  if (file !== ROOT && !file.startsWith(ROOT + path.sep)) { res.writeHead(403); return res.end('Forbidden'); }
  fs.readFile(file, (err, data) => {
    if (err) { res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }); return res.end('Not found'); }
    res.writeHead(200, { 'Content-Type': TYPES[path.extname(file).toLowerCase()] || 'application/octet-stream' });
    res.end(data);
  });
});

// Phòng chơi 2 người: server chỉ quản lý chỗ ngồi và chuyển tiếp tin nhắn giữa 2 client.
// Mỗi người tự chạy giả lập của mình; ai vào/ra cũng không làm người còn lại bị dừng.
const rooms = new Map(); // mã phòng -> [ws, ...] (tối đa 2, mỗi ws có .slot = 0 | 1)
const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
function newCode() {
  let c;
  do { c = Array.from({ length: 6 }, () => CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)]).join(''); }
  while (rooms.has(c));
  return c;
}
function send(ws, obj) { if (ws && ws.readyState === 1) ws.send(JSON.stringify(obj)); }
function peerOf(ws) {
  const members = ws.room && rooms.get(ws.room);
  return members && members.find(m => m !== ws);
}
function leave(ws) {
  const code = ws.room; if (!code) return;
  ws.room = null;
  const members = rooms.get(code); if (!members) return;
  const rest = members.filter(m => m !== ws);
  if (rest.length) { rooms.set(code, rest); for (const m of rest) send(m, { t: 'peerleft' }); }
  else rooms.delete(code);
}
const RELAY = new Set(['rom', 'romend', 'snap', 'snapend', 'ready', 'go', 'in']);

const wss = new WebSocketServer({ server, path: '/ws', maxPayload: 1 << 20 });
wss.on('connection', ws => {
  ws.room = null; ws.slot = 0;
  ws.on('message', (raw, isBinary) => {
    if (isBinary) { const o = peerOf(ws); if (o && o.readyState === 1) o.send(raw, { binary: true }); return; }
    let m; try { m = JSON.parse(raw); } catch { return; }
    if (!m || typeof m.t !== 'string') return;
    if (m.t === 'create') {
      leave(ws);
      const code = newCode();
      ws.slot = 0; rooms.set(code, [ws]); ws.room = code;
      send(ws, { t: 'created', room: code, slot: 0 });
    } else if (m.t === 'join') {
      leave(ws);
      const code = String(m.room || '').toUpperCase().trim();
      const members = rooms.get(code);
      if (!members) return send(ws, { t: 'error', msg: 'Phòng ' + code + ' không tồn tại.' });
      if (members.length >= 2) return send(ws, { t: 'error', msg: 'Phòng đã đủ 2 người.' });
      const other = members[0];
      ws.slot = other.slot === 0 ? 1 : 0;
      members.push(ws); ws.room = code;
      send(ws, { t: 'joined', slot: ws.slot });
      send(other, { t: 'peerjoined' });
    } else if (RELAY.has(m.t)) {
      send(peerOf(ws), m);
    } else if (m.t === 'leave') {
      leave(ws);
    }
  });
  ws.on('close', () => leave(ws));
  ws.on('error', () => { });
});

server.listen(PORT, () => console.log(`Server chạy tại http://localhost:${PORT} (WebSocket: /ws)`));
