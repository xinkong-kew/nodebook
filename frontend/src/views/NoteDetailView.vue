<template>
  <div class="container container-wide note-layout">
    <!-- 左侧：日期目录 + 本篇目录（固定，占满高度） -->
    <aside class="sidebar">
      <div class="sidebar-inner sidebar-panel sidebar-full">
        <section class="toc-group">
          <button type="button" class="toc-group-head" @click="datesOpen = !datesOpen">
            <span>日期目录</span>
            <span class="chevron" :class="{ open: datesOpen }">▾</span>
          </button>
          <nav
            v-show="datesOpen"
            v-if="note && note.dates && note.dates.length"
            class="toc"
          >
            <a
              v-for="d in note.dates"
              :key="d.id"
              class="toc-item date-item"
              href="#"
              @click.prevent="scrollTo(d.id)"
            >
              {{ d.text }}
            </a>
          </nav>
          <p v-show="datesOpen && note && (!note.dates || !note.dates.length)" class="sidebar-hint">
            本页没有日期小节。
          </p>
        </section>

        <section class="toc-group">
          <button type="button" class="toc-group-head" @click="tocOpen = !tocOpen">
            <span>本篇目录</span>
            <span class="chevron" :class="{ open: tocOpen }">▾</span>
          </button>
          <nav v-show="tocOpen" v-if="note && note.toc && note.toc.length" class="toc">
            <a
              v-for="item in note.toc"
              :key="item.id"
              class="toc-item"
              :class="'lv-' + item.level"
              href="#"
              @click.prevent="scrollTo(item.id)"
            >
              {{ item.text }}
            </a>
          </nav>
          <p v-show="tocOpen && note && (!note.toc || !note.toc.length)" class="sidebar-hint">
            这篇笔记还没有小标题。
          </p>
        </section>
      </div>
    </aside>

    <!-- 中间：正文 -->
    <div class="note-main">
      <div class="note-topbar">
        <router-link class="back-link" to="/notes">← 返回笔记列表</router-link>
        <div v-if="note" class="note-topbar-actions">
          <button class="btn btn-sm" @click="showModal = true">编辑</button>
          <button class="btn btn-sm btn-ghost" @click="remove">删除</button>
        </div>
      </div>

      <div v-if="loading" class="loading">加载中…</div>
      <div v-else-if="error" class="empty">
        <div class="empty-icon">😕</div>
        <p>{{ error }}</p>
      </div>

      <article v-else class="article">
        <h1>{{ note.title }}</h1>
        <div class="meta" style="margin-bottom: 20px;">
          <span>{{ formatDate(note.date) }}</span>
          <div class="tags" v-if="note.tags && note.tags.length">
            <span class="tag" v-for="t in note.tags" :key="t">{{ t }}</span>
          </div>
        </div>
        <!-- 内容由后端将 Markdown 渲染为 HTML，标题带锚点 -->
        <div class="content" v-html="note.html"></div>
      </article>
    </div>

    <!-- 右侧：重点内容（自动汇总） -->
    <aside class="sidebar">
      <div class="sidebar-inner sidebar-panel">
        <h4 class="sidebar-title">重点内容</h4>
        <ul v-if="note && note.keyPoints && note.keyPoints.length" class="keypoints">
          <li
            v-for="point in note.keyPoints"
            :key="point.id"
            class="keypoint-item"
            title="点击跳转到正文对应位置"
            @click="scrollTo(point.id)"
          >
            {{ point.text }}
          </li>
        </ul>
        <p v-else class="sidebar-hint">
          暂无重点。在正文中用引用标记重点，会自动汇总到这里：
          <code>&gt; 重点：要记的内容</code>
        </p>
      </div>
    </aside>
  </div>

  <NoteModal :open="showModal" :note="note" @close="showModal = false" @saved="onSaved" />
</template>

<script setup>
import { onMounted, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { api, formatDate } from '../api';
import { showToast } from '../utils/toast';
import NoteModal from '../components/NoteModal.vue';

const route = useRoute();
const router = useRouter();
const loading = ref(true);
const error = ref('');
const note = ref(null);
const showModal = ref(false);
const datesOpen = ref(true);
const tocOpen = ref(true);

async function loadNote(slug) {
  loading.value = true;
  error.value = '';
  note.value = null;
  try {
    const data = await api.getNote(slug);
    // 后端未返回有效数据时走错误提示，避免模板访问 note.title 时崩溃白屏
    if (!data || typeof data !== 'object') throw new Error('笔记数据格式异常');
    note.value = data;
  } catch (e) {
    error.value = e.message || '笔记不存在';
  } finally {
    loading.value = false;
  }
}

// 点击目录平滑滚动到对应标题
function scrollTo(id) {
  const el = document.getElementById(id);
  if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

// 编辑保存后重新加载，刷新目录与重点
function onSaved() {
  loadNote(route.params.slug);
}

async function remove() {
  if (!note.value) return;
  if (!window.confirm(`确定删除笔记「${note.value.title}」吗？此操作不可恢复。`)) return;
  try {
    await api.deleteNote(note.value.slug);
    showToast('已删除');
    router.push('/notes');
  } catch (e) {
    showToast(e.message);
  }
}

onMounted(() => loadNote(route.params.slug));

// 切换笔记时同一组件复用，需要监听 slug 变化
watch(
  () => route.params.slug,
  (slug) => {
    if (slug) loadNote(slug);
  }
);
</script>