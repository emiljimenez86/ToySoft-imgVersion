// Variables globales
let inventario = [];
let productoSeleccionado = null;

// Función para cargar el inventario
function cargarInventario() {
    try {
        // Solo ejecutar si estamos en la página de inventario
        const tablaInventario = document.getElementById('tablaInventario');
        if (!tablaInventario) {
            // No estamos en la página de inventario, solo cargar los datos en memoria
            const inventarioGuardado = localStorage.getItem('inventario');
            if (inventarioGuardado) {
                inventario = JSON.parse(inventarioGuardado);
                // Normalizar productos antiguos: agregar tipo 'producto' si no existe
                let necesitaGuardar = false;
                inventario.forEach(producto => {
                    if (!producto.tipo) {
                        producto.tipo = 'producto';
                        necesitaGuardar = true;
                    }
                });
                if (necesitaGuardar) {
                    guardarInventario();
                }
            }
            return;
        }
        
        const inventarioGuardado = localStorage.getItem('inventario');
        if (inventarioGuardado) {
            inventario = JSON.parse(inventarioGuardado);
            // Normalizar productos antiguos: agregar tipo 'producto' si no existe
            let necesitaGuardar = false;
            inventario.forEach(producto => {
                if (!producto.tipo) {
                    producto.tipo = 'producto';
                    necesitaGuardar = true;
                }
            });
            if (necesitaGuardar) {
                guardarInventario();
            }
        }
        mostrarInventario();
        cargarCategorias();
        cargarProductosPOS();
        configurarFiltrosEnTiempoReal();
    } catch (error) {
        console.error('Error al cargar el inventario:', error);
        // Solo mostrar alerta si estamos en la página de inventario
        const tablaInventario = document.getElementById('tablaInventario');
        if (tablaInventario) {
            alert('Error al cargar el inventario');
        }
    }
}

// Función para guardar el inventario
function guardarInventario() {
    try {
        localStorage.setItem('inventario', JSON.stringify(inventario));
    } catch (error) {
        console.error('Error al guardar el inventario:', error);
        alert('Error al guardar el inventario');
    }
}

// Función para mostrar el inventario
function mostrarInventario() {
    const tabla = document.getElementById('tablaInventario');
    if (!tabla) {
        return; // No estamos en la página de inventario
    }
    
    tabla.innerHTML = '';

    // Separar productos principales y componentes
    const productosPrincipales = inventario.filter(p => !p.tipo || p.tipo === 'producto');
    const componentes = inventario.filter(p => p.tipo === 'componente');
    
    // Mostrar productos principales primero
    productosPrincipales.forEach(producto => {
        const estado = calcularEstadoStock(producto);
        const fila = document.createElement('tr');
        fila.innerHTML = `
            <td>${producto.codigo}</td>
            <td>${producto.nombre}</td>
            <td>${producto.categoria}</td>
            <td>${producto.stockActual} ${producto.unidadMedida}</td>
            <td>${producto.stockMinimo} ${producto.unidadMedida}</td>
            <td>${producto.stockMaximo} ${producto.unidadMedida}</td>
            <td>
                <span class="badge ${getEstadoClass(estado)}">${estado}</span>
            </td>
            <td>${new Date(producto.ultimaActualizacion).toLocaleString()}</td>
            <td>
                <button class="btn btn-sm btn-warning" onclick="editarProducto('${producto.codigo}')">
                    <i class="fas fa-edit"></i>
                </button>
                <button class="btn btn-sm btn-info" onclick="ajustarStock('${producto.codigo}')">
                    <i class="fas fa-boxes"></i>
                </button>
                <button class="btn btn-sm btn-danger" onclick="eliminarProducto('${producto.codigo}')">
                    <i class="fas fa-trash"></i>
                </button>
            </td>
        `;
        tabla.appendChild(fila);
    });
    
    // Mostrar componentes después (con color diferente)
    componentes.forEach(producto => {
        const estado = calcularEstadoStock(producto);
        const fila = document.createElement('tr');
        fila.className = 'table-secondary'; // Color gris para componentes
        fila.innerHTML = `
            <td>${producto.codigo}</td>
            <td>
                ${producto.nombre}
                ${producto.productoPrincipal ? `<br><small class="text-muted">Componente de: ${producto.productoPrincipal}</small>` : ''}
            </td>
            <td>${producto.categoria}</td>
            <td>${producto.stockActual} ${producto.unidadMedida}</td>
            <td>${producto.stockMinimo} ${producto.unidadMedida}</td>
            <td>${producto.stockMaximo} ${producto.unidadMedida}</td>
            <td>
                <span class="badge bg-secondary">Componente</span>
                <span class="badge ${getEstadoClass(estado)} ms-1">${estado}</span>
            </td>
            <td>${new Date(producto.ultimaActualizacion).toLocaleString()}</td>
            <td>
                <button class="btn btn-sm btn-warning" onclick="editarProducto('${producto.codigo}')">
                    <i class="fas fa-edit"></i>
                </button>
                <button class="btn btn-sm btn-info" onclick="ajustarStock('${producto.codigo}')">
                    <i class="fas fa-boxes"></i>
                </button>
                <button class="btn btn-sm btn-danger" onclick="eliminarProducto('${producto.codigo}')">
                    <i class="fas fa-trash"></i>
                </button>
            </td>
        `;
        tabla.appendChild(fila);
    });
}

// Función para calcular el estado del stock
function calcularEstadoStock(producto) {
    const porcentaje = (producto.stockActual / producto.stockMaximo) * 100;
    if (producto.stockActual <= producto.stockMinimo) {
        return 'Bajo';
    } else if (porcentaje >= 80) {
        return 'Alto';
    } else {
        return 'Normal';
    }
}

// Función para obtener la clase CSS del estado
function getEstadoClass(estado) {
    switch (estado.toLowerCase()) {
        case 'bajo':
            return 'bg-danger';
        case 'alto':
            return 'bg-success';
        default:
            return 'bg-warning';
    }
}

// Función para cargar las categorías
function cargarCategorias() {
    const categorias = JSON.parse(localStorage.getItem('categorias')) || [];
    const selectCategoria = document.getElementById('categoriaProducto');
    const selectFiltroCategoria = document.getElementById('filtroCategoria');
    
    // Solo ejecutar si estamos en la página de inventario
    if (!selectCategoria || !selectFiltroCategoria) {
        return;
    }
    
    // Limpiar opciones existentes
    selectCategoria.innerHTML = '<option value="">Seleccione una categoría</option>';
    selectFiltroCategoria.innerHTML = '<option value="">Todas las categorías</option>';
    
    // Agregar categorías
    categorias.forEach(categoria => {
        selectCategoria.innerHTML += `<option value="${categoria}">${categoria}</option>`;
        selectFiltroCategoria.innerHTML += `<option value="${categoria}">${categoria}</option>`;
    });
}

// Función para mostrar el modal de producto
function mostrarModalProducto(codigo = null, soloComponente = false) {
    const modal = new bootstrap.Modal(document.getElementById('modalProducto'));
    const form = document.getElementById('formProducto');
    const modalTitle = document.getElementById('modalProductoTitle');
    const tipoProductoContainer = document.getElementById('tipoProductoContainer');
    
    // Limpiar formulario
    form.reset();
    
    if (codigo) {
        // Modo edición
        modalTitle.textContent = 'Editar Ingrediente / Insumo';
        productoSeleccionado = inventario.find(p => p.codigo === codigo);
        if (productoSeleccionado) {
            document.getElementById('codigoProducto').value = productoSeleccionado.codigo;
            document.getElementById('nombreProducto').value = productoSeleccionado.nombre;
            document.getElementById('categoriaProducto').value = productoSeleccionado.categoria;
            document.getElementById('stockActual').value = productoSeleccionado.stockActual;
            document.getElementById('stockMinimo').value = productoSeleccionado.stockMinimo;
            document.getElementById('stockMaximo').value = productoSeleccionado.stockMaximo;
            document.getElementById('unidadMedida').value = productoSeleccionado.unidadMedida;
            
            // Cargar tipo (por defecto 'producto' si no existe)
            const tipo = productoSeleccionado.tipo || 'producto';
            document.getElementById('tipoProducto').value = tipo;
            
            // En modo edición, siempre mostrar el selector de tipo para permitir cambios
            tipoProductoContainer.style.display = 'block';
            
            // Cargar producto principal si es componente
            if (tipo === 'componente' && productoSeleccionado.productoPrincipal) {
                cargarProductosPOSEnSelector();
                document.getElementById('productoPrincipal').value = productoSeleccionado.productoPrincipal;
            }
            
            // Mostrar/ocultar campos según tipo
            toggleCamposComponente();
            
            // Cargar cantidad por unidad si existe
            const cantidadPorUnidad = productoSeleccionado.cantidadPorUnidad || 1;
            document.getElementById('cantidadPorUnidad').value = cantidadPorUnidad;
            
            // Mostrar/ocultar campo según unidad de medida
            toggleCantidadPorUnidad();
        }
    } else {
        // Modo nuevo
        if (soloComponente) {
            // Modo solo componente (desde botón +Ingrediente/Insumo)
            modalTitle.textContent = 'Nuevo Componente / Materia Prima';
            productoSeleccionado = null;
            document.getElementById('codigoProducto').value = generarCodigo();
            document.getElementById('tipoProducto').value = 'componente'; // Forzar a componente
            tipoProductoContainer.style.display = 'none'; // Ocultar selector de tipo
            document.getElementById('cantidadPorUnidad').value = '';
            // Cargar productos del POS para el selector
            cargarProductosPOSEnSelector();
            toggleCamposComponente(); // Esto mostrará el selector de producto principal
            toggleCantidadPorUnidad();
        } else {
            // Modo nuevo normal (desde otro lugar, si existe)
            modalTitle.textContent = 'Nuevo Ingrediente / Insumo';
            productoSeleccionado = null;
            document.getElementById('codigoProducto').value = generarCodigo();
            document.getElementById('tipoProducto').value = 'producto'; // Por defecto producto principal
            tipoProductoContainer.style.display = 'block'; // Mostrar selector de tipo
            document.getElementById('cantidadPorUnidad').value = '';
            toggleCamposComponente();
            toggleCantidadPorUnidad();
        }
    }
    
    modal.show();
}

