import fs from 'node:fs/promises';
import path from 'node:path';
import { marked } from 'marked';

import { NOTES_DIR } from '../config.js';

/**
 * 笔记数据服务
 * - 默认从 backend/data/notes 文件夹读取 .md 文件（把文件丢进去即可自动展示）
 * - 也支持通过 API 手动新增 / 删除笔记（后续可无缝替换为数据库实现）
 */

// 简易 front-matter 解析：开头 --- 之间的 key: value 作为元信息
function parseFrontMatter(raw) {
  const meta = {};
  let content = raw;

  if (raw.startsWith('---')) {
    const end = raw.indexOf('\n---', 3);
    if (end !== -1) {
      const block = raw.slice(3, end).trim();
      content = raw.slice(end + 4).replace(/^\s*\n/, '');
      block.split('\n').forEach((line) => {
        const idx = line.indexOf(':');
        if (idx === -1) return;
        const key = line.slice(0, idx).trim();
        let value = line.slice(idx + 1).trim();
        if (!key) return;
        // 支持 tags: a, b, c
        if (key === 'tags') {
          meta.tags = value
            .split(',')
            .map((t) => t.trim())
            .filter(Boolean);
        } else {
          meta[key] = value.replace(/^["']|["']$/g, '');
        }
      });
    }
  }

  return { meta, content };
}

// 计算摘要（去掉 markdown 标记后的纯文本前 N 字）
function buildSummary(content, length = 100) {
  const plain = content
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/`[^`]*`/g, ' ')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/[#>*_-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return plain.length > length ? plain.slice(0, length) + '…' : plain;
}

// 根据文件名推导标题（无 front-matter 时）
function titleFromSlug(slug) {
  return slug.replace(/[-_]/g, ' ').trim();
}

// 重点标记规则：正文中以引用形式书写「> 重点：xxx」的行会被自动汇总
const KEY_POINT_RE = /^>\s*(?:\*\*|__)?\s*重点\s*(?:\*\*|__)?\s*[:：]?\s*(.+?)\s*$/;

function extractKeyPoints(content) {
  const points = [];
  for (const line of content.split('\n')) {
    const m = line.trim().match(KEY_POINT_RE);
    if (m && m[1]) {
      points.push(m[1].replace(/[*_`]/g, '').trim());
    }
  }
  return points;
}

// 由标题文字生成锚点 id
function slugifyHeading(text) {
  const base = text
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^\p{L}\p{N}-]+/gu, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
  return base || 'section';
}

