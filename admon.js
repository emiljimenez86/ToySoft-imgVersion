// Variables globales
window.categorias = JSON.parse(localStorage.getItem('categorias')) || [];
window.productos = JSON.parse(localStorage.getItem('productos')) || [];
window.ventas = JSON.parse(localStorage.getItem('ventas')) || [];
window.clientes = JSON.parse(localStorage.getItem('clientes')) || [];

// Variables para backup automático
const MAX_BACKUPS = 3; // Reducido a 3 backups
const BACKUP_INTERVAL = 60 * 60 * 1000; // 1 hora en lugar de 30 minutos
const MAX_VENTAS_BACKUP = 100; // Solo guardar las últimas 100 ventas en el backup

// Variables globales para paginación
let paginaActualClientes = 1;
let paginaActualProductos = 1;
let clientesPorPagina = 10;
let productosPorPagina = 10;
let clientesFiltrados = [];
let productosFiltrados = [];

// Funciones de Backup y Restauración
function crearBackup() {
    // Crear una copia de las ventas limitada a las últimas MAX_VENTAS_BACKUP
    const ventasLimitadas = window.ventas.slice(-MAX_VENTAS_BACKUP);
    
    const datos = {
        categorias: window.categorias,
        productos: window.productos,
        clientes: window.clientes,
        ventas: ventasLimitadas,
        fecha: new Date().toISOString()
    };
    return datos;
}

function guardarBackupAutomatico() {
    try {
        const backups = JSON.parse(localStorage.getItem('backups_automaticos')) || [];
        const nuevoBackup = crearBackup();
        
        // Verificar el tamaño del nuevo backup
        const backupSize = new Blob([JSON.stringify(nuevoBackup)]).size;
        const maxSize = 2 * 1024 * 1024; // 2MB límite
        
        if (backupSize > maxSize) {
            console.warn('El backup es demasiado grande, se omitirá');
            return;
        }
        
        backups.unshift(nuevoBackup);
        if (backups.length > MAX_BACKUPS) {
            backups.pop();
        }
        
        localStorage.setItem('backups_automaticos', JSON.stringify(backups));
    } catch (error) {
        console.error('Error al guardar backup automático:', error);
    }
}

function iniciarBackupAutomatico() {
    // Realizar un backup inicial
    guardarBackupAutomatico();
    
    // Configurar el intervalo
    setInterval(guardarBackupAutomatico, BACKUP_INTERVAL);
}