// Función para mostrar/ocultar el campo de cantidad por unidad
function toggleCantidadPorUnidad() {
    const unidadMedida = document.getElementById('unidadMedida').value;
    const container = document.getElementById('cantidadPorUnidadContainer');
    const label = document.getElementById('unidadMedidaLabel');
    const input = document.getElementById('cantidadPorUnidad');
    
    if (unidadMedida !== 'unidad') {
        container.style.display = 'block';
        // Mostrar la unidad de medida en el label
        const unidades = {
            'g': 'gramos',
            'kg': 'kilogramos',
            'l': 'litros',
            'ml': 'mililitros'
        };
        label.textContent = `(${unidades[unidadMedida]})`;
        input.required = true;
    } else {
        container.style.display = 'none';
        input.required = false;
        input.value = '';
    }
}

// Función para mostrar/ocultar campos de componente
function toggleCamposComponente() {
    const tipoProducto = document.getElementById('tipoProducto').value;
    const productoPrincipalContainer = document.getElementById('productoPrincipalContainer');
    const productoPrincipalSelect = document.getElementById('productoPrincipal');
    
    if (tipoProducto === 'componente') {
        productoPrincipalContainer.style.display = 'block';
        productoPrincipalSelect.required = true;
        // Cargar productos del POS en el selector
        cargarProductosPOSEnSelector();
    } else {
        productoPrincipalContainer.style.display = 'none';
        productoPrincipalSelect.required = false;
        productoPrincipalSelect.value = '';
    }
}

// Función para cargar productos del POS en el selector
function cargarProductosPOSEnSelector() {
    const productosPOS = JSON.parse(localStorage.getItem('productos') || '[]');
    const selector = document.getElementById('productoPrincipal');
    
    // Limpiar opciones existentes (excepto la primera)
    selector.innerHTML = '<option value="">Seleccione un producto</option>';
    
    // Agrupar por categoría
    const productosPorCategoria = {};
    productosPOS.forEach(producto => {
        const categoria = producto.categoria || 'Sin categoría';
        if (!productosPorCategoria[categoria]) {
            productosPorCategoria[categoria] = [];
        }
        productosPorCategoria[categoria].push(producto);
    });
    
    // Agregar productos agrupados por categoría
    Object.keys(productosPorCategoria).sort().forEach(categoria => {
        const optgroup = document.createElement('optgroup');
        optgroup.label = categoria;
        productosPorCategoria[categoria].forEach(producto => {
            const option = document.createElement('option');
            option.value = producto.nombre;
            option.textContent = producto.nombre;
            optgroup.appendChild(option);
        });
        selector.appendChild(optgroup);
    });
}

// Función para cargar categoría desde producto seleccionado
function cargarCategoriaDesdeProducto() {
    const productoPrincipal = document.getElementById('productoPrincipal').value;
    if (!productoPrincipal) return;
    
    const productosPOS = JSON.parse(localStorage.getItem('productos') || '[]');
    const producto = productosPOS.find(p => p.nombre === productoPrincipal);
    
    if (producto && producto.categoria) {
        document.getElementById('categoriaProducto').value = producto.categoria;
    }
}

// Función para generar código único
function generarCodigo() {
    const timestamp = Date.now().toString();
    const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
    return `PROD-${timestamp}-${random}`;
}

// Función para guardar producto
function guardarProducto() {
    const form = document.getElementById('formProducto');
    const tipoProducto = document.getElementById('tipoProducto').value;
    const productoPrincipal = document.getElementById('productoPrincipal').value;
    
    // Validar que si es componente, tenga producto principal
    if (tipoProducto === 'componente' && !productoPrincipal) {
        alert('Por favor, seleccione el producto principal al que pertenece este componente.');
        document.getElementById('productoPrincipal').focus();
        return;
    }
    
    if (!form.checkValidity()) {
        form.reportValidity();
        return;
    }

    const unidadMedida = document.getElementById('unidadMedida').value;
    const cantidadPorUnidadInput = document.getElementById('cantidadPorUnidad');
    
    const producto = {
        codigo: document.getElementById('codigoProducto').value,
        nombre: document.getElementById('nombreProducto').value,
        categoria: document.getElementById('categoriaProducto').value,
        tipo: tipoProducto, // 'producto' o 'componente'
        productoPrincipal: tipoProducto === 'componente' ? productoPrincipal : null, // Nombre del producto principal si es componente
        stockActual: parseFloat(document.getElementById('stockActual').value),
        stockMinimo: parseFloat(document.getElementById('stockMinimo').value),
        stockMaximo: parseFloat(document.getElementById('stockMaximo').value),
        unidadMedida: unidadMedida,
        cantidadPorUnidad: unidadMedida !== 'unidad' && cantidadPorUnidadInput.value 
            ? parseFloat(cantidadPorUnidadInput.value) || 1 
            : 1, // Por defecto 1 si es unidad o no se especifica
        ultimaActualizacion: new Date().toISOString()
    };

    if (productoSeleccionado) {
        // Actualizar producto existente
        const index = inventario.findIndex(p => p.codigo === producto.codigo);
        if (index !== -1) {
            inventario[index] = producto;
        }
    } else {
        // Agregar nuevo producto
        inventario.push(producto);
    }

    guardarInventario();
    mostrarInventario();
    cargarProductosPOS(); // Actualizar vista de productos del POS
    bootstrap.Modal.getInstance(document.getElementById('modalProducto')).hide();
}

// Función para editar producto
function editarProducto(codigo) {
    mostrarModalProducto(codigo);
}

// Función para eliminar producto
function eliminarProducto(codigo) {
    if (confirm('¿Está seguro que desea eliminar este producto?')) {
        inventario = inventario.filter(p => p.codigo !== codigo);
        guardarInventario();
        mostrarInventario();
        cargarProductosPOS(); // Actualizar vista de productos del POS
    }
}

// Función para ajustar stock
function ajustarStock(codigo) {
    productoSeleccionado = inventario.find(p => p.codigo === codigo);
    if (productoSeleccionado) {
        const modal = new bootstrap.Modal(document.getElementById('modalAjusteStock'));
        document.getElementById('formAjusteStock').reset();
        modal.show();
    }
}

// Función para procesar ajuste de stock
function procesarAjusteStock() {
    const form = document.getElementById('formAjusteStock');
    if (!form.checkValidity()) {
        form.reportValidity();
        return;
    }

    const tipoAjuste = document.getElementById('tipoAjuste').value;
    const cantidad = parseFloat(document.getElementById('cantidadAjuste').value);
    const motivo = document.getElementById('motivoAjuste').value;

    if (productoSeleccionado) {
        const index = inventario.findIndex(p => p.codigo === productoSeleccionado.codigo);
        if (index !== -1) {
            // Actualizar stock
            if (tipoAjuste === 'entrada') {
                inventario[index].stockActual += cantidad;
            } else {
                if (inventario[index].stockActual < cantidad) {
                    alert('No hay suficiente stock disponible');
                    return;
                }
                inventario[index].stockActual -= cantidad;
            }

            // Registrar el ajuste
            const ajuste = {
                fecha: new Date().toISOString(),
                tipo: tipoAjuste,
                cantidad: cantidad,
                motivo: motivo,
                stockAnterior: productoSeleccionado.stockActual,
                stockNuevo: inventario[index].stockActual
            };

            if (!inventario[index].ajustes) {
                inventario[index].ajustes = [];
            }
            inventario[index].ajustes.push(ajuste);
            inventario[index].ultimaActualizacion = new Date().toISOString();

            guardarInventario();
            mostrarInventario();
            bootstrap.Modal.getInstance(document.getElementById('modalAjusteStock')).hide();
        }
    }
}

