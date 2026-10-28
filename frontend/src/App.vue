<template>
  <header class="site-header">
    <div class="container">
      <router-link class="brand" to="/">星空笔记</router-link>
      <nav class="nav">
        <router-link to="/">首页</router-link>
        <router-link to="/notes">笔记</router-link>
        <router-link to="/works">作品</router-link>
      </nav>
    </div>
  </header>

  <main :class="{ 'main-flush': isNoteDetail }">
    <router-view />
  </main>

  <footer v-if="!isNoteDetail" class="site-footer">
    <div class="container">星空笔记 · 简约博客</div>
  </footer>

  <div class="toast" :class="{ show: !!toastMessage }">{{ toastMessage }}</div>
</template>

<script setup>
import { computed } from 'vue';
import { useRoute } from 'vue-router';
import { toastMessage } from './utils/toast';

const route = useRoute();
// 笔记详情页使用“铺满一屏”的布局：隐藏页脚、去掉主体内边距
const isNoteDetail = computed(() => route.name === 'note-detail');
</script>