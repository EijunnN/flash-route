# Sistema de Roles y Permisos

Este documento describe el sistema de autorización basado en roles y permisos del sistema de planificación de rutas.

## Arquitectura

```
Usuario
├── Rol Base (obligatorio)
│   └── Determina permisos predeterminados
│
└── Roles Personalizados (opcionales)
    └── Agregan permisos adicionales
```

El sistema utiliza un modelo **aditivo**: los permisos se suman. Un usuario tiene:
- Los permisos de su **rol base**
- Más los permisos de cualquier **rol personalizado** asignado

---

## Roles Base

Estos roles vienen predefinidos y determinan el tipo de usuario.

### ADMIN_SISTEMA
**Propósito**: Control total del sistema.

| Acceso | Descripción |
|--------|-------------|
| `*` (wildcard) | Acceso completo a todas las funciones |

**Casos de uso**:
- Configuración inicial del sistema
- Gestión de empresas (multi-tenant)
- Administración de usuarios y roles
- Soporte técnico

---

### ADMIN_FLOTA
**Propósito**: Gestión de recursos de transporte.

| Categoría | Permisos |
|-----------|----------|
| Vehículos | Ver, Crear, Editar, Eliminar, Asignar |
| Conductores | Ver, Crear, Editar, Eliminar, Gestionar estado |
| Flotas | Ver, Crear, Editar, Eliminar, Gestionar vehículos |
| Reportes | Ver reportes, Ver métricas |

**Casos de uso**:
- Registrar nuevos vehículos
- Dar de alta/baja conductores
- Organizar flotas
- Asignar vehículos a flotas

---

### PLANIFICADOR
**Propósito**: Optimización y planificación de rutas.

| Categoría | Permisos |
|-----------|----------|
| Pedidos | Ver, Crear, Editar, Importar, Exportar |
| Optimización | Ver, Crear, Configurar, Cancelar |
| Rutas | Ver, Asignar, Modificar, Confirmar, Cancelar |
| Reportes | Ver reportes, Ver métricas, Ver historial |

**Casos de uso**:
- Importar pedidos del día
- Ejecutar optimización de rutas
- Reasignar paradas entre rutas
- Confirmar planes de entrega

---

### MONITOR
**Propósito**: Seguimiento en tiempo real de operaciones.

| Categoría | Permisos |
|-----------|----------|
| Alertas | Ver, Gestionar (reconocer/descartar) |
| Pedidos | Ver |
| Rutas | Ver |
| Reportes | Ver reportes, Ver métricas |

**Casos de uso**:
- Monitorear entregas en curso
- Atender alertas del sistema
- Reportar incidencias
- Seguimiento de conductores

---

### CONDUCTOR
**Propósito**: Usuario de aplicación móvil.

| Categoría | Permisos |
|-----------|----------|
| Rutas | Ver (solo sus rutas asignadas) |
| Pedidos | Ver (solo sus entregas) |

**Casos de uso**:
- Ver ruta del día
- Marcar entregas completadas
- Reportar problemas

---

## Roles Personalizados

Estos roles se crean para necesidades específicas y se asignan **adicionalmente** al rol base.

### Jefe de Operaciones
**Propósito**: Supervisor que lidera el equipo de planificación.

**Asignar a**: Usuarios con rol base `PLANIFICADOR`

| Permiso | Descripción |
|---------|-------------|
| `alerts:CREATE` | Configurar reglas de alertas |
| `alerts:DELETE` | Eliminar reglas de alertas |
| `settings:VIEW` | Ver configuración del sistema |
| `settings:EDIT` | Modificar configuración |
| `presets:MANAGE` | Crear/editar presets de optimización |
| `zones:MANAGE` | Crear/editar zonas geográficas |
| `users:VIEW` | Ver usuarios del sistema |

**Resultado**: Un planificador con este rol puede además configurar el sistema.

---

### Analista
**Propósito**: Acceso de solo lectura para reportes y análisis.

**Asignar a**: Usuarios con cualquier rol base

