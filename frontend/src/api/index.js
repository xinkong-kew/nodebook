/**
 * 统一 API 封装
 * 前后端分离：前端通过 HTTP 调用后端接口。
 * 开发环境由 Vite 代理 /api 到后端（见 vite.config.js），
 * 也可通过环境变量 VITE_API_BASE 指定后端地址。
 */
const BASE = import.meta.env.VITE_API_BASE || '/api';

async function request(url, options = {}) {
  const res = await fetch(`${BASE}${url}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data.ok === false) {
    throw new Error(data.message || `请求失败 (${res.status})`);
  }
  return data.data;
}

export const api = {
  // 笔记
  listNotes: () => request('/notes'),
  getNote: (slug) => request(`/notes/${encodeURIComponent(slug)}`),
  createNote: (payload) => request('/notes', { method: 'POST', body: JSON.stringify(payload) }),
  updateNote: (slug, payload) =>
    request(`/notes/${encodeURIComponent(slug)}`, { method: 'PUT', body: JSON.stringify(payload) }),
  deleteNote: (slug) => request(`/notes/${encodeURIComponent(slug)}`, { method: 'DELETE' }),
  // 作品
  listWorks: () => request('/works'),
  createWork: (payload) => request('/works', { method: 'POST', body: JSON.stringify(payload) }),
  deleteWork: (id) => request(`/works/${id}`, { method: 'DELETE' })
};

// 日期格式化：2026-10-11 -> 2026-10-11
export function formatDate(value) {
  if (!value) return '';
  return String(value).slice(0, 10);
}