// backend/middleware/auth.js
// Este archivo protege las rutas del backend verificando el token JWT

const jwt = require('jsonwebtoken');

const verificarToken = (req, res, next) => {
    // El token viene en el header como "Bearer token123"
    const authHeader = req.header('Authorization');
    
    if (!authHeader) {
        return res.status(401).json({ 
            error: 'Acceso denegado. Token requerido.' 
        });
    }

    // El formato es "Bearer [token]"
    const token = authHeader.replace('Bearer ', '');
    
    if (!token) {
        return res.status(401).json({ 
            error: 'Acceso denegado. Formato de token inválido.' 
        });
    }
    
    try {
        // Verificar el token (usa el mismo secreto que en auth.controller.js)
        const verified = jwt.verify(token, process.env.JWT_SECRET || 'secreto123');
        
        // Guardar info del usuario en la request para usarla después
        req.usuario = verified;
        
        // Continuar con la siguiente función (el controlador)
        next();
    } catch (error) {
        console.error('Error al verificar token:', error.message);
        
        if (error.name === 'TokenExpiredError') {
            return res.status(401).json({ 
                error: 'Token expirado. Inicia sesión nuevamente.' 
            });
        }
        
        res.status(401).json({ 
            error: 'Token inválido o expirado' 
        });
    }
};

module.exports = verificarToken;