| Permiso | Descripción |
|---------|-------------|
| `reports:VIEW` | Ver reportes |
| `reports:EXPORT` | Exportar reportes a PDF/CSV |
| `metrics:VIEW` | Ver métricas de rendimiento |
| `history:VIEW` | Ver historial de planificaciones |
| `orders:VIEW` | Ver pedidos |
| `routes:VIEW` | Ver rutas |
| `optimization:VIEW` | Ver trabajos de optimización |

**Resultado**: Acceso completo a información sin poder modificar nada.

---

### Operador Turno
**Propósito**: Monitor con capacidad de actuar en ausencia del planificador.

**Asignar a**: Usuarios con rol base `MONITOR`

| Permiso | Descripción |
|---------|-------------|
| `optimization:VIEW` | Ver trabajos de optimización |
| `optimization:CREATE` | Ejecutar nueva optimización |
| `routes:EDIT` | Reasignar paradas |
| `routes:ASSIGN` | Asignar rutas a conductores |

**Resultado**: Un monitor que puede replanificar si es necesario.

---

## Catálogo Completo de Permisos

### ORDERS (Pedidos)
| Código | Nombre | Descripción |
|--------|--------|-------------|
| `orders:VIEW` | Ver pedidos | Ver lista de pedidos y detalles |
| `orders:CREATE` | Crear pedidos | Crear nuevos pedidos |
| `orders:EDIT` | Editar pedidos | Modificar pedidos existentes |
| `orders:DELETE` | Eliminar pedidos | Eliminar pedidos |
| `orders:IMPORT` | Importar pedidos | Importar pedidos desde CSV |
| `orders:EXPORT` | Exportar pedidos | Exportar pedidos a CSV |

### VEHICLES (Vehículos)
| Código | Nombre | Descripción |
|--------|--------|-------------|
| `vehicles:VIEW` | Ver vehículos | Ver lista de vehículos y detalles |
| `vehicles:CREATE` | Crear vehículos | Registrar nuevos vehículos |
| `vehicles:EDIT` | Editar vehículos | Modificar vehículos existentes |
| `vehicles:DELETE` | Eliminar vehículos | Eliminar vehículos |
| `vehicles:ASSIGN` | Asignar vehículos | Asignar conductores a vehículos |

### DRIVERS (Conductores)
| Código | Nombre | Descripción |
|--------|--------|-------------|
| `drivers:VIEW` | Ver conductores | Ver lista de conductores y detalles |
| `drivers:CREATE` | Crear conductores | Registrar nuevos conductores |
| `drivers:EDIT` | Editar conductores | Modificar conductores existentes |
| `drivers:DELETE` | Eliminar conductores | Eliminar conductores |
| `drivers:MANAGE` | Gestionar estado | Cambiar estado de conductores |

### FLEETS (Flotas)
| Código | Nombre | Descripción |
|--------|--------|-------------|
| `fleets:VIEW` | Ver flotas | Ver lista de flotas |
| `fleets:CREATE` | Crear flotas | Crear nuevas flotas |
| `fleets:EDIT` | Editar flotas | Modificar flotas existentes |
| `fleets:DELETE` | Eliminar flotas | Eliminar flotas |
| `fleets:MANAGE` | Gestionar vehículos | Asignar vehículos a flotas |

### ROUTES (Rutas)
| Código | Nombre | Descripción |
|--------|--------|-------------|
| `routes:VIEW` | Ver rutas | Ver rutas planificadas |
| `routes:ASSIGN` | Asignar rutas | Asignar rutas a conductores |
| `routes:EDIT` | Modificar rutas | Reasignar paradas de rutas |
| `routes:CONFIRM` | Confirmar rutas | Confirmar planes de ruta |
| `routes:CANCEL` | Cancelar rutas | Cancelar rutas planificadas |

