import { get } from 'idb-keyval';
import { cleanupOutdatedCaches, createHandlerBoundToURL, precacheAndRoute } from 'workbox-precaching';
import { NavigationRoute, registerRoute } from 'workbox-routing';
import { CacheFirst, NetworkFirst } from 'workbox-strategies';

// Precache the app shell built by Vue CLI. We ignore all query parameters so a
// homescreen launch with utm/fbclid/etc tracking still finds the cached entry.
precacheAndRoute(self.__WB_MANIFEST || [], {
  ignoreURLParametersMatching: [/.*/],
});

cleanupOutdatedCaches();

// SPA navigation fallback: when the user (re)opens the app while offline, or
// navigates to a deep link without network, serve the precached index.html
// instead of letting the browser show its native "no internet" page. Vue Router
// then resolves the actual route on the client.
const navigationHandler = createHandlerBoundToURL('/index.html');
registerRoute(
  new NavigationRoute(navigationHandler, {
    denylist: [/^\/google[\w]*\.html$/, /^\/revive-adserver\.html$/],
  })
);

self.addEventListener('install', () => {
  // Take over from the previous service worker as soon as the new one is
  // installed so updates land on the next page load instead of the next
  // standalone-app launch.
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

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

// Media (images): aggressive CacheFirst. Once a route is saved offline the
// app explicitly fetches the embedded images, which fills this cache; on
// subsequent loads (or fully offline) the SW serves them straight from disk.
registerRoute(({ url, request }) => {
  if (request.method !== 'GET') {
    return false;
  }
  if (!/camptocamp\.org$/.test(url.hostname)) {
    return false;
  }
  if (/^\/images\/proxy\/\d+/.test(url.pathname)) {
    return true;
  }
  return /\.(jpe?g|png|gif|svg|webp|avif)$/i.test(url.pathname);
}, new CacheFirst({ cacheName: 'c2c-images' }));
