<template>
  <div class="modal-mask" v-if="open" @click.self="$emit('close')">
    <div class="modal">
      <h2>新建作品</h2>
      <form @submit.prevent="submit">
        <div class="field">
          <label>标题 *</label>
          <input v-model="form.title" required placeholder="例如：个人博客系统" />
        </div>
        <div class="field">
          <label>简介</label>
          <textarea v-model="form.description" style="min-height: 90px;" placeholder="一句话介绍这个作品……"></textarea>
        </div>
        <div class="field">
          <label>封面图地址</label>
          <input v-model="form.cover" placeholder="https://... （可选）" />
        </div>
        <div class="field">
          <label>作品链接</label>
          <input v-model="form.link" placeholder="https://... （可选）" />
        </div>
        <div class="field">
          <label>标签</label>
          <input v-model="form.tags" placeholder="用逗号分隔，例如：Vue, Node" />
        </div>
        <div class="field">
          <label>状态</label>
          <input v-model="form.status" placeholder="规划中 / 开发中 / 已完成" />
        </div>
        <div class="modal-actions">
          <button type="button" class="btn btn-ghost" @click="$emit('close')">取消</button>
          <button type="submit" class="btn btn-primary" :disabled="saving">
            {{ saving ? '保存中…' : '保存' }}
          </button>
        </div>
      </form>
    </div>
  </div>
</template>

<script setup>
import { reactive, ref } from 'vue';
import { api } from '../api';
import { showToast } from '../utils/toast';

defineProps({ open: Boolean });
const emit = defineEmits(['close', 'saved']);

const saving = ref(false);
const form = reactive({
  title: '',
  description: '',
  cover: '',
  link: '',
  tags: '',
  status: '规划中'
});

async function submit() {
  if (!form.title.trim()) return;
  saving.value = true;
  try {
    const work = await api.createWork({ ...form });
    showToast('作品已保存');
    Object.assign(form, { title: '', description: '', cover: '', link: '', tags: '', status: '规划中' });
    emit('saved', work);
    emit('close');
  } catch (e) {
    showToast(e.message);
  } finally {
    saving.value = false;
  }
}
</script>