// Función para aplicar filtros
function aplicarFiltros() {
    const busqueda = document.getElementById('buscarProducto').value.toLowerCase();
    const categoria = document.getElementById('filtroCategoria').value;
    const estado = document.getElementById('filtroEstado').value;
    const filtroTipo = document.getElementById('filtroTipo');
    const tipo = filtroTipo ? filtroTipo.value : '';

    const productosFiltrados = inventario.filter(producto => {
        const coincideBusqueda = producto.nombre.toLowerCase().includes(busqueda) ||
                                producto.codigo.toLowerCase().includes(busqueda);
        const coincideCategoria = !categoria || producto.categoria === categoria;
        const coincideEstado = !estado || calcularEstadoStock(producto).toLowerCase() === estado.toLowerCase();
        const coincideTipo = !tipo || (tipo === 'producto' && (!producto.tipo || producto.tipo === 'producto')) ||
                             (tipo === 'componente' && producto.tipo === 'componente');

        return coincideBusqueda && coincideCategoria && coincideEstado && coincideTipo;
    });

    mostrarInventarioFiltrado(productosFiltrados);
}

// Función para mostrar inventario filtrado
function mostrarInventarioFiltrado(productos) {
    const tabla = document.getElementById('tablaInventario');
    tabla.innerHTML = '';

    // Separar productos principales y componentes
    const productosPrincipales = productos.filter(p => !p.tipo || p.tipo === 'producto');
    const componentes = productos.filter(p => p.tipo === 'componente');
    
    // Mostrar productos principales primero
    productosPrincipales.forEach(producto => {
        const estado = calcularEstadoStock(producto);
        const fila = document.createElement('tr');
        fila.innerHTML = `
            <td>${producto.codigo}</td>
            <td>${producto.nombre}</td>
            <td>${producto.categoria}</td>
            <td>${producto.stockActual} ${producto.unidadMedida}</td>
            <td>${producto.stockMinimo} ${producto.unidadMedida}</td>
            <td>${producto.stockMaximo} ${producto.unidadMedida}</td>
            <td>
                <span class="badge ${getEstadoClass(estado)}">${estado}</span>
            </td>
            <td>${new Date(producto.ultimaActualizacion).toLocaleString()}</td>
            <td>
                <button class="btn btn-sm btn-warning" onclick="editarProducto('${producto.codigo}')">
                    <i class="fas fa-edit"></i>
                </button>
                <button class="btn btn-sm btn-info" onclick="ajustarStock('${producto.codigo}')">
                    <i class="fas fa-boxes"></i>
                </button>
                <button class="btn btn-sm btn-danger" onclick="eliminarProducto('${producto.codigo}')">
                    <i class="fas fa-trash"></i>
                </button>
            </td>
        `;
        tabla.appendChild(fila);
    });
    
    // Mostrar componentes después (con color diferente)
    componentes.forEach(producto => {
        const estado = calcularEstadoStock(producto);
        const fila = document.createElement('tr');
        fila.className = 'table-secondary'; // Color gris para componentes
        fila.innerHTML = `
            <td>${producto.codigo}</td>
            <td>
                ${producto.nombre}
                ${producto.productoPrincipal ? `<br><small class="text-muted">Componente de: ${producto.productoPrincipal}</small>` : ''}
            </td>
            <td>${producto.categoria}</td>
            <td>${producto.stockActual} ${producto.unidadMedida}</td>
            <td>${producto.stockMinimo} ${producto.unidadMedida}</td>
            <td>${producto.stockMaximo} ${producto.unidadMedida}</td>
            <td>
                <span class="badge bg-secondary">Componente</span>
                <span class="badge ${getEstadoClass(estado)} ms-1">${estado}</span>
            </td>
            <td>${new Date(producto.ultimaActualizacion).toLocaleString()}</td>
            <td>
                <button class="btn btn-sm btn-warning" onclick="editarProducto('${producto.codigo}')">
                    <i class="fas fa-edit"></i>
                </button>
                <button class="btn btn-sm btn-info" onclick="ajustarStock('${producto.codigo}')">
                    <i class="fas fa-boxes"></i>
                </button>
                <button class="btn btn-sm btn-danger" onclick="eliminarProducto('${producto.codigo}')">
                    <i class="fas fa-trash"></i>
                </button>
            </td>
        `;
        tabla.appendChild(fila);
    });
}

// Función para exportar a Excel
function exportarInventarioExcel() {
    try {
        const wb = XLSX.utils.book_new();
        
        // Preparar datos para exportar
        const datos = inventario.map(producto => ({
            'Código': producto.codigo,
            'Nombre': producto.nombre,
            'Categoría': producto.categoria,
            'Stock Actual': `${producto.stockActual} ${producto.unidadMedida}`,
            'Stock Mínimo': `${producto.stockMinimo} ${producto.unidadMedida}`,
            'Stock Máximo': `${producto.stockMaximo} ${producto.unidadMedida}`,
            'Estado': calcularEstadoStock(producto),
            'Última Actualización': new Date(producto.ultimaActualizacion).toLocaleString()
        }));

        // Crear hoja de cálculo
        const ws = XLSX.utils.json_to_sheet(datos);

        // Ajustar anchos de columna
        const anchos = [
            { wch: 15 }, // Código
            { wch: 30 }, // Nombre
            { wch: 20 }, // Categoría
            { wch: 15 }, // Stock Actual
            { wch: 15 }, // Stock Mínimo
            { wch: 15 }, // Stock Máximo
            { wch: 10 }, // Estado
            { wch: 20 }  // Última Actualización
        ];
        ws['!cols'] = anchos;

        // Agregar hoja al libro
        XLSX.utils.book_append_sheet(wb, ws, 'Inventario');

        // Generar archivo
        const fecha = new Date().toISOString().split('T')[0];
        XLSX.writeFile(wb, `Inventario_${fecha}.xlsx`);
        
        alert('Archivo Excel generado exitosamente');
    } catch (error) {
        console.error('Error al exportar a Excel:', error);
        alert('Error al generar el archivo Excel');
    }
}

// ========================================
// FUNCIONES DE INTEGRACIÓN CON EL POS
// ========================================

