<template>
  <!-- the categories as the forum shows them on a computer: each one with its description, its subcategories, and the
       topics of both -->
  <table class="ct-table">
    <thead>
      <tr>
        <th>{{ $gettext('Category') }}</th>
        <th class="ct-count">{{ $gettext('Topics') }}</th>
      </tr>
    </thead>
    <tbody>
      <tr v-for="parent of tree" :key="parent.id" class="ct-row" :style="{ borderLeftColor: color(parent) }">
        <td>
          <router-link :to="categoryRoute(parent)" class="ct-name">{{ parent.name }}</router-link>
          <p v-if="parent.description_text" class="ct-desc">{{ plainTitle(parent.description_text) }}</p>
          <ul v-if="parent.children.length" class="ct-subs">
            <li v-for="child of parent.children" :key="child.id">
              <router-link :to="categoryRoute(child)" class="ct-sub">
                <span class="ct-square" :style="{ background: color(child) }" />
                {{ child.name }}
              </router-link>
            </li>
          </ul>
        </td>
        <td class="ct-count">{{ compactCount(parent.totalTopics, $language.current) }}</td>
      </tr>
    </tbody>
  </table>
</template>

<script setup lang="ts">
import { computed } from 'vue';

import type { Discourse } from '@/js/apis/forum';
import { categoryTree, compactCount, plainTitle } from '@/views/forum/forum-utils';

defineOptions({ name: 'ForumCategoryTable' });

const props = defineProps<{ categories: Discourse[] }>();

const tree = computed(() => categoryTree(props.categories));
const color = (category: Discourse) => '#' + (category.color || 'aaaaaa');
const categoryRoute = (category: Discourse) => ({
  name: 'forum-category',
  params: { slug: category.slug, id: category.id },
});
</script>

<style scoped lang="scss">
.ct-table {
  width: 100%;
  border-collapse: collapse;

  th {
    padding: 0.4rem 0.75rem;
    border-bottom: 2px solid rgba(0, 0, 0, 0.1);
    font-size: 0.8rem;
    font-weight: 500;
    color: #6b6b6b;
    text-align: left;
  }

  td {
    padding: 0.75rem;
    border-bottom: 1px solid rgba(0, 0, 0, 0.08);
    vertical-align: top;
  }
}

.ct-row {
  border-left: 6px solid #aaaaaa;
}

.ct-name {
  font-size: 1.05rem;
  font-weight: 600;
  color: #363636;

  &:hover,
  &:focus {
    color: #ff9933;
  }
}

.ct-desc {
  margin: 0.2rem 0 0;
  font-size: 0.85rem;
  color: #6b6b6b;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.ct-subs {
  display: flex;
  flex-wrap: wrap;
  gap: 0.15rem 1rem;
  margin: 0.4rem 0 0;
  padding: 0;
  list-style: none;
}

.ct-sub {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  font-size: 0.82rem;
  color: #6b6b6b;

  &:hover,
  &:focus {
    color: #ff9933;
  }
}

.ct-square {
  width: 0.6rem;
  height: 0.6rem;
  flex: 0 0 auto;
}

.ct-count {
  width: 5rem;
  text-align: right !important;
  font-weight: 600;
  color: #4a4a4a;
  white-space: nowrap;
}
</style>

<style lang="scss">
html[data-theme='dark'] .ct-table {
  th {
    color: #b5b5b5;
    border-bottom-color: rgba(255, 255, 255, 0.15);
  }

  td {
    border-bottom-color: rgba(255, 255, 255, 0.08);
  }

  .ct-name,
  .ct-count {
    color: #f0f0f0;
  }

  .ct-desc,
  .ct-sub {
    color: #b5b5b5;
  }
}
</style>
