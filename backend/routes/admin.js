// backend/routes/admin.js
const express = require('express');
const router = express.Router();
router.get('/ping', (req, res) => {
    res.json({ mensaje: 'Router de admin funcionando' });
});
const db = require('../config/db');
const verificarToken = require('../middleware/auth');
const verificarAdmin = require('../middleware/admin');
console.log('✅ Archivo admin.js cargado correctamente');
// Todas las rutas de admin requieren token y ser admin
router.use(verificarToken, verificarAdmin);
console.log('✅ Rutas de admin registradas');
// ========== ESTADÍSTICAS ==========
router.get('/estadisticas', async (req, res) => {
    try {
        const [rows] = await db.query(`
            SELECT 
                (SELECT COUNT(*) FROM usuarios) AS totalUsuarios,
                (SELECT COUNT(*) FROM habitos) AS totalHabitos,
                (SELECT COUNT(*) FROM registros) AS totalRegistros,
                (SELECT COUNT(*) FROM categorias) AS totalCategorias
        `);
        res.json(rows[0]);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ========== USUARIOS ==========
// Obtener usuarios (con filtros opcionales: rol, buscar, fecha_desde, fecha_hasta)
router.get('/usuarios', async (req, res) => {
    try {
        const { rol, buscar, fecha_desde, fecha_hasta } = req.query;
        let query = 'SELECT id, nombre_usuario, email, rol, fecha_creacion FROM usuarios WHERE 1=1';
        const params = [];

        if (rol) {
            query += ' AND rol = ?';
            params.push(rol);
        }
        if (buscar) {
            query += ' AND (nombre_usuario LIKE ? OR email LIKE ?)';
            const term = `%${buscar}%`;
            params.push(term, term);
        }
        if (fecha_desde) {
            query += ' AND DATE(fecha_creacion) >= ?';
            params.push(fecha_desde);
        }
        if (fecha_hasta) {
            query += ' AND DATE(fecha_creacion) <= ?';
            params.push(fecha_hasta);
        }
        query += ' ORDER BY fecha_creacion DESC';

        const [rows] = await db.execute(query, params);
        res.json(rows);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Obtener un usuario por ID
router.get('/usuarios/:id', async (req, res) => {
    try {
        const [rows] = await db.query('SELECT id, nombre_usuario, email, rol FROM usuarios WHERE id = ?', [req.params.id]);
        if (rows.length === 0) return res.status(404).json({ error: 'Usuario no encontrado' });
        res.json(rows[0]);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Crear usuario (admin)
router.post('/usuarios', async (req, res) => {
    try {
        const { nombre_usuario, email, password, rol } = req.body;
        if (!nombre_usuario || !email || !password || !rol) {
            return res.status(400).json({ error: 'Faltan campos' });
        }
        await db.execute(
            'INSERT INTO usuarios (nombre_usuario, email, password, rol) VALUES (?, ?, ?, ?)',
            [nombre_usuario, email, password, rol]
        );
        res.status(201).json({ message: 'Usuario creado' });
    } catch (error) {
        if (error.errno === 1062) return res.status(400).json({ error: 'Email ya existe' });
        res.status(500).json({ error: error.message });
    }
});

// Actualizar usuario (admin)
router.put('/usuarios/:id', async (req, res) => {
    try {
        const { nombre_usuario, email, password, rol } = req.body;
        let query = 'UPDATE usuarios SET nombre_usuario = ?, email = ?, rol = ?';
        const params = [nombre_usuario, email, rol];
        if (password) {
            query += ', password = ?';
            params.push(password);
        }
        query += ' WHERE id = ?';
        params.push(req.params.id);
        const [result] = await db.execute(query, params);
        if (result.affectedRows === 0) return res.status(404).json({ error: 'Usuario no encontrado' });
        res.json({ message: 'Usuario actualizado' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Eliminar usuario (admin)
router.delete('/usuarios/:id', async (req, res) => {
    try {
        const [result] = await db.execute('DELETE FROM usuarios WHERE id = ?', [req.params.id]);
        if (result.affectedRows === 0) return res.status(404).json({ error: 'Usuario no encontrado' });
        res.json({ message: 'Usuario eliminado' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ========== CATEGORÍAS ==========
// Obtener todas las categorías (con filtro opcional: buscar por nombre)
router.get('/categorias', async (req, res) => {
    try {
        const { buscar } = req.query;
        let query = 'SELECT * FROM categorias';
        const params = [];
        if (buscar) {
            query += ' WHERE nombre LIKE ? OR descripcion LIKE ?';
            const term = `%${buscar}%`;
            params.push(term, term);
        }
        query += ' ORDER BY nombre';
        const [rows] = params.length ? await db.execute(query, params) : await db.query(query);
        res.json(rows);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Obtener una categoría por ID
router.get('/categorias/:id', async (req, res) => {
    try {
        const [rows] = await db.query('SELECT * FROM categorias WHERE id = ?', [req.params.id]);
        if (rows.length === 0) return res.status(404).json({ error: 'Categoría no encontrada' });
        res.json(rows[0]);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Crear categoría
router.post('/categorias', async (req, res) => {
    try {
        const { nombre, descripcion } = req.body;
        if (!nombre) return res.status(400).json({ error: 'Nombre requerido' });
        await db.execute('INSERT INTO categorias (nombre, descripcion) VALUES (?, ?)', [nombre, descripcion || null]);
        res.status(201).json({ message: 'Categoría creada' });
    } catch (error) {
        if (error.errno === 1062) return res.status(400).json({ error: 'Nombre ya existe' });
        res.status(500).json({ error: error.message });
    }
});

// Actualizar categoría
router.put('/categorias/:id', async (req, res) => {
    try {
        const { nombre, descripcion } = req.body;
        if (!nombre) return res.status(400).json({ error: 'Nombre requerido' });
        const [result] = await db.execute(
            'UPDATE categorias SET nombre = ?, descripcion = ? WHERE id = ?',
            [nombre, descripcion || null, req.params.id]
        );
        if (result.affectedRows === 0) return res.status(404).json({ error: 'Categoría no encontrada' });
        res.json({ message: 'Categoría actualizada' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Eliminar categoría
router.delete('/categorias/:id', async (req, res) => {
    try {
        const [result] = await db.execute('DELETE FROM categorias WHERE id = ?', [req.params.id]);
        if (result.affectedRows === 0) return res.status(404).json({ error: 'Categoría no encontrada' });
        res.json({ message: 'Categoría eliminada' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ========== HÁBITOS (con filtros: usuario_id, categoria_id, fecha_desde, fecha_hasta) ==========
router.get('/habitos', async (req, res) => {
    try {
        const { usuario_id, categoria_id, fecha_desde, fecha_hasta } = req.query;
        let query = `
            SELECT h.*, u.nombre_usuario, c.nombre as categoria_nombre
            FROM habitos h
            JOIN usuarios u ON h.id_usuario = u.id
            LEFT JOIN categorias c ON h.categoria_id = c.id
            WHERE 1=1
        `;
        const params = [];

        if (usuario_id) {
            query += ' AND h.id_usuario = ?';
            params.push(usuario_id);
        }
        if (categoria_id) {
            query += ' AND h.categoria_id = ?';
            params.push(categoria_id);
        }
        if (fecha_desde) {
            query += ' AND DATE(h.fecha_creacion) >= ?';
            params.push(fecha_desde);
        }
        if (fecha_hasta) {
            query += ' AND DATE(h.fecha_creacion) <= ?';
            params.push(fecha_hasta);
        }
        query += ' ORDER BY h.fecha_creacion DESC';

        const [rows] = await db.execute(query, params);
        res.json(rows);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ========== REGISTROS / ACTIVIDAD (con filtros: fecha_desde, fecha_hasta, usuario_id, categoria_id, habito_id) ==========
router.get('/registros', async (req, res) => {
    try {
        const { fecha_desde, fecha_hasta, usuario_id, categoria_id, habito_id } = req.query;
        let query = `
            SELECT r.id, r.habito_id, r.fecha, r.hora_real, r.estado, r.completado,
                   h.nombre as habito_nombre, h.id_usuario,
                   u.nombre_usuario, c.nombre as categoria_nombre
            FROM registros r
            JOIN habitos h ON r.habito_id = h.id
            JOIN usuarios u ON h.id_usuario = u.id
            LEFT JOIN categorias c ON h.categoria_id = c.id
            WHERE 1=1
        `;
        const params = [];

        if (fecha_desde) {
            query += ' AND r.fecha >= ?';
            params.push(fecha_desde);
        }
        if (fecha_hasta) {
            query += ' AND r.fecha <= ?';
            params.push(fecha_hasta);
        }
        if (usuario_id) {
            query += ' AND h.id_usuario = ?';
            params.push(usuario_id);
        }
        if (categoria_id) {
            query += ' AND h.categoria_id = ?';
            params.push(categoria_id);
        }
        if (habito_id) {
            query += ' AND r.habito_id = ?';
            params.push(habito_id);
        }
        query += ' ORDER BY r.fecha DESC, r.hora_real DESC';

        const [rows] = await db.execute(query, params);
        res.json(rows);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;