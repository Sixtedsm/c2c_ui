<template>
  <div class="offline-view container is-fluid">
    <header class="offline-header">
      <h1 class="title is-3">
        <fa-icon icon="download" class="has-text-primary" />
        {{ $gettext('My offline topos') | uppercaseFirstLetter }}
      </h1>
      <div class="offline-status">
        <span :class="$offline.online ? 'tag is-success is-light' : 'tag is-warning'">
          <fa-icon :icon="$offline.online ? 'cloud' : 'plug'" />
          &nbsp;{{ $offline.online ? $gettext('Online') : $gettext('Offline') }}
        </span>
        <span v-if="storageLabel" class="storage-info is-size-7 has-text-grey">{{ storageLabel }}</span>
      </div>
    </header>

    <div v-if="!entries.length" class="empty-state has-text-centered">
      <fa-icon icon="download" size="4x" class="has-text-grey-lighter" />
      <p class="title is-5 mt-4">
        {{ $gettext('No topos saved for offline use yet.') | uppercaseFirstLetter }}
      </p>
      <p class="subtitle is-6 has-text-grey">
        {{ $gettext('Open a route, waypoint or outing, and tap "Save for offline use" to keep it on this device.') }}
      </p>
      <router-link :to="{ name: 'routes' }" class="button is-primary mt-2">
        {{ $gettext('Browse the topoguide') | uppercaseFirstLetter }}
      </router-link>
    </div>

    <section v-else class="offline-grid">
      <article
        v-for="entry in entries"
        :key="entryKey(entry)"
        class="offline-card"
        :class="{ 'is-disabled': !$offline.online && !canOpenOffline(entry) }"
      >
        <router-link :to="linkTo(entry)" class="offline-card-body">
          <div class="offline-card-icon">
            <fa-icon :icon="iconFor(entry.type)" size="lg" />
          </div>
          <div class="offline-card-content">
            <h3 class="offline-card-title">{{ titleOf(entry) }}</h3>
            <div class="offline-card-meta">
              <span class="tag is-light">{{ $gettext(entry.type) }}</span>
              <span class="tag is-light">{{ entry.lang.toUpperCase() }}</span>
              <span class="has-text-grey is-size-7">{{ formatDate(entry.savedAt) }}</span>
            </div>
          </div>
        </router-link>
        <button
          class="offline-card-remove button is-small is-text"
          :title="$gettext('Remove from offline use')"
          @click="remove(entry)"
        >
          <fa-icon icon="trash" />
        </button>
      </article>
    </section>
  </div>
</template>

<script>
const TYPE_ICONS = {
  route: 'route',
  waypoint: 'map-marker-alt',
  outing: ['document-type', 'outing'],
  article: 'newspaper',
  book: 'atlas',
  image: 'image',
  xreport: 'exclamation-circle',
};

export default {
  name: 'OfflineView',

  data() {
    return {
      storage: null,
    };
  },

  computed: {
    entries() {
      return [...this.$offline.savedDocs].sort((a, b) => (b.savedAt || 0) - (a.savedAt || 0));
    },

    storageLabel() {
      if (!this.storage) {
        return null;
      }
      const { usage, quota } = this.storage;
      if (!usage) {
        return null;
      }
      const used = this.formatBytes(usage);
      if (!quota) {
        return used;
      }
      return `${used} / ${this.formatBytes(quota)}`;
    },
  },

  async mounted() {
    this.storage = await this.$offline.getStorageUsage();
  },

  methods: {
    entryKey(entry) {
      return `${entry.type}/${entry.id}/${entry.lang}`;
    },

    linkTo(entry) {
      return {
        name: entry.type,
        params: { id: String(entry.id), lang: entry.lang },
      };
    },

    canOpenOffline() {
      return true;
    },

    iconFor(type) {
      return TYPE_ICONS[type] || 'file-download';
    },

    titleOf(entry) {
      const data = entry.data;
      if (!data) {
        return this.$gettext('Untitled');
      }
      if (data.cooked?.title) {
        return data.cooked.title;
      }
      if (Array.isArray(data.locales)) {
        const localeMatch = data.locales.find((l) => l.lang === entry.lang) || data.locales[0];
        if (localeMatch?.title) {
          return localeMatch.title;
        }
      }
      return this.$gettext('Untitled');
    },

    formatDate(ts) {
      if (!ts) {
        return '';
      }
      try {
        return new Date(ts).toLocaleDateString(this.$language?.current);
      } catch {
        return new Date(ts).toLocaleDateString();
      }
    },

    formatBytes(bytes) {
      if (!bytes || bytes < 1024) {
        return `${bytes || 0} B`;
      }
      const units = ['KB', 'MB', 'GB'];
      let value = bytes / 1024;
      let unit = 0;
      while (value >= 1024 && unit < units.length - 1) {
        value /= 1024;
        unit += 1;
      }
      return `${value.toFixed(value < 10 ? 1 : 0)} ${units[unit]}`;
    },

    async remove(entry) {
      const message = this.$gettext('Remove this topo from offline storage?');
      // eslint-disable-next-line no-alert
      if (!window.confirm(message)) {
        return;
      }
      await this.$offline.removeDocument(entry.type, entry.id, entry.lang);
      this.storage = await this.$offline.getStorageUsage();
    },
  },
};
</script>

<style scoped lang="scss">
.offline-view {
  padding: 1rem;
  max-width: 1200px;
  margin: 0 auto;
}

.offline-header {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  margin-bottom: 1.5rem;
}

.offline-status {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.empty-state {
  padding: 3rem 1rem;
  border: 2px dashed #e5e5e5;
  border-radius: 12px;
  background: #fafafa;
}

.offline-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 1rem;
}

.offline-card {
  display: flex;
  align-items: stretch;
  background: $white;
  border: 1px solid #ececec;
  border-radius: 10px;
  overflow: hidden;
  transition: box-shadow 0.15s ease, transform 0.15s ease;

  &:hover {
    box-shadow: 0 4px 14px rgba(0, 0, 0, 0.08);
    transform: translateY(-1px);
  }

  &.is-disabled {
    opacity: 0.55;
  }
}

.offline-card-body {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.85rem 0.9rem;
  flex: 1;
  color: $text;
  text-decoration: none;
  min-width: 0;
}

.offline-card-icon {
  flex-shrink: 0;
  width: 2.5rem;
  height: 2.5rem;
  display: flex;
  align-items: center;
  justify-content: center;
  background: $color-base-c2c-lighter;
  border-radius: 8px;
  color: $color-base-c2c;
}

.offline-card-content {
  min-width: 0;
  flex: 1;
}

.offline-card-title {
  font-size: 1rem;
  font-weight: 600;
  margin: 0 0 0.25rem;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.offline-card-meta {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.4rem;
}

.offline-card-remove {
  border: 0;
  background: transparent;
  padding: 0 0.85rem;
  cursor: pointer;
  color: $grey;

  &:hover {
    color: $red;
  }
}
</style>
