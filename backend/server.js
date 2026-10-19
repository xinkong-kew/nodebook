import path from 'node:path';
import fs from 'node:fs';
import express from 'express';
import cors from 'cors';

import { PORT, __dirname } from './config.js';
import notesRouter from './routes/notes.js';
import worksRouter from './routes/works.js';

const app = express();

// 前后端分离：允许前端（不同端口 / 不同来源）跨域访问 API
app.use(cors());
app.use(express.json({ limit: '2mb' }));

// 统一 API 入口
app.use('/api/notes', notesRouter);
app.use('/api/works', worksRouter);

// 健康检查
app.get('/api/health', (req, res) => {
  res.json({ ok: true, time: new Date().toISOString() });
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

app.listen(PORT, () => {
  console.log(`[backend] 笔记网站后端已启动: http://localhost:${PORT}`);
  console.log(`[backend] API 前缀: http://localhost:${PORT}/api`);
});