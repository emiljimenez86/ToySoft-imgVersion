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

// Memoria de nombres de domiciliarios (autocompletado)
const STORAGE_DOMICILIARIOS = 'nombresDomiciliarios';
const MAX_DOMICILIARIOS = 50;
function obtenerNombresDomiciliarios() {
  try {
    const s = localStorage.getItem(STORAGE_DOMICILIARIOS);
    return s ? JSON.parse(s) : [];
  } catch (e) {
    return [];
  }
}
function guardarNombreDomiciliario(nombre) {
  const n = (nombre || '').trim();
  if (!n) return;
  let lista = obtenerNombresDomiciliarios();
  lista = lista.filter(x => x.toLowerCase() !== n.toLowerCase());
  lista.unshift(n);
  lista = lista.slice(0, MAX_DOMICILIARIOS);
  localStorage.setItem(STORAGE_DOMICILIARIOS, JSON.stringify(lista));
  actualizarDatalistDomiciliarios();
}
function actualizarDatalistDomiciliarios() {
  const input = document.getElementById('nombreDomiciliario');
  const datalist = document.getElementById('listaDomiciliarios');
  if (!input || !datalist) return;
  datalist.innerHTML = '';
  const nombres = obtenerNombresDomiciliarios();
  nombres.forEach(nombre => {
    const opt = document.createElement('option');
    opt.value = nombre;
    datalist.appendChild(opt);
  });
}

// Función simplificada para obtener todas las ventas del día
function obtenerTodasLasVentas() {
    try {
        // Leer de historialVentas (fuente principal)
        const historialVentas = JSON.parse(localStorage.getItem('historialVentas') || '[]');
        
        // Leer de ventas (ventas activas)
        const ventasActivas = JSON.parse(localStorage.getItem('ventas') || '[]');
        
        // Leer de domicilios
        const domicilios = JSON.parse(localStorage.getItem('domicilios') || '[]');
        
        // Combinar todas las fuentes
        const todasLasVentas = [...historialVentas, ...ventasActivas, ...domicilios];
        
        // Filtrar ventas válidas y deduplicar por ID
        const ventasValidas = [];
    const idsVistos = new Set();
    
        for (const venta of todasLasVentas) {
            if (venta && venta.id && venta.total && !idsVistos.has(venta.id)) {
            idsVistos.add(venta.id);
                ventasValidas.push(venta);
            }
        }
        
        console.log(`📊 Total ventas encontradas: ${ventasValidas.length}`);
        return ventasValidas;
        
    } catch (error) {
        console.error('Error al obtener ventas:', error);
        return [];
    }
}

// Helper: parseo robusto de fechas (ISO y formato local dd/mm/yyyy, hh:mm:ss a. m./p. m.)
function parseFechaSeguro(valor) {
    if (valor instanceof Date) return valor;
    if (typeof valor !== 'string') return null;

    // Intentar ISO primero
    const iso = new Date(valor);
    if (!isNaN(iso.getTime())) return iso;

    // Intentar formato local: 16/9/2025, 5:58:46 p. m.
    const re = /^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:,\s*(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(a\. m\.|p\. m\.)\s*)?$/i;
    const m = valor.match(re);
    if (m) {
        const d = parseInt(m[1], 10);
        const mo = parseInt(m[2], 10) - 1;
        const y = parseInt(m[3], 10);
        let h = m[4] ? parseInt(m[4], 10) : 0;
        const min = m[5] ? parseInt(m[5], 10) : 0;
        const s = m[6] ? parseInt(m[6], 10) : 0;
        const ampm = m[7] ? m[7].toLowerCase() : null;
        if (ampm && ampm.includes('p. m.') && h < 12) h += 12;
        if (ampm && ampm.includes('a. m.') && h === 12) h = 0;
        const dt = new Date(y, mo, d, h, min, s);
        if (!isNaN(dt.getTime())) return dt;
    }
    return null;
}

// Helper: compara fechas por componentes locales (año/mes/día)
function esMismaFechaLocal(fechaA, fechaB = new Date()) {
    try {
        const a = parseFechaSeguro(fechaA);
        const b = parseFechaSeguro(fechaB) || new Date();
        if (!a) return false;
        return a.getFullYear() === b.getFullYear() &&
               a.getMonth() === b.getMonth() &&
               a.getDate() === b.getDate();
    } catch (e) {
        return false;
    }
}

// Fecha "de hoy" para cierre y ventas del día. Si está activa la opción
// "Operar después de medianoche", el día laboral termina a la hora configurada
// (ej: 4 AM), así que entre 00:00 y 3:59 se sigue considerando "ayer".
function getFechaHoyParaCierre() {
    const activo = localStorage.getItem('operarDespuesMedianoche') === 'true';
    if (!activo) return new Date();
    const ahora = new Date();
    const horaFin = parseInt(localStorage.getItem('horaFinDiaLaboral') || '4', 10);
    const hora = ahora.getHours();
    if (hora < horaFin) {
        const ayer = new Date(ahora.getFullYear(), ahora.getMonth(), ahora.getDate() - 1, 12, 0, 0);
        return ayer;
    }
    return new Date(ahora.getFullYear(), ahora.getMonth(), ahora.getDate(), 12, 0, 0);
}

// Normaliza el historial de ventas: asegura fecha ISO, método/tipo coherentes
function normalizarHistorialVentas() {
    try {
        let historial = JSON.parse(localStorage.getItem('historialVentas') || '[]');
        if (!Array.isArray(historial)) return;

        const normalizado = historial.map((venta) => {
            const copia = { ...venta };

            // Fecha: si no es ISO, convertir a ISO local
            if (typeof copia.fecha === 'string' || copia.fecha instanceof Date) {
                const d = parseFechaSeguro(copia.fecha);
                if (d) {
                    copia.fecha = d.toISOString();
                } else {
                    // Mantener fecha original si no podemos parsear; NO cambiarla a hoy
                    copia.fechaOriginal = copia.fecha;
                }
            }

            // Método de pago a minúsculas
            if (copia.metodoPago && typeof copia.metodoPago === 'string') {
                copia.metodoPago = copia.metodoPago.toLowerCase().trim();
                if (copia.metodoPago === 'combinado') copia.metodoPago = 'mixto';
            }

            // Tipo de venta estandarizado - NO modificar si ya existe
            if (!copia.tipo) {
                copia.tipo = copia.mesa && copia.mesa !== 'VENTA DIRECTA' ? 'mesa' : 'venta_rapida';
            }
            // Si ya tiene tipo, mantenerlo tal como está

            // Totales numéricos seguros
            copia.total = parseFloat(copia.total) || 0;

            return copia;
        });

        localStorage.setItem('historialVentas', JSON.stringify(normalizado));
    } catch (e) {
        console.error('Error normalizando historial de ventas:', e);
    }
}

// Función para limpiar duplicados en localStorage
function limpiarDuplicadosVentas() {
    try {
        console.log('=== LIMPIANDO DUPLICADOS DE VENTAS ===');
        
        const ventas = JSON.parse(localStorage.getItem('ventas') || '[]');
        const historialVentas = JSON.parse(localStorage.getItem('historialVentas') || '[]');
        
        console.log(`Ventas antes: ${ventas.length}`);
        console.log(`Historial antes: ${historialVentas.length}`);
        
        // Crear un mapa de ventas únicas por ID
        const ventasUnicas = new Map();
        
        // Agregar ventas del historial (prioridad)
        historialVentas.forEach(venta => {
            if (venta.id) {
                ventasUnicas.set(venta.id, venta);
            }
        });
        
        // Agregar ventas de ventas (solo si no existen en historial)
        ventas.forEach(venta => {
            if (venta.id && !ventasUnicas.has(venta.id)) {
                ventasUnicas.set(venta.id, venta);
            }
        });
        
        const ventasLimpias = Array.from(ventasUnicas.values());
        
        // Guardar solo en historialVentas
        localStorage.setItem('historialVentas', JSON.stringify(ventasLimpias));
        
        // Limpiar ventas duplicadas
        localStorage.setItem('ventas', '[]');
        
        console.log(`Ventas después de limpiar: ${ventasLimpias.length}`);
        console.log('✅ Duplicados eliminados exitosamente');
        
        return ventasLimpias;
    } catch (error) {
        console.error('Error al limpiar duplicados:', error);
        return [];
    }
}

// Función para limpiar completamente el localStorage de ventas
function limpiarCompletamenteVentas() {
    try {
        console.log('=== LIMPIEZA COMPLETA DE VENTAS ===');
        
        // Obtener todas las ventas
        const ventas = JSON.parse(localStorage.getItem('ventas') || '[]');
        const historialVentas = JSON.parse(localStorage.getItem('historialVentas') || '[]');
        
        console.log(`Ventas totales antes: ${ventas.length + historialVentas.length}`);
        
        // Crear un mapa de ventas únicas por ID
        const ventasUnicas = new Map();
        
        // Agregar todas las ventas (historial + ventas)
        [...historialVentas, ...ventas].forEach(venta => {
            if (venta.id) {
                ventasUnicas.set(venta.id, venta);
            }
        });
        
        const ventasLimpias = Array.from(ventasUnicas.values());
        
        // Guardar solo en historialVentas
        localStorage.setItem('historialVentas', JSON.stringify(ventasLimpias));
        
        // Limpiar ventas duplicadas
        localStorage.setItem('ventas', '[]');
        
        console.log(`Ventas únicas después: ${ventasLimpias.length}`);
        console.log('✅ Limpieza completa exitosa');
        
        return ventasLimpias;
    } catch (error) {
        console.error('Error en limpieza completa:', error);
        return [];
    }
}

// Función para reiniciar completamente el sistema después del cierre
function reiniciarSistemaCompleto() {
    try {
        console.log('=== REINICIANDO SISTEMA COMPLETO ===');
        // Marcar hora de cierre para que los siguientes cálculos ignoren ventas previas
        localStorage.setItem('ultimaHoraCierre', new Date().toISOString());
        
        // Reiniciar contadores de DOM/REC en almacenamiento para próximo turno
        localStorage.setItem('contadorDomicilios', '0');
        localStorage.setItem('contadorRecoger', '0');
        localStorage.setItem('ultimaFechaContadores', new Date().toLocaleDateString());
        
        // 1. Limpiar ventas del día actual
        console.log('🧹 Limpiando ventas del día...');
        localStorage.setItem('ventas', '[]');
        
        // Importante: NO limpiar el historial de ventas del día actual.
        // Antes se filtraban y eliminaban las ventas del día de hoy de "historialVentas",
        // lo que hacía que luego el Balance (por fecha) y "Ventas por producto"
        // se quedaran sin información después de un cierre administrativo.
        //
        // Ahora se conserva todo el historial para que:
        // - El balance pueda consultar cualquier día por fecha.
        // - La sección "Ventas por producto" siga funcionando incluso después de cerrar.
        console.log('📊 Manteniendo historial de ventas para reportes por fecha...');
        const hoy = getFechaHoyParaCierre();
        
        // 2. Limpiar domicilios del día actual
        console.log('🚚 Limpiando domicilios del día...');
        const domicilios = JSON.parse(localStorage.getItem('domicilios') || '[]');
        const hoyStr = hoy.getFullYear() + '-' + String(hoy.getMonth() + 1).padStart(2, '0') + '-' + String(hoy.getDate()).padStart(2, '0');
        const domiciliosFiltrados = domicilios.filter(domicilio => {
            try {
                const fechaDomicilio = new Date(domicilio.fecha).toISOString().slice(0, 10);
                return fechaDomicilio !== hoyStr;
            } catch (e) {
                return true; // Mantener si hay error en fecha
            }
        });
        localStorage.setItem('domicilios', JSON.stringify(domiciliosFiltrados));
        
        // 3. Limpiar gastos del día actual
        console.log('💰 Limpiando gastos del día...');
        const gastos = JSON.parse(localStorage.getItem('gastos') || '[]');
        const gastosFiltrados = gastos.filter(gasto => {
            try {
                const fechaGasto = new Date(gasto.fecha).toISOString().slice(0, 10);
                return fechaGasto !== hoyStr;
            } catch (e) {
                return true; // Mantener si hay error en fecha
            }
        });
        localStorage.setItem('gastos', JSON.stringify(gastosFiltrados));
        
        // 4. Reiniciar estado de mesas
        console.log('🪑 Reiniciando estado de mesas...');
        localStorage.setItem('mesasActivas', '[]');
        localStorage.setItem('estadoMesas', '[]');
        
        // 5. Reiniciar órdenes de cocina
        console.log('👨‍🍳 Reiniciando órdenes de cocina...');
        localStorage.setItem('ordenesCocina', '[]');
        
        // 6. Limpiar órdenes pendientes
        console.log('📋 Limpiando órdenes pendientes...');
        localStorage.setItem('ordenesPendientes', '[]');
        
        // 7. Reiniciar variables globales
        console.log('🔄 Reiniciando variables globales...');
        if (typeof mesasActivas !== 'undefined') {
            mesasActivas.clear();
        }
        if (typeof ordenesCocina !== 'undefined') {
            ordenesCocina.clear();
        }
        
        console.log('✅ Sistema reiniciado completamente');
        console.log('📊 Estado después del reinicio:');
        console.log(`   - Ventas del día: ${JSON.parse(localStorage.getItem('ventas') || '[]').length}`);
        console.log(`   - Historial de ventas: ${historialFiltrado.length}`);
        console.log(`   - Domicilios del día: ${domiciliosFiltrados.length}`);
        console.log(`   - Gastos del día: ${gastosFiltrados.length}`);
        console.log(`   - Mesas activas: ${JSON.parse(localStorage.getItem('mesasActivas') || '[]').length}`);
        console.log(`   - Órdenes de cocina: ${JSON.parse(localStorage.getItem('ordenesCocina') || '[]').length}`);
        
        return true;
    } catch (error) {
        console.error('Error al reiniciar sistema:', error);
        return false;
    }
}

// Función para limpiar la interfaz de ventas después del cierre
function limpiarInterfazVentas() {
    try {
        console.log('🧹 Limpiando interfaz de ventas...');
        
        // Limpiar carrito de venta rápida
        if (typeof carritoVentaRapida !== 'undefined') {
            carritoVentaRapida.length = 0;
        }
        
        // Limpiar totales de venta rápida
        const totalElement = document.getElementById('totalVentaRapida');
        if (totalElement) {
            totalElement.textContent = '$ 0';
        }
        
        // Limpiar lista de productos en venta rápida
        const listaProductos = document.getElementById('listaProductosVentaRapida');
        if (listaProductos) {
            listaProductos.innerHTML = '';
        }
        
        // Limpiar campos de pago
        const montoRecibido = document.getElementById('montoRecibido');
        if (montoRecibido) {
            montoRecibido.value = '';
        }
        
        const cambio = document.getElementById('cambio');
        if (cambio) {
            cambio.textContent = '$ 0';
        }
        
        // Limpiar selección de método de pago
        const metodoPago = document.getElementById('metodoPago');
        if (metodoPago) {
            metodoPago.value = 'efectivo';
        }
        
        // Limpiar campos de transferencia
        const numeroTransferencia = document.getElementById('numeroTransferencia');
        if (numeroTransferencia) {
            numeroTransferencia.value = '';
        }
        
        // Limpiar campos de tarjeta
        const numeroTarjeta = document.getElementById('numeroTarjeta');
        if (numeroTarjeta) {
            numeroTarjeta.value = '';
        }
        
        // Limpiar campos de crédito
        const nombreCliente = document.getElementById('nombreCliente');
        if (nombreCliente) {
            nombreCliente.value = '';
        }
        
        const telefonoCliente = document.getElementById('telefonoCliente');
        if (telefonoCliente) {
            telefonoCliente.value = '';
        }
        
        // Limpiar campos de domicilio
        const direccionDomicilio = document.getElementById('direccionDomicilio');
        if (direccionDomicilio) {
            direccionDomicilio.value = '';
        }
        
        const horaRecoger = document.getElementById('horaRecoger');
        if (horaRecoger) {
            horaRecoger.value = '';
        }
        
        // Limpiar campos de cliente
        const nombreClienteGeneral = document.getElementById('nombreClienteGeneral');
        if (nombreClienteGeneral) {
            nombreClienteGeneral.value = '';
        }
        
        const telefonoClienteGeneral = document.getElementById('telefonoClienteGeneral');
        if (telefonoClienteGeneral) {
            telefonoClienteGeneral.value = '';
        }
        
        // Limpiar campos de propina y descuento
        const propina = document.getElementById('propina');
        if (propina) {
            propina.value = '0';
        }
        
        const descuento = document.getElementById('descuento');
        if (descuento) {
            descuento.value = '0';
        }
        
        // Limpiar campos de domicilio
        const nombreDomiciliario = document.getElementById('nombreDomiciliario');
        if (nombreDomiciliario) {
            nombreDomiciliario.value = '';
        }
        const valorDomicilio = document.getElementById('valorDomicilio');
        if (valorDomicilio) {
            valorDomicilio.value = '0';
        }
        
        // Ocultar campos específicos de pago
        const camposTransferencia = document.getElementById('camposTransferencia');
        if (camposTransferencia) {
            camposTransferencia.style.display = 'none';
        }
        
        const camposTarjeta = document.getElementById('camposTarjeta');
        if (camposTarjeta) {
            camposTarjeta.style.display = 'none';
        }
        
        const camposCredito = document.getElementById('camposCredito');
        if (camposCredito) {
            camposCredito.style.display = 'none';
        }
        
        const camposDomicilio = document.getElementById('camposDomicilio');
        if (camposDomicilio) {
            camposDomicilio.style.display = 'none';
        }
        
        console.log('✅ Interfaz de ventas limpiada');
        
    } catch (error) {
        console.error('Error al limpiar interfaz de ventas:', error);
    }
}

