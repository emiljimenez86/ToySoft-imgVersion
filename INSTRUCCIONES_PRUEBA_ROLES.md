# Instrucciones de Prueba - Sistema de Roles

## 🧪 Cómo Probar el Sistema de Roles

### Paso 1: Acceder al Sistema
1. Abrir `index.html` en el navegador
2. Ingresar cualquier usuario (ej: "admin")
3. Ingresar PIN: `4321` (administrador) o `1234` (empleado)

### Paso 2: Probar Acceso al Historial
1. Desde el POS, hacer clic en "Historial"
2. Se abrirá el modal de PIN
3. Ingresar el PIN correspondiente:
   - **4321** para administrador
   - **1234** para empleado

### Paso 3: Verificar Comportamiento

#### ✅ Con PIN de Administrador (4321):
- La pestaña "Cierres Administrativos" debe ser **VISIBLE**
- Se puede hacer clic en la pestaña
- Se muestran los cierres administrativos en la tabla

#### ❌ Con PIN de Empleado (1234):
- La pestaña "Cierres Administrativos" debe estar **OCULTA**
- No se puede ver ni acceder a los cierres administrativos
- Solo se ven las pestañas: Ventas, Cocina, Cierres Operativos

### Paso 4: Verificar en Consola del Navegador
Abrir las herramientas de desarrollador (F12) y verificar en la consola:

```
🔐 Acceso de Administrador autorizado
📄 Cargando historial.html...
🔍 Verificando rol después de cargar datos...
🔍 Verificando rol: admin
✅ Mostrando pestaña de cierres administrativos para administrador
```

O para empleado:
```
🔐 Acceso de Empleado autorizado
📄 Cargando historial.html...
🔍 Verificando rol después de cargar datos...
🔍 Verificando rol: empleado
❌ Ocultando pestaña de cierres administrativos para empleado
```

## 🔧 Solución de Problemas

### Si la pestaña no aparece para administradores:
1. Verificar que el PIN ingresado sea `4321`
2. Revisar la consola del navegador para errores
3. Verificar que `localStorage.getItem('usuarioActual')` retorne `'admin'`

### Si la pestaña aparece para empleados:
1. Verificar que el PIN ingresado sea `1234`
2. Revisar que la función `verificarRolUsuario()` se ejecute correctamente

## 📋 Datos de Prueba

### PINs de Acceso:
- **Administrador**: `4321`
- **Empleado**: `1234`

### Funcionalidades por Rol:

#### Administrador (4321):
- ✅ Punto de Venta
- ✅ Inventario
- ✅ Historial completo (incluyendo cierres administrativos)
- ✅ Balance
- ✅ Cierres administrativos

#### Empleado (1234):
- ✅ Punto de Venta
- ✅ Inventario (consulta)
- ✅ Historial limitado (sin cierres administrativos)
- ❌ Balance
- ❌ Cierres administrativos

## 🐛 Debugging

Si hay problemas, verificar:

1. **localStorage**: `localStorage.getItem('usuarioActual')`
2. **Consola**: Mensajes de error en la consola del navegador
3. **Elementos DOM**: Verificar que `tab-cierres-admin` existe
4. **Timing**: Los delays pueden necesitar ajuste según el dispositivo

---

**Nota**: El sistema guarda el rol en `localStorage` para mantener la sesión entre páginas.

