// backend/controllers/auth.controller.js
const db = require('../config/db');
const jwt = require('jsonwebtoken');

exports.registrar = async (req, res) => {
    try {
        const { nombre_usuario, email, password } = req.body;

        if (!nombre_usuario || !email || !password) {
            return res.status(400).json({ message: 'Faltan nombre, email o contraseña' });
        }

        // Verificar si el email o nombre_usuario ya existen
        const [existentes] = await db.execute(
            'SELECT id FROM usuarios WHERE email = ? OR nombre_usuario = ?',
            [email, nombre_usuario]
        );

        if (existentes.length > 0) {
            return res.status(409).json({ message: 'El email o nombre de usuario ya está registrado' });
        }

        await db.execute(
            'INSERT INTO usuarios (nombre_usuario, email, password, rol) VALUES (?, ?, ?, ?)',
            [nombre_usuario.trim(), email.trim(), password, 'usuario']
        );

        res.status(201).json({ message: 'Usuario registrado correctamente. Ya puedes iniciar sesión.' });

    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Error del servidor' });
    }
};

exports.login = async (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email || !email.trim()) {
            return res.status(400).json({ message: 'Ingresa tu correo electrónico' });
        }
        if (!password) {
            return res.status(400).json({ message: 'Ingresa tu contraseña' });
        }

        // Verificar credenciales, ahora seleccionando también el rol
        const [rows] = await db.execute(
            'SELECT id, nombre_usuario, email, rol FROM usuarios WHERE email = ? AND password = ?',
            [email, password]
        );

        if (rows.length === 0) {
            return res.status(401).json({ message: 'Correo o contraseña incorrectos' });
        }

        const usuarioLogueado = rows[0];

        // Generar token incluyendo el rol
        const token = jwt.sign(
            { 
                id: usuarioLogueado.id, 
                email: usuarioLogueado.email,
                rol: usuarioLogueado.rol   // 👈 AGREGAMOS EL ROL
            },
            process.env.JWT_SECRET || 'secreto123',
            { expiresIn: '7d' }
        );

        res.json({
            message: 'Login correcto',
            token: token,
            usuario: {
                id: usuarioLogueado.id,
                nombre_usuario: usuarioLogueado.nombre_usuario,
                email: usuarioLogueado.email,
                rol: usuarioLogueado.rol   // 👈 TAMBIÉN EN LA RESPUESTA
            }
        });

    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Error del servidor' });
    }
};