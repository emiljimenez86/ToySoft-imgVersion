# Sistema de Roles - ToySoft POS

## 🔐 Descripción

Se ha implementado un sistema de roles para controlar el acceso a las funcionalidades del sistema POS, permitiendo que los empleados no vean información sensible como los cierres administrativos.

## 👥 Tipos de Usuario

### 🔑 Administrador (PIN: 4321)
- **Acceso completo** a todas las funcionalidades
- Puede ver y realizar cierres administrativos
- Acceso al balance y reportes financieros
- Gestión completa del inventario
- Acceso a todo el historial de ventas

### 👤 Empleado (PIN: 1234)
- **Acceso limitado** a funcionalidades operativas
- Puede realizar ventas y gestionar mesas
- Acceso al inventario para consultas
- **NO puede ver** cierres administrativos
- **NO puede acceder** al balance financiero
- Historial de ventas sin información administrativa

## 🚀 Funcionalidades por Rol

### ✅ Funcionalidades Disponibles para Empleados
- Punto de Venta (POS)
- Gestión de mesas y pedidos
- Venta rápida
- Inventario (consulta)
- Historial de ventas (sin cierres administrativos)
- Historial de cocina
- Cierres operativos
- Gastos diarios
- Recordatorios

### ❌ Funcionalidades Restringidas para Empleados
- Cierres administrativos
- Balance financiero
- Pestaña "Cierres Administrativos" en el historial

## 🔧 Implementación Técnica

### Variables de Configuración
```javascript
let PIN_ADMIN = '4321'; // PIN de administrador
let PIN_EMPLEADO = '1234'; // PIN de empleado
let usuarioActual = null; // Tipo de usuario actual
```

### Control de Acceso
- El sistema verifica el PIN ingresado
- Asigna el rol correspondiente (`admin` o `empleado`)
- Controla la visibilidad de elementos según el rol
- Muestra mensajes de error para accesos no autorizados

### Archivos Modificados
- `app.js` - Lógica de verificación de PIN y roles
- `historial.html` - Ocultación de pestaña de cierres administrativos
- `POS.html` - Modal de PIN con información de roles

## 📱 Uso del Sistema

### Para Administradores
1. Ingresar PIN: `4321`
2. Acceso completo a todas las funcionalidades
3. Pueden ver cierres administrativos en el historial

### Para Empleados
1. Ingresar PIN: `1234`
2. Acceso limitado a funcionalidades operativas
3. La pestaña "Cierres Administrativos" se oculta automáticamente

## 🔒 Seguridad

- Los PINs están definidos en el código JavaScript
- Se pueden cambiar modificando las variables `PIN_ADMIN` y `PIN_EMPLEADO`
- El sistema mantiene el rol durante la sesión
- Los accesos no autorizados muestran mensajes de error

## 🛠️ Personalización

### Cambiar PINs
Para cambiar los PINs, modifica estas líneas en `app.js`:
```javascript
let PIN_ADMIN = '4321'; // Cambiar por el PIN deseado
let PIN_EMPLEADO = '1234'; // Cambiar por el PIN deseado
```

### Agregar Nuevos Roles
1. Definir nuevo PIN en las variables globales
2. Agregar lógica en `verificarPinAcceso()`
3. Implementar controles de acceso según el nuevo rol

## 📋 Notas Importantes

- Los empleados pueden realizar todas las operaciones de venta normalmente
- Solo se restringe el acceso a información administrativa sensible
- El sistema es retrocompatible con el PIN anterior (4321)
- La pestaña de cierres administrativos se oculta dinámicamente según el rol

---

**Desarrollado por Emil Jiménez Ortiz**  
*Sistema POS ToySoft - Versión con Control de Roles*
