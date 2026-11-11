<script setup>
// Native modal dialog. It opens on mount; Escape or a click on the backdrop emits `close`.
// On unmount it returns focus to the element that had it before opening.
import { onBeforeUnmount, onMounted, ref } from 'vue';

defineProps({ labelledby: { type: String, required: true } });
const emit = defineEmits(['close']);

const dialogElement = ref(null);
let opener = null;

onMounted(() => {
  opener = document.activeElement;
  dialogElement.value.showModal();
});

onBeforeUnmount(() => {
  dialogElement.value?.close();
  if (opener?.isConnected) opener.focus();
});

/** The "backdrop" of a modal <dialog> is the element itself: only a click outside its box counts. */
function onClick(event) {
  if (event.target !== dialogElement.value) return;
  const box = dialogElement.value.getBoundingClientRect();
  const outsideBox = event.clientX < box.left
    || event.clientX > box.right
    || event.clientY < box.top
    || event.clientY > box.bottom;
  const isKeyboardClick = event.clientX === 0 && event.clientY === 0;
  if (outsideBox || isKeyboardClick) emit('close');
}
</script>

<template>
  <dialog
    ref="dialogElement"
    class="shift-popup no-print"
    :aria-labelledby="labelledby"
    @click="onClick"
    @cancel.prevent="emit('close')"
  >
    <slot />
  </dialog>
</template>
