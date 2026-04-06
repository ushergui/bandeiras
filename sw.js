const CACHE_NAME = 'detetive-v1';
const CORE_ASSETS = [
    './',
    './index.html',
    './style.css',
    './script.js',
    './countries.js',
    './curiosities.js',
    './favicon.svg'
];

self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(CACHE_NAME).then(cache => {
            return cache.addAll(CORE_ASSETS);
        })
    );
});

self.addEventListener('fetch', event => {
    event.respondWith(
        caches.match(event.request).then(response => {
            // Retorna do cache se encontrar
            if (response) {
                return response;
            }
            // Se não tiver no cache, busca na rede
            return fetch(event.request).then(fetchResponse => {
                // Se for um arquivo da pasta assets (como áudios e imagens que são pesados),
                // armazena dinamicamente no cache depois do primeiro download
                if (event.request.url.includes('/assets/')) {
                    return caches.open(CACHE_NAME).then(cache => {
                        cache.put(event.request, fetchResponse.clone());
                        return fetchResponse;
                    });
                }
                return fetchResponse;
            });
        })
    );
});
