<template>
  <div id="camptocamp_htad" class="ams-ad is-flex is-justify-content-center is-clipped" />
</template>

<script setup lang="ts">
import { onMounted } from 'vue';

import { loadAdScript } from '@/js/ads';

// the ad script once a slot is in the page, after the page (src/js/ads.ts)
onMounted(loadAdScript);
</script>

<style lang="css" scoped>
#camptocamp_htad {
  min-width: 728px;
}
</style>
