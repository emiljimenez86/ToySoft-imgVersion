// Variables globales
let gastos = JSON.parse(localStorage.getItem('gastos')) || [];
let gastoEnEdicionId = null;

function fechaGastoDia(g) {
    if (!g || !g.fecha) return '';
    return typeof g.fecha === 'string' ? g.fecha.split('T')[0] : new Date(g.fecha).toISOString().split('T')[0];
}

/** Asigna id a registros antiguos y alinea historialGastos por el mismo criterio. */
function migrarIdsGastosSiFalta() {
    let lista = JSON.parse(localStorage.getItem('gastos')) || [];
    let hist = JSON.parse(localStorage.getItem('historialGastos')) || [];
    let t = Date.now();
    let cambio = false;

    lista = lista.map((g) => {
        if (g.id != null && g.id !== '') return g;
        cambio = true;
        return { ...g, id: t++ };
    });

    hist = hist.map((h) => {
        if (h.id != null && h.id !== '') return h;
        cambio = true;
        const fd = fechaGastoDia(h);
        const gemelo = lista.find(
            (g) =>
                g.descripcion === h.descripcion &&
                Number(g.monto) === Number(h.monto) &&
                (g.categoria || '') === (h.categoria || '') &&
                fechaGastoDia(g) === fd
        );
        return { ...h, id: gemelo ? gemelo.id : t++ };
    });

    if (cambio) {
        localStorage.setItem('gastos', JSON.stringify(lista));
        localStorage.setItem('historialGastos', JSON.stringify(hist));
    }
}

function restaurarModoNuevoGasto() {
    gastoEnEdicionId = null;
    const title = document.querySelector('#formGasto .card-title');
    if (title) title.innerHTML = '<i class="fas fa-edit me-2"></i>Nuevo Gasto';
    const btn = document.getElementById('btnGuardarGasto');
    if (btn) btn.innerHTML = '<i class="fas fa-save me-2"></i>Guardar';
    const btnCancel = document.getElementById('btnCancelarEdicionGasto');
    if (btnCancel) btnCancel.classList.add('d-none');
}

// Función para mostrar/ocultar el formulario de gastos
function agregarGasto() {
    const formGasto = document.getElementById('formGasto');
    const willShow = formGasto.style.display === 'none' || formGasto.style.display === '';

    formGasto.style.display = willShow ? 'block' : 'none';

    if (willShow) {
        restaurarModoNuevoGasto();
        document.getElementById('descripcionGasto').value = '';
        document.getElementById('montoGasto').value = '';
        document.getElementById('categoriaGasto').value = '';
        document.getElementById('descripcionGasto').focus();
    } else {
        restaurarModoNuevoGasto();
    }
}

