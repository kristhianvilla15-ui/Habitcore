// ========== VARIABLES GLOBALES ==========
let confirmCallback = null;

// ========== INICIALIZACIÓN ==========
document.addEventListener('DOMContentLoaded', async () => {
    const usuario = JSON.parse(localStorage.getItem('usuario'));
    const token = localStorage.getItem('token');

    if (!usuario || !token || usuario.rol !== 'admin') {
        window.location.href = 'login.html';
        return;
    }

    document.getElementById('nombre-admin').textContent = usuario.nombre_usuario;

    configurarEventListeners();
    cargarVista('dashboard'); // Por defecto, mostrar dashboard
});

// ========== CONFIGURAR EVENTOS ==========
function configurarEventListeners() {
    // Menú
    document.getElementById('menu-admin-dashboard').addEventListener('click', () => cargarVista('dashboard'));
    document.getElementById('menu-admin-usuarios').addEventListener('click', () => cargarVista('usuarios'));
    document.getElementById('menu-admin-categorias').addEventListener('click', () => cargarVista('categorias'));
    document.getElementById('menu-admin-habitos').addEventListener('click', () => cargarVista('habitos'));
    document.getElementById('menu-admin-registros').addEventListener('click', () => cargarVista('registros'));
    document.getElementById('btn-cerrar-sesion').addEventListener('click', logout);

    // Cerrar modales
    document.getElementById('cerrar-modal-usuario').addEventListener('click', () => cerrarModal('modal-usuario'));
    document.getElementById('cancelar-modal-usuario').addEventListener('click', () => cerrarModal('modal-usuario'));
    document.getElementById('cerrar-modal-categoria').addEventListener('click', () => cerrarModal('modal-categoria'));
    document.getElementById('cancelar-modal-categoria').addEventListener('click', () => cerrarModal('modal-categoria'));
    document.getElementById('cerrar-confirmar').addEventListener('click', () => cerrarModal('modal-confirmar'));
    document.getElementById('cancelar-confirmar').addEventListener('click', () => cerrarModal('modal-confirmar'));

    // Formularios
    document.getElementById('form-usuario').addEventListener('submit', guardarUsuario);
    document.getElementById('form-categoria').addEventListener('submit', guardarCategoria);
    document.getElementById('confirmar-accion').addEventListener('click', () => {
        if (confirmCallback) {
            confirmCallback();
            cerrarModal('modal-confirmar');
        }
    });
}

// ========== CAMBIAR VISTA ==========
function cargarVista(vista) {
    // Actualizar clase active en el menú
    document.querySelectorAll('.sidebar li').forEach(li => li.classList.remove('active'));
    document.getElementById(`menu-admin-${vista}`).classList.add('active');

    const content = document.getElementById('admin-content');

    if (vista === 'dashboard') {
        content.innerHTML = '<div class="loading">Cargando dashboard...</div>';
        cargarDashboardAdmin();
    } else if (vista === 'usuarios') {
        content.innerHTML = '<div class="loading">Cargando usuarios...</div>';
        cargarUsuarios();
    } else if (vista === 'categorias') {
        content.innerHTML = '<div class="loading">Cargando categorías...</div>';
        cargarCategorias();
    } else if (vista === 'habitos') {
        content.innerHTML = '<div class="loading">Cargando hábitos...</div>';
        cargarHabitosAdmin();
    } else if (vista === 'registros') {
        content.innerHTML = '<div class="loading">Cargando registros...</div>';
        cargarRegistrosAdmin();
    }
}

