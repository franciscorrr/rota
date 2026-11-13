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

/** Pico's <dialog> covers the whole viewport and the box is the <article>: a click on the dialog itself is outside. */
function onClick(event) {
  if (event.target === dialogElement.value) emit('close');
}
</script>

<template>
  <dialog
    ref="dialogElement"
    class="no-print"
    :aria-labelledby="labelledby"
    @click="onClick"
    @cancel.prevent="emit('close')"
  >
    <article><slot /></article>
  </dialog>
</template>