function exportarDatos() {
    const datos = crearBackup();
    const blob = new Blob([JSON.stringify(datos, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `backup_pos_${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

function validarDatos(datos) {
    const errores = [];
    
    // Validar estructura básica
    if (!datos.categorias || !Array.isArray(datos.categorias)) errores.push('Categorías inválidas');
    if (!datos.productos || !Array.isArray(datos.productos)) errores.push('Productos inválidos');
    if (!datos.clientes || !Array.isArray(datos.clientes)) errores.push('Clientes inválidos');
    if (!datos.ventas || !Array.isArray(datos.ventas)) errores.push('Ventas inválidas');
    
    // Validar datos de productos
    if (datos.productos) {
        datos.productos.forEach((producto, index) => {
            if (!producto.nombre || !producto.precio || !producto.categoria) {
                errores.push(`Producto ${index + 1} incompleto`);
            }
        });
    }
    
    // Validar datos de clientes
    if (datos.clientes) {
        datos.clientes.forEach((cliente, index) => {
            if (!cliente.nombre || !cliente.telefono) {
                errores.push(`Cliente ${index + 1} incompleto`);
            }
        });
    }
    
    return errores;
}

function mostrarResumenDatos(datos) {
    const resumen = `
        Categorías: ${datos.categorias.length}
        Productos: ${datos.productos.length}
        Clientes: ${datos.clientes.length}
        Ventas: ${datos.ventas.length}
        Fecha: ${new Date(datos.fecha).toLocaleString()}
    `;
    return resumen;
}

function importarDatos(event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            const datos = JSON.parse(e.target.result);
            
            // Validar datos
            const errores = validarDatos(datos);
            if (errores.length > 0) {
                throw new Error('Errores en los datos:\n' + errores.join('\n'));
            }

            // Mostrar resumen y pedir confirmación
            const resumen = mostrarResumenDatos(datos);
            if (confirm(`¿Estás seguro de que deseas restaurar estos datos?\n\n${resumen}\n\nSe sobrescribirán los datos actuales.`)) {
                // Restaurar datos
                window.categorias = datos.categorias;
                window.productos = datos.productos;
                window.clientes = datos.clientes;
                window.ventas = datos.ventas;

                // Guardar en localStorage
                localStorage.setItem('categorias', JSON.stringify(window.categorias));
                localStorage.setItem('productos', JSON.stringify(window.productos));
                localStorage.setItem('clientes', JSON.stringify(window.clientes));
                localStorage.setItem('ventas', JSON.stringify(window.ventas));

                // Recargar la interfaz
                cargarCategorias();
                cargarProductos();
                cargarClientes();
                cargarVentas();

                alert('Datos restaurados exitosamente');
            }
        } catch (error) {
            alert('Error al importar los datos: ' + error.message);
        }
    };
    reader.readAsText(file);
}

function mostrarBackupsAutomaticos() {
    const backups = JSON.parse(localStorage.getItem('backups_automaticos')) || [];
    if (backups.length === 0) {
        alert('No hay backups automáticos disponibles');
        return;
    }

    const opciones = backups.map((backup, index) => {
        const fecha = new Date(backup.fecha).toLocaleString();
        return `${index + 1}. ${fecha} (${backup.productos.length} productos, ${backup.clientes.length} clientes)`;
    }).join('\n');

    const seleccion = prompt(`Seleccione un backup para restaurar (1-${backups.length}):\n\n${opciones}`);
    const indice = parseInt(seleccion) - 1;

    if (indice >= 0 && indice < backups.length) {
        const backup = backups[indice];
        const resumen = mostrarResumenDatos(backup);
        
        if (confirm(`¿Restaurar este backup?\n\n${resumen}`)) {
            window.categorias = backup.categorias;
            window.productos = backup.productos;
            window.clientes = backup.clientes;
            window.ventas = backup.ventas;

            localStorage.setItem('categorias', JSON.stringify(window.categorias));
            localStorage.setItem('productos', JSON.stringify(window.productos));
            localStorage.setItem('clientes', JSON.stringify(window.clientes));
            localStorage.setItem('ventas', JSON.stringify(window.ventas));

            cargarCategorias();
            cargarProductos();
            cargarClientes();
            cargarVentas();

            alert('Backup restaurado exitosamente');
        }
    }
}

// Función de inicialización consolidada
function inicializarAdministracion() {
  console.log('🚀 Iniciando administración...');
  
  // Verificar acceso
  verificarAcceso();
  
  // Cargar datos específicos de administración
  cargarCategorias();
  cargarProductos();
  cargarClientes();
  cargarVentas();
  
  // Pequeño retraso para asegurar que el DOM esté completamente cargado
  setTimeout(() => {
    console.log('⏰ Cargando logo después del retraso...');
    cargarLogo();
  }, 100);
  
  cargarDatosNegocio();
  
  // Iniciar backup automático
  iniciarBackupAutomatico();
}

// Event listener único para DOMContentLoaded
document.addEventListener('DOMContentLoaded', inicializarAdministracion);

// Funciones para Categorías
function agregarCategoria() {
    console.log('Intentando agregar categoría...');
    const inputCategoria = document.getElementById('nuevaCategoria');
    if (!inputCategoria) {
        console.error('No se encontró el input de categoría');
        return;
    }

    const nombre = inputCategoria.value.trim();
    if (!nombre) {
        alert('Por favor ingrese un nombre para la categoría');
        return;
    }

    if (window.categorias.includes(nombre)) {
        alert('Esta categoría ya existe');
        return;
    }

    window.categorias.push(nombre);
    localStorage.setItem('categorias', JSON.stringify(window.categorias));
    cargarCategorias();
    inputCategoria.value = '';
    console.log('Categoría agregada:', nombre);
}

function cargarCategorias() {
    console.log('Cargando categorías...');
    const listaCategorias = document.getElementById('listaCategorias');
    const selectCategoria = document.getElementById('categoriaProducto');
    
    if (!listaCategorias || !selectCategoria) {
        console.error('No se encontraron los elementos para cargar categorías');
        return;
    }

    listaCategorias.innerHTML = '';
    selectCategoria.innerHTML = '<option value="">Seleccionar categoría</option>';
    
    window.categorias.forEach(categoria => {
        // Lista de categorías
        const div = document.createElement('div');
        div.className = 'd-flex align-items-center mb-2';
        div.innerHTML = `
            <div class="form-check me-3">
                <input class="form-check-input checkbox-alerta" type="checkbox" value="${categoria}" id="cat_${categoria}">
                <label class="form-check-label" for="cat_${categoria}">${categoria}</label>
            </div>
            <button class="btn btn-sm btn-outline-info ms-auto" onclick="modificarCategoria('${categoria}')">Modificar</button>
        `;
        listaCategorias.appendChild(div);

        // Select de categorías
        const option = document.createElement('option');
        option.value = categoria;
        option.textContent = categoria;
        selectCategoria.appendChild(option);
    });
    console.log('Categorías cargadas:', window.categorias);
}

// Funciones para Productos
function agregarProducto() {
    console.log('Intentando agregar producto...');
    const nombre = document.getElementById('nombreProducto').value.trim();
    const precio = parseFloat(document.getElementById('precioProducto').value);
    const categoria = document.getElementById('categoriaProducto').value;
    const imagen = document.getElementById('imagenProducto').value.trim();

    if (!nombre || isNaN(precio) || !categoria) {
        alert('Por favor complete todos los campos');
        return;
    }

    const producto = {
        id: Date.now(),
        nombre: nombre,
        precio: precio,
        categoria: categoria,
        imagen: imagen
    };

    window.productos.push(producto);
    localStorage.setItem('productos', JSON.stringify(window.productos));
    cargarProductos();
    
    // Limpiar campos
    document.getElementById('nombreProducto').value = '';
    document.getElementById('precioProducto').value = '';
    document.getElementById('categoriaProducto').value = '';
    document.getElementById('imagenProducto').value = '';
    document.getElementById('previewImagen').src = '';
    document.getElementById('previewImagen').style.display = 'none';
    console.log('Producto agregado:', producto);
}

// Manejar input de imagen para vista previa y autollenado
if (document.getElementById('examinarImagen')) {
    document.getElementById('examinarImagen').addEventListener('change', function(event) {
        const fileInput = event.target;
        const file = fileInput.files[0];
        if (file) {
            const url = URL.createObjectURL(file);
            document.getElementById('imagenProducto').value = fileInput.value;
            document.getElementById('previewImagen').src = url;
            document.getElementById('previewImagen').style.display = 'block';
        }
    });
}
if (document.getElementById('imagenProducto')) {
    document.getElementById('imagenProducto').addEventListener('input', function(event) {
        const value = event.target.value;
        if (value) {
            document.getElementById('previewImagen').src = value;
            document.getElementById('previewImagen').style.display = 'block';
        } else {
            document.getElementById('previewImagen').src = '';
            document.getElementById('previewImagen').style.display = 'none';
        }
    });
}


function cargarProductos() {
    const tbody = document.getElementById('listaProductos');
    if (!tbody) return;

    // Inicializar productosFiltrados si no está definido
    if (!productosFiltrados || productosFiltrados.length === 0) {
        productosFiltrados = [...window.productos];
    }

    const inicio = (paginaActualProductos - 1) * productosPorPagina;
    const fin = inicio + productosPorPagina;
    const productosAMostrar = productosFiltrados.slice(inicio, fin);

    tbody.innerHTML = '';
    productosAMostrar.forEach(producto => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td><input type="checkbox" value="${producto.id}"></td>
            <td>${producto.nombre}</td>
            <td>$${producto.precio}</td>
            <td>${producto.categoria}</td>
            <td>
                <button class="btn btn-sm btn-info" onclick="modificarProducto(${producto.id})">
                    <i class="fas fa-edit"></i>
                </button>
            </td>
        `;
        tbody.appendChild(tr);
    });

    const totalPaginas = Math.ceil(productosFiltrados.length / productosPorPagina);
    generarPaginacion('paginacionProductos', totalPaginas, paginaActualProductos, cambiarPaginaProductos);
}

// Funciones para Clientes
function agregarCliente() {
    const documento = document.getElementById('documentoCliente').value.trim();
    const nombre = document.getElementById('nombreCliente').value.trim();
    const apellido = document.getElementById('apellidoCliente').value.trim();
    const telefono = document.getElementById('telefonoCliente').value.trim();
    const direccion = document.getElementById('direccionCliente').value.trim();
    const correo = document.getElementById('correoCliente').value.trim();

    if (!documento || !nombre || !apellido || !telefono) {
        alert('Por favor complete todos los campos obligatorios (Documento, Nombre, Apellido y Teléfono)');
        return;
    }

    const nuevoCliente = {
        id: Date.now(),
        documento,
        nombre,
        apellido,
        telefono,
        direccion,
        correo
    };

    window.clientes.push(nuevoCliente);
    localStorage.setItem('clientes', JSON.stringify(window.clientes));
    cargarClientes();

    // Limpiar campos
    document.getElementById('documentoCliente').value = '';
    document.getElementById('nombreCliente').value = '';
    document.getElementById('apellidoCliente').value = '';
    document.getElementById('telefonoCliente').value = '';
    document.getElementById('direccionCliente').value = '';
    document.getElementById('correoCliente').value = '';
}

function cargarClientes() {
    const tbody = document.getElementById('listaClientes');
    if (!tbody) return;

    // Inicializar clientesFiltrados si no está definido
    if (!clientesFiltrados || clientesFiltrados.length === 0) {
        clientesFiltrados = [...window.clientes];
    }

    const inicio = (paginaActualClientes - 1) * clientesPorPagina;
    const fin = inicio + clientesPorPagina;
    const clientesAMostrar = clientesFiltrados.slice(inicio, fin);

    tbody.innerHTML = '';
    clientesAMostrar.forEach(cliente => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td><input type="checkbox" value="${cliente.id}"></td>
            <td>${cliente.documento}</td>
            <td>${cliente.nombre}</td>
            <td>${cliente.apellido}</td>
            <td>${cliente.telefono}</td>
            <td>${cliente.direccion || '-'}</td>
            <td>${cliente.correo || '-'}</td>
            <td>
                <button class="btn btn-sm btn-info" onclick="modificarCliente(${cliente.id})">
                    <i class="fas fa-edit"></i>
                </button>
            </td>
        `;
        tbody.appendChild(tr);
    });

    const totalPaginas = Math.ceil(clientesFiltrados.length / clientesPorPagina);
    generarPaginacion('paginacionClientes', totalPaginas, paginaActualClientes, cambiarPaginaClientes);
}

// Funciones para Ventas
function cargarVentas() {
    console.log('Cargando ventas...');
    const tbody = document.getElementById('historialVentas');
    if (!tbody) {
        console.error('No se encontró el elemento para cargar ventas');
        return;
    }

    tbody.innerHTML = '';

    window.ventas.forEach(venta => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${new Date(venta.fecha).toLocaleString()}</td>
            <td>${venta.mesa}</td>
            <td>$${venta.total}</td>
            <td>$${venta.propina}</td>
            <td>$${venta.descuento}</td>
            <td>$${venta.totalFinal}</td>
        `;
        tbody.appendChild(tr);
    });
    console.log('Ventas cargadas:', window.ventas);
}

