const http = require('http');
const fs = require('fs');
const path = require('path');
const { Store } = require('./store');
const { TutorApi } = require('./api');

const PUBLIC_DIR = path.join(__dirname, '..', 'public');
const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml'
};

function serveStatic(req, res) {
  const url = new URL(req.url, 'http://127.0.0.1');
  let pathname = decodeURIComponent(url.pathname);
  if (pathname === '/') pathname = '/admin/';
  if (pathname === '/admin') pathname = '/admin/';
  if (pathname.startsWith('/admin/') && !path.extname(pathname)) pathname = '/admin/index.html';
  if (pathname.endsWith('/')) pathname += 'index.html';

  const filePath = path.normalize(path.join(PUBLIC_DIR, pathname.replace(/^\/+/, '')));
  if (!filePath.startsWith(PUBLIC_DIR) || !fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Not found');
    return;
  }

  res.writeHead(200, {
    'Content-Type': MIME[path.extname(filePath)] || 'application/octet-stream'
  });
  fs.createReadStream(filePath).pipe(res);
}

function createServer(options = {}) {
  const store = options.store || new Store(options.dbPath);
  store.load();
  const api = new TutorApi(store);
  return http.createServer((req, res) => {
    if (req.url.startsWith('/api/') || req.url.startsWith('/admin-api/')) {
      api.handle(req, res);
      return;
    }
    serveStatic(req, res);
  });
}

function startServer(port = Number(process.env.PORT || 3000), host = process.env.HOST || '0.0.0.0') {
  const server = createServer();
  server.listen(port, host, () => {
    console.log(`郑州大学生家教 MVP 服务已启动：http://${host}:${port}`);
    console.log(`后台管理端：http://${host}:${port}/admin/`);
  });
  return server;
}

if (require.main === module) {
  startServer();
}

module.exports = {
  createServer,
  startServer
};
