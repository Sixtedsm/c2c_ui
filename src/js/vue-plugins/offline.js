import Vue from 'vue';

import c2c from '@/js/apis/c2c';
import * as store from '@/pwa/offline-store';

const EMBEDDED_IMAGE_REGEX = /<img[^<>]+c2c:document-id="(\d+)"/gm;

function extractEmbeddedImageIds(cooked) {
  if (!cooked) {
    return [];
  }
  const ids = new Set();
  const collect = (value) => {
    if (typeof value !== 'string') {
      return;
    }
    let match;
    EMBEDDED_IMAGE_REGEX.lastIndex = 0;
    while ((match = EMBEDDED_IMAGE_REGEX.exec(value)) !== null) {
      ids.add(match[1]);
    }
  };
  if (typeof cooked === 'string') {
    collect(cooked);
  } else if (typeof cooked === 'object') {
    for (const value of Object.values(cooked)) {
      collect(value);
    }
  }
  return [...ids];
}

export default function install(Vue) {
  const vm = new Vue({
    name: 'OfflinePlugin',

    data() {
      return {
        online: navigator.onLine,
        savedDocs: [],
        folders: [],
        downloading: new Set(),
      };
    },

    async created() {
      window.addEventListener('online', this.handleOnline);
      window.addEventListener('offline', this.handleOffline);
      await this.refresh();
    },

    methods: {
      handleOnline() {
        this.online = true;
      },

      handleOffline() {
        this.online = false;
      },

      async refresh() {
        this.savedDocs = await store.listDocuments();
        this.folders = await store.listFolders();
      },

      isSaved(type, id, lang) {
        return this.savedDocs.some(
          (entry) => entry.type === type && String(entry.id) === String(id) && entry.lang === lang
        );
      },

      isDownloading(type, id, lang) {
        return this.downloading.has(`${type}/${id}/${lang}`);
      },

      async saveDocument({ type, id, lang, folderId = null }) {
        const key = `${type}/${id}/${lang}`;
        if (this.downloading.has(key)) {
          return;
        }
        this.downloading = new Set([...this.downloading, key]);
        try {
          const service = c2c[type];
          if (!service) {
            throw new Error(`Unknown document type: ${type}`);
          }
          const { data } = await service.getCooked(id, lang);
          await store.saveDocument({ type, id, lang, data, folderId });
          const imageIds = extractEmbeddedImageIds(data?.cooked);
          for (const imageId of imageIds) {
            try {
              const imgResponse = await c2c.image.getCooked(imageId, lang);
              await store.saveDocument({
                type: 'image',
                id: imageId,
                lang,
                data: imgResponse.data,
                folderId,
              });
            } catch {
              // ignore individual image failures; the main document is still usable
            }
          }
          await this.refresh();
        } finally {
          const next = new Set(this.downloading);
          next.delete(key);
          this.downloading = next;
        }
      },

      async removeDocument(type, id, lang) {
        await store.deleteDocument(type, id, lang);
        await this.refresh();
      },

      async createFolder(name) {
        const id = `f_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
        await store.saveFolder({ id, name });
        await this.refresh();
        return id;
      },

      async renameFolder(id, name) {
        await store.saveFolder({ id, name });
        await this.refresh();
      },

      async removeFolder(id) {
        await store.deleteFolder(id);
        await this.refresh();
      },

      async moveDocumentToFolder(type, id, lang, folderId) {
        await store.setDocumentFolder(type, id, lang, folderId);
        await this.refresh();
      },

      async getDocument(type, id, lang) {
        return store.getDocument(type, id, lang);
      },

      async getStorageUsage() {
        return store.estimateUsage();
      },
    },
  });

  Vue.prototype.$offline = vm;
}