// Función para actualizar inventario desde una venta del POS
function actualizarInventarioDesdeVenta(itemsVenta) {
    try {
        console.log('Actualizando inventario desde venta:', itemsVenta);
        
        // Cargar inventario actual
        const inventarioGuardado = localStorage.getItem('inventario');
        if (!inventarioGuardado) {
            console.warn('No hay inventario configurado');
            return { success: false, message: 'No hay inventario configurado' };
        }
        
        let inventario = JSON.parse(inventarioGuardado);
        const productosNoEncontrados = [];
        const productosActualizados = [];
        
        // Procesar cada item de la venta
        itemsVenta.forEach(itemVenta => {
            // Buscar el producto en el inventario por nombre
            const nombreBuscado = itemVenta.nombre.toLowerCase().trim();
            const productoInventario = inventario.find(p => 
                p.nombre.toLowerCase().trim() === nombreBuscado
            );
            
            console.log(`Buscando producto: "${itemVenta.nombre}" (normalizado: "${nombreBuscado}")`);
            console.log(`Productos en inventario:`, inventario.map(p => p.nombre));
            
            if (productoInventario) {
                console.log(`✅ Producto encontrado: ${productoInventario.nombre}`);
                
                // Calcular cantidad a descontar
                let cantidadADescontar = itemVenta.cantidad;
                
                // Si la unidad de medida no es "unidad", usar el factor de conversión
                if (productoInventario.unidadMedida !== 'unidad' && productoInventario.cantidadPorUnidad) {
                    cantidadADescontar = itemVenta.cantidad * productoInventario.cantidadPorUnidad;
                    console.log(`   Unidad: ${productoInventario.unidadMedida}, Factor: ${productoInventario.cantidadPorUnidad}`);
                    console.log(`   Cantidad vendida: ${itemVenta.cantidad} unidades → Descuento: ${cantidadADescontar} ${productoInventario.unidadMedida}`);
                }
                
                // Actualizar stock
                const stockAnterior = productoInventario.stockActual;
                productoInventario.stockActual = Math.max(0, productoInventario.stockActual - cantidadADescontar);
                productoInventario.ultimaActualizacion = new Date().toISOString();
                
                // Registrar el ajuste automático
                const ajuste = {
                    fecha: new Date().toISOString(),
                    tipo: 'salida',
                    cantidad: cantidadADescontar,
                    cantidadUnidades: itemVenta.cantidad, // Cantidad de unidades vendidas
                    motivo: `Venta automática - ${itemVenta.nombre}`,
                    stockAnterior: stockAnterior,
                    stockNuevo: productoInventario.stockActual,
                    ventaId: itemVenta.ventaId || Date.now(),
                    mesa: itemVenta.mesa || 'N/A',
                    unidadMedida: productoInventario.unidadMedida
                };
                
                // Si es un producto principal, buscar y descontar sus componentes
                if (!productoInventario.tipo || productoInventario.tipo === 'producto') {
                    const componentesDelProducto = inventario.filter(c => 
                        c.tipo === 'componente' && 
                        c.productoPrincipal && 
                        c.productoPrincipal.toLowerCase() === itemVenta.nombre.toLowerCase()
                    );
                    
                    componentesDelProducto.forEach(componente => {
                        console.log(`   🔧 Descontando componente: ${componente.nombre} para producto ${itemVenta.nombre}`);
                        
                        // Calcular cantidad a descontar del componente
                        let cantidadComponente = itemVenta.cantidad;
                        
                        // Si el componente tiene cantidadPorUnidad, multiplicar
                        if (componente.unidadMedida !== 'unidad' && componente.cantidadPorUnidad) {
                            cantidadComponente = itemVenta.cantidad * componente.cantidadPorUnidad;
                        }
                        
                        // Descontar componente
                        const stockAnteriorComponente = componente.stockActual;
                        componente.stockActual = Math.max(0, componente.stockActual - cantidadComponente);
                        componente.ultimaActualizacion = new Date().toISOString();
                        
                        // Registrar ajuste del componente
                        const ajusteComponente = {
                            fecha: new Date().toISOString(),
                            tipo: 'salida',
                            cantidad: cantidadComponente,
                            cantidadUnidades: itemVenta.cantidad,
                            motivo: `Venta automática - Componente de ${itemVenta.nombre}`,
                            stockAnterior: stockAnteriorComponente,
                            stockNuevo: componente.stockActual,
                            ventaId: itemVenta.ventaId || Date.now(),
                            mesa: itemVenta.mesa || 'N/A',
                            unidadMedida: componente.unidadMedida,
                            productoPrincipal: itemVenta.nombre
                        };
                        
                        if (!componente.ajustes) {
                            componente.ajustes = [];
                        }
                        componente.ajustes.push(ajusteComponente);
                        
                        productosActualizados.push({
                            nombre: componente.nombre,
                            cantidadVendida: itemVenta.cantidad,
                            cantidadDescontada: cantidadComponente,
                            unidadMedida: componente.unidadMedida,
                            stockAnterior: stockAnteriorComponente,
                            stockNuevo: componente.stockActual,
                            esComponente: true,
                            productoPrincipal: itemVenta.nombre
                        });
                        
                        console.log(`   ✅ Componente ${componente.nombre} actualizado: ${stockAnteriorComponente} ${componente.unidadMedida} -> ${componente.stockActual} ${componente.unidadMedida}`);
                    });
                }
                
                if (!productoInventario.ajustes) {
                    productoInventario.ajustes = [];
                }
                productoInventario.ajustes.push(ajuste);
                
                productosActualizados.push({
                    nombre: productoInventario.nombre,
                    cantidadVendida: itemVenta.cantidad,
                    cantidadDescontada: cantidadADescontar,
                    unidadMedida: productoInventario.unidadMedida,
                    stockAnterior: stockAnterior,
                    stockNuevo: productoInventario.stockActual
                });
                
                console.log(`Stock actualizado para ${productoInventario.nombre}: ${stockAnterior} ${productoInventario.unidadMedida} -> ${productoInventario.stockActual} ${productoInventario.unidadMedida}`);
            } else {
                console.warn(`❌ Producto NO encontrado en inventario: "${itemVenta.nombre}"`);
                console.warn(`   Productos disponibles en inventario:`, inventario.map(p => p.nombre));
                productosNoEncontrados.push(itemVenta.nombre);
            }
        });
        
        // Guardar inventario actualizado
        localStorage.setItem('inventario', JSON.stringify(inventario));
        
        // Mostrar notificaciones si es necesario
        if (productosNoEncontrados.length > 0) {
            console.warn('Productos no encontrados en inventario:', productosNoEncontrados);
        }
        
        // Verificar productos con stock bajo
        const productosStockBajo = inventario.filter(p => 
            p.stockActual <= p.stockMinimo && productosActualizados.some(pa => pa.nombre === p.nombre)
        );
        
        if (productosStockBajo.length > 0) {
            mostrarAlertaStockBajo(productosStockBajo);
        }
        
        return {
            success: true,
            productosActualizados: productosActualizados,
            productosNoEncontrados: productosNoEncontrados,
            productosStockBajo: productosStockBajo
        };
        
    } catch (error) {
        console.error('Error al actualizar inventario desde venta:', error);
        return { success: false, message: error.message };
    }
}

// Función para mostrar alerta de stock bajo
function mostrarAlertaStockBajo(productos) {
    const mensaje = productos.map(p => 
        `${p.nombre}: ${p.stockActual} ${p.unidadMedida} (Mínimo: ${p.stockMinimo})`
    ).join('\n');
    
    // Crear notificación visual
    const alerta = document.createElement('div');
    alerta.className = 'alert alert-warning alert-dismissible fade show position-fixed';
    alerta.style.cssText = 'top: 20px; right: 20px; z-index: 9999; max-width: 400px;';
    alerta.innerHTML = `
        <strong>⚠️ Stock Bajo</strong>
        <p class="mb-0">Los siguientes productos tienen stock bajo:</p>
        <ul class="mb-0 mt-2">
            ${productos.map(p => `<li>${p.nombre}: ${p.stockActual} ${p.unidadMedida}</li>`).join('')}
        </ul>
        <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
    `;
    
    document.body.appendChild(alerta);
    
    // Auto-remover después de 10 segundos
    setTimeout(() => {
        if (alerta.parentNode) {
            alerta.remove();
        }
    }, 10000);
}

// Función para obtener productos del inventario para el POS
function obtenerProductosParaPOS() {
    try {
        const inventarioGuardado = localStorage.getItem('inventario');
        if (!inventarioGuardado) {
            return [];
        }
        
        const inventario = JSON.parse(inventarioGuardado);
        
        // Filtrar solo productos con stock disponible
        return inventario
            .filter(p => p.stockActual > 0)
            .map(p => ({
                id: p.codigo,
                nombre: p.nombre,
                precio: p.precio || 0,
                categoria: p.categoria,
                stockDisponible: p.stockActual,
                unidadMedida: p.unidadMedida
            }));
            
    } catch (error) {
        console.error('Error al obtener productos para POS:', error);
        return [];
    }
}

// Función para verificar disponibilidad de producto
function verificarDisponibilidadProducto(nombreProducto, cantidadSolicitada) {
    try {
        const inventarioGuardado = localStorage.getItem('inventario');
        if (!inventarioGuardado) {
            // Si no hay inventario configurado, permitir la venta (producto no está en inventario activo)
            return { disponible: true, mensaje: 'Producto no está en inventario activo, se permite la venta' };
        }
        
        const inventario = JSON.parse(inventarioGuardado);
        const producto = inventario.find(p => 
            p.nombre.toLowerCase() === nombreProducto.toLowerCase()
        );
        
        // Si el producto no está en inventario, permitir la venta normalmente
        if (!producto) {
            return { disponible: true, mensaje: 'Producto no está en inventario activo, se permite la venta' };
        }
        
        // Verificar si el stock es 0 o insuficiente
        if (producto.stockActual === 0) {
            return {
                disponible: false,
                stockActual: 0,
                stockMinimo: producto.stockMinimo,
                mensaje: `Producto sin stock. Stock actual: 0 ${producto.unidadMedida}`
            };
        }
        
        const disponible = producto.stockActual >= cantidadSolicitada;
        
        // Verificar si el stock está en o por debajo del mínimo
        const stockEnMinimo = producto.stockActual <= producto.stockMinimo && producto.stockActual > 0;
        
        return {
            disponible: disponible,
            stockActual: producto.stockActual,
            stockMinimo: producto.stockMinimo,
            stockEnMinimo: stockEnMinimo,
            mensaje: disponible ? 
                'Producto disponible' : 
                `Stock insuficiente. Disponible: ${producto.stockActual} ${producto.unidadMedida}, solicitado: ${cantidadSolicitada}`
        };
        
    } catch (error) {
        console.error('Error al verificar disponibilidad:', error);
        // En caso de error, permitir la venta (producto no está en inventario activo)
        return { disponible: true, mensaje: 'Error al verificar disponibilidad, se permite la venta' };
    }
}

