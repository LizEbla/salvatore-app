// routes/auth.js
const express = require('express');
const router = express.Router();
const authController = require('../controllers/auth.controller'); // 👈 IMPORTAR EL CONTROLADOR REAL
const verificarAuth = require('../middleware/auth');

router.post('/login', authController.login);
router.get('/verificar', verificarAuth, authController.verificarToken); // 👈 NUEVA RUTA



module.exports = router;