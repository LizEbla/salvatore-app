const router = require('express').Router();
const promocionController = require('../controllers/promocion.controller');


// En tus rutas de promoción
router.post('/', promocionController.crear);
router.get('/', promocionController.listar);
router.get('/activas', promocionController.activas);
router.get('/:id', promocionController.obtenerPorId);
router.put('/:id', promocionController.actualizar);
router.delete('/:id', promocionController.eliminar);

module.exports = router;
