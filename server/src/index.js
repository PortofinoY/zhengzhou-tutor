const http = require('http');
const fs = require('fs');
const path = require('path');
const { TutorApi } = require('./api');
const { createWechatClient } = require('./wechat');
const { createDataStore } = require('./stores');
const {
  nodeEnvironment,
  resolveDataDriver,
  resolveAllowMockFeatures,
  resolveSeedDemoData,
  validateRuntimeConfiguration
} = require('./runtime-config');

const PUBLIC_DIR = path.join(__dirname, '..', 'public');
const DEFAULT_UPLOAD_DIR = path.join(PUBLIC_DIR, 'uploads');
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

function serveStatic(req, res, uploadDir = DEFAULT_UPLOAD_DIR) {
  const url = new URL(req.url, 'http://127.0.0.1');
  let pathname = decodeURIComponent(url.pathname);
  if (pathname === '/') pathname = '/admin/';
  if (pathname === '/admin') pathname = '/admin/';
  if (pathname.startsWith('/admin/') && !path.extname(pathname)) pathname = '/admin/index.html';
  if (pathname.endsWith('/')) pathname += 'index.html';

  const isUpload = pathname.startsWith('/uploads/');
  const rootDir = isUpload ? uploadDir : PUBLIC_DIR;
  const relativePath = isUpload ? pathname.slice('/uploads/'.length) : pathname.replace(/^\/+/, '');
  const filePath = path.normalize(path.join(rootDir, relativePath));
  const isInsideRoot = filePath === rootDir || filePath.startsWith(`${rootDir}${path.sep}`);
  if (!isInsideRoot || !fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Not found');
    return;
  }

  res.writeHead(200, {
    'Content-Type': MIME[path.extname(filePath)] || 'application/octet-stream'
  });
  fs.createReadStream(filePath).pipe(res);
}

async function createServer(options = {}) {
  const environment = options.environment || process.env;
  validateRuntimeConfiguration(environment);
  const dataDriver = options.store
    ? (options.store.driver || resolveDataDriver(environment))
    : resolveDataDriver(environment);
  if (nodeEnvironment(environment) === 'production' && dataDriver !== 'mysql') {
    throw new Error('production 环境必须使用 MysqlStore，禁止注入 JSON Store');
  }
  const allowMockFeatures = resolveAllowMockFeatures(environment, options.allowMockFeatures);
  const seedDemoData = resolveSeedDemoData(environment, options.seedDemoData);
  const uploadDir = options.uploadDir || DEFAULT_UPLOAD_DIR;
  const store = options.store || createDataStore({
    ...options,
    environment,
    seedDemoData
  });
  if (typeof store.initialize === 'function') {
    await store.initialize();
  } else {
    await store.load();
  }
  const wechatClient = options.wechatClient || createWechatClient({ environment });
  const api = new TutorApi(store, {
    wechatClient,
    allowMockFeatures,
    environment,
    uploadDir
  });
  const server = http.createServer((req, res) => {
    if (req.url.startsWith('/api/') || req.url.startsWith('/admin-api/')) {
      api.handle(req, res);
      return;
    }
    serveStatic(req, res, uploadDir);
  });
  server.once('close', () => {
    if (typeof store.close === 'function') {
      Promise.resolve(store.close()).catch((error) => {
        console.error(`数据连接关闭失败：${error.message}`);
      });
    }
  });
  return server;
}

async function startServer(port = Number(process.env.PORT || 3000), host = process.env.HOST || '0.0.0.0') {
  const server = await createServer();
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, host, () => {
      server.off('error', reject);
      console.log(`郑州大学生家教 MVP 服务已启动：http://${host}:${port}`);
      console.log(`后台管理端：http://${host}:${port}/admin/`);
      resolve();
    });
  });
  return server;
}

if (require.main === module) {
  startServer().catch((error) => {
    console.error(`服务启动失败：${error.message}`);
    process.exitCode = 1;
  });
}

module.exports = {
  createServer,
  startServer
};
