<template>
  <div class="modal-mask" v-if="open" @click.self="$emit('close')">
    <div class="modal">
      <h2>{{ note ? '编辑笔记' : '新建笔记' }}</h2>
      <form @submit.prevent="submit">
        <div class="field">
          <label>标题 *</label>
          <input v-model="form.title" required placeholder="例如：我的第一篇笔记" />
        </div>
        <div class="field">
          <label>标签</label>
          <input v-model="form.tags" placeholder="用逗号分隔，例如：前端, 学习" />
          <div class="hint">可选，用于分类和搜索。</div>
        </div>
        <div class="field">
          <label>内容（支持 Markdown）</label>
          <textarea v-model="form.content" placeholder="# 标题&#10;&#10;这里写正文……"></textarea>
          <div class="hint">用「&gt; 重点：内容」可标记重点，会显示在右侧面板。</div>
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
import { reactive, ref, watch } from 'vue';
import { api } from '../api';
import { showToast } from '../utils/toast';

const props = defineProps({
  open: Boolean,
  // 传入则为「编辑」，否则为「新建」
  note: { type: Object, default: null }
});
const emit = defineEmits(['close', 'saved']);

const saving = ref(false);
const form = reactive({ title: '', tags: '', content: '' });

// 每次打开时按当前笔记填充表单
watch(
  () => props.open,
  (open) => {
    if (!open) return;
    form.title = props.note ? props.note.title || '' : '';
    form.tags = props.note ? (props.note.tags || []).join(', ') : '';
    form.content = props.note ? props.note.content || '' : '';
  }
);

async function submit() {
  if (!form.title.trim()) return;
  saving.value = true;
  const editing = !!props.note;
  try {
    const payload = { title: form.title, tags: form.tags, content: form.content };
    const note = editing ? await api.updateNote(props.note.slug, payload) : await api.createNote(payload);
    showToast(editing ? '笔记已更新' : '笔记已保存');
    emit('saved', note, editing ? 'edit' : 'create');
    emit('close');
  } catch (e) {
    showToast(e.message);
  } finally {
    saving.value = false;
  }
}
</script>