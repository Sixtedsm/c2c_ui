import Vue from 'vue';

import c2c from '@/js/apis/c2c';
import { getImageUrl } from '@/js/image-urls';
import * as store from '@/pwa/offline-store';

const EMBEDDED_IMAGE_REGEX = /<img[^<>]+c2c:document-id="(\d+)"/gm;
const IMAGE_SIZES_TO_PREFETCH = ['MI', 'SI'];

async function prefetchImageVariants(imageDoc) {
  if (!imageDoc) {
    return;
  }
  for (const size of IMAGE_SIZES_TO_PREFETCH) {
    const url = getImageUrl(imageDoc, size);
    if (!url) {
      continue;
    }
    try {
      // The fetch is intercepted by the service worker's CacheFirst image
      // route, which stores the response in the c2c-images cache. cache:
      // 'reload' bypasses the HTTP cache so the SW always sees the request.
      await fetch(url, { cache: 'reload', mode: 'cors' });
    } catch {
      // ignore individual image failures
    }
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
          // Collect every image referenced by the document: those embedded in
          // the cooked HTML, plus the ones in associations.images (the gallery
          // below the topo). We deduplicate by document_id.
          const embeddedIds = extractEmbeddedImageIds(data?.cooked).map(String);
          const associatedImages = Array.isArray(data?.associations?.images) ? data.associations.images : [];
          const associatedIds = associatedImages.map((img) => String(img.document_id));
          const allImageIds = [...new Set([...embeddedIds, ...associatedIds])];

          // We already have light metadata for associated images; index by id
          // so we can prefetch their bytes without an extra round-trip.
          const associatedById = new Map(associatedImages.map((img) => [String(img.document_id), img]));

          for (const imageId of allImageIds) {
            try {
              let imageData;
              if (associatedById.has(imageId)) {
                // Lightweight: use what is already in the association payload
                // for prefetch purposes (filename + document_id are enough).
                imageData = associatedById.get(imageId);
              } else {
                const imgResponse = await c2c.image.getCooked(imageId, lang);
                imageData = imgResponse.data;
                // Only persist a full IDB entry for embedded images: the
                // app reads associations.images straight from the parent
                // document we have already saved, no need to duplicate.
                await store.saveDocument({
                  type: 'image',
                  id: imageId,
                  lang,
                  data: imageData,
                  folderId,
                });
              }
              await prefetchImageVariants(imageData);
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
