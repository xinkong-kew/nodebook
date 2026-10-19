#!/usr/bin/env node
/**
 * 一次性初始化脚本（在 backend 目录下执行）
 *
 *   1. 创建数据库与 works 表（执行 sql/schema.sql）
 *   2. 把历史作品数据 backend/data/works.json 导入 MySQL
 *      （笔记不走数据库，仍以 backend/data/notes 下的 .md 文件为准）
 *
 * 用法：
 *   node scripts/init-db.js                # 建库建表 + 导入（已存在的记录跳过）
 *   node scripts/init-db.js --overwrite    # 已存在的记录用 works.json 覆盖
 *   node scripts/init-db.js --skip-import  # 只建库建表，不导入数据
 *
 * 连接信息由环境变量提供：DB_HOST / DB_PORT / DB_USER / DB_PASSWORD / DB_NAME
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import mysql from 'mysql2/promise';

import { DB, WORKS_FILE, __dirname } from '../config.js';

function toDatetime(value) {
  const s = String(value || '').replace('T', ' ').replace('Z', '');
  return s.slice(0, 19);
}

// 读取本地作品 JSON
async function readWorksFromDisk() {
  try {
    const raw = await fs.readFile(WORKS_FILE, 'utf-8');
    const data = JSON.parse(raw);
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

async function importWorks(conn, overwrite) {
  const works = await readWorksFromDisk();
  const sql = overwrite
    ? `INSERT INTO works (id, title, description, cover, link, tags, status, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE title = VALUES(title), description = VALUES(description),
                               cover = VALUES(cover), link = VALUES(link),
                               tags = VALUES(tags), status = VALUES(status)`
    : `INSERT IGNORE INTO works
       (id, title, description, cover, link, tags, status, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`;

  const now = toDatetime(new Date().toISOString());
  let written = 0;
  let skipped = 0;

  for (const w of works) {
    if (!w || !w.id) {
      skipped += 1;
      continue;
    }
    const tags = Array.isArray(w.tags) ? w.tags.join(', ') : String(w.tags || '');
    try {
      const [result] = await conn.query(sql, [
        String(w.id),
        String(w.title || '').trim() || '未命名作品',
        String(w.description || ''),
        String(w.cover || ''),
        String(w.link || ''),
        tags,
        String(w.status || '规划中'),
        toDatetime(w.createdAt) || now
      ]);
      if (result.affectedRows === 1) {
        written += 1;
      } else {
        skipped += 1;
      }
      console.log(`  · 作品 ${w.id} -> ${result.affectedRows === 1 ? '已写入' : '已存在，跳过'}`);
    } catch (e) {
      skipped += 1;
      console.warn(`  · 作品 ${w.id} 导入失败，已跳过：${e.message}`);
    }
  }

  return { written, skipped };
}

async function main() {
  const args = process.argv.slice(2);
  const overwrite = args.includes('--overwrite');
  const skipImport = args.includes('--skip-import');

  console.log(`[db] 目标数据库：${DB.user}@${DB.host}:${DB.port}/${DB.database}`);

  const conn = await mysql.createConnection({
    host: DB.host,
    port: DB.port,
    user: DB.user,
    password: DB.password,
    charset: 'utf8mb4_unicode_ci',
    multipleStatements: true,
    ssl: DB.ssl ? { minVersion: 'TLSv1.2' } : undefined
  });

  try {
    await conn.query(
      `CREATE DATABASE IF NOT EXISTS \`${DB.database}\`
       DEFAULT CHARACTER SET utf8mb4 DEFAULT COLLATE utf8mb4_unicode_ci`
    );
    await conn.query(`USE \`${DB.database}\``);

    const schema = await fs.readFile(path.join(__dirname, 'sql', 'schema.sql'), 'utf-8');
    await conn.query(schema);
    console.log(`[db] 数据库与数据表已就绪`);

    if (skipImport) return;

    console.log('[db] 开始导入历史作品数据…');
    const works = await importWorks(conn, overwrite);

    const [[workCount]] = await conn.query('SELECT COUNT(*) AS c FROM works');
    console.log(`[db] 导入完成：作品写入 ${works.written} 条 / 跳过 ${works.skipped} 条`);
    console.log(`[db] 当前表内数据：works ${workCount.c} 条`);
  } finally {
    await conn.end();
  }
}

main().catch((e) => {
  console.error(`[db] 初始化失败：${e.message}`);
  if (e.code === 'ER_ACCESS_DENIED_ERROR') {
    console.error('[db] 账号或密码不正确，请检查 DB_USER / DB_PASSWORD。');
  } else if (e.code === 'ECONNREFUSED') {
    console.error('[db] 连不上 MySQL，请检查 DB_HOST / DB_PORT 以及服务是否已启动。');
  }
  process.exit(1);
});