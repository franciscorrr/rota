<script setup>
// Badges for an assignment: breaks a rule, and includes a break (which does not count as worked time).
import { t } from '../state.js';

defineProps({ bad: Boolean, breakMinutes: { type: Number, default: 0 } });
</script>

<template>
  <mark v-if="bad">{{ t('sheet.badgeBad') }}</mark>
  <mark v-if="breakMinutes > 0">☕ {{ t('sheet.badgeBreak', { minutes: breakMinutes }) }}</mark>
</template>