// Funciones de eliminación
function eliminarCategoria() {
    const checkboxes = document.querySelectorAll('#listaCategorias input[type="checkbox"]:checked');
    if (checkboxes.length === 0) {
        alert('Por favor seleccione al menos una categoría para eliminar');
        return;
    }

    const categoriasAEliminar = Array.from(checkboxes).map(cb => cb.value);
    const confirmacion = confirm(`¿Está seguro que desea eliminar ${categoriasAEliminar.length} categoría(s)?`);

    if (confirmacion) {
        window.categorias = window.categorias.filter(c => !categoriasAEliminar.includes(c));
        localStorage.setItem('categorias', JSON.stringify(window.categorias));
        cargarCategorias();
    }
}

function eliminarProducto() {
    const checkboxes = document.querySelectorAll('#listaProductos input[type="checkbox"]:checked');
    if (checkboxes.length === 0) {
        alert('Por favor seleccione al menos un producto para eliminar');
        return;
    }

    const productosAEliminar = Array.from(checkboxes).map(cb => parseInt(cb.value));
    const confirmacion = confirm(`¿Está seguro que desea eliminar ${productosAEliminar.length} producto(s)?`);

    if (confirmacion) {
        window.productos = window.productos.filter(p => !productosAEliminar.includes(p.id));
        localStorage.setItem('productos', JSON.stringify(window.productos));
        cargarProductos();
    }
}

function eliminarCliente() {
    const checkboxes = document.querySelectorAll('#listaClientes input[type="checkbox"]:checked');
    if (checkboxes.length === 0) {
        alert('Por favor seleccione al menos un cliente para eliminar');
        return;
    }

    const clientesAEliminar = Array.from(checkboxes).map(cb => parseInt(cb.value));
    const confirmacion = confirm(`¿Está seguro que desea eliminar ${clientesAEliminar.length} cliente(s)?`);

    if (confirmacion) {
        window.clientes = window.clientes.filter(c => !clientesAEliminar.includes(c.id));
        localStorage.setItem('clientes', JSON.stringify(window.clientes));
        cargarClientes();
    }
}

// Funciones de modificación
function modificarCliente(id) {
    const cliente = window.clientes.find(c => c.id === id);
    if (!cliente) return;

    const nuevoDocumento = prompt('Documento:', cliente.documento);
    if (nuevoDocumento === null) return;

    const nuevoNombre = prompt('Nombre:', cliente.nombre);
    if (nuevoNombre === null) return;

    const nuevoApellido = prompt('Apellido:', cliente.apellido);
    if (nuevoApellido === null) return;

    const nuevoTelefono = prompt('Teléfono:', cliente.telefono);
    if (nuevoTelefono === null) return;

    const nuevaDireccion = prompt('Dirección:', cliente.direccion || '');
    if (nuevaDireccion === null) return;

    const nuevoCorreo = prompt('Correo electrónico (opcional):', cliente.correo || '');
    if (nuevoCorreo === null) return;

    if (!nuevoDocumento || !nuevoNombre || !nuevoApellido || !nuevoTelefono) {
        alert('Los campos Documento, Nombre, Apellido y Teléfono son obligatorios');
        return;
    }

    cliente.documento = nuevoDocumento;
    cliente.nombre = nuevoNombre;
    cliente.apellido = nuevoApellido;
    cliente.telefono = nuevoTelefono;
    cliente.direccion = nuevaDireccion;
    cliente.correo = nuevoCorreo;

    localStorage.setItem('clientes', JSON.stringify(window.clientes));
    cargarClientes();
}

function modificarCategoria(nombreActual) {
    const modal = new bootstrap.Modal(document.getElementById('modalModificarCategoria'));
    const categoriaActualInput = document.getElementById('categoriaActualModificar');
    const nombreInput = document.getElementById('nombreCategoriaModificar');

    categoriaActualInput.value = nombreActual;
    nombreInput.value = nombreActual;

    modal.show();
}

function guardarModificacionCategoria() {
    const categoriaActualInput = document.getElementById('categoriaActualModificar');
    const nombreInput = document.getElementById('nombreCategoriaModificar');

    const nombreActual = categoriaActualInput.value;
    const nuevoNombre = nombreInput.value.trim();

    if (!nuevoNombre) {
        alert('Por favor ingrese un nombre para la categoría');
        return;
    }

    if (window.categorias.includes(nuevoNombre) && nuevoNombre !== nombreActual) {
        alert('Esta categoría ya existe');
        return;
    }

    const index = window.categorias.indexOf(nombreActual);
    if (index !== -1) {
        window.productos.forEach(producto => {
            if (producto.categoria === nombreActual) {
                producto.categoria = nuevoNombre;
            }
        });

        window.categorias[index] = nuevoNombre;
        localStorage.setItem('categorias', JSON.stringify(window.categorias));
        localStorage.setItem('productos', JSON.stringify(window.productos));
        cargarCategorias();
        cargarProductos();
        
        const modal = bootstrap.Modal.getInstance(document.getElementById('modalModificarCategoria'));
        modal.hide();
    }
}

function modificarProducto(id) {
    const producto = window.productos.find(p => p.id === id);
    if (!producto) return;

    const modal = new bootstrap.Modal(document.getElementById('modalModificarProducto'));
    const idInput = document.getElementById('productoIdModificar');
    const nombreInput = document.getElementById('nombreProductoModificar');
    const precioInput = document.getElementById('precioProductoModificar');
    const categoriaSelect = document.getElementById('categoriaProductoModificar');
    const imagenInput = document.getElementById('imagenProductoModificar');
    const previewImagen = document.getElementById('previewImagenModificar');

    // Llenar el select de categorías
    categoriaSelect.innerHTML = '<option value="">Seleccionar categoría</option>';
    window.categorias.forEach(categoria => {
        const option = document.createElement('option');
        option.value = categoria;
        option.textContent = categoria;
        if (categoria === producto.categoria) {
            option.selected = true;
        }
        categoriaSelect.appendChild(option);
    });

    idInput.value = id;
    nombreInput.value = producto.nombre;
    precioInput.value = producto.precio;
    imagenInput.value = producto.imagen || '';
    if (producto.imagen) {
        previewImagen.src = producto.imagen;
        previewImagen.style.display = 'block';
    } else {
        previewImagen.src = '';
        previewImagen.style.display = 'none';
    }

    modal.show();
}

