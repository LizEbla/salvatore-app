const express = require('express');
const router = express.Router();
const controller = require('../controllers/tipoexamen.controller');
const upload = require('../middleware/upload');

// ✅ Rutas de tipo examen
router.post('/', controller.create);

// ✅ Importar desde Excel (plano y jerárquico)
router.post('/importar-excel', upload.single('archivo'), controller.importarDesdeExcel);
router.post('/importar-jerarquico', upload.single('archivo'), controller.importarDesdeExcelJerarquico);
router.get("/areas", controller.obtenerAreasUnicas);


// ✅ Eliminar todos los tipos de examen jerárquicos
router.delete('/eliminar-todo-jerarquico', controller.eliminarTodoJerarquico);

// ✅ Operaciones generales
router.get('/', controller.findAll);
router.put('/:id', controller.update);
router.get('/:id', controller.findOne);
router.delete('/:id', controller.delete);

module.exports = router;