// Función para sincronizar productos del POS con inventario
function sincronizarProductosPOS() {
    try {
        // Obtener productos del POS
        const productosPOS = JSON.parse(localStorage.getItem('productos') || '[]');
        const inventarioGuardado = localStorage.getItem('inventario');
        
        if (!inventarioGuardado) {
            console.log('No hay inventario configurado para sincronizar');
            return;
        }
        
        let inventario = JSON.parse(inventarioGuardado);
        const productosNuevos = [];
        
        // Verificar productos del POS que no están en inventario
        productosPOS.forEach(productoPOS => {
            const existeEnInventario = inventario.some(p => 
                p.nombre.toLowerCase() === productoPOS.nombre.toLowerCase()
            );
            
            if (!existeEnInventario) {
                productosNuevos.push({
                    codigo: generarCodigo(),
                    nombre: productoPOS.nombre,
                    categoria: productoPOS.categoria || 'Sin categoría',
                    tipo: 'producto', // Los productos del POS son productos principales
                    stockActual: 0,
                    stockMinimo: 1,
                    stockMaximo: 100,
                    unidadMedida: 'unidad',
                    cantidadPorUnidad: 1, // Por defecto 1 para productos por unidad
                    ultimaActualizacion: new Date().toISOString(),
                    precio: productoPOS.precio || 0
                });
            }
        });
        
        // Agregar productos nuevos al inventario
        if (productosNuevos.length > 0) {
            inventario.push(...productosNuevos);
            localStorage.setItem('inventario', JSON.stringify(inventario));
            console.log(`${productosNuevos.length} productos nuevos agregados al inventario`);
        }
        
        return productosNuevos;
        
    } catch (error) {
        console.error('Error al sincronizar productos:', error);
        return [];
    }
}

// Función para generar reporte de movimientos de inventario
function generarReporteMovimientos(fechaInicio, fechaFin) {
    try {
        const inventarioGuardado = localStorage.getItem('inventario');
        if (!inventarioGuardado) {
            return [];
        }
        
        const inventario = JSON.parse(inventarioGuardado);
        const movimientos = [];
        
        inventario.forEach(producto => {
            if (producto.ajustes) {
                producto.ajustes.forEach(ajuste => {
                    const fechaAjuste = new Date(ajuste.fecha);
                    const inicio = new Date(fechaInicio);
                    const fin = new Date(fechaFin);
                    
                    if (fechaAjuste >= inicio && fechaAjuste <= fin) {
                        movimientos.push({
                            fecha: ajuste.fecha,
                            producto: producto.nombre,
                            tipo: ajuste.tipo,
                            cantidad: ajuste.cantidad,
                            motivo: ajuste.motivo,
                            stockAnterior: ajuste.stockAnterior,
                            stockNuevo: ajuste.stockNuevo,
                            ventaId: ajuste.ventaId,
                            mesa: ajuste.mesa
                        });
                    }
                });
            }
        });
        
        // Ordenar por fecha
        return movimientos.sort((a, b) => new Date(b.fecha) - new Date(a.fecha));
        
    } catch (error) {
        console.error('Error al generar reporte de movimientos:', error);
        return [];
    }
}

// Función para mostrar modal de reporte de movimientos
function mostrarReporteMovimientos() {
    // Crear modal dinámicamente
    const modalHTML = `
        <div class="modal fade" id="modalReporteMovimientos" tabindex="-1">
            <div class="modal-dialog modal-xl">
                <div class="modal-content bg-dark text-white">
                    <div class="modal-header">
                        <h5 class="modal-title">Reporte de Movimientos de Inventario</h5>
                        <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal"></button>
                    </div>
                    <div class="modal-body">
                        <div class="row mb-3">
                            <div class="col-md-4">
                                <label class="form-label">Fecha Inicio</label>
                                <input type="date" class="form-control bg-dark text-white border-light" id="fechaInicioReporte">
                            </div>
                            <div class="col-md-4">
                                <label class="form-label">Fecha Fin</label>
                                <input type="date" class="form-control bg-dark text-white border-light" id="fechaFinReporte">
                            </div>
                            <div class="col-md-4">
                                <label class="form-label">&nbsp;</label>
                                <button class="btn btn-primary w-100" onclick="generarReporteMovimientosFiltrado()">
                                    <i class="fas fa-search"></i> Generar Reporte
                                </button>
                            </div>
                        </div>
                        
                        <div class="table-responsive">
                            <table class="table table-dark" id="tablaReporteMovimientos">
                                <thead>
                                    <tr>
                                        <th>Fecha</th>
                                        <th>Producto</th>
                                        <th>Tipo</th>
                                        <th>Cantidad</th>
                                        <th>Motivo</th>
                                        <th>Stock Anterior</th>
                                        <th>Stock Nuevo</th>
                                        <th>Venta ID</th>
                                        <th>Mesa</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    <!-- Los movimientos se cargarán aquí -->
                                </tbody>
                            </table>
                        </div>
                    </div>
                    <div class="modal-footer">
                        <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cerrar</button>
                        <button type="button" class="btn btn-info" onclick="exportarReporteMovimientos()">
                            <i class="fas fa-file-excel"></i> Exportar
                        </button>
                    </div>
                </div>
            </div>
        </div>
    `;
    
    // Agregar modal al body si no existe
    if (!document.getElementById('modalReporteMovimientos')) {
        document.body.insertAdjacentHTML('beforeend', modalHTML);
    }
    
    // Establecer fechas por defecto (últimos 30 días)
    const hoy = new Date();
    const hace30Dias = new Date(hoy.getTime() - (30 * 24 * 60 * 60 * 1000));
    
    document.getElementById('fechaInicioReporte').value = hace30Dias.toISOString().split('T')[0];
    document.getElementById('fechaFinReporte').value = hoy.toISOString().split('T')[0];
    
    // Mostrar modal
    const modal = new bootstrap.Modal(document.getElementById('modalReporteMovimientos'));
    modal.show();
    
    // Generar reporte inicial
    generarReporteMovimientosFiltrado();
}

// Función para generar reporte de movimientos filtrado
function generarReporteMovimientosFiltrado() {
    const fechaInicio = document.getElementById('fechaInicioReporte').value;
    const fechaFin = document.getElementById('fechaFinReporte').value;
    
    if (!fechaInicio || !fechaFin) {
        alert('Por favor, seleccione las fechas de inicio y fin');
        return;
    }
    
    const movimientos = generarReporteMovimientos(fechaInicio, fechaFin);
    mostrarTablaReporteMovimientos(movimientos);
}

// Función para mostrar tabla de reporte de movimientos
function mostrarTablaReporteMovimientos(movimientos) {
    const tbody = document.querySelector('#tablaReporteMovimientos tbody');
    tbody.innerHTML = '';
    
    if (movimientos.length === 0) {
        tbody.innerHTML = '<tr><td colspan="9" class="text-center">No hay movimientos en el período seleccionado</td></tr>';
        return;
    }
    
    movimientos.forEach(movimiento => {
        const fila = document.createElement('tr');
        const tipoClass = movimiento.tipo === 'entrada' ? 'text-success' : 'text-danger';
        const tipoIcon = movimiento.tipo === 'entrada' ? 'fa-arrow-up' : 'fa-arrow-down';
        
        fila.innerHTML = `
            <td>${new Date(movimiento.fecha).toLocaleString()}</td>
            <td>${movimiento.producto}</td>
            <td><i class="fas ${tipoIcon} ${tipoClass}"></i> ${movimiento.tipo}</td>
            <td>${movimiento.cantidad}</td>
            <td>${movimiento.motivo}</td>
            <td>${movimiento.stockAnterior}</td>
            <td>${movimiento.stockNuevo}</td>
            <td>${movimiento.ventaId || 'N/A'}</td>
            <td>${movimiento.mesa || 'N/A'}</td>
        `;
        tbody.appendChild(fila);
    });
}

