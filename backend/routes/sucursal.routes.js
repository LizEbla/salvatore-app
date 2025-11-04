const express = require('express');
const router = express.Router();
const sucursalController = require('../controllers/sucursal.controller');

// CRUD de sucursales
router.get('/', sucursalController.obtenerSucursales);
router.post('/', sucursalController.crearSucursal);
router.put('/:id', sucursalController.actualizarSucursal);
router.patch('/:id/desactivar', sucursalController.desactivarSucursal);

module.exports = router;
