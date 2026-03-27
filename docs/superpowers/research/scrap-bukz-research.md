# Scrap Bukz — Investigación y Guía de Mejoras

Documento de referencia para mejorar el módulo de scraping de metadatos de libros de BukzBrain.
Fecha: 2026-03-27.

---

## 1. Análisis del Sistema Actual

### Arquitectura

```
backend/services/scrap/
  base.py          → BookResult, MergedBook, BookScraper (ABC)
  isbn.py          → Validación ISBN-10/13 con checksums
  runner.py        → Orquestación con ThreadPoolExecutor(10 workers)
  merger.py        → Merge por prioridad con estrategias por campo
  cache_store.py   → Cache JSON en disco
  scrapers/
    casadellibro.py  → API REST (Empathy.co search API)
    vtex.py          → Base para scrapers VTEX (intelligent-search)
    weblib.py        → Base para scrapers HTML (BeautifulSoup, búsqueda + detalle)
    lerner.py        → Extiende VtexScraper
    panamericana.py  → Extiende VtexScraper
    exlibris.py      → HTML scraper (dos fases)
    tornamesa.py     → Extiende WeblibScraper
```

### Flujo de datos

```
Excel/CSV con ISBNs
  → POST /api/scrap/enrich (validación + job_id)
  → Background: runner.run(isbns)
    → Cache check (skip ISBNs cacheados)
    → ThreadPoolExecutor: 5 scrapers × N ISBNs
    → merger.merge() por cada ISBN
    → Guardar en cache + generar Excel
  → GET /api/scrap/status/{id} (polling cada 2s)
  → GET /api/scrap/download/{id} (Excel enriquecido)
```

### Fuentes y prioridad de merge

| # | Fuente | Tipo | URL |
|---|--------|------|-----|
| 1 | Casa del Libro | API REST (Empathy.co) | api.empathy.co |
| 2 | Panamericana | VTEX API | panamericana.com.co |
| 3 | Lerner | VTEX API | librerialerner.com.co |
| 4 | Tornamesa | HTML (Weblib) | tornamesa.co |
| 5 | Ex Libris | HTML (BeautifulSoup) | exlibris.com.co |

### 10 campos de metadatos

titulo, autor, editorial, anio, descripcion, categoria, portada_url, paginas, idioma, encuadernacion

### Estrategias de merge por campo

| Campo | Estrategia |
|-------|-----------|
| titulo | Longest string, normalizado a title case |
| autor | Prefer formato estructurado (contiene "," o " de "), luego longest |
| editorial | Primer no-nulo por prioridad |
| anio | Primer válido (1900 ≤ año ≤ actual+1) |
| descripcion | Longest non-empty string |
| categoria | Primer no-nulo por prioridad |
| portada_url | Primer no-nulo por prioridad |
| paginas | Mediana de valores válidos (1-5000) |
| idioma | Primer no-nulo por prioridad |
| encuadernacion | Primer no-nulo por prioridad |

### Fortalezas

- ABC limpio (BookScraper) — agregar fuentes es sencillo
- Herencia reduce duplicación (VtexScraper, WeblibScraper cubren 4 de 5 fuentes)
- Merge inteligente por campo (no naive priority-only)
- ISBN-10/13 con checksum real
- Progreso en tiempo real vía callback + polling
- Cache evita re-scraping

### Debilidades identificadas

- **Sin retry**: cada scraper tiene un solo intento; un timeout = dato perdido
- **Sin manejo de 429**: no detecta rate limiting ni hace backoff
- **Sin proxies**: todas las requests desde la misma IP del servidor
- **Timeout fijo**: 10s hardcoded en base class, no configurable por scraper
- **Un solo User-Agent**: `"Mozilla/5.0"` estático
- **Cache sin TTL**: entradas nunca expiran, datos obsoletos persisten
- **Cache I/O excesivo**: reescribe JSON completo por cada entrada
- **Threads vs async**: ThreadPoolExecutor funciona pero no escala tan bien como asyncio
- **Selectores frágiles**: CSS selectors en HTML scrapers se rompen con rediseños
- **Sin monitoreo**: no hay logging estructurado ni métricas de éxito/fallo
- **Sin categorización de errores**: todo es `str(e)` genérico

---

## 2. Best Practices para Scraping de Metadatos de Libros

### Preferir APIs sobre scraping HTML

