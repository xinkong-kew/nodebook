import { createRouter, createWebHistory } from 'vue-router';

import HomeView from '../views/HomeView.vue';
import NotesView from '../views/NotesView.vue';
import NoteDetailView from '../views/NoteDetailView.vue';
import WorksView from '../views/WorksView.vue';

const routes = [
  { path: '/', name: 'home', component: HomeView, meta: { title: '首页' } },
  { path: '/notes', name: 'notes', component: NotesView, meta: { title: '笔记' } },
  { path: '/notes/:slug', name: 'note-detail', component: NoteDetailView, meta: { title: '笔记详情' } },
  { path: '/works', name: 'works', component: WorksView, meta: { title: '作品' } }
];

const router = createRouter({
  history: createWebHistory(),
  routes,
  scrollBehavior: () => ({ top: 0 })
});

router.afterEach((to) => {
  document.title = to.meta.title ? `${to.meta.title} · 星空笔记` : '星空笔记';
});

export default router;