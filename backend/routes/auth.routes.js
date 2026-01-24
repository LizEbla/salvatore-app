const express = require('express');
const router = express.Router();

const authController = require('../controllers/auth.controller');
const verificarAuth = require('../middleware/auth');

// LOGIN LAB + ADMIN + SUPERADMIN (CON SUCURSAL)
router.post('/login', authController.login);

// LOGIN PACIENTE
router.post('/login-paciente', authController.loginPaciente);

// VERIFICAR TOKEN
router.get('/verificar', verificarAuth, authController.verificarToken);

// 🔄 CAMBIAR SUCURSAL (ADMINISTRADORES)
router.post('/cambiar-sucursal', verificarAuth, authController.cambiarSucursal);

// 🔍 DIAGNÓSTICO DE SESIÓN
router.get('/diagnostico', verificarAuth, authController.diagnosticarSesion);

module.exports = router;