// ========== DASHBOARD ==========
async function cargarDashboardAdmin() {
    try {
        const token = localStorage.getItem('token');
        console.log('Token enviado:', token);
        const res = await fetch('https://habitcore.onrender.com/api/admin/estadisticas', {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!res.ok) throw new Error('Error al cargar estadísticas');
        const data = await res.json();
        mostrarDashboardAdmin(data);
    } catch (error) {
        console.error(error);
        document.getElementById('admin-content').innerHTML = '<p class="error">Error al cargar el dashboard</p>';
    }
}

function mostrarDashboardAdmin(data) {
    const content = document.getElementById('admin-content');
    content.innerHTML = `
        <div class="stats">
            <div class="stat-card">
                <h3>${data.totalUsuarios}</h3>
                <p>Usuarios</p>
            </div>
            <div class="stat-card">
                <h3>${data.totalHabitos}</h3>
                <p>Hábitos</p>
            </div>
            <div class="stat-card">
                <h3>${data.totalRegistros}</h3>
                <p>Registros</p>
            </div>
            <div class="stat-card">
                <h3>${data.totalCategorias}</h3>
                <p>Categorías</p>
            </div>
        </div>
        <div class="chart-container">
            <canvas id="adminChart"></canvas>
        </div>
    `;
    // Opcional: dibujar una gráfica simple
    const ctx = document.getElementById('adminChart')?.getContext('2d');
    if (ctx) {
        new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: ['Usuarios', 'Hábitos', 'Registros', 'Categorías'],
                datasets: [{
                    data: [data.totalUsuarios, data.totalHabitos, data.totalRegistros, data.totalCategorias],
                    backgroundColor: ['#10b981', '#34d399', '#3b82f6', '#f59e0b']
                }]
            }
        });
    }
}

// ========== USUARIOS ==========
async function cargarUsuarios() {
    try {
        const token = localStorage.getItem('token');
        const buscar = document.getElementById('filter-usuarios-buscar')?.value || '';
        const rol = document.getElementById('filter-usuarios-rol')?.value || '';
        const fechaDesde = document.getElementById('filter-usuarios-fecha-desde')?.value || '';
        const fechaHasta = document.getElementById('filter-usuarios-fecha-hasta')?.value || '';
        const params = new URLSearchParams();
        if (buscar) params.set('buscar', buscar);
        if (rol) params.set('rol', rol);
        if (fechaDesde) params.set('fecha_desde', fechaDesde);
        if (fechaHasta) params.set('fecha_hasta', fechaHasta);
        const qs = params.toString();
        const url = 'https://habitcore.onrender.com/api/admin/usuarios' + (qs ? '?' + qs : '');
        const res = await fetch(url, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!res.ok) throw new Error('Error al cargar usuarios');
        const usuarios = await res.json();
        mostrarUsuarios(usuarios, { buscar, rol, fechaDesde, fechaHasta });
    } catch (error) {
        console.error(error);
        document.getElementById('admin-content').innerHTML = '<p class="error">Error al cargar usuarios</p>';
    }
}

function mostrarUsuarios(usuarios, filters = {}) {
    const content = document.getElementById('admin-content');
    let html = `
        <div class="admin-header">
            <h3>Gestión de Usuarios</h3>
            <button class="btn-primary" onclick="abrirModalUsuario()">
                <i class="fa-solid fa-plus"></i> Nuevo usuario
            </button>
        </div>
        <div class="filtros-admin">
            <input type="text" id="filter-usuarios-buscar" placeholder="Buscar por nombre o email" value="${escapeHtml(filters.buscar || '')}">
            <select id="filter-usuarios-rol">
                <option value="">Todos los roles</option>
                <option value="usuario" ${filters.rol === 'usuario' ? 'selected' : ''}>Usuario</option>
                <option value="admin" ${filters.rol === 'admin' ? 'selected' : ''}>Admin</option>
            </select>
            <input type="date" id="filter-usuarios-fecha-desde" value="${filters.fechaDesde || ''}">
            <input type="date" id="filter-usuarios-fecha-hasta" value="${filters.fechaHasta || ''}">
            <button class="btn-secondary" onclick="cargarUsuarios()"><i class="fa-solid fa-filter"></i> Filtrar</button>
        </div>
        <table class="admin-table">
            <thead>
                <tr>
                    <th>ID</th>
                    <th>Usuario</th>
                    <th>Email</th>
                    <th>Rol</th>
                    <th>Fecha registro</th>
                    <th>Acciones</th>
                </tr>
            </thead>
            <tbody>
    `;
    usuarios.forEach(u => {
        html += `
            <tr>
                <td>${u.id}</td>
                <td>${escapeHtml(u.nombre_usuario)}</td>
                <td>${escapeHtml(u.email)}</td>
                <td><span class="badge ${u.rol === 'admin' ? 'admin' : ''}">${u.rol}</span></td>
                <td>${new Date(u.fecha_creacion).toLocaleDateString()}</td>
                <td>
                    <button class="icon-btn" onclick="editarUsuario(${u.id})">
                        <i class="fa-solid fa-pen"></i>
                    </button>
                    <button class="icon-btn danger" onclick="confirmarEliminarUsuario(${u.id}, '${u.nombre_usuario}')">
                        <i class="fa-solid fa-trash"></i>
                    </button>
                </td>
            </tr>
        `;
    });
    html += '</tbody></table>';
    content.innerHTML = html;
}

