<script setup>
// Number field: if the typed value is invalid, it restores the previous one. Classes and attributes
// (`class`, `aria-label`...) are passed to the <input>.
import { parseNumber } from '../domain/actions.js';

const props = defineProps({
  modelValue: { type: Number, required: true },
  min: { type: Number, default: 0 },
  step: { type: Number, default: 1 },
  integer: Boolean,
});
const emit = defineEmits(['update:modelValue']);

function commit(event) {
  const value = parseNumber(event.target.value, props.modelValue, { min: props.min, integer: props.integer });
  event.target.value = String(value);
  emit('update:modelValue', value);
}
</script>

<template>
  <input type="number" :min="min" :step="step" :value="modelValue" @change="commit" />
</template>