// Manejar input de imagen para vista previa y autollenado en modificar
if (document.getElementById('examinarImagenModificar')) {
    document.getElementById('examinarImagenModificar').addEventListener('change', function(event) {
        const fileInput = event.target;
        const file = fileInput.files[0];
        if (file) {
            const url = URL.createObjectURL(file);
            document.getElementById('imagenProductoModificar').value = fileInput.value;
            document.getElementById('previewImagenModificar').src = url;
            document.getElementById('previewImagenModificar').style.display = 'block';
        }
    });
}
if (document.getElementById('imagenProductoModificar')) {
    document.getElementById('imagenProductoModificar').addEventListener('input', function(event) {
        const value = event.target.value;
        if (value) {
            document.getElementById('previewImagenModificar').src = value;
            document.getElementById('previewImagenModificar').style.display = 'block';
        } else {
            document.getElementById('previewImagenModificar').src = '';
            document.getElementById('previewImagenModificar').style.display = 'none';
        }
    });
}


function guardarModificacionProducto() {
    const idInput = document.getElementById('productoIdModificar');
    const nombreInput = document.getElementById('nombreProductoModificar');
    const precioInput = document.getElementById('precioProductoModificar');
    const categoriaSelect = document.getElementById('categoriaProductoModificar');
    const imagenInput = document.getElementById('imagenProductoModificar');

    const id = parseInt(idInput.value);
    const nombre = nombreInput.value.trim();
    const precio = parseFloat(precioInput.value);
    const categoria = categoriaSelect.value;
    const imagen = imagenInput.value.trim();

    if (!nombre || isNaN(precio) || !categoria) {
        alert('Por favor complete todos los campos');
        return;
    }

    const producto = window.productos.find(p => p.id === id);
    if (producto) {
        producto.nombre = nombre;
        producto.precio = precio;
        producto.categoria = categoria;
        producto.imagen = imagen;
        localStorage.setItem('productos', JSON.stringify(window.productos));
        cargarProductos();
        
        const modal = bootstrap.Modal.getInstance(document.getElementById('modalModificarProducto'));
        modal.hide();
    }
}


// Funciones para Cierre Diario
function mostrarModalCierreDiario() {
    try {
        // Calcular rango a partir del último cierre
        const ultimaHoraCierreStr = localStorage.getItem('ultimaHoraCierre');
        const ultimaHoraCierre = ultimaHoraCierreStr ? new Date(ultimaHoraCierreStr) : null;

        // Obtener ventas almacenadas
        const ventas = JSON.parse(localStorage.getItem('ventas')) || [];
        const hoy = new Date();
        const hoyStr = hoy.toISOString().slice(0, 10);
        const ventasHoy = ventas.filter(v => {
            const fechaVenta = new Date(v.fecha);
            if (ultimaHoraCierre) {
                return fechaVenta > ultimaHoraCierre;
            }
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
                        totalCredito += total;
                        break;
                }
            }
            totalVentas += total;
        });

        // Obtener gastos del día
        const gastos = JSON.parse(localStorage.getItem('gastos')) || [];
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

        // Crear el contenido del modal
        const modalContent = `
            <div class="modal fade" id="modalCierreDiario" tabindex="-1">
                <div class="modal-dialog modal-lg">
                    <div class="modal-content bg-dark text-white">
                        <div class="modal-header">
                            <h5 class="modal-title">Cierre Diario</h5>
                            <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal"></button>
                        </div>
                        <div class="modal-body">
                            <div class="row mb-3">
                                <div class="col-md-6">
                                    <label class="form-label">Nombre de quien cierra</label>
                                    <input type="text" class="form-control bg-dark text-white" id="nombreCierre" required>
                                </div>
                                <div class="col-md-6">
                                    <label class="form-label">Nombre de quien recibe</label>
                                    <input type="text" class="form-control bg-dark text-white" id="nombreRecibe" required>
                                </div>
                            </div>
                            <div class="row mb-3">
                                <div class="col-md-6">
                                    <label class="form-label">Monto base de caja</label>
                                    <input type="number" class="form-control bg-dark text-white" id="montoBaseCaja" required>
                                </div>
                            </div>
                            <div class="row mb-3">
                                <div class="col-12">
                                    <label class="form-label">Detalles adicionales</label>
                                    <textarea class="form-control bg-dark text-white" id="detallesCierre" rows="3"></textarea>
                                </div>
                            </div>
                            <div class="border-top border-secondary pt-3">
                                <h6>Resumen de Ventas</h6>
                                <div class="row">
                                    <div class="col-md-6">
                                        <p>Total Ventas: $ ${totalVentas.toLocaleString()}</p>
                                        <p>Efectivo: $ ${totalEfectivo.toLocaleString()}</p>
                                        <p>Transferencia: $ ${totalTransferencia.toLocaleString()}</p>
                                        <p>Tarjeta: $ ${totalTarjeta.toLocaleString()}</p>
                                        <p>Crédito: $ ${totalCredito.toLocaleString()}</p>
                                        <p>Mixto: $ ${totalMixto.toLocaleString()}</p>
                                    </div>
                                    <div class="col-md-6">
                                        <h6>Gastos</h6>
                                        <p>Total Gastos: $ ${totalGastos.toLocaleString()}</p>
                                        <h6>Balance Final</h6>
                                        <p>Balance: $ ${balanceFinal.toLocaleString()}</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                        <div class="modal-footer">
                            <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancelar</button>
                            <button type="button" class="btn btn-success" onclick="exportarCierresDiariosExcel()">
                                <i class="fas fa-file-excel"></i> Exportar a Excel
                            </button>
                            <button type="button" class="btn btn-primary" onclick="guardarCierreDiario()">Guardar e imprimir cierre</button>
                        </div>
                    </div>
                </div>
            </div>
        `;

        // Eliminar modal existente si hay uno
        const modalExistente = document.getElementById('modalCierreDiario');
        if (modalExistente) {
            modalExistente.remove();
        }

        // Agregar nuevo modal al body
        document.body.insertAdjacentHTML('beforeend', modalContent);

        // Mostrar el modal
        const modal = new bootstrap.Modal(document.getElementById('modalCierreDiario'));
        modal.show();
    } catch (error) {
        console.error('Error al mostrar modal de cierre:', error);
        alert('Error al mostrar el modal de cierre');
    }
}

