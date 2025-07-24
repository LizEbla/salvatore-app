const express = require('express');
const router = express.Router();
const controlador = require('../controllers/laboratorista.controller');

const {
  crearLaboratorista,
  listarLaboratoristas,
  editarLaboratoristas,
  eliminarLaboratorista,
  obtenerLaboratoristasPorId,
  verificarCedulaDuplicada, // 👈 Asegúrate de incluir esta
    verificarUsuarioDuplicado // ✅ Asegúrate de importar esta función

} = require('../controllers/laboratorista.controller');


// Crear laboratorista
router.post('/', controlador.crearLaboratorista);

// Listar todos
router.get('/listar', controlador.listarLaboratoristas);

// Obtener uno por ID
router.get('/:id', controlador.obtenerLaboratoristasPorId);

// Editar
router.put('/:id', controlador.editarLaboratoristas);

// Eliminar
router.delete('/:id', controlador.eliminarLaboratorista);

//verificar cedula
router.get('/verificar-cedula/:cedula', verificarCedulaDuplicada);

//verifica usuario duplicado
router.get('/verificar-usuario/:usuario', verificarUsuarioDuplicado);

router.get('/:id', obtenerLaboratoristasPorId);



module.exports = router;
