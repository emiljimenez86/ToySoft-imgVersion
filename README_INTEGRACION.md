# Integración POS - Inventario

## Descripción General

La integración entre el sistema POS y el módulo de inventario permite una gestión automática del stock de productos, actualizando el inventario en tiempo real cuando se realizan ventas. Incluye visualización completa de productos del POS con indicadores de estado y funciones de gestión masiva.

## Funcionalidades Implementadas

### 1. Actualización Automática de Inventario
- **Cuándo se activa**: Al procesar una venta en el POS
- **Qué hace**: Reduce automáticamente el stock de los productos vendidos
- **Registro**: Crea un movimiento de "salida" con motivo "Venta automática"

### 2. Verificación de Disponibilidad
- **Cuándo se activa**: Al intentar agregar productos a una orden
- **Qué hace**: Verifica si hay stock suficiente antes de permitir la venta
- **Alertas**: Muestra notificaciones si el producto no está disponible

### 3. Alertas de Stock Bajo
- **Cuándo se activa**: Cuando el stock queda por debajo del mínimo configurado
- **Qué hace**: Muestra notificaciones visuales automáticas
- **Duración**: Las alertas se auto-eliminan después de 10 segundos

### 4. Sincronización de Productos
- **Función**: Agrega automáticamente productos del POS al inventario
- **Cuándo usar**: Cuando hay productos en el POS que no están en inventario
- **Configuración**: Los productos nuevos se crean con stock inicial de 0

### 5. Visualización de Productos del POS
- **Función**: Muestra todos los productos del POS con indicadores de estado
- **Indicadores**: 
  - 🟢 **Verde**: Productos que ya están en el inventario
  - 🟡 **Amarillo**: Productos que faltan en el inventario
- **Información**: Nombre, categoría, precio y estado de cada producto

### 6. Agregado Masivo de Productos
- **Función**: Permite agregar todos los productos faltantes del POS al inventario de una vez
- **Confirmación**: Solicita confirmación antes de agregar múltiples productos
- **Notificación**: Muestra el número de productos agregados

### 7. Filtros y Controles
- **Filtro "Solo faltantes"**: Muestra únicamente productos pendientes de agregar
- **Contador dinámico**: Muestra cuántos productos hay en total
- **Actualización automática**: Se actualiza cuando se modifican productos

### 8. Reportes de Movimientos
- **Función**: Seguimiento completo de entradas y salidas
- **Filtros**: Por fecha de inicio y fin
- **Exportación**: A Excel con formato profesional

## Cómo Funciona la Integración

### Flujo de Venta
1. Usuario selecciona productos en el POS
2. Sistema verifica disponibilidad en inventario
3. Si hay stock, permite agregar productos
4. Al procesar el pago, actualiza automáticamente el inventario
5. Registra el movimiento y verifica alertas de stock bajo

### Visualización de Productos del POS
1. Al cargar el inventario, se muestran automáticamente los productos del POS
2. Cada producto se muestra en una tarjeta con información detallada
3. Los indicadores visuales muestran el estado (en inventario/faltante)
4. Se pueden agregar productos individualmente o todos de una vez
5. El filtro permite ver solo productos pendientes

### Mapeo de Productos
- **Criterio**: Coincidencia exacta por nombre de producto
- **Importante**: Los nombres deben ser idénticos entre POS e inventario
- **Recomendación**: Usar la función de sincronización para mantener consistencia

## Configuración Recomendada

### 1. Configuración de Productos
```javascript
// Ejemplo de producto en inventario
{
  codigo: "PROD-1234567890-001",
  nombre: "Hamburguesa Clásica",
  categoria: "Platos Principales",
  stockActual: 50,
  stockMinimo: 10,
  stockMaximo: 100,
  unidadMedida: "unidad"
}
```

### 2. Configuración de Alertas
- **Stock Mínimo**: Configurar según la demanda diaria
- **Stock Máximo**: Configurar según el espacio de almacenamiento
- **Unidad de Medida**: Usar unidades consistentes

### 3. Mantenimiento Regular
- Revisar reportes de movimientos semanalmente
- Sincronizar productos nuevos del POS
- Ajustar stock mínimo según la demanda
- Usar el filtro "Solo faltantes" para identificar productos pendientes

## Funciones Principales

### En inventario.js
```javascript
// Actualizar inventario desde venta
actualizarInventarioDesdeVenta(itemsVenta)

// Verificar disponibilidad
verificarDisponibilidadProducto(nombreProducto, cantidadSolicitada)

// Sincronizar productos
sincronizarProductosPOS()

// Cargar productos del POS
cargarProductosPOS()

// Agregar producto individual
agregarProductoAInventario(nombre, categoria, precio)

// Agregar todos los productos faltantes
agregarTodosProductosFaltantes()

// Generar reportes
generarReporteMovimientos(fechaInicio, fechaFin)
```

