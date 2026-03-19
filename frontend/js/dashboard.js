let habitosActuales = [];         // Todos los hábitos del usuario
let habitosHoy = [];              // Filtrados para hoy
let otrosHabitos = [];            // El resto
let confirmCallback = null;

// Estado de la pestaña actual: 'hoy' o 'todos'
let pestanaActual = 'hoy';

let vistaActual = 'habitos'; // 'habitos' o 'progreso'
let weeklyChart = null;      // instancia del gráfico
let estadoChart = null;
let categoriasDisponibles = [];

document.addEventListener('DOMContentLoaded', async () => {
    const usuarioString = localStorage.getItem('usuario');
    const token = localStorage.getItem('token');

    if (!usuarioString || !token) {
        window.location.href = 'login.html';
        return;
    }

    const usuario = JSON.parse(usuarioString);
    document.getElementById('nombre-usuario').innerText = usuario.nombre_usuario || 'Usuario';

    configurarEventListeners();
    initTimeSelectors();
    await cargarCategoriasUI();
    await cargarDashboard(usuario.id);
});

async function cargarCategoriasUI() {
    const token = localStorage.getItem('token');
    const res = await fetch('http://localhost:3000/api/habitos/categorias', {
        headers: { 'Authorization': `Bearer ${token}` }
    });
    if (!res.ok) throw new Error('No se pudieron cargar categorías');
    categoriasDisponibles = await res.json();
    poblarSelectCategorias('habito-categoria', { incluirVacio: true });
    poblarSelectCategorias('edit-categoria', { incluirVacio: true });
}

function poblarSelectCategorias(selectId, { incluirVacio } = {}) {
    const el = document.getElementById(selectId);
    if (!el) return;
    const valorActual = el.value;
    const options = [];
    if (incluirVacio) options.push('<option value="">Selecciona una categoría</option>');
    categoriasDisponibles.forEach(c => {
        options.push(`<option value="${escapeHtml(c.nombre)}">${escapeHtml(c.nombre)}</option>`);
    });
    // Fallback siempre disponible
    options.push('<option value="Otros">Otros</option>');
    el.innerHTML = options.join('');
    // Restaurar selección si aplica
    if (valorActual) el.value = valorActual;
}

