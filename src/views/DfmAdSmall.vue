<template>
  <!-- clipped: the ad network picks the size of the ad from the url, not from the room left (a banner of 728 px in a
  column of 300 px, on a page whose url is not "/"): it must not cover the column next to it -->
  <div id="camptocamp_htd" class="ams-ad is-flex is-justify-content-center is-clipped" />
</template>

<script setup lang="ts">
import { onMounted } from 'vue';

import { loadAdScript } from '@/js/ad-script';

// the ad script displays its slots as soon as it runs, and Google Publisher Tag gives up on a slot whose div is not
// in the page yet: it is only asked for once this div is mounted (it is then added after the page has loaded)
onMounted(loadAdScript);
</script>
