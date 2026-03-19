// backend/server.js
const express = require('express');
const path = require('path');
const cors = require('cors');
require('dotenv').config();

const app = express();

// Middlewares
app.use(cors());
app.use(express.json());

// Servir archivos estáticos del frontend (HTML, CSS, JS, imágenes)
// path.join(__dirname, '../frontend') sale de backend/ y entra en frontend/
app.use(express.static(path.join(__dirname, '../frontend')));

// Redirigir la raíz (/) a la página de login
app.get('/', (req, res) => {
    res.redirect('/views/login.html');
});

// Importar rutas
const authRoutes = require('./routes/auth.routes');
const habitosRoutes = require('./routes/habitos.routes');
const progresoRoutes = require('./routes/progreso');
app.use('/api/progreso', progresoRoutes);

const adminRoutes = require('./routes/admin');
app.use('/api/admin', adminRoutes);
// Usar rutas
app.use('/api/auth', authRoutes);
app.use('/api/habitos', habitosRoutes);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Servidor corriendo en http://localhost:${PORT}`);
});