// ===== SISTEMA DE RECORDATORIOS - INTERFAZ =====

// Variables locales para la interfaz
let recordatoriosFiltrados = [];
let recordatorioEditando = null;

// Inicialización cuando se carga la página
document.addEventListener('DOMContentLoaded', function() {
    console.log('🚀 Inicializando sistema de recordatorios...');
    
    // Cargar recordatorios desde app.js
    if (typeof cargarRecordatorios === 'function') {
        cargarRecordatorios();
    }
    
    // Configurar fecha mínima para datetime-local
    const fechaLimiteInput = document.getElementById('fechaLimiteRecordatorio');
    if (fechaLimiteInput) {
        const ahora = new Date();
        const fechaMinima = new Date(ahora.getTime() - (ahora.getTimezoneOffset() * 60000));
        fechaLimiteInput.min = fechaMinima.toISOString().slice(0, 16);
    }
    
    // Cargar interfaz
    cargarInterfazRecordatorios();
    
    // Configurar intervalos de actualización
    setInterval(actualizarEstadisticas, 30000); // Cada 30 segundos
    setInterval(verificarRecordatoriosVencidos, 60000); // Cada minuto
    
    // Actualizar estado de notificaciones
    actualizarEstadoNotificaciones();
});

// Función para crear recordatorio desde el formulario
function crearRecordatorioDesdeFormulario() {
    try {
        const form = document.getElementById('formRecordatorio');
        if (!form.checkValidity()) {
            form.reportValidity();
            return;
        }

        const titulo = document.getElementById('tituloRecordatorio').value.trim();
        const descripcion = document.getElementById('descripcionRecordatorio').value.trim();
        const tipo = document.getElementById('tipoRecordatorio').value;
        const prioridad = document.getElementById('prioridadRecordatorio').value;
        const fechaLimite = document.getElementById('fechaLimiteRecordatorio').value;
        const repetir = document.getElementById('repetirRecordatorio').checked;

        // Validaciones
        if (!titulo || !tipo) {
            alert('Por favor completa todos los campos obligatorios');
            return;
        }

        // Crear recordatorio usando la función de app.js
        if (typeof crearRecordatorio === 'function') {
            const recordatorio = crearRecordatorio(
                titulo,
                descripcion,
                tipo,
                prioridad,
                fechaLimite || null,
                repetir
            );

            if (recordatorio) {
                // Limpiar formulario
                form.reset();
                
                // Actualizar interfaz
                cargarInterfazRecordatorios();
                actualizarEstadisticas();
                
                // Mostrar mensaje de éxito
                mostrarMensaje('✅ Recordatorio creado exitosamente', 'success');
                
                // Solicitar permisos de notificación si no se han dado
                if (Notification.permission === 'default') {
                    Notification.requestPermission();
                }
            }
        } else {
            console.error('Función crearRecordatorio no está disponible');
            alert('Error: Función de creación no disponible');
        }
    } catch (error) {
        console.error('Error al crear recordatorio:', error);
        alert('Error al crear el recordatorio: ' + error.message);
    }
}

// Función para cargar la interfaz de recordatorios
function cargarInterfazRecordatorios() {
    try {
        // Verificar que las funciones estén disponibles
        if (typeof recordatoriosActivos === 'undefined') {
            console.error('recordatoriosActivos no está disponible');
            return;
        }

        // Aplicar filtros actuales
        filtrarRecordatorios();
        
        // Actualizar estadísticas
        actualizarEstadisticas();
        
        console.log('✅ Interfaz de recordatorios cargada');
    } catch (error) {
        console.error('Error al cargar interfaz:', error);
    }
}

