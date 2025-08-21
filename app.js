// Variables globales
window.ultimaHoraCierre = null;
let productos = [];
let categorias = [];
let mesasActivas = new Map(); // Almacena las órdenes por mesa
let mesaSeleccionada = null; // Mesa actualmente seleccionada
let ordenesCocina = new Map(); // Almacena las órdenes enviadas a cocina
let clientes = []; // Almacena los clientes frecuentes
let tipoPedidoActual = null; // 'domicilio' o 'recoger'
let contadorDomicilios = 0; // Contador de pedidos a domicilio
let contadorRecoger = 0; // Contador de pedidos para recoger
let historialVentas = []; // Almacena el historial de ventas
let historialCocina = []; // Almacena el historial de órdenes de cocina
let ultimaFechaContadores = null; // Fecha del último contador

// Variables globales para cotizaciones
let cotizaciones = [];
let modoProductoManual = false;
let productosFiltrados = [];

// Variable global para la ventana de impresión
let ventanaImpresion = null;

let cotizacionEditandoId = null;

// Variables globales para recordatorios de tareas
let recordatorios = [];
let recordatoriosActivos = [];
let notificacionesActivas = [];

// Variables globales para el PIN
let PIN_ACCESO = '4321'; // PIN por defecto
let accionPendiente = null;

// Utilidad: obtener fecha local en formato ISO (YYYY-MM-DD) evitando desfase por zona horaria
function obtenerFechaLocalISO() {
    const hoy = new Date();
    // Ajustar la hora restando el desfase de zona horaria para obtener la fecha local correcta
    hoy.setMinutes(hoy.getMinutes() - hoy.getTimezoneOffset());
    return hoy.toISOString().split('T')[0];
}


// Función para guardar productos en localStorage
function guardarProductos() {
  localStorage.setItem('productos', JSON.stringify(productos));
}

// Función para guardar clientes en localStorage
function guardarClientes() {
  localStorage.setItem('clientes', JSON.stringify(clientes));
}

// Función para guardar contadores en localStorage
function guardarContadores() {
  localStorage.setItem('contadorDomicilios', contadorDomicilios.toString());
  localStorage.setItem('contadorRecoger', contadorRecoger.toString());
  localStorage.setItem('ultimaFechaContadores', ultimaFechaContadores);
}

// Función para guardar historial de ventas
function guardarHistorialVentas() {
  try {
    // Asegurarse de que historialVentas sea un array
    if (!Array.isArray(historialVentas)) {
      console.error('historialVentas no es un array:', historialVentas);
      historialVentas = [];
    }
    // Guardar en ambas claves para sincronizar
    localStorage.setItem('historialVentas', JSON.stringify(historialVentas));
    console.log('Historial de ventas guardado:', historialVentas);
    // Verificar que se guardó correctamente
    const guardado = localStorage.getItem('historialVentas');
    console.log('Verificación de guardado:', guardado);
  } catch (error) {
    console.error('Error al guardar historial de ventas:', error);
  }
}

// Función para guardar historial de cocina
function guardarHistorialCocina() {
  // Guardar todo el historial de cocina
  localStorage.setItem('historialCocina', JSON.stringify(historialCocina));
}

// ===== SISTEMA DE RECORDATORIOS DE TAREAS =====

// Función para guardar recordatorios en localStorage
function guardarRecordatorios() {
  try {
    localStorage.setItem('recordatorios', JSON.stringify(recordatorios));
    localStorage.setItem('recordatoriosActivos', JSON.stringify(recordatoriosActivos));
    console.log('✅ Recordatorios guardados:', recordatorios);
  } catch (error) {
    console.error('❌ Error al guardar recordatorios:', error);
  }
}

// Función para cargar recordatorios desde localStorage
function cargarRecordatorios() {
  try {
    recordatorios = JSON.parse(localStorage.getItem('recordatorios')) || [];
    recordatoriosActivos = JSON.parse(localStorage.getItem('recordatoriosActivos')) || [];
    console.log('✅ Recordatorios cargados:', recordatorios);
  } catch (error) {
    console.error('❌ Error al cargar recordatorios:', error);
    recordatorios = [];
    recordatoriosActivos = [];
  }
}

// Función para crear un nuevo recordatorio
function crearRecordatorio(titulo, descripcion, tipo, prioridad = 'media', fechaLimite = null, repetir = false) {
  const recordatorio = {
    id: Date.now() + Math.random(),
    titulo: titulo,
    descripcion: descripcion,
    tipo: tipo, // 'pedido', 'limpieza', 'inventario', 'general', 'cocina'
    prioridad: prioridad, // 'baja', 'media', 'alta', 'urgente'
    fechaCreacion: new Date().toISOString(),
    fechaLimite: fechaLimite,
    completado: false,
    repetir: repetir,
    activo: true,
    asignadoA: null, // Para futuras implementaciones de usuarios
    categoria: 'general'
  };

  recordatorios.push(recordatorio);
  recordatoriosActivos.push(recordatorio);
  guardarRecordatorios();
  
  // Mostrar notificación inmediata
  mostrarNotificacionRecordatorio(recordatorio);
  
  return recordatorio;
}

// Función para marcar recordatorio como completado
function completarRecordatorio(id) {
  const recordatorio = recordatorios.find(r => r.id === id);
  if (recordatorio) {
    recordatorio.completado = true;
    recordatorio.activo = false;
    recordatorio.fechaCompletado = new Date().toISOString();
    
    // Remover de activos
    recordatoriosActivos = recordatoriosActivos.filter(r => r.id !== id);
    
    guardarRecordatorios();
    
    // Si es repetitivo, crear uno nuevo
    if (recordatorio.repetir && recordatorio.fechaLimite) {
      const nuevaFechaLimite = new Date(recordatorio.fechaLimite);
      nuevaFechaLimite.setDate(nuevaFechaLimite.getDate() + 1);
      crearRecordatorio(
        recordatorio.titulo,
        recordatorio.descripcion,
        recordatorio.tipo,
        recordatorio.prioridad,
        nuevaFechaLimite.toISOString(),
        true
      );
    }
    
    return true;
  }
  return false;
}

// Función para eliminar recordatorio
function eliminarRecordatorio(id) {
  recordatorios = recordatorios.filter(r => r.id !== id);
  recordatoriosActivos = recordatoriosActivos.filter(r => r.id !== id);
  guardarRecordatorios();
}

// Función para mostrar notificación de recordatorio
function mostrarNotificacionRecordatorio(recordatorio) {
  // Verificar si el navegador soporta notificaciones
  if (!("Notification" in window)) {
    console.log("Este navegador no soporta notificaciones del sistema");
    return;
  }

  // Solo mostrar notificación si ya se han dado permisos
  // No solicitar permisos automáticamente
  if (Notification.permission !== "granted") {
    console.log("Permisos de notificación no otorgados - usar notificaciones internas");
    return;
  }

  if (Notification.permission === "granted") {
    const notificacion = new Notification(recordatorio.titulo, {
      body: recordatorio.descripcion,
      icon: './image/logo-ToySoft.png',
      tag: recordatorio.id,
      requireInteraction: recordatorio.prioridad === 'urgente'
    });

    // Agregar a notificaciones activas
    notificacionesActivas.push({
      id: recordatorio.id,
      notificacion: notificacion,
      recordatorio: recordatorio
    });

    // Configurar auto-eliminación
    setTimeout(() => {
      notificacion.close();
      notificacionesActivas = notificacionesActivas.filter(n => n.id !== recordatorio.id);
    }, 10000); // 10 segundos
  }
}

// Función para verificar recordatorios vencidos
function verificarRecordatoriosVencidos() {
  const ahora = new Date();
  const vencidos = recordatoriosActivos.filter(recordatorio => {
    if (recordatorio.fechaLimite && !recordatorio.completado) {
      const fechaLimite = new Date(recordatorio.fechaLimite);
      return fechaLimite < ahora;
    }
    return false;
  });

  vencidos.forEach(recordatorio => {
    if (recordatorio.prioridad !== 'urgente') {
      recordatorio.prioridad = 'urgente';
      mostrarNotificacionRecordatorio({
        ...recordatorio,
        titulo: `⚠️ URGENTE: ${recordatorio.titulo}`,
        descripcion: `Tarea vencida: ${recordatorio.descripcion}`
      });
    }
  });

  guardarRecordatorios();
}

// Función para crear recordatorios automáticos
function crearRecordatoriosAutomaticos() {
  const ahora = new Date();
  const hora = ahora.getHours();
  
  // Recordatorio de cierre de caja (si no existe)
  const cierreCaja = recordatoriosActivos.find(r => r.tipo === 'cierre' && r.titulo.includes('Cierre de Caja'));
  if (!cierreCaja && hora >= 20) { // Después de las 8 PM
    crearRecordatorio(
      'Cierre de Caja',
      'Realizar cierre de caja y conteo de efectivo',
      'general',
      'alta',
      new Date(ahora.getFullYear(), ahora.getMonth(), ahora.getDate(), 23, 59).toISOString(),
      false
    );
  }

  // Recordatorio de limpieza (si no existe)
  const limpieza = recordatoriosActivos.find(r => r.tipo === 'limpieza' && r.titulo.includes('Limpieza'));
  if (!limpieza && hora >= 21) { // Después de las 9 PM
    crearRecordatorio(
      'Limpieza General',
      'Limpiar mesas, cocina y área de trabajo',
      'limpieza',
      'media',
      new Date(ahora.getFullYear(), ahora.getMonth(), ahora.getDate(), 23, 30).toISOString(),
      false
    );
  }
}

// Función para obtener recordatorios por tipo
function obtenerRecordatoriosPorTipo(tipo) {
  return recordatoriosActivos.filter(r => r.tipo === tipo && !r.completado);
}

// Función para obtener recordatorios por prioridad
function obtenerRecordatoriosPorPrioridad(prioridad) {
  return recordatoriosActivos.filter(r => r.prioridad === prioridad && !r.completado);
}

// Función para actualizar recordatorio
function actualizarRecordatorio(id, datos) {
  const recordatorio = recordatorios.find(r => r.id === id);
  if (recordatorio) {
    Object.assign(recordatorio, datos);
    guardarRecordatorios();
    return true;
  }
  return false;
}

// ===== FUNCIONES DE INTEGRACIÓN CON OTROS MÓDULOS =====

// Función para crear recordatorio automático de pedido
function crearRecordatorioPedido(mesa, productos, tiempoEstimado = 15) {
  const recordatorio = crearRecordatorio(
    `Pedido Mesa ${mesa}`,
    `Preparar: ${productos.join(', ')}. Tiempo estimado: ${tiempoEstimado} min`,
    'pedido',
    'alta',
    new Date(Date.now() + tiempoEstimado * 60 * 1000).toISOString(),
    false
  );
  
  console.log(`🔔 Recordatorio de pedido creado para mesa ${mesa}`);
  return recordatorio;
}

// Función para crear recordatorio de limpieza de mesa
function crearRecordatorioLimpieza(mesa) {
  const recordatorio = crearRecordatorio(
    `Limpiar Mesa ${mesa}`,
    `La mesa ${mesa} necesita limpieza después del servicio`,
    'limpieza',
    'media',
    new Date(Date.now() + 30 * 60 * 1000).toISOString(), // 30 minutos
    false
  );
  
  console.log(`🧹 Recordatorio de limpieza creado para mesa ${mesa}`);
  return recordatorio;
}

// Función para crear recordatorio de inventario
function crearRecordatorioInventario(producto, cantidadMinima) {
  const recordatorio = crearRecordatorio(
    `Stock Bajo: ${producto}`,
    `El producto ${producto} tiene stock bajo (${cantidadMinima} unidades restantes)`,
    'inventario',
    'alta',
    new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(), // 2 horas
    false
  );
  
  console.log(`📦 Recordatorio de inventario creado para ${producto}`);
  return recordatorio;
}

// Función para crear recordatorio de cierre
function crearRecordatorioCierre() {
  const ahora = new Date();
  const horaCierre = new Date(ahora.getFullYear(), ahora.getMonth(), ahora.getDate(), 23, 0); // 11 PM
  
  const recordatorio = crearRecordatorio(
    'Cierre de Caja',
    'Realizar cierre de caja, conteo de efectivo y limpieza general',
    'cierre',
    'alta',
    horaCierre.toISOString(),
    false
  );
  
  console.log('💰 Recordatorio de cierre de caja creado');
  return recordatorio;
}

// Función para obtener recordatorios urgentes para mostrar en el dashboard
function obtenerRecordatoriosUrgentes() {
  return recordatoriosActivos.filter(r => 
    r.prioridad === 'urgente' && !r.completado
  );
}

// Función para obtener recordatorios pendientes por tipo
function obtenerRecordatoriosPendientesPorTipo(tipo) {
  return recordatoriosActivos.filter(r => 
    r.tipo === tipo && !r.completado
  );
}

// Función para marcar recordatorio como completado desde otros módulos
function completarRecordatorioPorTipo(tipo, identificador) {
  const recordatorio = recordatoriosActivos.find(r => 
    r.tipo === tipo && 
    r.descripcion.includes(identificador) && 
    !r.completado
  );
  
  if (recordatorio) {
    return completarRecordatorio(recordatorio.id);
  }
  
  return false;
}

// ===== FUNCIONES DE INTEGRACIÓN CON POS =====

// Función para crear recordatorio automático cuando se envía un pedido a cocina
function crearRecordatorioPedidoCocina(mesa, productos) {
  const recordatorio = crearRecordatorio(
    `Pedido Cocina - Mesa ${mesa}`,
    `Preparar: ${productos.join(', ')}. Mesa: ${mesa}`,
    'cocina',
    'alta',
    new Date(Date.now() + 20 * 60 * 1000).toISOString(), // 20 minutos
    false
  );
  
  console.log(`🔔 Recordatorio de cocina creado para mesa ${mesa}`);
  return recordatorio;
}

// Función para crear recordatorio cuando se completa un pedido
function crearRecordatorioLimpiezaMesa(mesa) {
  const recordatorio = crearRecordatorio(
    `Limpiar Mesa ${mesa}`,
    `La mesa ${mesa} necesita limpieza después del servicio`,
    'limpieza',
    'media',
    new Date(Date.now() + 15 * 60 * 1000).toISOString(), // 15 minutos
    false
  );
  
  console.log(`🧹 Recordatorio de limpieza creado para mesa ${mesa}`);
  return recordatorio;
}

// Función para crear recordatorio de inventario cuando se vende un producto
function crearRecordatorioInventarioProducto(producto, cantidadRestante) {
  if (cantidadRestante <= 5) { // Solo si queda poco stock
    const recordatorio = crearRecordatorio(
      `Stock Bajo: ${producto}`,
      `El producto ${producto} tiene stock bajo (${cantidadRestante} unidades restantes)`,
      'inventario',
      'alta',
      new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(), // 2 horas
      false
    );
    
    console.log(`📦 Recordatorio de inventario creado para ${producto}`);
    return recordatorio;
  }
  return null;
}

// Función para crear recordatorio de cierre cuando se acerca la hora
function crearRecordatorioCierreAutomatico() {
  const ahora = new Date();
  const hora = ahora.getHours();
  
  // Solo crear si no existe ya uno de cierre para hoy
  const cierreExistente = recordatoriosActivos.find(r => 
    r.tipo === 'cierre' && 
    r.titulo.includes('Cierre de Caja') &&
    new Date(r.fechaCreacion).toDateString() === ahora.toDateString()
  );
  
  if (!cierreExistente && hora >= 20) { // Después de las 8 PM
    const recordatorio = crearRecordatorio(
      'Cierre de Caja',
      'Realizar cierre de caja, conteo de efectivo y limpieza general',
      'cierre',
      'alta',
      new Date(ahora.getFullYear(), ahora.getMonth(), ahora.getDate(), 23, 0).toISOString(), // 11 PM
      false
    );
    
    console.log('💰 Recordatorio de cierre de caja creado automáticamente');
    return recordatorio;
  }
  
  return null;
}

// ===== FUNCIONES PARA ACTIVAR NOTIFICACIONES MANUALMENTE =====

// Función para activar notificaciones del navegador
function activarNotificacionesNavegador() {
  try {
    if (!("Notification" in window)) {
      alert('Este navegador no soporta notificaciones del sistema');
      return false;
    }

    if (Notification.permission === "granted") {
      alert('Las notificaciones ya están activadas');
      return true;
    }

    if (Notification.permission === "denied") {
      alert('Las notificaciones están bloqueadas. Por favor, habilítalas en la configuración del navegador y recarga la página.');
      return false;
    }

    // Solicitar permisos solo cuando el usuario lo active manualmente
    Notification.requestPermission().then(function (permission) {
      if (permission === "granted") {
        alert('✅ Notificaciones activadas exitosamente');
        console.log('🔔 Notificaciones del navegador activadas');
        
        // Probar notificación
        mostrarNotificacionRecordatorio({
          titulo: '🔔 Notificaciones Activadas',
          descripcion: 'El sistema de recordatorios ahora mostrará notificaciones del navegador',
          id: 'test-notificacion'
        });
      } else {
        alert('❌ Las notificaciones no fueron activadas');
        console.log('🔕 Usuario rechazó las notificaciones');
      }
    });

    return true;
  } catch (error) {
    console.error('Error al activar notificaciones:', error);
    alert('Error al activar notificaciones: ' + error.message);
    return false;
  }
}

// Función para verificar estado de notificaciones
function verificarEstadoNotificaciones() {
  if (!("Notification" in window)) {
    return 'no-soportado';
  }
  
  return Notification.permission;
}

// Función para mostrar estado de notificaciones
function mostrarEstadoNotificaciones() {
  const estado = verificarEstadoNotificaciones();
  
  switch (estado) {
    case 'granted':
      return '✅ Activadas';
    case 'denied':
      return '❌ Bloqueadas';
    case 'default':
      return '⏳ Pendientes';
    case 'no-soportado':
      return '🚫 No soportadas';
    default:
      return '❓ Desconocido';
  }
}

// Función para sincronizar datos con la administración
function sincronizarConAdministracion() {
  console.log('🔄 Sincronizando con datos de administración...');
  
  // Intentar cargar desde localStorage (donde admon.js los guarda)
  const categoriasAdmin = JSON.parse(localStorage.getItem('categorias')) || [];
  const productosAdmin = JSON.parse(localStorage.getItem('productos')) || [];
  
  console.log('📋 Categorías desde administración:', categoriasAdmin);
  console.log('🛍️ Productos desde administración:', productosAdmin);
  
  // Si hay datos de administración, usarlos
  if (categoriasAdmin.length > 0) {
    categorias = categoriasAdmin;
    console.log('✅ Categorías sincronizadas desde administración');
  }
  
  if (productosAdmin.length > 0) {
    productos = productosAdmin;
    console.log('✅ Productos sincronizados desde administración');
  }
  
  // Si no hay datos de administración, usar datos de prueba
  if (categorias.length === 0) {
    console.log('⚠️ No hay categorías en administración, usando datos de prueba...');
    categorias = ['Empanadas', 'Bebidas', 'Postres', 'Snacks'];
    localStorage.setItem('categorias', JSON.stringify(categorias));
    console.log('📋 Categorías de prueba creadas:', categorias);
  }
  
  if (productos.length === 0) {
    console.log('⚠️ No hay productos en administración, usando datos de prueba...');
    productos = [
      {
        id: 1,
        nombre: 'Empanada de Carne',
        precio: 2500,
        categoria: 'Empanadas',
        imagen: 'image/placeholder-product.png'
      },
      {
        id: 2,
        nombre: 'Empanada de Pollo',
        precio: 2300,
        categoria: 'Empanadas',
        imagen: 'image/placeholder-product.png'
      },
      {
        id: 3,
        nombre: 'Coca Cola',
        precio: 3000,
        categoria: 'Bebidas',
        imagen: 'image/placeholder-product.png'
      },
      {
        id: 4,
        nombre: 'Agua',
        precio: 1500,
        categoria: 'Bebidas',
        imagen: 'image/placeholder-product.png'
      },
      {
        id: 5,
        nombre: 'Tres Leches',
        precio: 4500,
        categoria: 'Postres',
        imagen: 'image/placeholder-product.png'
      },
      {
        id: 6,
        nombre: 'Papas Fritas',
        precio: 3500,
        categoria: 'Snacks',
        imagen: 'image/placeholder-product.png'
      }
    ];
    localStorage.setItem('productos', JSON.stringify(productos));
    console.log('🛍️ Productos de prueba creados:', productos);
  }
  
  console.log('✅ Sincronización completada:', { categorias, productos });
}

// Función para inicializar datos de prueba si no existen (mantenida por compatibilidad)
function inicializarDatosPrueba() {
  console.log('🔄 Llamando a sincronización con administración...');
  sincronizarConAdministracion();
}

// Función para cargar datos desde localStorage
function cargarDatos() {
  try {
    console.log('Iniciando carga de datos...');
    console.log('Elemento #categorias existe:', !!document.getElementById('categorias'));
    console.log('Elemento #productosGrid existe:', !!document.getElementById('productosGrid'));
    
    // Cargar mesas activas primero
    const mesasGuardadas = localStorage.getItem('mesasActivas');
    if (mesasGuardadas) {
      try {
        const mesasArray = JSON.parse(mesasGuardadas);
        mesasActivas = new Map(mesasArray);
        console.log('Mesas activas cargadas:', mesasActivas);
        
        // Verificar que cada mesa tenga sus productos
        mesasActivas.forEach((pedido, mesaId) => {
          if (!pedido.items || !Array.isArray(pedido.items)) {
            console.error(`Mesa ${mesaId} no tiene items o no es un array:`, pedido);
            pedido.items = [];
          }
        });
      } catch (error) {
        console.error('Error al parsear mesas activas:', error);
        mesasActivas = new Map();
      }
    }

    // Cargar historial de ventas
    const historialVentasGuardado = localStorage.getItem('historialVentas');
    if (historialVentasGuardado) {
      try {
        historialVentas = JSON.parse(historialVentasGuardado);
        if (!Array.isArray(historialVentas)) {
          console.error('Error: historialVentas no es un array');
          historialVentas = [];
        }
      } catch (error) {
        console.error('Error al parsear historial de ventas:', error);
        historialVentas = [];
      }
    }
    
    // Cargar otros datos
    const productosGuardados = localStorage.getItem('productos');
    const categoriasGuardadas = localStorage.getItem('categorias');
    const ordenesCocinaGuardadas = localStorage.getItem('ordenesCocina');
    const clientesGuardados = localStorage.getItem('clientes');
    const contadorDomiciliosGuardado = localStorage.getItem('contadorDomicilios');
    const contadorRecogerGuardado = localStorage.getItem('contadorRecoger');
    const historialCocinaGuardado = localStorage.getItem('historialCocina');
    const cotizacionesGuardadas = localStorage.getItem('cotizaciones');
    
    if (productosGuardados) {
      try {
        productos = JSON.parse(productosGuardados);
      } catch (error) {
        console.error('Error al parsear productos:', error);
        productos = [];
      }
    }
    
    if (categoriasGuardadas) {
      try {
        categorias = JSON.parse(categoriasGuardadas);
      } catch (error) {
        console.error('Error al parsear categorías:', error);
        categorias = [];
      }
    }

    if (ordenesCocinaGuardadas) {
      try {
        const ordenesArray = JSON.parse(ordenesCocinaGuardadas);
        ordenesCocina = new Map(ordenesArray);
        console.log('Órdenes de cocina cargadas:', ordenesCocina);
        
        // Restaurar el estado de los productos en cocina en las mesas activas
        ordenesCocina.forEach((productos, mesaId) => {
          if (mesasActivas.has(mesaId)) {
            const pedido = mesasActivas.get(mesaId);
            if (!pedido.items) {
              pedido.items = [];
            }
            
            // Asegurarse de que todos los productos de cocina estén en la mesa
            productos.forEach(productoCocina => {
              const productoExistente = pedido.items.find(item => item.id === productoCocina.id);
              if (productoExistente) {
                productoExistente.estado = 'en_cocina';
              } else {
                // Si el producto no existe en la mesa, agregarlo
                pedido.items.push({
                  ...productoCocina,
                  estado: 'en_cocina'
                });
              }
            });
          }
        });
      } catch (error) {
        console.error('Error al parsear órdenes de cocina:', error);
        ordenesCocina = new Map();
      }
    }

    if (clientesGuardados) {
      try {
        clientes = JSON.parse(clientesGuardados);
        if (!Array.isArray(clientes)) {
          console.error('Error: clientes no es un array');
          clientes = [];
        }
      } catch (error) {
        console.error('Error al parsear clientes:', error);
        clientes = [];
      }
    }

    if (contadorDomiciliosGuardado) {
      contadorDomicilios = parseInt(contadorDomiciliosGuardado);
    }

    if (contadorRecogerGuardado) {
      contadorRecoger = parseInt(contadorRecogerGuardado);
    }

    if (historialCocinaGuardado) {
      try {
        historialCocina = JSON.parse(historialCocinaGuardado);
        if (!Array.isArray(historialCocina)) {
          console.error('Error: historialCocina no es un array');
          historialCocina = [];
        }
      } catch (error) {
        console.error('Error al parsear historial de cocina:', error);
        historialCocina = [];
      }
    }

    if (cotizacionesGuardadas) {
      try {
        cotizaciones = JSON.parse(cotizacionesGuardadas);
      } catch (error) {
        console.error('Error al parsear cotizaciones:', error);
        cotizaciones = [];
      }
    }
    
    console.log('Datos cargados exitosamente');
    console.log('Estado final de mesas:', Array.from(mesasActivas.entries()));
    
    // Inicializar datos de prueba si no existen
    inicializarDatosPrueba();
    
    // Asegurar que los elementos estén disponibles antes de mostrar productos
    setTimeout(() => {
      console.log('Mostrando productos después de timeout...');
      mostrarProductos();
      actualizarMesasActivas();
    }, 100);
  } catch (error) {
    console.error('Error general al cargar datos:', error);
  }
}

// Función para guardar el estado de las mesas
function guardarMesas() {
  try {
    console.log('Guardando estado de mesas...');
    const mesasArray = Array.from(mesasActivas.entries());
    const ordenesCocinaArray = Array.from(ordenesCocina.entries());
    
    localStorage.setItem('mesasActivas', JSON.stringify(mesasArray));
    localStorage.setItem('ordenesCocina', JSON.stringify(ordenesCocinaArray));
    
    console.log('Estado de mesas guardado exitosamente');
  } catch (error) {
    console.error('Error al guardar estado de mesas:', error);
    alert('Error al guardar el estado de las mesas. Por favor, intente nuevamente.');
  }
}

// Función para actualizar la vista de mesas activas
function actualizarMesasActivas() {
  const container = document.getElementById('mesasContainer');
  container.innerHTML = '';

  mesasActivas.forEach((orden, mesa) => {
    const boton = document.createElement('button');
    
    // Determinar el tipo de botón basado en el ID de la mesa
    if (mesa.startsWith('DOM-')) {
      const numeroDomicilio = mesa.split('-')[1];
      boton.className = `mesa-btn mesa-domicilio ${mesa === mesaSeleccionada ? 'mesa-seleccionada' : ''}`;
      boton.innerHTML = `
        <div style="display: flex; flex-direction: column; align-items: center; justify-content: center;">
          <i class="fas fa-motorcycle" style="margin-top: -10px; margin-bottom: 5px;"></i>
          <span class="mesa-numero" style="font-size: 1.5rem;">D${parseInt(numeroDomicilio)}</span>
        </div>
      `;
    } else if (mesa.startsWith('REC-')) {
      const numeroRecoger = mesa.split('-')[1];
      boton.className = `mesa-btn mesa-recoger ${mesa === mesaSeleccionada ? 'mesa-seleccionada' : ''}`;
      boton.innerHTML = `
        <div style="display: flex; flex-direction: column; align-items: center; justify-content: center;">
          <i class="fas fa-shopping-bag" style="margin-top: -10px; margin-bottom: 5px;"></i>
          <span class="mesa-numero" style="font-size: 1.5rem;">R${parseInt(numeroRecoger)}</span>
        </div>
      `;
    } else {
      boton.className = `mesa-btn mesa-activa ${mesa === mesaSeleccionada ? 'mesa-seleccionada' : ''}`;
      boton.innerHTML = `
        <div style="display: flex; flex-direction: column; align-items: center; justify-content: center;">
          <span class="mesa-numero" style="font-size: 1.5rem;">${mesa}</span>
        </div>
      `;
    }

    boton.onclick = () => seleccionarMesa(mesa);
    container.appendChild(boton);
  });
}

// Función para seleccionar una mesa
function seleccionarMesa(mesa) {
  console.log('Seleccionando mesa:', mesa);
  mesaSeleccionada = mesa;
  document.getElementById('mesaActual').textContent = mesa;
  actualizarMesasActivas();
  actualizarVistaOrden(mesa);
}

// Función para mostrar productos en el panel
function mostrarProductos() {
  console.log('=== DEBUG MOSTRAR PRODUCTOS ===');
  console.log('Categorías disponibles:', categorias);
  console.log('Productos disponibles:', productos);
  console.log('Longitud de categorías:', categorias.length);
  console.log('Longitud de productos:', productos.length);
  
  const categoriasDiv = document.getElementById('categorias');
  console.log('Elemento #categorias encontrado:', !!categoriasDiv);
  if (!categoriasDiv) {
    console.error('No se encontró el elemento #categorias');
    console.log('Elementos con ID que contienen "categoria":', document.querySelectorAll('[id*="categoria"]'));
    console.log('Todos los elementos con ID:', Array.from(document.querySelectorAll('[id]')).map(el => el.id));
    return;
  }
  
  // Verificar si el elemento está oculto
  console.log('Estilo del elemento #categorias:', {
    display: categoriasDiv.style.display,
    visibility: categoriasDiv.style.visibility,
    opacity: categoriasDiv.style.opacity,
    position: categoriasDiv.style.position,
    zIndex: categoriasDiv.style.zIndex
  });
  
  categoriasDiv.innerHTML = '';
  
  if (categorias.length === 0) {
    console.log('No hay categorías disponibles');
    categoriasDiv.innerHTML = '<p class="text-muted">No hay categorías disponibles</p>';
    return;
  }
  
  console.log('Creando botones de categorías...');
  
  // Agregar botón "Todos los Productos" al principio
  const botonTodos = document.createElement('button');
  botonTodos.classList.add('btn', 'btn-success', 'mb-2', 'w-100', 'fw-bold');
  botonTodos.innerHTML = '<i class="fas fa-th-large me-2"></i>Todos los Productos';
  botonTodos.onclick = () => mostrarTodosLosProductos();
  categoriasDiv.appendChild(botonTodos);
  console.log('Botón "Todos los Productos" creado');
  
  // Agregar separador visual
  const separador = document.createElement('hr');
  separador.className = 'my-3 border-info';
  categoriasDiv.appendChild(separador);
  
  // Crear botones para cada categoría
  categorias.forEach((categoria, index) => {
    console.log(`Creando botón para categoría ${index + 1}:`, categoria);
    const botonCategoria = document.createElement('button');
    botonCategoria.classList.add('btn', 'btn-info', 'mb-2', 'w-100');
    botonCategoria.textContent = categoria;
    botonCategoria.onclick = () => filtrarProductosPorCategoria(categoria);
    categoriasDiv.appendChild(botonCategoria);
    console.log(`Botón creado y agregado para:`, categoria);
  });
  console.log('Total de botones creados:', categoriasDiv.children.length);
  
  // Verificar que los botones se crearon correctamente
  const botonesCreados = categoriasDiv.querySelectorAll('button');
  console.log('Botones verificados en DOM:', botonesCreados.length);
  botonesCreados.forEach((boton, index) => {
    console.log(`Botón ${index + 1}:`, boton.textContent, boton.className);
  });
}

// Función de debug para verificar el estado (se puede llamar desde la consola)
function debugEstado() {
  console.log('=== DEBUG ESTADO COMPLETO ===');
  console.log('Variables globales:');
  console.log('- categorias:', categorias);
  console.log('- productos:', productos);
  console.log('- mesaSeleccionada:', mesaSeleccionada);
  
  console.log('Elementos DOM:');
  console.log('- #categorias:', document.getElementById('categorias'));
  console.log('- #productosGrid:', document.getElementById('productosGrid'));
  console.log('- #ordenCuerpo:', document.getElementById('ordenCuerpo'));
  
  console.log('localStorage:');
  console.log('- categorias:', localStorage.getItem('categorias'));
  console.log('- productos:', localStorage.getItem('productos'));
  
  console.log('Estado de elementos:');
  const categoriasDiv = document.getElementById('categorias');
  if (categoriasDiv) {
    console.log('- Hijos de #categorias:', categoriasDiv.children.length);
    console.log('- HTML de #categorias:', categoriasDiv.innerHTML);
    console.log('- Estilo display:', categoriasDiv.style.display);
    console.log('- Estilo visibility:', categoriasDiv.style.visibility);
  }
  
  const productosGrid = document.getElementById('productosGrid');
  if (productosGrid) {
    console.log('- Hijos de #productosGrid:', productosGrid.children.length);
    console.log('- HTML de #productosGrid:', productosGrid.innerHTML);
    console.log('- Estilo display:', productosGrid.style.display);
    console.log('- Estilo visibility:', productosGrid.style.visibility);
  }
  
  console.log('Verificación de funciones:');
  console.log('- mostrarProductos es función:', typeof mostrarProductos);
  console.log('- filtrarProductosPorCategoria es función:', typeof filtrarProductosPorCategoria);
  console.log('- mostrarProductosFiltrados es función:', typeof mostrarProductosFiltrados);
  
  // Verificar si hay errores en la consola
  console.log('=== VERIFICACIÓN DE ERRORES ===');
  try {
    mostrarProductos();
    console.log('✅ mostrarProductos() ejecutado sin errores');
  } catch (error) {
    console.error('❌ Error en mostrarProductos():', error);
  }
  
  try {
    if (categorias.length > 0) {
      filtrarProductosPorCategoria(categorias[0]);
      console.log('✅ filtrarProductosPorCategoria() ejecutado sin errores');
    }
  } catch (error) {
    console.error('❌ Error en filtrarProductosPorCategoria():', error);
  }
}