// Funciones para usuarios
window.abrirModalUsuario = () => {
    document.getElementById('modal-usuario-titulo').textContent = 'Nuevo usuario';
    document.getElementById('usuario-id').value = '';
    document.getElementById('usuario-nombre').value = '';
    document.getElementById('usuario-email').value = '';
    document.getElementById('usuario-password').value = '';
    document.getElementById('usuario-rol').value = 'usuario';
    abrirModal('modal-usuario');
};

async function guardarUsuario(e) {
    e.preventDefault();
    const id = document.getElementById('usuario-id').value;
    const data = {
        nombre_usuario: document.getElementById('usuario-nombre').value.trim(),
        email: document.getElementById('usuario-email').value.trim(),
        password: document.getElementById('usuario-password').value || undefined,
        rol: document.getElementById('usuario-rol').value
    };
    const token = localStorage.getItem('token');
    const url = id ? `https://habitcore.onrender.com/api/admin/usuarios/${id}` : 'https://habitcore.onrender.com/api/admin/usuarios';
    const method = id ? 'PUT' : 'POST';
    try {
        const res = await fetch(url, {
            method,
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify(data)
        });
        if (res.ok) {
            cerrarModal('modal-usuario');
            cargarUsuarios();
        } else {
            const err = await res.json();
            alert(err.error || 'Error al guardar');
        }
    } catch (error) {
        console.error(error);
        alert('Error de conexión');
    }
}

async function editarUsuario(id) {
    try {
        const token = localStorage.getItem('token');
        const res = await fetch(`https://habitcore.onrender.com/api/admin/usuarios/${id}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const usuario = await res.json();
        document.getElementById('modal-usuario-titulo').textContent = 'Editar usuario';
        document.getElementById('usuario-id').value = usuario.id;
        document.getElementById('usuario-nombre').value = usuario.nombre_usuario;
        document.getElementById('usuario-email').value = usuario.email;
        document.getElementById('usuario-password').value = '';
        document.getElementById('usuario-rol').value = usuario.rol;
        abrirModal('modal-usuario');
    } catch (error) {
        console.error(error);
        alert('Error al cargar usuario');
    }
}

function confirmarEliminarUsuario(id, nombre) {
    confirmCallback = async () => {
        try {
            const token = localStorage.getItem('token');
            const res = await fetch(`https://habitcore.onrender.com/api/admin/usuarios/${id}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (res.ok) {
                cargarUsuarios();
            } else {
                alert('Error al eliminar');
            }
        } catch (error) {
            console.error(error);
        }
    };
    document.getElementById('confirm-titulo').textContent = 'Eliminar usuario';
    document.getElementById('confirm-mensaje').textContent = `¿Estás seguro de eliminar a ${nombre}?`;
    abrirModal('modal-confirmar');
}

// ========== CATEGORÍAS ==========
async function cargarCategorias() {
    try {
        const token = localStorage.getItem('token');
        const buscar = document.getElementById('filter-categorias-buscar')?.value || '';
        const params = buscar ? '?buscar=' + encodeURIComponent(buscar) : '';
        const res = await fetch('https://habitcore.onrender.com/api/admin/categorias' + params, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!res.ok) throw new Error('Error al cargar categorías');
        const categorias = await res.json();
        mostrarCategorias(categorias, { buscar });
    } catch (error) {
        console.error(error);
        document.getElementById('admin-content').innerHTML = '<p class="error">Error al cargar categorías</p>';
    }
}

