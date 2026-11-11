<script setup>
// Badges for an assignment: extra shift and rule violation.
import { t } from '../state.js';

defineProps({ partial: Boolean, bad: Boolean });
</script>

<template>
  <em v-if="partial" class="badge">{{ t('sheet.badgePartial') }}</em>
  <em v-if="bad" class="badge">{{ t('sheet.badgeBad') }}</em>
</template>