// Función para forzar la recarga de datos (se puede llamar desde la consola)
function recargarDatos() {
  console.log('=== RECARGANDO DATOS ===');
  
  // Limpiar localStorage
  localStorage.removeItem('categorias');
  localStorage.removeItem('productos');
  
  // Limpiar variables globales
  categorias = [];
  productos = [];
  
  // Reinicializar
  inicializarDatosPrueba();
  
  // Forzar la recarga del DOM
  setTimeout(() => {
    mostrarProductos();
    console.log('Datos recargados. Estado actual:');
    debugEstado();
  }, 200);
}

// Función para reiniciar completamente el sistema
function reiniciarSistema() {
  console.log('=== REINICIANDO SISTEMA COMPLETO ===');
  
  // Limpiar todo el localStorage
  localStorage.clear();
  
  // Limpiar variables globales
  categorias = [];
  productos = [];
  mesasActivas = new Map();
  mesaSeleccionada = null;
  ordenesCocina = new Map();
  clientes = [];
  historialVentas = [];
  historialCocina = [];
  
  // Reinicializar desde cero
  inicializarDatosPrueba();
  
  // Recargar la página después de un delay
  setTimeout(() => {
    console.log('Reiniciando página...');
    window.location.reload();
  }, 1000);
}

// Función para verificar acceso (requerida por POS.html)
function verificarAcceso() {
  console.log('Verificando acceso...');
  // Por ahora, permitir acceso directo
  return true;
}

// Función para mostrar todos los productos
function mostrarTodosLosProductos() {
  console.log('Mostrando todos los productos...');
  console.log('Total de productos:', productos.length);
  mostrarProductosFiltrados(productos);
}

// Función para filtrar productos por categoría
function filtrarProductosPorCategoria(categoria) {
  console.log('Filtrando productos por categoría:', categoria);
  console.log('Productos totales:', productos);
  const productosFiltrados = productos.filter(p => p.categoria === categoria);
  console.log('Productos filtrados:', productosFiltrados);
  mostrarProductosFiltrados(productosFiltrados);
}

// Función para formatear precio (sin decimales)
function formatearPrecio(precio) {
  const numero = Math.round(precio);
  return `$ ${formatearNumero(numero)}`;
}

// Función para formatear precio con decimales (para recibos)
function formatearPrecioRecibo(precio) {
  const numero = Math.round(precio);
  return formatearNumero(numero);
}

// Función para mostrar los productos filtrados
function mostrarProductosFiltrados(productosFiltrados) {
  const tablaOrden = document.getElementById('ordenCuerpo');
  const productosGrid = document.getElementById('productosGrid');
  tablaOrden.innerHTML = '';
  
  // Mostrar indicador de carga
  if (productosGrid) {
    productosGrid.innerHTML = '<div class="col-12 productos-loading">Cargando productos...</div>';
  }
  
  // Simular un pequeño delay para mejor UX
  setTimeout(() => {
    if (productosGrid) productosGrid.innerHTML = '';

    if (productosFiltrados.length === 0) {
      tablaOrden.innerHTML = '<tr><td colspan="3" class="text-center">No hay productos en esta categoría</td></tr>';
      if (productosGrid) {
        productosGrid.innerHTML = '<div class="col-12 text-center py-4"><i class="fas fa-box-open fa-3x text-muted mb-3"></i><p class="text-muted">No hay productos disponibles en esta categoría</p></div>';
      }
      return;
    }

    // Configurar visualización como cuadrícula
    // if (tablaOrden) tablaOrden.style.display = 'none'; // Comentado para mantener visible la tabla de la orden
    if (productosGrid) productosGrid.style.display = '';

    // Encabezado removido - solo se muestran los productos directamente
    // const encabezado = document.createElement('div');
    // encabezado.className = 'col-12 mb-3';
    
    // if (productosFiltrados.length === productos.length) {
    //   // Mostrando todos los productos
    //   encabezado.innerHTML = `
    //     <div class="alert alert-success text-center">
    //       <h5 class="mb-2"><i class="fas fa-th-large me-2"></i>Todos los Productos</h5>
    //       <p class="mb-0">Vista completa de ${productosFiltrados.length} productos disponibles</p>
    //     </div>
    //   `;
    // } else {
    //   // Mostrando productos filtrados por categoría
    //   const categoria = productosFiltrados[0]?.categoria || 'Categoría';
    //   encabezado.innerHTML = `
    //     <div class="alert alert-info text-center">
    //       <h5 class="mb-2"><i class="fas fa-filter me-2"></i>${categoria}</h5>
    //       <p class="mb-0">${productosFiltrados.length} productos en esta categoría</p>
    //     </div>
    //   `;
    // }
    
    // productosGrid.appendChild(encabezado);

    productosFiltrados.forEach(producto => {
      // Permite rutas relativas (locales) o URLs externas. Si falla, muestra placeholder universal
      const imagenSrc = producto.imagen && producto.imagen.trim() ? producto.imagen : 'image/placeholder-product.png';
      const col = document.createElement('div');
      col.className = 'col';
      col.innerHTML = `
        <div class="card h-100 text-center border-info shadow-sm">
          <img src="${imagenSrc}" class="card-img-top" alt="Imagen de ${producto.nombre}" onerror="this.onerror=null;this.src='image/placeholder-product.png'" style="object-fit:cover;border-top-left-radius:0.5rem;border-top-right-radius:0.5rem;background:#fff;" />
          <div class="card-body d-flex flex-column justify-content-between">
            <div>
              <h6 class="card-title mb-2" title="${producto.nombre}">${producto.nombre}</h6>
              <p class="card-text text-info fw-bold mb-2">${formatearPrecio(producto.precio)}</p>
              <small class="text-muted">${producto.categoria}</small>
            </div>
            <button class="btn btn-primary btn-sm w-100" onclick="agregarProducto(${producto.id})">
              <i class="fas fa-plus me-1"></i>Agregar
            </button>
          </div>
        </div>
      `;
      productosGrid.appendChild(col);
    });
  }, 100); // Pequeño delay para mejor UX
}



// Función para agregar producto a la orden (ahora abre modal de cantidad)
function agregarProducto(id) {
  if (!mesaSeleccionada) {
    alert('Por favor, seleccione una mesa primero');
    return;
  }

  const producto = productos.find(p => p.id === id);
  if (!producto) {
    console.error('Producto no encontrado:', id);
    alert('Producto no encontrado');
    return;
  }

  // Guardar el producto seleccionado globalmente para el modal
  window.productoSeleccionado = producto;
  
  // Configurar el modal con la información del producto
  document.getElementById('productoImagen').src = producto.imagen || 'image/placeholder-product.png';
  document.getElementById('productoImagen').alt = producto.nombre;
  document.getElementById('productoNombre').textContent = producto.nombre;
  document.getElementById('productoPrecio').textContent = formatearPrecio(producto.precio);
  document.getElementById('cantidadProducto').value = '1';
  document.getElementById('detallesProducto').value = '';
  
  // Calcular y mostrar el total inicial
  actualizarTotalModal();
  
  // Mostrar el modal
  const modal = new bootstrap.Modal(document.getElementById('modalCantidad'));
  modal.show();
}

// Función para cambiar cantidad en el modal
function cambiarCantidadModal(cambio) {
  const input = document.getElementById('cantidadProducto');
  let cantidad = parseInt(input.value) || 1;
  cantidad = Math.max(1, Math.min(99, cantidad + cambio));
  input.value = cantidad;
  actualizarTotalModal();
}

// Función para actualizar el total en el modal
function actualizarTotalModal() {
  const cantidad = parseInt(document.getElementById('cantidadProducto').value) || 1;
  const precio = window.productoSeleccionado ? Number(window.productoSeleccionado.precio) : 0;
  const total = cantidad * precio;
  document.getElementById('totalProducto').textContent = formatearPrecio(total);
}

// Función para confirmar agregar producto con cantidad seleccionada
function confirmarAgregarProducto() {
  if (!window.productoSeleccionado) {
    console.error('No hay producto seleccionado');
    return;
  }

  const producto = window.productoSeleccionado;
  const cantidad = parseInt(document.getElementById('cantidadProducto').value) || 1;
  const detalles = document.getElementById('detallesProducto').value.trim();

  // ========================================
  // VERIFICACIÓN DE DISPONIBILIDAD EN INVENTARIO
  // ========================================
  try {
    if (typeof verificarDisponibilidadProducto === 'function') {
      const disponibilidad = verificarDisponibilidadProducto(producto.nombre, cantidad);
      
      if (!disponibilidad.disponible) {
        const mensaje = `Producto no disponible: ${disponibilidad.mensaje}`;
        console.warn(mensaje);
        
        // Mostrar alerta al usuario
        const alerta = document.createElement('div');
        alerta.className = 'alert alert-warning alert-dismissible fade show position-fixed';
        alerta.style.cssText = 'top: 20px; right: 20px; z-index: 9999; max-width: 400px;';
        alerta.innerHTML = `
          <strong>⚠️ Producto No Disponible</strong>
          <p class="mb-0">${producto.nombre}</p>
          <p class="mb-0 small">${disponibilidad.mensaje}</p>
          <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
        `;
        
        document.body.appendChild(alerta);
        
        // Auto-remover después de 5 segundos
        setTimeout(() => {
          if (alerta.parentNode) {
            alerta.remove();
          }
        }, 5000);
        
        return; // No agregar el producto si no está disponible
      }
    }
  } catch (error) {
    console.error('Error al verificar disponibilidad:', error);
    // Continuar con la venta si hay error en la verificación
  }

  let pedido = mesasActivas.get(mesaSeleccionada);
  if (!pedido) {
    // Si no existe el pedido, crear uno nuevo
    pedido = {
      items: [],
      estado: 'pendiente',
      fecha: new Date().toLocaleString(),
      ronda: 1 // Inicializar la ronda
    };
    mesasActivas.set(mesaSeleccionada, pedido);
  }

  if (!pedido.items) {
    pedido.items = [];
  }

  // Si hay productos en cocina, incrementar la ronda
  if (pedido.items.some(item => item.estado === 'en_cocina')) {
    pedido.ronda = (pedido.ronda || 1) + 1;
  }

  const productoExistente = pedido.items.find(p => p.id === producto.id && p.estado !== 'en_cocina');

  if (productoExistente) {
    // Verificar disponibilidad para la cantidad adicional
    try {
      if (typeof verificarDisponibilidadProducto === 'function') {
        const disponibilidad = verificarDisponibilidadProducto(producto.nombre, productoExistente.cantidad + cantidad);
        
        if (!disponibilidad.disponible) {
          const mensaje = `Stock insuficiente para agregar más unidades: ${disponibilidad.mensaje}`;
          console.warn(mensaje);
          
          // Mostrar alerta al usuario
          const alerta = document.createElement('div');
          alerta.className = 'alert alert-warning alert-dismissible fade show position-fixed';
          alerta.style.cssText = 'top: 20px; right: 20px; z-index: 9999; max-width: 400px;';
          alerta.innerHTML = `
            <strong>⚠️ Stock Insuficiente</strong>
            <p class="mb-0">${producto.nombre}</p>
            <p class="mb-0 small">${disponibilidad.mensaje}</p>
            <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
          `;
          
          document.body.appendChild(alerta);
          
          // Auto-remover después de 5 segundos
          setTimeout(() => {
            if (alerta.parentNode) {
              alerta.remove();
            }
          }, 5000);
          
          return; // No agregar más unidades si no hay stock suficiente
        }
      }
    } catch (error) {
      console.error('Error al verificar disponibilidad para cantidad adicional:', error);
    }
    
    productoExistente.cantidad += cantidad;
    // Si hay detalles, agregarlos al producto existente
    if (detalles && !productoExistente.detalles) {
      productoExistente.detalles = detalles;
    } else if (detalles && productoExistente.detalles) {
      productoExistente.detalles += '; ' + detalles;
    }
  } else {
    pedido.items.push({
      id: producto.id,
      nombre: producto.nombre,
      precio: Number(producto.precio),
      cantidad: cantidad,
      detalles: detalles,
      estado: 'pendiente',
      ronda: pedido.ronda
    });
  }

  console.log('Producto agregado:', producto, 'Cantidad:', cantidad, 'Detalles:', detalles);
  console.log('Orden actual:', pedido);
  
  // Cerrar el modal
  const modal = bootstrap.Modal.getInstance(document.getElementById('modalCantidad'));
  modal.hide();
  
  // Limpiar la variable global
  window.productoSeleccionado = null;
  
  guardarMesas();
  actualizarVistaOrden(mesaSeleccionada);
  
  // Mostrar confirmación visual
  mostrarConfirmacionAgregado(producto.nombre, cantidad);
}

// Función para mostrar confirmación visual de producto agregado
function mostrarConfirmacionAgregado(nombreProducto, cantidad) {
  const confirmacion = document.createElement('div');
  confirmacion.className = 'alert alert-success alert-dismissible fade show position-fixed';
  confirmacion.style.cssText = 'top: 20px; right: 20px; z-index: 9999; max-width: 400px; animation: slideInRight 0.5s ease;';
  confirmacion.innerHTML = `
    <strong>✅ Producto Agregado</strong>
    <p class="mb-0">${nombreProducto}</p>
    <p class="mb-0 small">Cantidad: ${cantidad}</p>
    <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
  `;
  
  document.body.appendChild(confirmacion);
  
  // Auto-remover después de 3 segundos
  setTimeout(() => {
    if (confirmacion.parentNode) {
      confirmacion.style.animation = 'slideOutRight 0.5s ease';
      setTimeout(() => {
        if (confirmacion.parentNode) {
          confirmacion.remove();
        }
      }, 500);
    }
  }, 3000);
}

// Event listeners para el modal de cantidad
document.addEventListener('DOMContentLoaded', function() {
  // Event listener para el input de cantidad
  const cantidadInput = document.getElementById('cantidadProducto');
  if (cantidadInput) {
    cantidadInput.addEventListener('input', actualizarTotalModal);
    cantidadInput.addEventListener('keypress', function(e) {
      if (e.key === 'Enter') {
        confirmarAgregarProducto();
      }
    });
  }
  
  // Event listener para el textarea de detalles
  const detallesInput = document.getElementById('detallesProducto');
  if (detallesInput) {
    detallesInput.addEventListener('keypress', function(e) {
      if (e.key === 'Enter' && e.ctrlKey) {
        confirmarAgregarProducto();
      }
    });
  }
  
  // Event listeners para el modal de venta rápida
  const metodoPagoSelect = document.getElementById('metodoPagoVentaRapida');
  if (metodoPagoSelect) {
    metodoPagoSelect.addEventListener('change', function() {
      const seccionEfectivo = document.getElementById('seccionEfectivoVentaRapida');
      if (this.value === 'efectivo') {
        seccionEfectivo.style.display = 'block';
      } else {
        seccionEfectivo.style.display = 'none';
      }
    });
  }
  
  // Event listener para Enter en monto recibido
  const montoRecibidoInput = document.getElementById('montoRecibidoVentaRapida');
  if (montoRecibidoInput) {
    montoRecibidoInput.addEventListener('keypress', function(e) {
      if (e.key === 'Enter') {
        confirmarVentaRapida();
      }
    });
  }
});

// Función para actualizar la vista de la orden
function actualizarVistaOrden(mesa) {
  console.log('Actualizando vista de orden para mesa:', mesa);
  const ordenCuerpo = document.getElementById('ordenCuerpo');
  ordenCuerpo.innerHTML = '';

  if (!mesasActivas.has(mesa)) {
    console.log('No hay orden para la mesa:', mesa);
    return;
  }

  const pedido = mesasActivas.get(mesa);
  console.log('Orden de la mesa:', pedido);

  // Mostrar/ocultar campo de domicilio
  const domicilioContainer = document.getElementById('domicilioContainer');
  if (mesa.startsWith('DOM-')) {
    domicilioContainer.style.display = 'block';
  } else {
    domicilioContainer.style.display = 'none';
  }

  // Actualizar el título de la orden con el nombre del cliente si es domicilio o recoger
  const mesaActual = document.getElementById('mesaActual');
  if (mesa.startsWith('DOM-')) {
    const cliente = pedido.cliente || 'Cliente no especificado';
    mesaActual.textContent = `Domicilio - ${cliente}`;
  } else if (mesa.startsWith('REC-')) {
    const cliente = pedido.cliente || 'Cliente no especificado';
    mesaActual.textContent = `Recoger - ${cliente}`;
  } else {
    mesaActual.textContent = mesa;
  }

  if (!pedido.items || pedido.items.length === 0) {
    ordenCuerpo.innerHTML = '<tr><td colspan="6" class="text-center">No hay productos en la orden</td></tr>';
    return;
  }

  // Agrupar productos por ronda
  const productosPorRonda = {};
  pedido.items.forEach(item => {
    if (!productosPorRonda[item.ronda]) {
      productosPorRonda[item.ronda] = [];
    }
    productosPorRonda[item.ronda].push(item);
  });

  // Mostrar productos por ronda
  Object.entries(productosPorRonda).forEach(([ronda, items]) => {
    // Agregar encabezado de ronda
    const filaRonda = document.createElement('tr');
    filaRonda.className = 'table-secondary';
    filaRonda.innerHTML = `
      <td colspan="6" class="text-center">
        <strong>Ronda ${ronda}</strong>
        ${items.some(item => item.estado === 'en_cocina') ? 
          '<span class="badge bg-success ms-2">En Cocina</span>' : ''}
      </td>
    `;
    ordenCuerpo.appendChild(filaRonda);

    // Mostrar productos de esta ronda
    items.forEach(item => {
      const fila = document.createElement('tr');
      fila.className = item.estado === 'en_cocina' ? 'table-success' : '';
      fila.innerHTML = `
        <td style="width: 30%">${item.nombre}</td>
        <td style="width: 12%">
          <div class="input-group input-group-sm">
            <button class="btn btn-outline-light btn-sm px-1" onclick="cambiarCantidad(${item.id}, '${mesa}', -1)">-</button>
            <input type='number' class='form-control form-control-sm bg-dark text-white border-light text-center' 
                   value='${item.cantidad}' min='1'
                   style="width: 40px;"
                   onchange='actualizarCantidad(this, ${item.id}, "${mesa}")' />
            <button class="btn btn-outline-light btn-sm px-1" onclick="cambiarCantidad(${item.id}, '${mesa}', 1)">+</button>
          </div>
        </td>
        <td style="width: 12%">${formatearPrecio(item.precio)}</td>
        <td style="width: 12%">${formatearPrecio(item.precio * item.cantidad)}</td>
        <td style="width: 31%">
          <input type='text' class='form-control form-control-sm bg-dark text-white border-light' 
                 value='${item.detalles || ''}' 
                 placeholder='Ej: Sin lechuga, sin salsa...'
                 onchange='actualizarDetalles(this, ${item.id}, "${mesa}")' />
        </td>
        <td style="width: 3%">
          <button class='btn btn-danger btn-sm' onclick='eliminarProductoOrden(this, "${mesa}")'>
            <i class="fas fa-trash"></i>
          </button>
        </td>
      `;
      ordenCuerpo.appendChild(fila);
    });
  });

  actualizarTotal(mesa);
}

// Función para cambiar cantidad con botones + y -
function cambiarCantidad(id, mesa, cambio) {
  const pedido = mesasActivas.get(mesa);
  if (!pedido || !pedido.items) return;

  const producto = pedido.items.find(p => p.id === id);
  if (producto) {
    const nuevaCantidad = producto.cantidad + cambio;
    if (nuevaCantidad >= 1) {
      producto.cantidad = nuevaCantidad;
      guardarMesas();
      actualizarVistaOrden(mesa);
    }
  }
}

// Función para actualizar cantidad
function actualizarCantidad(input, id, mesa) {
  const cantidad = parseInt(input.value);
  if (isNaN(cantidad) || cantidad < 1) {
    input.value = 1;
    return;
  }

  const pedido = mesasActivas.get(mesa);
  if (!pedido || !pedido.items) return;

  const producto = pedido.items.find(p => p.id === id);
  if (producto) {
    producto.cantidad = cantidad;
    guardarMesas();
    actualizarVistaOrden(mesa);
  }
}

// Función para actualizar detalles del producto
function actualizarDetalles(input, id, mesa) {
  const detalles = input.value.trim();
  const pedido = mesasActivas.get(mesa);
  
  if (!pedido || !pedido.items) return;
  
  const producto = pedido.items.find(p => p.id === id);
  if (producto) {
    producto.detalles = detalles;
    guardarMesas();
  }
}

// Función para eliminar producto de la orden
function eliminarProductoOrden(boton, mesa) {
  const fila = boton.closest('tr');
  const nombreProducto = fila.cells[0].textContent;
  const pedido = mesasActivas.get(mesa);
  
  if (!pedido || !pedido.items) return;
  
  const index = pedido.items.findIndex(p => p.nombre === nombreProducto);
  if (index !== -1) {
    pedido.items.splice(index, 1);
    guardarMesas();
    actualizarVistaOrden(mesa);
  }
}

// Función para actualizar el total
function actualizarTotal(mesa) {
  if (!mesasActivas.has(mesa)) return;

  const pedido = mesasActivas.get(mesa);
  if (!pedido || !pedido.items) return;

  let subtotal = pedido.items.reduce((sum, item) => sum + (item.precio * item.cantidad), 0);
  
  const propina = parseFloat(document.getElementById('propina').value) || 0;
  const descuento = parseFloat(document.getElementById('descuento').value) || 0;
  const valorDomicilio = mesa.startsWith('DOM-') ? (parseFloat(document.getElementById('valorDomicilio').value) || 0) : 0;
  
  pedido.propina = propina;
  pedido.descuento = descuento;
  pedido.valorDomicilio = valorDomicilio;
  
  const propinaMonto = Math.round((subtotal * propina) / 100);
  const total = Math.round(subtotal + propinaMonto - descuento + valorDomicilio);
  
  document.getElementById('totalOrden').textContent = formatearPrecio(total);
  
  const desglose = document.getElementById('desgloseTotal');
  if (desglose) {
    desglose.innerHTML = `
      <div class="small text-muted">
        <div>Subtotal: ${formatearPrecio(subtotal)}</div>
        <div>Propina (${propina}%): ${formatearPrecio(propinaMonto)}</div>
        <div>Descuento: ${formatearPrecio(descuento)}</div>
        ${valorDomicilio > 0 ? `<div>Domicilio: ${formatearPrecio(valorDomicilio)}</div>` : ''}
      </div>
    `;
  }
  
  guardarMesas();
}

// Función para enviar a cocina
function enviarACocina() {
  if (!mesaSeleccionada || !mesasActivas.has(mesaSeleccionada)) {
    alert('Por favor, seleccione una mesa con productos');
    return;
  }

  const pedido = mesasActivas.get(mesaSeleccionada);
  if (!pedido || !pedido.items || pedido.items.length === 0) {
    alert('No hay productos para enviar a cocina');
    return;
  }

  // Filtrar solo los productos que no han sido enviados a cocina
  const productosNuevos = pedido.items.filter(item => item.estado !== 'en_cocina');
  
  if (productosNuevos.length === 0) {
    alert('No hay nuevos productos para enviar a cocina');
    return;
  }

  // Marcar productos nuevos como enviados a cocina
  productosNuevos.forEach(item => {
    item.estado = 'en_cocina';
  });

  // Guardar orden en cocina
  ordenesCocina.set(mesaSeleccionada, productosNuevos);
  
  // Agregar al historial de cocina
  const ordenCocina = {
    id: Date.now(),
    fecha: new Date().toLocaleString(),
    mesa: mesaSeleccionada,
    items: productosNuevos,
    cliente: pedido.cliente || null,
    telefono: pedido.telefono || null,
    direccion: pedido.direccion || null,
    horaRecoger: pedido.horaRecoger || null,
    ronda: pedido.ronda || 1
  };
  
  historialCocina.push(ordenCocina);
  guardarHistorialCocina();
  guardarMesas();

  // Actualizar la vista de la orden para mostrar el estado "En Cocina"
  actualizarVistaOrden(mesaSeleccionada);
  
  // Mostrar confirmación de que se envió a cocina
  mostrarConfirmacionEnviadoACocina(productosNuevos.length);
  
  // Mostrar inmediatamente la vista previa del ticket de cocina para imprimir
  imprimirTicketCocina(mesaSeleccionada, productosNuevos);
}

// Función para mostrar confirmación de productos enviados a cocina
function mostrarConfirmacionEnviadoACocina(cantidadProductos) {
  const confirmacion = document.createElement('div');
  confirmacion.className = 'alert alert-success alert-dismissible fade show position-fixed';
  confirmacion.style.cssText = 'top: 20px; right: 20px; z-index: 9999; max-width: 400px; animation: slideInRight 0.5s ease;';
  confirmacion.innerHTML = `
    <strong>✅ Enviado a Cocina</strong>
    <p class="mb-0">${cantidadProductos} producto${cantidadProductos > 1 ? 's' : ''} enviado${cantidadProductos > 1 ? 's' : ''} a cocina</p>
    <p class="mb-0 small">Los productos ahora aparecen como "En Cocina"</p>
    <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
  `;
  
  document.body.appendChild(confirmacion);
  
  // Auto-remover después de 4 segundos
  setTimeout(() => {
    if (confirmacion.parentNode) {
      confirmacion.style.animation = 'slideOutRight 0.5s ease';
      setTimeout(() => {
        if (confirmacion.parentNode) {
          confirmacion.remove();
        }
      }, 500);
    }
  }, 4000);
}

// Función para venta rápida (productos listos)
function ventaRapida() {
  // Crear un pedido temporal para venta rápida sin mesa
  let pedido = {
    items: [],
    cliente: null,
    telefono: null,
    direccion: null,
    horaRecoger: null,
    tipo: 'venta_rapida'
  };

  // Mostrar modal para agregar productos directamente
  mostrarModalAgregarProductosVentaRapida(pedido);
}

// Función para procesar venta rápida (eliminada - duplicada)
// La función correcta está más adelante en el código

