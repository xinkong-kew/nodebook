import { Router } from 'express';
import { listNotes, readNote, createNote, updateNote, deleteNote } from '../services/noteService.js';

const router = Router();

// 列表
router.get('/', async (req, res, next) => {
  try {
    const notes = await listNotes();
    res.json({ ok: true, data: notes });
  } catch (e) {
    next(e);
  }
});

// 详情
router.get('/:slug', async (req, res, next) => {
  try {
    const note = await readNote(req.params.slug);
    res.json({ ok: true, data: note });
  } catch (e) {
    next(e);
  }
});

// 手动新增
router.post('/', async (req, res, next) => {
  try {
    const note = await createNote(req.body || {});
    res.status(201).json({ ok: true, data: note });
  } catch (e) {
    next(e);
  }
});

// 修改
router.put('/:slug', async (req, res, next) => {
  try {
    const note = await updateNote(req.params.slug, req.body || {});
    res.json({ ok: true, data: note });
  } catch (e) {
    next(e);
  }
});

// 删除
router.delete('/:slug', async (req, res, next) => {
  try {
    const result = await deleteNote(req.params.slug);
    res.json({ ok: true, data: result });
  } catch (e) {
    next(e);
  }
});

export default router;