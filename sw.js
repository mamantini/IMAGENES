// sw.js

const CACHE_NAME = 'hiitpro-timer-cache-v1'; // Dale un nombre y versión a tu caché
const urlsToCache = [
    '/', // La página principal (index.html en la raíz)
    'index.html',
    'style.css',
    'script.js',
    'manifest.json',
    // Añade aquí las rutas a tus iconos (relativas a la raíz)
    'icon-192.png',
    'icon-512.png',
    // Si tienes otras imágenes o fuentes importantes, añádelas también
    'https://fonts.googleapis.com/css2?family=Montserrat:wght@300;400;500;600;700;800;900&display=swap' // Cachear la fuente de Google
];

// Evento 'install': se dispara cuando el Service Worker se instala por primera vez.
// Aquí es donde cacheamos los archivos principales de la aplicación (App Shell).
self.addEventListener('install', event => {
    console.log('[ServiceWorker] Instalando...');
    event.waitUntil( // Espera a que la promesa se resuelva antes de considerar la instalación completa
        caches.open(CACHE_NAME) // Abre (o crea) la caché con el nombre que definimos
            .then(cache => {
                console.log('[ServiceWorker] Cache abierta, añadiendo archivos al caché:', urlsToCache);
                return cache.addAll(urlsToCache); // Añade todos los archivos de la lista a la caché
            })
            .then(() => {
                console.log('[ServiceWorker] Todos los archivos cacheados exitosamente.');
                return self.skipWaiting(); // Fuerza al nuevo SW a activarse inmediatamente (opcional, pero útil para desarrollo)
            })
            .catch(error => {
                console.error('[ServiceWorker] Fallo al cachear archivos durante la instalación:', error);
            })
    );
});

// Evento 'activate': se dispara después de que el SW se instala y un SW antiguo (si lo hay) es reemplazado.
// Aquí es donde limpiamos cachés antiguas.
self.addEventListener('activate', event => {
    console.log('[ServiceWorker] Activando...');
    event.waitUntil(
        caches.keys().then(cacheNames => {
            return Promise.all(
                cacheNames.map(cacheName => {
                    if (cacheName !== CACHE_NAME) { // Si el nombre de la caché no es el actual
                        console.log('[ServiceWorker] Borrando caché antigua:', cacheName);
                        return caches.delete(cacheName); // Bórrala
                    }
                })
            );
        }).then(() => {
            console.log('[ServiceWorker] Cachés antiguas limpiadas.');
            return self.clients.claim(); // Permite que el SW activo controle clientes no controlados inmediatamente
        })
    );
});

// Evento 'fetch': se dispara cada vez que la aplicación hace una petición de red (para cargar una página, CSS, JS, imagen, etc.).
// Aquí decidimos si servir desde la caché o desde la red.
self.addEventListener('fetch', event => {
    // console.log('[ServiceWorker] Fetch interceptado para:', event.request.url);
    event.respondWith( // El SW "responde" a la petición
        caches.match(event.request) // Busca la petición en la caché
            .then(response => {
                if (response) {
                    // console.log('[ServiceWorker] Sirviendo desde caché:', event.request.url);
                    return response; // Si está en caché, la sirve desde allí
                }
                // console.log('[ServiceWorker] No está en caché, yendo a la red:', event.request.url);
                return fetch(event.request) // Si no está en caché, va a la red
                    .then(networkResponse => {
                        // Opcional: Cachear la nueva respuesta para futuras peticiones offline
                        // Es importante clonar la respuesta porque es un "stream" y solo se puede consumir una vez.
                        if (networkResponse && networkResponse.status === 200 && event.request.method === 'GET') { // Solo cachear respuestas válidas y GET
                            // No cachearemos las fuentes de Google aquí de nuevo, ya están en el pre-cacheo.
                            // Podrías tener una lógica más compleja para decidir qué cachear dinámicamente.
                            // Por ejemplo, si no es una de las URLs de Google Fonts:
                            if (!event.request.url.startsWith('https://fonts.gstatic.com') && !event.request.url.startsWith('https://fonts.googleapis.com')) {
                                const responseToCache = networkResponse.clone();
                                caches.open(CACHE_NAME)
                                    .then(cache => {
                                        // console.log('[ServiceWorker] Cacheando nueva respuesta de red:', event.request.url);
                                        cache.put(event.request, responseToCache);
                                    });
                            }
                        }
                        return networkResponse;
                    })
                    .catch(error => {
                        console.error('[ServiceWorker] Error en fetch (red o caché):', error, event.request.url);
                        // Opcional: Podrías devolver una página de fallback offline aquí si la red falla
                        // return caches.match('offline.html');
                    });
            })
    );
});
