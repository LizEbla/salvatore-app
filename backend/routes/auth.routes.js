// routes/auth.routes.js
const express = require('express');
const router = express.Router();

const authController = require('../controllers/auth.controller');
const verificarAuth = require('../middleware/auth');

// LOGIN LAB + ADMIN + SUPERADMIN
router.post('/login', authController.login);

// LOGIN PACIENTE
router.post('/login-paciente', authController.loginPaciente);

// VERIFICAR TOKEN
router.get('/verificar', verificarAuth, authController.verificarToken);



module.exports = router;
