<template>
  <div class="container">
    <h1 class="page-title">作品</h1>
    <p class="page-desc">这里展示我的作品。当前为模板数据，可点击「新建作品」手动添加。</p>

    <div class="toolbar">
      <button class="btn btn-primary" style="margin-left: auto;" @click="showModal = true">
        + 新建作品
      </button>
    </div>

    <div v-if="loading" class="loading">加载中…</div>
    <div v-else-if="!works.length" class="empty">
      <div class="empty-icon">🎨</div>
      <p>还没有作品，点击右上角新建一个吧。</p>
    </div>
    <div v-else class="work-grid">
      <WorkCard v-for="w in works" :key="w.id" :work="w" @delete="onDelete" />
    </div>

    <WorkModal :open="showModal" @close="showModal = false" @saved="onSaved" />
  </div>
</template>

<script setup>
import { onMounted, ref } from 'vue';
import { api } from '../api';
import { showToast } from '../utils/toast';
import WorkCard from '../components/WorkCard.vue';
import WorkModal from '../components/WorkModal.vue';

const loading = ref(true);
const works = ref([]);
const showModal = ref(false);

async function load() {
  loading.value = true;
  try {
    works.value = await api.listWorks();
  } catch (e) {
    console.error(e);
  } finally {
    loading.value = false;
  }
}

function onSaved(work) {
  works.value.unshift(work);
}

async function onDelete(work) {
  if (!window.confirm(`确定删除作品「${work.title}」吗？`)) return;
  try {
    await api.deleteWork(work.id);
    works.value = works.value.filter((w) => w.id !== work.id);
    showToast('已删除');
  } catch (e) {
    showToast(e.message);
  }
}

onMounted(load);
</script>