function mostrarCategorias(categorias, filters = {}) {
    const content = document.getElementById('admin-content');
    let html = `
        <div class="admin-header">
            <h3>Gestión de Categorías</h3>
            <button class="btn-primary" onclick="abrirModalCategoria()">
                <i class="fa-solid fa-plus"></i> Nueva categoría
            </button>
        </div>
        <div class="filtros-admin">
            <input type="text" id="filter-categorias-buscar" placeholder="Buscar por nombre o descripción" value="${escapeHtml(filters.buscar || '')}">
            <button class="btn-secondary" onclick="cargarCategorias()"><i class="fa-solid fa-filter"></i> Filtrar</button>
        </div>
        <table class="admin-table">
            <thead>
                <tr>
                    <th>ID</th>
                    <th>Nombre</th>
                    <th>Descripción</th>
                    <th>Acciones</th>
                </tr>
            </thead>
            <tbody>
    `;
    categorias.forEach(c => {
        html += `
            <tr>
                <td>${c.id}</td>
                <td>${escapeHtml(c.nombre)}</td>
                <td>${escapeHtml(c.descripcion || '')}</td>
                <td>
                    <button class="icon-btn" onclick="editarCategoria(${c.id})">
                        <i class="fa-solid fa-pen"></i>
                    </button>
                    <button class="icon-btn danger" onclick="confirmarEliminarCategoria(${c.id}, '${c.nombre}')">
                        <i class="fa-solid fa-trash"></i>
                    </button>
                </td>
            </tr>
        `;
    });
    html += '</tbody></table>';
    content.innerHTML = html;
}

window.abrirModalCategoria = () => {
    document.getElementById('modal-categoria-titulo').textContent = 'Nueva categoría';
    document.getElementById('categoria-id').value = '';
    document.getElementById('categoria-nombre').value = '';
    document.getElementById('categoria-descripcion').value = '';
    abrirModal('modal-categoria');
};

async function guardarCategoria(e) {
    e.preventDefault();
    const id = document.getElementById('categoria-id').value;
    const data = {
        nombre: document.getElementById('categoria-nombre').value.trim(),
        descripcion: document.getElementById('categoria-descripcion').value.trim() || null
    };
    const token = localStorage.getItem('token');
    const url = id ? `https://habitcore.onrender.com/api/admin/categorias/${id}` : 'http://localhost:3000/api/admin/categorias';
    const method = id ? 'PUT' : 'POST';
    try {
        const res = await fetch(url, {
            method,
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify(data)
        });
        if (res.ok) {
            cerrarModal('modal-categoria');
            cargarCategorias();
        } else {
            const err = await res.json();
            alert(err.error || 'Error al guardar');
        }
    } catch (error) {
        console.error(error);
        alert('Error de conexión');
    }
}

async function editarCategoria(id) {
    try {
        const token = localStorage.getItem('token');
        const res = await fetch(`http://localhost:3000/api/admin/categorias/${id}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const categoria = await res.json();
        document.getElementById('modal-categoria-titulo').textContent = 'Editar categoría';
        document.getElementById('categoria-id').value = categoria.id;
        document.getElementById('categoria-nombre').value = categoria.nombre;
        document.getElementById('categoria-descripcion').value = categoria.descripcion || '';
        abrirModal('modal-categoria');
    } catch (error) {
        console.error(error);
        alert('Error al cargar categoría');
    }
}

function confirmarEliminarCategoria(id, nombre) {
    confirmCallback = async () => {
        try {
            const token = localStorage.getItem('token');
            const res = await fetch(`http://localhost:3000/api/admin/categorias/${id}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (res.ok) {
                cargarCategorias();
            } else {
                alert('Error al eliminar');
            }
        } catch (error) {
            console.error(error);
        }
    };
    document.getElementById('confirm-titulo').textContent = 'Eliminar categoría';
    document.getElementById('confirm-mensaje').textContent = `¿Estás seguro de eliminar "${nombre}"?`;
    abrirModal('modal-confirmar');
}

