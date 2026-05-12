import { get } from 'idb-keyval';
import { cleanupOutdatedCaches, precacheAndRoute } from 'workbox-precaching';
import { registerRoute } from 'workbox-routing';
import { NetworkFirst } from 'workbox-strategies';

precacheAndRoute(self.__WB_MANIFEST || []);

cleanupOutdatedCaches();

const DOC_PATH_REGEX = /^\/(articles|books|images|outings|routes|waypoints|xreports)\/(\d+)$/;
const DOC_SEARCH_REGEX = /^\?cook=([a-z]{2}(?:_[A-Z]{2})?)$/;
const PLURAL_TO_SINGULAR = {
  articles: 'article',
  books: 'book',
  images: 'image',
  outings: 'outing',
  routes: 'route',
  waypoints: 'waypoint',
  xreports: 'xreport',
};

const docKey = (type, id, lang) => `doc:${type}/${id}/${lang}`;

function parseDocRequest(url) {
  const pathMatch = DOC_PATH_REGEX.exec(url.pathname);
  const searchMatch = DOC_SEARCH_REGEX.exec(url.search);
  if (!pathMatch || !searchMatch) {
    return null;
  }
  const type = PLURAL_TO_SINGULAR[pathMatch[1]];
  if (!type) {
    return null;
  }
  return { type, id: pathMatch[2], lang: searchMatch[1] };
}

const apiDocStrategy = new NetworkFirst({
  cacheName: 'c2c-api-docs',
  networkTimeoutSeconds: 10,
  plugins: [
    {
      // The application stores documents in IndexedDB via the $offline plugin.
      // We do not duplicate them in the Workbox cache.
      cacheWillUpdate: async () => null,

      // On cache lookup, serve from IndexedDB if the document has been saved.
      cachedResponseWillBeUsed: async ({ request }) => {
        const parsed = parseDocRequest(new URL(request.url));
        if (!parsed) {
          return null;
        }
        const entry = await get(docKey(parsed.type, parsed.id, parsed.lang));
        if (!entry?.data) {
          return null;
        }
        return new Response(JSON.stringify(entry.data), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      },
    },
  ],
});

registerRoute(({ url, request }) => {
  if (request.method !== 'GET') {
    return false;
  }
  return parseDocRequest(url) !== null;
}, apiDocStrategy);