Las APIs son más estables, rápidas y menos propensas a bloqueo:
- **VTEX Intelligent Search**: ya usado para Panamericana y Lerner — patrón reutilizable
- **Empathy.co**: ya usado para Casa del Libro
- **Google Books API**: gratis, 1000 req/día, excelente cobertura
- **Open Library API**: gratis, sin API key, buena cobertura internacional

### ISBN como clave universal

- Siempre buscar por ISBN-13 (convertir ISBN-10 a 13 si es necesario)
- El ISBN ya se normaliza y valida con checksum — buena práctica actual

### ONIX (ONline Information eXchange)

Estándar de la industria editorial para intercambio de metadatos. Si alguna fuente ofrece datos ONIX, tienen la mayor calidad posible. Campos ONIX mapean directamente a los 10 campos del módulo.

### Normalización de autores

Formatos comunes: "Apellido, Nombre", "Nombre Apellido", "Nombre de Apellido"
- Estandarizar a un formato consistente
- Detectar "Varios Autores" vs autores individuales
- Manejar caracteres especiales (tildes, ñ)

### Normalización de editoriales

Variantes: "Planeta", "Editorial Planeta", "PLANETA", "Grupo Planeta"
- Mantener tabla de normalización de editoriales conocidas
- Mapear variantes al nombre canónico

### Codificación de idioma

Normalizar a ISO 639-1: "Español" → "es", "Spanish" → "es", "Inglés" → "en"

---

## 3. Anti-detección y Rate Limiting

### Rotación de User-Agent

Mantener pool de 10-20 User-Agents reales de navegadores actuales:

```python
USER_AGENTS = [
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/120.0.0.0",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0",
    # ... más variantes
]
```

Rotar por request, no por sesión completa.

### Headers realistas

Agregar headers que un navegador real enviaría:

```python
headers = {
    "User-Agent": random.choice(USER_AGENTS),
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "es-CO,es;q=0.9,en;q=0.8",
    "Accept-Encoding": "gzip, deflate, br",
    "DNT": "1",
    "Connection": "keep-alive",
}
```

### Delays aleatorios

Reemplazar delay fijo de 0.3s con rango aleatorio:

```python
delay = random.uniform(0.5, 1.5)  # entre 0.5 y 1.5 segundos
```

Variar por dominio: APIs pueden tolerar más velocidad, HTML scrapers necesitan más pausa.

### Manejo de HTTP 429

```python
if response.status_code == 429:
    retry_after = int(response.headers.get("Retry-After", 30))
    time.sleep(retry_after)
    # reintentar
```

### Rate limiting por dominio

Limitar requests por dominio (ej: máx 1 request/segundo por dominio):

```python
class DomainRateLimiter:
    def __init__(self, min_interval: float = 1.0):
        self.last_request: dict[str, float] = {}
        self.min_interval = min_interval

    def wait(self, domain: str):
        now = time.time()
        last = self.last_request.get(domain, 0)
        wait_time = max(0, self.min_interval - (now - last))
        if wait_time > 0:
            time.sleep(wait_time)
        self.last_request[domain] = time.time()
```

### Proxies (para volúmenes altos)

No necesario para el volumen actual (~cientos de ISBNs), pero documentar para futuro:
- Proxies residenciales rotativos para alto volumen
- Servicios como ScrapingBee, Bright Data, o proxies SOCKS5
- Implementación: pasar dict `proxies` a `requests.get()`

### Recomendaciones por fuente actual

| Fuente | Riesgo de bloqueo | Recomendación |
|--------|-------------------|---------------|
| Casa del Libro (API) | Medio | Agregar manejo 429, respetar rate limits |
| Panamericana (VTEX) | Bajo-Medio | VTEX tiene rate limiting built-in, respetar |
| Lerner (VTEX) | Bajo-Medio | Igual que Panamericana |
| Tornamesa (HTML) | Alto | Priorizar stealth: UA rotation + delays largos |
| Ex Libris (HTML) | Alto | Igual que Tornamesa |

---

## 4. Patrones de Resiliencia

### Retry con backoff exponencial

