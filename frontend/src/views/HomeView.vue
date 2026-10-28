<template>
  <div class="home">
    <section class="hero">
      <div class="container">
        <h1 class="hero-title">星空笔记</h1>
        <p class="hero-sub">记录学习，沉淀作品 · 一个简约的个人站点，一边存放学习笔记，一边整理作品。</p>
        <div class="hero-actions">
          <router-link class="btn btn-primary" to="/notes">浏览笔记</router-link>
          <router-link class="btn" to="/works">查看作品</router-link>
        </div>
      </div>
    </section>

    <section class="container home-notes">
      <div class="toolbar">
        <h2 style="margin: 0; font-size: 20px;">最新笔记</h2>
        <router-link class="btn btn-ghost btn-sm" to="/notes" style="margin-left: auto;">
          查看全部 →
        </router-link>
      </div>

      <div v-if="loading" class="loading">加载中…</div>
      <div v-else-if="!recent.length" class="empty">
        <div class="empty-icon">📝</div>
        <p>还没有笔记，去「笔记」页面新建一篇吧。</p>
      </div>
      <div v-else class="card-list">
        <NoteCard v-for="n in recent" :key="n.slug" :note="n" />
      </div>
    </section>
  </div>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue';
import { api } from '../api';
import NoteCard from '../components/NoteCard.vue';

const loading = ref(true);
const notes = ref([]);
const recent = computed(() => (Array.isArray(notes.value) ? notes.value : []).slice(0, 3));

onMounted(async () => {
  try {
    notes.value = await api.listNotes();
  } catch (e) {
    console.error(e);
  } finally {
    loading.value = false;
  }
});
</script>