// Función para filtrar recordatorios
function filtrarRecordatorios() {
    try {
        const filtroTipo = document.getElementById('filtroTipo').value;
        const filtroPrioridad = document.getElementById('filtroPrioridad').value;
        const filtroEstado = document.getElementById('filtroEstado').value;
        const busqueda = document.getElementById('buscarRecordatorio').value.toLowerCase();

        let recordatoriosAMostrar = [];

        // Determinar qué recordatorios mostrar según el estado
        if (filtroEstado === 'activos') {
            recordatoriosAMostrar = recordatoriosActivos.filter(r => !r.completado);
        } else if (filtroEstado === 'completados') {
            recordatoriosAMostrar = recordatorios.filter(r => r.completado);
        } else {
            recordatoriosAMostrar = recordatorios;
        }

        // Aplicar filtros
        recordatoriosFiltrados = recordatoriosAMostrar.filter(recordatorio => {
            let cumpleFiltros = true;

            // Filtro por tipo
            if (filtroTipo && recordatorio.tipo !== filtroTipo) {
                cumpleFiltros = false;
            }

            // Filtro por prioridad
            if (filtroPrioridad && recordatorio.prioridad !== filtroPrioridad) {
                cumpleFiltros = false;
            }

            // Filtro de búsqueda
            if (busqueda) {
                const texto = `${recordatorio.titulo} ${recordatorio.descripcion} ${recordatorio.tipo}`.toLowerCase();
                if (!texto.includes(busqueda)) {
                    cumpleFiltros = false;
                }
            }

            return cumpleFiltros;
        });

        // Ordenar por prioridad y fecha
        recordatoriosFiltrados.sort((a, b) => {
            const prioridades = { 'urgente': 4, 'alta': 3, 'media': 2, 'baja': 1 };
            const prioridadA = prioridades[a.prioridad] || 0;
            const prioridadB = prioridades[b.prioridad] || 0;
            
            if (prioridadA !== prioridadB) {
                return prioridadB - prioridadA;
            }
            
            // Si tienen la misma prioridad, ordenar por fecha límite
            if (a.fechaLimite && b.fechaLimite) {
                return new Date(a.fechaLimite) - new Date(b.fechaLimite);
            }
            
            return 0;
        });

        // Renderizar lista
        renderizarListaRecordatorios();
        
    } catch (error) {
        console.error('Error al filtrar recordatorios:', error);
    }
}

// Función para renderizar la lista de recordatorios
function renderizarListaRecordatorios() {
    const contenedor = document.getElementById('listaRecordatorios');
    const sinRecordatorios = document.getElementById('sinRecordatorios');
    
    if (!contenedor) return;

    if (recordatoriosFiltrados.length === 0) {
        contenedor.innerHTML = '';
        if (sinRecordatorios) {
            sinRecordatorios.style.display = 'block';
        }
        return;
    }

    if (sinRecordatorios) {
        sinRecordatorios.style.display = 'none';
    }

    contenedor.innerHTML = recordatoriosFiltrados.map(recordatorio => {
        const fechaCreacion = new Date(recordatorio.fechaCreacion).toLocaleString('es-ES');
        const fechaLimite = recordatorio.fechaLimite ? new Date(recordatorio.fechaLimite).toLocaleString('es-ES') : 'Sin fecha límite';
        const esVencido = recordatorio.fechaLimite && new Date(recordatorio.fechaLimite) < new Date();
        
        const clasesPrioridad = {
            'baja': 'text-success',
            'media': 'text-warning',
            'alta': 'text-danger',
            'urgente': 'text-danger fw-bold'
        };

        const iconosTipo = {
            'pedido': 'fas fa-utensils',
            'limpieza': 'fas fa-broom',
            'inventario': 'fas fa-boxes',
            'cocina': 'fas fa-fire',
            'general': 'fas fa-tasks',
            'cierre': 'fas fa-cash-register'
        };

        return `
            <div class="card bg-secondary text-white mb-3 ${esVencido ? 'border-danger border-2' : ''}">
                <div class="card-header d-flex justify-content-between align-items-center">
                    <div class="d-flex align-items-center">
                        <i class="${iconosTipo[recordatorio.tipo] || 'fas fa-bell'} me-2"></i>
                        <h6 class="mb-0 ${clasesPrioridad[recordatorio.prioridad]}">${recordatorio.titulo}</h6>
                        ${esVencido ? '<span class="badge bg-danger ms-2">VENCIDO</span>' : ''}
                        ${recordatorio.repetir ? '<span class="badge bg-info ms-2">REPETIR</span>' : ''}
                    </div>
                    <div class="d-flex gap-1">
                        <button class="btn btn-sm btn-outline-light" onclick="editarRecordatorio(${recordatorio.id})" title="Editar">
                            <i class="fas fa-edit"></i>
                        </button>
                        ${!recordatorio.completado ? 
                            `<button class="btn btn-sm btn-outline-success" onclick="completarRecordatorioDesdeUI(${recordatorio.id})" title="Marcar como completado">
                                <i class="fas fa-check"></i>
                            </button>` : ''
                        }
                        <button class="btn btn-sm btn-outline-danger" onclick="eliminarRecordatorioDesdeUI(${recordatorio.id})" title="Eliminar">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                </div>
                <div class="card-body">
                    <p class="mb-2">${recordatorio.descripcion || 'Sin descripción'}</p>
                    <div class="row text-muted small">
                        <div class="col-md-3">
                            <i class="fas fa-tag me-1"></i>${recordatorio.tipo}
                        </div>
                        <div class="col-md-3">
                            <i class="fas fa-exclamation-triangle me-1"></i>${recordatorio.prioridad}
                        </div>
                        <div class="col-md-3">
                            <i class="fas fa-calendar-plus me-1"></i>${fechaCreacion}
                        </div>
                        <div class="col-md-3">
                            <i class="fas fa-clock me-1"></i>${fechaLimite}
                        </div>
                    </div>
                </div>
            </div>
        `;
    }).join('');
}