function configurarEventListeners() {
    // Botón nuevo hábito
    document.getElementById('btn-nuevo-habito').addEventListener('click', () => {
        resetFormularioNuevo();
        abrirModal('modal-nuevo-habito');
        
    });

    document.getElementById('menu-progreso').addEventListener('click', () => cambiarVista('progreso'));
        document.getElementById('menu-habitos').addEventListener('click', () => cambiarVista('habitos'));
    // Cerrar sesión
    document.getElementById('btn-cerrar-sesion').addEventListener('click', logout);

    // Cerrar modales
    document.getElementById('cerrar-modal').addEventListener('click', () => cerrarModal('modal-nuevo-habito'));
    document.getElementById('cancelar-modal').addEventListener('click', () => cerrarModal('modal-nuevo-habito'));
    document.getElementById('cerrar-modal-editar').addEventListener('click', () => cerrarModal('modal-editar-habito'));
    document.getElementById('cancelar-modal-editar').addEventListener('click', () => cerrarModal('modal-editar-habito'));
    document.getElementById('cerrar-confirmar').addEventListener('click', () => cerrarModal('modal-confirmar'));
    document.getElementById('cancelar-confirmar').addEventListener('click', () => cerrarModal('modal-confirmar'));

    // Formularios
    document.getElementById('form-nuevo-habito').addEventListener('submit', guardarHabito);
    document.getElementById('form-editar-habito').addEventListener('submit', guardarEdicionHabito);

    // Checkbox "Todos los días"
    document.getElementById('habito-todos-dias').addEventListener('change', (e) => {
        const checkboxes = document.querySelectorAll('#nuevo-dias-container input[type="checkbox"]');
        checkboxes.forEach(cb => {
            cb.checked = e.target.checked;
            cb.disabled = e.target.checked;
        });
    });

    document.getElementById('edit-todos-dias').addEventListener('change', (e) => {
        const checkboxes = document.querySelectorAll('#edit-dias-container input[type="checkbox"]');
        checkboxes.forEach(cb => {
            cb.checked = e.target.checked;
            cb.disabled = e.target.checked;
        });
    });

    // Confirmar eliminación
    document.getElementById('confirmar-accion').addEventListener('click', () => {
        if (confirmCallback) {
            confirmCallback();
            cerrarModal('modal-confirmar');
        }
    });

    // Presets de hora (nuevo)
    document.querySelectorAll('#habito-time-presets .preset-btn').forEach(btn => {
        btn.addEventListener('click', (e) => seleccionarPreset('habito', e.target.dataset.value));
    });
    document.getElementById('habito-time-input').addEventListener('input', (e) => {
        const val = e.target.value;
        if (val) {
            document.getElementById('habito-time-display').textContent = val;
            document.getElementById('habito-time-selected').value = val + ':00';
        } else {
            document.getElementById('habito-time-display').textContent = '— : —';
            document.getElementById('habito-time-selected').value = 'none';
        }
    });

    // Presets de hora (editar)
    document.querySelectorAll('#edit-time-presets .preset-btn').forEach(btn => {
        btn.addEventListener('click', (e) => seleccionarPreset('edit', e.target.dataset.value));
    });
    document.getElementById('edit-time-input').addEventListener('input', (e) => {
        const val = e.target.value;
        if (val) {
            document.getElementById('edit-time-display').textContent = val;
            document.getElementById('edit-time-selected').value = val + ':00';
        } else {
            document.getElementById('edit-time-display').textContent = '— : —';
            document.getElementById('edit-time-selected').value = 'none';
        }
    });

    // Pestañas
    document.getElementById('tab-hoy').addEventListener('click', () => cambiarPestana('hoy'));
    document.getElementById('tab-todos').addEventListener('click', () => cambiarPestana('todos'));
}

function cambiarPestana(pestana) {
    pestanaActual = pestana;
    // Actualizar clases active
    document.getElementById('tab-hoy').classList.toggle('active', pestana === 'hoy');
    document.getElementById('tab-todos').classList.toggle('active', pestana === 'todos');
    // Mostrar los hábitos correspondientes
    if (pestana === 'hoy') {
        mostrarHabitos(habitosHoy, true);
    } else {
        mostrarHabitos(otrosHabitos, false);
    }
}

function resetFormularioNuevo() {
    const form = document.getElementById('form-nuevo-habito');
    form.reset();
    const checkboxes = document.querySelectorAll('#nuevo-dias-container input[type="checkbox"]');
    checkboxes.forEach(cb => {
        cb.checked = true;
        cb.disabled = false;
    });
    document.getElementById('habito-todos-dias').checked = true;
    seleccionarPreset('habito', 'none');
}

function seleccionarPreset(prefix, value) {
    document.querySelectorAll(`#${prefix}-time-presets .preset-btn`).forEach(btn => {
        btn.classList.remove('active');
    });
    const btnActivo = document.querySelector(`#${prefix}-time-presets .preset-btn[data-value="${value}"]`);
    if (btnActivo) btnActivo.classList.add('active');

    const picker = document.getElementById(`${prefix}-time-picker`);
    const display = document.getElementById(`${prefix}-time-display`);
    const hidden = document.getElementById(`${prefix}-time-selected`);
    const input = document.getElementById(`${prefix}-time-input`);

    if (value === 'none') {
        picker.style.display = 'none';
        display.textContent = '— : —';
        hidden.value = 'none';
    } else if (value === 'custom') {
        picker.style.display = 'flex';
        if (!input.value) {
            const now = new Date();
            input.value = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
        }
        input.dispatchEvent(new Event('input'));
    } else {
        picker.style.display = 'none';
        display.textContent = value.substring(0, 5);
        hidden.value = value;
    }
}

