import { get } from 'idb-keyval';
import { ExpirationPlugin } from 'workbox-expiration';
import { cleanupOutdatedCaches, createHandlerBoundToURL, precacheAndRoute } from 'workbox-precaching';
import { NavigationRoute, registerRoute, setCatchHandler } from 'workbox-routing';
import { CacheFirst, NetworkFirst } from 'workbox-strategies';

precacheAndRoute(self.__WB_MANIFEST || [], {
  ignoreURLParametersMatching: [/.*/],
});

cleanupOutdatedCaches();

self.addEventListener('install', () => {
  // New SW takes effect immediately instead of after every tab is closed.
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

// SPA navigation: serve the precached app shell for any in-app navigation,
// including (re)launches of the standalone app while offline.
const navigationHandler = createHandlerBoundToURL('/index.html');
registerRoute(
  new NavigationRoute(navigationHandler, {
    denylist: [/^\/google[\w]*\.html$/, /^\/revive-adserver\.html$/],
  })
);

// C2C document requests: NetworkFirst with a 10s timeout, and an IndexedDB
// fallback served by the $offline plugin's store. The Workbox cache itself
// stays empty for documents — IndexedDB owns the persistence.
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
      cacheWillUpdate: async () => null,
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

// C2C images (cover photos + inline gallery). CacheFirst means once the app
// has fetched an image (either because the user viewed the topo online, or
// because $offline prefetched it after saving), subsequent loads — including
// fully offline — are instant and free.
registerRoute(
  ({ url, request }) => {
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
  },
  new CacheFirst({
    cacheName: 'c2c-images',
    plugins: [
      new ExpirationPlugin({
        maxEntries: 500,
        maxAgeSeconds: 90 * 24 * 60 * 60, // 90 days
        purgeOnQuotaError: true,
      }),
    ],
  })
);

// Map tiles. The most common pattern is .../{z}/{x}/{y}.{png|jpg}. We match it
// across any host so OpenTopoMap, Swisstopo, IGN, ESRI, OSM, etc. all get
// transparently cached when the user pans the map online — then are reusable
// offline in the mountains.
registerRoute(
  ({ url, request }) => {
    if (request.method !== 'GET') {
      return false;
    }
    return /\/\d+\/\d+\/\d+\.(png|jpe?g|webp)(\?.*)?$/i.test(url.pathname + url.search);
  },
  new CacheFirst({
    cacheName: 'c2c-map-tiles',
    plugins: [
      new ExpirationPlugin({
        maxEntries: 2000,
        maxAgeSeconds: 60 * 24 * 60 * 60, // 60 days
        purgeOnQuotaError: true,
      }),
    ],
  })
);

// Catch-all: if any request fails and nothing above served a response, try
// hard to recover. Specifically, for navigation requests, fall back to the
// precached app shell so a (re)launch in airplane mode does not show the
// browser's native "no internet" error page.
setCatchHandler(async ({ request }) => {
  if (request.destination === 'document' || request.mode === 'navigate') {
    const cached = await caches.match('/index.html', { ignoreSearch: true });
    if (cached) {
      return cached;
    }
  }
  return Response.error();
});