// Función para completar recordatorio desde la UI
function completarRecordatorioDesdeUI(id) {
    try {
        if (typeof completarRecordatorio === 'function') {
            if (completarRecordatorio(id)) {
                mostrarMensaje('✅ Tarea marcada como completada', 'success');
                cargarInterfazRecordatorios();
            } else {
                mostrarMensaje('❌ Error al completar la tarea', 'error');
            }
        } else {
            console.error('Función completarRecordatorio no está disponible');
            alert('Error: Función de completado no disponible');
        }
    } catch (error) {
        console.error('Error al completar recordatorio:', error);
        alert('Error al completar el recordatorio: ' + error.message);
    }
}

// Función para eliminar recordatorio desde la UI
function eliminarRecordatorioDesdeUI(id) {
    if (confirm('¿Estás seguro de que quieres eliminar este recordatorio?')) {
        try {
            if (typeof eliminarRecordatorio === 'function') {
                eliminarRecordatorio(id);
                mostrarMensaje('🗑️ Recordatorio eliminado', 'info');
                cargarInterfazRecordatorios();
            } else {
                console.error('Función eliminarRecordatorio no está disponible');
                alert('Error: Función de eliminación no disponible');
            }
        } catch (error) {
            console.error('Error al eliminar recordatorio:', error);
            alert('Error al eliminar el recordatorio: ' + error.message);
        }
    }
}

// Función para editar recordatorio
function editarRecordatorio(id) {
    try {
        const recordatorio = recordatorios.find(r => r.id === id);
        if (!recordatorio) {
            alert('Recordatorio no encontrado');
            return;
        }

        recordatorioEditando = recordatorio;

        // Llenar formulario de edición
        document.getElementById('editIdRecordatorio').value = recordatorio.id;
        document.getElementById('editTituloRecordatorio').value = recordatorio.titulo;
        document.getElementById('editDescripcionRecordatorio').value = recordatorio.descripcion || '';
        document.getElementById('editTipoRecordatorio').value = recordatorio.tipo;
        document.getElementById('editPrioridadRecordatorio').value = recordatorio.prioridad;
        document.getElementById('editRepetirRecordatorio').checked = recordatorio.repetir || false;

        if (recordatorio.fechaLimite) {
            const fecha = new Date(recordatorio.fechaLimite);
            const fechaLocal = new Date(fecha.getTime() - (fecha.getTimezoneOffset() * 60000));
            document.getElementById('editFechaLimiteRecordatorio').value = fechaLocal.toISOString().slice(0, 16);
        } else {
            document.getElementById('editFechaLimiteRecordatorio').value = '';
        }

        // Mostrar modal
        const modal = new bootstrap.Modal(document.getElementById('modalEditarRecordatorio'));
        modal.show();

    } catch (error) {
        console.error('Error al editar recordatorio:', error);
        alert('Error al editar el recordatorio: ' + error.message);
    }
}

