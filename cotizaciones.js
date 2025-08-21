// Variables globales para cotizaciones
let cotizaciones = [];
let cotizacionActual = null;

// Función para cargar cotizaciones desde localStorage
function cargarCotizaciones() {
  try {
    const cotizacionesGuardadas = localStorage.getItem('cotizaciones');
    if (cotizacionesGuardadas) {
      cotizaciones = JSON.parse(cotizacionesGuardadas);
    }
  } catch (error) {
    console.error('Error al cargar cotizaciones:', error);
    cotizaciones = [];
  }
}

// Función para guardar cotizaciones en localStorage
function guardarCotizaciones() {
  try {
    localStorage.setItem('cotizaciones', JSON.stringify(cotizaciones));
  } catch (error) {
    console.error('Error al guardar cotizaciones:', error);
  }
}

// Función para crear nueva cotización
function crearCotizacion() {
  const cotizacion = {
    id: Date.now(),
    fecha: new Date().toLocaleString(),
    cliente: '',
    items: [],
    total: 0,
    estado: 'borrador'
  };
  
  cotizacionActual = cotizacion;
  cotizaciones.push(cotizacion);
  guardarCotizaciones();
  
  return cotizacion;
}

// Función para agregar producto a cotización
function agregarProductoCotizacion(producto) {
  if (!cotizacionActual) {
    cotizacionActual = crearCotizacion();
  }
  
  const itemExistente = cotizacionActual.items.find(item => item.id === producto.id);
  
  if (itemExistente) {
    itemExistente.cantidad += 1;
  } else {
    cotizacionActual.items.push({
      id: producto.id,
      nombre: producto.nombre,
      precio: producto.precio,
      cantidad: 1
    });
  }
  
  actualizarTotalCotizacion();
  guardarCotizaciones();
}

// Función para actualizar total de cotización
function actualizarTotalCotizacion() {
  if (!cotizacionActual) return;
  
  cotizacionActual.total = cotizacionActual.items.reduce((sum, item) => {
    return sum + (item.precio * item.cantidad);
  }, 0);
}

// Función para eliminar producto de cotización
function eliminarProductoCotizacion(index) {
  if (!cotizacionActual) return;
  
  cotizacionActual.items.splice(index, 1);
  actualizarTotalCotizacion();
  guardarCotizaciones();
}

// Función para limpiar cotización actual
function limpiarCotizacion() {
  cotizacionActual = null;
}

// Función para finalizar cotización
function finalizarCotizacion() {
  if (!cotizacionActual) return;
  
  cotizacionActual.estado = 'finalizada';
  cotizacionActual.fechaFinalizacion = new Date().toLocaleString();
  
  guardarCotizaciones();
  return cotizacionActual;
}

// Función para obtener cotización por ID
function obtenerCotizacion(id) {
  return cotizaciones.find(c => c.id === id);
}

// Función para eliminar cotización
function eliminarCotizacion(id) {
  const index = cotizaciones.findIndex(c => c.id === id);
  if (index !== -1) {
    cotizaciones.splice(index, 1);
    guardarCotizaciones();
  }
}

// Inicializar al cargar
document.addEventListener('DOMContentLoaded', function() {
  cargarCotizaciones();
});