function cancelarEdicionGasto() {
    restaurarModoNuevoGasto();
    document.getElementById('descripcionGasto').value = '';
    document.getElementById('montoGasto').value = '';
    document.getElementById('categoriaGasto').value = '';
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

function editarGasto(id) {
    migrarIdsGastosSiFalta();
    const lista = JSON.parse(localStorage.getItem('gastos')) || [];
    const g = lista.find((x) => x.id === id);
    if (!g) {
        alert('Gasto no encontrado');
        return;
    }

    const formGasto = document.getElementById('formGasto');
    formGasto.style.display = 'block';

    gastoEnEdicionId = id;
    document.getElementById('descripcionGasto').value = g.descripcion;
    document.getElementById('montoGasto').value = g.monto;
    document.getElementById('categoriaGasto').value = g.categoria || '';

    const title = document.querySelector('#formGasto .card-title');
    if (title) title.innerHTML = '<i class="fas fa-edit me-2"></i>Editar gasto';

    const btn = document.getElementById('btnGuardarGasto');
    if (btn) btn.innerHTML = '<i class="fas fa-save me-2"></i>Actualizar';

    const btnCancel = document.getElementById('btnCancelarEdicionGasto');
    if (btnCancel) btnCancel.classList.remove('d-none');

    document.getElementById('descripcionGasto').focus();
}

function eliminarGasto(id) {
    if (!confirm('¿Eliminar este gasto? No se puede deshacer.')) return;

    migrarIdsGastosSiFalta();
    let lista = JSON.parse(localStorage.getItem('gastos')) || [];
    let hist = JSON.parse(localStorage.getItem('historialGastos')) || [];

    lista = lista.filter((g) => g.id !== id);
    hist = hist.filter((g) => g.id !== id);

    localStorage.setItem('gastos', JSON.stringify(lista));
    localStorage.setItem('historialGastos', JSON.stringify(hist));

    if (gastoEnEdicionId === id) cancelarEdicionGasto();

    cargarGastos();
}

// Función para guardar un nuevo gasto o actualizar uno en edición
function guardarGasto() {
    migrarIdsGastosSiFalta();

    const lista = JSON.parse(localStorage.getItem('gastos')) || [];
    const historialGastos = JSON.parse(localStorage.getItem('historialGastos')) || [];
    const descripcion = document.getElementById('descripcionGasto').value.trim();
    const monto = parseFloat(document.getElementById('montoGasto').value);
    const categoria = document.getElementById('categoriaGasto').value;

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

    if (gastoEnEdicionId != null) {
        const idx = lista.findIndex((g) => g.id === gastoEnEdicionId);
        if (idx === -1) {
            alert('Gasto no encontrado');
            return;
        }
        const prev = lista[idx];
        const actualizado = {
            id: gastoEnEdicionId,
            fecha: prev.fecha || new Date().toISOString(),
            descripcion,
            monto,
            categoria
        };
        lista[idx] = actualizado;

        const idxH = historialGastos.findIndex((g) => g.id === gastoEnEdicionId);
        if (idxH !== -1) historialGastos[idxH] = actualizado;
        else historialGastos.push(actualizado);

        localStorage.setItem('gastos', JSON.stringify(lista));
        localStorage.setItem('historialGastos', JSON.stringify(historialGastos));

        document.getElementById('descripcionGasto').value = '';
        document.getElementById('montoGasto').value = '';
        document.getElementById('categoriaGasto').value = '';
        document.getElementById('formGasto').style.display = 'none';
        restaurarModoNuevoGasto();
        cargarGastos();
        alert('Gasto actualizado correctamente');
        return;
    }

    const gasto = {
        id: Date.now(),
        fecha: new Date().toISOString(),
        descripcion,
        monto,
        categoria
    };

    lista.push(gasto);
    localStorage.setItem('gastos', JSON.stringify(lista));

    historialGastos.push(gasto);
    localStorage.setItem('historialGastos', JSON.stringify(historialGastos));

    document.getElementById('descripcionGasto').value = '';
    document.getElementById('montoGasto').value = '';
    document.getElementById('categoriaGasto').value = '';
    document.getElementById('formGasto').style.display = 'none';

    restaurarModoNuevoGasto();
    cargarGastos();
    alert('Gasto guardado correctamente');
}

// Función para obtener el color de la categoría
function getCategoriaColor(categoria) {
    const colores = {
        insumos: 'categoria-insumos',
        servicios: 'categoria-servicios',
        nomina: 'categoria-nomina',
        renta: 'categoria-renta',
        utilities: 'categoria-utilities',
        otros: 'categoria-otros'
    };
    return colores[categoria] || 'categoria-otros';
}

// Función para cargar y mostrar los gastos
function cargarGastos() {
    migrarIdsGastosSiFalta();

    gastos = JSON.parse(localStorage.getItem('gastos')) || [];
    const hoy = new Date().toISOString().split('T')[0];
    const gastosHoy = gastos.filter((g) => fechaGastoDia(g) === hoy);

    const totalGastos = gastosHoy.reduce((sum, g) => sum + g.monto, 0);
    document.getElementById('totalGastosHoy').textContent = formatearMonto(totalGastos);

    const gastosPorCategoria = {};
    gastosHoy.forEach((g) => {
        gastosPorCategoria[g.categoria] = (gastosPorCategoria[g.categoria] || 0) + g.monto;
    });

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

    const listaGastos = document.getElementById('listaGastos');
    listaGastos.innerHTML = '';
    listaGastos.onclick = null;

    if (gastosHoy.length === 0) {
        listaGastos.innerHTML = `
            <div class="text-center text-muted py-4">
                <i class="fas fa-receipt fa-3x mb-3"></i>
                <p>No hay gastos registrados hoy</p>
            </div>
        `;
    } else {
        gastosHoy
            .sort((a, b) => new Date(b.fecha) - new Date(a.fecha))
            .forEach((gasto) => {
                const div = document.createElement('div');
                div.className = 'gasto-item';
                const gid = gasto.id;
                div.innerHTML = `
                <div class="d-flex justify-content-between align-items-center flex-wrap gap-2">
                    <div class="flex-grow-1">
                        <h6 class="mb-1">${escapeHtml(gasto.descripcion)}</h6>
                        <span class="categoria-badge ${getCategoriaColor(gasto.categoria)}">${escapeHtml(gasto.categoria || '')}</span>
                    </div>
                    <div class="text-end">
                        <h5 class="mb-0 text-warning">${formatearMonto(gasto.monto)}</h5>
                        <small class="text-muted">${new Date(gasto.fecha).toLocaleTimeString()}</small>
                    </div>
                    <div class="btn-group btn-group-sm" role="group">
                        <button type="button" class="btn btn-outline-warning" title="Modificar" aria-label="Modificar gasto" data-accion="editar" data-id="${gid}">
                            <i class="fas fa-edit"></i>
                        </button>
                        <button type="button" class="btn btn-outline-danger" title="Eliminar" aria-label="Eliminar gasto" data-accion="eliminar" data-id="${gid}">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                </div>
            `;
                listaGastos.appendChild(div);
            });

        listaGastos.onclick = (e) => {
            const btn = e.target.closest('button[data-accion]');
            if (!btn) return;
            const id = Number(btn.dataset.id);
            if (btn.dataset.accion === 'editar') editarGasto(id);
            else if (btn.dataset.accion === 'eliminar') eliminarGasto(id);
        };
    }
}

function escapeHtml(s) {
    const d = document.createElement('div');
    d.textContent = s;
    return d.innerHTML;
}

// Función para exportar gastos a Excel
function exportarGastos() {
    gastos = JSON.parse(localStorage.getItem('gastos')) || [];
    const hoy = new Date().toISOString().split('T')[0];
    const gastosHoy = gastos.filter((g) => fechaGastoDia(g) === hoy);

    if (gastosHoy.length === 0) {
        alert('No hay gastos para exportar hoy');
        return;
    }

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(
        gastosHoy.map((g) => ({
            Fecha: new Date(g.fecha).toLocaleString(),
            Descripción: g.descripcion,
            Categoría: g.categoria,
            Monto: g.monto
        }))
    );

    const wscols = [{ wch: 20 }, { wch: 30 }, { wch: 15 }, { wch: 15 }];
    ws['!cols'] = wscols;

    for (let i = 1; i <= gastosHoy.length; i++) {
        const cellRef = XLSX.utils.encode_cell({ r: i, c: 3 });
        if (ws[cellRef]) {
            ws[cellRef].z = '"$"#,##0';
        }
    }

    XLSX.utils.book_append_sheet(wb, ws, 'Gastos');
    XLSX.writeFile(wb, `gastos_${hoy}.xlsx`);

    alert('Reporte exportado correctamente');
}
