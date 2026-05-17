const CACHE_VERSION = 'yamedo-ai-v1';
const STATIC_CACHE = `${CACHE_VERSION}-static`;
const DYNAMIC_CACHE = `${CACHE_VERSION}-dynamic`;

const STATIC_URLS = [
  '/',
  '/index.html',
  '/manifest.json',
];

// インストール時にキャッシュを準備
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) => {
      return cache.addAll(STATIC_URLS).catch(() => {
        // キャッシュ追加に失敗してもインストールを続行
        return Promise.resolve();
      });
    })
  );
  self.skipWaiting();
});

// 古いキャッシュを削除
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name !== STATIC_CACHE && name !== DYNAMIC_CACHE)
          .map((name) => caches.delete(name))
      );
    })
  );
  self.clients.claim();
});

// ネットワークが利用可能なら新規取得、失敗したらキャッシュから取得
self.addEventListener('fetch', (event) => {
  const { request } = event;

  // GETリクエストのみ処理
  if (request.method !== 'GET') {
    return;
  }

  event.respondWith(
    fetch(request)
      .then((response) => {
        // 成功時、レスポンスをキャッシュに保存
        if (response && response.status === 200) {
          const responseToCache = response.clone();
          caches.open(DYNAMIC_CACHE).then((cache) => {
            cache.put(request, responseToCache);
          });
        }
        return response;
      })
      .catch(() => {
        // ネットワークエラー時、キャッシュから取得
        return caches.match(request).then((response) => {
          if (response) {
            return response;
          }
          // キャッシュにもなければ、インデックスを返す
          if (request.mode === 'navigate') {
            return caches.match('/');
          }
          return new Response('No cache available', {
            status: 503,
            statusText: 'Service Unavailable',
          });
        });
      })
  );
});