```python
import time
import random

class RetryConfig:
    max_retries: int = 3
    base_delay: float = 1.0
    backoff_factor: float = 2.0
    retryable_status_codes: set = {429, 500, 502, 503}

def fetch_with_retry(url, headers, timeout, config=RetryConfig()):
    for attempt in range(config.max_retries + 1):
        try:
            resp = requests.get(url, headers=headers, timeout=timeout)
            if resp.status_code in config.retryable_status_codes:
                if attempt == config.max_retries:
                    return resp
                delay = config.base_delay * (config.backoff_factor ** attempt)
                delay += random.uniform(0, delay * 0.1)  # jitter
                time.sleep(delay)
                continue
            return resp
        except requests.exceptions.RequestException:
            if attempt == config.max_retries:
                raise
            time.sleep(config.base_delay * (config.backoff_factor ** attempt))
```

### Circuit breaker

Si un scraper falla N veces consecutivas, dejar de intentar por M minutos:

```python
class CircuitBreaker:
    def __init__(self, failure_threshold=5, recovery_timeout=300):
        self.failures = 0
        self.failure_threshold = failure_threshold
        self.recovery_timeout = recovery_timeout  # segundos
        self.last_failure_time = None
        self.state = "closed"  # closed, open, half-open

    def can_execute(self) -> bool:
        if self.state == "closed":
            return True
        if self.state == "open":
            if time.time() - self.last_failure_time > self.recovery_timeout:
                self.state = "half-open"
                return True
            return False
        return True  # half-open: permitir un intento

    def record_success(self):
        self.failures = 0
        self.state = "closed"

    def record_failure(self):
        self.failures += 1
        self.last_failure_time = time.time()
        if self.failures >= self.failure_threshold:
            self.state = "open"
```

### Categorización de errores

Distinguir tipos de fallo para tomar decisiones informadas:

```python
class ScrapError(Enum):
    NOT_FOUND = "not_found"        # ISBN no existe en el sitio
    NETWORK_ERROR = "network"      # Timeout, connection refused
    BLOCKED = "blocked"            # 429, 403
    PARSE_ERROR = "parse"          # Sitio cambió estructura
    UNKNOWN = "unknown"
```

### Partial results en scrapers de dos fases

Si el detail page falla en exlibris/tornamesa, devolver datos del search page en vez de nada.

### Dead letter queue

ISBNs que fallan en todas las fuentes → guardar en lista separada para reintento posterior.

---

## 5. Optimización de Rendimiento

### async/await vs ThreadPoolExecutor

**Estado actual**: ThreadPoolExecutor con 10 workers. Funciona bien pero:
- Cada thread consume memoria (~8MB stack)
- 10 workers = máximo 10 conexiones simultáneas
- Para 100 ISBNs × 5 scrapers = 500 requests, procesadas en lotes de 10

**Migración a aiohttp + asyncio**:
- Miles de conexiones concurrentes con bajo overhead
- Mejor utilización de I/O wait
- Path de migración: `requests` → `aiohttp`, `ThreadPoolExecutor` → `asyncio.gather()`

**Recomendación**: Mantener threads por ahora (funcional, simple). Migrar a async solo si el volumen crece significativamente (>1000 ISBNs por batch).

### Connection pooling

Usar `requests.Session()` por scraper para reutilizar conexiones TCP:

```python
class BookScraper(ABC):
    def __init__(self):
        self.session = requests.Session()
        self.session.headers.update({"User-Agent": random.choice(USER_AGENTS)})
```

Esto evita el overhead de TCP handshake + TLS negotiation por cada request.

### Scraping selectivo

Si un ISBN se encuentra con alta confianza (≥8 campos) en la fuente de mayor prioridad, saltar fuentes de menor prioridad:

```python
# En runner.py, después de obtener resultado de fuente prioritaria
if result.found and count_fields(result) >= 8:
    skip_lower_priority_sources()
```

### Cache write batching

Acumular resultados en memoria y escribir al disco cada N entradas en vez de cada una:

```python
BATCH_SIZE = 10
buffer = []
for isbn, result in results:
    buffer.append((isbn, result))
    if len(buffer) >= BATCH_SIZE:
        cache_store.write_batch(buffer)
        buffer.clear()
```

### Compresión de respuestas

Agregar `Accept-Encoding: gzip` reduce ancho de banda significativamente para responses HTML.

---

## 6. Estrategias de Cache

### Estado actual

- Almacenamiento: JSON file (`cache_data/isbn_cache.json`)
- Sin TTL: entradas nunca expiran
- Limpieza: todo-o-nada con `cache/clear`
- I/O: reescribe archivo completo por cada entrada
- No es seguro para escrituras concurrentes

### TTL por entrada

