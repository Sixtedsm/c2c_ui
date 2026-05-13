import Vue from 'vue';

import c2c from '@/js/apis/c2c';
import { getImageUrl } from '@/js/image-urls';
import * as store from '@/pwa/offline-store';

const EMBEDDED_IMAGE_REGEX = /<img[^<>]+c2c:document-id="(\d+)"/gm;
const IMG_SRC_REGEX = /<img\b[^>]*\bsrc\s*=\s*["']([^"']+)["']/gim;
const IMAGE_SIZES_TO_PREFETCH = ['MI', 'SI'];

function extractImageSrcs(cooked) {
  const out = new Set();
  if (!cooked) {
    return out;
  }
  const visit = (value) => {
    if (typeof value !== 'string' || value.indexOf('<img') === -1) {
      return;
    }
    let match;
    IMG_SRC_REGEX.lastIndex = 0;
    while ((match = IMG_SRC_REGEX.exec(value)) !== null) {
      out.add(match[1]);
    }
  };
  if (typeof cooked === 'string') {
    visit(cooked);
  } else if (typeof cooked === 'object') {
    for (const value of Object.values(cooked)) {
      visit(value);
    }
  }
  return out;
}

async function prefetchUrl(url) {
  try {
    await fetch(url, { cache: 'reload', mode: 'cors' });
  } catch {
    // ignore individual failures — the image just won't be available offline
  }
}

async function prefetchImageVariants(imageDoc) {
  if (!imageDoc) {
    return;
  }
  for (const size of IMAGE_SIZES_TO_PREFETCH) {
    const url = getImageUrl(imageDoc, size);
    if (url) {
      await prefetchUrl(url);
    }
  }
}

async function prefetchSrcsFromCooked(cooked) {
  for (const url of extractImageSrcs(cooked)) {
    // Cooked HTML may contain absolute or protocol-relative URLs. We fetch
    // them as-is so the service worker caches exactly the URL the browser
    // will request when rendering the topo offline.
    await prefetchUrl(url);
  }
}

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
        pendingOutings: [],
        downloading: new Set(),
        syncing: false,
      };
    },

    async created() {
      window.addEventListener('online', this.handleOnline);
      window.addEventListener('offline', this.handleOffline);
      await this.refresh();
      if (this.online && this.pendingOutings.length) {
        this.syncPendingOutings();
      }
    },

    methods: {
      handleOnline() {
        this.online = true;
        if (this.pendingOutings.length) {
          this.syncPendingOutings();
        }
      },

      handleOffline() {
        this.online = false;
      },

      async refresh() {
        this.savedDocs = await store.listDocuments();
        this.folders = await store.listFolders();
        this.pendingOutings = await store.listPendingOutings();
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
          // Strategy: cache the EXACT URLs the browser will request when
          // rendering the topo offline.
          //
          // 1) Pull every src= URL out of the cooked HTML and fetch them as-is.
          //    Whatever pattern the server-side cooker emits (proxy URL, media
          //    direct, etc.) is what the browser will ask for later, so this
          //    is the most reliable way to populate the SW image cache.
          await prefetchSrcsFromCooked(data?.cooked);

          // 2) Gallery images (associations.images): prefetch the size
          //    variants the gallery template usually requests (MI for the
          //    grid, SI for the thumbnail strip). These go through getImageUrl
          //    which constructs the same URL the gallery will build.
          const associatedImages = Array.isArray(data?.associations?.images) ? data.associations.images : [];
          for (const image of associatedImages) {
            try {
              await prefetchImageVariants(image);
            } catch {
              /* ignore */
            }
          }

          // 3) Also persist the lightweight image metadata for images that are
          //    embedded by id (so a later code path that calls c2c.image.get…
          //    on them still resolves offline).
          const embeddedIds = extractEmbeddedImageIds(data?.cooked).map(String);
          const associatedIds = new Set(associatedImages.map((img) => String(img.document_id)));
          for (const imageId of embeddedIds) {
            if (associatedIds.has(imageId)) {
              continue;
            }
            try {
              const imgResponse = await c2c.image.getCooked(imageId, lang);
              await store.saveDocument({
                type: 'image',
                id: imageId,
                lang,
                data: imgResponse.data,
                folderId,
              });
              await prefetchImageVariants(imgResponse.data);
            } catch {
              /* ignore */
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

      async queueOuting(document) {
        const entry = await store.enqueuePendingOuting({
          payload: document,
          title: document?.locales?.[0]?.title || this.$gettext?.('Untitled') || 'Untitled',
        });
        this.pendingOutings = await store.listPendingOutings();
        return entry;
      },

      async syncPendingOutings() {
        if (this.syncing || !this.online) {
          return;
        }
        const queue = await store.listPendingOutings();
        if (!queue.length) {
          return;
        }
        this.syncing = true;
        const remaining = [];
        for (const item of queue) {
          try {
            const response = await c2c.outing.create(item.payload);
            // success: drop from queue
            // optionally we could notify the UI here
            if (!response?.data?.document_id) {
              remaining.push({ ...item, attempts: item.attempts + 1, lastError: 'no-id' });
            }
          } catch (error) {
            remaining.push({
              ...item,
              attempts: item.attempts + 1,
              lastError: error?.response?.status ?? 'network',
            });
          }
        }
        await store.replacePendingOutings(remaining);
        this.pendingOutings = remaining;
        this.syncing = false;
      },

      async removePendingOuting(id) {
        await store.removePendingOuting(id);
        this.pendingOutings = await store.listPendingOutings();
      },
    },
  });

  Vue.prototype.$offline = vm;
}
