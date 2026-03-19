// backend/controllers/progresoController.js
const db = require('../config/db'); // Asegúrate de que la ruta sea correcta

exports.obtenerProgreso = async (req, res) => {
    try {
        const usuarioId = req.usuario.id; // El middleware deja el usuario en req.usuario
        const hoy = new Date();
        const hace30 = new Date();
        hace30.setDate(hoy.getDate() - 30);
        const hace30Str = hace30.toISOString().split('T')[0];

        // 1. Estadísticas generales
        const [estadisticas] = await db.query(`
            SELECT 
                (SELECT COUNT(*) FROM habitos WHERE id_usuario = ?) AS habitosActivos,
                (SELECT COUNT(*) FROM registros r 
                 JOIN habitos h ON r.habito_id = h.id 
                 WHERE h.id_usuario = ? AND r.fecha = CURDATE() AND r.completado = 1) AS completadosHoy,
                (SELECT MAX(mejor_racha) FROM habitos WHERE id_usuario = ?) AS mejorRachaGlobal
        `, [usuarioId, usuarioId, usuarioId]);

        // 2. Progreso semanal (últimos 7 días)
        const [progresoSemanal] = await db.query(`
            SELECT 
                r.fecha,
                COUNT(*) as completados
            FROM registros r
            JOIN habitos h ON r.habito_id = h.id
            WHERE h.id_usuario = ? AND r.fecha >= DATE_SUB(CURDATE(), INTERVAL 7 DAY)
            GROUP BY r.fecha
            ORDER BY r.fecha
        `, [usuarioId]);

        // 3. Resumen por categorías (últimos 30 días, basado en registros reales)
        const [categorias] = await db.query(`
            SELECT 
                COALESCE(c.nombre, 'Sin categoría') AS nombre,
                COUNT(r.id) AS completados
            FROM habitos h
            LEFT JOIN categorias c ON h.categoria_id = c.id
            LEFT JOIN registros r 
              ON r.habito_id = h.id
             AND r.fecha >= ?
             AND r.completado = 1
            WHERE h.id_usuario = ?
            GROUP BY COALESCE(c.nombre, 'Sin categoría')
            ORDER BY completados DESC
        `, [hace30Str, usuarioId]);

        // 3.1 Distribución a_tiempo vs tarde (30d)
        const [estadoRows] = await db.query(`
            SELECT 
                SUM(CASE WHEN r.estado = 'a_tiempo' THEN 1 ELSE 0 END) AS a_tiempo,
                SUM(CASE WHEN r.estado = 'tarde' THEN 1 ELSE 0 END) AS tarde
            FROM registros r
            JOIN habitos h ON r.habito_id = h.id
            WHERE h.id_usuario = ? AND r.fecha >= ? AND r.completado = 1
        `, [usuarioId, hace30Str]);

        // 4. Detalle de hábitos con porcentaje real
        const [habitos] = await db.query(`
            SELECT 
                h.id,
                h.nombre,
                c.nombre AS categoria,
                h.racha_actual,
                h.mejor_racha
            FROM habitos h
            LEFT JOIN categorias c ON h.categoria_id = c.id
            WHERE h.id_usuario = ?
        `, [usuarioId]);

        const habitosDetalle = [];
        let totalObjetivos30d = 0;
        let totalCompletados30d = 0;

        for (let habito of habitos) {
            // Obtener días de la semana del hábito
            const [dias] = await db.query('SELECT dia_id FROM habitos_dias WHERE habito_id = ?', [habito.id]);
            const diasSemana = dias.map(d => d.dia_id);

            // Calcular cuántos días objetivo en los últimos 30 días
            let diasObjetivo = 0;
            for (let d = new Date(hace30); d <= hoy; d.setDate(d.getDate() + 1)) {
                const diaSemana = d.getDay() === 0 ? 7 : d.getDay(); // 1=lunes ... 7=domingo
                if (diasSemana.includes(diaSemana)) diasObjetivo++;
            }

            // Contar registros completados en los últimos 30 días
            const [registros] = await db.query(`
                SELECT COUNT(*) as total
                FROM registros
                WHERE habito_id = ? AND fecha >= ? AND completado = 1
            `, [habito.id, hace30.toISOString().split('T')[0]]);

            const totalCompletados = registros[0].total;
            const porcentaje = diasObjetivo > 0 ? (totalCompletados / diasObjetivo) * 100 : 0;
            totalObjetivos30d += diasObjetivo;
            totalCompletados30d += totalCompletados;

            habitosDetalle.push({
                nombre: habito.nombre,
                categoria: habito.categoria || 'Sin categoría',
                racha_actual: habito.racha_actual,
                mejor_racha: habito.mejor_racha,
                totalCompletados,
                porcentajeCumplimiento: Math.round(porcentaje * 10) / 10
            });
        }

        const porcentajeGlobal30d = totalObjetivos30d > 0 ? Math.round((totalCompletados30d / totalObjetivos30d) * 1000) / 10 : 0;

        // Responder con todo
        res.json({
            estadisticas: estadisticas[0],
            progresoSemanal,
            categorias,
            habitos: habitosDetalle
                .sort((a, b) => (b.porcentajeCumplimiento ?? 0) - (a.porcentajeCumplimiento ?? 0)),
            resumen30d: {
                objetivos: totalObjetivos30d,
                completados: totalCompletados30d,
                porcentaje: porcentajeGlobal30d,
                a_tiempo: estadoRows[0]?.a_tiempo || 0,
                tarde: estadoRows[0]?.tarde || 0
            }
        });

    } catch (error) {
        console.error('Error en progresoController:', error);
        res.status(500).json({ error: 'Error interno del servidor' });
    }
};