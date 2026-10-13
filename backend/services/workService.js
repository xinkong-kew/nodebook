import fs from 'node:fs/promises';
import path from 'node:path';

import { WORKS_FILE } from '../config.js';

/**
 * 作品数据服务
 * 当前使用 JSON 文件存储，后续可无缝替换为数据库。
 * 作品暂无内容时，前端会展示默认模板。
 */

async function ensureFile() {
  await fs.mkdir(path.dirname(WORKS_FILE), { recursive: true });
  try {
    await fs.access(WORKS_FILE);
  } catch {
    await fs.writeFile(WORKS_FILE, '[]', 'utf-8');
  }
}

async function readAll() {
  await ensureFile();
  const raw = await fs.readFile(WORKS_FILE, 'utf-8');
  try {
    const data = JSON.parse(raw);
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

async function writeAll(list) {
  await ensureFile();
  await fs.writeFile(WORKS_FILE, JSON.stringify(list, null, 2), 'utf-8');
}

async function listWorks() {
  const list = await readAll();
  list.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
  return list;
}

async function createWork({ title, description, cover, link, tags, status }) {
  if (!title || !String(title).trim()) {
    const err = new Error('作品标题不能为空');
    err.status = 400;
    throw err;
  }

  const list = await readAll();
  const work = {
    id: `w_${Date.now()}`,
    title: String(title).trim(),
    description: String(description || '').trim(),
    cover: String(cover || '').trim(),
    link: String(link || '').trim(),
    tags: Array.isArray(tags)
      ? tags
      : String(tags || '')
          .split(',')
          .map((t) => t.trim())
          .filter(Boolean),
    status: status || '规划中',
    createdAt: new Date().toISOString()
  };
  list.push(work);
  await writeAll(list);
  return work;
}

async function updateWork(id, patch) {
  const list = await readAll();
  const idx = list.findIndex((w) => w.id === id);
  if (idx === -1) {
    const err = new Error('作品不存在');
    err.status = 404;
    throw err;
  }
  list[idx] = { ...list[idx], ...patch, id: list[idx].id };
  await writeAll(list);
  return list[idx];
}

async function deleteWork(id) {
  const list = await readAll();
  const next = list.filter((w) => w.id !== id);
  if (next.length === list.length) {
    const err = new Error('作品不存在');
    err.status = 404;
    throw err;
  }
  await writeAll(next);
  return { id, deleted: true };
}

export { listWorks, createWork, updateWork, deleteWork };