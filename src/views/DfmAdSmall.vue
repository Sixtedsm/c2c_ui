<template>
  <div id="camptocamp_htd" class="ams-ad is-flex is-justify-content-center" />
</template>

<script setup lang="ts">
import { onMounted } from 'vue';

import { loadAdScript } from '@/js/ads';

// the ad script once a slot is in the page, after the page (src/js/ads.ts)
onMounted(loadAdScript);
</script>
