<script setup>
// Popup of a shift: coverage summary plus the same editor as the Edit view (minimum staff, add or remove
// people, generate the shift). It stays open while editing; the details refresh with the state.
import { computed, ref } from 'vue';
import { shiftDetail } from '../domain/sheet.js';
import { closeDialog, dialog, sheetInput, t } from '../state.js';
import DialogBox from './DialogBox.vue';
import ShiftEditor from './ShiftEditor.vue';

const detail = computed(() => shiftDetail(sheetInput.value, dialog.value.day, dialog.value.shift));
const isCovered = computed(() => detail.value.status === 'ok');
const notice = ref({ message: '', isError: false });

const coverageText = computed(() => {
  let suffix = '';
  if (detail.value.missingText) suffix = t.value('shiftPopup.missingSuffix', { text: detail.value.missingText });
  else if (isCovered.value) suffix = t.value('shiftPopup.coveredSuffix');
  return t.value('shiftPopup.coverage', {
    covered: detail.value.covered,
    required: detail.value.required,
    suffix,
  });
});
</script>

<template>
  <DialogBox labelledby="shift-popup-title" @close="closeDialog">
    <header>
      <h3 id="shift-popup-title">{{ detail.title }} <small>{{ detail.time }}</small></h3>
    </header>
    <p :class="isCovered ? 'ok' : 'error'">{{ coverageText }}</p>
    <p v-if="notice.message" :class="notice.isError ? 'error' : 'warn'" role="status">{{ notice.message }}</p>

    <ShiftEditor :day="detail.day" :shift-key="detail.shift" @notice="notice = $event" />

    <footer>
      <button type="button" autofocus @click="closeDialog">{{ t('shiftPopup.close') }}</button>
    </footer>
  </DialogBox>
</template>