### OPTIMIZATION (Optimización)
| Código | Nombre | Descripción |
|--------|--------|-------------|
| `optimization:VIEW` | Ver optimización | Ver trabajos de optimización |
| `optimization:CREATE` | Crear optimización | Ejecutar optimización de rutas |
| `optimization:MANAGE` | Configurar optimización | Configurar parámetros de optimización |
| `optimization:CANCEL` | Cancelar optimización | Cancelar trabajos en progreso |

### ALERTS (Alertas)
| Código | Nombre | Descripción |
|--------|--------|-------------|
| `alerts:VIEW` | Ver alertas | Ver alertas del sistema |
| `alerts:MANAGE` | Gestionar alertas | Reconocer y descartar alertas |
| `alerts:CREATE` | Configurar reglas | Crear reglas de alertas |
| `alerts:DELETE` | Eliminar reglas | Eliminar reglas de alertas |

### USERS (Usuarios)
| Código | Nombre | Descripción |
|--------|--------|-------------|
| `users:VIEW` | Ver usuarios | Ver lista de usuarios |
| `users:CREATE` | Crear usuarios | Crear nuevos usuarios |
| `users:EDIT` | Editar usuarios | Modificar usuarios existentes |
| `users:DELETE` | Eliminar usuarios | Desactivar usuarios |
| `roles:VIEW` | Ver roles | Ver lista de roles |
| `roles:MANAGE` | Gestionar roles | Crear, editar y eliminar roles |

### SETTINGS (Configuración)
| Código | Nombre | Descripción |
|--------|--------|-------------|
| `settings:VIEW` | Ver configuración | Ver configuración del sistema |
| `settings:EDIT` | Editar configuración | Modificar configuración |
| `zones:VIEW` | Ver zonas | Ver zonas geográficas |
| `zones:MANAGE` | Gestionar zonas | Crear y editar zonas |
| `presets:VIEW` | Ver presets | Ver presets de optimización |
| `presets:MANAGE` | Gestionar presets | Crear y editar presets |

### REPORTS (Reportes)
| Código | Nombre | Descripción |
|--------|--------|-------------|
| `reports:VIEW` | Ver reportes | Ver reportes y métricas |
| `reports:EXPORT` | Exportar reportes | Exportar reportes a PDF/CSV |
| `metrics:VIEW` | Ver métricas | Ver métricas de rendimiento |
| `history:VIEW` | Ver historial | Ver historial de planificaciones |

---

## Ejemplos de Configuración

### Ejemplo 1: Planificador Senior
Un planificador que también puede configurar el sistema.

```
Rol Base: PLANIFICADOR
Roles Adicionales: Jefe de Operaciones
```

### Ejemplo 2: Monitor de Turno Noche
Un monitor que puede replanificar en emergencias.

```
Rol Base: MONITOR
Roles Adicionales: Operador Turno
```

### Ejemplo 3: Gerente de Operaciones
Necesita ver todo pero no ejecutar operaciones.

```
Rol Base: MONITOR (o cualquiera)
Roles Adicionales: Analista
```

### Ejemplo 4: Administrador de Flota con Alertas
Un admin de flota que también configura alertas de sus vehículos.

```
Rol Base: ADMIN_FLOTA
Roles Adicionales: (crear rol personalizado con alerts:CREATE, alerts:DELETE)
```

---

## Gestión de Roles

### Crear Rol Personalizado
1. Ir a `/roles`
2. Click en "Nuevo Rol"
3. Ingresar nombre y descripción
4. Seleccionar permisos con los switches
5. Guardar

### Asignar Rol a Usuario
1. Ir a `/users`
2. Editar usuario
3. En el panel derecho, activar los roles deseados con los switches
4. Guardar

### Ver Permisos de un Rol
1. Ir a `/users` → Crear/Editar usuario
2. Click en un rol del panel derecho
3. Se expande mostrando todos los permisos

---

## Multi-Tenancy

- Cada empresa tiene sus propios roles personalizados
- Los roles del sistema (`ADMIN_SISTEMA`, etc.) son compartidos
- Los permisos son globales pero los roles personalizados son por empresa
- Un `ADMIN_SISTEMA` puede ver usuarios de cualquier empresa
