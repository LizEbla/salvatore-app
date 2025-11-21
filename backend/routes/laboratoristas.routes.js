//laboratoristas.routes.js

const express = require('express');
const router = express.Router();

const {
  crearLaboratorista,
  listarLaboratoristas,
  editarLaboratoristas,
  eliminarLaboratorista,
  obtenerLaboratoristasPorId,
  verificarCedulaDuplicada,
  verificarUsuarioDuplicado
} = require('../controllers/laboratorista.controller');

// Crear laboratorista
router.post('/', crearLaboratorista);

// Listar todos (con paginación y búsqueda si tu controlador lo soporta)
router.get('/listar', listarLaboratoristas);

// Verificar cédula duplicada
router.get('/verificar-cedula/:cedula', verificarCedulaDuplicada);

// Verificar usuario duplicado
router.get('/verificar-usuario/:usuario', verificarUsuarioDuplicado);

// Obtener uno por ID
router.get('/:id', obtenerLaboratoristasPorId);

// Editar
router.put('/:id', editarLaboratoristas);

// Eliminar
router.delete('/:id', eliminarLaboratorista);

module.exports = router;