Metadatos de libros son relativamente estables:
- **Libros encontrados**: TTL de 30 días (metadata rara vez cambia)
- **No encontrados**: TTL de 7 días (el libro podría aparecer en catálogo)

```python
def is_expired(entry: dict) -> bool:
    cached_at = datetime.fromisoformat(entry.get("cached_at", "2000-01-01"))
    ttl_days = 30 if entry.get("found") else 7
    return datetime.now() - cached_at > timedelta(days=ttl_days)
```

### Migración a SQLite

**Beneficios sobre JSON**:
- Lecturas/escrituras atómicas sin reescribir todo el archivo
- Soporte nativo para TTL con queries
- Concurrencia segura con WAL mode
- Índice por ISBN para lookup O(1)
- Cero dependencias adicionales (SQLite viene con Python)

```sql
CREATE TABLE isbn_cache (
    isbn TEXT PRIMARY KEY,
    data JSON NOT NULL,
    found BOOLEAN,
    cached_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP
);

-- Lookup con TTL
SELECT data FROM isbn_cache WHERE isbn = ? AND expires_at > CURRENT_TIMESTAMP;
```

**Recomendación**: SQLite es la mejora de cache con mayor impacto y menor esfuerzo.

### Cache warming

Pre-popular cache con ISBNs del catálogo conocido durante horas de bajo tráfico.

### Force refresh

Flag `force_refresh=true` en el endpoint para ignorar cache y re-scrapear:

```
POST /api/scrap/enrich?delay=0.3&force_refresh=true
```

---

## 7. Resiliencia de Selectores

### Problema

Los HTML scrapers (exlibris, tornamesa/weblib) usan selectores CSS como `.content li.item`, `dd.title a`, `dd.creator` que se rompen cuando el sitio rediseña.

### Múltiples selectores fallback

```python
TITLE_SELECTORS = [
    "dd.title a",           # Selector primario actual
    "h1.product-name",      # Alternativa común
    ".product-title",       # Otra variante
    "h1",                   # Fallback genérico
]

def extract_title(soup):
    for selector in TITLE_SELECTORS:
        elem = soup.select_one(selector)
        if elem and elem.get_text(strip=True):
            return elem.get_text(strip=True)
    return None
```

### JSON-LD / Schema.org

Muchos sitios de e-commerce incluyen datos estructurados para SEO. Extraer antes de recurrir a CSS selectors:

```python
import json

def extract_jsonld(soup):
    scripts = soup.find_all("script", type="application/ld+json")
    for script in scripts:
        try:
            data = json.loads(script.string)
            if data.get("@type") in ("Book", "Product"):
                return {
                    "titulo": data.get("name"),
                    "autor": data.get("author", {}).get("name"),
                    "descripcion": data.get("description"),
                    "portada_url": data.get("image"),
                    "isbn": data.get("isbn"),
                    "editorial": data.get("publisher", {}).get("name"),
                }
        except json.JSONDecodeError:
            continue
    return None
```

### Meta tags OpenGraph

Fallback de emergencia:

```python
def extract_og_tags(soup):
    return {
        "titulo": soup.find("meta", property="og:title"),
        "descripcion": soup.find("meta", property="og:description"),
        "portada_url": soup.find("meta", property="og:image"),
    }
```

### Estrategia de extracción en capas

1. JSON-LD / Schema.org (más estable)
2. Selectores CSS primarios (actuales)
3. Selectores CSS fallback
4. Meta tags OG (emergencia)

### Test fixtures

Guardar samples de HTML de cada sitio para detectar cambios:

```
backend/services/scrap/tests/fixtures/
  casadellibro_response.json
  panamericana_response.json
  tornamesa_search.html
  tornamesa_detail.html
  exlibris_search.html
  exlibris_detail.html
```

Comparar periódicamente con respuestas reales para detectar cambios de estructura.

---

## 8. Nuevas Fuentes Potenciales

### APIs gratuitas de metadatos (sin scraping)

| Fuente | Tipo | Límite | Cobertura | Prioridad |
|--------|------|--------|-----------|-----------|
| **Google Books API** | REST API | 1000 req/día gratis | Excelente, global | **ALTA** |
| **Open Library API** | REST API | Sin límite formal | Buena, global | MEDIA |
| **WorldCat Search** | REST API | Requiere key | Excelente | BAJA |
| **ISBNdb** | REST API | Pagado ($10/mes) | Muy alta | BAJA |