// Función para exportar reporte de movimientos
function exportarReporteMovimientos() {
    try {
        const fechaInicio = document.getElementById('fechaInicioReporte').value;
        const fechaFin = document.getElementById('fechaFinReporte').value;
        
        if (!fechaInicio || !fechaFin) {
            alert('Por favor, seleccione las fechas de inicio y fin');
            return;
        }
        
        const movimientos = generarReporteMovimientos(fechaInicio, fechaFin);
        
        if (movimientos.length === 0) {
            alert('No hay movimientos para exportar en el período seleccionado');
            return;
        }
        
        const wb = XLSX.utils.book_new();
        
        // Preparar datos para exportar
        const datos = movimientos.map(mov => ({
            'Fecha': new Date(mov.fecha).toLocaleString(),
            'Producto': mov.producto,
            'Tipo': mov.tipo,
            'Cantidad': mov.cantidad,
            'Motivo': mov.motivo,
            'Stock Anterior': mov.stockAnterior,
            'Stock Nuevo': mov.stockNuevo,
            'Venta ID': mov.ventaId || 'N/A',
            'Mesa': mov.mesa || 'N/A'
        }));

        // Crear hoja de cálculo
        const ws = XLSX.utils.json_to_sheet(datos);

        // Ajustar anchos de columna
        const anchos = [
            { wch: 20 }, // Fecha
            { wch: 30 }, // Producto
            { wch: 10 }, // Tipo
            { wch: 10 }, // Cantidad
            { wch: 40 }, // Motivo
            { wch: 15 }, // Stock Anterior
            { wch: 15 }, // Stock Nuevo
            { wch: 15 }, // Venta ID
            { wch: 15 }  // Mesa
        ];
        ws['!cols'] = anchos;

        // Agregar hoja al libro
        XLSX.utils.book_append_sheet(wb, ws, 'Movimientos');

        // Generar archivo
        const fecha = new Date().toISOString().split('T')[0];
        XLSX.writeFile(wb, `Reporte_Movimientos_${fechaInicio}_${fechaFin}.xlsx`);
        
        alert('Reporte de movimientos exportado exitosamente');
    } catch (error) {
        console.error('Error al exportar reporte de movimientos:', error);
        alert('Error al generar el archivo Excel');
    }
}

// Función para mostrar información de integración
function mostrarInfoIntegracion() {
    const modalHTML = `
        <div class="modal fade" id="modalInfoIntegracion" tabindex="-1">
            <div class="modal-dialog modal-lg">
                <div class="modal-content bg-dark text-white">
                    <div class="modal-header">
                        <h5 class="modal-title">
                            <i class="fas fa-link text-info"></i> Información de Integración con POS
                        </h5>
                        <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal"></button>
                    </div>
                    <div class="modal-body">
                        <div class="row">
                            <div class="col-12">
                                <h6 class="text-info mb-3">
                                    <i class="fas fa-check-circle"></i> Funcionalidades de Integración
                                </h6>
                                <ul class="list-group list-group-flush bg-dark">
                                    <li class="list-group-item bg-dark text-white border-light">
                                        <i class="fas fa-arrow-down text-success"></i> 
                                        <strong>Actualización Automática:</strong> El inventario se actualiza automáticamente cuando se procesa una venta en el POS
                                    </li>
                                    <li class="list-group-item bg-dark text-white border-light">
                                        <i class="fas fa-exclamation-triangle text-warning"></i> 
                                        <strong>Verificación de Stock:</strong> Se verifica la disponibilidad antes de agregar productos a una orden
                                    </li>
                                    <li class="list-group-item bg-dark text-white border-light">
                                        <i class="fas fa-bell text-danger"></i> 
                                        <strong>Alertas de Stock Bajo:</strong> Notificaciones automáticas cuando los productos alcanzan el stock mínimo
                                    </li>
                                    <li class="list-group-item bg-dark text-white border-light">
                                        <i class="fas fa-sync-alt text-info"></i> 
                                        <strong>Sincronización de Productos:</strong> Los productos del POS se pueden sincronizar automáticamente con el inventario
                                    </li>
                                    <li class="list-group-item bg-dark text-white border-light">
                                        <i class="fas fa-shopping-cart text-primary"></i> 
                                        <strong>Visualización de Productos POS:</strong> Muestra todos los productos del POS con indicadores de estado
                                    </li>
                                    <li class="list-group-item bg-dark text-white border-light">
                                        <i class="fas fa-plus-circle text-success"></i> 
                                        <strong>Agregado Masivo:</strong> Permite agregar todos los productos faltantes del POS al inventario de una vez
                                    </li>
                                    <li class="list-group-item bg-dark text-white border-light">
                                        <i class="fas fa-chart-line text-primary"></i> 
                                        <strong>Reportes de Movimientos:</strong> Seguimiento completo de todas las entradas y salidas de inventario
                                    </li>
                                </ul>
                            </div>
                        </div>
                        
                        <div class="row mt-4">
                            <div class="col-12">
                                <h6 class="text-success mb-3">
                                    <i class="fas fa-tasks"></i> Flujo de Trabajo Recomendado
                                </h6>
                                <div class="alert alert-success bg-dark border-success">
                                    <p>Para una gestión óptima, sigue estos dos flujos de trabajo:</p>
                                    <div class="row">
                                        <div class="col-md-6">
                                            <div class="card bg-dark border-info h-100">
                                                <div class="card-body">
                                                    <h6 class="card-title text-info"><i class="fas fa-cash-register"></i> Para Productos de Venta</h6>
                                                    <ol class="small mb-0 ps-3">
                                                        <li>Crea el producto en el <strong>POS</strong>.</li>
                                                        <li>Ve a <strong>Inventario</strong> y actualiza la lista.</li>
                                                        <li>El nuevo producto aparecerá en la sección "Productos del POS".</li>
                                                        <li>Agrégalo al inventario con un solo clic.</li>
                                                        <li>Configura su stock inicial y límites.</li>
                                                    </ol>
                                                </div>
                                            </div>
                                        </div>
                                        <div class="col-md-6">
                                            <div class="card bg-dark border-warning h-100">
                                                <div class="card-body">
                                                    <h6 class="card-title text-warning"><i class="fas fa-blender"></i> Para Componentes / Materia Prima</h6>
                                                    <ol class="small mb-0 ps-3">
                                                        <li>Haz clic en el botón <strong>"+ Ingrediente / Insumo"</strong> (solo crea componentes).</li>
                                                        <li>Selecciona el <strong>Producto Principal</strong> del POS al que pertenece.</li>
                                                        <li>Rellena los datos (nombre, categoría, stock, unidad de medida, etc.).</li>
                                                        <li>Si es gramo/litro/ml, configura <strong>"Cantidad por Unidad"</strong> (ej: 10g por café).</li>
                                                        <li>Los componentes se descuentan automáticamente cuando se vende su producto principal.</li>
                                                        <li>Aparecen en gris en la tabla, separados de los productos principales.</li>
                                                    </ol>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div class="row mt-4">
                            <div class="col-12">
                                <h6 class="text-warning mb-3">
                                    <i class="fas fa-lightbulb"></i> ¿Cómo Funciona la Integración Automática?
                                </h6>
                                <div class="alert alert-primary bg-dark border-primary">
                                    <ul class="mb-0">
                                        <li><strong>Flujo de Productos Principales:</strong> Crea los productos en Administración/POS y luego añádelos al inventario desde la sección "Productos del POS".</li>
                                        <li><strong>Flujo de Componentes:</strong> Usa el botón "+ Ingrediente / Insumo" para crear componentes y asociarlos a productos principales.</li>
                                        <li><strong>Descuentos Automáticos:</strong> Los productos principales se descuentan al vender. Los componentes se descuentan cuando se vende su producto principal asociado.</li>
                                        <li>Asegúrate de que los nombres de los productos en el POS coincidan exactamente con los del inventario.</li>
                                        <li>Configura stock mínimo y máximo para cada producto para recibir alertas.</li>
                                        <li>Para productos en gramos/litros, configura "Cantidad por Unidad" para calcular correctamente los descuentos.</li>
                                    </ul>
                                </div>
                            </div>
                        </div>
                        
                        <div class="row mt-4">
                            <div class="col-12">
                                <h6 class="text-primary mb-3">
                                    <i class="fas fa-cog"></i> Configuración Recomendada
                                </h6>
                                <div class="alert alert-primary bg-dark border-primary">
                                    <ul class="mb-0">
                                        <li>Asegúrate de que los nombres de los productos en el POS coincidan exactamente con los del inventario</li>
                                        <li>Configura stock mínimo y máximo para cada producto</li>
                                        <li>Revisa regularmente los reportes de movimientos</li>
                                        <li>Usa la función de sincronización para agregar productos nuevos del POS al inventario</li>
                                        <li>Utiliza el filtro "Solo faltantes" para identificar productos pendientes</li>
                                        <li>Configura el stock inicial apropiado al agregar productos del POS</li>
                                    </ul>
                                </div>
                            </div>
                        </div>
                        
                        <div class="row mt-4">
                            <div class="col-12">
                                <h6 class="text-warning mb-3">
                                    <i class="fas fa-tools"></i> Funciones Disponibles
                                </h6>
                                <div class="row">
                                    <div class="col-md-6">
                                        <div class="card bg-dark border-warning">
                                            <div class="card-body">
                                                <h6 class="text-warning">Gestión Individual</h6>
                                                <ul class="small mb-0">
                                                    <li>Ver productos del POS con estado</li>
                                                    <li>Agregar productos faltantes uno por uno</li>
                                                    <li>Editar productos existentes</li>
                                                    <li>Ajustar stock manualmente</li>
                                                </ul>
                                            </div>
                                        </div>
                                    </div>
                                    <div class="col-md-6">
                                        <div class="card bg-dark border-success">
                                            <div class="card-body">
                                                <h6 class="text-success">Gestión Masiva</h6>
                                                <ul class="small mb-0">
                                                    <li>Agregar todos los productos faltantes</li>
                                                    <li>Sincronizar productos del POS</li>
                                                    <li>Filtrar por estado</li>
                                                    <li>Exportar reportes</li>
                                                </ul>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                    <div class="modal-footer">
                        <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cerrar</button>
                        <button type="button" class="btn btn-warning" onclick="mostrarModalProducto(null, true)">
                            <i class="fas fa-plus"></i> Añadir Ingrediente
                        </button>
                        <button type="button" class="btn btn-success" onclick="agregarTodosProductosFaltantes()">
                            <i class="fas fa-plus-circle"></i> Agregar Productos del POS
                        </button>
                    </div>
                </div>
            </div>
        </div>
    `;
    
    // Agregar modal al body si no existe
    if (!document.getElementById('modalInfoIntegracion')) {
        document.body.insertAdjacentHTML('beforeend', modalHTML);
    }
    
    // Mostrar modal
    const modal = new bootstrap.Modal(document.getElementById('modalInfoIntegracion'));
    modal.show();
}

