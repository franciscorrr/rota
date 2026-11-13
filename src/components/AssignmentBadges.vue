<script setup>
// Badges for an assignment: breaks a rule, and includes a break (which does not count as worked time).
import { t } from '../state.js';

defineProps({ bad: Boolean, breakMinutes: { type: Number, default: 0 } });
</script>

<template>
  <em v-if="bad" class="badge">{{ t('sheet.badgeBad') }}</em>
  <em v-if="breakMinutes > 0" class="badge break">☕ {{ t('sheet.badgeBreak', { minutes: breakMinutes }) }}</em>
</template>