**Google Books API** es la adición de mayor valor:
- Gratis hasta 1000 requests/día
- No requiere scraping (API oficial)
- Excelente cobertura de libros en español
- Endpoint: `https://www.googleapis.com/books/v1/volumes?q=isbn:{isbn}`
- Devuelve: title, authors, publisher, publishedDate, description, categories, imageLinks, pageCount, language

**Open Library API**:
- Endpoint: `https://openlibrary.org/api/books?bibkeys=ISBN:{isbn}&format=json&jc=data`
- Sin autenticación
- Cobertura decente, especialmente para ediciones internacionales

### Librerías colombianas adicionales

| Sitio | Plataforma probable | Cobertura | Dificultad |
|-------|---------------------|-----------|------------|
| **Librería Nacional** (librerianacional.com) | Custom/VTEX | Mayor cadena Colombia | MEDIA |
| **Buscalibre** (buscalibre.com.co) | Custom | Pan-latinoamericano | MEDIA |
| **Librería de la U** (libreriadelau.com) | Custom | Académicos Colombia | ALTA |
| **Amazon.com.co** | Amazon API | Global | ALTA (requiere API key) |
| **Siglo del Hombre** (siglodelhombre.com) | Pequeño | Ciencias sociales | BAJA |
| **FCE Colombia** (fce.com.co) | Institucional | Literatura mexicana | BAJA |

### Recomendación de prioridad para agregar

1. **Google Books API** — máximo impacto, cero scraping, API oficial
2. **Open Library** — complemento gratis, buena cobertura internacional
3. **Librería Nacional** — mayor cadena colombiana, llena gaps locales
4. **Buscalibre** — cobertura pan-latinoamericana

---

## 9. Calidad de Datos

### Validación por campo

| Campo | Reglas de validación |
|-------|---------------------|
| titulo | No vacío, no es solo ISBN, 3-500 caracteres, no contiene HTML |
| autor | No "N/A", no es nombre de editorial, no "Sin autor" |
| editorial | No vacío, no "N/A" |
| anio | 1900 ≤ año ≤ actual+1 (ya implementado) |
| descripcion | >50 chars para ser útil, strip HTML tags |
| categoria | No vacío, no demasiado genérica ("Libros") |
| portada_url | URL válida, no es placeholder/default image |
| paginas | 1 ≤ páginas < 5000 (ya implementado) |
| idioma | Valor reconocible, normalizar a ISO 639-1 |
| encuadernacion | Valores conocidos: tapa dura, tapa blanda, rústica, etc. |

### Normalización

**Títulos**: Manejar ALLCAPS, preservar acrónimos, limpiar whitespace extra.

**Autores**: Tabla de normalización para formatos comunes:
- "GARCIA MARQUEZ, GABRIEL" → "García Márquez, Gabriel"
- "gabriel garcia marquez" → "García Márquez, Gabriel"

**Editoriales**: Mapear variantes conocidas:
- "PLANETA" = "Editorial Planeta" = "Grupo Planeta" → "Planeta"
- "PENGUIN RANDOM HOUSE" = "PRH" → "Penguin Random House"

### Confidence scoring

Asignar puntuación de confianza basada en:
- Número de fuentes que encontraron el ISBN
- Consistencia entre fuentes (mismo título/autor = mayor confianza)
- Campos completados

```python
def calculate_confidence(merged: MergedBook, source_results: list[BookResult]) -> float:
    sources_found = sum(1 for r in source_results if r.found)
    field_completeness = merged.campos_encontrados / 10
    # Normalizar a 0-1
    return (sources_found / len(source_results) * 0.5) + (field_completeness * 0.5)
```

### Detección de datos sospechosos

- Título = ISBN (algunos sitios muestran el ISBN como título cuando no tienen el libro)
- Descripción muy corta (<20 chars) probablemente es un fragmento incompleto
- Año futuro (>actual+1) es probablemente un error de parsing
- Páginas = 0 o = 1 generalmente indica error

---

## 10. Monitoreo y Alertas

### Métricas por scraper

```python
@dataclass
class ScraperMetrics:
    source: str
    total_attempts: int = 0
    found: int = 0
    not_found: int = 0
    errors: int = 0
    avg_response_time: float = 0.0
    fields_avg: float = 0.0       # Promedio de campos encontrados
    last_success: datetime = None
    last_error: str = None
    error_types: dict[str, int] = field(default_factory=dict)
```

### Detección de scrapers rotos