// ========== HÁBITOS (todos los usuarios) ==========
async function cargarHabitosAdmin() {
    try {
        const token = localStorage.getItem('token');
        const headers = { 'Authorization': `Bearer ${token}` };
        const usuarioId = document.getElementById('filter-habitos-usuario')?.value || '';
        const categoriaId = document.getElementById('filter-habitos-categoria')?.value || '';
        const fechaDesde = document.getElementById('filter-habitos-fecha-desde')?.value || '';
        const fechaHasta = document.getElementById('filter-habitos-fecha-hasta')?.value || '';
        const params = new URLSearchParams();
        if (usuarioId) params.set('usuario_id', usuarioId);
        if (categoriaId) params.set('categoria_id', categoriaId);
        if (fechaDesde) params.set('fecha_desde', fechaDesde);
        if (fechaHasta) params.set('fecha_hasta', fechaHasta);
        const qs = params.toString();
        const [resHab, resUsu, resCat] = await Promise.all([
            fetch('https://habitcore.onrender.com/api/admin/habitos' + (qs ? '?' + qs : ''), { headers }),
            fetch('https://habitcore.onrender.com/admin/usuarios', { headers }),
            fetch('https://habitcore.onrender.com/api/admin/categorias', { headers })
        ]);
        if (!resHab.ok) throw new Error('Error al cargar hábitos');
        const [habitos, usuarios, categorias] = await Promise.all([
            resHab.json(),
            resUsu.json(),
            resCat.json()
        ]);
        const filters = { usuarioId, categoriaId, fechaDesde, fechaHasta };
        mostrarHabitosAdmin(habitos, usuarios, categorias, filters);
    } catch (error) {
        console.error(error);
        document.getElementById('admin-content').innerHTML = '<p class="error">Error al cargar hábitos</p>';
    }
}

function mostrarHabitosAdmin(habitos, usuarios = [], categorias = [], filters = {}) {
    const content = document.getElementById('admin-content');
    const usuarioOptions = usuarios.map(u => `<option value="${u.id}" ${filters.usuarioId == u.id ? 'selected' : ''}>${escapeHtml(u.nombre_usuario)}</option>`).join('');
    const categoriaOptions = categorias.map(c => `<option value="${c.id}" ${filters.categoriaId == c.id ? 'selected' : ''}>${escapeHtml(c.nombre)}</option>`).join('');
    let html = `
        <div class="admin-header">
            <h3>Todos los hábitos</h3>
        </div>
        <div class="filtros-admin">
            <select id="filter-habitos-usuario">
                <option value="">Todos los usuarios</option>
                ${usuarioOptions}
            </select>
            <select id="filter-habitos-categoria">
                <option value="">Todas las categorías</option>
                ${categoriaOptions}
            </select>
            <input type="date" id="filter-habitos-fecha-desde" value="${filters.fechaDesde || ''}">
            <input type="date" id="filter-habitos-fecha-hasta" value="${filters.fechaHasta || ''}">
            <button class="btn-secondary" onclick="cargarHabitosAdmin()"><i class="fa-solid fa-filter"></i> Filtrar</button>
        </div>
        <table class="admin-table">
            <thead>
                <tr>
                    <th>ID</th>
                    <th>Usuario</th>
                    <th>Nombre</th>
                    <th>Categoría</th>
                    <th>Meta diaria</th>
                    <th>Fecha creación</th>
                </tr>
            </thead>
            <tbody>
    `;
    if (habitos.length === 0) {
        html += '<tr><td colspan="6">No hay hábitos que coincidan con los filtros.</td></tr>';
    }
    habitos.forEach(h => {
        html += `
            <tr>
                <td>${h.id}</td>
                <td>${escapeHtml(h.nombre_usuario)}</td>
                <td>${escapeHtml(h.nombre)}</td>
                <td>${escapeHtml(h.categoria_nombre || 'Sin categoría')}</td>
                <td>${h.meta_diaria}</td>
                <td>${new Date(h.fecha_creacion).toLocaleDateString()}</td>
            </tr>
        `;
    });
    html += '</tbody></table>';
    content.innerHTML = html;
}