function guardarCierreDiario() {
    try {
        // Validar campos requeridos
        const nombreCierre = document.getElementById('nombreCierre').value.trim();
        const nombreRecibe = document.getElementById('nombreRecibe').value.trim();
        const montoBaseCaja = parseFloat(document.getElementById('montoBaseCaja').value) || 0;
        const detallesCierre = document.getElementById('detallesCierre').value.trim();

        if (!nombreCierre || !nombreRecibe || montoBaseCaja <= 0) {
            alert('Por favor complete todos los campos requeridos');
            return;
        }

        // Obtener ventas y gastos del día
        const ventas = JSON.parse(localStorage.getItem('ventas')) || [];
        const gastos = JSON.parse(localStorage.getItem('gastos')) || [];
        const hoy = new Date();
        const hoyStr = hoy.toISOString().slice(0, 10);

        const ventasHoy = ventas.filter(v => {
            const fechaVenta = new Date(v.fecha);
            const fechaVentaStr = fechaVenta.toISOString().slice(0, 10);
            return fechaVentaStr === hoyStr;
        });

        const gastosHoy = gastos.filter(g => {
            const fechaGasto = new Date(g.fecha);
            const fechaGastoStr = fechaGasto.toISOString().slice(0, 10);
            return fechaGastoStr === hoyStr;
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
                        totalCredito += total;
                        break;
                }
            }
            totalVentas += total;
        });

        const totalGastos = gastosHoy.reduce((sum, g) => sum + (parseFloat(g.monto) || 0), 0);
        const balanceFinal = totalVentas - totalGastos;

        // Crear objeto de cierre
        const cierreDiario = {
            fecha: hoy.toISOString(),
            nombreCierre,
            nombreRecibe,
            montoBaseCaja,
            detallesCierre,
            ventas: {
                total: totalVentas,
                efectivo: totalEfectivo,
                transferencia: totalTransferencia,
                tarjeta: totalTarjeta,
                credito: totalCredito,
                mixto: totalMixto
            },
            gastos: totalGastos,
            balance: balanceFinal
        };

        // Guardar en historial de cierres
        const historialCierres = JSON.parse(localStorage.getItem('historialCierres')) || [];
        historialCierres.push(cierreDiario);
        localStorage.setItem('historialCierres', JSON.stringify(historialCierres));

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

        if (confirmacion) {
            // Reiniciar ventas y gastos (memoria y almacenamiento)
            localStorage.setItem('ventas', JSON.stringify([]));
            localStorage.removeItem('gastos');
            if (Array.isArray(window.ventas)) window.ventas = [];
            if (Array.isArray(window.gastos)) window.gastos = [];
            
            // Registrar hora de cierre para futuras consultas
            localStorage.setItem('ultimaHoraCierre', new Date().toISOString());

            // Reiniciar contadores
            localStorage.setItem('contadorDelivery', '0');
            localStorage.setItem('contadorRecoger', '0');
            
            // Limpiar mesas activas
            localStorage.setItem('mesasActivas', JSON.stringify([]));

            // Cerrar el modal
            const modal = bootstrap.Modal.getInstance(document.getElementById('modalCierreDiario'));
            modal.hide();

            // Imprimir el cierre
            imprimirCierreDiario(cierreDiario);

            alert('Cierre diario realizado con éxito');
            // Recargar la página para asegurar que todas las variables globales se reinicien
            setTimeout(() => location.reload(), 500);
        }
    } catch (error) {
        console.error('Error al guardar cierre diario:', error);
        alert('Error al guardar el cierre diario');
    }
}

function imprimirCierreDiario(cierre) {
    const ventana = window.open('', 'ImpresionCierre', 'width=400,height=600,scrollbars=yes');
    if (!ventana) {
        alert('Por favor, permite las ventanas emergentes para este sitio');
        return;
    }

    const contenido = `
        <!DOCTYPE html>
        <html>
            <head>
                <title>Cierre de Caja</title>
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
                </style>
            </head>
            <body>
                <div class="botones-impresion">
                    <button onclick="window.print()">Imprimir</button>
                    <button onclick="window.close()">Cerrar</button>
                </div>
                <div class="contenido-cierre">
                    <div class="header text-center">
                        <h2 style="margin: 0; font-size: 14px;">CIERRE DE CAJA</h2>
                        <div class="mb-1">${new Date(cierre.fecha).toLocaleString()}</div>
                    </div>

                    <div class="border-top">
                        <div class="mb-1"><strong>Información de Cierre</strong></div>
                        <div class="mb-1">Entrega: ${cierre.nombreCierre || 'N/A'}</div>
                        <div class="mb-1">Recibe: ${cierre.nombreRecibe || 'N/A'}</div>
                        <div class="mb-1">Base Caja: $ ${(cierre.montoBaseCaja || 0).toLocaleString()}</div>
                    </div>

                    <div class="border-top">
                        <div class="mb-1"><strong>Resumen de Ventas</strong></div>
                        <div class="mb-1">Total: $ ${(cierre.ventas?.total || 0).toLocaleString()}</div>
                        <div class="mb-1">- Efectivo: $ ${(cierre.ventas?.efectivo || 0).toLocaleString()}</div>
                        <div class="mb-1">- Transferencia: $ ${(cierre.ventas?.transferencia || 0).toLocaleString()}</div>
                        <div class="mb-1">- Tarjeta: $ ${(cierre.ventas?.tarjeta || 0).toLocaleString()}</div>
                        <div class="mb-1">- Crédito: $ ${(cierre.ventas?.credito || 0).toLocaleString()}</div>
                        <div class="mb-1">- Mixto: $ ${(cierre.ventas?.mixto || 0).toLocaleString()}</div>
                    </div>

                    <div class="border-top">
                        <div class="mb-1"><strong>Gastos</strong></div>
                        <div class="mb-1">Total: $ ${(cierre.gastos || 0).toLocaleString()}</div>
                    </div>

                    <div class="border-top">
                        <div class="mb-1 total-row">Balance Final: $ ${(cierre.balance || 0).toLocaleString()}</div>
                    </div>

                    ${cierre.detallesCierre ? `
                    <div class="border-top">
                        <div class="mb-1"><strong>Detalles Adicionales</strong></div>
                        <div class="mb-1">${cierre.detallesCierre}</div>
                    </div>
                    ` : ''}

                    <div class="border-top text-center">
                        <div class="mb-1">Firma de Entrega: _________________</div>
                        <div class="mb-1">Firma de Recibe: _________________</div>
                    </div>
                </div>
            </body>
        </html>
    `;
    ventana.document.write(contenido);
    ventana.document.close();
    ventana.print();
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
            'Detalles': cierre.detallesCierre || ''
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
        const fecha = new Date().toISOString().split('T')[0];
        XLSX.writeFile(wb, `Cierres_Diarios_${fecha}.xlsx`);
        
        alert('Archivo Excel generado exitosamente');
    } catch (error) {
        console.error('Error al exportar a Excel:', error);
        alert('Error al generar el archivo Excel');
    }
}

// Funciones de búsqueda y filtrado
function filtrarClientes() {
    const busqueda = document.getElementById('buscarCliente').value.toLowerCase();
    clientesFiltrados = window.clientes.filter(cliente => 
        cliente.documento.toLowerCase().includes(busqueda) ||
        cliente.nombre.toLowerCase().includes(busqueda) ||
        cliente.apellido.toLowerCase().includes(busqueda) ||
        cliente.telefono.toLowerCase().includes(busqueda) ||
        cliente.correo.toLowerCase().includes(busqueda)
    );
    paginaActualClientes = 1;
    cargarClientes();
}

function filtrarProductos() {
    const busqueda = document.getElementById('buscarProducto').value.toLowerCase();
    productosFiltrados = window.productos.filter(producto => 
        producto.nombre.toLowerCase().includes(busqueda) ||
        producto.categoria.toLowerCase().includes(busqueda) ||
        producto.precio.toString().includes(busqueda)
    );
    paginaActualProductos = 1;
    cargarProductos();
}

// Funciones de paginación
function cambiarPaginaClientes(nuevaPagina) {
    paginaActualClientes = nuevaPagina;
    cargarClientes();
}

