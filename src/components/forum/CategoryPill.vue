<template>
  <!-- a category of the forum, in its color: a link to its topics -->
  <router-link
    v-if="category"
    :to="{ name: 'forum-category', params: { slug: category.slug, id: category.id } }"
    class="fc-pill"
    :style="{ borderColor: color + '55' }"
    :title="parent?.name ? `${parent.name} › ${category.name}` : category.name"
    @click.stop
  >
    <span class="fc-pill-dot" :style="{ backgroundColor: color }"></span>
    <span class="fc-pill-name">{{ category.name }}</span>
  </router-link>
</template>

<script setup lang="ts">
import { computed } from 'vue';

import type { Discourse } from '@/js/apis/forum';

defineOptions({ name: 'ForumCategoryPill' });

const props = defineProps<{ category: Discourse | null; parent?: Discourse | null }>();

const color = computed(() => '#' + (props.category?.color || 'aaaaaa'));
</script>

<style scoped lang="scss">
.fc-pill {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  padding: 0.15rem 0.5rem 0.15rem 0.4rem;
  border: 1px solid rgba(0, 0, 0, 0.1);
  border-radius: 3px;
  background: rgba(0, 0, 0, 0.03);
  font-size: 0.7rem;
  font-weight: 600;
  color: #4a4a4a;
  text-decoration: none;
  line-height: 1.3;
  max-width: 100%;

  &:hover,
  &:focus {
    background: rgba(0, 0, 0, 0.06);
    color: #4a4a4a;
    text-decoration: none;
  }
}

.fc-pill-dot {
  width: 8px;
  height: 8px;
  border-radius: 2px;
  flex: 0 0 auto;
}

.fc-pill-name {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 140px;
}
</style>

<style lang="scss">
html[data-theme='dark'] {
  .fc-pill {
    background: rgba(255, 255, 255, 0.05);
    border-color: rgba(255, 255, 255, 0.12);
    color: #e5e5e5;
    &:hover,
    &:focus {
      background: rgba(255, 255, 255, 0.1);
      color: #e5e5e5;
    }
  }
}
</style>