Regla: si un scraper tiene success rate < 10% en las últimas 50 requests, probablemente está roto (sitio cambió estructura o está bloqueando).

```python
def is_scraper_healthy(metrics: ScraperMetrics) -> bool:
    if metrics.total_attempts < 10:
        return True  # No hay suficientes datos
    success_rate = metrics.found / metrics.total_attempts
    return success_rate >= 0.1
```

### Endpoint de métricas

```
GET /api/scrap/metrics
→ {
    "scrapers": {
      "casadellibro": {"success_rate": 0.85, "avg_time": 1.2, ...},
      "panamericana": {"success_rate": 0.72, "avg_time": 0.8, ...},
      ...
    },
    "unhealthy": ["tornamesa"]
  }
```

### Logging estructurado

Reemplazar `print()` con logging real:

```python
import logging
logger = logging.getLogger("scrap")

logger.info("scrape_result", extra={
    "source": "panamericana",
    "isbn": "9789585581741",
    "found": True,
    "fields": 8,
    "duration_ms": 1200,
})
```

### Dashboard frontend

Panel de salud de scrapers en la UI con:
- Barra de éxito por fuente (verde/amarillo/rojo)
- Tiempo promedio de respuesta
- Alertas de scrapers posiblemente rotos

---

## 11. Consideraciones Legales y Éticas

### robots.txt

Verificar y respetar robots.txt de cada sitio. Las APIs (VTEX, Empathy.co) generalmente no tienen restricciones por robots.txt ya que son endpoints de búsqueda pública.

### Rate courtesy

- Nunca exceder 1 request/segundo por dominio
- El delay actual de 0.3s se aplica entre ISBNs, pero los 5 scrapers golpean simultáneamente cada ISBN → cada dominio recibe ~1 req por ISBN processing cycle
- Agregar rate limiting explícito por dominio

### Uso de datos

- Los metadatos son para enriquecimiento interno del catálogo, no para redistribución
- Las descripciones de libros pueden tener copyright — usar para referencia interna
- Las URLs de portadas son para display, no para descargar y re-hostear

### Cover images

- Actualmente se guardan como URLs (hotlinking)
- Si se necesita almacenar: considerar implicaciones de copyright
- Alternativa: usar APIs oficiales (Google Books provee thumbnails con licencia)

### Preferir APIs oficiales

Usar APIs públicas de búsqueda (VTEX, Google Books, Open Library) es más aceptable legalmente que scraping HTML. Priorizar migración a APIs donde sea posible.

---

## 12. Roadmap de Mejoras Priorizado

### Quick Wins (1-2 horas cada uno)

| # | Mejora | Impacto | Archivos |
|---|--------|---------|----------|
| 1 | `requests.Session()` por scraper | Conexiones más rápidas | base.py + todos los scrapers |
| 2 | Pool de User-Agents rotativos | Menor riesgo de bloqueo | base.py |
| 3 | Headers HTTP realistas | Menor riesgo de bloqueo | base.py |
| 4 | Delays aleatorios (rango) | Menor riesgo de bloqueo | runner.py |
| 5 | Logging estructurado | Visibilidad de errores | Todos |

### Esfuerzo Medio (medio día cada uno)

| # | Mejora | Impacto | Archivos |
|---|--------|---------|----------|
| 6 | Retry con backoff exponencial | Resilencia ante errores transitorios | base.py o decorador |
| 7 | Manejo de HTTP 429 | Evita bloqueos por rate limit | base.py |
| 8 | Categorización de errores | Diagnóstico más rápido | base.py, runner.py |
| 9 | Cache con TTL (SQLite) | Datos frescos, mejor I/O | cache_store.py |
| 10 | Métricas por scraper | Detección de scrapers rotos | runner.py, nuevo endpoint |

### Esfuerzo Mayor (1-2 días cada uno)

| # | Mejora | Impacto | Archivos |
|---|--------|---------|----------|
| 11 | Google Books API como fuente | Mayor cobertura, API oficial | Nuevo scraper + runner + merger |
| 12 | Circuit breaker | No pierde tiempo en fuentes caídas | base.py o runner.py |
| 13 | JSON-LD/Schema.org extraction | Selectores más estables | weblib.py, exlibris.py |
| 14 | Migración a aiohttp + asyncio | Mejor rendimiento a escala | Todos los scrapers + runner |
| 15 | Dashboard de salud de scrapers | Visibilidad para el equipo | Frontend nuevo componente |
