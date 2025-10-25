const CACHE_NAME = 'cont1-cache-v1.0.0';

const ASSETS_TO_CACHE = [
  '/',                    // index.html (raiz)
  '/index.html',
  '/styles.css',
  '/app.js',
  '/manifest.json',
  '/icon-192.png',        // atualize nome/paths dos ícones conforme necessário
  '/icon-512.png',
  'https://cdn.jsdelivr.net/npm/chart.js'
];

// Instalação: cacheia recursos essenciais
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return cache.addAll(ASSETS_TO_CACHE);
    })
  );
  self.skipWaiting();
});

// Ativação: remove caches antigos se houver atualização
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames =>
      Promise.all(
        cacheNames
          .filter(name => name !== CACHE_NAME)
          .map(name => caches.delete(name))
      )
    )
  );
  self.clients.claim();
});

// Fetch: responde do cache ou busca na rede
self.addEventListener('fetch', event => {
  // Apenas GET e arquivos do mesmo domínio (exceto chrome-extension)
  if (event.request.method !== 'GET' || event.request.url.startsWith('chrome-extension')) return;

  event.respondWith(
    caches.match(event.request).then(response => {
      return response || fetch(event.request)
        .then(fetchRes => {
          // Opcional: atualiza cache dinamicamente se quiser (exemplo: put() cada fetch)
          return fetchRes;
        });
    }).catch(() => {
      // Offline e não encontrou o arquivo: pode retornar uma página offline customizada se quiser
    })
  );
});