function cambiarPaginaProductos(nuevaPagina) {
    paginaActualProductos = nuevaPagina;
    cargarProductos();
}

// Función para generar la paginación
function generarPaginacion(elementoId, totalPaginas, paginaActual, funcionCambio) {
    const paginacion = document.getElementById(elementoId);
    paginacion.innerHTML = '';

    // Botón anterior
    const liAnterior = document.createElement('li');
    liAnterior.className = `page-item ${paginaActual === 1 ? 'disabled' : ''}`;
    liAnterior.innerHTML = `
        <a class="page-link" href="#" onclick="event.preventDefault(); ${funcionCambio.name}(${paginaActual - 1})">Anterior</a>
    `;
    paginacion.appendChild(liAnterior);

    // Números de página
    for (let i = 1; i <= totalPaginas; i++) {
        const li = document.createElement('li');
        li.className = `page-item ${i === paginaActual ? 'active' : ''}`;
        li.innerHTML = `
            <a class="page-link" href="#" onclick="event.preventDefault(); ${funcionCambio.name}(${i})">${i}</a>
        `;
        paginacion.appendChild(li);
    }

    // Botón siguiente
    const liSiguiente = document.createElement('li');
    liSiguiente.className = `page-item ${paginaActual === totalPaginas ? 'disabled' : ''}`;
    liSiguiente.innerHTML = `
        <a class="page-link" href="#" onclick="event.preventDefault(); ${funcionCambio.name}(${paginaActual + 1})">Siguiente</a>
    `;
    paginacion.appendChild(liSiguiente);
}

function abrirWhatsAppFlotante() {
  window.open(
    'https://web.whatsapp.com/',
    'WhatsAppWeb',
    'width=500,height=700,left=200,top=100'
  );
}

function enviarMensajeWhatsApp() {
  const numero = document.getElementById('numeroWhatsapp').value.trim();
  const mensaje = encodeURIComponent(document.getElementById('mensajeWhatsapp').value.trim());
  if (!numero) {
    alert('Por favor ingresa el número de WhatsApp del cliente.');
    return;
  }
  window.open(`https://wa.me/${numero}?text=${mensaje}`, '_blank');
}

// Función para extender el horario
function extenderHorario() {
    if (confirm('¿Desea extender el horario para permitir más clientes?')) {
        const configuracion = JSON.parse(localStorage.getItem('configuracionCierre') || '{}');
        configuracion.horarioExtendido = true;
        localStorage.setItem('configuracionCierre', JSON.stringify(configuracion));
        alert('Horario extendido exitosamente');
    }
}

// Funciones para manejar el logo
function previewLogo(event) {
  const file = event.target.files[0];
  if (!file) return;

  // Validar tipo de archivo
  if (!file.type.match('image.*')) {
    alert('Por favor seleccione una imagen válida');
    return;
  }

  // Validar tamaño (500KB máximo)
  if (file.size > 500 * 1024) {
    alert('La imagen no debe superar los 500KB');
    return;
  }

  const reader = new FileReader();
  reader.onload = function(e) {
    const logoActual = document.getElementById('logoActual');
    const noLogo = document.getElementById('noLogo');
    
    logoActual.src = e.target.result;
    logoActual.style.display = 'block';
    noLogo.style.display = 'none';
    
    // Agregar un mensaje temporal indicando que el logo está listo
    const mensajeTemporal = document.createElement('div');
    mensajeTemporal.className = 'alert alert-success alert-dismissible fade show mt-2';
    mensajeTemporal.innerHTML = `
      <i class="fas fa-check-circle"></i> Logo cargado correctamente. Haz clic en "Guardar Logo" para aplicarlo.
      <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
    `;
    
    const logoPreview = document.getElementById('logoPreview');
    logoPreview.appendChild(mensajeTemporal);
    
    // Auto-remover el mensaje después de 5 segundos
    setTimeout(() => {
      if (mensajeTemporal.parentNode) {
        mensajeTemporal.remove();
      }
    }, 5000);
  };
  reader.readAsDataURL(file);
}

function guardarLogo() {
  const logoActual = document.getElementById('logoActual');
  const noLogo = document.getElementById('noLogo');
  
  if (!logoActual.src || logoActual.src === window.location.href) {
    alert('Por favor seleccione un logo primero');
    return;
  }

  // Guardar el logo en localStorage
  localStorage.setItem('logoNegocio', logoActual.src);
  
  // Asegurar que el logo se muestre correctamente
  logoActual.style.display = 'block';
  noLogo.style.display = 'none';
  
  alert('✅ Logo guardado correctamente. El logo se mostrará en los recibos y facturas.');
}

function eliminarLogo() {
  if (confirm('¿Está seguro de eliminar el logo?')) {
    localStorage.removeItem('logoNegocio');
    const logoActual = document.getElementById('logoActual');
    const noLogo = document.getElementById('noLogo');
    
    logoActual.src = '';
    logoActual.style.display = 'none';
    noLogo.innerHTML = '<span class="text-muted"><i class="fas fa-image"></i> No hay logo cargado</span>';
    noLogo.style.display = 'block';
    
    alert('🗑️ Logo eliminado correctamente. Los recibos y facturas no mostrarán logo.');
  }
}

// Función para cargar el logo al iniciar
function cargarLogo() {
  console.log('🔍 Iniciando carga del logo...');
  const logoGuardado = localStorage.getItem('logoNegocio');
  const logoActual = document.getElementById('logoActual');
  const noLogo = document.getElementById('noLogo');
  
  console.log('📦 Logo guardado en localStorage:', logoGuardado ? 'SÍ' : 'NO');
  console.log('🖼️ Elemento logoActual encontrado:', logoActual ? 'SÍ' : 'NO');
  console.log('📝 Elemento noLogo encontrado:', noLogo ? 'SÍ' : 'NO');
  
  if (logoGuardado) {
    console.log('✅ Cargando logo guardado...');
    logoActual.src = logoGuardado;
    logoActual.style.display = 'block';
    noLogo.style.display = 'none';
    console.log('✅ Logo cargado y mostrado correctamente');
  } else {
    console.log('❌ No hay logo guardado, mostrando mensaje por defecto');
    logoActual.style.display = 'none';
    noLogo.innerHTML = '<span class="text-muted"><i class="fas fa-image"></i> No hay logo cargado</span>';
    noLogo.style.display = 'block';
  }
}

// Función para forzar la recarga del logo (para debug)
function recargarLogo() {
  console.log('🔄 Forzando recarga del logo...');
  cargarLogo();
}

// Función para verificar el estado del logo
function verificarEstadoLogo() {
  const logoGuardado = localStorage.getItem('logoNegocio');
  const logoActual = document.getElementById('logoActual');
  const noLogo = document.getElementById('noLogo');
  
  console.log('=== ESTADO DEL LOGO ===');
  console.log('localStorage logoNegocio:', logoGuardado);
  console.log('logoActual.src:', logoActual ? logoActual.src : 'Elemento no encontrado');
  console.log('logoActual.style.display:', logoActual ? logoActual.style.display : 'Elemento no encontrado');
  console.log('noLogo.style.display:', noLogo ? noLogo.style.display : 'Elemento no encontrado');
  console.log('noLogo.innerHTML:', noLogo ? noLogo.innerHTML : 'Elemento no encontrado');
  console.log('========================');
}

