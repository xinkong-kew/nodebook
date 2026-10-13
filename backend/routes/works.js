import { Router } from 'express';
import { listWorks, createWork, updateWork, deleteWork } from '../services/workService.js';

const router = Router();

// 列表
router.get('/', async (req, res, next) => {
  try {
    const works = await listWorks();
    res.json({ ok: true, data: works });
  } catch (e) {
    next(e);
  }
});

// 新增
router.post('/', async (req, res, next) => {
  try {
    const work = await createWork(req.body || {});
    res.status(201).json({ ok: true, data: work });
  } catch (e) {
    next(e);
  }
});

// 更新
router.put('/:id', async (req, res, next) => {
  try {
    const work = await updateWork(req.params.id, req.body || {});
    res.json({ ok: true, data: work });
  } catch (e) {
    next(e);
  }
});

// 删除
router.delete('/:id', async (req, res, next) => {
  try {
    const result = await deleteWork(req.params.id);
    res.json({ ok: true, data: result });
  } catch (e) {
    next(e);
  }
});

export default router;