// 生成「本篇笔记」的目录（H2~H4），并给渲染后的标题补上 id 锚点
function buildToc(content) {
  const toc = [];
  const used = Object.create(null);

  // 去掉代码块，避免把代码里的 # 误当成标题
  const plain = content.replace(/```[\s\S]*?```/g, '');

  for (const raw of plain.split('\n')) {
    const m = raw.match(/^(#{2,4})\s+(.+?)\s*$/);
    if (!m) continue;
    const level = m[1].length;
    const text = m[2].replace(/[*_`]/g, '').trim();
    let id = slugifyHeading(text);
    if (used[id]) {
      used[id] += 1;
      id = `${id}-${used[id]}`;
    } else {
      used[id] = 1;
    }
    toc.push({ level, text, id });
  }

  let cursor = 0;
  const html = marked.parse(content).replace(/<h([2-4])>/g, (full, lvl) => {
    const item = toc[cursor++];
    return item ? `<h${lvl} id="${item.id}">` : full;
  });

  return { toc, html };
}

// 防止路径穿越，只允许安全的文件名
function ensureSafeSlug(slug) {
  if (!slug || typeof slug !== 'string') {
    const err = new Error('缺少笔记标识 slug');
    err.status = 400;
    throw err;
  }
  if (slug.includes('..') || /[\\/]/.test(slug)) {
    const err = new Error('非法的笔记标识');
    err.status = 400;
    throw err;
  }
  return slug;
}

// 由标题生成 slug
function slugify(input) {
  const base = String(input || '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[\\/:*?"<>|#%&{}$!'@+`=]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
  return base || `note-${Date.now()}`;
}

async function ensureDir() {
  await fs.mkdir(NOTES_DIR, { recursive: true });
}

// 读取单篇笔记
async function readNote(slug) {
  ensureSafeSlug(slug);
  const file = path.join(NOTES_DIR, `${slug}.md`);
  let raw;
  try {
    raw = await fs.readFile(file, 'utf-8');
  } catch {
    const err = new Error('笔记不存在');
    err.status = 404;
    throw err;
  }

  const { meta, content } = parseFrontMatter(raw);
  const stat = await fs.stat(file);

  return {
    slug,
    title: meta.title || titleFromSlug(slug),
    date: meta.date || stat.mtime.toISOString().slice(0, 10),
    tags: meta.tags || [],
    summary: buildSummary(content),
    content,
    keyPoints: extractKeyPoints(content),
    ...buildToc(content),
    updatedAt: stat.mtime.toISOString()
  };
}

// 列表（按日期倒序）
async function listNotes() {
  await ensureDir();
  const files = (await fs.readdir(NOTES_DIR)).filter((f) => f.toLowerCase().endsWith('.md'));

  const notes = [];
  for (const file of files) {
    const slug = file.replace(/\.md$/i, '');
    try {
      const note = await readNote(slug);
      const { html, content, ...rest } = note;
      notes.push(rest);
    } catch (e) {
      // 忽略无法解析的单个文件，避免影响整体列表
      console.warn(`[notes] 跳过无法读取的笔记: ${file} -> ${e.message}`);
    }
  }

  notes.sort((a, b) => (a.date < b.date ? 1 : -1));
  return notes;
}

// 手动新增笔记
async function createNote({ title, content, tags, slug }) {
  if (!title || !String(title).trim()) {
    const err = new Error('标题不能为空');
    err.status = 400;
    throw err;
  }

  await ensureDir();
  let finalSlug = slug ? slugify(slug) : slugify(title);

  // 同名则追加时间戳，避免覆盖
  const exists = await fs
    .access(path.join(NOTES_DIR, `${finalSlug}.md`))
    .then(() => true)
    .catch(() => false);
  if (exists) finalSlug = `${finalSlug}-${Date.now()}`;

  const tagList = Array.isArray(tags)
    ? tags
    : String(tags || '')
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean);

  const front = [
    '---',
    `title: ${String(title).trim()}`,
    `date: ${new Date().toISOString().slice(0, 10)}`,
    tagList.length ? `tags: ${tagList.join(', ')}` : null,
    '---',
    ''
  ]
    .filter((l) => l !== null)
    .join('\n');

  const body = String(content || '').trim();
  await fs.writeFile(path.join(NOTES_DIR, `${finalSlug}.md`), `${front}\n${body}\n`, 'utf-8');

  return readNote(finalSlug);
}

// 修改笔记（保留原日期，重写 front-matter 与正文）
async function updateNote(slug, { title, content, tags } = {}) {
  ensureSafeSlug(slug);
  const file = path.join(NOTES_DIR, `${slug}.md`);

  let raw;
  try {
    raw = await fs.readFile(file, 'utf-8');
  } catch {
    const err = new Error('笔记不存在');
    err.status = 404;
    throw err;
  }

  const { meta, content: oldContent } = parseFrontMatter(raw);

  const finalTitle =
    title != null && String(title).trim() ? String(title).trim() : meta.title || titleFromSlug(slug);
  const finalTags =
    tags == null
      ? meta.tags || []
      : Array.isArray(tags)
        ? tags
        : String(tags)
            .split(',')
            .map((t) => t.trim())
            .filter(Boolean);
  const finalContent = content == null ? oldContent : String(content);
  const finalDate = meta.date || new Date().toISOString().slice(0, 10);

  const front = [
    '---',
    `title: ${finalTitle}`,
    `date: ${finalDate}`,
    finalTags.length ? `tags: ${finalTags.join(', ')}` : null,
    '---',
    ''
  ]
    .filter((l) => l !== null)
    .join('\n');

  await fs.writeFile(file, `${front}\n${finalContent.trim()}\n`, 'utf-8');
  return readNote(slug);
}

// 删除笔记
async function deleteNote(slug) {
  ensureSafeSlug(slug);
  const file = path.join(NOTES_DIR, `${slug}.md`);
  try {
    await fs.unlink(file);
  } catch {
    const err = new Error('笔记不存在');
    err.status = 404;
    throw err;
  }
  return { slug, deleted: true };
}

export { listNotes, readNote, createNote, updateNote, deleteNote, slugify };