// Función para obtener una ventana de impresión
function obtenerVentanaImpresion() {
    const ventana = window.open('', '_blank');
    if (!ventana) {
        throw new Error('No se pudo abrir la ventana de impresión. Por favor, permite las ventanas emergentes para este sitio.');
    }
    return ventana;
}

// Función para guardar los datos del negocio
function guardarDatosNegocio() {
    const datos = {
        nombre: document.getElementById('nombreNegocio').value,
        nit: document.getElementById('nitNegocio').value,
        direccion: document.getElementById('direccionNegocio').value,
        correo: document.getElementById('correoNegocio').value,
        telefono: document.getElementById('telefonoNegocio').value
    };
    localStorage.setItem('datosNegocio', JSON.stringify(datos));
    alert('Datos del negocio guardados correctamente');
}

// Función para cargar los datos del negocio al iniciar
function cargarDatosNegocio() {
    const datos = JSON.parse(localStorage.getItem('datosNegocio'));
    if (datos) {
        document.getElementById('nombreNegocio').value = datos.nombre || '';
        document.getElementById('nitNegocio').value = datos.nit || '';
        document.getElementById('direccionNegocio').value = datos.direccion || '';
        document.getElementById('correoNegocio').value = datos.correo || '';
        document.getElementById('telefonoNegocio').value = datos.telefono || '';
    }
}

// Función para verificar acceso
function verificarAcceso() {
    // Implementa la lógica para verificar el acceso del usuario
    // Esto puede incluir la validación de credenciales, la verificación de sesión, etc.
    // Si el usuario no tiene acceso, se puede lanzar un error o redirigir a una página de error
    console.log('Verificando acceso...');
}

// ===== FUNCIONES DE EMAILJS =====

// Configuración de EmailJS

const EMAILJS_CONFIG = {
    serviceId: 'service_dxi0ewo',
    templateIdOperativo: 'template_k0k4y3d',
    templateIdAdministrativo: 'template_0wn6bji',
    userId: 'WiR3pfZAjxRHX7lPK'
};

// Inicializar EmailJS
function inicializarEmailJS() {
    try {
        if (typeof emailjs !== 'undefined') {
            emailjs.init(EMAILJS_CONFIG.userId);
            console.log('✅ EmailJS inicializado correctamente');
            actualizarEstadoEmailJS('✅ EmailJS configurado correctamente', 'success');
        } else {
            console.error('❌ EmailJS no está disponible');
            actualizarEstadoEmailJS('❌ EmailJS no está disponible', 'error');
        }
    } catch (error) {
        console.error('Error al inicializar EmailJS:', error);
        actualizarEstadoEmailJS('❌ Error al inicializar EmailJS', 'error');
    }
}

// Función para guardar configuración de EmailJS
function guardarConfiguracionEmailJS() {
    try {
        const emailDestino = document.getElementById('emailDestino').value.trim();
        const nombreDestinatario = document.getElementById('nombreDestinatario').value.trim();
        const enviarCierresOperativos = document.getElementById('enviarCierresOperativos').checked;
        const enviarCierresAdministrativos = document.getElementById('enviarCierresAdministrativos').checked;
        const asuntoPersonalizado = document.getElementById('asuntoPersonalizado').value.trim();

        if (!emailDestino) {
            alert('Por favor ingresa un email de destino');
            return;
        }

        const configuracion = {
            emailDestino: emailDestino,
            nombreDestinatario: nombreDestinatario,
            enviarCierresOperativos: enviarCierresOperativos,
            enviarCierresAdministrativos: enviarCierresAdministrativos,
            asuntoPersonalizado: asuntoPersonalizado,
            fechaConfiguracion: new Date().toISOString()
        };

        localStorage.setItem('configuracionEmailJS', JSON.stringify(configuracion));
        alert('✅ Configuración de EmailJS guardada correctamente');
        
        actualizarEstadoEmailJS('✅ Configuración guardada', 'success');
        cargarConfiguracionEmailJS();
        
    } catch (error) {
        console.error('Error al guardar configuración EmailJS:', error);
        alert('❌ Error al guardar la configuración: ' + error.message);
    }
}

// Función para cargar configuración de EmailJS
function cargarConfiguracionEmailJS() {
    try {
        const configuracion = JSON.parse(localStorage.getItem('configuracionEmailJS'));
        if (configuracion) {
            document.getElementById('emailDestino').value = configuracion.emailDestino || '';
            document.getElementById('nombreDestinatario').value = configuracion.nombreDestinatario || '';
            document.getElementById('enviarCierresOperativos').checked = configuracion.enviarCierresOperativos !== false;
            document.getElementById('enviarCierresAdministrativos').checked = configuracion.enviarCierresAdministrativos !== false;
            document.getElementById('asuntoPersonalizado').value = configuracion.asuntoPersonalizado || '';
        }
    } catch (error) {
        console.error('Error al cargar configuración EmailJS:', error);
    }
}

// Función para probar envío de email
function probarEnvioEmail() {
    try {
        const configuracion = JSON.parse(localStorage.getItem('configuracionEmailJS'));
        if (!configuracion || !configuracion.emailDestino) {
            alert('❌ Primero debes configurar el email de destino');
            return;
        }

        const datosPrueba = {
            tipo: 'prueba',
            fecha: new Date().toLocaleString(),
            negocio: 'ToySoft IMG Version',
            mensaje: 'Este es un email de prueba para verificar que la configuración de EmailJS funciona correctamente.'
        };

        enviarEmailPrueba(configuracion.emailDestino, configuracion.nombreDestinatario, datosPrueba);
        
    } catch (error) {
        console.error('Error al probar envío de email:', error);
        alert('❌ Error al probar envío: ' + error.message);
    }
}

// Función para enviar email de prueba
function enviarEmailPrueba(emailDestino, nombreDestinatario, datos) {
    try {
        const templateParams = {
            to_email: emailDestino,
            to_name: nombreDestinatario || 'Usuario',
            from_name: 'ToySoft IMG Version',
            message: datos.mensaje,
            fecha: datos.fecha,
            tipo: 'Prueba de Configuración'
        };

        emailjs.send(EMAILJS_CONFIG.serviceId, EMAILJS_CONFIG.templateIdOperativo, templateParams)
            .then(function(response) {
                console.log('✅ Email de prueba enviado:', response);
                alert('✅ Email de prueba enviado correctamente');
                agregarLogEmail('Email de prueba enviado', 'success');
            }, function(error) {
                console.error('❌ Error al enviar email de prueba:', error);
                alert('❌ Error al enviar email de prueba: ' + error.text);
                agregarLogEmail('Error al enviar email de prueba: ' + error.text, 'error');
            });
            
    } catch (error) {
        console.error('Error en enviarEmailPrueba:', error);
        alert('❌ Error al enviar email de prueba: ' + error.message);
    }
}

