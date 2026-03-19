// backend/controllers/habitos.controller.js
const db = require('../config/db');

const habitosController = {
    // Obtener categorías (para poblar selects en el panel de usuario)
    getCategorias: async (req, res) => {
        try {
            const [rows] = await db.query('SELECT id, nombre, descripcion FROM categorias ORDER BY nombre');
            res.json(rows);
        } catch (error) {
            console.error('Error al obtener categorías:', error);
            res.status(500).json({ error: 'Error al obtener categorías' });
        }
    },

    // Obtener todos los hábitos de un usuario
    getHabitos: async (req, res) => {
        try {
            const { usuarioId } = req.query;
            if (!usuarioId) return res.status(400).json({ error: 'ID de usuario requerido' });

            const [habitos] = await db.query(`
                SELECT h.*, c.nombre as categoria_nombre 
                FROM habitos h
                LEFT JOIN categorias c ON h.categoria_id = c.id
                WHERE h.id_usuario = ?
                ORDER BY h.fecha_creacion DESC
            `, [usuarioId]);

            for (let habito of habitos) {
                const [dias] = await db.query('SELECT hd.dia_id FROM habitos_dias hd WHERE hd.habito_id = ?', [habito.id]);
                habito.dias = dias.map(d => d.dia_id);

                const hoy = new Date().toISOString().split('T')[0];
                const [registros] = await db.query('SELECT * FROM registros WHERE habito_id = ? AND fecha = ?', [habito.id, hoy]);
                habito.completado_hoy = registros.length > 0;

                // racha y mejor_racha ya están en la tabla habitos (si añadiste columnas)
                habito.racha_actual = habito.racha_actual || 0;
                habito.mejor_racha = habito.mejor_racha || 0;
            }

            res.json(habitos);
        } catch (error) {
            console.error('Error al obtener hábitos:', error);
            res.status(500).json({ error: 'Error al obtener hábitos' });
        }
    },

    // Crear un nuevo hábito
    crearHabito: async (req, res) => {
        const connection = await db.getConnection();
        try {
            await connection.beginTransaction();
            const { nombre, descripcion, categoria, hora_objetivo, dias, usuarioId } = req.body;

            if (!nombre || !dias || dias.length === 0) {
                return res.status(400).json({ error: 'Nombre y días son requeridos' });
            }

            let categoriaId = null;
            if (categoria) {
                const [categoriaExistente] = await connection.query('SELECT id FROM categorias WHERE nombre = ?', [categoria]);
                if (categoriaExistente.length > 0) categoriaId = categoriaExistente[0].id;
                else {
                    const [nuevaCategoria] = await connection.query('INSERT INTO categorias (nombre) VALUES (?)', [categoria]);
                    categoriaId = nuevaCategoria.insertId;
                }
            }

            const [result] = await connection.query(
                `INSERT INTO habitos (id_usuario, categoria_id, nombre, descripcion, hora_objetivo, racha_actual, mejor_racha, ultima_completacion) 
                 VALUES (?, ?, ?, ?, ?, 0, 0, NULL)`,
                [usuarioId, categoriaId, nombre, descripcion || null, hora_objetivo || null]
            );
            const habitoId = result.insertId;

            for (let dia of dias) {
                await connection.query('INSERT INTO habitos_dias (habito_id, dia_id) VALUES (?, ?)', [habitoId, dia]);
            }

            await connection.commit();
            res.status(201).json({ id: habitoId, message: 'Hábito creado exitosamente' });
        } catch (error) {
            await connection.rollback();
            console.error('Error al crear hábito:', error);
            res.status(500).json({ error: 'Error al crear hábito' });
        } finally {
            connection.release();
        }
    },

    // Obtener un hábito por ID (para editar)
    getHabitoById: async (req, res) => {
        try {
            const { id } = req.params;
            const [habitos] = await db.query(`
                SELECT h.*, c.nombre as categoria_nombre 
                FROM habitos h
                LEFT JOIN categorias c ON h.categoria_id = c.id
                WHERE h.id = ?
            `, [id]);
            if (habitos.length === 0) return res.status(404).json({ error: 'Hábito no encontrado' });

            const habito = habitos[0];
            const [dias] = await db.query('SELECT dia_id FROM habitos_dias WHERE habito_id = ?', [id]);
            habito.dias = dias.map(d => d.dia_id);
            res.json(habito);
        } catch (error) {
            console.error('Error al obtener hábito:', error);
            res.status(500).json({ error: 'Error al obtener hábito' });
        }
    },

    // Actualizar un hábito
    actualizarHabito: async (req, res) => {
        const connection = await db.getConnection();
        try {
            await connection.beginTransaction();
            const { id } = req.params;
            const { nombre, descripcion, categoria, hora_objetivo, dias } = req.body;

            if (!nombre || !dias || dias.length === 0) return res.status(400).json({ error: 'Nombre y días son requeridos' });

            let categoriaId = null;
            if (categoria) {
                const [categoriaExistente] = await connection.query('SELECT id FROM categorias WHERE nombre = ?', [categoria]);
                if (categoriaExistente.length > 0) categoriaId = categoriaExistente[0].id;
                else {
                    const [nuevaCategoria] = await connection.query('INSERT INTO categorias (nombre) VALUES (?)', [categoria]);
                    categoriaId = nuevaCategoria.insertId;
                }
            }

            await connection.query(
                `UPDATE habitos SET nombre = ?, descripcion = ?, categoria_id = ?, hora_objetivo = ? WHERE id = ?`,
                [nombre, descripcion || null, categoriaId, hora_objetivo || null, id]
            );

            await connection.query('DELETE FROM habitos_dias WHERE habito_id = ?', [id]);
            for (let dia of dias) {
                await connection.query('INSERT INTO habitos_dias (habito_id, dia_id) VALUES (?, ?)', [id, dia]);
            }

            await connection.commit();
            res.json({ message: 'Hábito actualizado correctamente' });
        } catch (error) {
            await connection.rollback();
            console.error('Error al actualizar hábito:', error);
            res.status(500).json({ error: 'Error al actualizar hábito' });
        } finally {
            connection.release();
        }
    },

    // Eliminar hábito
    eliminarHabito: async (req, res) => {
        try {
            const { id } = req.params;
            await db.query('DELETE FROM habitos WHERE id = ?', [id]);
            res.json({ message: 'Hábito eliminado correctamente' });
        } catch (error) {
            console.error('Error al eliminar hábito:', error);
            res.status(500).json({ error: 'Error al eliminar hábito' });
        }
    },

    // Marcar hábito como completado -> actualizar registros + racha por hábito
    // En habitos.controller.js, dentro del objeto exportado:

completarHabito: async (req, res) => {
    const connection = await db.getConnection();
    try {
        await connection.beginTransaction();
        const { habitoId } = req.body;
        if (!habitoId) return res.status(400).json({ error: 'habitoId requerido' });

        // Obtener los días del hábito
        const [diasRows] = await connection.query('SELECT dia_id FROM habitos_dias WHERE habito_id = ?', [habitoId]);
        const dias = diasRows.map(d => d.dia_id);

        // Determinar día actual (1=Lun ... 7=Dom)
        const hoy = new Date();
        const diaSemana = hoy.getDay(); // 0=domingo, 1=lunes...
        const diaActual = diaSemana === 0 ? 7 : diaSemana; // Convertir a 1=lunes ... 7=domingo

        // Validar que el hábito esté programado para hoy
        if (!dias.includes(diaActual)) {
            await connection.rollback();
            return res.status(400).json({ error: 'Este hábito no está programado para hoy' });
        }

        const hoyStr = hoy.toISOString().split('T')[0];
        const hora = hoy.toTimeString().split(' ')[0]; // "HH:MM:SS"

        // verificar si ya existe registro para hoy
        const [existente] = await connection.query('SELECT * FROM registros WHERE habito_id = ? AND fecha = ?', [habitoId, hoyStr]);
        if (existente.length > 0) {
            await connection.rollback();
            return res.status(400).json({ error: 'Hábito ya completado hoy' });
        }

        // Determinar estado: a_tiempo o tarde (comparar hora_real vs hora_objetivo)
        const [habRows] = await connection.query('SELECT hora_objetivo FROM habitos WHERE id = ?', [habitoId]);
        let estado = 'a_tiempo';
        if (habRows.length > 0 && habRows[0].hora_objetivo) {
            const toCompare = (t) => {
                const s = String(t).replace(/\s.*$/, '').slice(0, 8);
                const [h, m, sec] = s.split(':').map(x => (x || '0').padStart(2, '0'));
                return `${h}${m}${sec}`;
            };
            if (toCompare(hora) > toCompare(habRows[0].hora_objetivo)) estado = 'tarde';
        }

        await connection.query(
            `INSERT INTO registros (habito_id, fecha, hora_real, estado, completado)
             VALUES (?, ?, ?, ?, true)`,
            [habitoId, hoyStr, hora, estado]
        );

        // actualizar racha
        const [rowsHab] = await connection.query('SELECT racha_actual, mejor_racha, ultima_completacion FROM habitos WHERE id = ?', [habitoId]);
        if (rowsHab.length === 0) {
            await connection.commit();
            return res.json({ message: 'Hábito completado', success: true });
        }
        const hab = rowsHab[0];
        const ultimaStr = hab.ultima_completacion ? new Date(hab.ultima_completacion).toISOString().split('T')[0] : null;
        let nuevaRacha = 1;

        if (ultimaStr) {
            const msPerDay = 24 * 60 * 60 * 1000;
            const ultimaDate = new Date(ultimaStr);
            const hoyDate = new Date(hoyStr);
            const daysDiff = Math.floor((hoyDate - ultimaDate) / msPerDay);
            if (daysDiff === 1) {
                nuevaRacha = (hab.racha_actual || 0) + 1;
            } else {
                nuevaRacha = 1;
            }
        }

        const nuevaMejor = Math.max(hab.mejor_racha || 0, nuevaRacha);

        await connection.query(
            'UPDATE habitos SET racha_actual = ?, mejor_racha = ?, ultima_completacion = ? WHERE id = ?',
            [nuevaRacha, nuevaMejor, hoyStr, habitoId]
        );

        await connection.commit();
        res.json({ message: 'Hábito completado', success: true });
    } catch (error) {
        await connection.rollback();
        console.error('Error al registrar hábito:', error);
        res.status(500).json({ error: 'Error al registrar hábito' });
    } finally {
        connection.release();
    }
},

    // Obtener estadísticas (ahora devuelve habitosActivos, completadosHoy, y mejorRacha por hábito)
    getEstadisticas: async (req, res) => {
        try {
            const { usuarioId } = req.query;
            if (!usuarioId) return res.status(400).json({ error: 'ID de usuario requerido' });

            const [totalHabitosRows] = await db.query('SELECT COUNT(*) as total FROM habitos WHERE id_usuario = ?', [usuarioId]);
            const habitosActivos = totalHabitosRows[0]?.total || 0;

            const hoy = new Date().toISOString().split('T')[0];
            const [completadosHoyRows] = await db.query(`
                SELECT COUNT(DISTINCT r.id) as total 
                FROM registros r
                INNER JOIN habitos h ON r.habito_id = h.id
                WHERE h.id_usuario = ? AND r.fecha = ?
            `, [usuarioId, hoy]);
            const completadosHoy = completadosHoyRows[0]?.total || 0;

            // Mejor racha: la mayor mejor_racha entre hábitos del usuario
            const [mejor] = await db.query(`
                SELECT h.nombre, h.mejor_racha
                FROM habitos h
                WHERE h.id_usuario = ?
                ORDER BY h.mejor_racha DESC
                LIMIT 1
            `, [usuarioId]);

            const mejorRacha = (mejor && mejor[0]) ? { nombre: mejor[0].nombre, valor: mejor[0].mejor_racha } : { nombre: null, valor: 0 };

            res.json({ habitosActivos, completadosHoy, mejorRacha });
        } catch (error) {
            console.error('Error al obtener estadísticas:', error);
            res.status(500).json({ error: 'Error al obtener estadísticas' });
        }
    }
};

module.exports = habitosController;