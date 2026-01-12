# Docker Services - VROOM + OSRM

Este directorio contiene la configuración para los servicios de optimización de rutas.

## Arquitectura

```
┌─────────────────┐     ┌─────────────────┐
│   Next.js App   │────▶│     VROOM       │
│   (Frontend)    │     │  (Optimization) │
└─────────────────┘     └────────┬────────┘
                                 │
                                 ▼
                        ┌─────────────────┐
                        │      OSRM       │
                        │    (Routing)    │
                        └─────────────────┘
```

## Servicios

| Servicio | Puerto | Descripción |
|----------|--------|-------------|
| **VROOM** | 5000 | Optimizador de rutas VRP |
| **OSRM** | 5001 | Motor de routing por carretera |

## Inicio Rápido

### 1. Preparar datos de OSRM (solo la primera vez)

OSRM necesita datos de OpenStreetMap procesados. Para México:

```powershell
# Windows
cd docker/osrm
.\setup.ps1
```

```bash
# Linux/Mac
cd docker/osrm
chmod +x setup.sh
./setup.sh
```

Esto descargará ~1GB de datos de México y los procesará (toma ~10-30 min).

### 2. Iniciar servicios

```bash
docker compose --profile routing up -d
```

### 3. Verificar que funcionan

```bash
# VROOM health
curl http://localhost:5000/health

# OSRM test route
curl "http://localhost:5001/route/v1/driving/-99.1332,19.4326;-99.1677,19.4270?overview=false"
```

## Variables de Entorno

Agregar a `.env`:

```env
VROOM_URL=http://localhost:5000
OSRM_URL=http://localhost:5001
VROOM_TIMEOUT=60000
OSRM_TIMEOUT=30000
```

## Modo Desarrollo (sin Docker)

Si VROOM/OSRM no están disponibles, el sistema usa automáticamente:

- **Haversine**: Para cálculo de distancias (línea recta)
- **Nearest Neighbor**: Algoritmo básico de optimización

Esto permite desarrollar sin Docker, pero las rutas no serán óptimas.

## Regiones Soportadas

Por defecto se usa México. Para otras regiones, modificar `setup.ps1`:

| Región | URL Geofabrik |
|--------|---------------|
| México | `north-america/mexico-latest.osm.pbf` |
| España | `europe/spain-latest.osm.pbf` |
| Colombia | `south-america/colombia-latest.osm.pbf` |
| Argentina | `south-america/argentina-latest.osm.pbf` |

## Recursos

- [VROOM API Docs](https://github.com/VROOM-Project/vroom/blob/master/docs/API.md)
- [OSRM API Docs](http://project-osrm.org/docs/v5.24.0/api/)
- [Geofabrik Downloads](https://download.geofabrik.de/)
