import { pool } from '../db.js';

/**
 * 作品数据服务（MySQL 实现）
 * 表结构见 sql/schema.sql：
 *   works(id, title, description, cover, link, tags, status, created_at)
 * 标签以逗号分隔的字符串存储，接口对外返回数组。
 */

const WORK_COLUMNS = 'id, title, description, cover, link, tags, status, created_at';

function splitTags(value) {
  return String(value || '')
    .split(',')
    .map((t) => t.trim())
    .filter(Boolean);
}

function joinTags(tags) {
  const list = Array.isArray(tags) ? tags : splitTags(tags);
  return list
    .map((t) => String(t).trim())
    .filter(Boolean)
    .join(', ');
}

function rowToWork(row) {
  return {
    id: row.id,
    title: row.title,
    description: row.description || '',
    cover: row.cover || '',
    link: row.link || '',
    tags: splitTags(row.tags),
    status: row.status || '规划中',
    createdAt: row.created_at ? String(row.created_at) : ''
  };
}

async function getWork(id) {
  const [rows] = await pool.query(`SELECT ${WORK_COLUMNS} FROM works WHERE id = ? LIMIT 1`, [id]);
  if (!rows.length) {
    const err = new Error('作品不存在');
    err.status = 404;
    throw err;
  }
  return rowToWork(rows[0]);
}

async function listWorks() {
  const [rows] = await pool.query(
    `SELECT ${WORK_COLUMNS} FROM works ORDER BY created_at DESC, id DESC`
  );
  return rows.map(rowToWork);
}

async function createWork({ title, description, cover, link, tags, status }) {
  if (!title || !String(title).trim()) {
    const err = new Error('作品标题不能为空');
    err.status = 400;
    throw err;
  }

  const id = `w_${Date.now()}`;
  await pool.query(
    'INSERT INTO works (id, title, description, cover, link, tags, status) VALUES (?, ?, ?, ?, ?, ?, ?)',
    [
      id,
      String(title).trim(),
      String(description || '').trim(),
      String(cover || '').trim(),
      String(link || '').trim(),
      joinTags(tags),
      status || '规划中'
    ]
  );

  return getWork(id);
}

async function updateWork(id, patch = {}) {
  const current = await getWork(id);

  const next = {
    title: patch.title != null ? String(patch.title).trim() : current.title,
    description:
      patch.description != null ? String(patch.description).trim() : current.description,
    cover: patch.cover != null ? String(patch.cover).trim() : current.cover,
    link: patch.link != null ? String(patch.link).trim() : current.link,
    tags: patch.tags != null ? joinTags(patch.tags) : joinTags(current.tags),
    status: patch.status || current.status
  };

  await pool.query(
    'UPDATE works SET title = ?, description = ?, cover = ?, link = ?, tags = ?, status = ? WHERE id = ?',
    [next.title, next.description, next.cover, next.link, next.tags, next.status, id]
  );

  return getWork(id);
}

async function deleteWork(id) {
  const [result] = await pool.query('DELETE FROM works WHERE id = ?', [id]);
  if (!result.affectedRows) {
    const err = new Error('作品不存在');
    err.status = 404;
    throw err;
  }
  return { id, deleted: true };
}

export { listWorks, createWork, updateWork, deleteWork };