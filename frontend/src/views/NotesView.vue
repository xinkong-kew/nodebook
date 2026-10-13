<template>
  <div class="container">
    <h1 class="page-title">笔记</h1>
    <p class="page-desc">
      按时间倒序展示。把 .md 文件放进后端的 data/notes 文件夹，或在「笔记设置」里自行添加、修改。
    </p>

    <div class="toolbar">
      <input v-model="keyword" class="search-input" type="search" placeholder="搜索标题、标签或摘要…" />
      <div class="toolbar-right">
        <button class="btn btn-primary" @click="openCreate">+ 新建笔记</button>
        <button
          class="btn"
          :class="{ 'btn-active': manageMode }"
          @click="manageMode = !manageMode"
        >
          笔记设置
        </button>
      </div>
    </div>

    <div v-if="loading" class="loading">加载中…</div>
    <div v-else-if="!filtered.length" class="empty">
      <div class="empty-icon">🔍</div>
      <p>{{ keyword ? '没有匹配的笔记' : '还没有笔记，点击右上角新建一篇吧。' }}</p>
    </div>
    <div v-else class="card-list">
      <NoteCard
        v-for="n in filtered"
        :key="n.slug"
        :note="n"
        :actions="manageMode"
        @edit="openEdit"
        @delete="removeNote"
      />
    </div>

    <NoteModal :open="showModal" :note="editingNote" @close="closeModal" @saved="onSaved" />
  </div>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue';
import { api } from '../api';
import { showToast } from '../utils/toast';
import NoteCard from '../components/NoteCard.vue';
import NoteModal from '../components/NoteModal.vue';

const loading = ref(true);
const notes = ref([]);
const keyword = ref('');
const showModal = ref(false);
const editingNote = ref(null);
const manageMode = ref(false);

const filtered = computed(() => {
  const kw = keyword.value.trim().toLowerCase();
  if (!kw) return notes.value;
  return notes.value.filter((n) => {
    const haystack = [n.title, n.summary, (n.tags || []).join(' ')].join(' ').toLowerCase();
    return haystack.includes(kw);
  });
});

async function load() {
  loading.value = true;
  try {
    notes.value = await api.listNotes();
  } catch (e) {
    console.error(e);
  } finally {
    loading.value = false;
  }
}

function openCreate() {
  editingNote.value = null;
  showModal.value = true;
}

// 编辑需要完整正文，先拉取详情再打开弹窗
async function openEdit(note) {
  try {
    editingNote.value = await api.getNote(note.slug);
    showModal.value = true;
  } catch (e) {
    showToast(e.message);
  }
}

function closeModal() {
  showModal.value = false;
  editingNote.value = null;
}

function brief(note) {
  return {
    slug: note.slug,
    title: note.title,
    date: note.date,
    tags: note.tags,
    summary: note.summary,
    updatedAt: note.updatedAt
  };
}

function onSaved(note, mode) {
  if (mode === 'edit') {
    const idx = notes.value.findIndex((n) => n.slug === note.slug);
    if (idx !== -1) notes.value.splice(idx, 1, brief(note));
  } else {
    notes.value.unshift(brief(note));
  }
}

async function removeNote(note) {
  if (!window.confirm(`确定删除笔记「${note.title}」吗？此操作不可恢复。`)) return;
  try {
    await api.deleteNote(note.slug);
    notes.value = notes.value.filter((n) => n.slug !== note.slug);
    showToast('已删除');
  } catch (e) {
    showToast(e.message);
  }
}

onMounted(load);
</script>