// Función para mostrar recibo de venta rápida
function mostrarReciboVentaRapida(venta) {
  const ventanaRecibo = window.open('', '_blank', 'width=400,height=600,scrollbars=yes');
  if (!ventanaRecibo) {
    alert('No se pudo abrir la ventana de impresión. Por favor, verifique que los bloqueadores de ventanas emergentes estén desactivados.');
    return;
  }

  // Obtener el logo del negocio si existe
  const logoNegocio = localStorage.getItem('logoNegocio');
  
  ventanaRecibo.document.open();
  ventanaRecibo.document.write(`
    <!DOCTYPE html>
    <html>
      <head>
        <title>Recibo - Venta Rápida</title>
        <meta charset="UTF-8">
        <style>
          body { 
            font-family: monospace;
            font-size: 14px;
            width: 57mm;
            margin: 0;
            padding: 1mm;
          }
          .text-center { text-align: center; }
          .text-right { text-align: right; }
          .mb-1 { margin-bottom: 0.5mm; }
          .mt-1 { margin-top: 0.5mm; }
          table { 
            width: 100%;
            border-collapse: collapse;
            margin: 1mm 0;
            font-size: 14px;
          }
          th, td { 
            padding: 0.5mm;
            text-align: left;
            font-size: 14px;
          }
          .border-top { 
            border-top: 1px dashed #000;
            margin-top: 1mm;
            padding-top: 1mm;
          }
          .header {
            border-bottom: 1px dashed #000;
            padding-bottom: 1mm;
            margin-bottom: 1mm;
          }
          .total-row {
            font-weight: bold;
            font-size: 16px;
          }
          .botones-impresion {
            position: fixed;
            top: 10px;
            right: 10px;
            z-index: 1000;
            background: #fff;
            padding: 5px;
            border-radius: 5px;
            box-shadow: 0 2px 5px rgba(0,0,0,0.2);
          }
          .botones-impresion button {
            margin: 0 5px;
            padding: 5px 10px;
            background: #007bff;
            color: white;
            border: none;
            border-radius: 3px;
            cursor: pointer;
          }
          .botones-impresion button:hover {
            background: #0056b3;
          }
          .logo-container {
            text-align: center;
            margin-bottom: 2mm;
          }
          .logo-container img {
            max-width: 100%;
            max-height: 120px;
          }
          @media print {
            .botones-impresion {
              display: none;
            }
            @page {
              margin: 0;
              size: 57mm auto;
            }
            body {
              width: 57mm;
            }
          }
        </style>
      </head>
      <body>
        <div class="botones-impresion">
          <button onclick="window.print()">Imprimir</button>
          <button onclick="window.close()">Cerrar</button>
        </div>
        
        <div class="logo-container">
          ${logoNegocio ? `<img src="${logoNegocio}" alt="Logo">` : ''}
        </div>

        <div class="header text-center">
          <h2 style="margin: 0; font-size: 14px;">RESTAURANTE</h2>
          <div class="mb-1">VENTA RÁPIDA</div>
          <div class="mb-1">${new Date().toLocaleString()}</div>
          <div class="mb-1">${venta.mesa === 'VENTA DIRECTA' ? 'Venta Directa' : `Mesa: ${venta.mesa}`}</div>
        </div>
        
        <table>
          <thead>
            <tr>
              <th style="width: 40%">Producto</th>
              <th style="width: 15%">Cant</th>
              <th style="width: 20%">Precio</th>
              <th style="width: 25%">Total</th>
            </tr>
          </thead>
          <tbody>
            ${venta.items.map(item => `
              <tr>
                <td><strong>${item.nombre}</strong></td>
                <td>${item.cantidad}</td>
                <td class="text-right">${formatearNumero(item.precio)}</td>
                <td class="text-right">${formatearNumero(item.precio * item.cantidad)}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
        
        <div class="border-top">
          <div class="mb-1">Subtotal: <span class="text-right">$ ${formatearNumero(venta.subtotal)}</span></div>
          <div class="mb-1">Propina (${venta.propina}%): <span class="text-right">$ ${formatearNumero((venta.subtotal * venta.propina) / 100)}</span></div>
          <div class="mb-1">Descuento: <span class="text-right">$ ${formatearNumero(venta.descuento)}</span></div>
          ${venta.valorDomicilio > 0 ? `<div class="mb-1">Domicilio: <span class="text-right">$ ${formatearNumero(venta.valorDomicilio)}</span></div>` : ''}
          <div class="mb-1 total-row"><strong>Total: $ ${formatearNumero(venta.total)}</strong></div>
        </div>
        
        <div class="border-top">
          <div class="mb-1">Método de Pago: ${venta.metodoPago.toUpperCase()}</div>
          ${venta.metodoPago === 'efectivo' ? `
            <div class="mb-1">Recibido en Efectivo: $ ${formatearNumero(venta.montoRecibido)}</div>
            <div class="mb-1">Cambio: $ ${formatearNumero(venta.cambio)}</div>
          ` : ''}
          ${venta.metodoPago === 'transferencia' ? `
            <div class="mb-1">N° Transferencia: ${venta.numeroTransferencia || 'N/A'}</div>
            <div class="mb-1">Transferencia: $ ${formatearNumero(venta.montoTransferencia || 0)}</div>
          ` : ''}
          ${venta.metodoPago === 'mixto' ? `
            <div class="mb-1">Monto en Efectivo: $ ${formatearNumero(venta.montoRecibido)}</div>
            <div class="mb-1">Cambio: $ ${formatearNumero(venta.cambio)}</div>
            <div class="mb-1">N° Transferencia: ${venta.numeroTransferencia || 'N/A'}</div>
            <div class="mb-1">Transferencia: $ ${formatearNumero(venta.montoTransferencia || 0)}</div>
          ` : ''}
        </div>
        
        <div class="border-top text-center">
          <div class="mb-1">¡Gracias por su compra!</div>
          <div class="mb-1">Productos listos - Venta rápida</div>
          <div class="mb-1">ToySoft POS</div>
        </div>
      </body>
    </html>
  `);
  
  ventanaRecibo.document.close();
}

// Función para mostrar modal de agregar productos venta rápida
function mostrarModalAgregarProductosVentaRapida(pedido) {
  // Guardar el pedido en variable global
  window.pedidoVentaRapida = pedido;
  
  // Cargar categorías
  cargarCategoriasVentaRapida();
  
  // Mostrar modal
  const modal = new bootstrap.Modal(document.getElementById('modalAgregarProductosVentaRapida'));
  modal.show();
  
  // Agregar evento de tecla F1 para ayuda
  document.addEventListener('keydown', mostrarAyudaVentaRapida);
}

// Función para mostrar ayuda de venta rápida con F1
function mostrarAyudaVentaRapida(event) {
  if (event.key === 'F1') {
    event.preventDefault();
    
    const ayudaHTML = `
      <div class="alert alert-info border-info">
        <h6><i class="fas fa-info-circle me-2"></i>Ayuda - Venta Rápida</h6>
        <ul class="mb-0">
          <li><strong>Venta Directa:</strong> Agrega productos listos para venta inmediata sin mesa</li>
          <li><strong>Botón "Todos":</strong> Muestra todos los productos disponibles</li>
          <li><strong>Categorías:</strong> Filtra productos por tipo</li>
          <li><strong>Agregar:</strong> Haz clic en "+ Agregar" para incluir productos</li>
          <li><strong>Procesar:</strong> Completa la venta y genera el recibo</li>
        </ul>
        <small class="text-muted">Presiona F1 nuevamente para cerrar esta ayuda</small>
      </div>
    `;
    
    // Mostrar ayuda en el modal
    const modalBody = document.querySelector('#modalAgregarProductosVentaRapida .modal-body');
    const ayudaExistente = modalBody.querySelector('.ayuda-venta-rapida');
    
    if (ayudaExistente) {
      ayudaExistente.remove();
    } else {
      const ayudaDiv = document.createElement('div');
      ayudaDiv.className = 'ayuda-venta-rapida mb-3';
      ayudaDiv.innerHTML = ayudaHTML;
      modalBody.insertBefore(ayudaDiv, modalBody.firstChild);
    }
  }
}

// Función para cargar categorías en venta rápida
function cargarCategoriasVentaRapida() {
  const categoriasContainer = document.getElementById('categoriasVentaRapida');
  categoriasContainer.innerHTML = '';
  
  // Obtener categorías únicas de productos
  const categoriasUnicas = [...new Set(productos.map(p => p.categoria))];
  
  // Agregar botón "Todos los Productos" al principio
  const botonTodos = document.createElement('button');
  botonTodos.className = 'btn btn-success btn-sm fw-bold';
  botonTodos.innerHTML = '<i class="fas fa-th-large me-1"></i>Todos';
  botonTodos.onclick = () => mostrarTodosLosProductosVentaRapida();
  categoriasContainer.appendChild(botonTodos);
  
  // Agregar separador visual
  const separador = document.createElement('hr');
  separador.className = 'my-2 border-info';
  categoriasContainer.appendChild(separador);
  
  // Crear botones para cada categoría
  categoriasUnicas.forEach(categoria => {
    const btn = document.createElement('button');
    btn.className = 'btn btn-outline-info btn-sm';
    btn.textContent = categoria;
    btn.onclick = () => mostrarProductosCategoriaVentaRapida(categoria);
    categoriasContainer.appendChild(btn);
  });
  
  // Mostrar todos los productos por defecto
  mostrarTodosLosProductosVentaRapida();
}

// Función para mostrar todos los productos en venta rápida
function mostrarTodosLosProductosVentaRapida() {
  const productosContainer = document.getElementById('productosVentaRapida');
  productosContainer.innerHTML = '';
  
  // Encabezado removido - solo se muestran los productos directamente
  // const encabezado = document.createElement('div');
  // encabezado.className = 'col-12 mb-3';
  // encabezado.innerHTML = `
  //   <div class="alert alert-success text-center py-2">
  //     <h6 class="mb-1"><i class="fas fa-th-large me-2"></i>Todos los Productos</h6>
  //     <small class="mb-0">Vista completa de ${productos.length} productos disponibles</small>
  //   </div>
  // `;
  // productosContainer.appendChild(encabezado);
  
  // Mostrar todos los productos
  productos.forEach(producto => {
    // Permite rutas relativas (locales) o URLs externas. Si falla, muestra placeholder universal
    const imagenSrc = producto.imagen && producto.imagen.trim() ? producto.imagen : 'image/placeholder-product.png';
    const col = document.createElement('div');
    col.className = 'col';
    col.innerHTML = `
      <div class="card h-100 text-center border-info shadow-sm">
        <img src="${imagenSrc}" class="card-img-top" alt="Imagen de ${producto.nombre}" onerror="this.onerror=null;this.src='image/placeholder-product.png'" style="object-fit:cover;border-top-left-radius:0.5rem;border-top-right-radius:0.5rem;background:#fff;" />
        <div class="card-body d-flex flex-column justify-content-between">
          <div>
            <h6 class="card-title mb-2" title="${producto.nombre}">${producto.nombre}</h6>
            <p class="card-text text-info fw-bold mb-2">${formatearPrecio(producto.precio)}</p>
            <small class="text-muted">${producto.categoria}</small>
          </div>
          <button class="btn btn-primary btn-sm w-100" onclick="agregarProductoVentaRapida(${producto.id})">
            <i class="fas fa-plus me-1"></i>Agregar
          </button>
        </div>
      </div>
    `;
    productosContainer.appendChild(col);
  });
}

// Función para mostrar productos de una categoría en venta rápida
function mostrarProductosCategoriaVentaRapida(categoria) {
  const productosContainer = document.getElementById('productosVentaRapida');
  productosContainer.innerHTML = '';
  
  // Encabezado removido - solo se muestran los productos directamente
  // const encabezado = document.createElement('div');
  // encabezado.className = 'col-12 mb-3';
  // encabezado.innerHTML = `
  //   <div class="alert alert-info text-center py-2">
  //     <h6 class="mb-1"><i class="fas fa-filter me-2"></i>${categoria}</h6>
  //     <small class="mb-0">${productos.filter(p => p.categoria === categoria).length} productos en esta categoría</small>
  //   </div>
  // `;
  // productosContainer.appendChild(encabezado);
  
  const productosFiltrados = productos.filter(p => p.categoria === categoria);
  
  productosFiltrados.forEach(producto => {
    // Permite rutas relativas (locales) o URLs externas. Si falla, muestra placeholder universal
    const imagenSrc = producto.imagen && producto.imagen.trim() ? producto.imagen : 'image/placeholder-product.png';
    const col = document.createElement('div');
    col.className = 'col';
    col.innerHTML = `
      <div class="card h-100 text-center border-info shadow-sm">
        <img src="${imagenSrc}" class="card-img-top" alt="Imagen de ${producto.nombre}" onerror="this.onerror=null;this.src='image/placeholder-product.png'" style="object-fit:cover;border-top-left-radius:0.5rem;border-top-right-radius:0.5rem;background:#fff;" />
        <div class="card-body d-flex flex-column justify-content-between">
          <div>
            <h6 class="card-title mb-2" title="${producto.nombre}">${producto.nombre}</h6>
            <p class="card-text text-info fw-bold mb-2">${formatearPrecio(producto.precio)}</p>
            <small class="text-muted">${producto.categoria}</small>
          </div>
          <button class="btn btn-primary btn-sm w-100" onclick="agregarProductoVentaRapida(${producto.id})">
            <i class="fas fa-plus me-1"></i>Agregar
          </button>
        </div>
      </div>
    `;
    productosContainer.appendChild(col);
  });
}

// Función para agregar producto a venta rápida
function agregarProductoVentaRapida(productoId) {
  const producto = productos.find(p => p.id === productoId);
  if (!producto) return;
  
  // Buscar si ya existe en el pedido
  const itemExistente = window.pedidoVentaRapida.items.find(item => item.id === productoId);
  
  if (itemExistente) {
    itemExistente.cantidad += 1;
  } else {
    window.pedidoVentaRapida.items.push({
      id: producto.id,
      nombre: producto.nombre,
      precio: producto.precio,
      cantidad: 1,
      estado: 'listo'
    });
  }
  
  actualizarListaProductosVentaRapida();
  actualizarTotalVentaRapida();
}

// Función para actualizar lista de productos en venta rápida
function actualizarListaProductosVentaRapida() {
  const listaContainer = document.getElementById('listaProductosVentaRapida');
  const items = window.pedidoVentaRapida.items;
  
  if (items.length === 0) {
    listaContainer.innerHTML = '<p class="text-white text-center">No hay productos agregados</p>';
    return;
  }
  
  let html = '';
  items.forEach((item, index) => {
    html += `
      <div class="d-flex justify-content-between align-items-center mb-2 p-2 bg-dark rounded producto-venta-rapida">
        <div class="flex-grow-1">
          <div class="d-flex justify-content-between align-items-start mb-1">
            <span class="fw-bold nombre-producto">${item.nombre}</span>
            <span class="badge bg-primary fs-6">Cant: ${item.cantidad}</span>
          </div>
          <div class="d-flex justify-content-between align-items-center">
            <small class="text-muted">${formatearPrecio(item.precio)} c/u</small>
            <span class="fw-bold text-info precio-producto">${formatearPrecio(item.precio * item.cantidad)}</span>
          </div>
        </div>
        <div class="d-flex align-items-center gap-2 ms-2">
          <button class="btn btn-outline-warning btn-sm" onclick="cambiarCantidadVentaRapida(${index}, -1)" title="Reducir cantidad">
            <i class="fas fa-minus"></i>
          </button>
          <button class="btn btn-outline-success btn-sm" onclick="cambiarCantidadVentaRapida(${index}, 1)" title="Aumentar cantidad">
            <i class="fas fa-plus"></i>
          </button>
          <button class="btn btn-outline-danger btn-sm" onclick="eliminarProductoVentaRapida(${index})" title="Eliminar producto">
            <i class="fas fa-trash"></i>
          </button>
        </div>
      </div>
    `;
  });
  
  listaContainer.innerHTML = html;
}

// Función para eliminar producto de venta rápida
function eliminarProductoVentaRapida(index) {
  window.pedidoVentaRapida.items.splice(index, 1);
  actualizarListaProductosVentaRapida();
  actualizarTotalVentaRapida();
}

// Función para cambiar cantidad de un producto en venta rápida
function cambiarCantidadVentaRapida(index, cambio) {
  const item = window.pedidoVentaRapida.items[index];
  if (!item) return;
  
  const nuevaCantidad = item.cantidad + cambio;
  
  // Validar que la cantidad no sea menor a 1
  if (nuevaCantidad < 1) {
    // Si la cantidad sería 0, eliminar el producto
    eliminarProductoVentaRapida(index);
    return;
  }
  
  // Validar que la cantidad no exceda 99
  if (nuevaCantidad > 99) {
    alert('La cantidad máxima por producto es 99');
    return;
  }
  
  // Actualizar cantidad
  item.cantidad = nuevaCantidad;
  
  // Actualizar interfaz
  actualizarListaProductosVentaRapida();
  actualizarTotalVentaRapida();
}

// Función para actualizar total en venta rápida
function actualizarTotalVentaRapida() {
  const total = window.pedidoVentaRapida.items.reduce((sum, item) => sum + (item.precio * item.cantidad), 0);
  document.getElementById('totalVentaRapidaModal').textContent = formatearPrecio(total);
  
  // Habilitar/deshabilitar botones
  const btnProcesar = document.getElementById('btnProcesarVentaRapida');
  const btnVistaPrevia = document.getElementById('btnVistaPreviaVentaRapida');
  
  if (btnProcesar) btnProcesar.disabled = total === 0;
  if (btnVistaPrevia) btnVistaPrevia.disabled = total === 0;
}

// Función para procesar venta rápida directa
function procesarVentaRapidaDirecta() {
  if (!window.pedidoVentaRapida || window.pedidoVentaRapida.items.length === 0) {
    alert('No hay productos en la orden');
    return;
  }
  
  const total = window.pedidoVentaRapida.items.reduce((sum, item) => sum + (item.precio * item.cantidad), 0);
  
  // Cerrar modal de productos
  const modalProductos = bootstrap.Modal.getInstance(document.getElementById('modalAgregarProductosVentaRapida'));
  modalProductos.hide();
  
  // Mostrar modal de confirmación
  mostrarModalVentaRapida(window.pedidoVentaRapida, total, total, 0, 0, 0, 0);
}

// Función para limpiar pedido de venta rápida
function limpiarPedidoVentaRapida() {
  if (window.pedidoVentaRapida) {
    window.pedidoVentaRapida.items = [];
    actualizarListaProductosVentaRapida();
    actualizarTotalVentaRapida();
  }
}

// Función para mostrar modal de venta rápida
function mostrarModalVentaRapida(pedido, total, subtotal, propina, descuento, valorDomicilio, propinaCalculada) {
  // Configurar el resumen
  const resumenHTML = `
    <div class="small">
      <div class="d-flex justify-content-between mb-1">
        <span>Subtotal:</span>
        <span>${formatearPrecio(subtotal)}</span>
      </div>
      <div class="d-flex justify-content-between mb-1">
        <span>Propina (${propina}%):</span>
        <span>${formatearPrecio(propinaCalculada)}</span>
      </div>
      <div class="d-flex justify-content-between mb-1">
        <span>Descuento:</span>
        <span>${formatearPrecio(descuento)}</span>
      </div>
      <div class="d-flex justify-content-between mb-1">
        <span>Domicilio:</span>
        <span>${formatearPrecio(valorDomicilio)}</span>
      </div>
      <hr class="my-2">
      <div class="d-flex justify-content-between fw-bold">
        <span>TOTAL:</span>
        <span class="text-warning">${formatearPrecio(total)}</span>
      </div>
    </div>
  `;
  
  document.getElementById('resumenVentaRapida').innerHTML = resumenHTML;
  document.getElementById('totalVentaRapida').textContent = formatearPrecio(total);
  
  // Limpiar campos
  document.getElementById('montoRecibidoVentaRapida').value = '';
  document.getElementById('cambioVentaRapida').textContent = 'Cambio: $0';
  
  // Guardar datos para usar en confirmación
  window.datosVentaRapida = {
    pedido: pedido,
    total: total,
    subtotal: subtotal,
    propina: propina,
    descuento: descuento,
    valorDomicilio: valorDomicilio,
    propinaCalculada: propinaCalculada
  };
  
  // Mostrar modal
  const modal = new bootstrap.Modal(document.getElementById('modalVentaRapida'));
  modal.show();
}

// Función para calcular cambio en venta rápida
function calcularCambioVentaRapida() {
  const montoRecibido = parseFloat(document.getElementById('montoRecibidoVentaRapida').value) || 0;
  const total = window.datosVentaRapida ? window.datosVentaRapida.total : 0;
  const cambio = montoRecibido - total;
  
  document.getElementById('cambioVentaRapida').textContent = `Cambio: ${formatearPrecio(Math.max(0, cambio))}`;
  
  if (cambio < 0) {
    document.getElementById('cambioVentaRapida').classList.add('text-danger');
  } else {
    document.getElementById('cambioVentaRapida').classList.remove('text-danger');
  }
}

// Función para confirmar venta rápida desde modal
function confirmarVentaRapida() {
  if (!window.datosVentaRapida) {
    alert('Error: No hay datos de venta rápida');
    return;
  }
  
  const metodoPago = document.getElementById('metodoPagoVentaRapida').value;
  const montoRecibido = parseFloat(document.getElementById('montoRecibidoVentaRapida').value) || 0;
  const total = window.datosVentaRapida.total;
  
  // Validar monto recibido si es efectivo
  if (metodoPago === 'efectivo' && montoRecibido < total) {
    alert('El monto recibido debe ser mayor o igual al total');
    return;
  }
  
  // Marcar todos los items como "listo" (no van a cocina)
  window.datosVentaRapida.pedido.items.forEach(item => {
    item.estado = 'listo';
  });
  
  // Procesar venta rápida con método de pago seleccionado
  procesarVentaRapida(window.datosVentaRapida.pedido, total, metodoPago, montoRecibido);
  
  // Cerrar modal
  const modal = bootstrap.Modal.getInstance(document.getElementById('modalVentaRapida'));
  modal.hide();
  
  // Limpiar datos
  window.datosVentaRapida = null;
}

// Función para procesar venta rápida (actualizada)
function procesarVentaRapida(pedido, total, metodoPago = 'efectivo', montoRecibido = 0) {
  // Crear objeto de venta
  const venta = {
    id: Date.now(),
    mesa: pedido.tipo === 'venta_rapida' ? 'VENTA DIRECTA' : mesaSeleccionada,
    items: pedido.items,
    subtotal: pedido.items.reduce((sum, item) => sum + (item.precio * item.cantidad), 0),
    propina: parseFloat(document.getElementById('propina')?.value) || 0,
    descuento: parseFloat(document.getElementById('descuento')?.value) || 0,
    valorDomicilio: parseFloat(document.getElementById('valorDomicilio')?.value) || 0,
    total: total,
    metodoPago: metodoPago,
    montoRecibido: montoRecibido,
    cambio: Math.max(0, montoRecibido - total),
    fecha: new Date().toLocaleString(),
    tipo: 'venta_rapida',
    estado: 'completada'
  };

  // Guardar en historial
  let historial = JSON.parse(localStorage.getItem('historialVentas') || '[]');
  historial.push(venta);
  localStorage.setItem('historialVentas', JSON.stringify(historial));

  // Actualizar inventario si está disponible
  try {
    if (typeof actualizarInventarioVenta === 'function') {
      pedido.items.forEach(item => {
        actualizarInventarioVenta(item.nombre, item.cantidad);
      });
    }
  } catch (error) {
    console.error('Error al actualizar inventario:', error);
  }

  // Solo limpiar mesa si no es venta directa
  if (pedido.tipo !== 'venta_rapida' && mesaSeleccionada) {
    mesasActivas.delete(mesaSeleccionada);
    guardarMesas();
    actualizarVistaOrden(mesaSeleccionada);
    actualizarVistaMesas();
  }

  // Limpiar pedido de venta rápida
  window.pedidoVentaRapida = null;

  // Mostrar recibo
  mostrarReciboVentaRapida(venta);

  // Mostrar confirmación
  mostrarConfirmacionVentaRapida(venta);
}

// Función para mostrar confirmación de venta rápida
function mostrarConfirmacionVentaRapida(venta) {
  const confirmacion = document.createElement('div');
  confirmacion.className = 'alert alert-success alert-dismissible fade show position-fixed';
  confirmacion.style.cssText = 'top: 20px; right: 20px; z-index: 9999; max-width: 400px; animation: slideInRight 0.5s ease;';
  confirmacion.innerHTML = `
    <strong>⚡ Venta Rápida Completada</strong>
    <p class="mb-0">${venta.mesa === 'VENTA DIRECTA' ? 'Venta Directa' : `Mesa: ${venta.mesa}`}</p>
    <p class="mb-0">Total: ${formatearPrecio(venta.total)}</p>
    <p class="mb-0">Método: ${venta.metodoPago.toUpperCase()}</p>
    <p class="mb-0 small">Productos marcados como LISTO</p>
    <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
  `;
  
  document.body.appendChild(confirmacion);
  
  // Auto-remover después de 5 segundos
  setTimeout(() => {
    if (confirmacion.parentNode) {
      confirmacion.style.animation = 'slideOutRight 0.5s ease';
      setTimeout(() => {
        if (confirmacion.parentNode) {
          confirmacion.remove();
        }
      }, 500);
    }
  }, 5000);
}

// Función para generar ticket de cocina
function generarTicketCocina(pedido) {
  const fecha = new Date().toLocaleString();
  let ticket = `
    <div class="ticket-cocina">
      <div class="ticket-header">
        <h2>Ticket de Cocina</h2>
        <p>Fecha: ${fecha}</p>
        <p>Mesa: ${pedido.mesa}</p>
        ${pedido.cliente ? `<p>Cliente: ${pedido.cliente}</p>` : ''}
      </div>
      <div class="ticket-body">
        <table>
          <thead>
            <tr>
              <th style="width: 20%; font-size: 18px;">Cant</th>
              <th style="font-size: 18px;">Producto</th>
            </tr>
          </thead>
          <tbody>
            ${productos.map(item => `
              <tr>
                <td style="font-size: 24px; font-weight: bold;">${item.cantidad}</td>
                <td>
                  <div class="producto" style="font-weight: bold; font-size: 24px;">${item.nombre}</div>
                  ${item.detalles ? `
                    <div class="detalles" style="font-size: 16px; margin-top: 4px;">
                      <span class="detalle-label">Detalle:</span> ${item.detalles}
                    </div>
                  ` : ''}
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
      <div class="ticket-footer">
        <p>Total de productos: ${pedido.items.length}</p>
      </div>
    </div>
  `;

  return ticket;
}

// Función para obtener o crear la ventana de impresión
function obtenerVentanaImpresion() {
  const ventana = window.open('', '_blank', 'width=400,height=600,scrollbars=yes');
  if (!ventana) return null;

  // Esperar a que la ventana esté completamente cargada
  ventana.document.open();
  ventana.document.write(`
    <!DOCTYPE html>
    <html>
      <head>
        <title>Recibo</title>
        <meta charset="UTF-8">
        <style>
          body { 
            font-family: monospace;
            font-size: 14px;
            width: 57mm;
            margin: 0;
            padding: 1mm;
          }
          .text-center { text-align: center; }
          .text-right { text-align: right; }
          .mb-1 { margin-bottom: 0.5mm; }
          .mt-1 { margin-top: 0.5mm; }
          table { 
            width: 100%;
            border-collapse: collapse;
            margin: 1mm 0;
            font-size: 14px;
          }
          th, td { 
            padding: 0.5mm;
            text-align: left;
            font-size: 14px;
          }
          .border-top { 
            border-top: 1px dashed #000;
            margin-top: 1mm;
            padding-top: 1mm;
          }
          .header {
            border-bottom: 1px dashed #000;
            padding-bottom: 1mm;
            margin-bottom: 1mm;
          }
          .total-row {
            font-weight: bold;
            font-size: 16px;
          }
          .botones-impresion {
            position: fixed;
            top: 10px;
            right: 10px;
            z-index: 1000;
            background: #fff;
            padding: 5px;
            border-radius: 5px;
            box-shadow: 0 2px 5px rgba(0,0,0,0.2);
          }
          .botones-impresion button {
            margin: 0 5px;
            padding: 5px 10px;
            background: #007bff;
            color: white;
            border: none;
            border-radius: 3px;
            cursor: pointer;
          }
          .botones-impresion button:hover {
            background: #0056b3;
          }
          .logo-container {
            text-align: center;
            margin-bottom: 2mm;
          }
          .logo-container img {
            max-width: 100%;
            max-height: 120px;
          }
          @media print {
            .botones-impresion {
              display: none;
            }
            @page {
              margin: 0;
              size: 57mm auto;
            }
            body {
              width: 57mm;
            }
          }
        </style>
      </head>
      <body>
        <div class="botones-impresion">
          <button onclick="window.print()">Imprimir</button>
          <button onclick="window.close()">Cerrar</button>
        </div>
        <div id="contenido"></div>
      </body>
    </html>
  `);
  ventana.document.close();
  return ventana;
}

// Función para mostrar vista previa del ticket de cocina
function mostrarVistaPreviaPedido() {
  if (!mesaSeleccionada || !mesasActivas.has(mesaSeleccionada)) {
    alert('Por favor, seleccione una mesa con productos');
    return;
  }

  const mesa = mesaSeleccionada;
  const pedido = mesasActivas.get(mesa);
  const productos = pedido.items || [];
  
  if (productos.length === 0) {
    alert('No hay productos para mostrar en la vista previa');
    return;
  }

  const ventana = obtenerVentanaImpresion();
  if (!ventana) {
    alert('No se pudo abrir la ventana de impresión. Por favor, verifique que los bloqueadores de ventanas emergentes estén desactivados.');
    return;
  }
  
  // Obtener el pedido completo para acceder a la información del cliente
  const pedidoCompleto = mesasActivas.get(mesa);
  let infoCliente = '';
  
  if (pedidoCompleto && pedidoCompleto.cliente) {
    infoCliente = `
      <div class="cliente-info">
        <div class="cliente-label">Cliente:</div>
        <div class="cliente-datos">
          <strong>${pedidoCompleto.cliente}</strong><br>
          Tel: ${pedidoCompleto.telefono || 'No disponible'}<br>
          ${mesa.startsWith('DOM-') ? 
            `Dir: ${pedidoCompleto.direccion || 'No disponible'}` : 
            `Hora: ${pedidoCompleto.horaRecoger || 'No disponible'}`
          }
        </div>
      </div>
    `;
  }
  
  const contenido = `
    <div class="header text-center">
      <h2 style="margin: 0; font-size: 24px; font-weight: bold;">COCINA</h2>
      <div class="mb-1" style="font-size: 20px; font-weight: bold;">Mesa: ${mesa}</div>
      <div class="mb-1" style="font-size: 18px; font-weight: bold;">Ronda: ${pedidoCompleto && pedidoCompleto.ronda ? pedidoCompleto.ronda : 1}</div>
      <div class="mb-1">${new Date().toLocaleString()}</div>
    </div>
    
    ${infoCliente}
    
    <table>
      <thead>
        <tr>
          <th style="width: 20%">Cant</th>
          <th>Producto</th>
        </tr>
      </thead>
      <tbody>
        ${productos.map(item => `
          <tr>
            <td>${item.cantidad}</td>
            <td>
              <div class="producto" style="font-weight: bold; font-size: 16px;">${item.nombre}</div>
              ${item.detalles ? `
                <div class="detalles">
                  <span class="detalle-label">Detalle:</span> ${item.detalles}
                </div>
              ` : ''}
            </td>
          </tr>
        `).join('')}
      </tbody>
    </table>
    
    <div class="text-center mt-1">
      <div class="border-top">¡Gracias!</div>
    </div>
  `;
  
  // Esperar a que la ventana esté completamente cargada
  setTimeout(() => {
    try {
      const contenidoDiv = ventana.document.getElementById('contenido');
      if (contenidoDiv) {
        contenidoDiv.innerHTML = contenido;
        ventana.focus();
      } else {
        console.error('No se pudo encontrar el div de contenido');
        alert('Error: No se pudo cargar la vista previa');
      }
    } catch (error) {
      console.error('Error al insertar contenido:', error);
      alert('Error al mostrar la vista previa: ' + error.message);
    }
  }, 100);
}

// Función para imprimir ticket de cocina
function imprimirTicketCocina(mesa, productos) {
  const ventana = obtenerVentanaImpresion();
  if (!ventana) {
    alert('No se pudo abrir la ventana de impresión. Por favor, verifique que los bloqueadores de ventanas emergentes estén desactivados.');
    return;
  }
  
  // Obtener el pedido completo para acceder a la información del cliente
  const pedidoCompleto = mesasActivas.get(mesa);
  let infoCliente = '';
  
  if (pedidoCompleto && pedidoCompleto.cliente) {
    infoCliente = `
      <div class="cliente-info">
        <div class="cliente-label">Cliente:</div>
        <div class="cliente-datos">
          <strong>${pedidoCompleto.cliente}</strong><br>
          Tel: ${pedidoCompleto.telefono || 'No disponible'}<br>
          ${mesa.startsWith('DOM-') ? 
            `Dir: ${pedidoCompleto.direccion || 'No disponible'}` : 
            `Hora: ${pedidoCompleto.horaRecoger || 'No disponible'}`
          }
        </div>
      </div>
    `;
  }
  
  const contenido = `
    <div class="header text-center">
      <h2 style="margin: 0; font-size: 24px; font-weight: bold;">COCINA</h2>
      <div class="mb-1" style="font-size: 20px; font-weight: bold;">Mesa: ${mesa}</div>
      <div class="mb-1" style="font-size: 18px; font-weight: bold;">Ronda: ${pedidoCompleto && pedidoCompleto.ronda ? pedidoCompleto.ronda : 1}</div>
      <div class="mb-1">${new Date().toLocaleString()}</div>
    </div>
    
    ${infoCliente}
    
    <table>
      <thead>
        <tr>
          <th style="width: 20%">Cant</th>
          <th>Producto</th>
        </tr>
      </thead>
      <tbody>
        ${productos.map(item => `
          <tr>
            <td>${item.cantidad}</td>
            <td>
              <div class="producto" style="font-weight: bold; font-size: 16px;">${item.nombre}</div>
              ${item.detalles ? `
                <div class="detalles">
                  <span class="detalle-label">Detalle:</span> ${item.detalles}
                </div>
              ` : ''}
            </td>
          </tr>
        `).join('')}
      </tbody>
    </table>
    
    <div class="text-center mt-1">
      <div class="border-top">¡Gracias!</div>
    </div>
  `;
  
  // Escribir el contenido completo en la ventana
  ventana.document.write(`
    <!DOCTYPE html>
    <html>
      <head>
        <title>Ticket de Cocina</title>
        <meta charset="UTF-8">
        <style>
          body { 
            font-family: monospace;
            font-size: 14px;
            width: 57mm;
            margin: 0;
            padding: 1mm;
          }
          .text-center { text-align: center; }
          .mb-1 { margin-bottom: 0.5mm; }
          .mt-1 { margin-top: 0.5mm; }
          table { 
            width: 100%;
            border-collapse: collapse;
            margin: 1mm 0;
            font-size: 14px;
          }
          th, td { 
            padding: 0.5mm;
            text-align: left;
            font-size: 14px;
          }
          .border-top { 
            border-top: 1px dashed #000;
            margin-top: 1mm;
            padding-top: 1mm;
          }
          .header {
            border-bottom: 1px dashed #000;
            padding-bottom: 1mm;
            margin-bottom: 1mm;
          }
          .cliente-info {
            border: 1px solid #000;
            padding: 1mm;
            margin: 1mm 0;
            background: #f9f9f9;
          }
          .cliente-label {
            font-weight: bold;
            margin-bottom: 0.5mm;
          }
          .detalle-label {
            font-weight: bold;
            color: #666;
          }
          .botones-impresion {
            position: fixed;
            top: 10px;
            right: 10px;
            z-index: 1000;
            background: #fff;
            padding: 5px;
            border-radius: 5px;
            box-shadow: 0 2px 5px rgba(0,0,0,0.2);
          }
          .botones-impresion button {
            margin: 0 5px;
            padding: 5px 10px;
            background: #007bff;
            color: white;
            border: none;
            border-radius: 3px;
            cursor: pointer;
          }
          .botones-impresion button:hover {
            background: #0056b3;
          }
          @media print {
            .botones-impresion {
              display: none;
            }
            @page {
              margin: 0;
              size: 57mm auto;
            }
            body {
              width: 57mm;
            }
          }
        </style>
      </head>
      <body>
        <div class="botones-impresion">
          <button onclick="window.print()">Imprimir</button>
          <button onclick="window.close()">Cerrar</button>
        </div>
        <div id="contenido">
          ${contenido}
        </div>
      </body>
    </html>
  `);
  
  // Cerrar el documento y enfocar la ventana
  ventana.document.close();
  ventana.focus();
}

// Función para mostrar el modal de pago
function mostrarModalPago() {
  // Primero generar el recibo preliminar
  generarReciboPreliminar();

  // Mostrar el modal de pago inmediatamente después de generar el recibo
  // setTimeout(() => {
    if (!mesaSeleccionada || !mesasActivas.has(mesaSeleccionada)) {
      alert('Por favor, seleccione una mesa con productos');
      return;
    }

    const pedido = mesasActivas.get(mesaSeleccionada);
    if (!pedido || !pedido.items || pedido.items.length === 0) {
      alert('No hay productos para generar recibo');
      return;
    }

    // Actualizar la lista de clientes
    actualizarListaClientesPago();
    
    // Calcular totales
    const subtotal = pedido.items.reduce((sum, item) => sum + (item.precio * item.cantidad), 0);
    const propina = parseFloat(document.getElementById('propina').value) || 0;
    const descuento = parseFloat(document.getElementById('descuento').value) || 0;
    const valorDomicilio = mesaSeleccionada.startsWith('DOM-') ? (parseFloat(document.getElementById('valorDomicilio').value) || 0) : 0;
    const propinaMonto = Math.round((subtotal * propina) / 100);
    const total = Math.round(subtotal + propinaMonto - descuento + valorDomicilio);

    // Actualizar los totales en el modal
    document.getElementById('subtotalModal').textContent = formatearPrecio(subtotal);
    document.getElementById('propinaModal').textContent = formatearPrecio(propinaMonto);
    document.getElementById('descuentoModal').textContent = formatearPrecio(descuento);
    
    // Limpiar el modal de totales
    const totalesSection = document.getElementById('totalesSection');
    totalesSection.innerHTML = `
      <div class="border-top border-light pt-2">
        <div class="d-flex justify-content-between mb-1">
          <span>Subtotal:</span>
          <span id="subtotalModal">${formatearPrecio(subtotal)}</span>
        </div>
        <div class="d-flex justify-content-between mb-1">
          <span>Propina (${propina}%):</span>
          <span id="propinaModal">${formatearPrecio(propinaMonto)}</span>
        </div>
        <div class="d-flex justify-content-between mb-1">
          <span>Descuento:</span>
          <span id="descuentoModal">${formatearPrecio(descuento)}</span>
        </div>
        ${mesaSeleccionada.startsWith('DOM-') ? `
          <div class="d-flex justify-content-between mb-1">
            <span>Domicilio:</span>
            <span id="domicilioModal">${formatearPrecio(valorDomicilio)}</span>
          </div>
        ` : ''}
        <div class="d-flex justify-content-between mb-1 fw-bold">
          <span>Total:</span>
          <span id="totalModal">${formatearPrecio(total)}</span>
        </div>
      </div>
    `;
    
    // Limpiar campos del modal
    document.getElementById('montoRecibido').value = '';
    document.getElementById('cambio').textContent = formatearPrecio(0);
    document.getElementById('numeroTransferencia').value = '';
    
    // Actualizar opciones de método de pago
    const metodoPagoSelect = document.getElementById('metodoPago');
    metodoPagoSelect.innerHTML = `
      <option value="efectivo">Efectivo</option>
      <option value="tarjeta">Tarjeta</option>
      <option value="transferencia">Transferencia</option>
      <option value="credito">Crédito</option>
      <option value="mixto">Efectivo y Transferencia</option>
    `;
    
    // Mostrar el modal después de imprimir el recibo preliminar
    const modal = new bootstrap.Modal(document.getElementById('modalPago'));
    modal.show();

    // Asegurarse de que el event listener no se duplique en montoRecibido
    const montoRecibidoInput = document.getElementById('montoRecibido');
    montoRecibidoInput.removeEventListener('input', calcularCambio);
    montoRecibidoInput.addEventListener('input', calcularCambio);

    // Asegurarse de que el event listener no se duplique en metodoPago
    metodoPagoSelect.removeEventListener('change', toggleMetodoPago);
    metodoPagoSelect.addEventListener('change', () => {
      toggleMetodoPago();
      calcularCambio(); // Sincroniza los campos al cambiar método
    });

    // Llamar a toggleMetodoPago y calcularCambio para ajustar los inputs y valores según el método seleccionado actual
    toggleMetodoPago();
    calcularCambio();
  // }, 500); // Dar tiempo para que el usuario vea el recibo preliminar
}

// Función para actualizar la lista de clientes
function actualizarListaClientes() {
  const listaClientes = document.getElementById('listaClientes');
  listaClientes.innerHTML = '';
}

// Función para actualizar la lista de clientes en el modal de pago
function actualizarListaClientesPago() {
  const listaClientes = document.getElementById('listaClientesPago');
  listaClientes.innerHTML = '';
}

// Función para buscar clientes
function buscarClientes() {
  const busqueda = document.getElementById('buscarCliente').value.toLowerCase();
  const listaClientes = document.getElementById('listaClientes');
  listaClientes.innerHTML = '';

  if (!busqueda) {
    return;
  }

  const clientesFiltrados = clientes.filter(cliente => 
    cliente.nombre.toLowerCase().includes(busqueda) || 
    cliente.telefono.includes(busqueda)
  );

  if (clientesFiltrados.length === 0) {
    listaClientes.innerHTML = '<p class="text-muted">No se encontraron clientes</p>';
    return;
  }

  clientesFiltrados.forEach(cliente => {
    const item = document.createElement('button');
    item.className = 'list-group-item list-group-item-action bg-dark text-white border-light';
    item.innerHTML = `
      <div class="d-flex justify-content-between align-items-center">
        <div>
          <h6 class="mb-1">${cliente.nombre}</h6>
          <small>${cliente.telefono}</small>
        </div>
        <button class="btn btn-sm btn-outline-light" onclick="seleccionarCliente(${JSON.stringify(cliente).replace(/"/g, '&quot;')})">
          Seleccionar
        </button>
      </div>
    `;
    listaClientes.appendChild(item);
  });
}

// Función para buscar clientes en el modal de pago
function buscarClientesPago() {
  const busqueda = document.getElementById('buscarClientePago').value.toLowerCase();
  const listaClientes = document.getElementById('listaClientesPago');
  listaClientes.innerHTML = '';

  if (!busqueda) {
    return;
  }

  const clientesFiltrados = clientes.filter(cliente => 
    cliente.nombre.toLowerCase().includes(busqueda) || 
    cliente.telefono.includes(busqueda)
  );

  if (clientesFiltrados.length === 0) {
    listaClientes.innerHTML = '<p class="text-muted">No se encontraron clientes</p>';
    return;
  }

  clientesFiltrados.forEach(cliente => {
    const item = document.createElement('button');
    item.className = 'list-group-item list-group-item-action bg-dark text-white border-light';
    item.innerHTML = `
      <div class="d-flex justify-content-between align-items-center">
        <div>
          <h6 class="mb-1">${cliente.nombre}</h6>
          <small>${cliente.telefono}</small>
        </div>
        <button class="btn btn-sm btn-outline-light" onclick="seleccionarClientePago(${JSON.stringify(cliente).replace(/"/g, '&quot;')})">
          Seleccionar
        </button>
      </div>
    `;
    listaClientes.appendChild(item);
  });
}

// Función para seleccionar un cliente en el pago
function seleccionarClientePago(cliente) {
  const pedido = mesasActivas.get(mesaSeleccionada);
  if (pedido) {
    pedido.cliente = cliente.nombre;
    pedido.telefono = cliente.telefono;
    pedido.direccion = cliente.direccion;
    guardarMesas();
    
    // Actualizar opciones de método de pago para incluir crédito
    const metodoPagoSelect = document.getElementById('metodoPago');
    metodoPagoSelect.innerHTML = `
      <option value="efectivo">Efectivo</option>
      <option value="tarjeta">Tarjeta</option>
      <option value="transferencia">Transferencia</option>
      <option value="credito">Crédito</option>
      <option value="mixto">Efectivo y Transferencia</option>
    `;
    
    // Mostrar mensaje de confirmación
    const mensaje = document.createElement('div');
    mensaje.className = 'alert alert-success mt-2';
    mensaje.textContent = `Cliente ${cliente.nombre} seleccionado`;
    document.getElementById('listaClientesPago').appendChild(mensaje);
    
    // Remover el mensaje después de 2 segundos
    setTimeout(() => {
      mensaje.remove();
    }, 2000);
  }
}

// Función para calcular el cambio
function calcularCambio() {
  const montoRecibido = parseFloat(document.getElementById('montoRecibido').value) || 0;
  const totalElement = document.getElementById('totalModal');
  // Eliminar el símbolo de moneda y los separadores de miles, y convertir a número
  const total = parseFloat(totalElement.textContent.replace(/[$.]/g, '').replace(/,/g, ''));
  const cambio = montoRecibido - total;
  
  const cambioElement = document.getElementById('cambio');
  if (cambio >= 0) {
    cambioElement.textContent = formatearPrecio(cambio);
    cambioElement.classList.remove('text-danger', 'bg-danger');
    cambioElement.classList.add('text-success', 'bg-light');
    cambioElement.style.fontWeight = 'bold';
    cambioElement.style.fontSize = '1.2em';
  } else {
    cambioElement.textContent = 'Monto insuficiente';
    cambioElement.classList.remove('text-success', 'bg-light');
    cambioElement.classList.add('text-danger', 'bg-danger');
    cambioElement.style.fontWeight = 'bold';
    cambioElement.style.fontSize = '1.2em';
  }

  // Si el método de pago es mixto, actualizar automáticamente el monto de transferencia
  const metodoPago = document.getElementById('metodoPago').value;
  if (metodoPago === 'mixto') {
    const montoTransferencia = total - montoRecibido;
    document.getElementById('montoTransferencia').value = montoTransferencia > 0 ? montoTransferencia : 0;
  }
}

// Función para alternar entre métodos de pago
function toggleMetodoPago() {
  const metodo = document.getElementById('metodoPago').value;
  const efectivoSection = document.getElementById('efectivoSection');
  const transferenciaSection = document.getElementById('transferenciaSection');
  const montoTransferenciaInput = document.getElementById('montoTransferencia');
  // Mostrar/ocultar secciones según el método
  if (metodo === 'efectivo') {
    efectivoSection.style.display = 'block';
    transferenciaSection.style.display = 'none';
  } else if (metodo === 'transferencia') {
    efectivoSection.style.display = 'none';
    transferenciaSection.style.display = 'block';
    // Ocultar monto por transferencia, mostrar solo número
    if (montoTransferenciaInput) montoTransferenciaInput.style.display = 'none';
  } else if (metodo === 'mixto') {
    efectivoSection.style.display = 'block';
    transferenciaSection.style.display = 'block';
    // Mostrar monto por transferencia
    if (montoTransferenciaInput) montoTransferenciaInput.style.display = '';
  } else if (metodo === 'credito') {
    efectivoSection.style.display = 'none';
    transferenciaSection.style.display = 'none';
  } else {
    efectivoSection.style.display = 'none';
    transferenciaSection.style.display = 'none';
  }
}

// Función para mostrar el modal de cliente
function mostrarModalCliente(tipo) {
  tipoPedidoActual = tipo;
  const modal = new bootstrap.Modal(document.getElementById('modalCliente'));
  actualizarListaClientes();
  modal.show();
}

// Función para mostrar el formulario de nuevo cliente
function mostrarFormularioNuevoCliente() {
  document.getElementById('formularioNuevoCliente').style.display = 'block';
  document.getElementById('listaClientes').style.display = 'none';
}

// Función para ocultar el formulario de nuevo cliente
function ocultarFormularioNuevoCliente() {
  document.getElementById('formularioNuevoCliente').style.display = 'none';
  document.getElementById('listaClientes').style.display = 'block';
}

// Función para guardar nuevo cliente
function guardarNuevoClienteDesdePOS() {
  const nombre = document.getElementById('nuevoClienteNombre').value;
  const telefono = document.getElementById('nuevoClienteTelefono').value;
  const direccion = document.getElementById('nuevoClienteDireccion').value;

  if (!nombre || !telefono) {
    alert('Por favor, complete los campos requeridos');
    return;
  }

  const nuevoCliente = {
    id: Date.now(),
    documento: telefono, // Usamos el teléfono como documento
    nombre: nombre,
    apellido: 'No proporcionado',
    telefono: telefono,
    correo: 'No proporcionado',
    direccion: direccion || 'No proporcionado',
    fechaRegistro: new Date().toISOString()
  };

  // Usar la variable global clientes
  clientes.push(nuevoCliente);
  guardarClientes();
  
  // Limpiar formulario
  document.getElementById('nuevoClienteNombre').value = '';
  document.getElementById('nuevoClienteTelefono').value = '';
  document.getElementById('nuevoClienteDireccion').value = '';

  // Ocultar formulario y actualizar lista
  ocultarFormularioNuevoCliente();
  actualizarListaClientes();
  
  // Seleccionar el cliente recién creado
  seleccionarCliente(nuevoCliente);
}

// Función para seleccionar un cliente
function seleccionarCliente(cliente) {
  if (tipoPedidoActual === 'domicilio') {
    crearPedidoDomicilioConCliente(cliente);
  } else {
    crearPedidoRecogerConCliente(cliente);
  }
  
  // Cerrar modal
  bootstrap.Modal.getInstance(document.getElementById('modalCliente')).hide();
}

// Función para crear pedido de domicilio con cliente
function crearPedidoDomicilioConCliente(cliente) {
  contadorDomicilios++;
  guardarContadores();
  
  const idPedido = `DOM-${contadorDomicilios}`;
  const pedido = {
    tipo: 'domicilio',
    numero: contadorDomicilios,
    cliente: cliente.nombre,
    telefono: cliente.telefono,
    direccion: cliente.direccion,
    items: [],
    estado: 'pendiente',
    fecha: new Date().toLocaleString(),
    ronda: 1 // Inicializar la ronda
  };

  mesasActivas.set(idPedido, pedido);
  guardarMesas();
  actualizarMesasActivas();
  seleccionarMesa(idPedido);
}

// Función para crear pedido para recoger con cliente
function crearPedidoRecogerConCliente(cliente) {
  contadorRecoger++;
  guardarContadores();
  
  const idPedido = `REC-${contadorRecoger}`;
  const pedido = {
    tipo: 'recoger',
    numero: contadorRecoger,
    cliente: cliente.nombre,
    telefono: cliente.telefono,
    horaRecoger: '', // Dejar vacío o poner 'No especificada' si prefieres
    items: [],
    estado: 'pendiente',
    fecha: new Date().toLocaleString(),
    ronda: 1 // Inicializar la ronda
  };

  mesasActivas.set(idPedido, pedido);
  guardarMesas();
  actualizarMesasActivas();
  seleccionarMesa(idPedido);
}

// Función para reiniciar contadores (puedes llamarla al inicio del día)
function reiniciarContadores() {
  contadorDomicilios = 0;
  contadorRecoger = 0;
  guardarContadores();
}

// Modificar las funciones existentes de crear pedido
function crearPedidoDomicilio() {
  mostrarModalCliente('domicilio');
}

function crearPedidoRecoger() {
  mostrarModalCliente('recoger');
}

// Función para crear nueva mesa
function crearNuevaMesa() {
  const numeroMesa = document.getElementById('nuevaMesa').value.trim();
  
  if (!numeroMesa) {
    alert('Por favor, ingrese un número de mesa');
    return;
  }

  if (mesasActivas.has(numeroMesa)) {
    alert('Esta mesa ya está activa');
    return;
  }

  // Crear nueva mesa
  mesasActivas.set(numeroMesa, []);
  guardarMesas();
  
  // Limpiar el input
  document.getElementById('nuevaMesa').value = '';
  
  // Actualizar la vista de mesas
  actualizarMesasActivas();
  
  // Seleccionar la nueva mesa
  seleccionarMesa(numeroMesa);
}

// Función para eliminar un pedido/mesa
function eliminarPedido() {
  if (!mesaSeleccionada) {
    alert('Por favor, seleccione una mesa o pedido para eliminar');
    return;
  }

  let mensaje = '';
  if (mesaSeleccionada.startsWith('DOM-')) {
    mensaje = '¿Está seguro que desea eliminar este pedido a domicilio?';
  } else if (mesaSeleccionada.startsWith('REC-')) {
    mensaje = '¿Está seguro que desea eliminar este pedido para recoger?';
  } else {
    mensaje = '¿Está seguro que desea eliminar esta mesa?';
  }

  if (confirm(mensaje)) {
    // Eliminar de mesas activas
    mesasActivas.delete(mesaSeleccionada);
    
    // Eliminar de órdenes de cocina si existe
    if (ordenesCocina.has(mesaSeleccionada)) {
      ordenesCocina.delete(mesaSeleccionada);
    }

    // Guardar cambios
    guardarMesas();

    // Limpiar la interfaz
    document.getElementById('ordenCuerpo').innerHTML = '';
    document.getElementById('propina').value = '';
    document.getElementById('descuento').value = '';
    document.getElementById('totalOrden').textContent = formatearPrecio(0);
    document.getElementById('desgloseTotal').innerHTML = '';
    document.getElementById('mesaActual').textContent = '-';
    mesaSeleccionada = null;

    // Actualizar vista de mesas
    actualizarMesasActivas();
  }
}

// Función para procesar el pago
function procesarPago() {
  const metodoPago = document.getElementById('metodoPago').value;
  const pedido = mesasActivas.get(mesaSeleccionada);
  
  if (!pedido || !pedido.items || pedido.items.length === 0) {
    alert('No hay productos en la orden');
    return;
  }

  // Validar que haya cliente seleccionado para crédito
  if (metodoPago === 'credito' && !pedido.cliente) {
    alert('Debe seleccionar un cliente para realizar un pago a crédito');
    return;
  }

  // Calcular totales
  const subtotal = pedido.items.reduce((sum, item) => sum + (item.precio * item.cantidad), 0);
  const propina = parseFloat(document.getElementById('propina').value) || 0;
  const descuento = parseFloat(document.getElementById('descuento').value) || 0;
  const valorDomicilio = mesaSeleccionada.startsWith('DOM-') ? (parseFloat(document.getElementById('valorDomicilio').value) || 0) : 0;
  const propinaMonto = Math.round((subtotal * propina) / 100);
  const total = Math.round(subtotal + propinaMonto - descuento + valorDomicilio);

  // Validar montos para pago mixto
  if (metodoPago === 'mixto') {
    const montoEfectivo = parseFloat(document.getElementById('montoRecibido').value) || 0;
    const montoTransferencia = parseFloat(document.getElementById('montoTransferencia').value) || 0;
    const totalMixto = montoEfectivo + montoTransferencia;

    if (totalMixto !== total) {
      alert('La suma de los montos en efectivo y transferencia debe ser igual al total');
      return;
    }
  }

  // Crear objeto de factura
  const factura = {
    id: Date.now(),
    fecha: new Date().toISOString(),
    mesa: mesaSeleccionada,
    items: pedido.items,
    subtotal: subtotal,
    propina: propina,
    propinaMonto: propinaMonto,
    descuento: descuento,
    valorDomicilio: valorDomicilio,
    total: total,
    metodoPago: metodoPago,
    montoRecibido: metodoPago === 'efectivo' || metodoPago === 'mixto' ? parseFloat(document.getElementById('montoRecibido').value) : 0,
    montoTransferencia: metodoPago === 'transferencia' || metodoPago === 'mixto' ? parseFloat(document.getElementById('montoTransferencia').value) : 0,
    cambio: metodoPago === 'efectivo' || metodoPago === 'mixto' ? Math.round(parseFloat(document.getElementById('montoRecibido').value) - (metodoPago === 'mixto' ? parseFloat(document.getElementById('montoRecibido').value) : total)) : 0,
    numeroTransferencia: metodoPago === 'transferencia' || metodoPago === 'mixto' ? document.getElementById('numeroTransferencia').value : null,
    cliente: pedido.cliente || null,
    telefono: pedido.telefono || null,
    direccion: pedido.direccion || null,
    horaRecoger: pedido.horaRecoger || null,
    tipo: mesaSeleccionada.startsWith('DOM-') ? 'domicilio' : 
          mesaSeleccionada.startsWith('REC-') ? 'recoger' : 'mesa',
    estado: metodoPago === 'credito' ? 'pendiente' : 'pagado'
  };

  // Si es crédito, guardar en una lista separada de facturas pendientes
  if (metodoPago === 'credito') {
    const facturasPendientes = JSON.parse(localStorage.getItem('facturasPendientes') || '[]');
    facturasPendientes.push(factura);
    localStorage.setItem('facturasPendientes', JSON.stringify(facturasPendientes));
  }

  // Agregar al historial de ventas
  if (!Array.isArray(historialVentas)) {
    historialVentas = [];
  }
  historialVentas.push(factura);
  guardarHistorialVentas();

  // Agregar la venta a la lista de ventas activas (para el cierre diario)
  let ventasActuales = JSON.parse(localStorage.getItem('ventas')) || [];
  ventasActuales.push(factura);
  localStorage.setItem('ventas', JSON.stringify(ventasActuales));

  // ========================================
  // INTEGRACIÓN CON INVENTARIO
  // ========================================
  try {
    // Verificar si existe la función de actualización de inventario
    if (typeof actualizarInventarioDesdeVenta === 'function') {
      // Preparar los items para la actualización del inventario
      const itemsParaInventario = pedido.items.map(item => ({
        nombre: item.nombre,
        cantidad: item.cantidad,
        ventaId: factura.id,
        mesa: mesaSeleccionada
      }));
      
      // Actualizar inventario
      const resultadoInventario = actualizarInventarioDesdeVenta(itemsParaInventario);
      
      if (resultadoInventario.success) {
        console.log('Inventario actualizado exitosamente:', resultadoInventario);
        
        // Mostrar notificación si hay productos con stock bajo
        if (resultadoInventario.productosStockBajo && resultadoInventario.productosStockBajo.length > 0) {
          const productosBajo = resultadoInventario.productosStockBajo.map(p => p.nombre).join(', ');
          console.warn(`Productos con stock bajo después de la venta: ${productosBajo}`);
        }
        
        // Mostrar notificación si hay productos no encontrados en inventario
        if (resultadoInventario.productosNoEncontrados && resultadoInventario.productosNoEncontrados.length > 0) {
          const productosNoEncontrados = resultadoInventario.productosNoEncontrados.join(', ');
          console.warn(`Productos no encontrados en inventario: ${productosNoEncontrados}`);
        }
      } else {
        console.error('Error al actualizar inventario:', resultadoInventario.message);
      }
    } else {
      console.log('Función de actualización de inventario no disponible');
    }
  } catch (error) {
    console.error('Error en la integración con inventario:', error);
  }

  // Obtener la ventana de impresión
  const ventana = obtenerVentanaImpresion();
  if (!ventana) {
    alert('No se pudo abrir la ventana de impresión. Por favor, verifique que los bloqueadores de ventanas emergentes estén desactivados.');
    return;
  }

  let tipoPedido = '';
  let infoAdicional = '';

  if (mesaSeleccionada.startsWith('DOM-')) {
    tipoPedido = 'Pedido a Domicilio';
    if (pedido.cliente) {
      infoAdicional = `
        <div class="border-top">
          <div class="mb-1"><strong>Cliente:</strong> <strong>${pedido.cliente}</strong></div>
          <div class="mb-1"><strong>Dir:</strong> <strong>${pedido.direccion || 'No especificada'}</strong></div>
          <div class="mb-1"><strong>Tel:</strong> <strong>${pedido.telefono || 'No especificado'}</strong></div>
        </div>
      `;
    }
  } else if (mesaSeleccionada.startsWith('REC-')) {
    tipoPedido = 'Pedido para Recoger';
    if (pedido.cliente) {
      infoAdicional = `
        <div class="border-top">
          <div class="mb-1"><strong>Cliente:</strong> <strong>${pedido.cliente}</strong></div>
          <div class="mb-1"><strong>Tel:</strong> <strong>${pedido.telefono || 'No especificado'}</strong></div>
          ${pedido.horaRecoger ? `<div class="mb-1"><strong>Hora:</strong> <strong>${pedido.horaRecoger}</strong></div>` : ''}
        </div>
      `;
    }
  }

  const contenidoRecibo = `
    <div class="logo-container">
      ${localStorage.getItem('logoNegocio') ? 
        `<img src="${localStorage.getItem('logoNegocio')}" alt="Logo">` : 
        ''}
    </div>

    <div class="header text-center">
      <h2 style="margin: 0; font-size: 14px;">RESTAURANTE</h2>
      ${tipoPedido ? `<div class="mb-1">${tipoPedido}</div>` : ''}
      <div class="mb-1">${new Date().toLocaleString()}</div>
      ${!mesaSeleccionada.startsWith('DOM-') && !mesaSeleccionada.startsWith('REC-') ? 
        `<div class="mb-1">Mesa: ${mesaSeleccionada}</div>` : ''}
    </div>
    
    ${infoAdicional}
    
    <table>
      <thead>
        <tr>
          <th style="width: 40%">Producto</th>
          <th style="width: 15%">Cant</th>
          <th style="width: 20%">Precio</th>
          <th style="width: 25%">Total</th>
        </tr>
      </thead>
      <tbody>
        ${pedido.items.map(item => `
          <tr>
            <td>${item.nombre}</td>
            <td>${item.cantidad}</td>
            <td style="text-align:right;">${formatearNumero(item.precio)}</td>
            <td style="text-align:right;">${formatearNumero(item.precio * item.cantidad)}</td>
          </tr>
        `).join('')}
      </tbody>
    </table>
    
    <div class="border-top">
      <div class="mb-1">Subtotal: <span class="text-right">$ ${formatearNumero(subtotal)}</span></div>
      <div class="mb-1">Propina (${propina}%): <span class="text-right">$ ${formatearNumero(propinaMonto)}</span></div>
      <div class="mb-1">Descuento: <span class="text-right">$ ${formatearNumero(descuento)}</span></div>
      ${valorDomicilio > 0 ? `<div class="mb-1">Domicilio: <span class="text-right">$ ${formatearNumero(valorDomicilio)}</span></div>` : ''}
      <div class="mb-1 total-row"><strong>Total: $ ${formatearNumero(total)}</strong></div>
    </div>
    
    <div class="border-top">
      <div class="mb-1">Método de Pago: ${metodoPago}</div>
      ${metodoPago === 'efectivo' || metodoPago === 'mixto' ? `
        <div class="mb-1">Recibido en Efectivo: $ ${formatearNumero(factura.montoRecibido)}</div>
        <div class="mb-1">Cambio: $ ${formatearNumero(factura.cambio)}</div>
      ` : ''}
      ${metodoPago === 'transferencia' ? `
        <div class="mb-1">N° Transferencia: ${factura.numeroTransferencia}</div>
        <div class="mb-1">Transferencia: $ ${formatearNumero(factura.montoTransferencia)}</div>
      ` : ''}
      ${metodoPago === 'mixto' ? `
        <div class="mb-1">Monto en Efectivo: $ ${formatearNumero(factura.montoRecibido)}</div>
        <div class="mb-1">Cambio: $ ${formatearNumero(factura.cambio)}</div>
        <div class="mb-1">N° Transferencia: ${factura.numeroTransferencia}</div>
        <div class="mb-1">Transferencia: $ ${formatearNumero(factura.montoTransferencia)}</div>
      ` : ''}
    </div>
    
    ${(() => {
      const datosNegocio = JSON.parse(localStorage.getItem('datosNegocio'));
      if (datosNegocio && Object.values(datosNegocio).some(valor => valor)) {
        return `
          <div class="border-top mt-1">
            ${datosNegocio.nombre ? `<div><strong>${datosNegocio.nombre}</strong></div>` : ''}
            ${datosNegocio.nit ? `<div>NIT/Cédula: ${datosNegocio.nit}</div>` : ''}
            ${datosNegocio.direccion ? `<div>Dirección: ${datosNegocio.direccion}</div>` : ''}
            ${datosNegocio.correo ? `<div>Correo: ${datosNegocio.correo}</div>` : ''}
            ${datosNegocio.telefono ? `<div>Teléfono: ${datosNegocio.telefono}</div>` : ''}
          </div>
        `;
      }
      return '';
    })()}
    
    <div class="text-center mt-1">
      <div class="border-top">¡Gracias por su compra!</div>
      <div class="border-top">ToySoft POS</div>
    </div>
  `;

  // Escribir el contenido completo en la ventana
  ventana.document.write(`
    <!DOCTYPE html>
    <html>
      <head>
        <title>Recibo de Pago</title>
        <meta charset="UTF-8">
        <style>
          body { 
            font-family: monospace;
            font-size: 14px;
            width: 57mm;
            margin: 0;
            padding: 1mm;
          }
          .text-center { text-align: center; }
          .text-right { text-align: right; }
          .mb-1 { margin-bottom: 0.5mm; }
          .mt-1 { margin-top: 0.5mm; }
          table { 
            width: 100%;
            border-collapse: collapse;
            margin: 1mm 0;
            font-size: 14px;
          }
          th, td { 
            padding: 0.5mm;
            text-align: left;
            font-size: 14px;
          }
          .border-top { 
            border-top: 1px dashed #000;
            margin-top: 1mm;
            padding-top: 1mm;
          }
          .header {
            border-bottom: 1px dashed #000;
            padding-bottom: 1mm;
            margin-bottom: 1mm;
          }
          .total-row {
            font-weight: bold;
            font-size: 16px;
          }
          .logo-container {
            text-align: center;
            margin-bottom: 2mm;
          }
          .logo-container img {
            max-width: 100%;
            max-height: 120px;
          }
          .botones-impresion {
            position: fixed;
            top: 10px;
            right: 10px;
            z-index: 1000;
            background: #fff;
            padding: 5px;
            border-radius: 5px;
            box-shadow: 0 2px 5px rgba(0,0,0,0.2);
          }
          .botones-impresion button {
            margin: 0 5px;
            padding: 5px 10px;
            background: #007bff;
            color: white;
            border: none;
            border-radius: 3px;
            cursor: pointer;
          }
          .botones-impresion button:hover {
            background: #0056b3;
          }
          @media print {
            .botones-impresion {
              display: none;
            }
            @page {
              margin: 0;
              size: 57mm auto;
            }
            body {
              width: 57mm;
            }
          }
        </style>
      </head>
      <body>
        <div class="botones-impresion">
          <button onclick="window.print()">Imprimir</button>
          <button onclick="window.close()">Cerrar</button>
        </div>
        <div id="contenido">
          ${contenidoRecibo}
        </div>
      </body>
    </html>
  `);
  
  // Cerrar el documento y enfocar la ventana
  ventana.document.close();
  ventana.focus();

  // Cerrar el modal de pago
  bootstrap.Modal.getInstance(document.getElementById('modalPago')).hide();

  // Eliminar la mesa/pedido
  mesasActivas.delete(mesaSeleccionada);
  guardarMesas();
  actualizarMesasActivas();
  
  // Limpiar la vista actual
  document.getElementById('ordenCuerpo').innerHTML = '';
  document.getElementById('propina').value = '';
  document.getElementById('descuento').value = '';
  document.getElementById('valorDomicilio').value = '';
  document.getElementById('totalOrden').textContent = '$ 0';
  document.getElementById('desgloseTotal').innerHTML = '';
  document.getElementById('mesaActual').textContent = '-';
  mesaSeleccionada = null;
}

// Función para reimprimir ticket de cocina desde el historial
function reimprimirTicketCocina(ordenId) {
  const orden = historialCocina.find(o => o.id === ordenId);
  if (orden) {
    imprimirTicketCocina(orden.mesa, orden.items);
  }
}

// Función para reimprimir factura desde el historial
function reimprimirFactura(ventaId) {
  const venta = historialVentas.find(v => v.id === ventaId);
  if (venta) {
    const ventana = obtenerVentanaImpresion();
    if (!ventana) {
      alert('No se pudo abrir la ventana de impresión. Por favor, verifique que los bloqueadores de ventanas emergentes estén desactivados.');
      return;
    }
    
    let tipoPedido = '';
    let infoAdicional = '';
    
    if (venta.mesa.startsWith('DOM-')) {
      tipoPedido = 'Pedido a Domicilio';
      if (venta.cliente) {
        infoAdicional = `
          <div class="border-top">
            <div class="mb-1"><strong>Cliente:</strong> <strong>${venta.cliente}</strong></div>
            <div class="mb-1"><strong>Dir:</strong> <strong>${venta.direccion}</strong></div>
            <div class="mb-1"><strong>Tel:</strong> <strong>${venta.telefono}</strong></div>
          </div>
        `;
      }
    } else if (venta.mesa.startsWith('REC-')) {
      tipoPedido = 'Pedido para Recoger';
      if (venta.cliente) {
        infoAdicional = `
          <div class="border-top">
            <div class="mb-1"><strong>Cliente:</strong> <strong>${venta.cliente}</strong></div>
            <div class="mb-1"><strong>Tel:</strong> <strong>${venta.telefono}</strong></div>
            ${venta.horaRecoger ? `<div class="mb-1"><strong>Hora:</strong> <strong>${venta.horaRecoger}</strong></div>` : ''}
          </div>
        `;
      }
    }

    const contenido = `
      <html>
        <head>
          <title>Recibo</title>
          <style>
            body { 
              font-family: monospace;
              font-size: 14px;
              width: 57mm;
              margin: 0;
              padding: 1mm;
            }
            .text-center { text-align: center; }
            .text-right { text-align: right; }
            .mb-1 { margin-bottom: 0.5mm; }
            .mt-1 { margin-top: 0.5mm; }
            table { 
              width: 100%;
              border-collapse: collapse;
              margin: 1mm 0;
              font-size: 14px;
            }
            th, td { 
              padding: 0.5mm;
              text-align: left;
              font-size: 14px;
            }
            .border-top { 
              border-top: 1px dashed #000;
              margin-top: 1mm;
              padding-top: 1mm;
            }
            .header {
              border-bottom: 1px dashed #000;
              padding-bottom: 1mm;
              margin-bottom: 1mm;
            }
            .total-row {
              font-weight: bold;
              font-size: 16px;
            }
            .botones-impresion {
              position: fixed;
              top: 10px;
              right: 10px;
              z-index: 1000;
              background: #fff;
              padding: 5px;
              border-radius: 5px;
              box-shadow: 0 2px 5px rgba(0,0,0,0.2);
            }
            .botones-impresion button {
              margin: 0 5px;
              padding: 5px 10px;
              background: #007bff;
              color: white;
              border: none;
              border-radius: 3px;
              cursor: pointer;
            }
            .botones-impresion button:hover {
              background: #0056b3;
            }
            .logo-container {
              text-align: center;
              margin-bottom: 2mm;
            }
            .logo-container img {
              max-width: 100%;
              max-height: 120px;
            }
            @media print {
              .botones-impresion {
                display: none;
              }
              @page {
                margin: 0;
                size: 57mm auto;
              }
              body {
                width: 57mm;
              }
            }
          </style>
        </head>
        <body>
          <div class="botones-impresion">
            <button onclick="window.print()">Imprimir</button>
            <button onclick="window.close()">Cerrar</button>
          </div>
          <div id="contenido"></div>
        </body>
      </html>
    `;
    
    ventana.document.write(contenido);
    ventana.document.close();
  }
}

// Función para mostrar el modal de cierre diario
function mostrarModalCierreDiario() {
    try {
        console.log('Iniciando mostrarModalCierreDiario...');
        // Obtener la marca de tiempo del último cierre (si existe)
        const ultimaHoraCierreStr = localStorage.getItem('ultimaHoraCierre');
        const ultimaHoraCierre = ultimaHoraCierreStr ? new Date(ultimaHoraCierreStr) : null;

        // Obtener ventas almacenadas
        const ventas = JSON.parse(localStorage.getItem('ventas')) || [];
        const hoy = new Date();
        const hoyStr = hoy.toISOString().slice(0, 10); // YYYY-MM-DD

        // Filtrar ventas posteriores al último cierre o, si no existe, del día actual
        const ventasHoy = ventas.filter(v => {
            const fechaVenta = new Date(v.fecha);
            if (ultimaHoraCierre) {
                return fechaVenta > ultimaHoraCierre;
            }
            const fechaVentaStr = fechaVenta.toISOString().slice(0, 10);
            return fechaVentaStr === hoyStr;
        });
        // Calcular totales por método de pago
        let totalEfectivo = 0, totalTransferencia = 0, totalTarjeta = 0, totalCredito = 0, totalMixto = 0, totalVentas = 0;
        ventasHoy.forEach(v => {
            const total = parseFloat(v.total) || 0;
            const metodo = (v.metodoPago || '').toLowerCase();
            if (metodo === 'mixto') {
                const efectivoMixto = parseFloat(v.montoRecibido) || 0;
                const transferenciaMixto = parseFloat(v.montoTransferencia) || 0;
                totalMixto += total;
                totalEfectivo += efectivoMixto;
                totalTransferencia += transferenciaMixto;
            } else {
                switch (metodo) {
                    case 'efectivo':
                        totalEfectivo += total;
                        break;
                    case 'transferencia':
                        totalTransferencia += total;
                        break;
                    case 'tarjeta':
                        totalTarjeta += total;
                        break;
                    case 'crédito':
                    case 'credito':
                        totalCredito += total;
                        break;
                }
            }
            totalVentas += total;
        });
        // Obtener gastos del día
        const gastos = JSON.parse(localStorage.getItem('gastos')) || [];
console.log('[BALANCE] Fuente de gastos:', gastos);
        const gastosHoy = gastos.filter(g => {
            const fechaGasto = new Date(g.fecha);
            if (ultimaHoraCierre) {
                return fechaGasto > ultimaHoraCierre;
            }
            const fechaGastoStr = fechaGasto.toISOString().slice(0, 10);
            return fechaGastoStr === hoyStr;
        });
        const totalGastos = gastosHoy.reduce((sum, g) => sum + (parseFloat(g.monto) || 0), 0);
        // Calcular balance final
        const balanceFinal = totalVentas - totalGastos;
        // Actualizar valores en el modal
        document.getElementById('totalVentasHoy').textContent = `$ ${totalVentas.toLocaleString()}`;
        document.getElementById('totalEfectivoHoy').textContent = `$ ${totalEfectivo.toLocaleString()}`;
        document.getElementById('totalTransferenciaHoy').textContent = `$ ${totalTransferencia.toLocaleString()}`;
        if(document.getElementById('totalTarjetaHoy')) document.getElementById('totalTarjetaHoy').textContent = `$ ${totalTarjeta.toLocaleString()}`;
        if(document.getElementById('totalCreditoHoy')) document.getElementById('totalCreditoHoy').textContent = `$ ${totalCredito.toLocaleString()}`;
        if(document.getElementById('totalMixtoHoy')) document.getElementById('totalMixtoHoy').textContent = `$ ${totalMixto.toLocaleString()}`;
        document.getElementById('totalGastosHoy').textContent = `$ ${totalGastos.toLocaleString()}`;
        document.getElementById('balanceFinal').textContent = `$ ${balanceFinal.toLocaleString()}`;
        // Actualizar detalles de créditos pendientes
        const creditosPendientes = ventasHoy.filter(v => (v.metodoPago || '').toLowerCase() === 'crédito');
        const detallesCreditos = document.getElementById('detallesCreditos');
        if (detallesCreditos) {
            detallesCreditos.innerHTML = creditosPendientes.map(credito => `
                <div class="mb-2">
                    <div>Cliente: ${credito.cliente || 'No especificado'}</div>
                    <div>Monto: $ ${credito.total.toLocaleString()}</div>
                    <div>Fecha: ${new Date(credito.fecha).toLocaleString()}</div>
                </div>
            `).join('') || '<div>No hay créditos pendientes</div>';
        }
        // Limpiar el campo de detalles
        document.getElementById('detallesCierre').value = '';
        // Mostrar el modal
        const modal = new bootstrap.Modal(document.getElementById('modalCierreDiario'));
        modal.show();
        console.log('Modal de cierre diario mostrado correctamente');
    } catch (error) {
        console.error('Error en mostrarModalCierreDiario:', error);
        alert('Error al mostrar el cierre diario: ' + error.message);
    }
}

function guardarCierreDiario() {
    try {
        // Validar campos requeridos
        const nombreCierre = document.getElementById('nombreCierre').value.trim();
        const nombreRecibe = document.getElementById('nombreRecibe').value.trim();
        const montoBaseCaja = parseFloat(document.getElementById('montoBaseCaja').value) || 0;

        if (!nombreCierre || !nombreRecibe || montoBaseCaja <= 0) {
            alert('Por favor complete todos los campos requeridos');
            return;
        }

        // Mostrar confirmación
        const confirmacion = confirm(
            '¿Está seguro de realizar el cierre?\n\n' +
            'Se realizarán las siguientes acciones:\n' +
            '- Se reiniciarán todas las ventas\n' +
            '- Se reiniciarán todos los gastos\n' +
            '- Se reiniciarán los contadores de delivery y recoger\n' +
            '- Se limpiarán todas las mesas activas\n\n' +
            'Esta acción no se puede deshacer.'
        );

        if (!confirmacion) {
            return;
        }

        // Calcular rango de filtro (último cierre o día actual)
        const ultimaHoraCierreStr = localStorage.getItem('ultimaHoraCierre');
        const ultimaHoraCierre = ultimaHoraCierreStr ? new Date(ultimaHoraCierreStr) : null;
        const hoy = new Date();
        const hoyStr = hoy.toISOString().slice(0, 10); // YYYY-MM-DD

        // Obtener ventas del día
        const ventas = JSON.parse(localStorage.getItem('ventas')) || [];
        const ventasHoy = ventas.filter(v => {
            const fechaVenta = new Date(v.fecha);
            const fechaVentaStr = fechaVenta.toISOString().slice(0, 10);
            return fechaVentaStr === hoyStr;
        });

        // Calcular totales
        let totalEfectivo = 0, totalTransferencia = 0, totalTarjeta = 0, totalCredito = 0, totalMixto = 0, totalVentas = 0;
        ventasHoy.forEach(v => {
            const total = parseFloat(v.total) || 0;
            const metodo = (v.metodoPago || '').toLowerCase();
            if (metodo === 'mixto') {
                const efectivoMixto = parseFloat(v.montoRecibido) || 0;
                const transferenciaMixto = parseFloat(v.montoTransferencia) || 0;
                totalMixto += total;
                totalEfectivo += efectivoMixto;
                totalTransferencia += transferenciaMixto;
            } else {
                switch (metodo) {
                    case 'efectivo':
                        totalEfectivo += total;
                        break;
                    case 'transferencia':
                        totalTransferencia += total;
                        break;
                    case 'tarjeta':
                        totalTarjeta += total;
                        break;
                    case 'crédito':
                    case 'credito':
                        totalCredito += total;
                        break;
                }
            }
            totalVentas += total;
        });

        // Obtener gastos del día
        const gastos = JSON.parse(localStorage.getItem('gastos')) || [];
console.log('[BALANCE] Fuente de gastos:', gastos);
        const gastosHoy = gastos.filter(g => {
            const fechaGasto = new Date(g.fecha);
            if (ultimaHoraCierre) {
                return fechaGasto > ultimaHoraCierre;
            }
            const fechaGastoStr = fechaGasto.toISOString().slice(0, 10);
            return fechaGastoStr === hoyStr;
        });
        const totalGastos = gastosHoy.reduce((sum, g) => sum + (parseFloat(g.monto) || 0), 0);

        // Calcular balance final
        const balanceFinal = totalVentas - totalGastos;

        // Crear objeto de cierre
        const cierre = {
            fecha: hoy.toISOString(),
            ventas: {
                total: totalVentas,
                efectivo: totalEfectivo,
                transferencia: totalTransferencia,
                tarjeta: totalTarjeta,
                credito: totalCredito,
                mixto: totalMixto
            },
            gastos: totalGastos,
            balance: balanceFinal,
            nombreCierre: nombreCierre,
            nombreRecibe: nombreRecibe,
            montoBaseCaja: montoBaseCaja,
            detalles: document.getElementById('detallesCierre').value.trim()
        };

        // Guardar cierre en localStorage
        const historialCierres = JSON.parse(localStorage.getItem('historialCierres')) || [];
        historialCierres.push(cierre);
        localStorage.setItem('historialCierres', JSON.stringify(historialCierres));

        // Imprimir tirilla ANTES de reiniciar ventas y gastos
        imprimirBalanceDiario();

        // Enviar email automáticamente
        if (typeof enviarCierreAdministrativoEmail === 'function') {
          try {
            enviarCierreAdministrativoEmail(cierre);
            console.log('📧 Email de cierre administrativo enviado automáticamente');
          } catch (error) {
            console.error('Error al enviar email de cierre administrativo:', error);
          }
        }

        // Reiniciar sistema
        // Guardar ventas actuales en historial antes de reiniciar
        const ventasActuales = JSON.parse(localStorage.getItem('ventas')) || [];
        const historialVentas = JSON.parse(localStorage.getItem('historialVentas')) || [];
        ventasActuales.forEach(venta => {
            if (!historialVentas.some(v => v.id === venta.id)) {
                historialVentas.push(venta);
            }
        });
        localStorage.setItem('historialVentas', JSON.stringify(historialVentas));
        
        // Reiniciar ventas y gastos temporales
        localStorage.setItem('ventas', JSON.stringify([]));
        localStorage.setItem('gastos', JSON.stringify([])); // Solo reiniciamos los gastos temporales
        // NO reiniciamos historialGastos para mantener el historial completo
        // ... existing code ...

        // Actualizar la hora del último cierre
        localStorage.setItem('ultimaHoraCierre', new Date().toISOString());

        localStorage.setItem('contadorDelivery', '1');
        localStorage.setItem('contadorRecoger', '1');
        localStorage.setItem('mesasActivas', JSON.stringify([]));
    
        // REINICIO EXPLÍCITO DE CONTADORES GLOBALES Y FECHA
        contadorDomicilios = 0;
        contadorRecoger = 0;
        ultimaFechaContadores = new Date().toLocaleDateString();
        guardarContadores();
    
        // Refrescar variables globales y estado de la app
        cargarDatos();
    
    // Cerrar modal
    const modal = bootstrap.Modal.getInstance(document.getElementById('modalCierreDiario'));
    modal.hide();
    
    // Mostrar mensaje de éxito
    alert('Cierre diario guardado exitosamente');

    } catch (error) {
        console.error('Error al guardar cierre:', error);
        alert('Error al guardar el cierre');
    }
}

function exportarCierresDiariosExcel() {
    try {
        // Obtener cierres diarios
        const cierres = JSON.parse(localStorage.getItem('historialCierres')) || [];
        
        if (cierres.length === 0) {
            alert('No hay cierres diarios para exportar');
            return;
        }

        // Crear un nuevo libro de Excel
        const wb = XLSX.utils.book_new();
        
        // Preparar los datos para la hoja de cálculo
        const datos = cierres.map(cierre => ({
            'Fecha': new Date(cierre.fecha).toLocaleString(),
            'Total Ventas': cierre.ventas.total,
            'Efectivo': cierre.ventas.efectivo,
            'Transferencia': cierre.ventas.transferencia,
            'Tarjeta': cierre.ventas.tarjeta,
            'Crédito': cierre.ventas.credito,
            'Mixto': cierre.ventas.mixto,
            'Gastos': cierre.gastos,
            'Balance Final': cierre.balance,
            'Entrega': cierre.nombreCierre,
            'Recibe': cierre.nombreRecibe,
            'Base Caja': cierre.montoBaseCaja,
            'Detalles': cierre.detalles || ''
        }));

        // Crear la hoja de cálculo
        const ws = XLSX.utils.json_to_sheet(datos);

        // Ajustar el ancho de las columnas
        const anchos = [
            { wch: 20 }, // Fecha
            { wch: 15 }, // Total Ventas
            { wch: 15 }, // Efectivo
            { wch: 15 }, // Transferencia
            { wch: 15 }, // Tarjeta
            { wch: 15 }, // Crédito
            { wch: 15 }, // Mixto
            { wch: 15 }, // Gastos
            { wch: 15 }, // Balance Final
            { wch: 20 }, // Entrega
            { wch: 20 }, // Recibe
            { wch: 15 }, // Base Caja
            { wch: 40 }  // Detalles
        ];
        ws['!cols'] = anchos;

        // Agregar la hoja al libro
        XLSX.utils.book_append_sheet(wb, ws, 'Cierres Diarios');

        // Generar el archivo Excel
        const fecha = obtenerFechaLocalISO();
        XLSX.writeFile(wb, `Cierres_Diarios_${fecha}.xlsx`);
        
        alert('Archivo Excel generado exitosamente');
    } catch (error) {
        console.error('Error al exportar a Excel:', error);
        alert('Error al generar el archivo Excel');
    }
}

function imprimirBalanceDiario() {
    try {
        // Obtener ventas del día desde la clave 'ventas'
        const ventas = JSON.parse(localStorage.getItem('ventas')) || [];
        const hoy = new Date();
        const hoyStr = hoy.toISOString().slice(0, 10); // YYYY-MM-DD
        const ventasHoy = ventas.filter(v => {
            const fechaVenta = new Date(v.fecha);
            const fechaVentaStr = fechaVenta.toISOString().slice(0, 10);
            return fechaVentaStr === hoyStr;
        });

        // Calcular totales por método de pago
        let totalEfectivo = 0, totalTransferencia = 0, totalTarjeta = 0, totalCredito = 0, totalMixto = 0, totalVentas = 0;
        ventasHoy.forEach(v => {
            const total = parseFloat(v.total) || 0;
            const metodo = (v.metodoPago || '').toLowerCase();
            if (metodo === 'mixto') {
                const efectivoMixto = parseFloat(v.montoRecibido) || 0;
                const transferenciaMixto = parseFloat(v.montoTransferencia) || 0;
                totalMixto += total;
                totalEfectivo += efectivoMixto;
                totalTransferencia += transferenciaMixto;
            } else {
                switch (metodo) {
                    case 'efectivo':
                        totalEfectivo += total;
                        break;
                    case 'transferencia':
                        totalTransferencia += total;
                        break;
                    case 'tarjeta':
                        totalTarjeta += total;
                        break;
                    case 'crédito':
                    case 'credito':
                        totalCredito += total;
                        break;
                }
            }
            totalVentas += total;
        });

        // Obtener gastos del día
        const gastos = JSON.parse(localStorage.getItem('gastos')) || [];
console.log('[BALANCE] Fuente de gastos:', gastos);
        const gastosHoy = gastos.filter(g => {
            const fechaGasto = new Date(g.fecha);
            if (ultimaHoraCierre) {
                return fechaGasto > ultimaHoraCierre;
            }
            const fechaGastoStr = fechaGasto.toISOString().slice(0, 10);
            return fechaGastoStr === hoyStr;
        });
        const totalGastos = gastosHoy.reduce((sum, g) => sum + (parseFloat(g.monto) || 0), 0);

        // Calcular balance final
        const balanceFinal = totalVentas - totalGastos;

        // Obtener información del cierre
        const nombreCierre = document.getElementById('nombreCierre').value.trim();
        const nombreRecibe = document.getElementById('nombreRecibe').value.trim();
        const montoBaseCaja = parseFloat(document.getElementById('montoBaseCaja').value) || 0;
        const detalles = document.getElementById('detallesCierre').value;

        // Obtener información del negocio
        const datosNegocio = JSON.parse(localStorage.getItem('datosNegocio'));

        // Crear ventana de impresión
        let ventana;
        if (typeof obtenerVentanaImpresion === 'function') {
            ventana = obtenerVentanaImpresion();
        } else {
            ventana = window.open('', 'ImpresionBalance', 'width=400,height=600,scrollbars=yes');
            if (!ventana) {
                alert('Por favor, permite las ventanas emergentes para este sitio');
                return;
            }
        }
        let infoNegocio = '';
        if (datosNegocio && (
            datosNegocio.nombre || datosNegocio.nit || datosNegocio.direccion || datosNegocio.correo || datosNegocio.telefono
        )) {
            infoNegocio += '<div class="border-top mt-1">';
            if (datosNegocio.nombre) infoNegocio += `<div><strong>${datosNegocio.nombre}</strong></div>`;
            if (datosNegocio.nit) infoNegocio += `<div>NIT/Cédula: ${datosNegocio.nit}</div>`;
            if (datosNegocio.direccion) infoNegocio += `<div>Dirección: ${datosNegocio.direccion}</div>`;
            if (datosNegocio.correo) infoNegocio += `<div>Correo: ${datosNegocio.correo}</div>`;
            if (datosNegocio.telefono) infoNegocio += `<div>Teléfono: ${datosNegocio.telefono}</div>`;
            infoNegocio += '</div>';
        }

        const contenido = `
            <html>
                <head>
                    <title>Cierre Diario</title>
                    <style>
                        body { font-family: monospace; font-size: 14px; width: 57mm; margin: 0; padding: 1mm; }
                        .text-center { text-align: center; }
                        .text-right { text-align: right; }
                        .mb-1 { margin-bottom: 0.5mm; }
                        .mt-1 { margin-top: 0.5mm; }
                        .border-top { border-top: 1px dashed #000; margin-top: 1mm; padding-top: 1mm; }
                        .header { border-bottom: 1px dashed #000; padding-bottom: 1mm; margin-bottom: 1mm; }
                        .total-row { font-weight: bold; font-size: 16px; }
                        .botones-impresion { position: fixed; top: 10px; right: 10px; z-index: 1000; background: #fff; padding: 5px; border-radius: 5px; box-shadow: 0 2px 5px rgba(0,0,0,0.2); }
                        .botones-impresion button { margin: 0 5px; padding: 5px 10px; background: #007bff; color: white; border: none; border-radius: 3px; cursor: pointer; }
                        .botones-impresion button:hover { background: #0056b3; }
                        .logo-container { text-align: center; margin-bottom: 2mm; }
                        .logo-container img { max-width: 100%; max-height: 120px; }
                        @media print { .botones-impresion { display: none; } @page { margin: 0; size: 57mm auto; } body { width: 57mm; } }
                    </style>
                </head>
                <body>
                    <div class="botones-impresion">
                        <button onclick="window.print()">Imprimir</button>
                        <button onclick="window.close()">Cerrar</button>
                    </div>

                    <div class="header text-center">
                        <h2 style="margin: 0; font-size: 14px;">CIERRE DIARIO</h2>
                        <div class="mb-1">${hoy.toLocaleDateString()}</div>
                    </div>

                    <div class="border-top">
                        <div class="mb-1"><strong>Información de Cierre</strong></div>
                        <div class="mb-1">Entrega: ${nombreCierre}</div>
                        <div class="mb-1">Recibe: ${nombreRecibe}</div>
                        <div class="mb-1">Base Caja: $ ${montoBaseCaja.toLocaleString()}</div>
                    </div>
                    
                    <div class="border-top">
                        <div class="mb-1"><strong>Resumen de Ventas</strong></div>
                        <div class="mb-1">Total: $ ${totalVentas.toLocaleString()}</div>
                        <div class="mb-1">- Efectivo: $ ${totalEfectivo.toLocaleString()}</div>
                        <div class="mb-1">- Transferencia: $ ${totalTransferencia.toLocaleString()}</div>
                        <div class="mb-1">- Tarjeta: $ ${totalTarjeta.toLocaleString()}</div>
                        <div class="mb-1">- Crédito: $ ${totalCredito.toLocaleString()}</div>
                        <div class="mb-1">- Mixto: $ ${totalMixto.toLocaleString()}</div>
                    </div>
                    
                    <div class="border-top">
                        <div class="mb-1"><strong>Gastos</strong></div>
                        <div class="mb-1">Total: $ ${totalGastos.toLocaleString()}</div>
                    </div>
                    
                    <div class="border-top">
                        <div class="mb-1 total-row">Balance Final: $ ${balanceFinal.toLocaleString()}</div>
                    </div>

                    <div class="border-top mt-1">
                        <div class="mb-1"><strong>Detalle de Gastos:</strong></div>
                        ${gastosHoy.map(gasto => `
                            <div class="mb-1">- ${gasto.descripcion}: $ ${gasto.monto.toLocaleString()}</div>
                        `).join('')}
                    </div>

                    <div class="border-top mt-1">
                        <div class="mb-1"><strong>Créditos Pendientes:</strong></div>
                        ${ventasHoy.filter(v => (v.metodoPago || '').toLowerCase() === 'crédito').map(credito => `
                            <div class="mb-1">- ${credito.cliente || 'No especificado'}: $ ${credito.total.toLocaleString()}</div>
                        `).join('') || '<div class="mb-1">No hay créditos pendientes</div>'}
                    </div>

                    ${detalles ? `
                    <div class="border-top mt-1">
                        <div class="mb-1"><strong>Notas:</strong></div>
                        <div class="mb-1">${detalles}</div>
                    </div>
                    ` : ''}
                    
                    ${infoNegocio}
                    <div class="text-center mt-1">
                        <div class="border-top">¡Fin del Cierre!</div>
                        <div class="border-top">ToySoft POS</div>
                    </div>
                    
                    <div class="border-top text-center mt-3">
                        <div class="mb-1">Firma de Entrega: _________________</div>
                        <div class="mb-1">Firma de Recibe: _________________</div>
                    </div>
                </body>
            </html>
        `;
        ventana.document.write(contenido);
        ventana.document.close();
    } catch (error) {
        console.error('Error al imprimir balance:', error);
        alert('Error al generar el balance');
    }
}

// Función para mostrar historial de ventas
function mostrarHistorialVentas() {
  const tablaHistorial = document.getElementById('tablaHistorialVentas');
  const cuerpoTabla = tablaHistorial.querySelector('tbody');
  cuerpoTabla.innerHTML = '';

  // Obtener la fecha seleccionada del input
  const fechaSeleccionada = document.getElementById('fechaHistorialVentas').value;
  const fechaFiltro = fechaSeleccionada ? new Date(fechaSeleccionada) : new Date();

  // Filtrar ventas por fecha
  const ventasFiltradas = historialVentas.filter(venta => {
    const fechaVenta = new Date(venta.fecha);
    return fechaVenta.toDateString() === fechaFiltro.toDateString();
  });

  ventasFiltradas.forEach(venta => {
    const fila = document.createElement('tr');
    fila.innerHTML = `
      <td>${venta.fecha}</td>
      <td>${venta.tipo}</td>
      <td>${venta.cliente || '-'}</td>
      <td>${venta.total.toFixed(2)}</td>
      <td>${venta.metodoPago}</td>
      <td>
        <button class="btn btn-sm btn-info" onclick="reimprimirFactura('${venta.id}')">
          <i class="fas fa-print"></i>
        </button>
      </td>
    `;
    cuerpoTabla.appendChild(fila);
  });

  // Actualizar totales
  const totalVentas = ventasFiltradas.reduce((sum, venta) => sum + venta.total, 0);
  document.getElementById('totalVentasHistorial').textContent = totalVentas.toFixed(2);
}

// Función para mostrar historial de cocina
function mostrarHistorialCocina() {
  const tablaHistorial = document.getElementById('tablaHistorialCocina');
  const cuerpoTabla = tablaHistorial.querySelector('tbody');
  cuerpoTabla.innerHTML = '';

  // Obtener la fecha seleccionada del input
  const fechaSeleccionada = document.getElementById('fechaHistorialCocina').value;
  const fechaFiltro = fechaSeleccionada ? new Date(fechaSeleccionada) : new Date();

  // Filtrar órdenes por fecha
  const ordenesFiltradas = historialCocina.filter(orden => {
    const fechaOrden = new Date(orden.fecha);
    return fechaOrden.toDateString() === fechaFiltro.toDateString();
  });

  ordenesFiltradas.forEach(orden => {
    const fila = document.createElement('tr');
    fila.innerHTML = `
      <td>${orden.fecha}</td>
      <td>${orden.mesa || orden.tipo}</td>
      <td>${orden.cliente || '-'}</td>
      <td>${orden.items.map(item => item.nombre).join(', ')}</td>
      <td>
        <button class="btn btn-sm btn-info" onclick="reimprimirTicketCocina('${orden.id}')">
          <i class="fas fa-print"></i>
        </button>
      </td>
    `;
    cuerpoTabla.appendChild(fila);
  });
}

// Función para mostrar el modal de historial de ventas
function mostrarModalHistorialVentas() {
  const modal = new bootstrap.Modal(document.getElementById('modalHistorialVentas'));
  // Establecer la fecha actual por defecto
  document.getElementById('fechaHistorialVentas').valueAsDate = new Date();
  mostrarHistorialVentas();
  modal.show();
}

// Función para mostrar el modal de historial de cocina
function mostrarModalHistorialCocina() {
  const modal = new bootstrap.Modal(document.getElementById('modalHistorialCocina'));
  // Establecer la fecha actual por defecto
  document.getElementById('fechaHistorialCocina').valueAsDate = new Date();
  mostrarHistorialCocina();
  modal.show();
}

// Función para formatear número
function formatearNumero(num) {
  return num.toLocaleString('es-CO');
}

// Función para inicializar WhatsApp Web
function inicializarWhatsApp() {
    const container = document.getElementById('whatsappContainer');
    if (!container) return;

    // Crear el iframe
    const iframe = document.createElement('iframe');
    iframe.src = 'https://web.whatsapp.com';
    iframe.style.width = '100%';
    iframe.style.height = '100%';
    iframe.style.border = 'none';

    // Mensaje de carga
    const loadingDiv = document.createElement('div');
    loadingDiv.className = 'whatsapp-loading';
    loadingDiv.innerHTML = `
        <div class="spinner-border text-success" role="status">
            <span class="visually-hidden">Cargando...</span>
        </div>
        <p>Cargando WhatsApp Web...</p>
    `;

    container.appendChild(loadingDiv);

    // Manejar la carga del iframe
    iframe.onload = function() {
        loadingDiv.remove();
        container.appendChild(iframe);
    };

    iframe.onerror = function() {
        loadingDiv.innerHTML = `
            <div class="alert alert-danger" role="alert">
                <i class="fas fa-exclamation-circle"></i>
                Error al cargar WhatsApp Web
            </div>
            <button class="btn btn-primary mt-3" onclick="inicializarWhatsApp()">
                <i class="fas fa-redo"></i> Reintentar
            </button>
        `;
    };
}

// Inicializar WhatsApp cuando se carga la página
document.addEventListener('DOMContentLoaded', function() {
    inicializarWhatsApp();
});

// Función para mostrar/ocultar el panel de WhatsApp
function toggleWhatsApp() {
    const whatsappPanel = document.getElementById('whatsappPanel');
    const whatsappContainer = document.getElementById('whatsappContainer');
    
    if (whatsappPanel.style.display === 'none' || !whatsappPanel.style.display) {
        whatsappPanel.style.display = 'block';
        // Crear un iframe para WhatsApp Web
        whatsappContainer.innerHTML = `
            <iframe 
                src="https://web.whatsapp.com" 
                style="width: 100%; height: 600px; border: none;"
                allow="camera; microphone"
            ></iframe>
        `;
    } else {
        whatsappPanel.style.display = 'none';
        whatsappContainer.innerHTML = '';
    }
}

// Inicialización
document.addEventListener('DOMContentLoaded', () => {
  console.log('DOM cargado, iniciando aplicación...');
  
  // Cargar datos primero (esto ya incluye inicializarDatosPrueba y mostrarProductos)
  cargarDatos();
  
  // Inicializar WhatsApp Web
  inicializarWhatsApp();
  
  // Agregar evento para el botón de nueva mesa
  document.getElementById('btnNuevaMesa').addEventListener('click', crearNuevaMesa);
  
  // Agregar evento para la tecla Enter en el input de número de mesa
  document.getElementById('nuevaMesa').addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      crearNuevaMesa();
    }
  });
  
  // Actualizar total cuando cambian propina o descuento
  document.getElementById('propina').addEventListener('input', () => {
    if (mesaSeleccionada) {
      actualizarTotal(mesaSeleccionada);
    }
  });
  
  document.getElementById('descuento').addEventListener('input', () => {
    if (mesaSeleccionada) {
      actualizarTotal(mesaSeleccionada);
    }
  });
  
  document.getElementById('valorDomicilio').addEventListener('input', () => {
    if (mesaSeleccionada) {
      actualizarTotal(mesaSeleccionada);
    }
  });
});

// Función para mostrar el modal de configuración de cierre
function mostrarModalConfiguracionCierre() {
    const modal = new bootstrap.Modal(document.getElementById('modalConfiguracionCierre'));
    
    // Cargar la configuración actual
    const configGuardada = JSON.parse(localStorage.getItem('configuracionCierre') || '{}');
    
    document.getElementById('horaCierre').value = configGuardada.horaCierre || 11;
    document.getElementById('minutoCierre').value = configGuardada.minutoCierre || 30;
    document.getElementById('periodoCierre').value = configGuardada.periodo || 'PM';
    document.getElementById('activarHoraCierre').checked = configGuardada.activo || false;
    
    modal.show();
}

// Función para guardar la configuración de cierre
function guardarConfiguracionCierre() {
    const hora = parseInt(document.getElementById('horaCierre').value);
    const minuto = parseInt(document.getElementById('minutoCierre').value);
    const periodo = document.getElementById('periodoCierre').value;
    const activo = document.getElementById('activarHoraCierre').checked;

    if (hora < 1 || hora > 12) {
        alert('Por favor, ingrese una hora válida (1-12)');
        return;
    }

    if (minuto < 0 || minuto > 59) {
        alert('Por favor, ingrese minutos válidos (0-59)');
        return;
    }

    configurarHoraCierre(hora, minuto, periodo, activo);
    
    const modal = bootstrap.Modal.getInstance(document.getElementById('modalConfiguracionCierre'));
    modal.hide();

    if (activo) {
        alert(`Hora de cierre configurada: ${hora}:${minuto.toString().padStart(2, '0')} ${periodo}`);
    } else {
        alert('Configuración de hora de cierre desactivada. No habrá restricciones de horario.');
    }
}

// Funciones para gestionar gastos
function modificarGasto(id) {
    const gastos = JSON.parse(localStorage.getItem('historialGastos')) || [];
console.log('[BALANCE] Fuente de gastos: historialGastos', gastos);
    const gasto = gastos.find(g => g.id === id);
    
    if (!gasto) {
        alert('Gasto no encontrado');
        return;
    }

    // Llenar el formulario con los datos del gasto
    document.getElementById('descripcionGasto').value = gasto.descripcion;
    document.getElementById('montoGasto').value = gasto.monto;
    document.getElementById('fechaGasto').value = gasto.fecha.split('T')[0];
    
    // Cambiar el botón de guardar por uno de actualizar
    const btnGuardar = document.getElementById('btnGuardarGasto');
    btnGuardar.textContent = 'Actualizar Gasto';
    btnGuardar.onclick = () => actualizarGasto(id);
}

function actualizarGasto(id) {
    let historialGastos = JSON.parse(localStorage.getItem('historialGastos')) || [];
    const descripcion = document.getElementById('descripcionGasto').value;
    const monto = parseFloat(document.getElementById('montoGasto').value);
    const fecha = document.getElementById('fechaGasto').value;
    
    if (!descripcion || !monto || !fecha) {
        alert('Por favor, complete todos los campos');
        return;
    }
    
    const gastos = JSON.parse(localStorage.getItem('historialGastos')) || [];
console.log('[BALANCE] Fuente de gastos: historialGastos', gastos);
    const index = gastos.findIndex(g => g.id === id);
    
    if (index === -1) {
        alert('Gasto no encontrado');
        return;
    }
    
    const actualizado = {
        id,
        descripcion,
        monto,
        fecha: new Date(fecha).toISOString()
    };
    gastos[index] = actualizado;
    // Actualizar también en historialGastos
    const indexHist = historialGastos.findIndex(g => g.id === id);
    if (indexHist !== -1) {
        historialGastos[indexHist] = actualizado;
    }
    localStorage.setItem('gastos', JSON.stringify(gastos));
    localStorage.setItem('historialGastos', JSON.stringify(historialGastos));
    console.log('[GASTOS] Actualizado gasto:', actualizado);
    
    // Limpiar formulario
    document.getElementById('descripcionGasto').value = '';
    document.getElementById('montoGasto').value = '';
    document.getElementById('fechaGasto').value = '';
    
    // Restaurar el botón de guardar
    const btnGuardar = document.getElementById('btnGuardarGasto');
    btnGuardar.textContent = 'Guardar Gasto';
    btnGuardar.onclick = guardarGasto;
    
    mostrarGastos();
    alert('Gasto actualizado exitosamente');
}

function eliminarGasto(id) {
    let historialGastos = JSON.parse(localStorage.getItem('historialGastos')) || [];
    if (!confirm('¿Está seguro que desea eliminar este gasto?')) {
        return;
    }
    
    const gastos = JSON.parse(localStorage.getItem('historialGastos')) || [];
console.log('[BALANCE] Fuente de gastos: historialGastos', gastos);
    const gastosFiltrados = gastos.filter(g => g.id !== id);
    const historialFiltrado = historialGastos.filter(g => g.id !== id);
    localStorage.setItem('gastos', JSON.stringify(gastosFiltrados));
    localStorage.setItem('historialGastos', JSON.stringify(historialFiltrado));
    console.log('[GASTOS] Eliminado gasto id:', id);
    mostrarGastos();
    alert('Gasto eliminado exitosamente');
}

function mostrarGastos() {
    const tablaGastos = document.getElementById('tablaGastos');
    const cuerpoTabla = tablaGastos.querySelector('tbody');
    cuerpoTabla.innerHTML = '';
    
    const gastos = JSON.parse(localStorage.getItem('historialGastos')) || [];
console.log('[BALANCE] Fuente de gastos: historialGastos', gastos);
    
    gastos.forEach(gasto => {
        const fila = document.createElement('tr');
        fila.innerHTML = `
            <td>${new Date(gasto.fecha).toLocaleDateString()}</td>
            <td>${gasto.descripcion}</td>
            <td>$${gasto.monto.toLocaleString()}</td>
            <td>
                <button class="btn btn-sm btn-warning" onclick="modificarGasto(${gasto.id})">
                    <i class="fas fa-edit"></i>
                </button>
                <button class="btn btn-sm btn-danger" onclick="eliminarGasto(${gasto.id})">
                    <i class="fas fa-trash"></i>
                </button>
            </td>
        `;
        cuerpoTabla.appendChild(fila);
    });
}

function mostrarModalGastos() {
    const modalGastos = new bootstrap.Modal(document.getElementById('modalGastos'));
    modalGastos.show();
    mostrarGastos();
}

function guardarGasto() {
    // --- HISTORIAL GASTOS ---
    let historialGastos = JSON.parse(localStorage.getItem('historialGastos')) || [];
    const descripcion = document.getElementById('descripcionGasto').value;
    const monto = parseFloat(document.getElementById('montoGasto').value);
    const fecha = document.getElementById('fechaGasto').value;
    
    if (!descripcion || !monto || !fecha) {
        alert('Por favor, complete todos los campos');
        return;
    }
    
    const gastos = JSON.parse(localStorage.getItem('historialGastos')) || [];
console.log('[BALANCE] Fuente de gastos: historialGastos', gastos);
    const nuevoGasto = {
        id: Date.now(),
        descripcion,
        monto,
        fecha: new Date(fecha).toISOString()
    };
    
    gastos.push(nuevoGasto);
    historialGastos.push(nuevoGasto);
    localStorage.setItem('gastos', JSON.stringify(gastos));
    localStorage.setItem('historialGastos', JSON.stringify(historialGastos));
    console.log('[GASTOS] Guardado nuevo gasto:', nuevoGasto);
    
    // Limpiar formulario
    document.getElementById('descripcionGasto').value = '';
    document.getElementById('montoGasto').value = '';
    document.getElementById('fechaGasto').value = '';
    
    mostrarGastos();
    alert('Gasto guardado exitosamente');
}

// Función para mostrar vista previa del recibo
function mostrarVistaPreviaRecibo() {
  if (!mesaSeleccionada || !mesasActivas.has(mesaSeleccionada)) {
    alert('Por favor, seleccione una mesa con productos');
    return;
  }

  const pedido = mesasActivas.get(mesaSeleccionada);
  if (!pedido || !pedido.items || pedido.items.length === 0) {
    alert('No hay productos para generar recibo');
    return;
  }

  // Calcular totales
  const subtotal = pedido.items.reduce((sum, item) => sum + (item.precio * item.cantidad), 0);
  const propina = parseFloat(document.getElementById('propina').value) || 0;
  const descuento = parseFloat(document.getElementById('descuento').value) || 0;
  const valorDomicilio = mesaSeleccionada.startsWith('DOM-') ? (parseFloat(document.getElementById('valorDomicilio').value) || 0) : 0;
  const propinaMonto = Math.round((subtotal * propina) / 100);
  const total = Math.round(subtotal + propinaMonto - descuento + valorDomicilio);

  // Obtener la ventana de impresión
  const ventanaPrevia = obtenerVentanaImpresion();
  if (!ventanaPrevia) {
    alert('No se pudo abrir la ventana de impresión. Por favor, verifique que los bloqueadores de ventanas emergentes estén desactivados.');
    return;
  }

  // Determinar tipo de pedido e información adicional
  let tipoPedido = '';
  let infoAdicional = '';

  if (mesaSeleccionada.startsWith('DOM-')) {
    tipoPedido = 'Pedido a Domicilio';
    if (pedido.cliente) {
      infoAdicional = `
        <div class="border-top">
          <div class="mb-1"><strong>Cliente:</strong> <strong>${pedido.cliente}</strong></div>
          <div class="mb-1"><strong>Dir:</strong> <strong>${pedido.direccion || 'No especificada'}</strong></div>
          <div class="mb-1"><strong>Tel:</strong> <strong>${pedido.telefono || 'No especificado'}</strong></div>
        </div>
      `;
    }
  } else if (mesaSeleccionada.startsWith('REC-')) {
    tipoPedido = 'Pedido para Recoger';
    if (pedido.cliente) {
      infoAdicional = `
        <div class="border-top">
          <div class="mb-1"><strong>Cliente:</strong> <strong>${pedido.cliente}</strong></div>
          <div class="mb-1"><strong>Tel:</strong> <strong>${pedido.telefono || 'No especificado'}</strong></div>
          ${pedido.horaRecoger ? `<div class="mb-1"><strong>Hora:</strong> <strong>${pedido.horaRecoger}</strong></div>` : ''}
        </div>
      `;
    }
  }

  const contenidoRecibo = `
    <div class="logo-container">
      ${localStorage.getItem('logoNegocio') ? 
        `<img src="${localStorage.getItem('logoNegocio')}" alt="Logo">` : 
        ''}
    </div>

    <div class="header text-center">
      <h2 style="margin: 0; font-size: 14px;">RESTAURANTE</h2>
      <div class="mb-1">RECIBO PRELIMINAR</div>
      ${tipoPedido ? `<div class="mb-1">${tipoPedido}</div>` : ''}
      <div class="mb-1">${new Date().toLocaleString()}</div>
      ${!mesaSeleccionada.startsWith('DOM-') && !mesaSeleccionada.startsWith('REC-') ? 
        `<div class="mb-1">Mesa: ${mesaSeleccionada}</div>` : ''}
    </div>
    
    ${infoAdicional}
    
    <table>
      <thead>
        <tr>
          <th style="width: 40%">Producto</th>
          <th style="width: 15%">Cant</th>
          <th style="width: 20%">Precio</th>
          <th style="width: 25%">Total</th>
        </tr>
      </thead>
      <tbody>
        ${pedido.items.map(item => `
          <tr>
            <td><strong>${item.nombre}</strong></td>
            <td>${item.cantidad}</td>
            <td style="text-align:right;">${formatearNumero(item.precio)}</td>
            <td style="text-align:right;">${formatearNumero(item.precio * item.cantidad)}</td>
          </tr>
        `).join('')}
      </tbody>
    </table>
    
    <div class="border-top">
      <div class="mb-1"><strong>Subtotal:</strong> <span style="float:right;">${formatearNumero(subtotal)}</span></div>
      ${propina > 0 ? `<div class="mb-1"><strong>Propina (${propina}%):</strong> <span style="float:right;">${formatearNumero(propinaMonto)}</span></div>` : ''}
      ${descuento > 0 ? `<div class="mb-1"><strong>Descuento:</strong> <span style="float:right;">-${formatearNumero(descuento)}</span></div>` : ''}
      ${valorDomicilio > 0 ? `<div class="mb-1"><strong>Domicilio:</strong> <span style="float:right;">${formatearNumero(valorDomicilio)}</span></div>` : ''}
      <div class="mb-1 total-row"><strong>TOTAL:</strong> <span style="float:right;">${formatearNumero(total)}</span></div>
    </div>
    
    ${(() => {
      const datosNegocio = JSON.parse(localStorage.getItem('datosNegocio'));
      if (datosNegocio && Object.values(datosNegocio).some(valor => valor)) {
        return `
          <div class="border-top mt-1">
            ${datosNegocio.nombre ? `<div><strong>${datosNegocio.nombre}</strong></div>` : ''}
            ${datosNegocio.nit ? `<div>NIT/Cédula: ${datosNegocio.nit}</div>` : ''}
            ${datosNegocio.direccion ? `<div>Dirección: ${datosNegocio.direccion}</div>` : ''}
            ${datosNegocio.correo ? `<div>Correo: ${datosNegocio.correo}</div>` : ''}
            ${datosNegocio.telefono ? `<div>Teléfono: ${datosNegocio.telefono}</div>` : ''}
          </div>
        `;
      }
      return '';
    })()}
    
    <div class="text-center mt-1">
      <div class="border-top">¡Gracias por su visita!</div>
      <div class="border-top">ToySoft POS</div>
    </div>
  `;
  
  // Escribir el contenido completo en la ventana
  ventanaPrevia.document.write(`
    <!DOCTYPE html>
    <html>
      <head>
        <title>Vista Previa Recibo</title>
        <meta charset="UTF-8">
        <style>
          body { 
            font-family: monospace;
            font-size: 14px;
            width: 57mm;
            margin: 0;
            padding: 1mm;
          }
          .text-center { text-align: center; }
          .text-right { text-align: right; }
          .mb-1 { margin-bottom: 0.5mm; }
          .mt-1 { margin-top: 0.5mm; }
          table { 
            width: 100%;
            border-collapse: collapse;
            margin: 1mm 0;
            font-size: 14px;
          }
          th, td { 
            padding: 0.5mm;
            text-align: left;
            font-size: 14px;
          }
          .border-top { 
            border-top: 1px dashed #000;
            margin-top: 1mm;
            padding-top: 1mm;
          }
          .header {
            border-bottom: 1px dashed #000;
            padding-bottom: 1mm;
            margin-bottom: 1mm;
          }
          .total-row {
            font-weight: bold;
            font-size: 16px;
          }
          .logo-container {
            text-align: center;
            margin-bottom: 2mm;
          }
          .logo-container img {
            max-width: 100%;
            max-height: 120px;
          }
          .botones-impresion {
            position: fixed;
            top: 10px;
            right: 10px;
            z-index: 1000;
            background: #fff;
            padding: 5px;
            border-radius: 5px;
            box-shadow: 0 2px 5px rgba(0,0,0,0.2);
          }
          .botones-impresion button {
            margin: 0 5px;
            padding: 5px 10px;
            background: #007bff;
            color: white;
            border: none;
            border-radius: 3px;
            cursor: pointer;
          }
          .botones-impresion button:hover {
            background: #0056b3;
          }
          @media print {
            .botones-impresion {
              display: none;
            }
            @page {
              margin: 0;
              size: 57mm auto;
            }
            body {
              width: 57mm;
            }
          }
        </style>
      </head>
      <body>
        <div class="botones-impresion">
          <button onclick="window.print()">Imprimir</button>
          <button onclick="window.close()">Cerrar</button>
        </div>
        <div id="contenido">
          ${contenidoRecibo}
        </div>
      </body>
    </html>
  `);
  
  // Cerrar el documento y enfocar la ventana
  ventanaPrevia.document.close();
  ventanaPrevia.focus();
}

// Función para generar recibo preliminar
function generarReciboPreliminar() {
  if (!mesaSeleccionada || !mesasActivas.has(mesaSeleccionada)) {
    alert('Por favor, seleccione una mesa con productos');
    return;
  }

  const pedido = mesasActivas.get(mesaSeleccionada);
  if (!pedido || !pedido.items || pedido.items.length === 0) {
    alert('No hay productos para generar recibo');
    return;
  }

  // Calcular totales
  const subtotal = pedido.items.reduce((sum, item) => sum + (item.precio * item.cantidad), 0);
  const propina = parseFloat(document.getElementById('propina').value) || 0;
  const descuento = parseFloat(document.getElementById('descuento').value) || 0;
  const valorDomicilio = mesaSeleccionada.startsWith('DOM-') ? (parseFloat(document.getElementById('valorDomicilio').value) || 0) : 0;
  const propinaMonto = Math.round((subtotal * propina) / 100);
  const total = Math.round(subtotal + propinaMonto - descuento + valorDomicilio);

  // Obtener la ventana de impresión
  const ventanaPrevia = obtenerVentanaImpresion();
  if (!ventanaPrevia) {
    alert('No se pudo abrir la ventana de impresión. Por favor, verifique que los bloqueadores de ventanas emergentes estén desactivados.');
    return;
  }

  // Determinar tipo de pedido e información adicional
  let tipoPedido = '';
  let infoAdicional = '';

  if (mesaSeleccionada.startsWith('DOM-')) {
    tipoPedido = 'Pedido a Domicilio';
    if (pedido.cliente) {
      infoAdicional = `
        <div class="border-top">
          <div class="mb-1"><strong>Cliente:</strong> <strong>${pedido.cliente}</strong></div>
          <div class="mb-1"><strong>Dir:</strong> <strong>${pedido.direccion || 'No especificada'}</strong></div>
          <div class="mb-1"><strong>Tel:</strong> <strong>${pedido.telefono || 'No especificado'}</strong></div>
        </div>
      `;
    }
  } else if (mesaSeleccionada.startsWith('REC-')) {
    tipoPedido = 'Pedido para Recoger';
    if (pedido.cliente) {
      infoAdicional = `
        <div class="border-top">
          <div class="mb-1"><strong>Cliente:</strong> <strong>${pedido.cliente}</strong></div>
          <div class="mb-1"><strong>Tel:</strong> <strong>${pedido.telefono || 'No especificado'}</strong></div>
          ${pedido.horaRecoger ? `<div class="mb-1"><strong>Hora:</strong> <strong>${pedido.horaRecoger}</strong></div>` : ''}
        </div>
      `;
    }
  }

  const contenidoRecibo = `
    <div class="logo-container">
      ${localStorage.getItem('logoNegocio') ? 
        `<img src="${localStorage.getItem('logoNegocio')}" alt="Logo">` : 
        ''}
    </div>

    <div class="header text-center">
      <h2 style="margin: 0; font-size: 14px;">RESTAURANTE</h2>
      <div class="mb-1">RECIBO PRELIMINAR</div>
      ${tipoPedido ? `<div class="mb-1">${tipoPedido}</div>` : ''}
      <div class="mb-1">${new Date().toLocaleString()}</div>
      ${!mesaSeleccionada.startsWith('DOM-') && !mesaSeleccionada.startsWith('REC-') ? 
        `<div class="mb-1">Mesa: ${mesaSeleccionada}</div>` : ''}
    </div>
    
    ${infoAdicional}
    
    <table>
      <thead>
        <tr>
          <th style="width: 40%">Producto</th>
          <th style="width: 15%">Cant</th>
          <th style="width: 20%">Precio</th>
          <th style="width: 25%">Total</th>
        </tr>
      </thead>
      <tbody>
        ${pedido.items.map(item => `
          <tr>
            <td><strong>${item.nombre}</strong></td>
            <td>${item.cantidad}</td>
            <td style="text-align:right;">${formatearNumero(item.precio)}</td>
            <td style="text-align:right;">${formatearNumero(item.precio * item.cantidad)}</td>
          </tr>
        `).join('')}
      </tbody>
    </table>
    
    <div class="border-top">
      <div class="mb-1">Subtotal: <span class="text-right">$ ${formatearNumero(subtotal)}</span></div>
      <div class="mb-1">Propina (${propina}%): <span class="text-right">$ ${formatearNumero(propinaMonto)}</span></div>
      <div class="mb-1">Descuento: <span class="text-right">$ ${formatearNumero(descuento)}</span></div>
      ${valorDomicilio > 0 ? `<div class="mb-1">Domicilio: <span class="text-right">$ ${formatearNumero(valorDomicilio)}</span></div>` : ''}
      <div class="mb-1 total-row"><strong>Total: $ ${formatearNumero(total)}</strong></div>
    </div>
    
    <div class="text-center mt-1">
      <div class="border-top">RECIBO PRELIMINAR - NO VÁLIDO COMO FACTURA</div>
      <div class="border-top">ToySoft POS</div>
    </div>
  `;

  // Escribir el contenido completo en la ventana
  ventanaPrevia.document.write(`
    <!DOCTYPE html>
    <html>
      <head>
        <title>Recibo Preliminar</title>
        <meta charset="UTF-8">
        <style>
          body { 
            font-family: monospace;
            font-size: 14px;
            width: 57mm;
            margin: 0;
            padding: 1mm;
          }
          .text-center { text-align: center; }
          .text-right { text-align: right; }
          .mb-1 { margin-bottom: 0.5mm; }
          .mt-1 { margin-top: 0.5mm; }
          table { 
            width: 100%;
            border-collapse: collapse;
            margin: 1mm 0;
            font-size: 14px;
          }
          th, td { 
            padding: 0.5mm;
            text-align: left;
            font-size: 14px;
          }
          .border-top { 
            border-top: 1px dashed #000;
            margin-top: 1mm;
            padding-top: 1mm;
          }
          .header {
            border-bottom: 1px dashed #000;
            padding-bottom: 1mm;
            margin-bottom: 1mm;
          }
          .total-row {
            font-weight: bold;
            font-size: 16px;
          }
          .logo-container {
            text-align: center;
            margin-bottom: 2mm;
          }
          .logo-container img {
            max-width: 100%;
            max-height: 120px;
          }
          .botones-impresion {
            position: fixed;
            top: 10px;
            right: 10px;
            z-index: 1000;
            background: #fff;
            padding: 5px;
            border-radius: 5px;
            box-shadow: 0 2px 5px rgba(0,0,0,0.2);
          }
          .botones-impresion button {
            margin: 0 5px;
            padding: 5px 10px;
            background: #007bff;
            color: white;
            border: none;
            border-radius: 3px;
            cursor: pointer;
          }
          .botones-impresion button:hover {
            background: #0056b3;
          }
          @media print {
            .botones-impresion {
              display: none;
            }
            @page {
              margin: 0;
              size: 57mm auto;
            }
            body {
              width: 57mm;
            }
          }
        </style>
      </head>
      <body>
        <div class="botones-impresion">
          <button onclick="window.print()">Imprimir</button>
          <button onclick="window.close()">Cerrar</button>
        </div>
        <div id="contenido">
          ${contenidoRecibo}
        </div>
      </body>
    </html>
  `);
  
  // Cerrar el documento y enfocar la ventana
  ventanaPrevia.document.close();
  ventanaPrevia.focus();
}

function imprimirBalancePorPeriodo(tipoPeriodo) {
    try {
        // Obtener ventas desde la clave 'ventas'
        const ventas = JSON.parse(localStorage.getItem('ventas')) || [];
        const hoy = new Date();
        let fechaInicio, fechaFin;
        // Determinar el rango de fechas según el tipo de período
        switch(tipoPeriodo) {
            case 'semanal':
                fechaInicio = new Date(hoy);
                fechaInicio.setDate(hoy.getDate() - hoy.getDay() + 1);
                fechaInicio.setHours(0, 0, 0, 0);
                fechaFin = new Date(fechaInicio);
                fechaFin.setDate(fechaInicio.getDate() + 6);
                fechaFin.setHours(23, 59, 59, 999);
                break;
            case 'mensual':
                fechaInicio = new Date(hoy.getFullYear(), hoy.getMonth(), 1);
                fechaInicio.setHours(0, 0, 0, 0);
                fechaFin = new Date(hoy.getFullYear(), hoy.getMonth() + 1, 0);
                fechaFin.setHours(23, 59, 59, 999);
                break;
            case 'anual':
                fechaInicio = new Date(hoy.getFullYear(), 0, 1);
                fechaInicio.setHours(0, 0, 0, 0);
                fechaFin = new Date(hoy.getFullYear(), 11, 31);
                fechaFin.setHours(23, 59, 59, 999);
                break;
            default:
                throw new Error('Tipo de período no válido');
        }
        // Filtrar ventas por rango de fechas
        const ventasFiltradas = ventas.filter(v => {
            const fechaVenta = new Date(v.fecha);
            return fechaVenta >= fechaInicio && fechaVenta <= fechaFin;
        });
        // Calcular totales por método de pago
        let totalEfectivo = 0, totalTransferencia = 0, totalTarjeta = 0, totalCredito = 0, totalMixto = 0, totalVentas = 0;
        ventasFiltradas.forEach(v => {
            const total = parseFloat(v.total) || 0;
            const metodo = (v.metodoPago || '').toLowerCase();
            if (metodo === 'mixto') {
                const efectivoMixto = parseFloat(v.montoRecibido) || 0;
                const transferenciaMixto = parseFloat(v.montoTransferencia) || 0;
                totalMixto += total;
                totalEfectivo += efectivoMixto;
                totalTransferencia += transferenciaMixto;
            } else {
                switch (metodo) {
                    case 'efectivo':
                        totalEfectivo += total;
                        break;
                    case 'transferencia':
                        totalTransferencia += total;
                        break;
                    case 'tarjeta':
                        totalTarjeta += total;
                        break;
                    case 'crédito':
                        totalCredito += total;
                        break;
                }
            }
            totalVentas += total;
        });
        // Obtener gastos del período
        const gastos = JSON.parse(localStorage.getItem('historialGastos')) || [];
console.log('[BALANCE] Fuente de gastos: historialGastos', gastos);
        const gastosFiltrados = gastos.filter(gasto => {
            const fechaGasto = new Date(gasto.fecha);
            return fechaGasto >= fechaInicio && fechaGasto <= fechaFin;
        });
        const totalGastos = gastosFiltrados.reduce((sum, g) => sum + (parseFloat(g.monto) || 0), 0);
        // Calcular balance final
        const balanceFinal = totalVentas - totalGastos;
        // Formatear fechas para mostrar
        const formatoFecha = (fecha) => {
            return fecha.toLocaleDateString('es-ES', {
                year: 'numeric',
                month: 'long',
                day: 'numeric'
            });
        };

        // Crear una ventana modal en lugar de una nueva ventana
        const modal = document.createElement('div');
        modal.className = 'modal fade';
        modal.id = 'modalBalance';
        modal.setAttribute('tabindex', '-1');
        modal.setAttribute('role', 'dialog');
        modal.setAttribute('aria-labelledby', 'modalBalanceLabel');
        modal.setAttribute('aria-hidden', 'true');
        
        modal.innerHTML = `
            <div class="modal-dialog modal-lg">
                <div class="modal-content bg-dark text-white">
                    <div class="modal-header">
                        <h5 class="modal-title" id="modalBalanceLabel">Balance ${tipoPeriodo.charAt(0).toUpperCase() + tipoPeriodo.slice(1)}</h5>
                        <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal" aria-label="Close"></button>
                    </div>
                    <div class="modal-body">
                        <div class="text-center mb-3">
                            <h4>Del ${formatoFecha(fechaInicio)}</h4>
                            <h4>Al ${formatoFecha(fechaFin)}</h4>
                        </div>
                        <div class="border-top border-light pt-3 mb-3">
                            <h5>Total Ventas: $ ${totalVentas.toLocaleString()}</h5>
                            <div>- Efectivo: $ ${totalEfectivo.toLocaleString()}</div>
                            <div>- Transferencia: $ ${totalTransferencia.toLocaleString()}</div>
                            <div>- Tarjeta: $ ${totalTarjeta.toLocaleString()}</div>
                            <div>- Crédito: $ ${totalCredito.toLocaleString()}</div>
                        </div>
                        <div class="border-top border-light pt-3 mb-3">
                            <h5>Total Gastos: $ ${totalGastos.toLocaleString()}</h5>
                        </div>
                        <div class="border-top border-light pt-3 mb-3">
                            <h5>Balance Final: $ ${balanceFinal.toLocaleString()}</h5>
                        </div>
                        <div class="border-top border-light pt-3 mb-3">
                            <h5>Detalle de Gastos:</h5>
                            ${gastosFiltrados.map(gasto => `
                                <div>- ${gasto.descripcion}: $ ${gasto.monto.toLocaleString()}</div>
                            `).join('')}
                        </div>
                        <div class="border-top border-light pt-3">
                            <h5>Créditos Pendientes:</h5>
                            ${ventasFiltradas.filter(v => (v.metodoPago || '').toLowerCase() === 'crédito').map(credito => `
                                <div>- ${credito.cliente || 'No especificado'}: $ ${credito.total.toLocaleString()}</div>
                            `).join('') || '<div>No hay créditos pendientes</div>'}
                        </div>
                        
                        <div class="border-top border-light pt-3 text-center">
                            <div class="mb-1">Firma de Entrega: _________________</div>
                            <div class="mb-1">Firma de Recibe: _________________</div>
                        </div>
                    </div>
                    <div class="modal-footer">
                        <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cerrar</button>
                        <button type="button" class="btn btn-primary" onclick="imprimirBalanceModal()">Imprimir</button>
                    </div>
                </div>
            </div>
        `;

        // Agregar el modal al body
        document.body.appendChild(modal);

        // Inicializar el modal de Bootstrap
        const modalInstance = new bootstrap.Modal(modal);
        modalInstance.show();

        // Limpiar el modal cuando se cierre
        modal.addEventListener('hidden.bs.modal', function () {
            document.body.removeChild(modal);
        });

    } catch (error) {
        console.error('Error al generar balance:', error);
        alert('Error al generar el balance: ' + error.message);
    }
}

// Función para imprimir el balance desde el modal
function imprimirBalanceModal() {
    const modalContent = document.querySelector('#modalBalance .modal-content');
    const ventana = window.open('', '_blank');
    
    ventana.document.write(`
        <html>
            <head>
                <title>Balance</title>
                <style>
                    body { 
                        font-family: monospace;
                        font-size: 14px;
                        width: 57mm;
                        margin: 0;
                        padding: 1mm;
                    }
                    .text-center { text-align: center; }
                    .text-right { text-align: right; }
                    .mb-1 { margin-bottom: 0.5mm; }
                    .mt-1 { margin-top: 0.5mm; }
                    .border-top { 
                        border-top: 1px dashed #000;
                        margin-top: 1mm;
                        padding-top: 1mm;
                    }
                    @media print {
                        @page {
                            margin: 0;
                            size: 57mm auto;
                        }
                        body {
                            width: 57mm;
                        }
                    }
                </style>
            </head>
            <body>
                ${modalContent.innerHTML}
            </body>
        </html>
    `);
    
    ventana.document.close();
    ventana.print();
}

// Función para verificar y reiniciar contadores si es un nuevo día
function verificarContadoresDiarios() {
  const fechaActual = new Date().toLocaleDateString();
  
  // Si no hay fecha guardada o es un nuevo día, reiniciar contadores
  if (!ultimaFechaContadores || ultimaFechaContadores !== fechaActual) {
    contadorDomicilios = 0;
    contadorRecoger = 0;
    ultimaFechaContadores = fechaActual;
    guardarContadores();
  }
}

// Función para cargar contadores desde localStorage
function cargarContadores() {
  contadorDomicilios = parseInt(localStorage.getItem('contadorDomicilios')) || 0;
  contadorRecoger = parseInt(localStorage.getItem('contadorRecoger')) || 0;
  ultimaFechaContadores = localStorage.getItem('ultimaFechaContadores');
  verificarContadoresDiarios();
}

// Funciones para manejar cotizaciones
function mostrarModalCotizaciones() {
  try {
    actualizarTablaCotizaciones();
    const modal = new bootstrap.Modal(document.getElementById('modalCotizaciones'));
    modal.show();
  } catch (error) {
    console.error('Error al mostrar las cotizaciones:', error);
    alert('Error al mostrar las cotizaciones');
  }
}

// Función para mostrar el modal de nueva cotización
function mostrarModalNuevaCotizacion() {
  try {
    // Verificar que el modal existe
    const modalElement = document.getElementById('modalNuevaCotizacion');
    if (!modalElement) {
      throw new Error('El modal de nueva cotización no existe en el DOM');
    }

    // Inicializar arrays si no existen
    if (!Array.isArray(window.itemsCotizacion)) {
      window.itemsCotizacion = [];
    }
    if (!Array.isArray(window.productosFiltrados)) {
      window.productosFiltrados = [];
    }

    // Verificar y establecer fecha actual
    const fechaInput = document.getElementById('fechaCotizacion');
    if (!fechaInput) {
      throw new Error('El campo de fecha no existe');
    }
    const hoy = new Date();
    fechaInput.value = hoy.toISOString().split('T')[0];

    // Verificar y cargar clientes
    const selectCliente = document.getElementById('clienteCotizacion');
    if (!selectCliente) {
      throw new Error('El selector de clientes no existe');
    }
    selectCliente.innerHTML = '<option value="">Seleccionar cliente</option>';
    const clientes = JSON.parse(localStorage.getItem('clientes')) || [];
    clientes.forEach(cliente => {
      const option = document.createElement('option');
      option.value = cliente.id;
      option.textContent = cliente.nombre;
      selectCliente.appendChild(option);
    });

    // Limpiar campos de búsqueda y resultados
    const buscarProducto = document.getElementById('buscarProducto');
    if (buscarProducto) {
      buscarProducto.value = '';
    }
    const resultadosBusqueda = document.getElementById('resultadosBusqueda');
    if (resultadosBusqueda) {
      resultadosBusqueda.innerHTML = '';
      resultadosBusqueda.style.display = 'none';
    }
    const productoManual = document.getElementById('productoManual');
    if (productoManual) {
      productoManual.value = '';
      productoManual.style.display = 'none';
    }

    // Limpiar tabla de items
    const tablaItems = document.getElementById('itemsCotizacion');
    if (!tablaItems) {
      throw new Error('La tabla de items no existe');
    }
    tablaItems.innerHTML = '';

    // Actualizar total
    actualizarTotalCotizacion();

    // Cerrar el modal de cotizaciones primero
    const modalCotizaciones = bootstrap.Modal.getInstance(document.getElementById('modalCotizaciones'));
    if (modalCotizaciones) {
      modalCotizaciones.hide();
    }

    // Mostrar el modal de nueva cotización
    const modal = new bootstrap.Modal(modalElement, {
      backdrop: 'static',
      keyboard: false
    });
    modal.show();

    // Asegurar que el modal esté por encima
    modalElement.style.zIndex = '1060';

    // Cargar productos iniciales
    filtrarProductosCotizacion();
  } catch (error) {
    console.error('Error detallado:', error);
    alert(`Error al mostrar el formulario de nueva cotización: ${error.message}`);
  }
}

function agregarItemCotizacion() {
  try {
    const producto = document.getElementById('productoManual').style.display === 'none' 
      ? document.getElementById('buscarProducto').value
      : document.getElementById('productoManual').value;
    const cantidad = parseInt(document.getElementById('cantidadItem').value) || 1;
    const precio = parseFloat(document.getElementById('precioItem').value) || 0;

    if (!producto) {
      alert('Por favor, seleccione o escriba un producto');
      return;
    }

    if (cantidad <= 0) {
      alert('La cantidad debe ser mayor a 0');
      return;
    }

    if (precio <= 0) {
      alert('El precio debe ser mayor a 0');
      return;
    }

    const item = {
      id: Date.now(),
      producto: producto,
      cantidad: cantidad,
      precio: precio,
      subtotal: cantidad * precio
    };

    // Agregar el item al array global
    if (!Array.isArray(window.itemsCotizacion)) {
      window.itemsCotizacion = [];
    }
    window.itemsCotizacion.push(item);
    actualizarTablaItemsCotizacion();
    actualizarTotalCotizacion();

    // Limpiar campos
    document.getElementById('buscarProducto').value = '';
    document.getElementById('productoManual').value = '';
    document.getElementById('cantidadItem').value = '1';
    document.getElementById('precioItem').value = '';
    document.getElementById('resultadosBusqueda').style.display = 'none';

    // Volver a mostrar la lista de productos disponibles
    if (typeof filtrarProductosCotizacion === 'function') {
      filtrarProductosCotizacion();
    } else if (typeof buscarProductosCotizacion === 'function') {
      buscarProductosCotizacion();
    }
  } catch (error) {
    console.error('Error al agregar item:', error);
    alert('Error al agregar el item a la cotización');
  }
}

function mostrarItemsCotizacion() {
    const tabla = document.getElementById('tablaItemsCotizacion');
    if (!tabla) return;

    tabla.innerHTML = '';
    
    if (!cotizacionActual || !cotizacionActual.items || cotizacionActual.items.length === 0) {
        tabla.innerHTML = '<tr><td colspan="4" class="text-center">No hay items en la cotización</td></tr>';
        return;
    }

    cotizacionActual.items.forEach(item => {
        const fila = document.createElement('tr');
        fila.innerHTML = `
            <td>${item.nombre}</td>
            <td>${item.cantidad}</td>
            <td style="text-align:right;">${formatearPrecio(item.precio)}</td>
            <td style="text-align:right;">${formatearPrecio(item.subtotal)}</td>
            <td>
                <button class="btn btn-danger btn-sm" onclick="eliminarItemCotizacion(${item.id})">
                    <i class="fas fa-trash"></i>
                </button>
            </td>
        `;
        tabla.appendChild(fila);
    });

    // Actualizar total
    const totalElement = document.getElementById('totalCotizacion');
    if (totalElement) {
        totalElement.textContent = formatearPrecio(cotizacionActual.total);
    }
}

function limpiarFormularioItem() {
    document.getElementById('cantidadItem').value = '';
    document.getElementById('precioItem').value = '';
    document.getElementById('buscarProducto').value = '';
    document.getElementById('productoManual').value = '';
    document.getElementById('resultadosBusqueda').innerHTML = '';
}

function eliminarItemCotizacion(id) {
    if (!cotizacionActual) return;
    
    cotizacionActual.items = cotizacionActual.items.filter(item => item.id !== id);
    cotizacionActual.total = cotizacionActual.items.reduce((sum, item) => sum + item.subtotal, 0);
    
    actualizarTablaItemsCotizacion();
}

function guardarCotizacion() {
    try {
        const clienteId = document.getElementById('clienteCotizacion').value;
        const fecha = document.getElementById('fechaCotizacion').value;

        if (!clienteId) {
            alert('Por favor, seleccione un cliente');
            return;
        }

        if (!fecha) {
            alert('Por favor, seleccione una fecha');
            return;
        }

        if (window.itemsCotizacion.length === 0) {
            alert('Por favor, agregue al menos un item a la cotización');
            return;
        }

        const cotizacion = {
            id: Date.now(),
            fecha: fecha,
            clienteId: clienteId,
            items: window.itemsCotizacion,
            total: window.itemsCotizacion.reduce((sum, item) => sum + item.subtotal, 0)
        };

        // Guardar en localStorage
        const cotizaciones = JSON.parse(localStorage.getItem('cotizaciones')) || [];
        cotizaciones.push(cotizacion);
        localStorage.setItem('cotizaciones', JSON.stringify(cotizaciones));

        // Cerrar modal y limpiar
        const modal = bootstrap.Modal.getInstance(document.getElementById('modalNuevaCotizacion'));
        modal.hide();
        window.itemsCotizacion = [];
        actualizarTablaCotizaciones();

        alert('Cotización guardada exitosamente');
    } catch (error) {
        console.error('Error al guardar cotización:', error);
        alert('Error al guardar la cotización');
    }
}

function mostrarCotizaciones() {
    const tabla = document.getElementById('tablaCotizaciones');
    if (!tabla) return;

    tabla.innerHTML = '';
    
    if (!cotizaciones || cotizaciones.length === 0) {
        tabla.innerHTML = '<tr><td colspan="5" class="text-center">No hay cotizaciones</td></tr>';
        return;
    }

    cotizaciones.forEach(cotizacion => {
        const fila = document.createElement('tr');
        fila.innerHTML = `
            <td>${formatearFecha(cotizacion.fecha)}</td>
            <td>${cotizacion.cliente.nombre}</td>
            <td>${cotizacion.items.length} items</td>
            <td style="text-align:right;">${formatearPrecio(cotizacion.total)}</td>
            <td>
                <button class="btn btn-info btn-sm" onclick="verCotizacion(${cotizacion.id})">
                    <i class="fas fa-eye"></i>
                </button>
                <button class="btn btn-danger btn-sm" onclick="eliminarCotizacion(${cotizacion.id})">
                    <i class="fas fa-trash"></i>
                </button>
            </td>
        `;
        tabla.appendChild(fila);
    });
}

function verCotizacion(id) {
    const cotizaciones = JSON.parse(localStorage.getItem('cotizaciones')) || [];
    const clientes = JSON.parse(localStorage.getItem('clientes')) || [];
    const cotizacion = cotizaciones.find(c => c.id === id);
    
    if (!cotizacion) {
        alert('Cotización no encontrada');
        return;
    }

    const cliente = clientes.find(c => c.id === cotizacion.clienteId);
    
    // Mostrar detalles en el modal
    document.getElementById('fechaCotizacionVer').textContent = formatearFecha(cotizacion.fecha);
    document.getElementById('clienteCotizacionVer').textContent = cliente ? cliente.nombre : 'Cliente no encontrado';
    
    const tbody = document.getElementById('tablaItemsCotizacionVer');
    tbody.innerHTML = '';
    cotizacion.items.forEach(item => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${item.producto}</td>
            <td>${item.cantidad}</td>
            <td style="text-align:right;">${formatearPrecio(item.precio)}</td>
            <td style="text-align:right;">${formatearPrecio(item.subtotal)}</td>
        `;
        tbody.appendChild(tr);
    });
    
    document.getElementById('totalCotizacionVer').textContent = formatearPrecio(cotizacion.total);
    
    const modal = new bootstrap.Modal(document.getElementById('modalVerCotizacion'));
    modal.show();
}

function eliminarCotizacion(id) {
    if (confirm('¿Está seguro de eliminar esta cotización?')) {
        const cotizaciones = JSON.parse(localStorage.getItem('cotizaciones')) || [];
        const nuevasCotizaciones = cotizaciones.filter(c => c.id !== id);
        localStorage.setItem('cotizaciones', JSON.stringify(nuevasCotizaciones));
        actualizarTablaCotizaciones();
    }
}

function limpiarFormularioCotizacion() {
    cotizacionActual = null;
    document.getElementById('clienteCotizacion').value = '';
    document.getElementById('fechaCotizacion').value = obtenerFechaLocalISO();
    document.getElementById('tablaItemsCotizacion').innerHTML = '';
    document.getElementById('totalCotizacion').textContent = formatearPrecio(0);
}

function buscarProductosCotizacion() {
    const busqueda = document.getElementById('buscarProducto').value.toLowerCase();
    const categoria = document.getElementById('categoriaProducto').value;
    
    let resultados = productos;
    
    if (busqueda) {
        resultados = resultados.filter(p => 
            p.nombre.toLowerCase().includes(busqueda) ||
            p.categoria.toLowerCase().includes(busqueda)
        );
    }
    
    if (categoria) {
        resultados = resultados.filter(p => p.categoria === categoria);
    }
    
    const resultadosDiv = document.getElementById('resultadosBusqueda');
    resultadosDiv.innerHTML = '';
    
    if (resultados.length === 0) {
        resultadosDiv.innerHTML = '<p class="text-muted">No se encontraron productos</p>';
        return;
    }
    
    resultados.forEach(producto => {
        const div = document.createElement('div');
        div.className = 'resultado-busqueda';
        div.innerHTML = `
            <div class="d-flex justify-content-between align-items-center">
                <div>
                    <strong>${producto.nombre}</strong>
                    <br>
                    <small class="text-muted">${producto.categoria}</small>
                </div>
                <button class="btn btn-primary btn-sm" onclick="seleccionarProducto(${producto.id})">
                    Seleccionar
                </button>
            </div>
        `;
        resultadosDiv.appendChild(div);
    });
}

function seleccionarProducto(id) {
    const producto = productos.find(p => p.id === id);
    if (!producto) return;

    document.getElementById('buscarProducto').value = producto.nombre;
    document.getElementById('precioItem').value = producto.precio;
    document.getElementById('resultadosBusqueda').innerHTML = '';
}

function actualizarTablaItemsCotizacion() {
    const tabla = document.getElementById('tablaItemsCotizacion');
    if (!tabla || !cotizacionActual) return;

    tabla.innerHTML = '';
    
    cotizacionActual.items.forEach(item => {
        const fila = document.createElement('tr');
        fila.innerHTML = `
            <td>${item.nombre}</td>
            <td>${item.cantidad}</td>
            <td style="text-align:right;">${formatearPrecio(item.precio)}</td>
            <td style="text-align:right;">${formatearPrecio(item.subtotal)}</td>
            <td>
                <button class="btn btn-danger btn-sm" onclick="eliminarItemCotizacion(${item.id})">
                    <i class="fas fa-trash"></i>
                </button>
            </td>
        `;
        tabla.appendChild(fila);
    });

    const totalElement = document.getElementById('totalCotizacion');
    if (totalElement) {
        totalElement.textContent = formatearPrecio(cotizacionActual.total);
    }
}

function limpiarRecursosModal(modalId) {
    const modalElement = document.getElementById(modalId);
    if (!modalElement) return;

    // Remover event listeners
    const newModalElement = modalElement.cloneNode(true);
    modalElement.parentNode.replaceChild(newModalElement, modalElement);

    // Limpiar contenido si es necesario
    if (modalId === 'modalNuevaCotizacion') {
        limpiarFormularioCotizacion();
    }
}

// Funciones para Cotizaciones
function actualizarTotalCotizacion() {
  const total = window.itemsCotizacion.reduce((sum, item) => sum + (item.cantidad * item.precio), 0);
  const totalElement = document.getElementById('totalCotizacion');
  if (totalElement) {
    totalElement.textContent = formatearPrecio(total);
  }
}

function agregarItemCotizacion() {
  try {
    const producto = document.getElementById('productoManual').style.display === 'none' 
      ? document.getElementById('buscarProducto').value
      : document.getElementById('productoManual').value;
    const cantidad = parseInt(document.getElementById('cantidadItem').value) || 1;
    const precio = parseFloat(document.getElementById('precioItem').value) || 0;

    if (!producto) {
      alert('Por favor, seleccione o escriba un producto');
      return;
    }

    if (cantidad <= 0) {
      alert('La cantidad debe ser mayor a 0');
      return;
    }

    if (precio <= 0) {
      alert('El precio debe ser mayor a 0');
      return;
    }

    const item = {
      id: Date.now(),
      producto: producto,
      cantidad: cantidad,
      precio: precio,
      subtotal: cantidad * precio
    };

    // Agregar el item al array global
    if (!Array.isArray(window.itemsCotizacion)) {
      window.itemsCotizacion = [];
    }
    window.itemsCotizacion.push(item);
    actualizarTablaItemsCotizacion();
    actualizarTotalCotizacion();

    // Limpiar campos
    document.getElementById('buscarProducto').value = '';
    document.getElementById('productoManual').value = '';
    document.getElementById('cantidadItem').value = '1';
    document.getElementById('precioItem').value = '';
    document.getElementById('resultadosBusqueda').style.display = 'none';

    // Volver a mostrar la lista de productos disponibles
    if (typeof filtrarProductosCotizacion === 'function') {
      filtrarProductosCotizacion();
    } else if (typeof buscarProductosCotizacion === 'function') {
      buscarProductosCotizacion();
    }
  } catch (error) {
    console.error('Error al agregar item:', error);
    alert('Error al agregar el item a la cotización');
  }
}

function mostrarItemsCotizacion() {
    const tabla = document.getElementById('tablaItemsCotizacion');
    if (!tabla) return;

    tabla.innerHTML = '';
    
    if (!cotizacionActual || !cotizacionActual.items || cotizacionActual.items.length === 0) {
        tabla.innerHTML = '<tr><td colspan="4" class="text-center">No hay items en la cotización</td></tr>';
        return;
    }

    cotizacionActual.items.forEach(item => {
        const fila = document.createElement('tr');
        fila.innerHTML = `
            <td>${item.nombre}</td>
            <td>${item.cantidad}</td>
            <td style="text-align:right;">${formatearPrecio(item.precio)}</td>
            <td style="text-align:right;">${formatearPrecio(item.subtotal)}</td>
            <td>
                <button class="btn btn-danger btn-sm" onclick="eliminarItemCotizacion(${item.id})">
                    <i class="fas fa-trash"></i>
                </button>
            </td>
        `;
        tabla.appendChild(fila);
    });

    // Actualizar total
    const totalElement = document.getElementById('totalCotizacion');
    if (totalElement) {
        totalElement.textContent = formatearPrecio(cotizacionActual.total);
    }
}

function limpiarFormularioItem() {
    document.getElementById('cantidadItem').value = '';
    document.getElementById('precioItem').value = '';
    document.getElementById('buscarProducto').value = '';
    document.getElementById('productoManual').value = '';
    document.getElementById('resultadosBusqueda').innerHTML = '';
}

function eliminarItemCotizacion(id) {
    if (!cotizacionActual) return;
    
    cotizacionActual.items = cotizacionActual.items.filter(item => item.id !== id);
    cotizacionActual.total = cotizacionActual.items.reduce((sum, item) => sum + item.subtotal, 0);
    
    actualizarTablaItemsCotizacion();
}

function guardarCotizacion() {
    try {
        const clienteId = document.getElementById('clienteCotizacion').value;
        const fecha = document.getElementById('fechaCotizacion').value;

        if (!clienteId) {
            alert('Por favor, seleccione un cliente');
            return;
        }

        if (!fecha) {
            alert('Por favor, seleccione una fecha');
            return;
        }

        if (window.itemsCotizacion.length === 0) {
            alert('Por favor, agregue al menos un item a la cotización');
            return;
        }

        const cotizacion = {
            id: Date.now(),
            fecha: fecha,
            clienteId: clienteId,
            items: window.itemsCotizacion,
            total: window.itemsCotizacion.reduce((sum, item) => sum + item.subtotal, 0)
        };

        // Guardar en localStorage
        const cotizaciones = JSON.parse(localStorage.getItem('cotizaciones')) || [];
        cotizaciones.push(cotizacion);
        localStorage.setItem('cotizaciones', JSON.stringify(cotizaciones));

        // Cerrar modal y limpiar
        const modal = bootstrap.Modal.getInstance(document.getElementById('modalNuevaCotizacion'));
        modal.hide();
        window.itemsCotizacion = [];
        actualizarTablaCotizaciones();

        alert('Cotización guardada exitosamente');
    } catch (error) {
        console.error('Error al guardar cotización:', error);
        alert('Error al guardar la cotización');
    }
}

function mostrarCotizaciones() {
    const tabla = document.getElementById('tablaCotizaciones');
    if (!tabla) return;

    tabla.innerHTML = '';
    
    if (!cotizaciones || cotizaciones.length === 0) {
        tabla.innerHTML = '<tr><td colspan="5" class="text-center">No hay cotizaciones</td></tr>';
        return;
    }

    cotizaciones.forEach(cotizacion => {
        const fila = document.createElement('tr');
        fila.innerHTML = `
            <td>${formatearFecha(cotizacion.fecha)}</td>
            <td>${cotizacion.cliente.nombre}</td>
            <td>${cotizacion.items.length} items</td>
            <td style="text-align:right;">${formatearPrecio(cotizacion.total)}</td>
            <td>
                <button class="btn btn-info btn-sm" onclick="verCotizacion(${cotizacion.id})">
                    <i class="fas fa-eye"></i>
                </button>
                <button class="btn btn-danger btn-sm" onclick="eliminarCotizacion(${cotizacion.id})">
                    <i class="fas fa-trash"></i>
                </button>
            </td>
        `;
        tabla.appendChild(fila);
    });
}

function verCotizacion(id) {
    const cotizaciones = JSON.parse(localStorage.getItem('cotizaciones')) || [];
    const clientes = JSON.parse(localStorage.getItem('clientes')) || [];
    const cotizacion = cotizaciones.find(c => c.id === id);
    
    if (!cotizacion) {
        alert('Cotización no encontrada');
        return;
    }

    const cliente = clientes.find(c => c.id === cotizacion.clienteId);
    
    // Mostrar detalles en el modal
    document.getElementById('fechaCotizacionVer').textContent = formatearFecha(cotizacion.fecha);
    document.getElementById('clienteCotizacionVer').textContent = cliente ? cliente.nombre : 'Cliente no encontrado';
    
    const tbody = document.getElementById('tablaItemsCotizacionVer');
    tbody.innerHTML = '';
    cotizacion.items.forEach(item => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${item.producto}</td>
            <td>${item.cantidad}</td>
            <td style="text-align:right;">${formatearPrecio(item.precio)}</td>
            <td style="text-align:right;">${formatearPrecio(item.subtotal)}</td>
        `;
        tbody.appendChild(tr);
    });
    
    document.getElementById('totalCotizacionVer').textContent = formatearPrecio(cotizacion.total);
    
    const modal = new bootstrap.Modal(document.getElementById('modalVerCotizacion'));
    modal.show();
}

function eliminarCotizacion(id) {
    if (confirm('¿Está seguro de eliminar esta cotización?')) {
        const cotizaciones = JSON.parse(localStorage.getItem('cotizaciones')) || [];
        const nuevasCotizaciones = cotizaciones.filter(c => c.id !== id);
        localStorage.setItem('cotizaciones', JSON.stringify(nuevasCotizaciones));
        actualizarTablaCotizaciones();
    }
}

function limpiarFormularioCotizacion() {
    cotizacionActual = null;
    document.getElementById('clienteCotizacion').value = '';
    document.getElementById('fechaCotizacion').value = obtenerFechaLocalISO();
    document.getElementById('tablaItemsCotizacion').innerHTML = '';
    document.getElementById('totalCotizacion').textContent = formatearPrecio(0);
}

function buscarProductosCotizacion() {
    const busqueda = document.getElementById('buscarProducto').value.toLowerCase();
    const categoria = document.getElementById('categoriaProducto').value;
    
    let resultados = productos;
    
    if (busqueda) {
        resultados = resultados.filter(p => 
            p.nombre.toLowerCase().includes(busqueda) ||
            p.categoria.toLowerCase().includes(busqueda)
        );
    }
    
    if (categoria) {
        resultados = resultados.filter(p => p.categoria === categoria);
    }
    
    const resultadosDiv = document.getElementById('resultadosBusqueda');
    resultadosDiv.innerHTML = '';
    
    if (resultados.length === 0) {
        resultadosDiv.innerHTML = '<p class="text-muted">No se encontraron productos</p>';
        return;
    }
    
    resultados.forEach(producto => {
        const div = document.createElement('div');
        div.className = 'resultado-busqueda';
        div.innerHTML = `
            <div class="d-flex justify-content-between align-items-center">
                <div>
                    <strong>${producto.nombre}</strong>
                    <br>
                    <small class="text-muted">${producto.categoria}</small>
                </div>
                <button class="btn btn-primary btn-sm" onclick="seleccionarProducto(${producto.id})">
                    Seleccionar
                </button>
            </div>
        `;
        resultadosDiv.appendChild(div);
    });
}

function seleccionarProducto(id) {
    const producto = productos.find(p => p.id === id);
    if (!producto) return;

    document.getElementById('buscarProducto').value = producto.nombre;
    document.getElementById('precioItem').value = producto.precio;
    document.getElementById('resultadosBusqueda').innerHTML = '';
}

function actualizarTablaItemsCotizacion() {
    const tabla = document.getElementById('tablaItemsCotizacion');
    if (!tabla || !cotizacionActual) return;

    tabla.innerHTML = '';
    
    cotizacionActual.items.forEach(item => {
        const fila = document.createElement('tr');
        fila.innerHTML = `
            <td>${item.nombre}</td>
            <td>${item.cantidad}</td>
            <td style="text-align:right;">${formatearPrecio(item.precio)}</td>
            <td style="text-align:right;">${formatearPrecio(item.subtotal)}</td>
            <td>
                <button class="btn btn-danger btn-sm" onclick="eliminarItemCotizacion(${item.id})">
                    <i class="fas fa-trash"></i>
                </button>
            </td>
        `;
        tabla.appendChild(fila);
    });

    const totalElement = document.getElementById('totalCotizacion');
    if (totalElement) {
        totalElement.textContent = formatearPrecio(cotizacionActual.total);
    }
}

function limpiarRecursosModal(modalId) {
    const modalElement = document.getElementById(modalId);
    if (!modalElement) return;

    // Remover event listeners
    const newModalElement = modalElement.cloneNode(true);
    modalElement.parentNode.replaceChild(newModalElement, modalElement);

    // Limpiar contenido si es necesario
    if (modalId === 'modalNuevaCotizacion') {
        limpiarFormularioCotizacion();
    }
}

// Funciones para Cotizaciones
function actualizarTotalCotizacion() {
  const total = window.itemsCotizacion.reduce((sum, item) => sum + (item.cantidad * item.precio), 0);
  const totalElement = document.getElementById('totalCotizacion');
  if (totalElement) {
    totalElement.textContent = formatearPrecio(total);
  }
}

function agregarItemCotizacion() {
  try {
    const producto = document.getElementById('productoManual').style.display === 'none' 
      ? document.getElementById('buscarProducto').value
      : document.getElementById('productoManual').value;
    const cantidad = parseInt(document.getElementById('cantidadItem').value) || 1;
    const precio = parseFloat(document.getElementById('precioItem').value) || 0;

    if (!producto) {
      alert('Por favor, seleccione o escriba un producto');
      return;
    }

    if (cantidad <= 0) {
      alert('La cantidad debe ser mayor a 0');
      return;
    }

    if (precio <= 0) {
      alert('El precio debe ser mayor a 0');
      return;
    }

    const item = {
      id: Date.now(),
      producto: producto,
      cantidad: cantidad,
      precio: precio,
      subtotal: cantidad * precio
    };

    // Agregar el item al array global
    if (!Array.isArray(window.itemsCotizacion)) {
      window.itemsCotizacion = [];
    }
    window.itemsCotizacion.push(item);
    actualizarTablaItemsCotizacion();
    actualizarTotalCotizacion();

    // Limpiar campos
    document.getElementById('buscarProducto').value = '';
    document.getElementById('productoManual').value = '';
    document.getElementById('cantidadItem').value = '1';
    document.getElementById('precioItem').value = '';
    document.getElementById('resultadosBusqueda').style.display = 'none';

    // Volver a mostrar la lista de productos disponibles
    if (typeof filtrarProductosCotizacion === 'function') {
      filtrarProductosCotizacion();
    } else if (typeof buscarProductosCotizacion === 'function') {
      buscarProductosCotizacion();
    }
  } catch (error) {
    console.error('Error al agregar item:', error);
    alert('Error al agregar el item a la cotización');
  }
}

function actualizarTablaItemsCotizacion() {
  const tbody = document.getElementById('itemsCotizacion');
  if (!tbody) return;

  tbody.innerHTML = '';
  window.itemsCotizacion.forEach(item => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${item.producto}</td>
      <td>${item.cantidad}</td>
      <td style="text-align:right;">${formatearPrecio(item.precio)}</td>
      <td style="text-align:right;">${formatearPrecio(item.subtotal)}</td>
      <td>
        <button class="btn btn-danger btn-sm" onclick="eliminarItemCotizacion(${item.id})">
          <i class="fas fa-trash"></i>
        </button>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

function eliminarItemCotizacion(id) {
  window.itemsCotizacion = window.itemsCotizacion.filter(item => item.id !== id);
  actualizarTablaItemsCotizacion();
  actualizarTotalCotizacion();
}

function guardarCotizacion() {
  try {
    const clienteId = document.getElementById('clienteCotizacion').value;
    const fecha = document.getElementById('fechaCotizacion').value;

    if (!clienteId) {
      alert('Por favor, seleccione un cliente');
      return;
    }

    if (!fecha) {
      alert('Por favor, seleccione una fecha');
      return;
    }

    if (window.itemsCotizacion.length === 0) {
      alert('Por favor, agregue al menos un item a la cotización');
      return;
    }

    const cotizacion = {
      id: Date.now(),
      fecha: fecha,
      clienteId: clienteId,
      items: window.itemsCotizacion,
      total: window.itemsCotizacion.reduce((sum, item) => sum + item.subtotal, 0)
    };

    // Guardar en localStorage
    const cotizaciones = JSON.parse(localStorage.getItem('cotizaciones')) || [];
    cotizaciones.push(cotizacion);
    localStorage.setItem('cotizaciones', JSON.stringify(cotizaciones));

    // Cerrar modal y limpiar
    const modal = bootstrap.Modal.getInstance(document.getElementById('modalNuevaCotizacion'));
    modal.hide();
    window.itemsCotizacion = [];
    actualizarTablaCotizaciones();

    alert('Cotización guardada exitosamente');
  } catch (error) {
    console.error('Error al guardar cotización:', error);
    alert('Error al guardar la cotización');
  }
}

function actualizarTablaCotizaciones() {
  const tbody = document.getElementById('tablaCotizaciones');
  if (!tbody) return;

  let cotizaciones = JSON.parse(localStorage.getItem('cotizaciones')) || [];
  const clientes = JSON.parse(localStorage.getItem('clientes')) || [];

  // Ordenar de más reciente a más antigua (por fecha y luego por id)
  cotizaciones = cotizaciones.sort((a, b) => {
    const fechaA = new Date(a.fecha);
    const fechaB = new Date(b.fecha);
    if (fechaA.getTime() === fechaB.getTime()) {
      return b.id - a.id; // Si la fecha es igual, ordenar por id (timestamp)
    }
    return fechaB - fechaA;
  });

  tbody.innerHTML = '';
  cotizaciones.forEach(cotizacion => {
    const cliente = clientes.find(c => String(c.id) === String(cotizacion.clienteId));
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td><input type="radio" name="cotizacionSeleccionada" value="${cotizacion.id}"></td>
      <td>${formatearFecha(cotizacion.fecha)}</td>
      <td>${cliente ? cliente.nombre : 'Cliente no encontrado'}</td>
      <td style="text-align:right;">${formatearPrecio(cotizacion.total)}</td>
      <td>
        <button class="btn btn-primary btn-sm" onclick="editarCotizacion(${cotizacion.id})">
          <i class="fas fa-pen"></i>
        </button>
        <button class="btn btn-danger btn-sm" onclick="eliminarCotizacion(${cotizacion.id})">
          <i class="fas fa-trash"></i>
        </button>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

function verCotizacion(id) {
  const cotizaciones = JSON.parse(localStorage.getItem('cotizaciones')) || [];
  const clientes = JSON.parse(localStorage.getItem('clientes')) || [];
  const cotizacion = cotizaciones.find(c => c.id === id);
  
  if (!cotizacion) {
    alert('Cotización no encontrada');
    return;
  }

  const cliente = clientes.find(c => c.id === cotizacion.clienteId);
  
  // Mostrar detalles en el modal
  document.getElementById('fechaCotizacionVer').textContent = formatearFecha(cotizacion.fecha);
  document.getElementById('clienteCotizacionVer').textContent = cliente ? cliente.nombre : 'Cliente no encontrado';
  
  const tbody = document.getElementById('tablaItemsCotizacionVer');
  tbody.innerHTML = '';
  cotizacion.items.forEach(item => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${item.producto}</td>
      <td>${item.cantidad}</td>
      <td style="text-align:right;">${formatearPrecio(item.precio)}</td>
      <td style="text-align:right;">${formatearPrecio(item.subtotal)}</td>
    `;
    tbody.appendChild(tr);
  });
  
  document.getElementById('totalCotizacionVer').textContent = formatearPrecio(cotizacion.total);
  
  const modal = new bootstrap.Modal(document.getElementById('modalVerCotizacion'));
  modal.show();
}

function eliminarCotizacion(id) {
  if (confirm('¿Está seguro de eliminar esta cotización?')) {
    const cotizaciones = JSON.parse(localStorage.getItem('cotizaciones')) || [];
    const nuevasCotizaciones = cotizaciones.filter(c => c.id !== id);
    localStorage.setItem('cotizaciones', JSON.stringify(nuevasCotizaciones));
    actualizarTablaCotizaciones();
  }
}

function buscarCotizaciones() {
  const busqueda = document.getElementById('buscarCotizacion').value.toLowerCase();
  const cotizaciones = JSON.parse(localStorage.getItem('cotizaciones')) || [];
  const clientes = JSON.parse(localStorage.getItem('clientes')) || [];
  
  const cotizacionesFiltradas = cotizaciones.filter(cotizacion => {
    const cliente = clientes.find(c => c.id === cotizacion.clienteId);
    return (
      (cliente && cliente.nombre.toLowerCase().includes(busqueda)) ||
      cotizacion.fecha.includes(busqueda)
    );
  });

  const tbody = document.getElementById('tablaCotizaciones');
  tbody.innerHTML = '';
  
  cotizacionesFiltradas.forEach(cotizacion => {
    const cliente = clientes.find(c => c.id === cotizacion.clienteId);
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${formatearFecha(cotizacion.fecha)}</td>
      <td>${cliente ? cliente.nombre : 'Cliente no encontrado'}</td>
      <td style="text-align:right;">${formatearPrecio(cotizacion.total)}</td>
      <td>
        <button class="btn btn-info btn-sm" onclick="verCotizacion(${cotizacion.id})">
          <i class="fas fa-eye"></i>
        </button>
        <button class="btn btn-primary btn-sm" onclick="editarCotizacion(${cotizacion.id})">
          <i class="fas fa-pen"></i>
        </button>
        <button class="btn btn-danger btn-sm" onclick="eliminarCotizacion(${cotizacion.id})">
          <i class="fas fa-trash"></i>
        </button>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

// Funciones para manejar productos en cotizaciones
function filtrarProductosCotizacion() {
  // Ya no se filtra por categoría
  const busqueda = document.getElementById('buscarProducto').value.toLowerCase();
  
  // Obtener todos los productos
  const productos = JSON.parse(localStorage.getItem('productos')) || [];
  
  // Filtrar solo por búsqueda
  window.productosFiltrados = productos.filter(producto => {
    return !busqueda || producto.nombre.toLowerCase().includes(busqueda);
  });

  mostrarResultadosBusqueda();
}

function mostrarResultadosBusqueda() {
  const resultadosDiv = document.getElementById('resultadosBusqueda');
  if (!resultadosDiv) return;

  resultadosDiv.innerHTML = '';
  
  if (window.productosFiltrados.length === 0) {
    resultadosDiv.style.display = 'none';
    return;
  }

  window.productosFiltrados.forEach(producto => {
    const div = document.createElement('div');
    div.className = 'list-group-item list-group-item-action bg-dark text-white border-light';
    div.style.cursor = 'pointer';
    div.textContent = producto.nombre;
    div.onclick = () => seleccionarProducto(producto);
    resultadosDiv.appendChild(div);
  });

  resultadosDiv.style.display = 'block';
}

function seleccionarProducto(producto) {
  document.getElementById('buscarProducto').value = producto.nombre;
  document.getElementById('precioItem').value = producto.precio;
  document.getElementById('resultadosBusqueda').style.display = 'none';
}

function toggleProductoManual() {
  const productoManual = document.getElementById('productoManual');
  const buscarProducto = document.getElementById('buscarProducto');
  const resultadosBusqueda = document.getElementById('resultadosBusqueda');

  if (productoManual.style.display === 'none') {
    productoManual.style.display = 'block';
    buscarProducto.style.display = 'none';
    resultadosBusqueda.style.display = 'none';
    productoManual.focus();
  } else {
    productoManual.style.display = 'none';
    buscarProducto.style.display = 'block';
    productoManual.value = '';
  }
}

function formatearFecha(fechaStr) {
    if (!fechaStr) return '';

    // Si es una cadena con formato YYYY-MM-DD sin hora, formatear manualmente
    if (typeof fechaStr === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(fechaStr)) {
        const [anio, mes, dia] = fechaStr.split('-');
        return `${dia}/${mes}/${anio}`;
    }

    // Para otros formatos construiremos la fecha forzando hora local 00:00 si no la trae
    const fecha = typeof fechaStr === 'string'
        ? new Date(fechaStr.includes('T') ? fechaStr : `${fechaStr}T00:00:00`)
        : new Date(fechaStr);

    if (isNaN(fecha.getTime())) return fechaStr;

    const diaTxt = String(fecha.getDate()).padStart(2, '0');
    const mesTxt = String(fecha.getMonth() + 1).padStart(2, '0');
    const anioTxt = fecha.getFullYear();
    return `${diaTxt}/${mesTxt}/${anioTxt}`;
}

function imprimirCotizacion() {
  // Obtén los datos mostrados en el modal de ver cotización
  const fecha = document.getElementById('fechaCotizacionVer').textContent;
  const cliente = document.getElementById('clienteCotizacionVer').textContent;
  const items = Array.from(document.querySelectorAll('#tablaItemsCotizacionVer tr')).map(tr => {
    const tds = tr.querySelectorAll('td');
    return {
      producto: tds[0]?.textContent || '',
      cantidad: tds[1]?.textContent || '',
      precio: tds[2]?.textContent || '',
      subtotal: tds[3]?.textContent || ''
    };
  });
  const total = document.getElementById('totalCotizacionVer').textContent;

  // Logo (ajusta la ruta si es necesario)
  const logo = './image/logo-ToySoft.png';

  // Crea el HTML para imprimir
  let html = `
    <div style="font-family: Arial; width: 300px;">
      <div style="text-align:center; margin-bottom:10px;">
        <img src="${logo}" alt="Logo" style="max-width:90px; max-height:90px; margin-bottom:5px;">
        <h2 style="margin:0; font-size:1.2em;">Cotización</h2>
      </div>
      <div><strong>Fecha:</strong> ${fecha}</div>
      <div><strong>Cliente:</strong> ${cliente}</div>
      <hr>
      <table style="width:100%; font-size:13px;">
        <thead>
          <tr>
            <th style="text-align:left;">Producto</th>
            <th>Cant</th>
            <th>Precio</th>
            <th>Subt.</th>
          </tr>
        </thead>
        <tbody>
          ${items.map(item => `
            <tr>
              <td>${item.producto}</td>
              <td style="text-align:center;">${item.cantidad}</td>
              <td style="text-align:right;">${formatearNumero(item.precio)}</td>
              <td style="text-align:right;">${formatearNumero(item.subtotal)}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
      <hr>
      <div style="text-align:right; font-size:16px;"><strong>Total: ${total}</strong></div>
    </div>
  `;

  // Abre una ventana nueva y manda a imprimir
  const win = window.open('', 'Imprimir Cotización', 'width=350,height=600');
  win.document.write(`<html><head><title>Imprimir Cotización</title></head><body onload="window.print();window.close();">${html}</body></html>`);
  win.document.close();
}

function obtenerVentanaImpresionCotizacion() {
  const ventana = window.open('', '_blank', 'width=400,height=600,scrollbars=yes');
  if (!ventana) return null;
  ventana.document.open();
  ventana.document.write(`
    <!DOCTYPE html>
    <html>
      <head>
        <title>Cotización</title>
        <meta charset="UTF-8">
        <style>
          body { font-family: monospace; font-size: 14px; width: 57mm; margin: 0; padding: 1mm; }
          .text-center { text-align: center; }
          .text-right { text-align: right; }
          .mb-1 { margin-bottom: 0.5mm; }
          .mt-1 { margin-top: 0.5mm; }
          table { width: 100%; border-collapse: collapse; margin: 1mm 0; font-size: 14px; }
          th, td { padding: 0.5mm; text-align: left; font-size: 14px; }
          .border-top { border-top: 1px dashed #000; margin-top: 1mm; padding-top: 1mm; }
          .header { border-bottom: 1px dashed #000; padding-bottom: 1mm; margin-bottom: 1mm; }
          .total-row { font-weight: bold; font-size: 16px; }
          .botones-impresion { position: fixed; top: 10px; right: 10px; z-index: 1000; background: #fff; padding: 5px; border-radius: 5px; box-shadow: 0 2px 5px rgba(0,0,0,0.2); }
          .botones-impresion button { margin: 0 5px; padding: 5px 10px; background: #007bff; color: white; border: none; border-radius: 3px; cursor: pointer; }
          .botones-impresion button:hover { background: #0056b3; }
          .logo-container { text-align: center; margin-bottom: 2mm; }
          .logo-container img { max-width: 100%; max-height: 120px; }
          @media print { .botones-impresion { display: none; } @page { margin: 0; size: 57mm auto; } body { width: 57mm; } }
        </style>
      </head>
      <body>
        <div class="botones-impresion">
          <button onclick="window.print()">Imprimir</button>
          <button onclick="window.close()">Cerrar</button>
        </div>
        <div id="contenidoCotizacion"></div>
      </body>
    </html>
  `);
  return ventana;
}

function imprimirCotizacionSeleccionada() {
  const seleccionada = document.querySelector('input[name="cotizacionSeleccionada"]:checked');
  if (!seleccionada) {
    alert('Por favor, seleccione una cotización para imprimir.');
    return;
  }
  const id = seleccionada.value;
  const cotizaciones = JSON.parse(localStorage.getItem('cotizaciones')) || [];
  const clientes = JSON.parse(localStorage.getItem('clientes')) || [];
  const cotizacion = cotizaciones.find(c => c.id == id);
  if (!cotizacion) {
    alert('Cotización no encontrada.');
    return;
  }
  // Forzar coincidencia de tipos y log para depuración
  const cliente = clientes.find(c => String(c.id) === String(cotizacion.clienteId));
  if (!cliente) {
    console.warn('Cliente no encontrado. ID buscado:', cotizacion.clienteId, 'Lista de clientes:', clientes.map(c=>c.id));
  }

  // Armamos el HTML directamente desde los datos
  const fecha = formatearFecha(cotizacion.fecha);
  const nombreCliente = cliente ? cliente.nombre : 'Cliente no encontrado';
  const telefonoCliente = cliente && cliente.telefono ? cliente.telefono : '';
  const direccionCliente = cliente && cliente.direccion ? cliente.direccion : '';
  const emailCliente = cliente && cliente.email ? cliente.email : '';
  const items = cotizacion.items;
  const total = formatearPrecio(cotizacion.total);

  const logo = localStorage.getItem('logoNegocio');
  let html = '';
  if (logo) {
    html += `<div class="logo-container"><img src="${logo}" alt="Logo"></div>`;
  }
  html += `
    <div class="header text-center">
      <h2 style="margin: 0; font-size: 14px;">COTIZACIÓN</h2>
      <div class="mb-1">${fecha}</div>
    </div>
    <div class="border-top">
      <div class="mb-1"><strong>Cliente:</strong> <span>${nombreCliente}</span></div>
      ${telefonoCliente ? `<div class='mb-1'><strong>Teléfono:</strong> <span>${telefonoCliente}</span></div>` : ''}
      ${direccionCliente ? `<div class='mb-1'><strong>Dirección:</strong> <span>${direccionCliente}</span></div>` : ''}
      ${emailCliente ? `<div class='mb-1'><strong>Email:</strong> <span>${emailCliente}</span></div>` : ''}
    </div>
    <table style="width:100%; font-size:13px; border-collapse:collapse; margin-top:8px;">
      <thead>
        <tr>
          <th style="text-align:left;">Producto</th>
          <th style="text-align:center; width: 12%;">Cant</th>
          <th style="text-align:right; width: 22%;">Precio</th>
          <th style="text-align:right; width: 22%;">Total</th>
        </tr>
      </thead>
      <tbody>
        ${items.map(item => `
          <tr>
            <td>${item.producto}</td>
            <td style="text-align:center;">${item.cantidad}</td>
            <td style="text-align:right;">${formatearNumero(item.precio)}</td>
            <td style="text-align:right;">${formatearNumero(item.subtotal)}</td>
          </tr>
        `).join('')}
      </tbody>
    </table>
    <div class="border-top" style="margin-top:8px;">
      <div class="mb-1 total-row" style="text-align:right;"><strong>Total: ${total}</strong></div>
    </div>
    <div class="text-center mt-1">
      <div class="border-top">¡Gracias por su preferencia!</div>
      <div class="border-top">ToySoft POS</div>
    </div>
  `;

  const ventana = obtenerVentanaImpresionCotizacion();
  if (!ventana) {
    alert('No se pudo abrir la ventana de impresión. Por favor, verifique que los bloqueadores de ventanas emergentes estén desactivados.');
    return;
  }
  setTimeout(() => {
    const contenidoDiv = ventana.document.getElementById('contenidoCotizacion');
    if (contenidoDiv) {
      contenidoDiv.innerHTML = html;
      ventana.focus();
    }
  }, 100);
}

function editarCotizacion(id) {
  const cotizaciones = JSON.parse(localStorage.getItem('cotizaciones')) || [];
  const clientes = JSON.parse(localStorage.getItem('clientes')) || [];
  const cotizacion = cotizaciones.find(c => c.id == id);
  if (!cotizacion) {
    alert('Cotización no encontrada.');
    return;
  }
  cotizacionEditandoId = id;

  // Abrir el modal de nueva cotización
  mostrarModalNuevaCotizacion();

  // Cargar datos en el formulario
  setTimeout(() => {
    document.getElementById('clienteCotizacion').value = cotizacion.clienteId;
    document.getElementById('fechaCotizacion').value = cotizacion.fecha;
    window.itemsCotizacion = cotizacion.items.map(item => ({ ...item }));
    actualizarTablaItemsCotizacion();
    actualizarTotalCotizacion();
  }, 300);
}

// Modificar guardarCotizacion para actualizar si se está editando
const guardarCotizacionOriginal = guardarCotizacion;
guardarCotizacion = function() {
  try {
    const clienteId = document.getElementById('clienteCotizacion').value;
    const fecha = document.getElementById('fechaCotizacion').value;

    if (!clienteId) {
      alert('Por favor, seleccione un cliente');
      return;
    }

    if (!fecha) {
      alert('Por favor, seleccione una fecha');
      return;
    }

    if (window.itemsCotizacion.length === 0) {
      alert('Por favor, agregue al menos un item a la cotización');
      return;
    }

    let cotizaciones = JSON.parse(localStorage.getItem('cotizaciones')) || [];
    if (cotizacionEditandoId) {
      // Editar cotización existente
      cotizaciones = cotizaciones.map(c =>
        c.id == cotizacionEditandoId
          ? {
              ...c,
              fecha: fecha,
              clienteId: clienteId,
              items: window.itemsCotizacion,
              total: window.itemsCotizacion.reduce((sum, item) => sum + item.subtotal, 0)
            }
          : c
      );
    } else {
      // Nueva cotización
      const cotizacion = {
        id: Date.now(),
        fecha: fecha,
        clienteId: clienteId,
        items: window.itemsCotizacion,
        total: window.itemsCotizacion.reduce((sum, item) => sum + item.subtotal, 0)
      };
      cotizaciones.push(cotizacion);
    }
    localStorage.setItem('cotizaciones', JSON.stringify(cotizaciones));

    // Cerrar modal y limpiar
    const modal = bootstrap.Modal.getInstance(document.getElementById('modalNuevaCotizacion'));
    modal.hide();
    window.itemsCotizacion = [];
    cotizacionEditandoId = null;
    actualizarTablaCotizaciones();

    alert('Cotización guardada exitosamente');
  } catch (error) {
    console.error('Error al guardar cotización:', error);
    alert('Error al guardar la cotización');
  }
}

// Función para mostrar el modal de balance
function mostrarModalBalance() {
  try {
    const modal = new bootstrap.Modal(document.getElementById('modalBalance'));
    document.getElementById('fechaBalance').valueAsDate = new Date();
    generarBalance();
    modal.show();
  } catch (error) {
    console.error('Error al mostrar modal de balance:', error);
    alert('Error al mostrar el balance');
  }
}

// Función para generar el balance
function generarBalance() {
  try {
    const tipoBalance = document.getElementById('tipoBalance').value;
    const fechaSeleccionada = new Date(document.getElementById('fechaBalance').value);
    const ventas = JSON.parse(localStorage.getItem('historialVentas')) || [];
    const gastos = JSON.parse(localStorage.getItem('historialGastos')) || [];
console.log('[BALANCE] Fuente de gastos: historialGastos', gastos);
    let ventasFiltradas = [];
    let gastosFiltrados = [];
    let inicioPeriodoStr = '', finPeriodoStr = '';
    switch (tipoBalance) {
      case 'semanal': {
        const inicioSemana = new Date(fechaSeleccionada);
        inicioSemana.setDate(fechaSeleccionada.getDate() - fechaSeleccionada.getDay());
        const finSemana = new Date(inicioSemana);
        finSemana.setDate(inicioSemana.getDate() + 6);
        ventasFiltradas = ventas.filter(v => {
          const fechaVenta = new Date(v.fecha);
          return fechaVenta >= inicioSemana && fechaVenta <= finSemana;
        });
        inicioPeriodoStr = soloFechaISO(inicioSemana);
        finPeriodoStr = soloFechaISO(finSemana);
        gastosFiltrados = gastos.filter(g => {
          const fechaGastoStr = soloFechaISO(g.fecha);
          return fechaGastoStr >= inicioPeriodoStr && fechaGastoStr <= finPeriodoStr;
        });
        break;
      }
      case 'mensual': {
        const inicioMes = new Date(fechaSeleccionada.getFullYear(), fechaSeleccionada.getMonth(), 1);
        const finMes = new Date(fechaSeleccionada.getFullYear(), fechaSeleccionada.getMonth() + 1, 0);
        ventasFiltradas = ventas.filter(v => {
          const fechaVenta = new Date(v.fecha);
          return fechaVenta >= inicioMes && fechaVenta <= finMes;
        });
        inicioPeriodoStr = soloFechaISO(inicioMes);
        finPeriodoStr = soloFechaISO(finMes);
        gastosFiltrados = gastos.filter(g => {
          const fechaGastoStr = soloFechaISO(g.fecha);
          return fechaGastoStr >= inicioPeriodoStr && fechaGastoStr <= finPeriodoStr;
        });
        break;
      }
      case 'anual': {
        const inicioAnio = new Date(fechaSeleccionada.getFullYear(), 0, 1);
        const finAnio = new Date(fechaSeleccionada.getFullYear(), 11, 31);
        ventasFiltradas = ventas.filter(v => {
          const fechaVenta = new Date(v.fecha);
          return fechaVenta >= inicioAnio && fechaVenta <= finAnio;
        });
        inicioPeriodoStr = soloFechaISO(inicioAnio);
        finPeriodoStr = soloFechaISO(finAnio);
        gastosFiltrados = gastos.filter(g => {
          const fechaGastoStr = soloFechaISO(g.fecha);
          return fechaGastoStr >= inicioPeriodoStr && fechaGastoStr <= finPeriodoStr;
        });
        break;
      }
    }
    // Recalcular gastos usando objetos Date para mayor precisión
    if (inicioPeriodoStr && finPeriodoStr) {
      const inicio = new Date(inicioPeriodoStr);
      const fin = new Date(finPeriodoStr);
      gastosFiltrados = gastos.filter(g => {
        const fecha = new Date(g.fecha);
        return fecha >= inicio && fecha <= fin;
      });
    }
    // LOG de depuración
    console.log('--- DEPURACIÓN BALANCE ---');
    console.log('Tipo de balance:', tipoBalance);
    console.log('Rango de fechas:', inicioPeriodoStr, 'a', finPeriodoStr);
    console.log('Gastos originales:', gastos);
    console.log('Gastos filtrados:', gastosFiltrados);
    // ... resto del código ...

    // Calcular totales por método de pago
    const totalesPorMetodo = {
      efectivo: 0,
      transferencia: 0,
      tarjeta: 0,
      credito: 0,
      mixto: 0
    };

    ventasFiltradas.forEach(venta => {
      const metodo = (venta.metodoPago || '').toLowerCase();
      const total = parseFloat(venta.total) || 0;
      
      if (metodo === 'mixto') {
        totalesPorMetodo.mixto += total;
        totalesPorMetodo.efectivo += parseFloat(venta.montoRecibido) || 0;
        totalesPorMetodo.transferencia += parseFloat(venta.montoTransferencia) || 0;
      } else {
        totalesPorMetodo[metodo] = (totalesPorMetodo[metodo] || 0) + total;
      }
    });

    // Actualizar tabla de ventas
    const resumenVentas = document.getElementById('resumenVentas');
    resumenVentas.innerHTML = '';
    
    Object.entries(totalesPorMetodo).forEach(([metodo, total]) => {
      if (total > 0) {
        const fila = document.createElement('tr');
        fila.innerHTML = `
          <td>${metodo.charAt(0).toUpperCase() + metodo.slice(1)}</td>
          <td style="text-align:right;">${total.toLocaleString()}</td>
        `;
        resumenVentas.appendChild(fila);
      }
    });

// Actualizar total de ventas
const totalVentas = ventasFiltradas.reduce((sum, v) => sum + (parseFloat(v.total) || 0), 0);
document.getElementById('totalVentas').textContent = `$ ${totalVentas.toLocaleString()}`;

// Actualizar total de gastos
const totalGastos = gastosFiltrados.reduce((sum, g) => sum + (parseFloat(g.monto) || 0), 0);
document.getElementById('totalGastos').textContent = `$ ${totalGastos.toLocaleString()}`;

// Actualizar tabla de créditos pendientes
const creditosPendientes = document.getElementById('creditosPendientes');
creditosPendientes.innerHTML = '';

const creditosFiltrados = ventasFiltradas.filter(v => 
  (v.metodoPago || '').toLowerCase() === 'crédito' || 
  (v.metodoPago || '').toLowerCase() === 'credito'
);

creditosFiltrados.forEach(credito => {
  const fila = document.createElement('tr');
  fila.innerHTML = `
    <td>${credito.cliente || 'No especificado'}</td>
    <td>${credito.fecha}</td>
    <td style="text-align:right;">${(parseFloat(credito.total) || 0).toLocaleString()}</td>
  `;
  creditosPendientes.appendChild(fila);
});

    // Actualizar total de créditos
    const totalCreditos = creditosFiltrados.reduce((sum, c) => sum + (parseFloat(c.total) || 0), 0);
    document.getElementById('totalCreditos').textContent = `$ ${totalCreditos.toLocaleString()}`;

  } catch (error) {
    console.error('Error al generar balance:', error);
    alert('Error al generar el balance');
  }
}

// Función para imprimir el balance
function imprimirBalance() {
  try {
    const tipoBalance = document.getElementById('tipoBalance').value;
    const fechaSeleccionada = new Date(document.getElementById('fechaBalance').value);
    const ventana = window.open('', 'ImpresionBalance', 'width=400,height=600,scrollbars=yes');
    
    if (!ventana) {
      alert('Por favor, permite las ventanas emergentes para este sitio');
      return;
    }

    // Obtener los datos de las tablas
    const resumenVentas = document.getElementById('resumenVentas').innerHTML;
    const totalVentas = document.getElementById('totalVentas').textContent;
    const totalGastos = document.getElementById('totalGastos').textContent;
    const creditosPendientes = document.getElementById('creditosPendientes').innerHTML;
    const totalCreditos = document.getElementById('totalCreditos').textContent;

    // Calcular el balance total: Ventas - Gastos - Créditos
    const numeroVentas = parseInt(totalVentas.replace(/[^0-9]+/g, '')) || 0;
    const numeroGastos = parseInt(totalGastos.replace(/[^0-9]+/g, '')) || 0;
    const numeroCreditos = parseInt(totalCreditos.replace(/[^0-9]+/g, '')) || 0;
    const balanceTotalNumero = numeroVentas - numeroGastos - numeroCreditos;
    const balanceTotalTexto = `$ ${balanceTotalNumero.toLocaleString('es-CO')}`;

    // Formatear la fecha según el tipo de balance
    let tituloPeriodo = '';
    switch (tipoBalance) {
      case 'semanal':
        const inicioSemana = new Date(fechaSeleccionada);
        inicioSemana.setDate(fechaSeleccionada.getDate() - fechaSeleccionada.getDay());
        const finSemana = new Date(inicioSemana);
        finSemana.setDate(inicioSemana.getDate() + 6);
        tituloPeriodo = `Semana del ${inicioSemana.toLocaleDateString()} al ${finSemana.toLocaleDateString()}`;
        break;
      case 'mensual':
        tituloPeriodo = `Mes de ${fechaSeleccionada.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' })}`;
        break;
      case 'anual':
        tituloPeriodo = `Año ${fechaSeleccionada.getFullYear()}`;
        break;
    }

    ventana.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Balance</title>
          <meta charset="UTF-8">
          <style>
            body { 
              font-family: monospace; 
              font-size: 14px; 
              width: 57mm; 
              margin: 0; 
              padding: 1mm;
              background: white;
              color: black;
            }
            .text-center { text-align: center; }
            .text-right { text-align: right; }
            .mb-1 { margin-bottom: 0.5mm; }
            .mt-1 { margin-top: 0.5mm; }
            .border-top { border-top: 1px dashed #000; margin-top: 1mm; padding-top: 1mm; }
            .header { border-bottom: 1px dashed #000; padding-bottom: 1mm; margin-bottom: 1mm; }
            .total-row { font-weight: bold; font-size: 16px; }
            .botones-impresion { 
              position: fixed; 
              top: 10px; 
              right: 10px; 
              z-index: 1000; 
              background: #fff; 
              padding: 5px; 
              border-radius: 5px; 
              box-shadow: 0 2px 5px rgba(0,0,0,0.2);
              display: flex;
              gap: 5px;
            }
            .botones-impresion button { 
              margin: 0; 
              padding: 5px 10px; 
              background: #007bff; 
              color: white; 
              border: none; 
              border-radius: 3px; 
              cursor: pointer;
              font-size: 12px;
            }
            .botones-impresion button:hover { background: #0056b3; }
            .contenido-balance {
              margin-top: 40px;
            }
            table {
              width: 100%;
              border-collapse: collapse;
            }
            th, td {
              padding: 2mm;
              text-align: left;
            }
            th.text-end, td.text-end {
              text-align: right;
            }
            @media print { 
              .botones-impresion { display: none; } 
              @page { margin: 0; size: 57mm auto; } 
              body { width: 57mm; } 
            }
          </style>
        </head>
        <body>
          <div class="botones-impresion">
            <button onclick="window.print()">Imprimir</button>
            <button onclick="window.close()">Cerrar</button>
          </div>

          <div class="contenido-balance">
            <div class="header text-center">
              <h2 style="margin: 0; font-size: 14px;">BALANCE</h2>
              <div class="mb-1">${tituloPeriodo}</div>
            </div>

            <div class="border-top">
              <div class="mb-1"><strong>Resumen de Ventas</strong></div>
              <table>
                ${resumenVentas}
                <tfoot>
                  <tr>
                    <th>Total Ventas</th>
                    <th style="text-align:right;">${totalVentas}</th>
                  </tr>
                </tfoot>
              </table>
            </div>

            <div class="border-top">
              <div class="mb-1"><strong>Resumen de Gastos</strong></div>
              <table>
                <tfoot>
                  <tr>
                    <th>Total Gastos</th>
                    <th style="text-align:right;">${totalGastos}</th>
                  </tr>
                </tfoot>
              </table>
            </div>

            <div class="border-top">
              <div class="mb-1"><strong>Créditos Pendientes</strong></div>
              <table>
                ${creditosPendientes}
                <tfoot>
                  <tr>
                    <th colspan="2">Total Créditos</th>
                    <th style="text-align:right;">${totalCreditos}</th>
                  </tr>
                </tfoot>
              </table>
            </div>

            <!-- Balance Total -->
            <div class="border-top total-row text-center">
              <div class="mb-1"><strong>BALANCE TOTAL</strong></div>
              <div class="mb-1"><strong>${balanceTotalTexto}</strong></div>
            </div>

            <div class="text-center mt-1">
              <div class="border-top">¡Fin del Balance!</div>
              <div class="border-top">ToySoft POS</div>
            </div>
            
            <div class="border-top text-center mt-3">
              <div class="mb-1">Firma de Entrega: _________________</div>
              <div class="mb-1">Firma de Recibe: _________________</div>
            </div>
          </div>
        </body>
      </html>
    `);
    ventana.document.close();
  } catch (error) {
    console.error('Error al imprimir balance:', error);
    alert('Error al imprimir el balance: ' + error.message);
  }
}

// Función para mostrar el modal de nuevo cliente
function mostrarModalNuevoCliente() {
    // Ocultar el modal de cotización
    const modalCotizacion = document.getElementById('modalNuevaCotizacion');
    const bsModalCotizacion = bootstrap.Modal.getInstance(modalCotizacion);
    if (bsModalCotizacion) {
        bsModalCotizacion.hide();
    }

    // Limpiar el formulario de nuevo cliente
    document.getElementById('formNuevoCliente').reset();
    // Si existe el errorCliente, lo limpiamos
    const errorCliente = document.getElementById('errorCliente');
    if (errorCliente) errorCliente.textContent = '';

    // Mostrar el modal de nuevo cliente
    const modalNuevoCliente = document.getElementById('modalNuevoCliente');
    const bsModalNuevoCliente = new bootstrap.Modal(modalNuevoCliente);
    bsModalNuevoCliente.show();

    // Solo agregar el listener una vez
    if (!modalNuevoCliente.dataset.listenerAgregado) {
        modalNuevoCliente.addEventListener('hidden.bs.modal', function () {
            // Recargar el select de clientes
            if (typeof cargarClientesCotizacion === 'function') {
                cargarClientesCotizacion();
            }
            // Volver a mostrar el modal de cotización
            if (bsModalCotizacion) {
                bsModalCotizacion.show();
            }
        });
        modalNuevoCliente.dataset.listenerAgregado = 'true';
    }
}

function guardarNuevoCliente() {
    try {
        const form = document.getElementById('formNuevoCliente');
        if (!form.checkValidity()) {
            form.reportValidity();
            return;
        }

        const cliente = {
            id: Date.now(),
            nombre: document.getElementById('nombreCliente').value.trim(),
            telefono: document.getElementById('telefonoCliente').value.trim(),
            direccion: document.getElementById('direccionCliente').value.trim(),
            email: document.getElementById('emailCliente').value.trim()
        };

        // Guardar en localStorage
        const clientes = JSON.parse(localStorage.getItem('clientes')) || [];
        clientes.push(cliente);
        localStorage.setItem('clientes', JSON.stringify(clientes));

        // Actualizar select de clientes y seleccionar el nuevo
        if (typeof cargarClientesCotizacion === 'function') {
            cargarClientesCotizacion();
        }
        const selectCliente = document.getElementById('clienteCotizacion');
        if (selectCliente) selectCliente.value = cliente.id;

        // Cerrar modal
        const modal = bootstrap.Modal.getInstance(document.getElementById('modalNuevoCliente'));
        modal.hide();

        alert('Cliente guardado exitosamente');
    } catch (error) {
        console.error('Error al guardar cliente:', error);
        alert('Error al guardar el cliente');
    }
}

// Función para cargar categorías en el select
function cargarCategoriasCotizacion() {
  const categorias = JSON.parse(localStorage.getItem('categorias')) || [];
  const selectCategoria = document.getElementById('categoriaProducto');
  
  selectCategoria.innerHTML = '<option value="">Todas las categorías</option>';
  categorias.forEach(categoria => {
    const option = document.createElement('option');
    option.value = categoria;
    option.textContent = categoria;
    selectCategoria.appendChild(option);
  });
}

// Función para filtrar productos por categoría y búsqueda
function filtrarProductosCotizacion() {
  const categoria = document.getElementById('categoriaProducto').value;
  const busqueda = document.getElementById('buscarProducto').value.toLowerCase();
  const productos = JSON.parse(localStorage.getItem('productos')) || [];
  const resultadosBusqueda = document.getElementById('resultadosBusqueda');
  
  let productosFiltrados = productos;
  
  // Filtrar por categoría
  if (categoria) {
    productosFiltrados = productosFiltrados.filter(p => p.categoria === categoria);
  }
  
  // Filtrar por búsqueda
  if (busqueda) {
    productosFiltrados = productosFiltrados.filter(p => 
      p.nombre.toLowerCase().includes(busqueda)
    );
  }
  
  // Mostrar resultados
  resultadosBusqueda.innerHTML = '';
  if (productosFiltrados.length > 0) {
    resultadosBusqueda.style.display = 'block';
    productosFiltrados.forEach(producto => {
      const item = document.createElement('a');
      item.href = '#';
      item.className = 'list-group-item list-group-item-action bg-dark text-white';
      item.innerHTML = `
        <div class="d-flex justify-content-between align-items-center">
          <div>
            <strong>${producto.nombre}</strong>
            <br>
            <small>${producto.categoria}</small>
          </div>
          <div>
            <span class="badge bg-primary">${formatearPrecio(producto.precio)}</span>
            <button class="btn btn-sm btn-outline-light ms-2" onclick="seleccionarProductoCotizacion(${producto.id})">
              <i class="fas fa-plus"></i>
            </button>
          </div>
        </div>
      `;
      resultadosBusqueda.appendChild(item);
    });
  } else {
    resultadosBusqueda.style.display = 'none';
  }
}

// Función para seleccionar un producto en la cotización
function seleccionarProductoCotizacion(id) {
  const productos = JSON.parse(localStorage.getItem('productos')) || [];
  const producto = productos.find(p => p.id === id);
  
  if (producto) {
    document.getElementById('buscarProducto').value = producto.nombre;
    document.getElementById('precioItem').value = producto.precio;
    document.getElementById('resultadosBusqueda').style.display = 'none';
  }
}

// Función para mostrar el modal de nueva cotización
function mostrarModalNuevaCotizacion() {
  try {
    // Verificar que el modal existe
    const modalElement = document.getElementById('modalNuevaCotizacion');
    if (!modalElement) {
      throw new Error('El modal de nueva cotización no existe en el DOM');
    }

    // Inicializar arrays si no existen
    if (!Array.isArray(window.itemsCotizacion)) {
      window.itemsCotizacion = [];
    }

    // Verificar y establecer fecha actual
    const fechaInput = document.getElementById('fechaCotizacion');
    if (!fechaInput) {
      throw new Error('El campo de fecha no existe');
    }
    const hoy = new Date();
    fechaInput.value = hoy.toISOString().split('T')[0];

    // Verificar y cargar clientes
    const selectCliente = document.getElementById('clienteCotizacion');
    if (!selectCliente) {
      throw new Error('El selector de clientes no existe');
    }
    selectCliente.innerHTML = '<option value="">Seleccionar cliente</option>';
    const clientes = JSON.parse(localStorage.getItem('clientes')) || [];
    clientes.forEach(cliente => {
      const option = document.createElement('option');
      option.value = cliente.id;
      option.textContent = cliente.nombre;
      selectCliente.appendChild(option);
    });

    // Cargar categorías
    cargarCategoriasCotizacion();

    // Limpiar campos de búsqueda y resultados
    const buscarProducto = document.getElementById('buscarProducto');
    if (buscarProducto) {
      buscarProducto.value = '';
    }
    const resultadosBusqueda = document.getElementById('resultadosBusqueda');
    if (resultadosBusqueda) {
      resultadosBusqueda.innerHTML = '';
      resultadosBusqueda.style.display = 'none';
    }
    const productoManual = document.getElementById('productoManual');
    if (productoManual) {
      productoManual.value = '';
      productoManual.style.display = 'none';
    }

    // Limpiar tabla de items
    const tablaItems = document.getElementById('itemsCotizacion');
    if (!tablaItems) {
      throw new Error('La tabla de items no existe');
    }
    tablaItems.innerHTML = '';

    // Actualizar total
    actualizarTotalCotizacion();

    // Cerrar el modal de cotizaciones primero
    const modalCotizaciones = bootstrap.Modal.getInstance(document.getElementById('modalCotizaciones'));
    if (modalCotizaciones) {
      modalCotizaciones.hide();
    }

    // Mostrar el modal de nueva cotización
    const modal = new bootstrap.Modal(modalElement, {
      backdrop: 'static',
      keyboard: false
    });
    modal.show();

    // Asegurar que el modal esté por encima
    modalElement.style.zIndex = '1060';
  } catch (error) {
    console.error('Error detallado:', error);
    alert(`Error al mostrar el formulario de nueva cotización: ${error.message}`);
  }
}

// Función para mostrar el modal de PIN
function mostrarModalPin(accion) {
  accionPendiente = accion;
  const modal = new bootstrap.Modal(document.getElementById('modalPinAcceso'));
  document.getElementById('pinAcceso').value = '';
  document.getElementById('mensajeErrorPin').style.display = 'none';
  
  // Actualizar el título del modal según la acción
  const tituloModal = document.getElementById('modalPinAccesoLabel');
  if (tituloModal) {
    if (accion === 'cierre-administrativo') {
      tituloModal.textContent = 'Acceso Restringido - Cierre Administrativo';
    } else if (accion === 'balance') {
      tituloModal.textContent = 'Acceso Restringido - Balance';
    } else if (accion === 'inventario') {
      tituloModal.textContent = 'Acceso Restringido - Inventario';
    } else if (accion === 'historial-admin') {
      tituloModal.textContent = 'Acceso Restringido - Historial Administrativo';
    } else {
      tituloModal.textContent = 'Acceso Restringido';
    }
  }
  
  modal.show();
}

// Función para verificar el PIN
function verificarPinAcceso() {
  const pinIngresado = document.getElementById('pinAcceso').value;
  const mensajeError = document.getElementById('mensajeErrorPin');
  
  if (pinIngresado === PIN_ACCESO) {
    // Cerrar modal de PIN
    const modal = bootstrap.Modal.getInstance(document.getElementById('modalPinAcceso'));
    modal.hide();
    
    // Ejecutar la acción pendiente
    if (accionPendiente === 'balance') {
      console.log('🔐 Acceso autorizado al Balance');
      mostrarModalBalance();
    } else if (accionPendiente === 'inventario') {
      console.log('🔐 Acceso autorizado al Inventario');
      window.location.href = 'inventario.html';
    } else if (accionPendiente === 'cierre-administrativo') {
      console.log('🔐 Acceso autorizado al Cierre Administrativo');
      mostrarModalCierreDiario();
    } else if (accionPendiente === 'historial-admin') {
      console.log('🔐 Acceso autorizado al Historial Administrativo');
      // Cambiar a la pestaña de cierres administrativos
      const tabCierresAdmin = document.getElementById('cierres-admin-tab');
      if (tabCierresAdmin) {
        const tab = new bootstrap.Tab(tabCierresAdmin);
        tab.show();
      }
    }
    
    // Limpiar acción pendiente
    accionPendiente = null;
  } else {
    mensajeError.style.display = 'block';
    document.getElementById('pinAcceso').value = '';
  }
}

// Modificar el botón de balance en el HTML para usar el PIN
document.addEventListener('DOMContentLoaded', function() {
  const btnBalance = document.querySelector('button[onclick="mostrarModalBalance()"]');
  if (btnBalance) {
    btnBalance.onclick = function() {
      mostrarModalPin('balance');
    };
  }
  
  const btnInventario = document.querySelector('a[href="inventario.html"]');
  if (btnInventario) {
    btnInventario.onclick = function(e) {
      e.preventDefault();
      mostrarModalPin('inventario');
    };
  }
});

// Función para migrar cierres existentes
function migrarCierresExistentes() {
    try {
        const cierresAntiguos = JSON.parse(localStorage.getItem('cierres')) || [];
        const historialCierres = JSON.parse(localStorage.getItem('historialCierres')) || [];
        
        if (cierresAntiguos.length > 0) {
            // Agregar los cierres antiguos al historial
            historialCierres.push(...cierresAntiguos);
            localStorage.setItem('historialCierres', JSON.stringify(historialCierres));
            
            // Limpiar la clave antigua
            localStorage.removeItem('cierres');
        }
    } catch (error) {
        console.error('Error al migrar cierres:', error);
    }
}

// Llamar a la migración al cargar la página
document.addEventListener('DOMContentLoaded', function() {
    migrarCierresExistentes();
    // ... resto del código existente ...
});

// Función para cargar clientes en el select de cotización
function cargarClientesCotizacion() {
    const selectCliente = document.getElementById('clienteCotizacion');
    if (!selectCliente) return;
    selectCliente.innerHTML = '<option value="">Seleccionar cliente</option>';
    const clientes = JSON.parse(localStorage.getItem('clientes')) || [];
    clientes.forEach(cliente => {
        const option = document.createElement('option');
        option.value = cliente.id;
        option.textContent = cliente.nombre;
        selectCliente.appendChild(option);
    });
}

// Modificar mostrarModalNuevaCotizacion para usar cargarClientesCotizacion
const mostrarModalNuevaCotizacionOriginal = mostrarModalNuevaCotizacion;
mostrarModalNuevaCotizacion = function() {
    try {
        // Verificar que el modal existe
        const modalElement = document.getElementById('modalNuevaCotizacion');
        if (!modalElement) {
            throw new Error('El modal de nueva cotización no existe en el DOM');
        }

        // Inicializar arrays si no existen
        if (!Array.isArray(window.itemsCotizacion)) {
            window.itemsCotizacion = [];
        }

        // Verificar y establecer fecha actual
        const fechaInput = document.getElementById('fechaCotizacion');
        if (!fechaInput) {
            throw new Error('El campo de fecha no existe');
        }
        const hoy = new Date();
        fechaInput.value = hoy.toISOString().split('T')[0];

        // Cargar clientes en el select
        cargarClientesCotizacion();

        // Cargar categorías
        if (typeof cargarCategoriasCotizacion === 'function') {
            cargarCategoriasCotizacion();
        }

        // Limpiar campos de búsqueda y resultados
        const buscarProducto = document.getElementById('buscarProducto');
        if (buscarProducto) {
            buscarProducto.value = '';
        }
        const resultadosBusqueda = document.getElementById('resultadosBusqueda');
        if (resultadosBusqueda) {
            resultadosBusqueda.innerHTML = '';
            resultadosBusqueda.style.display = 'none';
        }
        const productoManual = document.getElementById('productoManual');
        if (productoManual) {
            productoManual.value = '';
            productoManual.style.display = 'none';
        }

        // Limpiar tabla de items
        const tablaItems = document.getElementById('itemsCotizacion');
        if (tablaItems) {
            tablaItems.innerHTML = '';
        }
        document.getElementById('totalCotizacion').textContent = formatearPrecio(0);

        // Mostrar el modal
        const modal = new bootstrap.Modal(modalElement);
        modal.show();
    } catch (error) {
        console.error('Error al mostrar modal de cotización:', error);
        alert('Error al mostrar el modal de cotización');
    }
}

// Modificar guardarNuevoCliente para actualizar el select y seleccionar el nuevo cliente
const guardarNuevoClienteOriginal = guardarNuevoCliente;
guardarNuevoCliente = function() {
    try {
        const form = document.getElementById('formNuevoCliente');
        if (!form.checkValidity()) {
            form.reportValidity();
            return;
        }

        const cliente = {
            id: Date.now(),
            nombre: document.getElementById('nombreCliente').value.trim(),
            telefono: document.getElementById('telefonoCliente').value.trim(),
            direccion: document.getElementById('direccionCliente').value.trim(),
            email: document.getElementById('emailCliente').value.trim()
        };

        // Guardar en localStorage
        const clientes = JSON.parse(localStorage.getItem('clientes')) || [];
        clientes.push(cliente);
        localStorage.setItem('clientes', JSON.stringify(clientes));

        // Actualizar select de clientes y seleccionar el nuevo
        cargarClientesCotizacion();
        const selectCliente = document.getElementById('clienteCotizacion');
        selectCliente.value = cliente.id;

        // Cerrar modal
        const modal = bootstrap.Modal.getInstance(document.getElementById('modalNuevoCliente'));
        modal.hide();

        alert('Cliente guardado exitosamente');
    } catch (error) {
        console.error('Error al guardar cliente:', error);
        alert('Error al guardar el cliente');
    }
}

// Migración de fechas de gastos a formato ISO
function migrarFechasGastosISO() {
    let gastos = JSON.parse(localStorage.getItem('gastos')) || [];
    let cambiado = false;
    gastos = gastos.map(gasto => {
        if (gasto.fecha && !/^\d{4}-\d{2}-\d{2}T/.test(gasto.fecha)) {
            // Si la fecha no es ISO, intentamos convertirla
            // Soporta formatos como dd/mm/yyyy o yyyy-mm-dd
            let partes;
            if (/^\d{2}\/\d{2}\/\d{4}$/.test(gasto.fecha)) {
                partes = gasto.fecha.split('/');
                // dd/mm/yyyy
                gasto.fecha = new Date(`${partes[2]}-${partes[1]}-${partes[0]}`).toISOString();
                cambiado = true;
            } else if (/^\d{4}-\d{2}-\d{2}$/.test(gasto.fecha)) {
                // yyyy-mm-dd
                gasto.fecha = new Date(gasto.fecha).toISOString();
                cambiado = true;
            }
        }
        return gasto;
    });
    if (cambiado) {
        localStorage.setItem('gastos', JSON.stringify(gastos));
        console.log('Fechas de gastos migradas a formato ISO');
    }
}

// Llamar la migración al cargar datos
(function() {
    migrarFechasGastosISO();
    // --- MIGRAR GASTOS A HISTORIAL ---
    if (!localStorage.getItem('historialGastos')) {
        const gastos = JSON.parse(localStorage.getItem('historialGastos')) || [];
console.log('[BALANCE] Fuente de gastos: historialGastos', gastos);
        localStorage.setItem('historialGastos', JSON.stringify(gastos));
        console.log('[GASTOS] Migrados gastos iniciales a historialGastos');
    }
    
    // --- INICIALIZAR SISTEMA DE RECORDATORIOS ---
    cargarRecordatorios();
    crearRecordatoriosAutomaticos();
    
    // Configurar verificación periódica de recordatorios
    setInterval(verificarRecordatoriosVencidos, 60000); // Cada minuto
    setInterval(crearRecordatoriosAutomaticos, 300000); // Cada 5 minutos
    setInterval(crearRecordatorioCierreAutomatico, 600000); // Cada 10 minutos
})();

// Utilidad para obtener solo la fecha en formato YYYY-MM-DD
function soloFechaISO(fecha) {
    if (!fecha) return '';
    const d = new Date(fecha);
    return d.toISOString().split('T')[0];
}

// Función para mostrar el modal "Acerca de"
function mostrarAcercaDe() {
    const modal = new bootstrap.Modal(document.getElementById('modalAcercaDe'));
    modal.show();
}

// ===== EXPORTAR FUNCIONES PARA USO GLOBAL =====
// Funciones de recordatorios
window.crearRecordatorio = crearRecordatorio;
window.completarRecordatorio = completarRecordatorio;
window.eliminarRecordatorio = eliminarRecordatorio;
window.obtenerRecordatoriosUrgentes = obtenerRecordatoriosUrgentes;
window.obtenerRecordatoriosPendientesPorTipo = obtenerRecordatoriosPendientesPorTipo;
window.completarRecordatorioPorTipo = completarRecordatorioPorTipo;
window.crearRecordatorioPedidoCocina = crearRecordatorioPedidoCocina;
window.crearRecordatorioLimpiezaMesa = crearRecordatorioLimpiezaMesa;
window.crearRecordatorioInventarioProducto = crearRecordatorioInventarioProducto;
window.crearRecordatorioCierreAutomatico = crearRecordatorioCierreAutomatico;
window.activarNotificacionesNavegador = activarNotificacionesNavegador;
window.verificarEstadoNotificaciones = verificarEstadoNotificaciones;
window.mostrarEstadoNotificaciones = mostrarEstadoNotificaciones;

// Funciones de vista previa
window.mostrarVistaPreviaPedido = mostrarVistaPreviaPedido;
window.mostrarVistaPreviaRecibo = mostrarVistaPreviaRecibo;
  