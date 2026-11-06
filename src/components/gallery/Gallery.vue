<template>
  <!-- The scrolling of the phone itself, not a JavaScript slider: it follows the finger at once, and how far it goes
       depends on how fast the swipe was -->
  <div class="gallery-strip">
    <div
      v-for="image of images"
      :key="image.document_id"
      class="gallery-item"
      :style="{ height: SLIDE_HEIGHT + 'px', width: slideWidth(image) }"
    >
      <!-- in a card that links to its document: a photo opens the photo, not the document -->
      <thumbnail
        :img="image"
        size="MI"
        :alt="image.locales[0].title"
        :title="image.locales[0].title"
        @click.stop.prevent="$imageViewer.show(image)"
        loading="lazy"
      />
    </div>
    <!-- the caller knows there are more photos than it gave (the feed gives three): they come in place -->
    <div v-if="hasMore" class="gallery-item gallery-more" :style="{ height: SLIDE_HEIGHT + 'px' }">
      <button type="button" class="gallery-more-button" @click.stop.prevent="$emit('more')">
        <fa-icon :icon="loadingMore ? 'spinner' : 'image'" :spin="loadingMore" class="is-size-3" />
        <span>{{ $gettext('See all the photos') }}</span>
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { watch, type PropType } from 'vue';

import { useGlobalProperties } from '@/js/composables/global-properties';

type GalleryImage = {
  document_id: number;
  filename?: string;
  locales: { title?: string | null }[];
  width?: number | null;
  height?: number | null;
};

const SLIDE_HEIGHT = 200;

// the width of an image at the height of the slides, when the API gives its size: the slide keeps it while the image
// loads, instead of growing from nothing and pushing the next ones (#4883)
function slideWidth(image: GalleryImage) {
  return image.width && image.height ? `${Math.round((SLIDE_HEIGHT * image.width) / image.height)}px` : undefined;
}

const props = defineProps({
  images: {
    type: Array as PropType<GalleryImage[]>,
    required: true,
  },
  hasMore: {
    type: Boolean,
    default: false,
  },
  loadingMore: {
    type: Boolean,
    default: false,
  },
});

defineEmits<{ more: [] }>();

const { $imageViewer } = useGlobalProperties();

// deep 1: also when images are added to the array (uploads), as Vue 2 array watchers did
watch(
  () => props.images,
  () => props.images.forEach($imageViewer.push),
  { deep: 1, immediate: true }
);
</script>

<style scoped lang="scss">
// the width of its box, also as a flex item (card rows): its minimum width would otherwise be the width of all the
// photos, and it would overflow the card
.gallery-strip {
  display: flex;
  gap: 15px;
  width: 100%;
  min-width: 0;
  overflow-x: auto;
  // a horizontal swipe stays in the strip: it does not go back in history
  overscroll-behavior-x: contain;
  scrollbar-width: thin;
}

.gallery-item {
  flex: 0 0 auto;
  cursor: pointer;

  picture :deep(img) {
    height: 200px;
  }
}

// same footprint as a photo, visibly not one
.gallery-more {
  width: 150px;
}

.gallery-more-button {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.4rem;
  width: 100%;
  height: 100%;
  padding: 0.5rem;
  border: 1px dashed $grey-lighter;
  border-radius: 4px;
  background: transparent;
  color: $grey;
  font: inherit;
  font-size: 0.8rem;
  cursor: pointer;
}
</style>