// Función para actualizar solo los datos del modal de cierre sin recrearlo
function actualizarDatosCierreModal() {
    try {
        console.log('🔄 Actualizando datos del modal de cierre...');
        
        // Obtener el rango seleccionado
        const rangoSeleccionado = document.querySelector('input[name="rangoVentas"]:checked')?.value || 'ultimoCierre';
        
        // Obtener la marca de tiempo del último cierre (si existe)
        const ultimaHoraCierreStr = localStorage.getItem('ultimaHoraCierre');
        const ultimaHoraCierre = ultimaHoraCierreStr ? new Date(ultimaHoraCierreStr) : null;
        
        // Obtener ventas
        const todasLasVentas = obtenerTodasLasVentas();
        const hoy = getFechaHoyParaCierre();
        
        // Filtrar ventas según el rango seleccionado
        const ventasHoy = todasLasVentas.filter(v => {
            try {
                const fechaVenta = new Date(v.fecha);
                
                if (rangoSeleccionado === 'todoDia') {
                    // Mostrar todas las ventas del día actual
                    return esMismaFechaLocal(fechaVenta, hoy);
                } else {
                    // Comportamiento por defecto: desde último cierre
                    if (ultimaHoraCierre) {
                        const despuesDeCierre = fechaVenta.getTime() >= new Date(ultimaHoraCierre).getTime();
                        const mismoDia = esMismaFechaLocal(fechaVenta, hoy);
                        return despuesDeCierre && mismoDia;
                    }
                    return esMismaFechaLocal(fechaVenta, hoy);
                }
            } catch (e) {
                return false;
            }
        });
        
        console.log(`📊 Ventas filtradas: ${ventasHoy.length} (rango: ${rangoSeleccionado})`);
        
        // Calcular totales
        const calculos = calcularTotalesVentas(ventasHoy);
        const totalVentas = calculos.totalGeneral;
        const totalEfectivo = calculos.totalEfectivo;
        const totalTransferencia = calculos.totalTransferencia;
        const totalTarjeta = calculos.totalTarjeta;
        const totalCredito = calculos.totalCredito;
        const totalMixto = calculos.totalMixto;
        
        // Domicilios y por domiciliario
        const totalesDomiciliariosModal = {};
        const totalDomiciliosModal = ventasHoy.reduce((sum, v) => {
            const valorDom = parseFloat(v.valorDomicilio) || 0;
            if (valorDom > 0) {
                const nombre = (v.nombreDomiciliario || v.domiciliario || 'SIN NOMBRE').toString().trim() || 'SIN NOMBRE';
                totalesDomiciliariosModal[nombre] = (totalesDomiciliariosModal[nombre] || 0) + valorDom;
            }
            return sum + valorDom;
        }, 0);
        
        // Obtener gastos del día
        const gastos = JSON.parse(localStorage.getItem('gastos')) || [];
        const hoyStrModal = hoy.getFullYear() + '-' + String(hoy.getMonth() + 1).padStart(2, '0') + '-' + String(hoy.getDate()).padStart(2, '0');
        const gastosHoy = gastos.filter(g => {
            const fechaGasto = new Date(g.fecha);
            if (ultimaHoraCierre) {
                return fechaGasto > ultimaHoraCierre;
            }
            const fechaGastoStr = fechaGasto.toISOString().slice(0, 10);
            return fechaGastoStr === hoyStrModal;
        });
        const totalGastos = gastosHoy.reduce((sum, g) => sum + (parseFloat(g.monto) || 0), 0);
        
        // Calcular balance final
        const balanceFinal = totalVentas - totalGastos;
        
        // Mostrar últimos y próximos consecutivos DOM/REC en el modal
        try {
            const domMem = (typeof contadorDomicilios !== 'undefined' && Number.isFinite(contadorDomicilios)) ? contadorDomicilios : 0;
            const recMem = (typeof contadorRecoger !== 'undefined' && Number.isFinite(contadorRecoger)) ? contadorRecoger : 0;
            const domLS = parseInt(localStorage.getItem('contadorDomicilios')) || 0;
            const recLS = parseInt(localStorage.getItem('contadorRecoger')) || 0;
            // También revisar mesas activas residuales por si hay DOM-/REC- en memoria
            let domFromMesas = 0, recFromMesas = 0;
            try {
                const mesasGuardadas = localStorage.getItem('mesasActivas');
                if (mesasGuardadas) {
                    const mesasArray = JSON.parse(mesasGuardadas);
                    for (const [mesaId] of mesasArray) {
                        if (typeof mesaId === 'string' && mesaId.startsWith('DOM-')) {
                            const n = parseInt(mesaId.split('-')[1]) || 0;
                            domFromMesas = Math.max(domFromMesas, n);
                        } else if (typeof mesaId === 'string' && mesaId.startsWith('REC-')) {
                            const n = parseInt(mesaId.split('-')[1]) || 0;
                            recFromMesas = Math.max(recFromMesas, n);
                        }
                    }
                }
            } catch {}

            const ultimoDom = Math.max(domMem, domLS, domFromMesas);
            const ultimoRec = Math.max(recMem, recLS, recFromMesas);
            if (document.getElementById('ultimoDom')) {
                document.getElementById('ultimoDom').textContent = `D${ultimoDom}`;
            }
            if (document.getElementById('ultimoRec')) {
                document.getElementById('ultimoRec').textContent = `R${ultimoRec}`;
            }
            if (document.getElementById('proximoDom')) {
                const proximoDom = (ultimoDom || 0) + 1;
                document.getElementById('proximoDom').textContent = `D${proximoDom}`;
            }
            if (document.getElementById('proximoRec')) {
                const proximoRec = (ultimoRec || 0) + 1;
                document.getElementById('proximoRec').textContent = `R${proximoRec}`;
            }
        } catch (e) {
            console.warn('No se pudieron actualizar últimos consecutivos en el modal:', e);
        }

        // Actualizar valores en el modal
        document.getElementById('totalVentasHoy').textContent = `$ ${totalVentas.toLocaleString()}`;
        document.getElementById('totalEfectivoHoy').textContent = `$ ${totalEfectivo.toLocaleString()}`;
        document.getElementById('totalTransferenciaHoy').textContent = `$ ${totalTransferencia.toLocaleString()}`;
        if(document.getElementById('totalTarjetaHoy')) document.getElementById('totalTarjetaHoy').textContent = `$ ${totalTarjeta.toLocaleString()}`;
        if(document.getElementById('totalCreditoHoy')) document.getElementById('totalCreditoHoy').textContent = `$ ${totalCredito.toLocaleString()}`;
        if(document.getElementById('totalMixtoHoy')) document.getElementById('totalMixtoHoy').textContent = `$ ${totalMixto.toLocaleString()}`;
        if (document.getElementById('totalDomiciliosHoy')) {
            document.getElementById('totalDomiciliosHoy').textContent = `$ ${totalDomiciliosModal.toLocaleString()}`;
        }
        const listaDomCierre = document.getElementById('listaDomiciliariosCierre');
        if (listaDomCierre) {
            listaDomCierre.innerHTML = Object.keys(totalesDomiciliariosModal).length === 0 ? '' :
                Object.entries(totalesDomiciliariosModal).map(([nombre, monto]) => `${nombre}: $ ${monto.toLocaleString()}`).join('<br>');
        }
        document.getElementById('totalGastosHoy').textContent = `$ ${totalGastos.toLocaleString()}`;
        document.getElementById('balanceFinal').textContent = `$ ${balanceFinal.toLocaleString()}`;
        
        // Actualizar indicador de rango activo
        const indicadorRango = document.getElementById('indicadorRango');
        if (indicadorRango) {
            const textoRango = rangoSeleccionado === 'todoDia' ? 'Todo el día' : 'Desde último cierre';
            indicadorRango.textContent = `Mostrando: ${textoRango} (${ventasHoy.length} ventas)`;
        }
        
        // Actualizar secciones de ventas rápidas y mesas si existen
        if (document.getElementById('totalVentasRapidasHoy')) {
            document.getElementById('totalVentasRapidasHoy').textContent = `$ ${calculos.totalVentasRapidas.toLocaleString()}`;
        }
        if (document.getElementById('totalEfectivoRapidasHoy')) {
            document.getElementById('totalEfectivoRapidasHoy').textContent = `$ ${calculos.efectivoRapidas.toLocaleString()}`;
        }
        if (document.getElementById('totalTransferenciaRapidasHoy')) {
            document.getElementById('totalTransferenciaRapidasHoy').textContent = `$ ${calculos.transferenciaRapidas.toLocaleString()}`;
        }
        if (document.getElementById('totalTarjetaRapidasHoy')) {
            document.getElementById('totalTarjetaRapidasHoy').textContent = `$ ${calculos.tarjetaRapidas.toLocaleString()}`;
        }
        
        if (document.getElementById('totalVentasMesasHoy')) {
            document.getElementById('totalVentasMesasHoy').textContent = `$ ${calculos.totalVentasMesas.toLocaleString()}`;
        }
        if (document.getElementById('totalEfectivoMesasHoy')) {
            document.getElementById('totalEfectivoMesasHoy').textContent = `$ ${calculos.efectivoMesas.toLocaleString()}`;
        }
        if (document.getElementById('totalTransferenciaMesasHoy')) {
            document.getElementById('totalTransferenciaMesasHoy').textContent = `$ ${calculos.transferenciaMesas.toLocaleString()}`;
        }
        if (document.getElementById('totalTarjetaMesasHoy')) {
            document.getElementById('totalTarjetaMesasHoy').textContent = `$ ${calculos.tarjetaMesas.toLocaleString()}`;
        }
        
        console.log('✅ Datos del modal actualizados correctamente');
        
    } catch (error) {
        console.error('Error al actualizar datos del modal:', error);
    }
}

// Función para limpiar overlays de Bootstrap que puedan quedar activos
function limpiarOverlaysBootstrap() {
    try {
        console.log('🧹 Limpiando overlays de Bootstrap...');
        
        // Remover todos los backdrops de modales
        const backdrops = document.querySelectorAll('.modal-backdrop');
        backdrops.forEach(backdrop => {
            backdrop.remove();
            console.log('✅ Backdrop removido');
        });
        
        // Remover clases del body que causan el oscurecimiento
        document.body.classList.remove('modal-open');
        document.body.style.overflow = '';
        document.body.style.paddingRight = '';
        
        // Remover cualquier overlay de Bootstrap
        const overlays = document.querySelectorAll('.modal, .fade, .show');
        overlays.forEach(overlay => {
            if (overlay.classList.contains('modal-backdrop') || 
                overlay.classList.contains('modal')) {
                overlay.classList.remove('show', 'fade');
                overlay.style.display = 'none';
            }
        });
        
        // Limpiar instancias de modales de Bootstrap
        const modales = document.querySelectorAll('[data-bs-toggle="modal"]');
        modales.forEach(modal => {
            const modalInstance = bootstrap.Modal.getInstance(modal);
            if (modalInstance) {
                modalInstance.dispose();
            }
        });
        
        // Forzar reflow del DOM
        document.body.offsetHeight;
        
        console.log('✅ Overlays de Bootstrap limpiados');
        
    } catch (error) {
        console.error('Error al limpiar overlays de Bootstrap:', error);
    }
}

// Función de debug para verificar el estado del sistema después del cierre
window.debugEstadoSistema = function() {
    console.log('=== DEBUG ESTADO DEL SISTEMA ===');
    
    const ventas = JSON.parse(localStorage.getItem('ventas') || '[]');
    const historialVentas = JSON.parse(localStorage.getItem('historialVentas') || '[]');
    const domicilios = JSON.parse(localStorage.getItem('domicilios') || '[]');
    const gastos = JSON.parse(localStorage.getItem('gastos') || '[]');
    const mesasActivas = JSON.parse(localStorage.getItem('mesasActivas') || '[]');
    const ultimaHoraCierre = localStorage.getItem('ultimaHoraCierre');
    
    console.log('📊 Estado actual:');
    console.log(`   - Ventas activas: ${ventas.length}`);
    console.log(`   - Historial de ventas: ${historialVentas.length}`);
    console.log(`   - Domicilios: ${domicilios.length}`);
    console.log(`   - Gastos: ${gastos.length}`);
    console.log(`   - Mesas activas: ${mesasActivas.length}`);
    console.log(`   - Última hora de cierre: ${ultimaHoraCierre}`);
    
    // Verificar ventas de hoy
    const hoy = new Date();
    const ventasHoy = historialVentas.filter(v => {
        try {
            const fechaVenta = new Date(v.fecha);
            return esMismaFechaLocal(fechaVenta, hoy);
        } catch (e) {
            return false;
        }
    });
    
    console.log(`   - Ventas de hoy en historial: ${ventasHoy.length}`);
    
    if (ventasHoy.length > 0) {
        console.log('⚠️ PROBLEMA: Aún hay ventas de hoy en el historial');
        console.log('Ventas encontradas:', ventasHoy.map(v => ({
            id: v.id,
            fecha: v.fecha,
            total: v.total,
            tipo: v.tipo
        })));
    } else {
        console.log('✅ CORRECTO: No hay ventas de hoy en el historial');
    }
}

// Función de debug para probar el recibo de venta rápida
window.debugReciboVentaRapida = function() {
    console.log('🔍 DEBUG RECIBO VENTA RÁPIDA - PRUEBA');
    
    // Crear una venta de prueba
    const ventaPrueba = {
        id: Date.now(),
        mesa: 'VENTA DIRECTA',
        items: [
            {
                id: 1,
                nombre: 'Empanada de carne',
                precio: 2500,
                cantidad: 3,
                estado: 'listo'
            },
            {
                id: 2,
                nombre: 'Bebida',
                precio: 2000,
                cantidad: 2,
                estado: 'listo'
            }
        ],
        subtotal: 11500,
        propina: 0,
        descuento: 0,
        valorDomicilio: 0,
        total: 11500,
        metodoPago: 'efectivo',
        montoRecibido: 15000,
        cambio: 3500,
        fecha: new Date().toISOString(),
        tipo: 'venta_rapida',
        estado: 'completada'
    };
    
    console.log('Venta de prueba creada:', ventaPrueba);
    
    // Mostrar el recibo
    mostrarReciboVentaRapida(ventaPrueba);
}

// Función de debug para probar el flujo completo de venta rápida
window.debugFlujoVentaRapida = function() {
    console.log('🔍 DEBUG FLUJO COMPLETO VENTA RÁPIDA');
    
    // 1. Crear pedido inicial
    const pedido = {
        items: [],
        cliente: null,
        telefono: null,
        direccion: null,
        horaRecoger: null,
        tipo: 'venta_rapida'
    };
    
    console.log('1. Pedido inicial creado:', pedido);
    
    // 2. Simular agregar productos
    pedido.items.push({
        id: 1,
        nombre: 'Empanada de carne',
        precio: 2500,
        cantidad: 2,
        estado: 'listo'
    });
    
    pedido.items.push({
        id: 2,
        nombre: 'Bebida',
        precio: 2000,
        cantidad: 1,
        estado: 'listo'
    });
    
    console.log('2. Productos agregados:', pedido);
    
    // 3. Calcular total
    const total = pedido.items.reduce((sum, item) => sum + (item.precio * item.cantidad), 0);
    console.log('3. Total calculado:', total);
    
    // 4. Simular procesar venta rápida
    procesarVentaRapida(pedido, total, 'efectivo', total);
    
    console.log('4. Venta procesada');
}

// Función de debug específica para el problema de ventas que se sobrescriben
window.debugVentasConflictivas = function() {
    console.log('=== DEBUG VENTAS CONFLICTIVAS ===');
    
    const historialVentas = JSON.parse(localStorage.getItem('historialVentas') || '[]');
    const hoy = new Date();
    
    // Filtrar ventas de hoy
    const ventasHoy = historialVentas.filter(v => {
        try {
            const fechaVenta = new Date(v.fecha);
            return esMismaFechaLocal(fechaVenta, hoy);
        } catch (e) {
            return false;
        }
    });
    
    console.log(`📊 Ventas de hoy encontradas: ${ventasHoy.length}`);
    
    // Mostrar todas las ventas de hoy con detalles
    ventasHoy.forEach((venta, index) => {
        console.log(`Venta ${index + 1}:`, {
            id: venta.id,
            fecha: venta.fecha,
            mesa: venta.mesa,
            tipo: venta.tipo,
            total: venta.total,
            metodoPago: venta.metodoPago,
            items: venta.items?.length || 0
        });
    });
    
    // Verificar si hay IDs duplicados
    const ids = ventasHoy.map(v => v.id);
    const idsUnicos = [...new Set(ids)];
    
    if (ids.length !== idsUnicos.length) {
        console.log('⚠️ PROBLEMA: Hay IDs duplicados');
        const duplicados = ids.filter((id, index) => ids.indexOf(id) !== index);
        console.log('IDs duplicados:', duplicados);
    } else {
        console.log('✅ IDs únicos correctos');
    }
    
    // Verificar si hay ventas rápidas
    const ventasRapidas = ventasHoy.filter(v => v.tipo === 'venta_rapida' || v.mesa === 'VENTA DIRECTA');
    console.log(`⚡ Ventas rápidas: ${ventasRapidas.length}`);
    
    // Verificar si hay ventas de mesa
    const ventasMesa = ventasHoy.filter(v => v.tipo === 'mesa' && v.mesa !== 'VENTA DIRECTA');
    console.log(`🪑 Ventas de mesa: ${ventasMesa.length}`);
    
    // Calcular totales
    const totalEfectivo = ventasHoy
        .filter(v => v.metodoPago === 'efectivo')
        .reduce((sum, v) => sum + (parseFloat(v.total) || 0), 0);
    
    console.log(`💰 Total efectivo calculado: $${totalEfectivo.toLocaleString()}`);
    
    return {
        ventasHoy,
        ventasRapidas,
        ventasMesa,
        totalEfectivo,
        idsDuplicados: ids.length !== idsUnicos.length
    };
}

// Función de depuración para verificar ventas rápidas
function debugVentasRapidas() {
    console.log('=== DEBUG VENTAS RÁPIDAS ===');
    
    const ventas = JSON.parse(localStorage.getItem('ventas') || '[]');
    const historialVentas = JSON.parse(localStorage.getItem('historialVentas') || '[]');
    
    console.log('Ventas activas:', ventas.length);
    console.log('Historial ventas:', historialVentas.length);
    
    const ventasRapidas = historialVentas.filter(v => v.tipo === 'venta_rapida');
    console.log('Ventas rápidas en historial:', ventasRapidas.length);
    console.log('Ventas rápidas:', ventasRapidas);
    
    const hoy = new Date();
    const ventasRapidasHoy = ventasRapidas.filter(v => {
        try {
            return esMismaFechaLocal(v.fecha, hoy);
        } catch (e) {
            return false;
        }
    });
    
    console.log('Ventas rápidas de hoy:', ventasRapidasHoy.length);
    console.log('Ventas rápidas de hoy:', ventasRapidasHoy);
    
    return {
        ventas,
        historialVentas,
        ventasRapidas,
        ventasRapidasHoy
    };
}


// Variables globales para cotizaciones
window.cotizaciones = window.cotizaciones || [];
let modoProductoManual = false;
let productosFiltrados = [];

// Variable global para la ventana de impresión
let ventanaImpresion = null;

let cotizacionEditandoId = null;

// Variables globales para recordatorios de tareas
let recordatorios = [];
let recordatoriosActivos = [];
let notificacionesActivas = [];