// ========== REGISTROS / ACTIVIDAD ==========
async function cargarRegistrosAdmin() {
    try {
        const token = localStorage.getItem('token');
        const headers = { 'Authorization': `Bearer ${token}` };
        const fechaDesde = document.getElementById('filter-registros-fecha-desde')?.value || '';
        const fechaHasta = document.getElementById('filter-registros-fecha-hasta')?.value || '';
        const usuarioId = document.getElementById('filter-registros-usuario')?.value || '';
        const categoriaId = document.getElementById('filter-registros-categoria')?.value || '';
        const habitoId = document.getElementById('filter-registros-habito')?.value || '';
        const params = new URLSearchParams();
        if (fechaDesde) params.set('fecha_desde', fechaDesde);
        if (fechaHasta) params.set('fecha_hasta', fechaHasta);
        if (usuarioId) params.set('usuario_id', usuarioId);
        if (categoriaId) params.set('categoria_id', categoriaId);
        if (habitoId) params.set('habito_id', habitoId);
        const qs = params.toString();
        const [resReg, resUsu, resCat, resHab] = await Promise.all([
            fetch('https://habitcore.onrender.com/api/admin/registros' + (qs ? '?' + qs : ''), { headers }),
            fetch('https://habitcore.onrender.com/api/admin/usuarios', { headers }),
            fetch('https://habitcore.onrender.com/api/admin/categorias', { headers }),
            fetch('https://habitcore.onrender.com/api/admin/habitos', { headers })
        ]);
        if (!resReg.ok) throw new Error('Error al cargar registros');
        const [registros, usuarios, categorias, habitos] = await Promise.all([
            resReg.json(),
            resUsu.json(),
            resCat.json(),
            resHab.json()
        ]);
        const filters = { fechaDesde, fechaHasta, usuarioId, categoriaId, habitoId };
        mostrarRegistrosAdmin(registros, usuarios, categorias, habitos, filters);
    } catch (error) {
        console.error(error);
        document.getElementById('admin-content').innerHTML = '<p class="error">Error al cargar registros</p>';
    }
}

function mostrarRegistrosAdmin(registros, usuarios = [], categorias = [], habitos = [], filters = {}) {
    const content = document.getElementById('admin-content');
    const usuarioOptions = usuarios.map(u => `<option value="${u.id}" ${filters.usuarioId == u.id ? 'selected' : ''}>${escapeHtml(u.nombre_usuario)}</option>`).join('');
    const categoriaOptions = categorias.map(c => `<option value="${c.id}" ${filters.categoriaId == c.id ? 'selected' : ''}>${escapeHtml(c.nombre)}</option>`).join('');
    const habitoOptions = habitos.map(h => `<option value="${h.id}" ${filters.habitoId == h.id ? 'selected' : ''}>${escapeHtml(h.nombre)} (${escapeHtml(h.nombre_usuario)})</option>`).join('');
    let html = `
        <div class="admin-header">
            <h3>Registros de actividad</h3>
        </div>
        <div class="filtros-admin">
            <input type="date" id="filter-registros-fecha-desde" value="${filters.fechaDesde || ''}">
            <input type="date" id="filter-registros-fecha-hasta" value="${filters.fechaHasta || ''}">
            <select id="filter-registros-usuario">
                <option value="">Todos los usuarios</option>
                ${usuarioOptions}
            </select>
            <select id="filter-registros-categoria">
                <option value="">Todas las categorías</option>
                ${categoriaOptions}
            </select>
            <select id="filter-registros-habito">
                <option value="">Todos los hábitos</option>
                ${habitoOptions}
            </select>
            <button class="btn-secondary" onclick="cargarRegistrosAdmin()"><i class="fa-solid fa-filter"></i> Filtrar</button>
        </div>
        <table class="admin-table">
            <thead>
                <tr>
                    <th>Fecha</th>
                    <th>Hora</th>
                    <th>Usuario</th>
                    <th>Hábito</th>
                    <th>Categoría</th>
                    <th>Estado</th>
                </tr>
            </thead>
            <tbody>
    `;
    if (registros.length === 0) {
        html += '<tr><td colspan="6">No hay registros que coincidan con los filtros.</td></tr>';
    }
    registros.forEach(r => {
        html += `
            <tr>
                <td>${r.fecha}</td>
                <td>${r.hora_real || '-'}</td>
                <td>${escapeHtml(r.nombre_usuario)}</td>
                <td>${escapeHtml(r.habito_nombre)}</td>
                <td>${escapeHtml(r.categoria_nombre || 'Sin categoría')}</td>
                <td><span class="badge">${r.estado || 'a_tiempo'}</span></td>
            </tr>
        `;
    });
    html += '</tbody></table>';
    content.innerHTML = html;
}

// ========== UTILIDADES ==========
function abrirModal(id) {
    document.getElementById(id).style.display = 'flex';
}

function cerrarModal(id) {
    document.getElementById(id).style.display = 'none';
}

function escapeHtml(s) {
    if (!s) return '';
    return String(s).replace(/[&<>"']/g, function (m) {
        return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[m];
    });
}

function logout() {
    localStorage.removeItem('token');
    localStorage.removeItem('usuario');
    window.location.href = 'login.html';
}