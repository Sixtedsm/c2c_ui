<template>
  <!-- the ad network picks the size of an ad from the url ("/" is the home page, any other url an article: a banner of
  728 px), not from the room it has: an ad wider than its room is scaled down to it, whole -->
  <div ref="room" class="ad-room">
    <div id="camptocamp_htd" ref="ad" class="ams-ad is-flex" />
  </div>
</template>

<script setup lang="ts">
import { onBeforeUnmount, onMounted, useTemplateRef } from 'vue';

import { loadAdScript } from '@/js/ad-script';

const room = useTemplateRef('room');
const ad = useTemplateRef('ad');

function fit() {
  if (!room.value || !ad.value) {
    return;
  }
  const style = getComputedStyle(room.value);
  const width = room.value.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight);
  const scale = Math.min(1, width / ad.value.offsetWidth || 1);
  ad.value.style.transform = scale < 1 ? `scale(${scale})` : '';
  // a transform leaves the ad its whole height in the page: it gives back what it no longer takes
  ad.value.style.marginBottom = scale < 1 ? `${-ad.value.offsetHeight * (1 - scale)}px` : '';
}

let observer: ResizeObserver | undefined;

// the ad script displays its slots as soon as it runs, and Google Publisher Tag gives up on a slot whose div is not
// in the page yet: it is only asked for once this div is mounted (it is then added after the page has loaded)
onMounted(() => {
  // fitted again when the room changes (the window) and when the ad does (each new ad)
  observer = new ResizeObserver(fit);
  observer.observe(room.value!);
  observer.observe(ad.value!);
  loadAdScript();
});

onBeforeUnmount(() => observer?.disconnect());
</script>

<style scoped>
.ams-ad {
  width: max-content;
  margin-inline: auto;
  transform-origin: top left;
}
</style>
