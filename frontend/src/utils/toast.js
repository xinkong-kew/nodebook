import { ref } from 'vue';

// 全局轻量提示
export const toastMessage = ref('');
let timer = null;

export function showToast(message, duration = 2200) {
  toastMessage.value = message;
  clearTimeout(timer);
  timer = setTimeout(() => {
    toastMessage.value = '';
  }, duration);
}