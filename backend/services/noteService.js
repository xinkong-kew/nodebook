import fs from 'node:fs/promises';
import path from 'node:path';
import { marked } from 'marked';

import { NOTES_DIR } from '../config.js';

/**
 * 笔记数据服务
 * notes 目录下支持任意层级，规则只有一条：
 *   含 .md 的文件夹 = 一篇笔记，文件夹名就是 slug，md 与图片放同一目录
 *   例：notes/STM32/10.20/10.20.md + notes/STM32/10.20/xxx.jpg
 * 正文里的图片写相对路径即可，例如 ![图](xxx.jpg) 或 ![图](./xxx.jpg)
 * 后端会把它改写成 /note-assets/STM32/10.20/xxx.jpg 交给前端访问
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

// 无 front-matter 时，优先用正文第一个 H1，其次用第一行文字
function titleFromContent(content, slug) {
  const lines = content.split('\n').map((l) => l.trim());

  const heading = lines.find((l) => /^#\s+/.test(l));
  if (heading) return heading.replace(/^#\s+/, '').trim();

  const first = lines.find(Boolean);
  if (first && first.length <= 60 && !/^[!>#\-*|`<[]/.test(first)) {
    return first.replace(/[：:]\s*$/, '');
  }

  return titleFromSlug(slug);
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

// 把正文里的相对图片路径补成可访问地址，绝对地址 / 网络地址保持原样
function rewriteImagePaths(content, assetBase) {
  return content.replace(/(!\[[^\]]*\]\()([^)\s]+)([^)]*\))/g, (full, head, src, tail) => {
    if (/^(?:[a-z][a-z0-9+.-]*:|\/|#)/i.test(src)) return full;
    return `${head}${assetBase}${encodeURI(src.replace(/^\.\//, ''))}${tail}`;
  });
}

// 分配并登记锚点 id，保证同篇笔记内唯一
function makeAssignId() {
  const used = Object.create(null);
  return (text) => {
    let id = slugifyHeading(text);
    if (used[id]) {
      used[id] += 1;
      id = `${id}-${used[id]}`;
    } else {
      used[id] = 1;
    }
    return id;
  };
}

// 生成整篇笔记的结构：
//   - dates：H1 标题（日期小节），供左侧「日期目录」跳转
//   - toc：  H2~H4 标题，供左侧「本篇目录」跳转
//   - keyPoints：重点块（带锚点），供右侧「重点内容」点击跳转
//   - html：渲染后已补好 id 锚点（H1~H4 标题 + 重点引用块）
function buildToc(content, assetBase = '') {
  const toc = [];
  const dates = [];
  const assignId = makeAssignId();

  // 相对路径图片改写成可访问的绝对路径（不改动 http(s)、/ 开头、data: 这类原样地址）
  const md = assetBase ? rewriteImagePaths(content, assetBase) : content;

  // 去掉代码块，避免把代码里的 # 误当成标题
  const plain = md.replace(/```[\s\S]*?```/g, '');

  const clean = (s) => s.replace(/[*_`]/g, '').trim();

  for (const raw of plain.split('\n')) {
    let m = raw.match(/^#\s+(.+?)\s*$/);
    if (m) {
      const text = clean(m[1]);
      dates.push({ text, id: assignId(text) });
      continue;
    }
    m = raw.match(/^(#{2,4})\s+(.+?)\s*$/);
    if (m) {
      const level = m[1].length;
      const text = clean(m[2]);
      toc.push({ level, text, id: assignId(text) });
    }
  }

  // 重点内容（顺序与正文一致），固定 key-N 作为锚点，避免中文被 slug 清空
  const keyPoints = extractKeyPoints(content).map((text, i) => ({ text, id: `key-${i + 1}` }));

  // 渲染 HTML 并给标题补 id（H1 走 dates，H2~H4 走 toc）
  let dateCursor = 0;
  let tocCursor = 0;
  let html = marked.parse(md).replace(/<h([1-4])>/g, (full, lvl) => {
    if (lvl === '1') {
      const item = dates[dateCursor++];
      return item ? `<h1 id="${item.id}">` : full;
    }
    const item = toc[tocCursor++];
    return item ? `<h${lvl} id="${item.id}">` : full;
  });

  // 给「重点」引用块补锚点，供右侧点击跳转
  let kpCursor = 0;
  html = html.replace(/<blockquote>([\s\S]*?)<\/blockquote>/g, (full, inner) => {
    if (keyPoints[kpCursor] && /重点\s*[:：]/.test(inner)) {
      const id = keyPoints[kpCursor].id;
      kpCursor += 1;
      return `<blockquote id="${id}">${inner}</blockquote>`;
    }
    return full;
  });

  return { toc, dates, keyPoints, html };
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

async function isFile(target) {
  try {
    return (await fs.stat(target)).isFile();
  } catch {
    return false;
  }
}

// 递归扫描 notes 目录：含 .md 的文件夹按一篇笔记处理，文件夹名即 slug
async function collectNotes(dir = NOTES_DIR) {
  const notes = [];
  let entries;

  try {
    entries = await fs.readdir(dir, { withFileTypes: true });
  } catch {
    return notes;
  }

  const mdFiles = [];
  const subDirs = [];

  for (const entry of entries) {
    if (entry.name.startsWith('.')) continue;
    const full = path.join(dir, entry.name);
    if (entry.isFile() && entry.name.toLowerCase().endsWith('.md')) {
      mdFiles.push(full);
    } else if (entry.isDirectory()) {
      subDirs.push(full);
    }
  }

  const isRoot = dir === NOTES_DIR;

  if (!isRoot && mdFiles.length) {
    // 当前文件夹就是一篇笔记：优先同名 md，否则取排序后的第一个
    const sameName = mdFiles.find((f) => path.basename(f, '.md') === path.basename(dir));
    notes.push({ file: sameName || mdFiles.sort()[0], dir });
    return notes;
  }

  for (const file of mdFiles) notes.push({ file, dir });
  for (const sub of subDirs) notes.push(...(await collectNotes(sub)));

  return notes;
}

// slug → { file, assetBase } 索引；同名笔记用上层目录名区分
async function buildIndex() {
  const index = new Map();

  for (const { file, dir } of await collectNotes()) {
    const isRoot = dir === NOTES_DIR;
    const baseSlug = isRoot ? path.basename(file, '.md') : path.basename(dir);
    const assetBase = isRoot
      ? '/note-assets/'
      : `/note-assets/${path
          .relative(NOTES_DIR, dir)
          .split(path.sep)
          .map(encodeURIComponent)
          .join('/')}/`;

    let slug = baseSlug;
    if (index.has(slug)) {
      const prefix = path.relative(NOTES_DIR, dir).split(path.sep).filter(Boolean).join('-');
      slug = prefix ? `${prefix}-${baseSlug}` : `${baseSlug}-${Date.now()}`;
    }

    index.set(slug, { file, dir, assetBase });
  }

  return index;
}

// 定位笔记文件
async function resolveNote(slug) {
  ensureSafeSlug(slug);
  const hit = (await buildIndex()).get(slug);

  if (!hit) {
    const err = new Error('笔记不存在');
    err.status = 404;
    throw err;
  }

  return hit;
}

// 读取单篇笔记
async function readNote(slug) {
  const { file, assetBase } = await resolveNote(slug);
  const raw = await fs.readFile(file, 'utf-8');

  const { meta, content } = parseFrontMatter(raw);
  const stat = await fs.stat(file);

  return {
    slug,
    title: meta.title || titleFromContent(content, slug),
    date: meta.date || stat.mtime.toISOString().slice(0, 10),
    tags: meta.tags || [],
    summary: buildSummary(content),
    content,
    ...buildToc(content, assetBase),
    updatedAt: stat.mtime.toISOString()
  };
}

// 列表（按日期倒序）
async function listNotes() {
  await ensureDir();

  const notes = [];
  for (const slug of (await buildIndex()).keys()) {
    try {
      const note = await readNote(slug);
      const { html, content, ...rest } = note;
      notes.push(rest);
    } catch (e) {
      // 忽略无法解析的单个文件，避免影响整体列表
      console.warn(`[notes] 跳过无法读取的笔记: ${slug} -> ${e.message}`);
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

  // 同名则追加时间戳，避免覆盖（含任意层级的同名笔记）
  if ((await buildIndex()).has(finalSlug)) finalSlug = `${finalSlug}-${Date.now()}`;

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
  const { file } = await resolveNote(slug);
  const raw = await fs.readFile(file, 'utf-8');

  const { meta, content: oldContent } = parseFrontMatter(raw);

  const finalTitle =
    title != null && String(title).trim()
      ? String(title).trim()
      : meta.title || titleFromContent(oldContent, slug);
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

// 删除笔记：文件夹笔记会连同同目录下的图片一起删除
async function deleteNote(slug) {
  const { file, dir } = await resolveNote(slug);

  try {
    if (dir === NOTES_DIR) {
      await fs.unlink(file);
    } else {
      await fs.rm(dir, { recursive: true, force: true });
    }
  } catch {
    const err = new Error('笔记不存在');
    err.status = 404;
    throw err;
  }
  return { slug, deleted: true };
}

export { listNotes, readNote, createNote, updateNote, deleteNote, slugify };