// Función para guardar cambios del recordatorio
function guardarCambiosRecordatorio() {
    try {
        if (!recordatorioEditando) {
            alert('No hay recordatorio para editar');
            return;
        }

        const form = document.getElementById('formEditarRecordatorio');
        if (!form.checkValidity()) {
            form.reportValidity();
            return;
        }

        const datos = {
            titulo: document.getElementById('editTituloRecordatorio').value.trim(),
            descripcion: document.getElementById('editDescripcionRecordatorio').value.trim(),
            tipo: document.getElementById('editTipoRecordatorio').value,
            prioridad: document.getElementById('editPrioridadRecordatorio').value,
            fechaLimite: document.getElementById('editFechaLimiteRecordatorio').value || null,
            repetir: document.getElementById('editRepetirRecordatorio').checked
        };

        // Validaciones
        if (!datos.titulo || !datos.tipo) {
            alert('Por favor completa todos los campos obligatorios');
            return;
        }

        // Actualizar recordatorio usando la función de app.js
        if (typeof actualizarRecordatorio === 'function') {
            if (actualizarRecordatorio(recordatorioEditando.id, datos)) {
                mostrarMensaje('✅ Recordatorio actualizado exitosamente', 'success');
                
                // Cerrar modal
                const modal = bootstrap.Modal.getInstance(document.getElementById('modalEditarRecordatorio'));
                modal.hide();
                
                // Actualizar interfaz
                cargarInterfazRecordatorios();
                actualizarEstadisticas();
                
                recordatorioEditando = null;
            } else {
                mostrarMensaje('❌ Error al actualizar el recordatorio', 'error');
            }
        } else {
            console.error('Función actualizarRecordatorio no está disponible');
            alert('Error: Función de actualización no disponible');
        }
    } catch (error) {
        console.error('Error al guardar cambios:', error);
        alert('Error al guardar los cambios: ' + error.message);
    }
}

// Función para actualizar estadísticas
function actualizarEstadisticas() {
    try {
        if (typeof recordatoriosActivos === 'undefined') return;

        const pendientes = recordatoriosActivos.filter(r => !r.completado).length;
        const urgentes = recordatoriosActivos.filter(r => !r.completado && r.prioridad === 'urgente').length;
        const completados = recordatorios.filter(r => r.completado).length;
        
        // Contar recordatorios para hoy
        const hoy = new Date();
        const recordatoriosHoy = recordatoriosActivos.filter(r => {
            if (!r.fechaLimite || r.completado) return false;
            const fechaLimite = new Date(r.fechaLimite);
            return fechaLimite.toDateString() === hoy.toDateString();
        }).length;

        // Actualizar contadores en la UI
        const contadorPendientes = document.getElementById('contadorPendientes');
        const contadorUrgentes = document.getElementById('contadorUrgentes');
        const contadorCompletados = document.getElementById('contadorCompletados');
        const contadorHoy = document.getElementById('contadorHoy');

        if (contadorPendientes) contadorPendientes.textContent = pendientes;
        if (contadorUrgentes) contadorUrgentes.textContent = urgentes;
        if (contadorCompletados) contadorCompletados.textContent = completados;
        if (contadorHoy) contadorHoy.textContent = recordatoriosHoy;

    } catch (error) {
        console.error('Error al actualizar estadísticas:', error);
    }
}

// Función para limpiar recordatorios completados
function limpiarRecordatoriosCompletados() {
    if (confirm('¿Estás seguro de que quieres eliminar todos los recordatorios completados?')) {
        try {
            const completados = recordatorios.filter(r => r.completado);
            completados.forEach(r => eliminarRecordatorio(r.id));
            
            mostrarMensaje(`🗑️ ${completados.length} recordatorios completados eliminados`, 'info');
            cargarInterfazRecordatorios();
        } catch (error) {
            console.error('Error al limpiar recordatorios:', error);
            alert('Error al limpiar recordatorios: ' + error.message);
        }
    }
}

// Función para eliminar todos los recordatorios
function eliminarTodosRecordatorios() {
    if (confirm('⚠️ ¿Estás SEGURO de que quieres eliminar TODOS los recordatorios? Esta acción no se puede deshacer.')) {
        try {
            recordatorios.forEach(r => eliminarRecordatorio(r.id));
            
            mostrarMensaje('🗑️ Todos los recordatorios han sido eliminados', 'warning');
            cargarInterfazRecordatorios();
        } catch (error) {
            console.error('Error al eliminar todos los recordatorios:', error);
            alert('Error al eliminar recordatorios: ' + error.message);
        }
    }
}