### En app.js
```javascript
// Integración en procesarPago()
// Se ejecuta automáticamente al completar una venta

// Verificación en agregarProducto()
// Se ejecuta antes de agregar productos a la orden
```

## Interfaz de Usuario

### Sección de Productos del POS
- **Ubicación**: Entre los filtros y la tabla de inventario
- **Contenido**: Tarjetas con productos del POS
- **Controles**: 
  - Botón "Agregar Todos" para agregar productos faltantes
  - Checkbox "Solo faltantes" para filtrar
  - Botón "Refrescar Productos POS" para actualizar

### Indicadores Visuales
- **Tarjetas Verdes**: Productos en inventario ✅
- **Tarjetas Amarillas**: Productos faltantes ⚠️
- **Iconos**: Check circle (en inventario) / Exclamation triangle (faltante)

### Funciones de Gestión
- **Individual**: Agregar productos uno por uno
- **Masiva**: Agregar todos los productos faltantes de una vez
- **Filtrado**: Ver solo productos pendientes
- **Actualización**: Refrescar lista de productos del POS

## Manejo de Errores

### Productos No Encontrados
- Se registra un warning en la consola
- La venta continúa normalmente
- Se recomienda sincronizar productos

### Stock Insuficiente
- Se muestra alerta al usuario
- Se impide agregar más unidades
- Se recomienda revisar inventario

### Errores de Integración
- Se capturan y registran en consola
- No interrumpen el flujo de venta
- Se recomienda revisar la configuración

### Productos Duplicados
- Se valida antes de agregar al inventario
- Se muestra alerta si ya existe
- Se previene la duplicación automáticamente

## Beneficios de la Integración

1. **Control Automático**: No es necesario actualizar inventario manualmente
2. **Prevención de Errores**: Evita vender productos sin stock
3. **Alertas Proactivas**: Notifica cuando el stock está bajo
4. **Trazabilidad Completa**: Registra todos los movimientos
5. **Reportes Detallados**: Permite análisis de consumo y tendencias
6. **Visualización Clara**: Identifica fácilmente productos faltantes
7. **Gestión Eficiente**: Permite agregar productos masivamente
8. **Sincronización Automática**: Mantiene consistencia entre sistemas

## Consideraciones Importantes

1. **Nombres de Productos**: Deben coincidir exactamente entre POS e inventario
2. **Stock Inicial**: Configurar correctamente al crear productos
3. **Unidades de Medida**: Usar unidades consistentes
4. **Backup**: Hacer respaldos regulares de los datos
5. **Capacitación**: Entrenar al personal en el uso del sistema
6. **Revisión Regular**: Usar filtros para identificar productos pendientes
7. **Configuración de Stock**: Establecer mínimos y máximos apropiados

## Solución de Problemas

### Problema: Productos no se actualizan
**Solución**: Verificar que los nombres coincidan exactamente

### Problema: Alertas no aparecen
**Solución**: Verificar configuración de stock mínimo

### Problema: Errores en consola
**Solución**: Revisar que las funciones estén disponibles

### Problema: Sincronización falla
**Solución**: Verificar que haya productos en el POS

### Problema: Productos no aparecen en la vista
**Solución**: Usar el botón "Refrescar Productos POS"

### Problema: No se pueden agregar productos
**Solución**: Verificar que no existan duplicados

## Flujo de Trabajo Recomendado

1. **Configuración Inicial**:
   - Configurar productos en el POS
   - Sincronizar productos con el inventario
   - Configurar stock inicial y límites

2. **Operación Diaria**:
   - Revisar productos faltantes en el inventario
   - Agregar productos nuevos del POS
   - Monitorear alertas de stock bajo

3. **Mantenimiento Semanal**:
   - Revisar reportes de movimientos
   - Ajustar stock mínimo según demanda
   - Verificar consistencia de nombres

4. **Análisis Mensual**:
   - Exportar reportes de movimientos
   - Analizar tendencias de consumo
   - Optimizar configuración de stock

## Contacto y Soporte

Para dudas o problemas con la integración:
- Revisar la consola del navegador para errores
- Verificar la documentación de funciones
- Usar la función "Info Integración" en el inventario
- Contactar al desarrollador del sistema

---

**Desarrollado por**: Emil Jiménez Ortiz  
**Versión**: 2.0  
**Fecha**: 2024  
**Última actualización**: Visualización de productos del POS y gestión masiva 