function abrirModal(id) {
    document.getElementById(id).style.display = 'flex';
}
function cerrarModal(id) {
    document.getElementById(id).style.display = 'none';
}

// Obtener el número de día actual (1=Lunes, 7=Domingo)
function getDiaActual() {
    const dia = new Date().getDay(); // 0=domingo, 1=lunes, ..., 6=sábado
    return dia === 0 ? 7 : dia;
}

async function cargarDashboard(usuarioId) {
    try {
        mostrarLoading(true);
        const token = localStorage.getItem('token');
        const res = await fetch(`http://localhost:3000/api/habitos?usuarioId=${encodeURIComponent(usuarioId)}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!res.ok) throw new Error('Error al cargar hábitos');
        habitosActuales = await res.json();
        await actualizarEstadisticas(usuarioId);

        // Filtrar
        const hoy = getDiaActual();
        habitosHoy = habitosActuales.filter(h => h.dias && h.dias.includes(hoy));
        otrosHabitos = habitosActuales.filter(h => !h.dias || !h.dias.includes(hoy));

        // Mostrar pestaña actual
        cambiarPestana(pestanaActual);
        // dentro de cargarDashboard, después de cambiarPestana
        cambiarVista('habitos'); // esto ocultará progreso si estaba visible y mostrará hábitos
    } catch (err) {
        console.error(err);
        mostrarError('No se pudieron cargar los hábitos');
    } finally {
        mostrarLoading(false);
    }
}

async function actualizarEstadisticas(usuarioId) {
    try {
        const token = localStorage.getItem('token');
        const res = await fetch(`http://localhost:3000/api/habitos/estadisticas?usuarioId=${encodeURIComponent(usuarioId)}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!res.ok) throw new Error('Error al cargar estadísticas');
        const stats = await res.json();
        document.getElementById('stats-activos').textContent = stats.habitosActivos ?? 0;
        document.getElementById('stats-completados').textContent = stats.completadosHoy ?? 0;
        if (stats.mejorRacha?.valor > 0) {
            document.getElementById('stats-mejor-valor').textContent = stats.mejorRacha.valor;
            document.getElementById('stats-mejor-nombre').textContent = stats.mejorRacha.nombre;
        } else {
            document.getElementById('stats-mejor-valor').textContent = 0;
            document.getElementById('stats-mejor-nombre').textContent = 'Mejor racha';
        }
    } catch (err) {
        console.error(err);
    }
}

function mostrarHabitos(habitos, mostrarBotonCompletar) {
    const grid = document.getElementById('habits-grid');
    if (!grid) return;
    if (habitos.length === 0) {
        grid.innerHTML = `<div class="empty-state card"><i class="fa-solid fa-list-check"></i><p>No hay hábitos en esta sección</p></div>`;
        return;
    }
    grid.innerHTML = habitos.map(h => renderHabitCard(h, mostrarBotonCompletar)).join('');
}

function renderHabitCard(h, mostrarBotonCompletar) {
    const hora = h.hora_objetivo ? `<span class="hora">🕐 ${h.hora_objetivo.substring(0, 5)}</span>` : '';
    const completadoHoy = h.completado_hoy || false;
    const botonMarcar = mostrarBotonCompletar ?
        `<button class="complete-btn ${completadoHoy ? 'completed' : ''}" onclick="marcarCompletado(${h.id})">${completadoHoy ? 'Completado ✓' : 'Marcar'}</button>` :
        ''; // Sin botón en "Todos los hábitos"

    return `
    <div class="habit-card card" data-id="${h.id}">
        <div class="habit-left">
            <h3>${getIconoPorCategoria(h.categoria_nombre)} ${escapeHtml(h.nombre)}</h3>
            <p>${formatearDias(h.dias)} ${hora}</p>
            ${h.descripcion ? `<small>${escapeHtml(h.descripcion)}</small>` : ''}
        </div>
        <div class="habit-right">
            <div class="racha"><small>Racha</small><strong>${h.racha_actual || 0}</strong><small>mejor ${h.mejor_racha || 0}</small></div>
            <div class="habit-actions">
                ${botonMarcar}
                <button class="icon-btn" onclick="abrirModalEditarHabito(${h.id})"><i class="fa-solid fa-pen"></i></button>
                <button class="icon-btn danger" onclick="confirmarEliminar(${h.id})"><i class="fa-solid fa-trash"></i></button>
            </div>
        </div>
    </div>`;
}

function getIconoPorCategoria(cat) {
    const iconos = { Salud: '💪', Lectura: '📖', Alimentación: '🥗', Ejercicio: '🏃', Meditación: '🧘', default: '✓' };
    return iconos[cat] || iconos.default;
}
function formatearDias(dias) {
    if (!dias || dias.length === 0) return 'Diario';
    const mapa = { 1: 'Lun', 2: 'Mar', 3: 'Mié', 4: 'Jue', 5: 'Vie', 6: 'Sáb', 7: 'Dom' };
    if (dias.length === 7) return 'Diario';
    if (dias.length === 5 && !dias.includes(6) && !dias.includes(7)) return 'Lunes a Viernes';
    return dias.map(d => mapa[d]).join(', ');
}
function escapeHtml(s) { return String(s).replace(/[&<>"']/g, function (m) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[m]; }); }

// Acciones
async function marcarCompletado(id) {
    try {
        const usuario = JSON.parse(localStorage.getItem('usuario'));
        const token = localStorage.getItem('token');
        const res = await fetch('http://localhost:3000/api/habitos/registros', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({ habitoId: id })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Error');
        await cargarDashboard(usuario.id);
        mostrarMensaje('¡Completado!', 'success');
    } catch (err) {
        console.error(err);
        mostrarError(err.message);
    }
}
async function eliminarHabito(id) {
    try {
        mostrarLoading(true);
        const token = localStorage.getItem('token');
        const usuario = JSON.parse(localStorage.getItem('usuario'));
        const res = await fetch(`http://localhost:3000/api/habitos/${id}`, { method: 'DELETE', headers: { 'Authorization': `Bearer ${token}` } });
        if (!res.ok) throw new Error('Error al eliminar');
        await cargarDashboard(usuario.id);
        mostrarMensaje('Eliminado', 'success');
    } catch (err) {
        console.error(err);
        mostrarError(err.message);
    } finally {
        mostrarLoading(false);
    }
}
function confirmarEliminar(id) {
    confirmCallback = () => eliminarHabito(id);
    document.getElementById('confirm-titulo').textContent = '¿Eliminar hábito?';
    document.getElementById('confirm-mensaje').textContent = 'Esta acción no se puede deshacer';
    abrirModal('modal-confirmar');
}

// Editar
async function abrirModalEditarHabito(id) {
    try {
        mostrarLoading(true);
        const habito = habitosActuales.find(h => h.id === id);
        if (!habito) throw new Error('No encontrado');

        const diasHTML = [1, 2, 3, 4, 5, 6, 7].map(d => {
            const checked = habito.dias?.includes(d) ? 'checked' : '';
            return `<label><input type="checkbox" value="${d}" ${checked}> ${['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'][d - 1]}</label>`;
        }).join('');
        document.getElementById('edit-dias-container').innerHTML = diasHTML;

        document.getElementById('edit-id').value = habito.id;
        document.getElementById('edit-nombre').value = habito.nombre;
        document.getElementById('edit-descripcion').value = habito.descripcion || '';
        // Si la categoría no existe en el select (p.ej. recién creada), recargamos
        poblarSelectCategorias('edit-categoria', { incluirVacio: true });
        const cat = habito.categoria_nombre || 'Otros';
        const selectEdit = document.getElementById('edit-categoria');
        if (selectEdit && !Array.from(selectEdit.options).some(o => o.value === cat)) {
            const opt = document.createElement('option');
            opt.value = cat;
            opt.textContent = cat;
            selectEdit.appendChild(opt);
        }
        document.getElementById('edit-categoria').value = cat;
        document.getElementById('edit-todos-dias').checked = (habito.dias?.length === 7);

        const checkboxes = document.querySelectorAll('#edit-dias-container input[type="checkbox"]');
        const todosDias = document.getElementById('edit-todos-dias');
        if (todosDias.checked) {
            checkboxes.forEach(cb => { cb.checked = true; cb.disabled = true; });
        } else {
            checkboxes.forEach(cb => { cb.disabled = false; });
        }

        if (habito.hora_objetivo) {
            const t = habito.hora_objetivo;
            if (['07:00:00', '12:00:00', '18:00:00'].includes(t)) {
                seleccionarPreset('edit', t);
            } else {
                seleccionarPreset('edit', 'custom');
                document.getElementById('edit-time-input').value = t.substring(0, 5);
                document.getElementById('edit-time-display').textContent = t.substring(0, 5);
                document.getElementById('edit-time-selected').value = t;
            }
        } else {
            seleccionarPreset('edit', 'none');
        }

        abrirModal('modal-editar-habito');
    } catch (err) {
        console.error(err);
        mostrarError('Error al cargar el hábito');
    } finally {
        mostrarLoading(false);
    }
}

// Guardar nuevo
async function guardarHabito(e) {
    e.preventDefault();
    const usuario = JSON.parse(localStorage.getItem('usuario'));
    const token = localStorage.getItem('token');
    const dias = [];
    if (document.getElementById('habito-todos-dias').checked) {
        for (let i = 1; i <= 7; i++) dias.push(i);
    } else {
        document.querySelectorAll('#nuevo-dias-container input:checked').forEach(cb => dias.push(parseInt(cb.value)));
        if (dias.length === 0) { mostrarError('Selecciona al menos un día'); return; }
    }
    const data = {
        nombre: document.getElementById('habito-nombre').value.trim(),
        descripcion: document.getElementById('habito-descripcion').value.trim(),
        categoria: document.getElementById('habito-categoria').value,
        hora_objetivo: readTimeFromForm('habito'),
        dias,
        usuarioId: usuario.id
    };
    const btn = e.target.querySelector('button[type="submit"]');
    const original = btn.textContent;
    btn.textContent = 'Guardando...';
    btn.disabled = true;
    try {
        const res = await fetch('http://localhost:3000/api/habitos', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify(data)
        });
        if (!res.ok) throw new Error('Error al crear');
        cerrarModal('modal-nuevo-habito');
        await cargarDashboard(usuario.id);
        mostrarMensaje('Creado', 'success');
    } catch (err) {
        console.error(err);
        mostrarError(err.message);
    } finally {
        btn.textContent = original;
        btn.disabled = false;
    }
}

// Guardar edición
async function guardarEdicionHabito(e) {
    e.preventDefault();
    const usuario = JSON.parse(localStorage.getItem('usuario'));
    const token = localStorage.getItem('token');
    const id = document.getElementById('edit-id').value;
    const dias = [];
    if (document.getElementById('edit-todos-dias').checked) {
        for (let i = 1; i <= 7; i++) dias.push(i);
    } else {
        document.querySelectorAll('#edit-dias-container input:checked').forEach(cb => dias.push(parseInt(cb.value)));
        if (dias.length === 0) { mostrarError('Selecciona al menos un día'); return; }
    }
    const data = {
        nombre: document.getElementById('edit-nombre').value.trim(),
        descripcion: document.getElementById('edit-descripcion').value.trim(),
        categoria: document.getElementById('edit-categoria').value,
        hora_objetivo: readTimeFromForm('edit'),
        dias,
        usuarioId: usuario.id
    };
    const btn = e.target.querySelector('button[type="submit"]');
    const original = btn.textContent;
    btn.textContent = 'Guardando...';
    btn.disabled = true;
    try {
        const res = await fetch(`http://localhost:3000/api/habitos/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify(data)
        });
        if (!res.ok) throw new Error('Error al actualizar');
        cerrarModal('modal-editar-habito');
        await cargarDashboard(usuario.id);
        mostrarMensaje('Actualizado', 'success');
    } catch (err) {
        console.error(err);
        mostrarError(err.message);
    } finally {
        btn.textContent = original;
        btn.disabled = false;
    }
}

function readTimeFromForm(prefix) {
    const val = document.getElementById(`${prefix}-time-selected`).value;
    return val === 'none' ? null : val;
}

function initTimeSelectors() {
    seleccionarPreset('habito', 'none');
    seleccionarPreset('edit', 'none');
}

// Utilidades UI
function mostrarLoading(show) {
    let loader = document.querySelector('.global-loader');
    if (show) {
        if (!loader) {
            loader = document.createElement('div');
            loader.className = 'global-loader';
            loader.innerHTML = '<div class="spinner"></div>';
            document.body.appendChild(loader);
        }
    } else {
        if (loader) loader.remove();
    }
}
function mostrarMensaje(texto, tipo) {
    const msg = document.createElement('div');
    msg.className = `mensaje-flotante ${tipo}`;
    msg.innerHTML = `<i class="fa-solid ${tipo === 'success' ? 'fa-check-circle' : 'fa-exclamation-circle'}"></i><span>${texto}</span>`;
    document.body.appendChild(msg);
    setTimeout(() => { msg.classList.add('fade-out'); setTimeout(() => msg.remove(), 300); }, 3000);
}
function mostrarError(texto) { mostrarMensaje(texto, 'error'); }
function logout() { localStorage.removeItem('usuario'); localStorage.removeItem('token'); window.location.href = 'login.html'; }


function cambiarVista(vista) {
    vistaActual = vista;
    // Actualizar clase active en el sidebar
    document.querySelectorAll('.sidebar li').forEach(li => li.classList.remove('active'));
    if (vista === 'habitos') {
        document.getElementById('menu-habitos').classList.add('active');
        document.getElementById('habits-grid').style.display = 'grid';
        document.getElementById('progress-view').style.display = 'none';
        document.querySelector('.tab-bar').style.display = 'flex'; // mostrar pestañas
        // Recargar hábitos si es necesario (ya están cargados)
    } else {
        document.getElementById('menu-progreso').classList.add('active');
        document.getElementById('habits-grid').style.display = 'none';
        document.getElementById('progress-view').style.display = 'block';
        document.querySelector('.tab-bar').style.display = 'none'; // ocultar pestañas
        cargarProgreso();
    }
}

async function cargarProgreso() {
    try {
        mostrarLoading(true);
        const token = localStorage.getItem('token');
        const res = await fetch('http://localhost:3000/api/progreso', {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!res.ok) throw new Error('Error al cargar progreso');
        const data = await res.json();
        mostrarProgreso(data);
    } catch (err) {
        console.error(err);
        mostrarError('No se pudo cargar el progreso');
    } finally {
        mostrarLoading(false);
    }
}

function mostrarProgreso(data) {
    // Actualizar estadísticas superiores (reutilizamos las mismas tarjetas)
    document.getElementById('stats-activos').textContent = data.estadisticas.habitosActivos ?? 0;
    document.getElementById('stats-completados').textContent = data.estadisticas.completadosHoy ?? 0;
    if (data.estadisticas.mejorRachaGlobal > 0) {
        document.getElementById('stats-mejor-valor').textContent = data.estadisticas.mejorRachaGlobal;
        document.getElementById('stats-mejor-nombre').textContent = 'Mejor racha histórica';
    } else {
        document.getElementById('stats-mejor-valor').textContent = 0;
        document.getElementById('stats-mejor-nombre').textContent = 'Mejor racha';
    }

    // Resumen 30 días (nuevo)
    const header = document.querySelector('#progress-view .progress-header');
    if (header) {
        const resumen = data.resumen30d || { objetivos: 0, completados: 0, porcentaje: 0, a_tiempo: 0, tarde: 0 };
        const existing = document.getElementById('resumen-30d');
        const html = `
            <div class="stats" id="resumen-30d">
                <div class="stat-card">
                    <h3>${resumen.porcentaje ?? 0}%</h3>
                    <p>Cumplimiento (30d)</p>
                </div>
                <div class="stat-card">
                    <h3>${resumen.completados ?? 0}/${resumen.objetivos ?? 0}</h3>
                    <p>Completados/Objetivos</p>
                </div>
                <div class="stat-card">
                    <h3>${resumen.a_tiempo ?? 0}</h3>
                    <p>A tiempo (30d)</p>
                </div>
                <div class="stat-card">
                    <h3>${resumen.tarde ?? 0}</h3>
                    <p>Tarde (30d)</p>
                </div>
            </div>
            <div class="chart-container card" style="margin-top:16px;">
                <canvas id="estadoChart"></canvas>
            </div>
        `;
        if (existing) existing.outerHTML = html;
        else header.insertAdjacentHTML('afterend', html);

        const ctxEstado = document.getElementById('estadoChart')?.getContext('2d');
        if (ctxEstado) {
            if (estadoChart) estadoChart.destroy();
            estadoChart = new Chart(ctxEstado, {
                type: 'doughnut',
                data: {
                    labels: ['A tiempo', 'Tarde'],
                    datasets: [{
                        data: [resumen.a_tiempo || 0, resumen.tarde || 0],
                        backgroundColor: ['#10b981', '#f59e0b']
                    }]
                },
                options: {
                    plugins: { legend: { position: 'bottom' } }
                }
            });
        }
    }

    // Gráfico semanal
    if (weeklyChart) weeklyChart.destroy();
    const ctx = document.getElementById('weeklyChart').getContext('2d');
    const fechas = data.progresoSemanal.map(item => {
        const d = new Date(item.fecha);
        return d.toLocaleDateString('es', { weekday: 'short', day: 'numeric' });
    });
    const completados = data.progresoSemanal.map(item => item.completados);

    weeklyChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: fechas,
            datasets: [{
                label: 'Hábitos completados',
                data: completados,
                backgroundColor: 'rgba(102, 126, 234, 0.7)',
                borderRadius: 8
            }]
        },
        options: {
            responsive: true,
            plugins: {
                legend: { display: false }
            },
            scales: {
                y: { beginAtZero: true, stepSize: 1 }
            }
        }
    });

    // Categorías (top por completados 30d)
    const maxCat = Math.max(1, ...(data.categorias || []).map(c => c.completados || 0));
    const categoryHTML = (data.categorias || []).map(cat => {
        const pct = Math.round(((cat.completados || 0) / maxCat) * 100);
        return `
            <div class="category-bar-item">
                <span class="category-bar-label">${escapeHtml(cat.nombre)}</span>
                <div class="category-bar-progress">
                    <div class="category-bar-fill" style="width: ${pct}%;">
                        ${cat.completados || 0}
                    </div>
                </div>
            </div>
        `;
    }).join('');
    document.getElementById('category-bars').innerHTML = categoryHTML || '<p>No hay datos de categorías</p>';

    // Tabla de hábitos
    const tableBody = data.habitos.map(h => {
        const porcentaje = h.porcentajeCumplimiento !== undefined ? h.porcentajeCumplimiento.toFixed(1) + '%' : '-';
        return `
            <tr>
                <td><strong>${escapeHtml(h.nombre)}</strong></td>
                <td><span class="badge">${escapeHtml(h.categoria || 'Sin categoría')}</span></td>
                <td>${h.racha_actual}</td>
                <td>${h.mejor_racha}</td>
                <td>${h.totalCompletados}</td>
                <td>${porcentaje}</td>
            </tr>
        `;
    }).join('');
    document.getElementById('progress-table-body').innerHTML = tableBody || '<tr><td colspan="6" style="text-align:center;">No hay hábitos</td></tr>';
}


// Hacer globales algunas funciones
window.marcarCompletado = marcarCompletado;
window.abrirModalEditarHabito = abrirModalEditarHabito;
window.confirmarEliminar = confirmarEliminar;
window.abrirModal = abrirModal;