// Función para enviar cierre operativo por email
function enviarCierreOperativoEmail(cierre) {
    try {
        const configuracion = JSON.parse(localStorage.getItem('configuracionEmailJS'));
        if (!configuracion || !configuracion.enviarCierresOperativos) {
            console.log('Envío de cierres operativos deshabilitado');
            return;
        }

        const asunto = configuracion.asuntoPersonalizado 
            ? configuracion.asuntoPersonalizado.replace('{fecha}', new Date(cierre.fecha).toLocaleDateString())
            : `Cierre Operativo - ${new Date(cierre.fecha).toLocaleDateString()}`;

        const templateParams = {
            to_email: configuracion.emailDestino,
            to_name: configuracion.nombreDestinatario || 'Usuario',
            from_name: 'ToySoft IMG Version',
            asunto: asunto,
            tipo_cierre: 'Operativo',
            fecha: new Date(cierre.fecha).toLocaleString(),
            empleado_nombre: cierre.empleado?.nombre || 'N/A',
            empleado_cargo: cierre.empleado?.cargo || 'N/A',
            horario: `${cierre.empleado?.horaInicio || 'N/A'} - ${cierre.empleado?.horaFin || 'N/A'}`,
            checklist_completado: Object.values(cierre.checklist).filter(item => item).length,
            checklist_total: Object.keys(cierre.checklist).length,
            totales: cierre.totales ? `$${cierre.totales.general.toLocaleString()}` : 'No registrado',
            entrega_turno: cierre.entregaTurno?.nombreRecibe || 'No especificado',
            base_caja: cierre.entregaTurno ? `$${cierre.entregaTurno.baseCajaDeja.toLocaleString()}` : 'No especificado',
            observaciones: cierre.observaciones || 'Sin observaciones',
            tareas_pendientes: cierre.tareasPendientes || 'Sin tareas pendientes'
        };

        emailjs.send(EMAILJS_CONFIG.serviceId, EMAILJS_CONFIG.templateIdOperativo, templateParams)
            .then(function(response) {
                console.log('✅ Cierre operativo enviado por email:', response);
                agregarLogEmail(`Cierre operativo enviado a ${configuracion.emailDestino}`, 'success');
            }, function(error) {
                console.error('❌ Error al enviar cierre operativo:', error);
                agregarLogEmail(`Error al enviar cierre operativo: ${error.text}`, 'error');
            });
            
    } catch (error) {
        console.error('Error en enviarCierreOperativoEmail:', error);
        agregarLogEmail(`Error al enviar cierre operativo: ${error.message}`, 'error');
    }
}

// Función para enviar cierre administrativo por email
function enviarCierreAdministrativoEmail(cierre) {
    try {
        const configuracion = JSON.parse(localStorage.getItem('configuracionEmailJS'));
        if (!configuracion || !configuracion.enviarCierresAdministrativos) {
            console.log('Envío de cierres administrativos deshabilitado');
            return;
        }

        const asunto = configuracion.asuntoPersonalizado 
            ? configuracion.asuntoPersonalizado.replace('{fecha}', new Date(cierre.fecha).toLocaleDateString())
            : `Cierre Administrativo - ${new Date(cierre.fecha).toLocaleDateString()}`;

        const templateParams = {
            to_email: configuracion.emailDestino,
            to_name: configuracion.nombreDestinatario || 'Usuario',
            from_name: 'ToySoft IMG Version',
            asunto: asunto,
            tipo_cierre: 'Administrativo',
            fecha: new Date(cierre.fecha).toLocaleString(),
            nombre_cierre: cierre.nombreCierre || 'N/A',
            nombre_recibe: cierre.nombreRecibe || 'N/A',
            base_caja: `$${(cierre.montoBaseCaja || 0).toLocaleString()}`,
            total_ventas: `$${(cierre.ventas?.total || 0).toLocaleString()}`,
            efectivo: `$${(cierre.ventas?.efectivo || 0).toLocaleString()}`,
            transferencia: `$${(cierre.ventas?.transferencia || 0).toLocaleString()}`,
            tarjeta: `$${(cierre.ventas?.tarjeta || 0).toLocaleString()}`,
            gastos: `$${(cierre.gastos || 0).toLocaleString()}`,
            balance: `$${(cierre.balance || 0).toLocaleString()}`,
            detalles: cierre.detalles || 'Sin detalles adicionales'
        };

        emailjs.send(EMAILJS_CONFIG.serviceId, EMAILJS_CONFIG.templateIdAdministrativo, templateParams)
            .then(function(response) {
                console.log('✅ Cierre administrativo enviado por email:', response);
                agregarLogEmail(`Cierre administrativo enviado a ${configuracion.emailDestino}`, 'success');
            }, function(error) {
                console.error('❌ Error al enviar cierre administrativo:', error);
                agregarLogEmail(`Error al enviar cierre administrativo: ${error.text}`, 'error');
            });
            
    } catch (error) {
        console.error('Error en enviarCierreAdministrativoEmail:', error);
        agregarLogEmail(`Error al enviar cierre administrativo: ${error.message}`, 'error');
    }
}

// Función para agregar log de email
function agregarLogEmail(mensaje, tipo = 'info') {
    try {
        const logs = JSON.parse(localStorage.getItem('logsEmails')) || [];
        const log = {
            fecha: new Date().toISOString(),
            mensaje: mensaje,
            tipo: tipo
        };
        
        logs.unshift(log);
        if (logs.length > 50) { // Mantener solo los últimos 50 logs
            logs.pop();
        }
        
        localStorage.setItem('logsEmails', JSON.stringify(logs));
        actualizarHistorialEmails();
        
    } catch (error) {
        console.error('Error al agregar log de email:', error);
    }
}

// Función para actualizar historial de emails
function actualizarHistorialEmails() {
    try {
        const historialContainer = document.getElementById('historialEmails');
        if (!historialContainer) return;

        const logs = JSON.parse(localStorage.getItem('logsEmails')) || [];
        
        if (logs.length === 0) {
            historialContainer.innerHTML = '<small class="text-muted">No hay emails enviados aún</small>';
            return;
        }

        let html = '';
        logs.slice(0, 10).forEach(log => { // Mostrar solo los últimos 10
            const fecha = new Date(log.fecha).toLocaleString();
            const color = log.tipo === 'error' ? 'text-danger' : log.tipo === 'success' ? 'text-success' : 'text-muted';
            html += `<div class="${color}"><small>[${fecha}] ${log.mensaje}</small></div>`;
        });

        historialContainer.innerHTML = html;
        
    } catch (error) {
        console.error('Error al actualizar historial de emails:', error);
    }
}

// Función para limpiar historial de emails
function limpiarHistorialEmails() {
    try {
        if (confirm('¿Estás seguro de que quieres limpiar el historial de emails?')) {
            localStorage.removeItem('logsEmails');
            actualizarHistorialEmails();
            alert('✅ Historial de emails limpiado');
        }
    } catch (error) {
        console.error('Error al limpiar historial de emails:', error);
    }
}

// Función para actualizar estado de EmailJS
function actualizarEstadoEmailJS(mensaje, tipo = 'info') {
    try {
        const estadoIcono = document.getElementById('estadoIcono');
        const estadoTexto = document.getElementById('estadoTexto');
        
        if (estadoIcono && estadoTexto) {
            const iconos = {
                'success': '✅',
                'error': '❌',
                'warning': '⚠️',
                'info': '⏳'
            };
            
            estadoIcono.textContent = iconos[tipo] || '⏳';
            estadoTexto.textContent = mensaje;
        }
    } catch (error) {
        console.error('Error al actualizar estado de EmailJS:', error);
    }
}

// Inicializar EmailJS cuando se carga la página
document.addEventListener('DOMContentLoaded', function() {
    setTimeout(() => {
        inicializarEmailJS();
        cargarConfiguracionEmailJS();
        actualizarHistorialEmails();
    }, 1000);
}); 