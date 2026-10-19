import path from 'node:path';
import fs from 'node:fs';
import express from 'express';
import cors from 'cors';

import { PORT, __dirname } from './config.js';
import { ping, dbInfo } from './db.js';
import notesRouter from './routes/notes.js';
import worksRouter from './routes/works.js';

const app = express();

// 前后端分离：允许前端（不同端口 / 不同来源）跨域访问 API
app.use(cors());
app.use(express.json({ limit: '2mb' }));

// 统一 API 入口
app.use('/api/notes', notesRouter);
app.use('/api/works', worksRouter);

// 健康检查（同时探测 MySQL 连通性）
app.get('/api/health', async (req, res) => {
  try {
    await ping();
    res.json({ ok: true, db: 'up', time: new Date().toISOString() });
  } catch (e) {
    res.status(500).json({ ok: false, db: 'down', message: e.message });
  }
});

// 生产环境：托管前端打包产物 frontend/dist（存在时才生效）
const DIST_DIR = path.join(__dirname, '..', 'frontend', 'dist');
if (fs.existsSync(DIST_DIR)) {
  app.use(express.static(DIST_DIR));
  // SPA 回退：非 /api 的 GET 请求统一返回 index.html
  app.get(/^(?!\/api).*/, (req, res) => {
    res.sendFile(path.join(DIST_DIR, 'index.html'));
  });
}

// 404 兜底
app.use((req, res) => {
  res.status(404).json({ ok: false, message: '接口不存在' });
});

// 错误处理
app.use((err, req, res, next) => {
  console.error('[server error]', err);
  res.status(err.status || 500).json({ ok: false, message: err.message || '服务器内部错误' });
});

app.listen(PORT, async () => {
  console.log(`[backend] 笔记网站后端已启动: http://localhost:${PORT}`);
  console.log(`[backend] API 前缀: http://localhost:${PORT}/api`);

  // 启动自检：确认 MySQL 连接是否正常
  try {
    await ping();
    console.log(`[backend] MySQL 连接正常: ${dbInfo()}`);
  } catch (e) {
    console.error(`[backend] MySQL 连接失败: ${e.message}`);
    console.error(
      `[backend] 请检查环境变量 DB_HOST/DB_PORT/DB_USER/DB_PASSWORD/DB_NAME，` +
        `并确认已执行 npm run db:init（当前配置: ${dbInfo()}）`
    );
  }
});