// Variables globales para el PIN y roles
let PIN_ADMIN = '7894'; // PIN de administrador
let PIN_EMPLEADO = '1234'; // PIN de empleado
let PIN_ACCESO = PIN_ADMIN; // PIN por defecto (mantener compatibilidad)
let accionPendiente = null;
let usuarioActual = null; // Almacena el tipo de usuario actual
window.usuarioActual = usuarioActual; // Hacer disponible globalmente

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
    // Leer el historial actual desde localStorage
    let historialActual = JSON.parse(localStorage.getItem('historialVentas') || '[]');
    
    // Asegurarse de que sea un array
    if (!Array.isArray(historialActual)) {
      console.error('historialVentas no es un array:', historialActual);
      historialActual = [];
    }
    
    // Guardar en localStorage
    localStorage.setItem('historialVentas', JSON.stringify(historialActual));
    console.log('Historial de ventas guardado:', historialActual.length, 'ventas');
    
    // Verificar que se guardó correctamente
    const guardado = JSON.parse(localStorage.getItem('historialVentas') || '[]');
    console.log('Verificación de guardado:', guardado.length, 'ventas');
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
  
  // Si no hay datos de administración, NO crear datos de prueba automáticamente
  if (categorias.length === 0) {
    console.log('ℹ️ No hay categorías en administración. El usuario debe crear categorías desde la sección de administración.');
    categorias = [];
  }
  
  if (productos.length === 0) {
    console.log('ℹ️ No hay productos en administración. El usuario debe crear productos desde la sección de administración.');
    productos = [];
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

      // Si los contadores se reiniciaron por cierre, eliminar residuos DOM/REC
      try {
        const contadorDomLS = parseInt(localStorage.getItem('contadorDomicilios')) || 0;
        const contadorRecLS = parseInt(localStorage.getItem('contadorRecoger')) || 0;
        const ultimaHoraCierre = localStorage.getItem('ultimaHoraCierre');
        const huboCierreReciente = !!ultimaHoraCierre;
        if (huboCierreReciente && contadorDomLS === 0 && contadorRecLS === 0) {
          let removidas = 0;
          Array.from(mesasActivas.keys()).forEach((mesaId) => {
            if (typeof mesaId === 'string' && (mesaId.startsWith('DOM-') || mesaId.startsWith('REC-'))) {
              mesasActivas.delete(mesaId);
              removidas++;
            }
          });
          if (removidas > 0) {
            console.log(`🧹 Eliminadas ${removidas} mesas DOM/REC residuales tras cierre`);
            guardarMesas();
          }
        }
      } catch (e) {
        console.warn('No se pudo limpiar mesas DOM/REC residuales:', e);
      }
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
  if (!container) {
    console.log('No se encontró el elemento mesasContainer - probablemente no estamos en la página POS');
    return;
  }
  container.innerHTML = '';

  mesasActivas.forEach((orden, mesa) => {
    const boton = document.createElement('button');
    
    // Determinar el tipo de botón basado en el ID de la mesa
    if (mesa.startsWith('DOM-')) {
      const numeroDomicilio = mesa.split('-')[1];
      boton.className = `mesa-btn mesa-domicilio ${mesa === mesaSeleccionada ? 'mesa-seleccionada' : ''}`;
      boton.innerHTML = `
        <div style="display: flex; flex-direction: column; align-items: center; justify-content: center;">
          <i class="fas fa-motorcycle" style="margin-bottom: 12px; margin-top: -6px;"></i>
          <span class="mesa-numero" style="font-size: 1.5rem;">D${parseInt(numeroDomicilio)}</span>
        </div>
      `;
    } else if (mesa.startsWith('REC-')) {
      const numeroRecoger = mesa.split('-')[1];
      boton.className = `mesa-btn mesa-recoger ${mesa === mesaSeleccionada ? 'mesa-seleccionada' : ''}`;
      boton.innerHTML = `
        <div style="display: flex; flex-direction: column; align-items: center; justify-content: center;">
          <i class="fas fa-shopping-bag" style="margin-bottom: 12px; margin-top: -6px;"></i>
          <span class="mesa-numero" style="font-size: 1.5rem;">R${parseInt(numeroRecoger)}</span>
        </div>
      `;
    } else {
      boton.className = `mesa-btn mesa-activa ${mesa === mesaSeleccionada ? 'mesa-seleccionada' : ''}`;
      boton.innerHTML = `
        <div style="display: flex; flex-direction: column; align-items: center; justify-content: center;">
          <span style="font-size: 1rem; opacity: 0.95; margin-bottom: 8px; margin-top: -4px;">Mesa</span>
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
    console.log('No se encontró el elemento #categorias - probablemente no estamos en la página POS');
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

  // Mostrar u ocultar salsas según el producto
  const salsasContainer = document.getElementById('salsasProductoContainer');
  const salsasCheckboxes = document.getElementById('salsasProductoCheckboxes');
  if (salsasContainer && salsasCheckboxes) {
    if (producto.llevaSalsas && Array.isArray(producto.salsas) && producto.salsas.length > 0) {
      salsasContainer.style.display = 'block';
      const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
      salsasCheckboxes.innerHTML = producto.salsas.map((nombre) =>
        `<label class="form-check form-check-inline mb-0"><input class="form-check-input" type="checkbox" name="salsaProducto" value="${esc(nombre)}"> <span class="form-check-label">${esc(nombre)}</span></label>`
      ).join('');
    } else {
      salsasContainer.style.display = 'none';
      salsasCheckboxes.innerHTML = '';
    }
  }
  
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
  let detalles = document.getElementById('detallesProducto').value.trim();
  const salsasChecks = document.querySelectorAll('#salsasProductoCheckboxes input[name="salsaProducto"]:checked');
  const salsasSeleccionadas = Array.from(salsasChecks).map(c => c.value);
  if (salsasSeleccionadas.length) {
    detalles = (detalles ? detalles + '; ' : '') + 'Salsas: ' + salsasSeleccionadas.join(', ');
  }

  // ========================================
  // VERIFICACIÓN DE DISPONIBILIDAD EN INVENTARIO
  // ========================================
  try {
    if (typeof verificarDisponibilidadProducto === 'function') {
      const disponibilidad = verificarDisponibilidadProducto(producto.nombre, cantidad);
      
      if (!disponibilidad.disponible) {
        const mensaje = `Producto no disponible: ${disponibilidad.mensaje}`;
        console.warn(mensaje);
        
        // Determinar el tipo de alerta según el stock
        const esStockCero = disponibilidad.stockActual === 0;
        const claseAlerta = esStockCero ? 'alert-danger' : 'alert-warning';
        const tituloAlerta = esStockCero ? '🚫 Producto Sin Stock' : '⚠️ Producto No Disponible';
        
        // Mostrar alerta al usuario
        const alerta = document.createElement('div');
        alerta.className = `alert ${claseAlerta} alert-dismissible fade show position-fixed`;
        alerta.style.cssText = 'top: 20px; right: 20px; z-index: 9999; max-width: 400px;';
        alerta.innerHTML = `
          <strong>${tituloAlerta}</strong>
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
      
      // Mostrar alerta informativa si el stock está en el mínimo (no bloquea la venta)
      if (disponibilidad.stockEnMinimo) {
        const alertaMinimo = document.createElement('div');
        alertaMinimo.className = 'alert alert-warning alert-dismissible fade show position-fixed';
        alertaMinimo.style.cssText = 'top: 20px; right: 20px; z-index: 9999; max-width: 400px;';
        alertaMinimo.innerHTML = `
          <strong>⚠️ Stock en Mínimo</strong>
          <p class="mb-0">${producto.nombre}</p>
          <p class="mb-0 small">Stock actual: ${disponibilidad.stockActual} ${producto.unidadMedida || ''} (Mínimo: ${disponibilidad.stockMinimo})</p>
          <p class="mb-0 small text-danger"><strong>¡Se está agotando! Considera reponer.</strong></p>
          <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
        `;
        
        document.body.appendChild(alertaMinimo);
        
        // Auto-remover después de 7 segundos (un poco más que las otras alertas)
        setTimeout(() => {
          if (alertaMinimo.parentNode) {
            alertaMinimo.remove();
          }
        }, 7000);
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
          
          // Determinar el tipo de alerta según el stock
          const esStockCero = disponibilidad.stockActual === 0;
          const claseAlerta = esStockCero ? 'alert-danger' : 'alert-warning';
          const tituloAlerta = esStockCero ? '🚫 Producto Sin Stock' : '⚠️ Stock Insuficiente';
          
          // Mostrar alerta al usuario
          const alerta = document.createElement('div');
          alerta.className = `alert ${claseAlerta} alert-dismissible fade show position-fixed`;
          alerta.style.cssText = 'top: 20px; right: 20px; z-index: 9999; max-width: 400px;';
          alerta.innerHTML = `
            <strong>${tituloAlerta}</strong>
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
        
        // Mostrar alerta informativa si el stock está en el mínimo (no bloquea la venta)
        if (disponibilidad.stockEnMinimo) {
          const alertaMinimo = document.createElement('div');
          alertaMinimo.className = 'alert alert-warning alert-dismissible fade show position-fixed';
          alertaMinimo.style.cssText = 'top: 20px; right: 20px; z-index: 9999; max-width: 400px;';
          alertaMinimo.innerHTML = `
            <strong>⚠️ Stock en Mínimo</strong>
            <p class="mb-0">${producto.nombre}</p>
            <p class="mb-0 small">Stock actual: ${disponibilidad.stockActual} ${producto.unidadMedida || ''} (Mínimo: ${disponibilidad.stockMinimo})</p>
            <p class="mb-0 small text-danger"><strong>¡Se está agotando! Considera reponer.</strong></p>
            <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
          `;
          
          document.body.appendChild(alertaMinimo);
          
          // Auto-remover después de 7 segundos
          setTimeout(() => {
            if (alertaMinimo.parentNode) {
              alertaMinimo.remove();
            }
          }, 7000);
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

  // Mostrar/ocultar campo de domicilio con animación
  const domicilioContainer = document.getElementById('domicilioContainer');
  const valorDomicilioInput = document.getElementById('valorDomicilio');
  
  if (mesa.startsWith('DOM-')) {
    domicilioContainer.style.display = 'block';
    // Enfocar automáticamente el input de domicilio para mejor UX
    setTimeout(() => {
      valorDomicilioInput.focus();
      valorDomicilioInput.select();
    }, 300);
    
    // Agregar clase especial para destacar
    domicilioContainer.classList.add('domicilio-activo');
    
    console.log('🏍️ Input de domicilio activado para:', mesa);
  } else {
    domicilioContainer.style.display = 'none';
    domicilioContainer.classList.remove('domicilio-activo');
    // Limpiar el valor cuando no es domicilio
    valorDomicilioInput.value = '';
  }
  
  // Agregar event listener para actualizar total automáticamente
  valorDomicilioInput.addEventListener('input', function() {
    if (mesaSeleccionada) {
      actualizarTotal(mesaSeleccionada);
    }
  });

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
  const nombreDomiciliario = mesa.startsWith('DOM-')
    ? (document.getElementById('nombreDomiciliario')?.value || '').trim()
    : '';
  
  pedido.propina = propina;
  pedido.descuento = descuento;
  pedido.valorDomicilio = valorDomicilio;
  pedido.nombreDomiciliario = nombreDomiciliario;
  
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
  console.log('🔍 DEBUG RECIBO VENTA RÁPIDA:');
  console.log('   - Venta recibida:', venta);
  console.log('   - Items:', venta.items);
  console.log('   - Cantidad de items:', venta.items ? venta.items.length : 'undefined');
  
  const ventanaRecibo = window.open('', '_blank', 'width=400,height=600,scrollbars=yes');
  if (!ventanaRecibo) {
    alert('No se pudo abrir la ventana de impresión. Por favor, verifique que los bloqueadores de ventanas emergentes estén desactivados.');
    return;
  }

  // Obtener el logo del negocio si existe
  const logoNegocio = localStorage.getItem('logoNegocio');
  
  // Obtener datos del negocio
  const datosNegocio = JSON.parse(localStorage.getItem('datosNegocio') || '{}');
  
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
          .info-negocio {
            text-align: center;
            margin-bottom: 2mm;
            font-size: 12px;
          }
          .info-negocio strong {
            font-size: 14px;
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

        ${datosNegocio && Object.values(datosNegocio).some(valor => valor) ? `
        <div class="info-negocio border-top">
          ${datosNegocio.nombre ? `<div class="mb-1"><strong>${datosNegocio.nombre}</strong></div>` : ''}
          ${datosNegocio.nit ? `<div class="mb-1">NIT/Cédula: ${datosNegocio.nit}</div>` : ''}
          ${datosNegocio.direccion ? `<div class="mb-1">${datosNegocio.direccion}</div>` : ''}
          ${datosNegocio.telefono ? `<div class="mb-1">Tel: ${datosNegocio.telefono}</div>` : ''}
          ${datosNegocio.correo ? `<div class="mb-1">${datosNegocio.correo}</div>` : ''}
        </div>
        ` : ''}

        <div class="header text-center">
          <div class="mb-1">${new Date(venta.fecha).toLocaleString()}</div>
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
            ${venta.items && venta.items.length > 0 ? venta.items.map(item => `
              <tr>
                <td><strong>${item.nombre || 'Producto'}</strong></td>
                <td>${item.cantidad || 0}</td>
                <td class="text-right">${formatearNumero(item.precio || 0)}</td>
                <td class="text-right">${formatearNumero((item.precio || 0) * (item.cantidad || 0))}</td>
              </tr>
            `).join('') : `
              <tr>
                <td colspan="4" class="text-center">No hay productos en esta venta</td>
              </tr>
            `}
          </tbody>
        </table>
        
        <div class="border-top">
          <div class="mb-1">Subtotal: <span class="text-right">$ ${formatearNumero(venta.subtotal)}</span></div>
          <div class="mb-1">Propina (${venta.propina}%): <span class="text-right">$ ${formatearNumero((venta.subtotal * venta.propina) / 100)}</span></div>
          <div class="mb-1">Descuento: <span class="text-right">$ ${formatearNumero(venta.descuento)}</span></div>
          ${venta.valorDomicilio > 0 ? `<div class="mb-1">Domicilio: <span class="text-right">$ ${formatearNumero(venta.valorDomicilio)}</span></div>${(venta.nombreDomiciliario || '').trim() ? `<div class="mb-1">Domiciliario: ${venta.nombreDomiciliario}</div>` : ''}` : ''}
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
        <div class="d-flex align-items-center mb-2">
          <img src="image/logo-ToySoft.png" alt="ToySoft Logo" class="me-2" style="width: 28px; height: 28px; border-radius: 50%; border: 2px solid rgba(13, 110, 253, 0.4); filter: drop-shadow(0 2px 4px rgba(0,0,0,0.3)); object-fit: cover;">
          <h6 class="mb-0" style="font-family: 'Orbitron', 'Exo 2', 'Rajdhani', 'Roboto Mono', monospace; font-weight: 800; font-size: 1.2rem; color: #0d6efd; letter-spacing: 0.3px; text-shadow: 0 2px 4px rgba(0,0,0,0.1); line-height: 1.1; text-align: center;">
            Toy de<br>Ayudas
          </h6>
        </div>
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
  console.log('🔍 DEBUG AGREGAR PRODUCTO VENTA RÁPIDA:');
  console.log('   - Producto ID:', productoId);
  console.log('   - window.pedidoVentaRapida antes:', window.pedidoVentaRapida);
  
  const producto = productos.find(p => p.id === productoId);
  if (!producto) {
    console.log('   - Producto no encontrado');
    return;
  }
  
  console.log('   - Producto encontrado:', producto);
  
  // ========================================
  // VERIFICACIÓN DE DISPONIBILIDAD EN INVENTARIO
  // ========================================
  try {
    if (typeof verificarDisponibilidadProducto === 'function') {
      // Buscar si ya existe en el pedido para calcular la cantidad total
      const itemExistente = window.pedidoVentaRapida.items.find(item => item.id === productoId);
      const cantidadTotal = itemExistente ? itemExistente.cantidad + 1 : 1;
      
      const disponibilidad = verificarDisponibilidadProducto(producto.nombre, cantidadTotal);
      
      if (!disponibilidad.disponible) {
        const mensaje = `Producto no disponible: ${disponibilidad.mensaje}`;
        console.warn(mensaje);
        
        // Mostrar alerta al usuario
        const alerta = document.createElement('div');
        alerta.className = 'alert alert-danger alert-dismissible fade show position-fixed';
        alerta.style.cssText = 'top: 20px; right: 20px; z-index: 9999; max-width: 400px;';
        alerta.innerHTML = `
          <strong>🚫 Producto Sin Stock</strong>
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
      
      // Mostrar alerta informativa si el stock está en el mínimo (no bloquea la venta)
      if (disponibilidad.stockEnMinimo) {
        const alertaMinimo = document.createElement('div');
        alertaMinimo.className = 'alert alert-warning alert-dismissible fade show position-fixed';
        alertaMinimo.style.cssText = 'top: 20px; right: 20px; z-index: 9999; max-width: 400px;';
        alertaMinimo.innerHTML = `
          <strong>⚠️ Stock en Mínimo</strong>
          <p class="mb-0">${producto.nombre}</p>
          <p class="mb-0 small">Stock actual: ${disponibilidad.stockActual} ${producto.unidadMedida || ''} (Mínimo: ${disponibilidad.stockMinimo})</p>
          <p class="mb-0 small text-danger"><strong>¡Se está agotando! Considera reponer.</strong></p>
          <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
        `;
        
        document.body.appendChild(alertaMinimo);
        
        // Auto-remover después de 7 segundos
        setTimeout(() => {
          if (alertaMinimo.parentNode) {
            alertaMinimo.remove();
          }
        }, 7000);
      }
    }
  } catch (error) {
    console.error('Error al verificar disponibilidad en venta rápida:', error);
    // Continuar con la venta si hay error en la verificación
  }
  
  // Buscar si ya existe en el pedido
  const itemExistente = window.pedidoVentaRapida.items.find(item => item.id === productoId);
  
  if (itemExistente) {
    itemExistente.cantidad += 1;
    console.log('   - Cantidad incrementada para producto existente');
  } else {
    window.pedidoVentaRapida.items.push({
      id: producto.id,
      nombre: producto.nombre,
      precio: producto.precio,
      cantidad: 1,
      estado: 'listo'
    });
    console.log('   - Producto agregado al pedido');
  }
  
  console.log('   - window.pedidoVentaRapida después:', window.pedidoVentaRapida);
  console.log('   - Items después:', window.pedidoVentaRapida.items);
  
  actualizarListaProductosVentaRapida();
  actualizarTotalVentaRapida();
}

// Función para actualizar lista de productos en venta rápida
function actualizarListaProductosVentaRapida() {
  const listaContainer = document.getElementById('listaProductosVentaRapida');
  const contadorContainer = document.getElementById('contadorProductosVentaRapida');
  const items = window.pedidoVentaRapida.items;
  
  // Actualizar contador de productos
  if (contadorContainer) {
    const totalProductos = items.reduce((sum, item) => sum + item.cantidad, 0);
    contadorContainer.textContent = `${totalProductos} productos`;
  }
  
  if (items.length === 0) {
    listaContainer.innerHTML = `
      <div class="text-center text-muted py-4">
        <i class="fas fa-shopping-bag fa-2x mb-2"></i>
        <p class="mb-0">No hay productos agregados</p>
        <small>Selecciona productos de la izquierda</small>
      </div>
    `;
    return;
  }
  
  let html = '';
  items.forEach((item, index) => {
    html += `
      <div class="d-flex justify-content-between align-items-center mb-2 p-2 bg-gradient bg-secondary bg-opacity-10 border border-secondary rounded producto-venta-rapida">
        <div class="flex-grow-1">
          <div class="d-flex justify-content-between align-items-start mb-1">
            <span class="fw-bold text-white nombre-producto">${item.nombre}</span>
            <span class="badge bg-info fs-6">${item.cantidad}</span>
          </div>
          <div class="d-flex justify-content-between align-items-center">
            <small class="text-muted">${formatearPrecio(item.precio)} c/u</small>
            <span class="fw-bold text-warning precio-producto">${formatearPrecio(item.precio * item.cantidad)}</span>
          </div>
        </div>
        <div class="d-flex align-items-center gap-1 ms-2">
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
  const totalElement = document.getElementById('totalVentaRapidaModal');
  
  if (totalElement) {
    totalElement.textContent = formatearPrecio(total);
  }
  
  // Habilitar/deshabilitar botón de procesar
  const btnProcesar = document.getElementById('btnProcesarVentaRapida');
  
  if (btnProcesar) {
    btnProcesar.disabled = total === 0;
    btnProcesar.classList.toggle('btn-success', total > 0);
    btnProcesar.classList.toggle('btn-secondary', total === 0);
  }
}

// Función para procesar venta rápida directa
function procesarVentaRapidaDirecta() {
  console.log('🔍 DEBUG PROCESAR VENTA RÁPIDA DIRECTA:');
  console.log('   - window.pedidoVentaRapida:', window.pedidoVentaRapida);
  console.log('   - Items:', window.pedidoVentaRapida?.items);
  
  if (!window.pedidoVentaRapida || window.pedidoVentaRapida.items.length === 0) {
    alert('No hay productos en la orden');
    return;
  }
  
  const total = window.pedidoVentaRapida.items.reduce((sum, item) => sum + (item.precio * item.cantidad), 0);
  
  console.log('   - Total calculado:', total);
  
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
  const cambioEl = document.getElementById('cambioVentaRapida');
  cambioEl.textContent = 'Cambio: $0';
  cambioEl.classList.remove('text-danger');
  cambioEl.classList.add('text-success');
  cambioEl.style.fontWeight = 'bold';
  cambioEl.style.fontSize = '1.2em';

  // Debug: verificar datos antes de guardar
  console.log('🔍 DEBUG MOSTRAR MODAL VENTA RÁPIDA:');
  console.log('   - Pedido recibido:', pedido);
  console.log('   - Items del pedido:', pedido.items);
  console.log('   - Total:', total);
  
  // Guardar datos para usar en confirmación (hacer copia profunda del pedido)
  window.datosVentaRapida = {
    pedido: {
      items: [...pedido.items], // Copia profunda del array de items
      cliente: pedido.cliente,
      telefono: pedido.telefono,
      direccion: pedido.direccion,
      horaRecoger: pedido.horaRecoger,
      tipo: pedido.tipo
    },
    total: total,
    subtotal: subtotal,
    propina: propina,
    descuento: descuento,
    valorDomicilio: valorDomicilio,
    propinaCalculada: propinaCalculada
  };
  
  console.log('   - Datos guardados en window.datosVentaRapida:', window.datosVentaRapida);
  
  // Mostrar modal
  const modal = new bootstrap.Modal(document.getElementById('modalVentaRapida'));
  modal.show();
}

// Función para calcular cambio en venta rápida
function calcularCambioVentaRapida() {
  const montoRecibido = parseFloat(document.getElementById('montoRecibidoVentaRapida').value) || 0;
  const total = window.datosVentaRapida ? window.datosVentaRapida.total : 0;
  const cambio = montoRecibido - total;
  const el = document.getElementById('cambioVentaRapida');
  
  el.textContent = `Cambio: ${formatearPrecio(Math.max(0, cambio))}`;
  el.style.fontWeight = 'bold';
  el.style.fontSize = '1.2em';

  if (cambio < 0) {
    el.classList.remove('text-success');
    el.classList.add('text-danger');
  } else {
    el.classList.remove('text-danger');
    el.classList.add('text-success');
  }
}

// Función para confirmar venta rápida desde modal
function confirmarVentaRapida() {
  if (!window.datosVentaRapida) {
    alert('Error: No hay datos de venta rápida');
    return;
  }
  
  console.log('🔍 DEBUG CONFIRMAR VENTA RÁPIDA:');
  console.log('   - Datos venta rápida:', window.datosVentaRapida);
  console.log('   - Pedido:', window.datosVentaRapida.pedido);
  console.log('   - Items del pedido:', window.datosVentaRapida.pedido.items);
  
  const metodoPago = document.getElementById('metodoPagoVentaRapida').value;
  const montoRecibido = parseFloat(document.getElementById('montoRecibidoVentaRapida').value) || 0;
  const total = window.datosVentaRapida.total;
  
  // Validar monto recibido si es efectivo
  if (metodoPago === 'efectivo' && montoRecibido < total) {
    alert('El monto recibido debe ser mayor o igual al total');
    return;
  }

  // ========================================
  // VALIDACIÓN FINAL DE STOCK ANTES DE PROCESAR
  // ========================================
  try {
    if (typeof verificarDisponibilidadProducto === 'function') {
      const productosSinStock = [];
      
      for (const item of window.datosVentaRapida.pedido.items) {
        const disponibilidad = verificarDisponibilidadProducto(item.nombre, item.cantidad);
        
        if (!disponibilidad.disponible) {
          productosSinStock.push({
            nombre: item.nombre,
            cantidadSolicitada: item.cantidad,
            stockDisponible: disponibilidad.stockActual,
            mensaje: disponibilidad.mensaje
          });
        }
      }
      
      if (productosSinStock.length > 0) {
        const mensaje = productosSinStock.map(p => 
          `${p.nombre}: solicitado ${p.cantidadSolicitada}, disponible ${p.stockDisponible}`
        ).join('\n');
        
        alert(`⚠️ No se puede procesar la venta. Los siguientes productos no tienen stock suficiente:\n\n${mensaje}\n\nPor favor, ajusta las cantidades o elimina estos productos de la orden.`);
        return; // Bloquear el procesamiento de la venta
      }
    }
  } catch (error) {
    console.error('Error al validar stock antes de procesar venta rápida:', error);
    // Continuar con la venta si hay error en la verificación (por seguridad)
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
  console.log('🔍 DEBUG PROCESAR VENTA RÁPIDA:');
  console.log('   - Pedido recibido:', pedido);
  console.log('   - Items del pedido:', pedido.items);
  console.log('   - Total recibido:', total);
  
  // Crear objeto de venta
  const venta = {
    id: Date.now(),
    mesa: pedido.tipo === 'venta_rapida' ? 'VENTA DIRECTA' : mesaSeleccionada,
    items: pedido.items || [],
    subtotal: (pedido.items || []).reduce((sum, item) => sum + (item.precio * item.cantidad), 0),
    propina: parseFloat(document.getElementById('propina')?.value) || 0,
    descuento: parseFloat(document.getElementById('descuento')?.value) || 0,
    valorDomicilio: parseFloat(document.getElementById('valorDomicilio')?.value) || 0,
    nombreDomiciliario: (document.getElementById('nombreDomiciliario')?.value || '').trim(),
    total: total,
    metodoPago: metodoPago,
    montoRecibido: montoRecibido,
    cambio: Math.max(0, montoRecibido - total),
    fecha: new Date().toISOString(),
    tipo: 'venta_rapida',
    estado: 'completada'
  };
  
  console.log('   - Venta creada:', venta);

  // Guardar en historial
  let historial = JSON.parse(localStorage.getItem('historialVentas') || '[]');
  historial.push(venta);
  localStorage.setItem('historialVentas', JSON.stringify(historial));
  if (venta.nombreDomiciliario) guardarNombreDomiciliario(venta.nombreDomiciliario);

  // Debug: verificar que se guardó correctamente
  console.log('🔍 DEBUG VENTA RÁPIDA:');
  console.log('   - Venta creada:', venta);
  console.log('   - Historial antes:', historial.length - 1, 'ventas');
  console.log('   - Historial después:', historial.length, 'ventas');

  // Actualizar inventario si está disponible
  try {
    if (typeof actualizarInventarioDesdeVenta === 'function') {
      // Preparar los items para la actualización del inventario
      const itemsParaInventario = pedido.items.map(item => ({
        nombre: item.nombre,
        cantidad: item.cantidad,
        ventaId: venta.id,
        mesa: venta.mesa || 'VENTA DIRECTA'
      }));
      
      // Actualizar inventario
      const resultadoInventario = actualizarInventarioDesdeVenta(itemsParaInventario);
      
      if (resultadoInventario && resultadoInventario.success) {
        console.log('Inventario actualizado exitosamente desde venta rápida:', resultadoInventario);
        
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
      } else if (resultadoInventario) {
        console.error('Error al actualizar inventario desde venta rápida:', resultadoInventario.message);
      }
    } else {
      console.log('Función de actualización de inventario no disponible');
    }
  } catch (error) {
    console.error('Error al actualizar inventario desde venta rápida:', error);
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

  // ========================================
  // VALIDACIÓN FINAL DE STOCK ANTES DE PROCESAR
  // ========================================
  try {
    if (typeof verificarDisponibilidadProducto === 'function') {
      const productosSinStock = [];
      
      for (const item of pedido.items) {
        const disponibilidad = verificarDisponibilidadProducto(item.nombre, item.cantidad);
        
        if (!disponibilidad.disponible) {
          productosSinStock.push({
            nombre: item.nombre,
            cantidadSolicitada: item.cantidad,
            stockDisponible: disponibilidad.stockActual,
            mensaje: disponibilidad.mensaje
          });
        }
      }
      
      if (productosSinStock.length > 0) {
        const mensaje = productosSinStock.map(p => 
          `${p.nombre}: solicitado ${p.cantidadSolicitada}, disponible ${p.stockDisponible}`
        ).join('\n');
        
        alert(`⚠️ No se puede procesar la venta. Los siguientes productos no tienen stock suficiente:\n\n${mensaje}\n\nPor favor, ajusta las cantidades o elimina estos productos de la orden.`);
        return; // Bloquear el procesamiento de la venta
      }
    }
  } catch (error) {
    console.error('Error al validar stock antes de procesar venta:', error);
    // Continuar con la venta si hay error en la verificación (por seguridad)
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
    nombreDomiciliario: (mesaSeleccionada.startsWith('DOM-')
      ? (document.getElementById('nombreDomiciliario')?.value || '').trim()
      : ''),
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
  let historialActual = JSON.parse(localStorage.getItem('historialVentas') || '[]');
  if (!Array.isArray(historialActual)) {
    historialActual = [];
  }
  
  // Guardar en historial de ventas (unificado)
  historialActual.push(factura);
  localStorage.setItem('historialVentas', JSON.stringify(historialActual));
  if (factura.nombreDomiciliario) guardarNombreDomiciliario(factura.nombreDomiciliario);

  // Debug: verificar que se guardó correctamente
  console.log('🔍 DEBUG VENTA DE MESA:');
  console.log('   - Factura creada:', factura);
  console.log('   - Historial antes:', historialActual.length - 1, 'ventas');
  console.log('   - Historial después:', historialActual.length, 'ventas');
  
  // También guardar en ventas para compatibilidad (pero sin duplicar)
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
      ${valorDomicilio > 0 ? `<div class="mb-1">Domicilio: <span class="text-right">$ ${formatearNumero(valorDomicilio)}</span></div>${(factura.nombreDomiciliario || '').trim() ? `<div class="mb-1">Domiciliario: ${factura.nombreDomiciliario}</div>` : ''}` : ''}
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

// Función simplificada para mostrar el modal de cierre diario
function mostrarModalCierreDiario() {
    try {
        console.log('=== INICIANDO CIERRE ADMINISTRATIVO ===');
        
        // Obtener todas las ventas del día
        const todasLasVentas = obtenerTodasLasVentas();
        const hoy = getFechaHoyParaCierre();
        const ultimaHoraCierreStr = localStorage.getItem('ultimaHoraCierre');
        const ultimaHoraCierre = ultimaHoraCierreStr ? new Date(ultimaHoraCierreStr) : null;
        
        // Filtrar ventas según último cierre (por turno) o por día si no hay cierre previo
        const ventasHoy = todasLasVentas.filter(v => {
            try {
                const fechaVenta = new Date(v.fecha);
                
                if (ultimaHoraCierre) {
                    const despuesDeCierre = fechaVenta.getTime() >= ultimaHoraCierre.getTime();
                    const mismoDia = esMismaFechaLocal(fechaVenta, hoy);
                    return despuesDeCierre && mismoDia;
                }
                
                // Si no hay marca de cierre, usar todo el día actual
                return esMismaFechaLocal(fechaVenta, hoy);
            } catch (e) {
                return false;
            }
        });
        
        console.log(`📊 Ventas del día: ${ventasHoy.length}`);
        
        // Calcular totales simples
        const totalVentas = ventasHoy.reduce((sum, v) => sum + (parseFloat(v.total) || 0), 0);
        const totalesDomiciliariosAbrir = {};
        const totalDomicilios = ventasHoy.reduce((sum, v) => {
            const valorDom = parseFloat(v.valorDomicilio) || 0;
            if (valorDom > 0) {
                const nombre = (v.nombreDomiciliario || v.domiciliario || 'SIN NOMBRE').toString().trim() || 'SIN NOMBRE';
                totalesDomiciliariosAbrir[nombre] = (totalesDomiciliariosAbrir[nombre] || 0) + valorDom;
            }
            return sum + valorDom;
        }, 0);
        const totalEfectivo = ventasHoy
            .filter(v => v.metodoPago === 'efectivo')
            .reduce((sum, v) => sum + (parseFloat(v.total) || 0), 0);
        const totalTransferencia = ventasHoy
            .filter(v => v.metodoPago === 'transferencia')
            .reduce((sum, v) => sum + (parseFloat(v.total) || 0), 0);
        const totalTarjeta = ventasHoy
            .filter(v => v.metodoPago === 'tarjeta')
            .reduce((sum, v) => sum + (parseFloat(v.total) || 0), 0);
        const totalCredito = ventasHoy
            .filter(v => v.metodoPago === 'credito')
            .reduce((sum, v) => sum + (parseFloat(v.total) || 0), 0);
        const totalMixto = ventasHoy
            .filter(v => v.metodoPago === 'mixto')
            .reduce((sum, v) => sum + (parseFloat(v.total) || 0), 0);
        
        // Obtener gastos del día (también respetando último cierre si existe)
        const gastos = JSON.parse(localStorage.getItem('gastos') || '[]');
        const gastosHoy = gastos.filter(g => {
            try {
                const fechaGasto = new Date(g.fecha);
                
                if (ultimaHoraCierre) {
                    return fechaGasto > ultimaHoraCierre;
                }
                
                return esMismaFechaLocal(fechaGasto, hoy);
            } catch (e) {
                return false;
            }
        });
        const totalGastos = gastosHoy.reduce((sum, g) => sum + (parseFloat(g.monto) || 0), 0);
        
        // Calcular balance final
        const balanceFinal = totalVentas - totalGastos;
        
        // Actualizar valores en el modal
        document.getElementById('totalVentasHoy').textContent = `$ ${totalVentas.toLocaleString()}`;
        if (document.getElementById('totalDomiciliosHoy')) {
            document.getElementById('totalDomiciliosHoy').textContent = `$ ${totalDomicilios.toLocaleString()}`;
        }
        const listaDomAbrir = document.getElementById('listaDomiciliariosCierre');
        if (listaDomAbrir) {
            listaDomAbrir.innerHTML = Object.keys(totalesDomiciliariosAbrir).length === 0 ? '' :
                Object.entries(totalesDomiciliariosAbrir).map(([nombre, monto]) => `${nombre}: $ ${monto.toLocaleString()}`).join('<br>');
        }
        document.getElementById('totalEfectivoHoy').textContent = `$ ${totalEfectivo.toLocaleString()}`;
        document.getElementById('totalTransferenciaHoy').textContent = `$ ${totalTransferencia.toLocaleString()}`;
        if(document.getElementById('totalTarjetaHoy')) document.getElementById('totalTarjetaHoy').textContent = `$ ${totalTarjeta.toLocaleString()}`;
        if(document.getElementById('totalCreditoHoy')) document.getElementById('totalCreditoHoy').textContent = `$ ${totalCredito.toLocaleString()}`;
        if(document.getElementById('totalMixtoHoy')) document.getElementById('totalMixtoHoy').textContent = `$ ${totalMixto.toLocaleString()}`;
        document.getElementById('totalGastosHoy').textContent = `$ ${totalGastos.toLocaleString()}`;
        document.getElementById('balanceFinal').textContent = `$ ${balanceFinal.toLocaleString()}`;
        
        // Limpiar campos del modal
        document.getElementById('nombreCierre').value = '';
        document.getElementById('nombreRecibe').value = '';
        document.getElementById('montoBaseCaja').value = '';
        document.getElementById('detallesCierre').value = '';
        
        // Debug de ventas conflictivas
        debugVentasConflictivas();
        
        // Mostrar el modal
        const modal = new bootstrap.Modal(document.getElementById('modalCierreDiario'));
        modal.show();
        
        console.log('✅ Modal de cierre mostrado correctamente');
        console.log(`💰 Total Ventas: $${totalVentas.toLocaleString()}`);
        console.log(`💵 Efectivo: $${totalEfectivo.toLocaleString()}`);
        console.log(`🏦 Transferencia: $${totalTransferencia.toLocaleString()}`);
        console.log(`💳 Tarjeta: $${totalTarjeta.toLocaleString()}`);
        console.log(`📝 Crédito: $${totalCredito.toLocaleString()}`);
        console.log(`🔄 Mixto: $${totalMixto.toLocaleString()}`);
        console.log(`💸 Gastos: $${totalGastos.toLocaleString()}`);
        console.log(`⚖️ Balance: $${balanceFinal.toLocaleString()}`);
        
    } catch (error) {
        console.error('Error en mostrarModalCierreDiario:', error);
        alert('Error al mostrar el cierre diario: ' + error.message);
    }
}

// ===== NUEVO CIERRE ADMINISTRATIVO MEJORADO =====
function guardarCierreDiario() {
    try {
        console.log('=== GUARDANDO CIERRE ADMINISTRATIVO ===');
        // 1. VALIDAR CAMPOS
        const nombreCierre = document.getElementById('nombreCierre')?.value?.trim() || '';
        const nombreRecibe = document.getElementById('nombreRecibe')?.value?.trim() || '';
        const montoBaseCaja = parseFloat(document.getElementById('montoBaseCaja')?.value) || 0;
        const detalles = document.getElementById('detallesCierre')?.value?.trim() || '';

        if (!nombreCierre) {
            alert('❌ Por favor, ingrese el nombre de quien realiza el cierre');
            return;
        }

        if (!nombreRecibe) {
            alert('❌ Por favor, ingrese el nombre de quien recibe la caja');
            return;
        }

        // 2. OBTENER VENTAS DESDE ÚLTIMO CIERRE (solo lo del turno del trabajador que entrega)
        const todasLasVentas = obtenerTodasLasVentas();
        const hoy = getFechaHoyParaCierre();
        const ultimaHoraCierreStr = localStorage.getItem('ultimaHoraCierre');
        const ultimaHoraCierre = ultimaHoraCierreStr ? new Date(ultimaHoraCierreStr) : null;
        const ventasHoy = todasLasVentas.filter(v => {
            try {
                const fechaVenta = new Date(v.fecha);
                if (ultimaHoraCierre) {
                    const despuesDeCierre = fechaVenta.getTime() >= ultimaHoraCierre.getTime();
                    const mismoDia = esMismaFechaLocal(fechaVenta, hoy);
                    return despuesDeCierre && mismoDia;
                }
                return esMismaFechaLocal(fechaVenta, hoy);
            } catch (e) {
                return false;
            }
        });

        // 3. CALCULAR TOTALES SIMPLES
        const totalVentas = ventasHoy.reduce((sum, v) => sum + (parseFloat(v.total) || 0), 0);
        const totalEfectivo = ventasHoy
            .filter(v => v.metodoPago === 'efectivo')
            .reduce((sum, v) => sum + (parseFloat(v.total) || 0), 0);
        const totalTransferencia = ventasHoy
            .filter(v => v.metodoPago === 'transferencia')
            .reduce((sum, v) => sum + (parseFloat(v.total) || 0), 0);
        const totalTarjeta = ventasHoy
            .filter(v => v.metodoPago === 'tarjeta')
            .reduce((sum, v) => sum + (parseFloat(v.total) || 0), 0);
        const totalCredito = ventasHoy
            .filter(v => v.metodoPago === 'credito')
            .reduce((sum, v) => sum + (parseFloat(v.total) || 0), 0);
        const totalMixto = ventasHoy
            .filter(v => v.metodoPago === 'mixto')
            .reduce((sum, v) => sum + (parseFloat(v.total) || 0), 0);
        
        // 4. OBTENER GASTOS
        const gastos = JSON.parse(localStorage.getItem('gastos') || '[]');
        const gastosHoy = gastos.filter(g => {
            try {
                const fechaGasto = new Date(g.fecha);
                return esMismaFechaLocal(fechaGasto, hoy);
            } catch (e) {
                return false;
            }
        });
        const totalGastos = gastosHoy.reduce((sum, g) => sum + (parseFloat(g.monto) || 0), 0);

        // 5. CALCULAR BALANCE
        const balanceFinal = totalVentas - totalGastos;
        
        // Domicilios y por domiciliario (para impresión)
        const totalesDomiciliariosCierre = {};
        const totalDomiciliosCierre = ventasHoy.reduce((sum, v) => {
            const valorDom = parseFloat(v.valorDomicilio) || 0;
            if (valorDom > 0) {
                const nombre = (v.nombreDomiciliario || v.domiciliario || 'SIN NOMBRE').toString().trim() || 'SIN NOMBRE';
                totalesDomiciliariosCierre[nombre] = (totalesDomiciliariosCierre[nombre] || 0) + valorDom;
            }
            return sum + valorDom;
        }, 0);
        
        // 6. CREAR OBJETO DE CIERRE
        const cierre = {
            id: Date.now(),
            fecha: hoy.toISOString(),
            fechaLocal: hoy.toLocaleDateString('es-ES'),
            hora: hoy.toLocaleTimeString('es-ES'),
            ventas: {
                total: totalVentas,
                efectivo: totalEfectivo,
                transferencia: totalTransferencia,
                tarjeta: totalTarjeta,
                credito: totalCredito,
                mixto: totalMixto
            },
            totalDomicilios: totalDomiciliosCierre,
            totalesDomiciliarios: totalesDomiciliariosCierre,
            gastos: totalGastos,
            balance: balanceFinal,
            nombreCierre: nombreCierre,
            nombreRecibe: nombreRecibe,
            montoBaseCaja: montoBaseCaja,
            detalles: detalles
        };

        // 7. GUARDAR EN LOCALSTORAGE
        const historialCierres = JSON.parse(localStorage.getItem('historialCierres') || '[]');
        historialCierres.push(cierre);
        localStorage.setItem('historialCierres', JSON.stringify(historialCierres));

        // 8. IMPRIMIR
        try {
            imprimirBalanceDiario(cierre);
        } catch (e) {
            console.error('Error al imprimir:', e);
        }

        // 9. REINICIAR SISTEMA
        const reinicioExitoso = reiniciarSistemaCompleto();
        
        if (reinicioExitoso) {
            console.log('✅ Sistema reiniciado correctamente');
            // Forzar contadores DOM/REC a cero y persistir
            try {
                contadorDomicilios = 0;
                contadorRecoger = 0;
                ultimaFechaContadores = new Date().toLocaleDateString();
                if (typeof guardarContadores === 'function') guardarContadores();
            } catch (e) {
                console.error('Error al guardar contadores tras reinicio:', e);
            }
            // Forzar actualización de la interfaz
            setTimeout(() => {
                try {
                    // Recargar datos
                    if (typeof cargarDatos === 'function') {
                        cargarDatos();
                    }
                    // Actualizar vista de mesas
                    if (typeof actualizarVistaMesas === 'function') {
                        actualizarVistaMesas();
                    }
                    // Limpiar interfaz de ventas
                    limpiarInterfazVentas();
                    console.log('✅ Interfaz actualizada después del reinicio');
                    // Verificar estado del sistema
                    debugEstadoSistema();
                } catch (e) {
                    console.error('Error al actualizar interfaz:', e);
                }
            }, 500);
        } else {
            console.error('❌ Error al reiniciar sistema');
        }

        // 10. CERRAR MODAL
            const modal = bootstrap.Modal.getInstance(document.getElementById('modalCierreDiario'));
            if (modal) modal.hide();
        
        // 11. LIMPIAR OVERLAYS
        setTimeout(() => {
            limpiarOverlaysBootstrap();
        }, 100);
        
        // 12. MENSAJE DE ÉXITO
        alert('✅ Cierre diario guardado exitosamente\n\n' +
              `💰 Total Ventas: $${totalVentas.toLocaleString()}\n` +
              `💵 Efectivo: $${totalEfectivo.toLocaleString()}\n` +
              `🏦 Transferencia: $${totalTransferencia.toLocaleString()}\n` +
              `💳 Tarjeta: $${totalTarjeta.toLocaleString()}\n` +
              `📝 Crédito: $${totalCredito.toLocaleString()}\n` +
              `🔄 Mixto: $${totalMixto.toLocaleString()}\n` +
              `💸 Gastos: $${totalGastos.toLocaleString()}\n` +
              `⚖️ Balance Final: $${balanceFinal.toLocaleString()}`);
        
        console.log('=== CIERRE COMPLETADO EXITOSAMENTE ===');

    } catch (error) {
        console.error('ERROR EN CIERRE:', error);
        alert('❌ Error al guardar el cierre: ' + error.message);
    }
}

// ===== FUNCIÓN PARA OBTENER VENTANA DE IMPRESIÓN =====
function obtenerVentanaImpresion() {
    try {
        // Intentar reutilizar ventana existente
        let ventana = window.open('', 'ImpresionBalance', 'width=800,height=600,scrollbars=yes,resizable=yes');
        
        if (!ventana || ventana.closed) {
            // Si no se puede abrir, crear una nueva
            ventana = window.open('', 'ImpresionBalance', 'width=800,height=600,scrollbars=yes,resizable=yes');
        }
        
        if (!ventana) {
            throw new Error('No se pudo abrir la ventana de impresión. Por favor, permite las ventanas emergentes.');
        }
        
        // Configurar la ventana
        ventana.document.title = 'Cierre Diario - ToySoft POS';
        ventana.focus();
        
        return ventana;
    } catch (error) {
        console.error('Error al obtener ventana de impresión:', error);
        throw error;
    }
}

// ===== FUNCIÓN PARA ENVIAR EMAIL DE CIERRE ADMINISTRATIVO =====
function enviarCierreAdministrativoEmail(cierre) {
    try {
        console.log('=== ENVIANDO EMAIL DE CIERRE ADMINISTRATIVO ===');
        
        // Verificar si EmailJS está disponible
        if (typeof emailjs === 'undefined') {
            console.log('EmailJS no está disponible, saltando envío de email');
            return;
        }
        
        // Obtener configuración de email
        const configEmail = JSON.parse(localStorage.getItem('configuracionEmail') || '{}');
        if (!configEmail.serviceId || !configEmail.templateId || !configEmail.publicKey) {
            console.log('Configuración de email incompleta, saltando envío');
            return;
        }
        
        // Configurar EmailJS
        emailjs.init(configEmail.publicKey);
        
        // Preparar datos del email
        const datosEmail = {
            to_email: configEmail.emailDestino || 'admin@toysoft.com',
            subject: `Cierre Administrativo - ${cierre.fechaFormateada}`,
            nombre_negocio: JSON.parse(localStorage.getItem('datosNegocio') || '{}').nombre || 'ToySoft',
            fecha: cierre.fechaFormateada,
            hora: cierre.hora,
            total_ventas: cierre.ventas.total.toLocaleString(),
            efectivo: cierre.ventas.efectivo.toLocaleString(),
            transferencia: cierre.ventas.transferencia.toLocaleString(),
            tarjeta: cierre.ventas.tarjeta.toLocaleString(),
            credito: cierre.ventas.credito.toLocaleString(),
            mixto: cierre.ventas.mixto.toLocaleString(),
            ventas_rapidas: cierre.ventasRapidas.total.toLocaleString(),
            ventas_mesas: cierre.ventasMesas.total.toLocaleString(),
            gastos: cierre.gastos.toLocaleString(),
            balance_final: cierre.balance.toLocaleString(),
            nombre_cierre: cierre.nombreCierre,
            nombre_recibe: cierre.nombreRecibe,
            monto_base_caja: cierre.montoBaseCaja.toLocaleString(),
            detalles: cierre.detalles || 'Sin detalles adicionales'
        };
        
        // Enviar email
        emailjs.send(configEmail.serviceId, configEmail.templateId, datosEmail)
            .then(function(response) {
                console.log('✅ Email enviado exitosamente:', response);
            })
            .catch(function(error) {
                console.error('❌ Error al enviar email:', error);
            });
            
    } catch (error) {
        console.error('Error en enviarCierreAdministrativoEmail:', error);
    }
}

// ===== FUNCIÓN PARA CALCULAR TOTALES DE FORMA PRECISA =====
function calcularTotalesVentas(ventas) {
    console.log('=== CALCULANDO TOTALES DE VENTAS ===');
    
    // Eliminar duplicados por ID
    const ventasUnicas = [];
    const idsVistos = new Set();
    
    ventas.forEach(venta => {
        if (!idsVistos.has(venta.id)) {
            idsVistos.add(venta.id);
            ventasUnicas.push(venta);
        }
    });
    
    console.log(`📊 Ventas procesadas: ${ventasUnicas.length} de ${ventas.length} totales`);
    if (ventas.length !== ventasUnicas.length) {
        console.log(`⚠️ Se eliminaron ${ventas.length - ventasUnicas.length} duplicados`);
    }
    
    // Inicializar contadores
    let totalGeneral = 0;
    let totalEfectivo = 0, totalTransferencia = 0, totalTarjeta = 0, totalCredito = 0, totalMixto = 0;
    let totalVentasRapidas = 0, totalVentasMesas = 0;
    let efectivoRapidas = 0, transferenciaRapidas = 0, tarjetaRapidas = 0, creditoRapidas = 0, mixtoRapidas = 0;
    let efectivoMesas = 0, transferenciaMesas = 0, tarjetaMesas = 0, creditoMesas = 0, mixtoMesas = 0;

    // Procesar cada venta individualmente
    ventasUnicas.forEach((venta) => {
        const total = parseFloat(venta.total) || 0;
        const metodo = (venta.metodoPago || '').toLowerCase().trim();
        // Clasificación robusta: considera venta rápida si el tipo es 'venta_rapida' o si la mesa es 'VENTA DIRECTA'
        const esVentaRapida = (venta.tipo === 'venta_rapida') || (venta.mesa === 'VENTA DIRECTA');
        
        // Sumar al total general
        totalGeneral += total;
        
        // Clasificar por tipo de venta
        if (esVentaRapida) {
            totalVentasRapidas += total;
        } else {
            totalVentasMesas += total;
        }

        // Procesar por método de pago
        switch (metodo) {
            case 'efectivo':
                totalEfectivo += total;
                if (esVentaRapida) {
                    efectivoRapidas += total;
                } else {
                    efectivoMesas += total;
                }
                break;
                
            case 'transferencia':
                totalTransferencia += total;
                if (esVentaRapida) {
                    transferenciaRapidas += total;
                } else {
                    transferenciaMesas += total;
                }
                break;
                
            case 'tarjeta':
                totalTarjeta += total;
                if (esVentaRapida) {
                    tarjetaRapidas += total;
                } else {
                    tarjetaMesas += total;
                }
                break;
                
            case 'crédito':
            case 'credito':
                totalCredito += total;
                if (esVentaRapida) {
                    creditoRapidas += total;
                } else {
                    creditoMesas += total;
                }
                break;
                
            case 'mixto':
                totalMixto += total;
                const efectivoMixto = parseFloat(venta.montoRecibido) || 0;
                const transferenciaMixto = parseFloat(venta.montoTransferencia) || 0;
                totalEfectivo += efectivoMixto;
                totalTransferencia += transferenciaMixto;
                
                if (esVentaRapida) {
                    mixtoRapidas += total;
                    efectivoRapidas += efectivoMixto;
                    transferenciaRapidas += transferenciaMixto;
                } else {
                    mixtoMesas += total;
                    efectivoMesas += efectivoMixto;
                    transferenciaMesas += transferenciaMixto;
                }
                break;
                
            default:
                console.warn(`Método de pago no reconocido: "${metodo}"`);
                break;
        }
    });

    // Verificar coherencia
    const sumaVentasRapidas = efectivoRapidas + transferenciaRapidas + tarjetaRapidas + creditoRapidas + mixtoRapidas;
    const sumaVentasMesas = efectivoMesas + transferenciaMesas + tarjetaMesas + creditoMesas + mixtoMesas;
    const sumaTotal = totalEfectivo + totalTransferencia + totalTarjeta + totalCredito;

    console.log(`📊 Total General: $${totalGeneral.toLocaleString()}`);
    console.log(`⚡ Ventas Rápidas: $${totalVentasRapidas.toLocaleString()}`);
    console.log(`🪑 Ventas Mesas: $${totalVentasMesas.toLocaleString()}`);
    
    // Verificar coherencia de cálculos
    const sumaManualFinal = ventasUnicas.reduce((sum, v) => sum + (parseFloat(v.total) || 0), 0);
    if (sumaManualFinal !== totalGeneral) {
        console.warn('⚠️ Los totales no coinciden! Diferencia:', Math.abs(sumaManualFinal - totalGeneral));
    }

    return {
        totalGeneral,
        totalEfectivo,
        totalTransferencia,
        totalTarjeta,
        totalCredito,
        totalMixto,
        totalVentasRapidas,
        totalVentasMesas,
        efectivoRapidas,
        transferenciaRapidas,
        tarjetaRapidas,
        creditoRapidas,
        mixtoRapidas,
        efectivoMesas,
        transferenciaMesas,
        tarjetaMesas,
        creditoMesas,
        mixtoMesas
    };
}

// ===== FUNCIÓN DE DEBUG PARA VERIFICAR VENTAS =====
function debugVentasCompletas() {
    console.log('=== DEBUG COMPLETO DE VENTAS ===');
    
    const ventas = JSON.parse(localStorage.getItem('ventas') || '[]');
    const historialVentas = JSON.parse(localStorage.getItem('historialVentas') || '[]');
    const todasLasVentas = [...ventas, ...historialVentas];
    
    console.log(`📊 Ventas activas: ${ventas.length}`);
    console.log(`📊 Historial ventas: ${historialVentas.length}`);
    console.log(`📊 Total ventas: ${todasLasVentas.length}`);
}

// ===== FUNCIÓN DE DEBUG ESPECÍFICA PARA CIERRE ADMINISTRATIVO =====
function debugCierreAdministrativo() {
    console.log('=== DEBUG CIERRE ADMINISTRATIVO ===');
    
    // Obtener todas las ventas del día
    const ventas = JSON.parse(localStorage.getItem('ventas') || '[]');
    const historialVentas = JSON.parse(localStorage.getItem('historialVentas') || '[]');
    const todasLasVentas = [...ventas, ...historialVentas];
    const hoy = new Date();
    const hoyStr = hoy.toISOString().slice(0, 10);
    
    const ventasHoy = todasLasVentas.filter(v => {
        try {
            return esMismaFechaLocal(v.fecha, hoy);
        } catch (e) {
            return false;
        }
    });
    
    console.log(`📅 Fecha de hoy (local): ${hoy.toLocaleDateString('es-ES')}`);
    console.log(`📊 Ventas de mesas: ${ventas.length}`);
    console.log(`📊 Ventas rápidas (historial): ${historialVentas.length}`);
    console.log(`📊 Total ventas: ${todasLasVentas.length}`);
    console.log(`📊 Ventas de hoy: ${ventasHoy.length}`);
    
    // Calcular usando la función mejorada
    const calculos = calcularTotalesVentas(ventasHoy);
    
    console.log('\n=== RESULTADOS DEL CÁLCULO ===');
    console.log(`💰 Total General: $${calculos.totalGeneral.toLocaleString()}`);
    console.log(`💵 Efectivo: $${calculos.totalEfectivo.toLocaleString()}`);
    console.log(`🏦 Transferencia: $${calculos.totalTransferencia.toLocaleString()}`);
    console.log(`💳 Tarjeta: $${calculos.totalTarjeta.toLocaleString()}`);
    console.log(`📝 Crédito: $${calculos.totalCredito.toLocaleString()}`);
    console.log(`🔄 Mixto: $${calculos.totalMixto.toLocaleString()}`);
    
    console.log('\n=== VENTAS RÁPIDAS ===');
    console.log(`📊 Total: $${calculos.totalVentasRapidas.toLocaleString()}`);
    console.log(`💵 Efectivo: $${calculos.efectivoRapidas.toLocaleString()}`);
    console.log(`🏦 Transferencia: $${calculos.transferenciaRapidas.toLocaleString()}`);
    console.log(`💳 Tarjeta: $${calculos.tarjetaRapidas.toLocaleString()}`);
    console.log(`📝 Crédito: $${calculos.creditoRapidas.toLocaleString()}`);
    console.log(`🔄 Mixto: $${calculos.mixtoRapidas.toLocaleString()}`);
    
    console.log('\n=== VENTAS MESAS ===');
    console.log(`📊 Total: $${calculos.totalVentasMesas.toLocaleString()}`);
    console.log(`💵 Efectivo: $${calculos.efectivoMesas.toLocaleString()}`);
    console.log(`🏦 Transferencia: $${calculos.transferenciaMesas.toLocaleString()}`);
    console.log(`💳 Tarjeta: $${calculos.tarjetaMesas.toLocaleString()}`);
    console.log(`📝 Crédito: $${calculos.creditoMesas.toLocaleString()}`);
    console.log(`🔄 Mixto: $${calculos.mixtoMesas.toLocaleString()}`);
    
    // Verificar coherencia
    const sumaTotal = calculos.totalEfectivo + calculos.totalTransferencia + calculos.totalTarjeta + calculos.totalCredito;
    console.log('\n=== VERIFICACIÓN ===');
    console.log(`🔍 Total General: $${calculos.totalGeneral.toLocaleString()}`);
    console.log(`🔢 Suma por métodos: $${sumaTotal.toLocaleString()}`);
    console.log(`✅ ¿Coinciden? ${calculos.totalGeneral === sumaTotal ? 'SÍ' : 'NO'}`);
    
    // Verificar total de ventas
    const totalManual = ventasHoy.reduce((sum, v) => sum + (parseFloat(v.total) || 0), 0);
    console.log(`💰 Total ventas del día: $${totalManual.toLocaleString()}`);
    
    return calculos;
}

// ===== FUNCIÓN DE DEBUG DETALLADO PARA VENTAS =====
function debugVentasDetallado() {
    console.log('=== DEBUG DETALLADO DE VENTAS ===');
    
    // Obtener todas las ventas
    const ventas = JSON.parse(localStorage.getItem('ventas') || '[]');
    const historialVentas = JSON.parse(localStorage.getItem('historialVentas') || '[]');
    
    console.log(`📊 Ventas de mesas: ${ventas.length}`);
    console.log(`📊 Ventas rápidas: ${historialVentas.length}`);
    
    // Verificar fechas
    const hoy = getFechaHoyParaCierre();
    console.log(`\n📅 Fecha de hoy (local): ${hoy.toLocaleDateString('es-ES')}`);
    
    // Filtrar ventas de hoy
    const todasLasVentas = [...ventas, ...historialVentas];
    const ventasHoy = todasLasVentas.filter(v => {
        try {
            return esMismaFechaLocal(v.fecha, hoy);
        } catch (e) {
            console.error('Error al procesar fecha:', e, v);
            return false;
        }
    });
    
    console.log(`📊 Ventas de hoy: ${ventasHoy.length}`);
    
    // Calcular totales manualmente
    const totalManual = ventasHoy.reduce((sum, v) => sum + (parseFloat(v.total) || 0), 0);
    console.log(`\n💰 TOTAL MANUAL: $${totalManual.toLocaleString()}`);
    
    return {
        ventas,
        historialVentas,
        ventasHoy,
        totalManual
    };
}

// ===== FUNCIÓN PARA OBTENER VENTAS DEL DÍA =====
function obtenerVentasDelDia() {
    const ventas = JSON.parse(localStorage.getItem('ventas') || '[]');
    
    // Filtrar solo ventas activas de hoy (NO historial)
    const hoy = getFechaHoyParaCierre();
    const hoyStr = hoy.getFullYear() + '-' + String(hoy.getMonth() + 1).padStart(2, '0') + '-' + String(hoy.getDate()).padStart(2, '0');
    
    const ventasHoy = ventas.filter(v => {
        try {
            const fechaVenta = new Date(v.fecha);
            const fechaVentaStr = fechaVenta.toISOString().slice(0, 10);
            return fechaVentaStr === hoyStr;
        } catch (e) {
            return false;
        }
    });
    
    console.log(`📅 Filtro aplicado: Solo ventas activas de hoy`);
    console.log(`📊 Ventas activas de hoy: ${ventasHoy.length}`);
    
    console.log(`📊 Ventas de hoy: ${ventasHoy.length}`);
    
    // Verificar total de ventas
    const totalManual = ventasHoy.reduce((sum, v) => sum + (parseFloat(v.total) || 0), 0);
    console.log(`💰 Total ventas del día: $${totalManual.toLocaleString()}`);
    
    const sumaTotal = ventasHoy.reduce((sum, v) => sum + (parseFloat(v.total) || 0), 0);
    console.log(`\n💰 SUMA TOTAL MANUAL: $${sumaTotal.toLocaleString()}`);
    
    return ventasHoy;
}

// ===== FUNCIÓN PARA REINICIAR SISTEMA =====
function reiniciarSistemaDespuesCierre() {
    console.log('=== REINICIANDO SISTEMA ===');
    
    // Usar la función de reinicio completo
    const reinicioExitoso = reiniciarSistemaCompleto();
    
    if (!reinicioExitoso) {
        console.error('❌ Error al reiniciar sistema');
        return;
    }
    
    // Reiniciar contadores específicos y globales
    localStorage.setItem('ultimaHoraCierre', new Date().toISOString());
    // Reiniciar contadores en memoria
    if (typeof contadorDomicilios !== 'undefined') contadorDomicilios = 0;
    if (typeof contadorRecoger !== 'undefined') contadorRecoger = 0;
    if (typeof ultimaFechaContadores !== 'undefined') ultimaFechaContadores = new Date().toLocaleDateString();
    // Guardar contadores reiniciados en almacenamiento
    try {
        if (typeof guardarContadores === 'function') guardarContadores();
        if (typeof cargarDatos === 'function') cargarDatos();
    } catch (e) {
        console.error('Error al refrescar datos:', e);
    }
    
    console.log('✅ Sistema reiniciado correctamente');
    
    // Recargar la página para reiniciar completamente
    setTimeout(() => {
        location.reload();
    }, 1000);
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

function imprimirBalanceDiario(datosCierre = null) {
    try {
        console.log('Iniciando imprimirBalanceDiario con datos:', datosCierre);
        
        // Obtener la marca de tiempo del último cierre (si existe)
        const ultimaHoraCierreStr = localStorage.getItem('ultimaHoraCierre');
        const ultimaHoraCierre = ultimaHoraCierreStr ? new Date(ultimaHoraCierreStr) : null;
        
        // Obtener todas las ventas (normales + rápidas)
        const todasLasVentas = obtenerTodasLasVentas();
        console.log('Ventas obtenidas:', todasLasVentas.length);
        
        const hoy = getFechaHoyParaCierre();
        const hoyStr = hoy.getFullYear() + '-' + String(hoy.getMonth() + 1).padStart(2, '0') + '-' + String(hoy.getDate()).padStart(2, '0');
        console.log('Fecha de hoy (local):', hoy.toLocaleDateString('es-ES'));
        
        const ventasHoy = todasLasVentas.filter(v => {
            const fechaVenta = new Date(v.fecha);
            if (ultimaHoraCierre) {
                return fechaVenta > ultimaHoraCierre;
            }
            return esMismaFechaLocal(fechaVenta, hoy);
        });
        console.log('Ventas de hoy filtradas:', ventasHoy.length);

        // Usar datos del cierre si están disponibles, sino calcular
        let totalEfectivo, totalTransferencia, totalTarjeta, totalCredito, totalMixto, totalVentas;
        let totalEfectivoRapida, totalTransferenciaRapida, totalTarjetaRapida, totalCreditoRapida, totalMixtoRapida, totalVentasRapidas;
        let totalEfectivoMesa, totalTransferenciaMesa, totalTarjetaMesa, totalCreditoMesa, totalMixtoMesa, totalVentasMesas;
        
        if (datosCierre && datosCierre.ventas) {
            // Usar datos del cierre
            totalVentas = datosCierre.ventas.total || 0;
            totalEfectivo = datosCierre.ventas.efectivo || 0;
            totalTransferencia = datosCierre.ventas.transferencia || 0;
            totalTarjeta = datosCierre.ventas.tarjeta || 0;
            totalCredito = datosCierre.ventas.credito || 0;
            totalMixto = datosCierre.ventas.mixto || 0;
            
            // Datos separados por tipo
            if (datosCierre.ventasRapidas) {
                totalVentasRapidas = datosCierre.ventasRapidas.total || 0;
                totalEfectivoRapida = datosCierre.ventasRapidas.efectivo || 0;
                totalTransferenciaRapida = datosCierre.ventasRapidas.transferencia || 0;
                totalTarjetaRapida = datosCierre.ventasRapidas.tarjeta || 0;
                totalCreditoRapida = datosCierre.ventasRapidas.credito || 0;
                totalMixtoRapida = datosCierre.ventasRapidas.mixto || 0;
            }
            
            if (datosCierre.ventasMesas) {
                totalVentasMesas = datosCierre.ventasMesas.total || 0;
                totalEfectivoMesa = datosCierre.ventasMesas.efectivo || 0;
                totalTransferenciaMesa = datosCierre.ventasMesas.transferencia || 0;
                totalTarjetaMesa = datosCierre.ventasMesas.tarjeta || 0;
                totalCreditoMesa = datosCierre.ventasMesas.credito || 0;
                totalMixtoMesa = datosCierre.ventasMesas.mixto || 0;
            }
        } else {
            // Si no hay datos de cierre, usar la función mejorada de cálculo
            const calculos = calcularTotalesVentas(ventasHoy);
            totalVentas = calculos.totalGeneral;
            totalEfectivo = calculos.totalEfectivo;
            totalTransferencia = calculos.totalTransferencia;
            totalTarjeta = calculos.totalTarjeta;
            totalCredito = calculos.totalCredito;
            totalMixto = calculos.totalMixto;
            totalVentasRapidas = calculos.totalVentasRapidas;
            totalVentasMesas = calculos.totalVentasMesas;
            totalEfectivoRapida = calculos.efectivoRapidas;
            totalTransferenciaRapida = calculos.transferenciaRapidas;
            totalTarjetaRapida = calculos.tarjetaRapidas;
            totalCreditoRapida = calculos.creditoRapidas;
            totalMixtoRapida = calculos.mixtoRapidas;
            totalEfectivoMesa = calculos.efectivoMesas;
            totalTransferenciaMesa = calculos.transferenciaMesas;
            totalTarjetaMesa = calculos.tarjetaMesas;
            totalCreditoMesa = calculos.creditoMesas;
            totalMixtoMesa = calculos.mixtoMesas;
        }

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

        // Calcular total de domicilios del día y por domiciliario
        const totalesDomiciliarios = {};
        const totalDomicilios = ventasHoy.reduce((sum, v) => {
            const valorDom = parseFloat(v.valorDomicilio) || 0;
            if (valorDom > 0) {
                const nombre = (v.nombreDomiciliario || v.domiciliario || 'SIN NOMBRE').toString().trim() || 'SIN NOMBRE';
                if (!totalesDomiciliarios[nombre]) {
                    totalesDomiciliarios[nombre] = 0;
                }
                totalesDomiciliarios[nombre] += valorDom;
            }
            return sum + valorDom;
        }, 0);

        // Calcular balance final
        const balanceFinal = totalVentas - totalGastos;

        // Obtener información del cierre
        let nombreCierre, nombreRecibe, montoBaseCaja, detalles;
        
        if (datosCierre) {
            // Usar datos pasados como parámetro
            nombreCierre = datosCierre.nombreCierre || '';
            nombreRecibe = datosCierre.nombreRecibe || '';
            montoBaseCaja = datosCierre.montoBaseCaja || 0;
            detalles = datosCierre.detalles || '';
        } else {
            // Intentar obtener del DOM (para compatibilidad)
            const nombreCierreEl = document.getElementById('nombreCierre');
            const nombreRecibeEl = document.getElementById('nombreRecibe');
            const montoBaseCajaEl = document.getElementById('montoBaseCaja');
            const detallesEl = document.getElementById('detallesCierre');
            
            nombreCierre = nombreCierreEl ? nombreCierreEl.value.trim() : '';
            nombreRecibe = nombreRecibeEl ? nombreRecibeEl.value.trim() : '';
            montoBaseCaja = montoBaseCajaEl ? parseFloat(montoBaseCajaEl.value) || 0 : 0;
            detalles = detallesEl ? detallesEl.value : '';
        }

        // Obtener información del negocio
        const datosNegocio = JSON.parse(localStorage.getItem('datosNegocio'));

        // Leer últimos consecutivos DOM/REC antes del reinicio
        const ultimoDom = parseInt(localStorage.getItem('contadorDomicilios')) || 0;
        const ultimoRec = parseInt(localStorage.getItem('contadorRecoger')) || 0;

        // Crear ventana de impresión
        let ventana;
        try {
            ventana = obtenerVentanaImpresion();
        } catch (error) {
            alert('Error al abrir ventana de impresión: ' + error.message);
            return;
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
                        <div class="mb-1">Último DOMICILIO: D${ultimoDom}</div>
                        <div class="mb-1">Último RECOGIDA: R${ultimoRec}</div>
                    </div>
                    
                    <div class="border-top">
                        <div class="mb-1"><strong>Resumen de Ventas</strong></div>
                        <div class="mb-1">Total General: $ ${totalVentas.toLocaleString()}</div>
                        <div class="mb-1">- Efectivo: $ ${totalEfectivo.toLocaleString()}</div>
                        <div class="mb-1">- Transferencia: $ ${totalTransferencia.toLocaleString()}</div>
                        <div class="mb-1">- Tarjeta: $ ${totalTarjeta.toLocaleString()}</div>
                        <div class="mb-1">- Crédito: $ ${totalCredito.toLocaleString()}</div>
                        <div class="mb-1">- Mixto: $ ${totalMixto.toLocaleString()}</div>
                        <div class="mb-1">- Domicilios: $ ${totalDomicilios.toLocaleString()}</div>
                        ${Object.keys(totalesDomiciliarios).length > 0 ? `
                        <div class="mb-1"><strong>Domiciliarios:</strong></div>
                        ${Object.entries(totalesDomiciliarios).map(([nombre, monto]) => `
                            <div class="mb-1">- ${nombre}: $ ${monto.toLocaleString()}</div>
                        `).join('')}
                        ` : ''}
                    </div>
                    
                    ${totalVentasRapidas > 0 ? `
                    <div class="border-top">
                        <div class="mb-1"><strong>Ventas Rápidas</strong></div>
                        <div class="mb-1">Total: $ ${totalVentasRapidas.toLocaleString()}</div>
                        <div class="mb-1">- Efectivo: $ ${(totalEfectivoRapida || 0).toLocaleString()}</div>
                        <div class="mb-1">- Transferencia: $ ${(totalTransferenciaRapida || 0).toLocaleString()}</div>
                        <div class="mb-1">- Tarjeta: $ ${(totalTarjetaRapida || 0).toLocaleString()}</div>
                        <div class="mb-1">- Crédito: $ ${(totalCreditoRapida || 0).toLocaleString()}</div>
                        <div class="mb-1">- Mixto: $ ${(totalMixtoRapida || 0).toLocaleString()}</div>
                    </div>
                    ` : ''}
                    
                    ${totalVentasMesas > 0 ? `
                    <div class="border-top">
                        <div class="mb-1"><strong>Ventas de Mesas</strong></div>
                        <div class="mb-1">Total: $ ${totalVentasMesas.toLocaleString()}</div>
                        <div class="mb-1">- Efectivo: $ ${(totalEfectivoMesa || 0).toLocaleString()}</div>
                        <div class="mb-1">- Transferencia: $ ${(totalTransferenciaMesa || 0).toLocaleString()}</div>
                        <div class="mb-1">- Tarjeta: $ ${(totalTarjetaMesa || 0).toLocaleString()}</div>
                        <div class="mb-1">- Crédito: $ ${(totalCreditoMesa || 0).toLocaleString()}</div>
                        <div class="mb-1">- Mixto: $ ${(totalMixtoMesa || 0).toLocaleString()}</div>
                    </div>
                    ` : ''}
                    
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
        console.error('Stack trace:', error.stack);
        alert('Error al generar el balance: ' + error.message);
    }
}

// ===== FUNCIÓN DE IMPRESIÓN MEJORADA =====
function imprimirBalanceDiarioMejorado(cierre) {
    console.log('=== IMPRIMIENDO BALANCE DIARIO MEJORADO ===');
    
    const fecha = new Date(cierre.fecha);
    const fechaFormateada = fecha.toLocaleDateString('es-ES');
    const hora = fecha.toLocaleTimeString('es-ES');
    
    // Extraer datos del cierre
    const { ventas, ventasRapidas, ventasMesas, gastos, balance, nombreCierre, nombreRecibe, montoBaseCaja, detalles, totalDomicilios = 0, totalesDomiciliarios = {} } = cierre;
    
    const contenido = `
    <!DOCTYPE html>
    <html lang="es">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Cierre Diario - ToySoft POS</title>
        <style>
            @page {
                size: A4;
                margin: 1cm;
            }
            
            body {
                font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
                font-size: 12px;
                line-height: 1.4;
                color: #333;
                margin: 0;
                padding: 0;
            }
            
            .header {
                text-align: center;
                border-bottom: 3px solid #2c3e50;
                padding-bottom: 15px;
                margin-bottom: 20px;
            }
            
            .logo {
                font-size: 24px;
                font-weight: bold;
                color: #2c3e50;
                margin-bottom: 5px;
            }
            
            .title {
                font-size: 18px;
                font-weight: bold;
                color: #34495e;
                margin: 10px 0;
            }
            
            .date-time {
                font-size: 14px;
                color: #7f8c8d;
                margin-bottom: 10px;
            }
            
            .section {
                margin-bottom: 20px;
                border: 1px solid #bdc3c7;
                border-radius: 8px;
                overflow: hidden;
            }
            
            .section-header {
                background: linear-gradient(135deg, #3498db, #2980b9);
                color: white;
                padding: 10px 15px;
                font-weight: bold;
                font-size: 14px;
            }
            
            .section-content {
                padding: 15px;
                background: #f8f9fa;
            }
            
            .info-grid {
                display: grid;
                grid-template-columns: 1fr 1fr;
                gap: 15px;
                margin-bottom: 15px;
            }
            
            .info-item {
                display: flex;
                justify-content: space-between;
                padding: 8px 12px;
                background: white;
                border-radius: 5px;
                border-left: 4px solid #3498db;
            }
            
            .info-label {
                font-weight: 600;
                color: #2c3e50;
            }
            
            .info-value {
                font-weight: bold;
                color: #27ae60;
            }
            
            .totals-grid {
                display: grid;
                grid-template-columns: 1fr 1fr;
                gap: 20px;
                margin-top: 15px;
            }
            
            .total-section {
                background: white;
                border-radius: 8px;
                padding: 15px;
                border: 2px solid #e74c3c;
            }
            
            .total-section.rapidas {
                border-color: #f39c12;
            }
            
            .total-section.mesas {
                border-color: #9b59b6;
            }
            
            .total-title {
                font-size: 16px;
                font-weight: bold;
                text-align: center;
                margin-bottom: 10px;
                padding: 8px;
                border-radius: 5px;
            }
            
            .total-title.rapidas {
                background: #f39c12;
                color: white;
            }
            
            .total-title.mesas {
                background: #9b59b6;
                color: white;
            }
            
            .total-item {
                display: flex;
                justify-content: space-between;
                padding: 5px 0;
                border-bottom: 1px solid #ecf0f1;
            }
            
            .total-item:last-child {
                border-bottom: none;
                font-weight: bold;
                font-size: 14px;
                color: #2c3e50;
                margin-top: 5px;
                padding-top: 10px;
                border-top: 2px solid #34495e;
            }
            
            .summary-section {
                background: linear-gradient(135deg, #27ae60, #2ecc71);
                color: white;
                padding: 20px;
                border-radius: 10px;
                text-align: center;
                margin: 20px 0;
            }
            
            .summary-title {
                font-size: 20px;
                font-weight: bold;
                margin-bottom: 15px;
            }
            
            .summary-grid {
                display: grid;
                grid-template-columns: repeat(3, 1fr);
                gap: 20px;
            }
            
            .summary-item {
                background: rgba(255, 255, 255, 0.2);
                padding: 15px;
                border-radius: 8px;
            }
            
            .summary-value {
                font-size: 24px;
                font-weight: bold;
                margin-bottom: 5px;
            }
            
            .summary-label {
                font-size: 12px;
                opacity: 0.9;
            }
            
            .footer {
                margin-top: 30px;
                text-align: center;
                border-top: 2px solid #bdc3c7;
                padding-top: 20px;
            }
            
            .signature-section {
                display: grid;
                grid-template-columns: 1fr 1fr;
                gap: 40px;
                margin-top: 30px;
            }
            
            .signature-box {
                text-align: center;
                border-top: 1px solid #7f8c8d;
                padding-top: 10px;
            }
            
            .signature-label {
                font-weight: bold;
                color: #2c3e50;
                margin-bottom: 40px;
            }
            
            .signature-line {
                border-bottom: 1px solid #7f8c8d;
                height: 40px;
                margin-bottom: 5px;
            }
            
            .no-data {
                text-align: center;
                color: #7f8c8d;
                font-style: italic;
                padding: 20px;
            }
            
            @media print {
                body { margin: 0; }
                .no-print { display: none; }
            }
        </style>
    </head>
    <body>
        <div class="header">
            <div class="logo">🏪 ToySoft POS</div>
            <div class="title">CIERRE DIARIO</div>
            <div class="date-time">📅 ${fechaFormateada} - 🕐 ${hora}</div>
        </div>

        <div class="section">
            <div class="section-header">📋 Información del Cierre</div>
            <div class="section-content">
                <div class="info-grid">
                    <div class="info-item">
                        <span class="info-label">👤 Entrega:</span>
                        <span class="info-value">${nombreCierre}</span>
                    </div>
                    <div class="info-item">
                        <span class="info-label">👤 Recibe:</span>
                        <span class="info-value">${nombreRecibe}</span>
                    </div>
                    <div class="info-item">
                        <span class="info-label">💰 Base Caja:</span>
                        <span class="info-value">$${montoBaseCaja.toLocaleString()}</span>
                    </div>
                    <div class="info-item">
                        <span class="info-label">📝 Detalles:</span>
                        <span class="info-value">${detalles || 'Sin detalles'}</span>
                    </div>
                </div>
            </div>
        </div>

        <div class="section">
            <div class="section-header">📊 Resumen General de Ventas</div>
            <div class="section-content">
                <div class="info-grid">
                    <div class="info-item">
                        <span class="info-label">💰 Total General:</span>
                        <span class="info-value">$${ventas.total.toLocaleString()}</span>
                    </div>
                    <div class="info-item">
                        <span class="info-label">💵 Efectivo:</span>
                        <span class="info-value">$${ventas.efectivo.toLocaleString()}</span>
                    </div>
                    <div class="info-item">
                        <span class="info-label">🏦 Transferencia:</span>
                        <span class="info-value">$${ventas.transferencia.toLocaleString()}</span>
                    </div>
                    <div class="info-item">
                        <span class="info-label">💳 Tarjeta:</span>
                        <span class="info-value">$${ventas.tarjeta.toLocaleString()}</span>
                    </div>
                    <div class="info-item">
                        <span class="info-label">📝 Crédito:</span>
                        <span class="info-value">$${ventas.credito.toLocaleString()}</span>
                    </div>
                    <div class="info-item">
                        <span class="info-label">🔄 Mixto:</span>
                        <span class="info-value">$${ventas.mixto.toLocaleString()}</span>
                    </div>
                    <div class="info-item">
                        <span class="info-label">🚚 Domicilios:</span>
                        <span class="info-value">$${(totalDomicilios || 0).toLocaleString()}</span>
                    </div>
                </div>
            </div>
        </div>
        ${Object.keys(totalesDomiciliarios || {}).length > 0 ? `
        <div class="section">
            <div class="section-header">🚚 Domiciliarios</div>
            <div class="section-content">
                <div class="info-grid">
                    ${Object.entries(totalesDomiciliarios).map(([nombre, monto]) => `
                    <div class="info-item">
                        <span class="info-label">${nombre}:</span>
                        <span class="info-value">$${monto.toLocaleString()}</span>
                    </div>
                    `).join('')}
                </div>
            </div>
        </div>
        ` : ''}

        <div class="totals-grid">
            <div class="total-section rapidas">
                <div class="total-title rapidas">⚡ Ventas Rápidas</div>
                <div class="total-item">
                    <span>💵 Efectivo:</span>
                    <span>$${ventasRapidas.efectivo.toLocaleString()}</span>
                </div>
                <div class="total-item">
                    <span>🏦 Transferencia:</span>
                    <span>$${ventasRapidas.transferencia.toLocaleString()}</span>
                </div>
                <div class="total-item">
                    <span>💳 Tarjeta:</span>
                    <span>$${ventasRapidas.tarjeta.toLocaleString()}</span>
                </div>
                <div class="total-item">
                    <span>📝 Crédito:</span>
                    <span>$${ventasRapidas.credito.toLocaleString()}</span>
                </div>
                <div class="total-item">
                    <span>🔄 Mixto:</span>
                    <span>$${ventasRapidas.mixto.toLocaleString()}</span>
                </div>
                <div class="total-item">
                    <span>📊 TOTAL RÁPIDAS:</span>
                    <span>$${ventasRapidas.total.toLocaleString()}</span>
                </div>
            </div>

            <div class="total-section mesas">
                <div class="total-title mesas">🪑 Ventas de Mesas</div>
                <div class="total-item">
                    <span>💵 Efectivo:</span>
                    <span>$${ventasMesas.efectivo.toLocaleString()}</span>
                </div>
                <div class="total-item">
                    <span>🏦 Transferencia:</span>
                    <span>$${ventasMesas.transferencia.toLocaleString()}</span>
                </div>
                <div class="total-item">
                    <span>💳 Tarjeta:</span>
                    <span>$${ventasMesas.tarjeta.toLocaleString()}</span>
                </div>
                <div class="total-item">
                    <span>📝 Crédito:</span>
                    <span>$${ventasMesas.credito.toLocaleString()}</span>
                </div>
                <div class="total-item">
                    <span>🔄 Mixto:</span>
                    <span>$${ventasMesas.mixto.toLocaleString()}</span>
                </div>
                <div class="total-item">
                    <span>📊 TOTAL MESAS:</span>
                    <span>$${ventasMesas.total.toLocaleString()}</span>
                </div>
            </div>
        </div>

        <div class="section">
            <div class="section-header">💸 Gastos del Día</div>
            <div class="section-content">
                ${gastos > 0 ? `
                    <div class="info-item">
                        <span class="info-label">💰 Total Gastos:</span>
                        <span class="info-value">$${gastos.toLocaleString()}</span>
                    </div>
                ` : `
                    <div class="no-data">No hay gastos registrados</div>
                `}
            </div>
        </div>

        <div class="summary-section">
            <div class="summary-title">🎯 Resumen Final</div>
            <div class="summary-grid">
                <div class="summary-item">
                    <div class="summary-value">$${ventas.total.toLocaleString()}</div>
                    <div class="summary-label">Total Ventas</div>
                </div>
                <div class="summary-item">
                    <div class="summary-value">$${gastos.toLocaleString()}</div>
                    <div class="summary-label">Total Gastos</div>
                </div>
                <div class="summary-item">
                    <div class="summary-value">$${balance.toLocaleString()}</div>
                    <div class="summary-label">Balance Final</div>
                </div>
            </div>
        </div>

        <div class="footer">
            <div class="signature-section">
                <div class="signature-box">
                    <div class="signature-label">Firma de Entrega</div>
                    <div class="signature-line"></div>
                    <div>${nombreCierre}</div>
                </div>
                <div class="signature-box">
                    <div class="signature-label">Firma de Recibe</div>
                    <div class="signature-line"></div>
                    <div>${nombreRecibe}</div>
                </div>
            </div>
            <div style="margin-top: 30px; font-size: 10px; color: #7f8c8d;">
                Generado por ToySoft POS - ${new Date().toLocaleString('es-ES')}
            </div>
        </div>
    </body>
    </html>
    `;

    // Crear ventana de impresión
    const ventanaImpresion = window.open('', '_blank', 'width=800,height=600');
    ventanaImpresion.document.write(contenido);
    ventanaImpresion.document.close();
    
    // Esperar a que se cargue el contenido y luego imprimir
    ventanaImpresion.onload = function() {
        setTimeout(() => {
            ventanaImpresion.print();
            ventanaImpresion.close();
        }, 500);
    };
}

// Función para mostrar historial de ventas
function mostrarHistorialVentas() {
  const tablaHistorial = document.getElementById('tablaHistorialVentas');
  const cuerpoTabla = tablaHistorial.querySelector('tbody');
  cuerpoTabla.innerHTML = '';

  // Obtener la fecha seleccionada del input
  const fechaSeleccionada = document.getElementById('fechaHistorialVentas').value;
  const fechaFiltro = fechaSeleccionada ? new Date(fechaSeleccionada) : new Date();

  // Obtener todas las ventas (normales + rápidas)
  const todasLasVentas = obtenerTodasLasVentas();

  // Filtrar ventas por fecha
  const ventasFiltradas = todasLasVentas.filter(venta => {
    const fechaVenta = new Date(venta.fecha);
    return fechaVenta.toDateString() === fechaFiltro.toDateString();
  });

  ventasFiltradas.forEach(venta => {
    const fila = document.createElement('tr');
    const fechaFormateada = new Date(venta.fecha).toLocaleString();
    fila.innerHTML = `
      <td>${fechaFormateada}</td>
      <td>${venta.tipo || 'Normal'}</td>
      <td>${venta.cliente || venta.mesa || '-'}</td>
      <td>$${venta.total.toFixed(2)}</td>
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
  
  // Inicializar lista de domiciliarios para autocompletado
  if (obtenerNombresDomiciliarios().length === 0) {
    try {
      const historial = JSON.parse(localStorage.getItem('historialVentas') || '[]');
      const unicos = new Set();
      historial.forEach(v => {
        const n = (v.nombreDomiciliario || v.domiciliario || '').trim();
        if (n) unicos.add(n);
      });
      unicos.forEach(n => guardarNombreDomiciliario(n));
    } catch (e) { /* ignorar */ }
  }
  actualizarDatalistDomiciliarios();
  const inputDomiciliario = document.getElementById('nombreDomiciliario');
  if (inputDomiciliario) {
    inputDomiciliario.addEventListener('blur', function() {
      const n = (this.value || '').trim();
      if (n) guardarNombreDomiciliario(n);
    });
  }

  // Inicializar WhatsApp Web
  inicializarWhatsApp();
  
  // Agregar evento para el botón de nueva mesa
  const btnNuevaMesa = document.getElementById('btnNuevaMesa');
  if (btnNuevaMesa) {
    btnNuevaMesa.addEventListener('click', crearNuevaMesa);
  }
  
  // Agregar evento para la tecla Enter en el input de número de mesa
  const nuevaMesa = document.getElementById('nuevaMesa');
  if (nuevaMesa) {
    nuevaMesa.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        crearNuevaMesa();
      }
    });
  }
  
  // Actualizar total cuando cambian propina o descuento
  const propina = document.getElementById('propina');
  if (propina) {
    propina.addEventListener('input', () => {
      if (mesaSeleccionada) {
        actualizarTotal(mesaSeleccionada);
      }
    });
  }
  
  const descuento = document.getElementById('descuento');
  if (descuento) {
    descuento.addEventListener('input', () => {
      if (mesaSeleccionada) {
        actualizarTotal(mesaSeleccionada);
      }
    });
  }
  
  const valorDomicilio = document.getElementById('valorDomicilio');
  if (valorDomicilio) {
    valorDomicilio.addEventListener('input', () => {
      if (mesaSeleccionada) {
        actualizarTotal(mesaSeleccionada);
      }
    });
  }
});


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
      ${valorDomicilio > 0 ? `<div class="mb-1"><strong>Domicilio:</strong> <span style="float:right;">${formatearNumero(valorDomicilio)}</span></div>${(pedido.nombreDomiciliario || '').trim() ? `<div class="mb-1"><strong>Domiciliario:</strong> ${pedido.nombreDomiciliario}</div>` : ''}` : ''}
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
      ${valorDomicilio > 0 ? `<div class="mb-1">Domicilio: <span class="text-right">$ ${formatearNumero(valorDomicilio)}</span></div>${(pedido.nombreDomiciliario || '').trim() ? `<div class="mb-1">Domiciliario: ${pedido.nombreDomiciliario}</div>` : ''}` : ''}
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
        // Obtener todas las ventas (normales + rápidas)
        const todasLasVentas = obtenerTodasLasVentas();
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
        const ventasFiltradas = todasLasVentas.filter(v => {
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
    const fechaBalanceEl = document.getElementById('fechaBalance');
    if (fechaBalanceEl) {
      const hoy = new Date();
      const y = hoy.getFullYear();
      const m = String(hoy.getMonth() + 1).padStart(2, '0');
      const d = String(hoy.getDate()).padStart(2, '0');
      fechaBalanceEl.value = `${y}-${m}-${d}`;
    }
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
    const fechaInput = document.getElementById('fechaBalance').value;
    
    // Validar que haya una fecha seleccionada
    if (!fechaInput) {
      console.warn('No se ha seleccionado una fecha');
      return;
    }
    
    // Parsear la fecha correctamente (el input date devuelve YYYY-MM-DD)
    // Crear la fecha en hora local para evitar problemas de zona horaria
    const [anio, mes, dia] = fechaInput.split('-').map(Number);
    const fechaSeleccionada = new Date(anio, mes - 1, dia, 12, 0, 0, 0);
    
    if (isNaN(fechaSeleccionada.getTime())) {
      console.error('Fecha inválida:', fechaInput);
      return;
    }
    
    const ventas = JSON.parse(localStorage.getItem('historialVentas')) || [];
    // Leer gastos de ambas fuentes y combinarlos (evitar duplicados)
    const historialGastos = JSON.parse(localStorage.getItem('historialGastos')) || [];
    const gastosDirectos = JSON.parse(localStorage.getItem('gastos')) || [];
    
    // Combinar ambos arrays, evitando duplicados por ID
    const todosLosGastos = [...historialGastos];
    gastosDirectos.forEach(g => {
      if (!todosLosGastos.find(existing => existing.id === g.id)) {
        todosLosGastos.push(g);
      }
    });
    
    const gastos = todosLosGastos;
    console.log('[BALANCE] Gastos de historialGastos:', historialGastos.length);
    console.log('[BALANCE] Gastos de gastos:', gastosDirectos.length);
    console.log('[BALANCE] Total gastos combinados:', gastos.length);
    console.log('[BALANCE] Primeros 3 gastos:', gastos.slice(0, 3).map(g => ({ id: g.id, fecha: g.fecha, descripcion: g.descripcion, monto: g.monto })));
    let ventasFiltradas = [];
    let gastosFiltrados = [];
    let inicioPeriodoStr = '', finPeriodoStr = '';
    switch (tipoBalance) {
      case 'diario': {
        // Balance diario: filtrar por el día específico seleccionado
        // Usar esMismaFechaLocal para comparar solo año, mes y día (evita problemas de zona horaria)
        // fechaSeleccionada ya está creada con hora 12:00 para evitar problemas de zona horaria
        ventasFiltradas = ventas.filter(v => {
          try {
            return esMismaFechaLocal(v.fecha, fechaSeleccionada);
          } catch (e) {
            return false;
          }
        });
        inicioPeriodoStr = soloFechaISO(fechaSeleccionada);
        finPeriodoStr = soloFechaISO(fechaSeleccionada);
        gastosFiltrados = gastos.filter(g => {
          try {
            return esMismaFechaLocal(g.fecha, fechaSeleccionada);
          } catch (e) {
            return false;
          }
        });
        break;
      }
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
    // Recalcular gastos usando objetos Date para mayor precisión (solo para casos no diarios)
    // El caso diario ya usa esMismaFechaLocal que es más preciso
    if (tipoBalance !== 'diario' && inicioPeriodoStr && finPeriodoStr) {
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
    console.log('Total ventas en historial:', ventas.length);
    console.log('Ventas filtradas:', ventasFiltradas.length);
    if (tipoBalance === 'diario') {
      console.log('Fecha seleccionada:', fechaSeleccionada);
      console.log('Primeras 3 ventas del historial:', ventas.slice(0, 3).map(v => ({ fecha: v.fecha, total: v.total })));
      console.log('Ventas filtradas (primeras 3):', ventasFiltradas.slice(0, 3).map(v => ({ fecha: v.fecha, total: v.total })));
    }
    console.log('Gastos originales:', gastos.length);
    console.log('Gastos filtrados:', gastosFiltrados.length);
    if (tipoBalance === 'diario') {
      console.log('Fecha seleccionada para gastos:', fechaSeleccionada);
      console.log('Primeros 3 gastos del historial:', gastos.slice(0, 3).map(g => ({ fecha: g.fecha, descripcion: g.descripcion, monto: g.monto })));
      console.log('Gastos filtrados (primeros 3):', gastosFiltrados.slice(0, 3).map(g => ({ fecha: g.fecha, descripcion: g.descripcion, monto: g.monto })));
    }
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

// Domicilios y domiciliarios
const totalesDomiciliariosBalance = {};
const totalDomiciliosBalance = ventasFiltradas.reduce((sum, v) => {
  const valorDom = parseFloat(v.valorDomicilio) || 0;
  if (valorDom > 0) {
    const nombre = (v.nombreDomiciliario || v.domiciliario || 'SIN NOMBRE').toString().trim() || 'SIN NOMBRE';
    totalesDomiciliariosBalance[nombre] = (totalesDomiciliariosBalance[nombre] || 0) + valorDom;
  }
  return sum + valorDom;
}, 0);
const resumenDomiciliarios = document.getElementById('resumenDomiciliarios');
if (resumenDomiciliarios) {
  resumenDomiciliarios.innerHTML = '';
  Object.entries(totalesDomiciliariosBalance).forEach(([nombre, monto]) => {
    const fila = document.createElement('tr');
    fila.innerHTML = `
      <td>${nombre}</td>
      <td style="text-align:right;">$${monto.toLocaleString()}</td>
    `;
    resumenDomiciliarios.appendChild(fila);
  });
}
const elTotalDom = document.getElementById('totalDomiciliosBalance');
if (elTotalDom) elTotalDom.textContent = `$ ${totalDomiciliosBalance.toLocaleString()}`;

// Actualizar tabla de gastos
const resumenGastos = document.getElementById('resumenGastos');
resumenGastos.innerHTML = '';

gastosFiltrados.forEach(gasto => {
  const fila = document.createElement('tr');
  const descripcion = gasto.descripcion || 'Sin descripción';
  const categoria = gasto.categoria ? ` (${gasto.categoria})` : '';
  fila.innerHTML = `
    <td>${descripcion}${categoria}</td>
    <td style="text-align:right;">$${(parseFloat(gasto.monto) || 0).toLocaleString()}</td>
  `;
  resumenGastos.appendChild(fila);
});

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

    // Ventas por producto (mismo periodo, no modifica el balance)
    const cuerpoVentasPorProducto = document.getElementById('cuerpoVentasPorProducto');
    if (cuerpoVentasPorProducto) {
      const porProducto = {};
      ventasFiltradas.forEach(venta => {
        (venta.items || []).forEach(item => {
          const clave = item.id != null ? String(item.id) : (item.nombre || 'sin nombre');
          porProducto[clave] = (porProducto[clave] || 0) + (item.cantidad || 0);
        });
      });
      const productos = JSON.parse(localStorage.getItem('productos') || '[]');
      const idANombre = {};
      productos.forEach(p => { idANombre[String(p.id)] = p.nombre || ''; });
      cuerpoVentasPorProducto.innerHTML = '';
      const entradas = Object.entries(porProducto).sort((a, b) => b[1] - a[1]);
      entradas.forEach(([clave, cantidad]) => {
        const nombre = idANombre[clave] || (isNaN(Number(clave)) ? clave : '');
        const fila = document.createElement('tr');
        fila.innerHTML = `
          <td>${nombre || clave}</td>
          <td class="text-end">${cantidad.toLocaleString()}</td>
        `;
        cuerpoVentasPorProducto.appendChild(fila);
      });
      if (entradas.length === 0) {
        const fila = document.createElement('tr');
        fila.innerHTML = '<td colspan="2" class="text-muted text-center">No hay ventas por producto en este periodo</td>';
        cuerpoVentasPorProducto.appendChild(fila);
      }
    }

    // Calcular utilidad por período
    calcularUtilidadPorPeriodo(ventasFiltradas);

  } catch (error) {
    console.error('Error al generar balance:', error);
    alert('Error al generar el balance');
  }
}

// Función para calcular utilidad por período
function calcularUtilidadPorPeriodo(ventasFiltradas) {
  try {
    const productos = JSON.parse(localStorage.getItem('productos') || '[]');
    
    // Crear mapa de productos por id y nombre para búsqueda rápida
    const productosMap = {};
    productos.forEach(p => {
      productosMap[String(p.id)] = p;
      productosMap[p.nombre.toLowerCase().trim()] = p;
    });

    // Calcular utilidad por producto
    const utilidadPorProducto = {};
    let totalUtilidad = 0;

    ventasFiltradas.forEach(venta => {
      const items = venta.items || venta.productos || [];
      items.forEach(item => {
        const productoId = item.id != null ? String(item.id) : null;
        const productoNombre = (item.nombre || '').toLowerCase().trim();
        const cantidad = item.cantidad || 0;
        const precioVenta = parseFloat(item.precio) || 0;

        // Buscar producto por id o nombre
        let producto = null;
        if (productoId && productosMap[productoId]) {
          producto = productosMap[productoId];
        } else if (productoNombre && productosMap[productoNombre]) {
          producto = productosMap[productoNombre];
        }

        // Solo calcular si el producto tiene costo definido
        if (producto && producto.costo != null && producto.costo !== undefined) {
          const costo = parseFloat(producto.costo) || 0;
          const utilidadUnitaria = precioVenta - costo;
          const utilidadTotal = utilidadUnitaria * cantidad;

          const clave = productoId || productoNombre;
          if (!utilidadPorProducto[clave]) {
            utilidadPorProducto[clave] = {
              nombre: producto.nombre,
              cantidadVendida: 0,
              precioVenta: precioVenta,
              costo: costo,
              utilidadUnitaria: utilidadUnitaria,
              utilidadTotal: 0
            };
          }

          utilidadPorProducto[clave].cantidadVendida += cantidad;
          utilidadPorProducto[clave].utilidadTotal += utilidadTotal;
          totalUtilidad += utilidadTotal;
        }
      });
    });

    // Mostrar utilidad en el balance
    mostrarUtilidadEnBalance(utilidadPorProducto, totalUtilidad);

  } catch (error) {
    console.error('Error al calcular utilidad:', error);
  }
}

// Función para mostrar utilidad en el balance
function mostrarUtilidadEnBalance(utilidadPorProducto, totalUtilidad) {
  const cuerpoUtilidadFinal = document.getElementById('cuerpoUtilidad');
  const totalUtilidadElement = document.getElementById('totalUtilidad');
  
  if (cuerpoUtilidadFinal) {
    cuerpoUtilidadFinal.innerHTML = '';
    
    const productosConUtilidad = Object.values(utilidadPorProducto).sort((a, b) => b.utilidadTotal - a.utilidadTotal);
    
    if (productosConUtilidad.length === 0) {
      const fila = document.createElement('tr');
      fila.innerHTML = '<td colspan="6" class="text-muted text-center">No hay productos con costo definido en este período</td>';
      cuerpoUtilidadFinal.appendChild(fila);
    } else {
      productosConUtilidad.forEach(producto => {
        const fila = document.createElement('tr');
        fila.innerHTML = `
          <td>${producto.nombre}</td>
          <td class="text-end">${producto.cantidadVendida.toLocaleString()}</td>
          <td class="text-end">$ ${producto.precioVenta.toLocaleString()}</td>
          <td class="text-end">$ ${producto.costo.toLocaleString()}</td>
          <td class="text-end text-success">$ ${producto.utilidadUnitaria.toLocaleString()}</td>
          <td class="text-end text-success"><strong>$ ${producto.utilidadTotal.toLocaleString()}</strong></td>
        `;
        cuerpoUtilidadFinal.appendChild(fila);
      });
    }
  }

  if (totalUtilidadElement) {
    totalUtilidadElement.textContent = `$ ${totalUtilidad.toLocaleString()}`;
  }
  
  // Guardar datos de utilidad para impresión y exportación
  window.utilidadActual = {
    productos: utilidadPorProducto,
    total: totalUtilidad,
    tipoPeriodo: document.getElementById('tipoBalance')?.value || 'diario',
    fecha: document.getElementById('fechaBalance')?.value || new Date().toISOString().split('T')[0]
  };
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
    const resumenDomiciliarios = document.getElementById('resumenDomiciliarios');
    const totalDomiciliosBalance = document.getElementById('totalDomiciliosBalance');
    const resumenDomiciliariosHTML = resumenDomiciliarios ? resumenDomiciliarios.innerHTML : '';
    const totalDomiciliosTexto = totalDomiciliosBalance ? totalDomiciliosBalance.textContent : '$ 0';
    const resumenGastos = document.getElementById('resumenGastos').innerHTML;
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
      case 'diario':
        tituloPeriodo = `Día ${fechaSeleccionada.toLocaleDateString('es-ES', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}`;
        break;
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
              <div class="mb-1"><strong>Domicilios y Domiciliarios</strong></div>
              <table>
                ${resumenDomiciliariosHTML}
                <tfoot>
                  <tr>
                    <th>Total Domicilios</th>
                    <th style="text-align:right;">${totalDomiciliosTexto}</th>
                  </tr>
                </tfoot>
              </table>
            </div>

            <div class="border-top">
              <div class="mb-1"><strong>Resumen de Gastos</strong></div>
              <table>
                ${resumenGastos}
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

// Función para verificar el PIN y determinar el rol
function verificarPinAcceso() {
  const pinIngresado = document.getElementById('pinAcceso').value;
  const mensajeError = document.getElementById('mensajeErrorPin');
  
  // Determinar el tipo de usuario basado en el PIN
  if (pinIngresado === PIN_ADMIN) {
    usuarioActual = 'admin';
    window.usuarioActual = 'admin'; // Actualizar variable global
    console.log('🔐 Acceso de Administrador autorizado');
  } else if (pinIngresado === PIN_EMPLEADO) {
    usuarioActual = 'empleado';
    window.usuarioActual = 'empleado'; // Actualizar variable global
    console.log('🔐 Acceso de Empleado autorizado');
  } else {
    mensajeError.style.display = 'block';
    document.getElementById('pinAcceso').value = '';
    return;
  }
  
  // Cerrar modal de PIN
  const modal = bootstrap.Modal.getInstance(document.getElementById('modalPinAcceso'));
  modal.hide();
  
  // Verificar permisos según el rol
  if (accionPendiente === 'balance') {
    if (usuarioActual === 'admin') {
      console.log('🔐 Acceso autorizado al Balance');
      mostrarModalBalance();
    } else {
      alert('❌ Solo los administradores pueden acceder al Balance');
    }
  } else if (accionPendiente === 'inventario') {
    console.log('🔐 Acceso autorizado al Inventario');
    window.location.href = 'inventario.html';
  } else if (accionPendiente === 'cierre-administrativo') {
    if (usuarioActual === 'admin') {
      console.log('🔐 Acceso autorizado al Cierre Administrativo');
      mostrarModalCierreDiario();
    } else {
      alert('❌ Solo los administradores pueden realizar cierres administrativos');
    }
  } else if (accionPendiente === 'historial') {
    console.log('🔐 Acceso autorizado al Historial');
    // Guardar el rol en localStorage para que esté disponible en historial.html
    localStorage.setItem('usuarioActual', usuarioActual);
    window.location.href = 'historial.html';
  } else if (accionPendiente === 'historial-admin') {
    if (usuarioActual === 'admin') {
      console.log('🔐 Acceso autorizado al Historial Administrativo');
      // Cambiar a la pestaña de cierres administrativos
      const tabCierresAdmin = document.getElementById('cierres-admin-tab');
      if (tabCierresAdmin) {
        const tab = new bootstrap.Tab(tabCierresAdmin);
        tab.show();
      }
    } else {
      alert('❌ Solo los administradores pueden ver los cierres administrativos');
    }
  }
  
  // Limpiar acción pendiente
  accionPendiente = null;
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

// Funciones del sistema
window.reiniciarSistema = reiniciarSistema;

// Función para limpiar completamente el localStorage (útil para desarrollo y pruebas)
function limpiarLocalStorageCompleto() {
  try {
    // Lista de todas las claves que se usan en la aplicación
    const clavesALimpiar = [
      'productos',
      'categorias',
      'mesasActivas',
      'ordenesCocina',
      'clientes',
      'historialVentas',
      'historialCocina',
      'cotizaciones',
      'recordatorios',
      'recordatoriosActivos',
      'notificacionesActivas',
      'contadorDomicilios',
      'contadorRecoger',
      'ultimaFechaContadores',
      'historialGastos',
      'gastos',
      'historialCierres',
      'cierres',
      'historialCierresOperativos',
      'datosNegocio',
      'logoNegocio',
      'configuracionCierre',
      'ultimaHoraCierre'
    ];
    
    // Limpiar cada clave
    clavesALimpiar.forEach(clave => {
      localStorage.removeItem(clave);
      console.log(`🗑️ Clave "${clave}" eliminada del localStorage`);
    });
    
    // Limpiar variables globales
    productos = [];
    categorias = [];
    mesasActivas = new Map();
    mesaSeleccionada = null;
    ordenesCocina = new Map();
    clientes = [];
    historialVentas = [];
    historialCocina = [];
    cotizaciones = [];
    recordatorios = [];
    recordatoriosActivos = [];
    notificacionesActivas = [];
    contadorDomicilios = 0;
    contadorRecoger = 0;
    
    console.log('✅ localStorage completamente limpiado');
    alert('LocalStorage limpiado completamente. La página se recargará.');
    
    // Recargar la página para aplicar los cambios
    setTimeout(() => {
      window.location.reload();
    }, 1000);
    
  } catch (error) {
    console.error('❌ Error al limpiar localStorage:', error);
    alert('Error al limpiar el localStorage: ' + error.message);
  }
}

// Función para limpiar solo productos y categorías
function limpiarProductosYCategorias() {
  try {
    // Limpiar solo productos y categorías
    localStorage.removeItem('productos');
    localStorage.removeItem('categorias');
    
    // Limpiar variables globales
    productos = [];
    categorias = [];
    
    console.log('✅ Productos y categorías limpiados');
    alert('Productos y categorías eliminados. La página se recargará.');
    
    // Recargar la página para aplicar los cambios
    setTimeout(() => {
      window.location.reload();
    }, 1000);
    
  } catch (error) {
    console.error('❌ Error al limpiar productos y categorías:', error);
    alert('Error al limpiar productos y categorías: ' + error.message);
  }
}

// Exportar funciones de limpieza
window.limpiarLocalStorageCompleto = limpiarLocalStorageCompleto;
window.limpiarProductosYCategorias = limpiarProductosYCategorias;

// ========================================
// SISTEMA DE AYUDA CON LOGO TOYSOFT
// ========================================

/**
 * Muestra ayuda específica con logo de ToySoft
 * @param {string} tipo - Tipo de ayuda a mostrar
 */
function mostrarAyudaEspecifica(tipo) {
  console.log('❓ Mostrando ayuda específica:', tipo);
  
  // Crear modal de ayuda si no existe
  let modalAyuda = document.getElementById('modalAyudaRobot');
  if (!modalAyuda) {
    modalAyuda = crearModalAyuda();
  }
  
  // Obtener contenido de ayuda según el tipo
  const contenidoAyuda = obtenerContenidoAyuda(tipo);
  
  // Actualizar contenido del modal
  const modalBody = modalAyuda.querySelector('.modal-body');
  modalBody.innerHTML = contenidoAyuda;
  
  // Mostrar modal
  const modal = new bootstrap.Modal(modalAyuda);
  modal.show();
}

/**
 * Crea el modal de ayuda con el logo de ToySoft
 */
function crearModalAyuda() {
  const modalHTML = `
    <div class="modal fade" id="modalAyudaRobot" tabindex="-1" aria-labelledby="modalAyudaRobotLabel" aria-hidden="true">
      <div class="modal-dialog modal-lg">
        <div class="modal-content">
          <div class="modal-header bg-primary text-white">
            <div class="d-flex align-items-center">
              <img src="image/logo-ToySoft.png" alt="ToySoft Logo" class="me-3" style="width: 40px; height: 40px;">
              <h5 class="modal-title" id="modalAyudaRobotLabel">
                <i class="fas fa-question-circle me-2"></i>Centro de Ayuda
              </h5>
            </div>
            <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal" aria-label="Close"></button>
          </div>
          <div class="modal-body">
            <!-- Contenido dinámico se inserta aquí -->
          </div>
          <div class="modal-footer">
            <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">
              <i class="fas fa-times me-2"></i>Cerrar
            </button>
          </div>
        </div>
      </div>
    </div>
  `;
  
  // Insertar modal en el body
  document.body.insertAdjacentHTML('beforeend', modalHTML);
  
  return document.getElementById('modalAyudaRobot');
}

/**
 * Obtiene el contenido de ayuda según el tipo
 * @param {string} tipo - Tipo de ayuda
 * @returns {string} HTML del contenido
 */
function obtenerContenidoAyuda(tipo) {
  const ayudas = {
    'cierre-caja-general': `
      <div class="text-center mb-4">
        <img src="image/logo-ToySoft.png" alt="ToySoft Logo" class="mb-3" style="width: 80px; height: 80px;">
        <h6 class="text-primary">💰 Cierre de Caja General</h6>
      </div>
      <div class="row">
        <div class="col-md-6">
          <h6><i class="fas fa-calculator text-success me-2"></i>¿Qué hace?</h6>
          <ul class="list-unstyled">
            <li>• Calcula totales de ventas del día</li>
            <li>• Suma ventas por método de pago</li>
            <li>• Genera reporte de cierre</li>
            <li>• Reinicia el sistema para el siguiente turno</li>
          </ul>
        </div>
        <div class="col-md-6">
          <h6><i class="fas fa-lightbulb text-warning me-2"></i>Consejos</h6>
          <ul class="list-unstyled">
            <li>• Verifica que todas las ventas estén registradas</li>
            <li>• Confirma los totales antes de guardar</li>
            <li>• Imprime el comprobante para archivo</li>
            <li>• El sistema se reinicia automáticamente</li>
          </ul>
        </div>
      </div>
    `,
    
    'cierre-operativo': `
      <div class="text-center mb-4">
        <img src="image/logo-ToySoft.png" alt="ToySoft Logo" class="mb-3" style="width: 80px; height: 80px;">
        <h6 class="text-primary">⚙️ Cierre Operativo</h6>
      </div>
      <div class="row">
        <div class="col-md-6">
          <h6><i class="fas fa-cogs text-info me-2"></i>Funciones</h6>
          <ul class="list-unstyled">
            <li>• Cierra órdenes pendientes</li>
            <li>• Finaliza mesas activas</li>
            <li>• Limpia órdenes de cocina</li>
            <li>• Prepara sistema para cierre</li>
          </ul>
        </div>
        <div class="col-md-6">
          <h6><i class="fas fa-exclamation-triangle text-danger me-2"></i>Importante</h6>
          <ul class="list-unstyled">
            <li>• Solo usar al final del día</li>
            <li>• Verificar que no hay órdenes pendientes</li>
            <li>• Confirmar con el personal de cocina</li>
            <li>• Hacer backup antes de proceder</li>
          </ul>
        </div>
      </div>
    `,
    
    'cotizaciones': `
      <div class="text-center mb-4">
        <img src="image/logo-ToySoft.png" alt="ToySoft Logo" class="mb-3" style="width: 80px; height: 80px;">
        <h6 class="text-primary">📋 Sistema de Cotizaciones</h6>
      </div>
      <div class="row">
        <div class="col-md-6">
          <h6><i class="fas fa-file-invoice text-primary me-2"></i>Crear Cotización</h6>
          <ul class="list-unstyled">
            <li>• Agrega productos al carrito</li>
            <li>• Configura precios y descuentos</li>
            <li>• Ingresa datos del cliente</li>
            <li>• Genera PDF para envío</li>
          </ul>
        </div>
        <div class="col-md-6">
          <h6><i class="fas fa-search text-success me-2"></i>Buscar Cotización</h6>
          <ul class="list-unstyled">
            <li>• Busca por número de cotización</li>
            <li>• Filtra por fecha o cliente</li>
            <li>• Visualiza detalles completos</li>
            <li>• Reimprime si es necesario</li>
          </ul>
        </div>
      </div>
    `,
    
    'buscar-cotizacion': `
      <div class="text-center mb-4">
        <img src="image/logo-ToySoft.png" alt="ToySoft Logo" class="mb-3" style="width: 80px; height: 80px;">
        <h6 class="text-primary">🔍 Búsqueda de Cotizaciones</h6>
      </div>
      <div class="alert alert-info">
        <h6><i class="fas fa-info-circle me-2"></i>Métodos de Búsqueda</h6>
        <ul class="mb-0">
          <li><strong>Por número:</strong> Ingresa el ID de la cotización</li>
          <li><strong>Por cliente:</strong> Busca por nombre o teléfono</li>
          <li><strong>Por fecha:</strong> Filtra por rango de fechas</li>
          <li><strong>Por estado:</strong> Pendiente, Aprobada, Rechazada</li>
        </ul>
      </div>
    `,
    
    'imprimir-cotizacion': `
      <div class="text-center mb-4">
        <img src="image/logo-ToySoft.png" alt="ToySoft Logo" class="mb-3" style="width: 80px; height: 80px;">
        <h6 class="text-primary">🖨️ Impresión de Cotizaciones</h6>
      </div>
      <div class="row">
        <div class="col-md-6">
          <h6><i class="fas fa-print text-primary me-2"></i>Configuración</h6>
          <ul class="list-unstyled">
            <li>• Verifica impresora conectada</li>
            <li>• Selecciona formato A4</li>
            <li>• Configura márgenes apropiados</li>
            <li>• Revisa vista previa</li>
          </ul>
        </div>
        <div class="col-md-6">
          <h6><i class="fas fa-file-pdf text-danger me-2"></i>Exportar PDF</h6>
          <ul class="list-unstyled">
            <li>• Genera archivo PDF</li>
            <li>• Guarda en carpeta local</li>
            <li>• Envía por email</li>
            <li>• Comparte por WhatsApp</li>
          </ul>
        </div>
      </div>
    `,
    
    'nueva-cotizacion': `
      <div class="text-center mb-4">
        <img src="image/logo-ToySoft.png" alt="ToySoft Logo" class="mb-3" style="width: 80px; height: 80px;">
        <h6 class="text-primary">➕ Nueva Cotización</h6>
      </div>
      <div class="alert alert-success">
        <h6><i class="fas fa-plus-circle me-2"></i>Pasos para Crear</h6>
        <ol class="mb-0">
          <li>Selecciona productos del catálogo</li>
          <li>Configura cantidades y precios</li>
          <li>Agrega descuentos si aplica</li>
          <li>Ingresa datos del cliente</li>
          <li>Revisa totales y detalles</li>
          <li>Genera y guarda la cotización</li>
        </ol>
      </div>
    `,
    
    'default': `
      <div class="text-center mb-4">
        <img src="image/logo-ToySoft.png" alt="ToySoft Logo" class="mb-3" style="width: 80px; height: 80px;">
        <h6 class="text-primary">❓ Centro de Ayuda</h6>
      </div>
      <div class="alert alert-info">
        <h6><i class="fas fa-question-circle me-2"></i>¿En qué puedo ayudarte?</h6>
        <p class="mb-0">Soy tu asistente virtual y estoy aquí para ayudarte con cualquier duda sobre el sistema POS.</p>
      </div>
    `
  };
  
  return ayudas[tipo] || ayudas['default'];
}

// Hacer función globalmente accesible
window.mostrarAyudaEspecifica = mostrarAyudaEspecifica;

// ========================================
// FUNCIONES DE UTILIDAD
// ========================================

// Función para imprimir tirilla de utilidad
function imprimirTirillaUtilidad() {
  try {
    if (!window.utilidadActual || !window.utilidadActual.productos) {
      alert('Por favor, genere primero el balance para calcular la utilidad');
      return;
    }

    const { productos, total, tipoPeriodo, fecha } = window.utilidadActual;
    const productosConUtilidad = Object.values(productos).sort((a, b) => b.utilidadTotal - a.utilidadTotal);

    if (productosConUtilidad.length === 0) {
      alert('No hay productos con costo definido para imprimir');
      return;
    }

    const ventana = window.open('', 'ImpresionTirillaUtilidad', 'width=400,height=600,scrollbars=yes');
    
    if (!ventana) {
      alert('Por favor, permite las ventanas emergentes para este sitio');
      return;
    }

    const fechaImpresion = new Date().toLocaleDateString('es-ES');
    const horaImpresion = new Date().toLocaleTimeString('es-ES');
    
    let tituloPeriodo = '';
    switch(tipoPeriodo) {
      case 'diario':
        tituloPeriodo = `Día ${new Date(fecha).toLocaleDateString('es-ES')}`;
        break;
      case 'semanal':
        tituloPeriodo = 'Semana Actual';
        break;
      case 'mensual':
        tituloPeriodo = `Mes de ${new Date(fecha).toLocaleDateString('es-ES', { month: 'long', year: 'numeric' })}`;
        break;
      case 'anual':
        tituloPeriodo = `Año ${new Date(fecha).getFullYear()}`;
        break;
      default:
        tituloPeriodo = 'Período Seleccionado';
    }

    let productosHTML = '';
    productosConUtilidad.forEach((producto, index) => {
      productosHTML += `
        <div class="producto-item">
          <div class="producto-nombre">${producto.nombre}</div>
          <div class="utilidad-info">
            <div>Cantidad: ${producto.cantidadVendida}</div>
            <div>Precio Venta: $${producto.precioVenta.toLocaleString()}</div>
            <div>Costo: $${producto.costo.toLocaleString()}</div>
            <div>Utilidad Unitaria: $${producto.utilidadUnitaria.toLocaleString()}</div>
            <div class="utilidad-total">Utilidad Total: $${producto.utilidadTotal.toLocaleString()}</div>
          </div>
        </div>
      `;
      if (index < productosConUtilidad.length - 1) {
        productosHTML += '<div class="separador"></div>';
      }
    });

    ventana.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Tirilla Utilidad</title>
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
            .header {
              border-bottom: 1px dashed #000;
              padding-bottom: 1mm;
              margin-bottom: 1mm;
              text-align: center;
            }
            .producto-item {
              margin-bottom: 2mm;
              padding-bottom: 1mm;
            }
            .producto-nombre {
              font-size: 14px;
              font-weight: bold;
              margin-bottom: 0.5mm;
              word-wrap: break-word;
            }
            .utilidad-info {
              font-size: 12px;
              margin-left: 2mm;
            }
            .utilidad-total {
              font-weight: bold;
              color: #006400;
              margin-top: 1mm;
            }
            .separador {
              border-top: 1px dashed #ccc;
              margin: 1mm 0;
            }
            .total-section {
              border-top: 2px solid #000;
              margin-top: 2mm;
              padding-top: 2mm;
              text-align: center;
              font-weight: bold;
              font-size: 16px;
            }
            .fecha-hora {
              font-size: 11px;
              color: #666;
              margin-bottom: 1mm;
            }
            .botones-impresion {
              position: fixed;
              top: 10px;
              right: 10px;
              z-index: 1000;
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
          </div>
          <div class="header">
            <div class="mb-1"><strong>REPORTE DE UTILIDAD</strong></div>
            <div class="fecha-hora">${tituloPeriodo}</div>
            <div class="fecha-hora">${fechaImpresion} ${horaImpresion}</div>
          </div>
          ${productosHTML}
          <div class="total-section">
            TOTAL UTILIDAD: $${total.toLocaleString()}
          </div>
        </body>
      </html>
    `);
    
    ventana.document.close();
  } catch (error) {
    console.error('Error al imprimir tirilla de utilidad:', error);
    alert('Error al generar la tirilla de utilidad: ' + error.message);
  }
}

// Función para exportar utilidad a Excel
function exportarUtilidadExcel() {
  try {
    if (typeof XLSX === 'undefined') {
      alert('La funcionalidad de exportación a Excel no está disponible. Por favor, instale la librería XLSX.');
      return;
    }

    if (!window.utilidadActual || !window.utilidadActual.productos) {
      alert('Por favor, genere primero el balance para calcular la utilidad');
      return;
    }

    const { productos, total, tipoPeriodo, fecha } = window.utilidadActual;
    const productosConUtilidad = Object.values(productos).sort((a, b) => b.utilidadTotal - a.utilidadTotal);

    if (productosConUtilidad.length === 0) {
      alert('No hay productos con costo definido para exportar');
      return;
    }

    const wb = XLSX.utils.book_new();
    
    let tituloPeriodo = '';
    switch(tipoPeriodo) {
      case 'diario':
        tituloPeriodo = `Día ${new Date(fecha).toLocaleDateString('es-ES')}`;
        break;
      case 'semanal':
        tituloPeriodo = 'Semana Actual';
        break;
      case 'mensual':
        tituloPeriodo = `Mes de ${new Date(fecha).toLocaleDateString('es-ES', { month: 'long', year: 'numeric' })}`;
        break;
      case 'anual':
        tituloPeriodo = `Año ${new Date(fecha).getFullYear()}`;
        break;
      default:
        tituloPeriodo = 'Período Seleccionado';
    }

    const datos = productosConUtilidad.map(producto => ({
      'Producto': producto.nombre,
      'Cantidad Vendida': producto.cantidadVendida,
      'Precio Venta': producto.precioVenta,
      'Costo': producto.costo,
      'Utilidad Unitaria': producto.utilidadUnitaria,
      'Utilidad Total': producto.utilidadTotal
    }));

    // Agregar fila de total
    datos.push({
      'Producto': 'TOTAL',
      'Cantidad Vendida': '',
      'Precio Venta': '',
      'Costo': '',
      'Utilidad Unitaria': '',
      'Utilidad Total': total
    });

    const ws = XLSX.utils.json_to_sheet(datos);

    const anchos = [
      { wch: 30 }, // Producto
      { wch: 15 }, // Cantidad Vendida
      { wch: 15 }, // Precio Venta
      { wch: 15 }, // Costo
      { wch: 18 }, // Utilidad Unitaria
      { wch: 18 }  // Utilidad Total
    ];
    ws['!cols'] = anchos;

    XLSX.utils.book_append_sheet(wb, ws, `Utilidad ${tituloPeriodo}`);

    const fechaArchivo = new Date().toISOString().split('T')[0];
    XLSX.writeFile(wb, `Utilidad_${tituloPeriodo.replace(/[^a-zA-Z0-9]/g, '_')}_${fechaArchivo}.xlsx`);
    
    alert('Archivo Excel de utilidad generado exitosamente');
  } catch (error) {
    console.error('Error al exportar utilidad a Excel:', error);
    alert('Error al generar el archivo Excel: ' + error.message);
  }
}

// Hacer funciones globalmente accesibles
window.imprimirTirillaUtilidad = imprimirTirillaUtilidad;
window.exportarUtilidadExcel = exportarUtilidadExcel;
  