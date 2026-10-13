<template>
  <article class="work-card">
    <div class="work-cover">
      <img v-if="work.cover" :src="work.cover" :alt="work.title" />
      <span v-else>{{ (work.title || '作').slice(0, 1) }}</span>
    </div>
    <div class="work-body">
      <h3>{{ work.title }}</h3>
      <p>{{ work.description }}</p>
      <div class="meta">
        <span class="status">{{ work.status || '规划中' }}</span>
        <div class="tags" v-if="work.tags && work.tags.length">
          <span class="tag" v-for="t in work.tags" :key="t">{{ t }}</span>
        </div>
      </div>
      <div class="toolbar" style="margin: 0; gap: 8px;">
        <a v-if="work.link" class="btn btn-sm" :href="work.link" target="_blank" rel="noopener">访问 →</a>
        <button class="btn btn-sm btn-ghost" @click="$emit('delete', work)">删除</button>
      </div>
    </div>
  </article>
</template>

<script setup>
defineProps({
  work: { type: Object, required: true }
});

defineEmits(['delete']);
</script>