<template>
  <article class="card">
    <div class="card-head">
      <h3>
        <router-link :to="{ name: 'note-detail', params: { slug: note.slug } }">
          {{ note.title }}
        </router-link>
      </h3>
      <div v-if="actions" class="card-actions">
        <button class="btn btn-sm btn-ghost" @click="$emit('edit', note)">编辑</button>
        <button class="btn btn-sm btn-ghost" @click="$emit('delete', note)">删除</button>
      </div>
    </div>
    <p class="summary" v-if="note.summary">{{ note.summary }}</p>
    <div class="meta">
      <span>{{ formatDate(note.date) }}</span>
      <div class="tags" v-if="note.tags && note.tags.length">
        <span class="tag" v-for="t in note.tags" :key="t">{{ t }}</span>
      </div>
    </div>
  </article>
</template>

<script setup>
import { formatDate } from '../api';

defineProps({
  note: { type: Object, required: true },
  // 是否显示「编辑 / 删除」管理按钮（笔记列表页开启「笔记设置」时显示）
  actions: { type: Boolean, default: false }
});

defineEmits(['edit', 'delete']);
</script>