// Función para mostrar mensajes
function mostrarMensaje(mensaje, tipo = 'info') {
    // Crear toast de Bootstrap si está disponible
    if (typeof bootstrap !== 'undefined') {
        const toastContainer = document.getElementById('toastContainer') || crearToastContainer();
        
        const toast = document.createElement('div');
        toast.className = `toast align-items-center text-white bg-${tipo === 'error' ? 'danger' : tipo} border-0`;
        toast.setAttribute('role', 'alert');
        toast.innerHTML = `
            <div class="d-flex">
                <div class="toast-body">${mensaje}</div>
                <button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast"></button>
            </div>
        `;
        
        toastContainer.appendChild(toast);
        
        const bsToast = new bootstrap.Toast(toast);
        bsToast.show();
        
        // Auto-eliminar después de mostrar
        toast.addEventListener('hidden.bs.toast', () => {
            toast.remove();
        });
    } else {
        // Fallback a alert si Bootstrap no está disponible
        alert(mensaje);
    }
}

// Función para crear contenedor de toasts si no existe
function crearToastContainer() {
  const container = document.createElement('div');
  container.id = 'toastContainer';
  container.className = 'toast-container position-fixed bottom-0 end-0 p-3';
  container.style.zIndex = '9999';
  document.body.appendChild(container);
  return container;
}

// Función para actualizar estado de notificaciones
function actualizarEstadoNotificaciones() {
  try {
    if (typeof mostrarEstadoNotificaciones === 'function') {
      const estadoElement = document.getElementById('estadoNotificaciones');
      if (estadoElement) {
        estadoElement.textContent = mostrarEstadoNotificaciones();
        
        // Cambiar color del botón según el estado
        const btnNotificaciones = document.getElementById('btnNotificaciones');
        if (btnNotificaciones) {
          const estado = verificarEstadoNotificaciones();
          btnNotificaciones.className = 'btn btn-outline-info';
          
          switch (estado) {
            case 'granted':
              btnNotificaciones.className = 'btn btn-success';
              break;
            case 'denied':
              btnNotificaciones.className = 'btn btn-danger';
              break;
            case 'default':
              btnNotificaciones.className = 'btn btn-warning';
              break;
          }
        }
      }
    }
  } catch (error) {
    console.error('Error al actualizar estado de notificaciones:', error);
  }
}

// Función para crear recordatorios de ejemplo (para testing)
function crearRecordatoriosEjemplo() {
    if (confirm('¿Quieres crear algunos recordatorios de ejemplo para probar el sistema?')) {
        try {
            const ahora = new Date();
            
            // Recordatorio de limpieza
            crearRecordatorio(
                'Limpiar Mesa 3',
                'La mesa 3 necesita limpieza después del almuerzo',
                'limpieza',
                'media',
                new Date(ahora.getTime() + 2 * 60 * 60 * 1000).toISOString(), // 2 horas
                false
            );
            
            // Recordatorio de inventario
            crearRecordatorio(
                'Revisar Stock de Papas',
                'Verificar cantidad de papas disponibles para fritos',
                'inventario',
                'alta',
                new Date(ahora.getTime() + 4 * 60 * 60 * 1000).toISOString(), // 4 horas
                false
            );
            
            // Recordatorio urgente
            crearRecordatorio(
                'Pedido Pendiente Mesa 5',
                'El pedido de la mesa 5 está listo para servir',
                'pedido',
                'urgente',
                new Date(ahora.getTime() + 5 * 60 * 1000).toISOString(), // 5 minutos
                false
            );
            
            mostrarMensaje('✅ Recordatorios de ejemplo creados', 'success');
            cargarInterfazRecordatorios();
            
        } catch (error) {
            console.error('Error al crear recordatorios de ejemplo:', error);
            alert('Error al crear recordatorios de ejemplo: ' + error.message);
        }
    }
}

// Exportar funciones para uso global
window.crearRecordatorioDesdeFormulario = crearRecordatorioDesdeFormulario;
window.filtrarRecordatorios = filtrarRecordatorios;
window.completarRecordatorioDesdeUI = completarRecordatorioDesdeUI;
window.eliminarRecordatorioDesdeUI = eliminarRecordatorioDesdeUI;
window.editarRecordatorio = editarRecordatorio;
window.guardarCambiosRecordatorio = guardarCambiosRecordatorio;
window.limpiarRecordatoriosCompletados = limpiarRecordatoriosCompletados;
window.eliminarTodosRecordatorios = eliminarTodosRecordatorios;
window.crearRecordatoriosEjemplo = crearRecordatoriosEjemplo;
window.actualizarEstadoNotificaciones = actualizarEstadoNotificaciones;