// Función para cargar productos del POS
function cargarProductosPOS() {
    try {
        // Solo ejecutar si estamos en la página de inventario
        const tablaInventario = document.getElementById('tablaInventario');
        if (!tablaInventario) {
            return; // No estamos en la página de inventario
        }
        
        const productosPOS = JSON.parse(localStorage.getItem('productos') || '[]');
        const productosInventario = inventario.map(p => p.nombre.toLowerCase());
        
        // Crear contenedor para productos del POS si no existe
        let contenedorProductosPOS = document.getElementById('productosPOSContainer');
        if (!contenedorProductosPOS) {
            contenedorProductosPOS = document.createElement('div');
            contenedorProductosPOS.id = 'productosPOSContainer';
            contenedorProductosPOS.className = 'card bg-dark mb-4';
            contenedorProductosPOS.innerHTML = `
                <div class="card-header">
                    <div class="d-flex justify-content-between align-items-center">
                        <h5 class="mb-0">
                            <i class="fas fa-shopping-cart text-info"></i> 
                            Productos del POS
                            <span class="badge bg-info ms-2" id="contadorProductosPOS">0</span>
                        </h5>
                        <div class="d-flex align-items-center gap-2">
                            <button class="btn btn-sm btn-success" onclick="agregarTodosProductosFaltantes()" title="Agregar todos los productos faltantes">
                                <i class="fas fa-plus-circle"></i> Agregar Todos
                            </button>
                            <div class="form-check form-switch">
                                <input class="form-check-input" type="checkbox" id="mostrarSoloFaltantes">
                                <label class="form-check-label text-white" for="mostrarSoloFaltantes">
                                    Solo faltantes
                                </label>
                            </div>
                        </div>
                    </div>
                </div>
                <div class="card-body">
                    <div class="row" id="productosPOSGrid">
                        <!-- Los productos del POS se cargarán aquí -->
                    </div>
                </div>
            `;
            
            // Insertar después de los filtros y antes de la tabla de inventario
            const filtrosContainer = document.querySelector('.card.bg-dark');
            if (filtrosContainer) {
                filtrosContainer.parentNode.insertBefore(contenedorProductosPOS, filtrosContainer.nextSibling);
            }
            
            // Agregar evento al checkbox
            document.getElementById('mostrarSoloFaltantes').addEventListener('change', function() {
                mostrarProductosPOSFiltrados();
            });
        }
        
        mostrarProductosPOSFiltrados();
        
    } catch (error) {
        console.error('Error al cargar productos del POS:', error);
    }
}

// Función para mostrar productos del POS filtrados
function mostrarProductosPOSFiltrados() {
    try {
        const productosPOS = JSON.parse(localStorage.getItem('productos') || '[]');
        const productosInventario = inventario.map(p => p.nombre.toLowerCase());
        const mostrarSoloFaltantes = document.getElementById('mostrarSoloFaltantes')?.checked || false;
        
        const productosPOSGrid = document.getElementById('productosPOSGrid');
        const contadorProductosPOS = document.getElementById('contadorProductosPOS');
        
        productosPOSGrid.innerHTML = '';
        let contador = 0;
        
        productosPOS.forEach(producto => {
            const existeEnInventario = productosInventario.includes(producto.nombre.toLowerCase());
            
            // Si el filtro está activado y el producto existe en inventario, saltarlo
            if (mostrarSoloFaltantes && existeEnInventario) {
                return;
            }
            
            const estadoClase = existeEnInventario ? 'border-success' : 'border-warning';
            const estadoIcono = existeEnInventario ? 'fa-check-circle text-success' : 'fa-exclamation-triangle text-warning';
            const estadoTexto = existeEnInventario ? 'En Inventario' : 'Falta en Inventario';
            
            const productoCard = document.createElement('div');
            productoCard.className = 'col-md-4 col-lg-3 mb-3';
            productoCard.innerHTML = `
                <div class="card bg-dark ${estadoClase} border-2 h-100">
                    <div class="card-body p-3">
                        <div class="d-flex justify-content-between align-items-start mb-2">
                            <h6 class="card-title mb-0 text-truncate" title="${producto.nombre}">
                                ${producto.nombre}
                            </h6>
                            <i class="fas ${estadoIcono}" title="${estadoTexto}"></i>
                        </div>
                        <div class="small text-muted">
                            <div><strong>Categoría:</strong> ${producto.categoria || 'Sin categoría'}</div>
                            <div><strong>Precio:</strong> $${producto.precio || 0}</div>
                            <div><strong>Estado:</strong> ${estadoTexto}</div>
                        </div>
                        ${!existeEnInventario ? `
                            <button class="btn btn-sm btn-warning mt-2 w-100" 
                                    onclick="agregarProductoAInventario('${producto.nombre}', '${producto.categoria || 'Sin categoría'}', ${producto.precio || 0})">
                                <i class="fas fa-plus"></i> Agregar al Inventario
                            </button>
                        ` : ''}
                    </div>
                </div>
            `;
            
            productosPOSGrid.appendChild(productoCard);
            contador++;
        });
        
        contadorProductosPOS.textContent = contador;
        
        // Mostrar/ocultar contenedor según si hay productos
        const contenedorProductosPOS = document.getElementById('productosPOSContainer');
        if (contador === 0) {
            contenedorProductosPOS.style.display = 'none';
        } else {
            contenedorProductosPOS.style.display = 'block';
        }
        
    } catch (error) {
        console.error('Error al mostrar productos del POS filtrados:', error);
    }
}

// Función para agregar producto del POS al inventario
function agregarProductoAInventario(nombre, categoria, precio) {
    try {
        // Verificar si ya existe en inventario
        const existeEnInventario = inventario.some(p => p.nombre.toLowerCase() === nombre.toLowerCase());
        
        if (existeEnInventario) {
            alert('Este producto ya existe en el inventario');
            return;
        }
        
        // Crear nuevo producto en inventario
        const nuevoProducto = {
            codigo: generarCodigo(),
            nombre: nombre,
            categoria: categoria,
            stockActual: 0,
            stockMinimo: 1,
            stockMaximo: 100,
            unidadMedida: 'unidad',
            ultimaActualizacion: new Date().toISOString(),
            precio: precio
        };
        
        // Agregar al inventario
        inventario.push(nuevoProducto);
        guardarInventario();
        mostrarInventario();
        
        // Recargar productos del POS para actualizar la vista
        cargarProductosPOS();
        
        // Mostrar confirmación
        const alerta = document.createElement('div');
        alerta.className = 'alert alert-success alert-dismissible fade show position-fixed';
        alerta.style.cssText = 'top: 20px; right: 20px; z-index: 9999; max-width: 400px;';
        alerta.innerHTML = `
            <strong>✅ Producto Agregado</strong>
            <p class="mb-0">${nombre} ha sido agregado al inventario</p>
            <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
        `;
        
        document.body.appendChild(alerta);
        
        // Auto-remover después de 3 segundos
        setTimeout(() => {
            if (alerta.parentNode) {
                alerta.remove();
            }
        }, 3000);
        
    } catch (error) {
        console.error('Error al agregar producto al inventario:', error);
        alert('Error al agregar producto al inventario');
    }
}

