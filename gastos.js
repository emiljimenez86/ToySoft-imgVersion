// Variables globales
let gastos = JSON.parse(localStorage.getItem('gastos')) || [];

// Función para mostrar/ocultar el formulario de gastos
function agregarGasto() {
    const formGasto = document.getElementById('formGasto');
    formGasto.style.display = formGasto.style.display === 'none' ? 'block' : 'none';
    
    // Limpiar formulario al mostrarlo
    if (formGasto.style.display === 'block') {
        document.getElementById('descripcionGasto').value = '';
        document.getElementById('montoGasto').value = '';
        document.getElementById('categoriaGasto').value = '';
        document.getElementById('descripcionGasto').focus();
    }
}

// Función para validar el monto
function validarMonto(monto) {
    if (isNaN(monto) || monto <= 0) {
        alert('Por favor ingrese un monto válido mayor a 0');
        return false;
    }
    return true;
}

// Función para formatear el monto
function formatearMonto(monto) {
    return new Intl.NumberFormat('es-CO', {
        style: 'currency',
        currency: 'COP',
        minimumFractionDigits: 0,
        maximumFractionDigits: 0
    }).format(monto);
}

// Función para guardar un nuevo gasto
function guardarGasto() {
    // Sincronizar con almacenamiento para evitar datos obsoletos
    const gastos = JSON.parse(localStorage.getItem('gastos')) || [];
    const historialGastos = JSON.parse(localStorage.getItem('historialGastos')) || [];
    const descripcion = document.getElementById('descripcionGasto').value.trim();
    const monto = parseFloat(document.getElementById('montoGasto').value);
    const categoria = document.getElementById('categoriaGasto').value;

    // Validaciones
    if (!descripcion) {
        alert('Por favor ingrese una descripción del gasto');
        document.getElementById('descripcionGasto').focus();
        return;
    }

    if (!validarMonto(monto)) {
        document.getElementById('montoGasto').focus();
        return;
    }

    if (!categoria) {
        alert('Por favor seleccione una categoría');
        document.getElementById('categoriaGasto').focus();
        return;
    }

    const gasto = {
        id: Date.now(),
        fecha: new Date().toISOString(),
        descripcion,
        monto,
        categoria
    };

    // Guardar en gastos (para cierre de caja)
    gastos.push(gasto);
    localStorage.setItem('gastos', JSON.stringify(gastos));

    // Guardar en historialGastos (para balance general)
    historialGastos.push(gasto);
    localStorage.setItem('historialGastos', JSON.stringify(historialGastos));
    
    // Limpiar formulario y ocultarlo
    document.getElementById('descripcionGasto').value = '';
    document.getElementById('montoGasto').value = '';
    document.getElementById('categoriaGasto').value = '';
    document.getElementById('formGasto').style.display = 'none';
    
    // Actualizar la vista
    cargarGastos();
    
    // Mostrar confirmación
    alert('Gasto guardado correctamente');
}

// Función para obtener el color de la categoría
function getCategoriaColor(categoria) {
    const colores = {
        'insumos': 'categoria-insumos',
        'servicios': 'categoria-servicios',
        'nomina': 'categoria-nomina',
        'renta': 'categoria-renta',
        'utilities': 'categoria-utilities',
        'otros': 'categoria-otros'
    };
    return colores[categoria] || 'categoria-otros';
}

// Función para cargar y mostrar los gastos
function cargarGastos() {
    // Sincronizar con almacenamiento cada vez que se cargan
    gastos = JSON.parse(localStorage.getItem('gastos')) || [];
    const hoy = new Date().toISOString().split('T')[0];
    const gastosHoy = gastos.filter(g => g.fecha.split('T')[0] === hoy);
    
    // Calcular total de gastos del día
    const totalGastos = gastosHoy.reduce((sum, g) => sum + g.monto, 0);
    document.getElementById('totalGastosHoy').textContent = formatearMonto(totalGastos);
    
    // Calcular gastos por categoría
    const gastosPorCategoria = {};
    gastosHoy.forEach(g => {
        gastosPorCategoria[g.categoria] = (gastosPorCategoria[g.categoria] || 0) + g.monto;
    });
    
    // Mostrar gastos por categoría
    const categoriaDiv = document.getElementById('gastosPorCategoria');
    categoriaDiv.innerHTML = '';
    
    if (Object.keys(gastosPorCategoria).length === 0) {
        categoriaDiv.innerHTML = '<p class="text-muted">No hay gastos registrados hoy</p>';
    } else {
        Object.entries(gastosPorCategoria).forEach(([cat, monto]) => {
            const div = document.createElement('div');
            div.className = 'd-flex justify-content-between align-items-center mb-2';
            div.innerHTML = `
                <span class="categoria-badge ${getCategoriaColor(cat)}">${cat}</span>
                <span class="text-warning">${formatearMonto(monto)}</span>
            `;
            categoriaDiv.appendChild(div);
        });
    }
    
    // Mostrar lista de gastos
    const listaGastos = document.getElementById('listaGastos');
    listaGastos.innerHTML = '';
    
    if (gastosHoy.length === 0) {
        listaGastos.innerHTML = `
            <div class="text-center text-muted py-4">
                <i class="fas fa-receipt fa-3x mb-3"></i>
                <p>No hay gastos registrados hoy</p>
            </div>
        `;
    } else {
        gastosHoy.sort((a, b) => new Date(b.fecha) - new Date(a.fecha)).forEach(gasto => {
            const div = document.createElement('div');
            div.className = 'gasto-item';
            div.innerHTML = `
                <div class="d-flex justify-content-between align-items-center">
                    <div>
                        <h6 class="mb-1">${gasto.descripcion}</h6>
                        <span class="categoria-badge ${getCategoriaColor(gasto.categoria)}">${gasto.categoria}</span>
                    </div>
                    <div class="text-end">
                        <h5 class="mb-0 text-warning">${formatearMonto(gasto.monto)}</h5>
                        <small class="text-muted">${new Date(gasto.fecha).toLocaleTimeString()}</small>
                    </div>
                </div>
            `;
            listaGastos.appendChild(div);
        });
    }
}

// Función para exportar gastos a Excel
function exportarGastos() {
    const hoy = new Date().toISOString().split('T')[0];
    const gastosHoy = gastos.filter(g => g.fecha.split('T')[0] === hoy);
    
    if (gastosHoy.length === 0) {
        alert('No hay gastos para exportar hoy');
        return;
    }
    
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(gastosHoy.map(g => ({
        Fecha: new Date(g.fecha).toLocaleString(),
        Descripción: g.descripcion,
        Categoría: g.categoria,
        Monto: g.monto
    })));
    
    // Ajustar ancho de columnas
    const wscols = [
        {wch: 20}, // Fecha
        {wch: 30}, // Descripción
        {wch: 15}, // Categoría
        {wch: 15}  // Monto
    ];
    ws['!cols'] = wscols;
    
    // Formatear números
    for (let i = 1; i <= gastosHoy.length; i++) {
        const cellRef = XLSX.utils.encode_cell({r: i, c: 3});
        if (ws[cellRef]) {
            ws[cellRef].z = '"$"#,##0';
        }
    }
    
    XLSX.utils.book_append_sheet(wb, ws, "Gastos");
    XLSX.writeFile(wb, `gastos_${hoy}.xlsx`);
    
    alert('Reporte exportado correctamente');
}

// Cargar gastos al iniciar
document.addEventListener('DOMContentLoaded', cargarGastos); 