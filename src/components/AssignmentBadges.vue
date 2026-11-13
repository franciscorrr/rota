<script setup>
// Badge for an assignment that breaks a rule.
import { t } from '../state.js';

defineProps({ bad: Boolean });
</script>

<template>
  <em v-if="bad" class="badge">{{ t('sheet.badgeBad') }}</em>
</template>