// Función para agregar todos los productos faltantes del POS al inventario
function agregarTodosProductosFaltantes() {
    try {
        const productosPOS = JSON.parse(localStorage.getItem('productos') || '[]');
        const productosInventario = inventario.map(p => p.nombre.toLowerCase());
        
        // Filtrar productos que faltan en inventario
        const productosFaltantes = productosPOS.filter(producto => 
            !productosInventario.includes(producto.nombre.toLowerCase())
        );
        
        if (productosFaltantes.length === 0) {
            alert('No hay productos faltantes para agregar');
            return;
        }
        
        if (!confirm(`¿Está seguro que desea agregar ${productosFaltantes.length} productos al inventario?`)) {
            return;
        }
        
        let productosAgregados = 0;
        
        productosFaltantes.forEach(producto => {
            const nuevoProducto = {
                codigo: generarCodigo(),
                nombre: producto.nombre,
                categoria: producto.categoria || 'Sin categoría',
                stockActual: 0,
                stockMinimo: 1,
                stockMaximo: 100,
                unidadMedida: 'unidad',
                ultimaActualizacion: new Date().toISOString(),
                precio: producto.precio || 0
            };
            
            inventario.push(nuevoProducto);
            productosAgregados++;
        });
        
        guardarInventario();
        mostrarInventario();
        cargarProductosPOS();
        
        // Mostrar confirmación
        const alerta = document.createElement('div');
        alerta.className = 'alert alert-success alert-dismissible fade show position-fixed';
        alerta.style.cssText = 'top: 20px; right: 20px; z-index: 9999; max-width: 400px;';
        alerta.innerHTML = `
            <strong>✅ Productos Agregados</strong>
            <p class="mb-0">${productosAgregados} productos han sido agregados al inventario</p>
            <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
        `;
        
        document.body.appendChild(alerta);
        
        // Auto-remover después de 5 segundos
        setTimeout(() => {
            if (alerta.parentNode) {
                alerta.remove();
            }
        }, 5000);
        
    } catch (error) {
        console.error('Error al agregar productos faltantes:', error);
        alert('Error al agregar productos faltantes');
    }
}

// Función para configurar los filtros en tiempo real
function configurarFiltrosEnTiempoReal() {
    const buscarProducto = document.getElementById('buscarProducto');
    const filtroCategoria = document.getElementById('filtroCategoria');
    const filtroEstado = document.getElementById('filtroEstado');
    
    if (buscarProducto) {
        buscarProducto.addEventListener('input', aplicarFiltros);
    }
    if (filtroCategoria) {
        filtroCategoria.addEventListener('change', aplicarFiltros);
    }
    if (filtroEstado) {
        filtroEstado.addEventListener('change', aplicarFiltros);
    }
    const filtroTipo = document.getElementById('filtroTipo');
    if (filtroTipo) {
        filtroTipo.addEventListener('change', aplicarFiltros);
    }
}

// Función para imprimir tirilla general de inventario
function imprimirTirillaInventario() {
    try {
        if (inventario.length === 0) {
            alert('No hay productos en el inventario para imprimir');
            return;
        }
        
        const ventana = window.open('', 'ImpresionTirillaInventario', 'width=400,height=600,scrollbars=yes');
        
        if (!ventana) {
            alert('Por favor, permite las ventanas emergentes para este sitio');
            return;
        }
        
        const fecha = new Date().toLocaleDateString('es-ES');
        const hora = new Date().toLocaleTimeString('es-ES');
        
        // Separar productos principales y componentes
        const productosPrincipales = inventario.filter(p => !p.tipo || p.tipo === 'producto');
        const componentes = inventario.filter(p => p.tipo === 'componente');
        
        // Generar lista de productos agrupados
        let productosHTML = '';
        let totalItems = 0;
        
        productosPrincipales.forEach((producto, index) => {
            // Agregar producto principal
            productosHTML += `
                <div class="producto-item">
                    <div class="producto-nombre">${producto.nombre}</div>
                    <div class="stock-info">
                        <span class="stock-label">Stock Actual:</span>
                        <span class="stock-value">${producto.stockActual} ${producto.unidadMedida}</span>
                    </div>
                </div>
            `;
            
            // Buscar componentes asociados a este producto
            const componentesDelProducto = componentes.filter(c => 
                c.productoPrincipal && 
                c.productoPrincipal.toLowerCase() === producto.nombre.toLowerCase()
            );
            
            // Agregar componentes del producto principal
            if (componentesDelProducto.length > 0) {
                componentesDelProducto.forEach(componente => {
                    productosHTML += `
                        <div class="producto-item componente-item">
                            <div class="producto-nombre componente-nombre">  └─ ${componente.nombre}</div>
                            <div class="stock-info">
                                <span class="stock-label">Stock Actual:</span>
                                <span class="stock-value">${componente.stockActual} ${componente.unidadMedida}</span>
                            </div>
                        </div>
                    `;
                });
            }
            
            // Agregar separador entre grupos de productos (excepto el último)
            if (index < productosPrincipales.length - 1) {
                productosHTML += '<div class="separador"></div>';
            }
            totalItems++;
        });
        
        // Agregar componentes sin producto principal asociado (por si acaso)
        const componentesSinProducto = componentes.filter(c => !c.productoPrincipal);
        if (componentesSinProducto.length > 0) {
            if (productosPrincipales.length > 0) {
                productosHTML += '<div class="separador"></div>';
            }
            componentesSinProducto.forEach((componente, index) => {
                productosHTML += `
                    <div class="producto-item componente-item">
                        <div class="producto-nombre componente-nombre">${componente.nombre} (Sin producto principal)</div>
                        <div class="stock-info">
                            <span class="stock-label">Stock Actual:</span>
                            <span class="stock-value">${componente.stockActual} ${componente.unidadMedida}</span>
                        </div>
                    </div>
                `;
                if (index < componentesSinProducto.length - 1) {
                    productosHTML += '<div class="separador"></div>';
                }
            });
        }
        
        ventana.document.write(`
            <!DOCTYPE html>
            <html>
                <head>
                    <title>Tirilla Inventario General</title>
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
                        .componente-item {
                            margin-left: 2mm;
                            margin-top: 1mm;
                            margin-bottom: 1mm;
                        }
                        .componente-nombre {
                            font-size: 12px;
                            font-weight: normal;
                            color: #555;
                        }
                        .stock-info {
                            font-size: 12px;
                        }
                        .stock-label {
                            font-weight: bold;
                        }
                        .stock-value {
                            font-weight: bold;
                        }
                        .separador {
                            border-top: 1px dashed #ccc;
                            margin: 1mm 0;
                        }
                        .firma-section {
                            margin-top: 3mm;
                            border-top: 1px dashed #000;
                            padding-top: 2mm;
                        }
                        .firma-line {
                            border-bottom: 1px solid #000;
                            height: 20px;
                            margin-bottom: 1mm;
                        }
                        .firma-label {
                            font-size: 12px;
                            font-weight: bold;
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
                    
                    <div class="header text-center">
                        <h2 style="margin: 0; font-size: 16px;">INVENTARIO GENERAL</h2>
                    </div>
                    
                    <div class="fecha-hora text-center mb-1">
                        Fecha: ${fecha}<br>
                        Hora: ${hora}
                    </div>
                    
                    <div class="productos-lista">
                        ${productosHTML}
                    </div>
                    
                    <div class="firma-section">
                        <div class="firma-label text-center mb-1">Firma de quien recibe:</div>
                        <div class="firma-line"></div>
                        <div class="firma-label text-center" style="font-size: 11px; margin-top: 1mm;">
                            Nombre: _________________________
                        </div>
                    </div>
                    
                    <div class="text-center mt-1">
                        <div class="border-top">ToySoft POS</div>
                    </div>
                </body>
            </html>
        `);
        
        ventana.document.close();
        
    } catch (error) {
        console.error('Error al imprimir tirilla:', error);
        alert('Error al generar la tirilla: ' + error.message);
    }
}

// Cargar inventario al iniciar (solo si estamos en la página de inventario)
document.addEventListener('DOMContentLoaded', function() {
    // Cargar datos en memoria siempre (para que estén disponibles en POS)
    const inventarioGuardado = localStorage.getItem('inventario');
    if (inventarioGuardado) {
        try {
            inventario = JSON.parse(inventarioGuardado);
        } catch (error) {
            console.error('Error al parsear inventario:', error);
        }
    }
    
    // Solo inicializar la UI si estamos en la página de inventario
    const tablaInventario = document.getElementById('tablaInventario');
    if (tablaInventario) {
        cargarInventario();
    }
}); 