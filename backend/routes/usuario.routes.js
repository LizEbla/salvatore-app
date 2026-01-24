// routes/usuario.routes.js
const express = require('express');
const router = express.Router();

const verificarAuth = require('../middleware/auth');
const requireRole = require('../middleware/role');

const usuarioController = require('../controllers/usuario.controller');

// Solo SUPERADMIN crea administradores
router.post('/administradores', verificarAuth, requireRole('superadmin'), usuarioController.crearAdministrador);

module.exports = router;
