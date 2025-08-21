# 📧 Configuración de EmailJS para ToySoft IMG Version

## 🎯 Descripción

Este documento explica cómo configurar EmailJS para enviar automáticamente los cierres operativos y administrativos por email.

## ✅ Funcionalidades Implementadas

- **Envío Automático**: Los cierres se envían automáticamente al completarse
- **Configuración desde Admon**: El cliente puede configurar el email de destino
- **Templates Personalizados**: Emails con formato profesional
- **Historial de Envíos**: Log de todos los emails enviados
- **Pruebas**: Función para probar el envío de emails

## 🚀 Configuración de EmailJS

### 1. Crear Cuenta en EmailJS

1. Ve a [EmailJS.com](https://www.emailjs.com/)
2. Crea una cuenta gratuita
3. Verifica tu email

### 2. Configurar Servicio de Email

1. En el dashboard de EmailJS, ve a **Email Services**
2. Haz clic en **Add New Service**
3. Selecciona tu proveedor de email (Gmail, Outlook, etc.)
4. Conecta tu cuenta de email
5. Anota el **Service ID** (ej: `service_abc123`)

### 3. Crear Templates de Email

#### Template para Cierre Operativo:
1. Ve a **Email Templates**
2. Crea un nuevo template llamado `template_cierre_operativo`
3. Usa este HTML como base:

```html
<!DOCTYPE html>
<html>
<head>
    <title>Cierre Operativo - ToySoft IMG Version</title>
</head>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
    <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
        <h2 style="color: #2c3e50; border-bottom: 3px solid #3498db; padding-bottom: 10px;">
            📋 Cierre Operativo - ToySoft IMG Version
        </h2>
        
        <div style="background-color: #f8f9fa; padding: 15px; border-radius: 5px; margin: 20px 0;">
            <h3 style="color: #2c3e50; margin-top: 0;">Información del Empleado</h3>
            <p><strong>Nombre:</strong> {{empleado_nombre}}</p>
            <p><strong>Cargo:</strong> {{empleado_cargo}}</p>
            <p><strong>Horario:</strong> {{horario}}</p>
        </div>

        <div style="background-color: #e8f5e8; padding: 15px; border-radius: 5px; margin: 20px 0;">
            <h3 style="color: #27ae60; margin-top: 0;">✅ Checklist Completado</h3>
            <p><strong>Tareas completadas:</strong> {{checklist_completado}} de {{checklist_total}}</p>
        </div>

        <div style="background-color: #fff3cd; padding: 15px; border-radius: 5px; margin: 20px 0;">
            <h3 style="color: #856404; margin-top: 0;">💰 Totales de Ventas</h3>
            <p><strong>Total General:</strong> {{totales}}</p>
        </div>

        <div style="background-color: #d1ecf1; padding: 15px; border-radius: 5px; margin: 20px 0;">
            <h3 style="color: #0c5460; margin-top: 0;">🤝 Entrega de Turno</h3>
            <p><strong>Recibe el turno:</strong> {{entrega_turno}}</p>
            <p><strong>Base de caja que deja:</strong> {{base_caja}}</p>
        </div>

        <div style="background-color: #f8f9fa; padding: 15px; border-radius: 5px; margin: 20px 0;">
            <h3 style="color: #2c3e50; margin-top: 0;">📝 Observaciones</h3>
            <p>{{observaciones}}</p>
        </div>

        <div style="background-color: #f8d7da; padding: 15px; border-radius: 5px; margin: 20px 0;">
            <h3 style="color: #721c24; margin-top: 0;">⚠️ Tareas Pendientes</h3>
            <p>{{tareas_pendientes}}</p>
        </div>

        <div style="text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #ddd;">
            <p style="color: #666; font-size: 12px;">
                <strong>ToySoft IMG Version</strong><br>
                Sistema de Punto de Venta<br>
                Fecha: {{fecha}}
            </p>
        </div>
    </div>
</body>
</html>
```

#### Template para Cierre Administrativo:
1. Crea otro template llamado `template_cierre_administrativo`
2. Usa este HTML como base:

```html
<!DOCTYPE html>
<html>
<head>
    <title>Cierre Administrativo - ToySoft IMG Version</title>
</head>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
    <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
        <h2 style="color: #2c3e50; border-bottom: 3px solid #e74c3c; padding-bottom: 10px;">
            💼 Cierre Administrativo - ToySoft IMG Version
        </h2>
        
        <div style="background-color: #f8f9fa; padding: 15px; border-radius: 5px; margin: 20px 0;">
            <h3 style="color: #2c3e50; margin-top: 0;">📅 Información del Cierre</h3>
            <p><strong>Fecha:</strong> {{fecha}}</p>
            <p><strong>Quien cierra:</strong> {{nombre_cierre}}</p>
            <p><strong>Quien recibe:</strong> {{nombre_recibe}}</p>
        </div>

        <div style="background-color: #d4edda; padding: 15px; border-radius: 5px; margin: 20px 0;">
            <h3 style="color: #155724; margin-top: 0;">💰 Resumen Financiero</h3>
            <table style="width: 100%; border-collapse: collapse;">
                <tr>
                    <td style="padding: 8px; border-bottom: 1px solid #ddd;"><strong>Total Ventas:</strong></td>
                    <td style="padding: 8px; border-bottom: 1px solid #ddd; text-align: right;">{{total_ventas}}</td>
                </tr>
                <tr>
                    <td style="padding: 8px; border-bottom: 1px solid #ddd;"><strong>Efectivo:</strong></td>
                    <td style="padding: 8px; border-bottom: 1px solid #ddd; text-align: right;">{{efectivo}}</td>
                </tr>
                <tr>
                    <td style="padding: 8px; border-bottom: 1px solid #ddd;"><strong>Transferencia:</strong></td>
                    <td style="padding: 8px; border-bottom: 1px solid #ddd; text-align: right;">{{transferencia}}</td>
                </tr>
                <tr>
                    <td style="padding: 8px; border-bottom: 1px solid #ddd;"><strong>Tarjeta:</strong></td>
                    <td style="padding: 8px; border-bottom: 1px solid #ddd; text-align: right;">{{tarjeta}}</td>
                </tr>
                <tr>
                    <td style="padding: 8px; border-bottom: 1px solid #ddd;"><strong>Gastos:</strong></td>
                    <td style="padding: 8px; border-bottom: 1px solid #ddd; text-align: right;">{{gastos}}</td>
                </tr>
                <tr style="background-color: #e8f5e8;">
                    <td style="padding: 8px; border-bottom: 1px solid #ddd;"><strong>Balance Final:</strong></td>
                    <td style="padding: 8px; border-bottom: 1px solid #ddd; text-align: right; font-weight: bold;">{{balance}}</td>
                </tr>
            </table>
        </div>

        <div style="background-color: #fff3cd; padding: 15px; border-radius: 5px; margin: 20px 0;">
            <h3 style="color: #856404; margin-top: 0;">🏦 Base de Caja</h3>
            <p><strong>Monto base que deja:</strong> {{base_caja}}</p>
        </div>

        <div style="background-color: #f8f9fa; padding: 15px; border-radius: 5px; margin: 20px 0;">
            <h3 style="color: #2c3e50; margin-top: 0;">📝 Detalles Adicionales</h3>
            <p>{{detalles}}</p>
        </div>

        <div style="text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #ddd;">
            <p style="color: #666; font-size: 12px;">
                <strong>ToySoft IMG Version</strong><br>
                Sistema de Punto de Venta<br>
                Fecha: {{fecha}}
            </p>
        </div>
    </div>
</body>
</html>
```

### 4. Obtener IDs de EmailJS

1. **User ID**: En tu dashboard de EmailJS, ve a **Account** → **API Keys**
2. **Service ID**: Del paso 2 (ej: `service_abc123`)
3. **Template IDs**: De los templates creados (ej: `template_cierre_operativo`)

### 5. Configurar en la Aplicación

1. Abre el archivo `admon.js`
2. Busca la sección `EMAILJS_CONFIG`
3. Actualiza los valores con tus IDs:

```javascript
const EMAILJS_CONFIG = {
    serviceId: 'tu_service_id_aqui',
    templateIdOperativo: 'tu_template_operativo_id',
    templateIdAdministrativo: 'tu_template_administrativo_id',
    userId: 'tu_user_id_aqui'
};
```

## 📱 Configuración desde la Aplicación

### 1. Acceder a la Configuración

1. Ve a **Administración** en la aplicación
2. Busca la sección **"Configuración de Envío de Cierres por Email"**
3. Completa los campos:
   - **Email de Destino**: Donde recibirás los cierres
   - **Nombre del Destinatario**: Tu nombre
   - **Asunto Personalizado**: Opcional (usa {fecha} para fecha automática)

### 2. Configurar Tipos de Cierre

- ✅ **Enviar Cierres Operativos**: Para cierres de empleados
- ✅ **Enviar Cierres Administrativos**: Para cierres de caja

### 3. Probar Configuración

1. Haz clic en **"Probar Envío"**
2. Verifica que recibas el email de prueba
3. Revisa el **Historial de Emails Enviados**

## 🔧 Variables Disponibles en Templates

### Para Cierre Operativo:
- `{{empleado_nombre}}` - Nombre del empleado
- `{{empleado_cargo}}` - Cargo del empleado
- `{{horario}}` - Horario de trabajo
- `{{checklist_completado}}` - Tareas completadas
- `{{checklist_total}}` - Total de tareas
- `{{totales}}` - Total de ventas
- `{{entrega_turno}}` - Quien recibe el turno
- `{{base_caja}}` - Base de caja que deja
- `{{observaciones}}` - Observaciones del turno
- `{{tareas_pendientes}}` - Tareas pendientes

### Para Cierre Administrativo:
- `{{fecha}}` - Fecha del cierre
- `{{nombre_cierre}}` - Quien realiza el cierre
- `{{nombre_recibe}}` - Quien recibe
- `{{total_ventas}}` - Total de ventas
- `{{efectivo}}` - Ventas en efectivo
- `{{transferencia}}` - Ventas por transferencia
- `{{tarjeta}}` - Ventas con tarjeta
- `{{gastos}}` - Total de gastos
- `{{balance}}` - Balance final
- `{{base_caja}}` - Base de caja
- `{{detalles}}` - Detalles adicionales

## 📊 Historial y Logs

### Ver Historial de Emails:
1. En la sección de configuración de EmailJS
2. Revisa el **"Historial de Emails Enviados"**
3. Los logs se guardan automáticamente

### Limpiar Historial:
1. Haz clic en **"Limpiar Historial"**
2. Confirma la acción

## ⚠️ Solución de Problemas

### Error: "EmailJS no está disponible"
- Verifica que la librería se cargue correctamente
- Revisa la consola del navegador

### Error: "Service ID inválido"
- Verifica que el Service ID sea correcto
- Asegúrate de que el servicio esté activo en EmailJS

### Error: "Template ID inválido"
- Verifica que el Template ID sea correcto
- Asegúrate de que el template esté publicado

### No se reciben emails:
- Verifica la carpeta de spam
- Revisa que el email de destino sea correcto
- Confirma que el servicio de email esté conectado

## 💡 Consejos

1. **Plan Gratuito**: EmailJS permite 200 emails/mes gratis
2. **Templates**: Personaliza los templates según tu negocio
3. **Pruebas**: Siempre prueba antes de usar en producción
4. **Backup**: Los cierres se guardan localmente aunque falle el email

## 📞 Soporte

Si necesitas ayuda con la configuración:
- **WhatsApp**: +57 319 236 4724
- **Email**: [Tu email de soporte]

---

**Desarrollado con ❤️ por Emil Jiménez Ortiz**
