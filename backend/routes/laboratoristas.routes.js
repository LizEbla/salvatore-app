const express = require('express');
const router = express.Router();

const {
  crearLaboratorista,
  listarLaboratoristas,
  editarLaboratoristas,
  eliminarLaboratorista,
  obtenerLaboratoristasPorId,
  verificarCedulaDuplicada,
  verificarUsuarioDuplicado,
  obtenerEstadisticas  // ✅ AGREGAR ESTE CONTROLADOR
} = require('../controllers/laboratorista.controller');

// ==================== RUTAS GET ====================

// Obtener estadísticas del dashboard
router.get('/estadisticas', obtenerEstadisticas);  // ✅ AGREGADA

// Listar todos (con paginación y búsqueda)
router.get('/listar', listarLaboratoristas);

// Verificar cédula duplicada
router.get('/verificar-cedula/:cedula', verificarCedulaDuplicada);

// Verificar usuario duplicado
router.get('/verificar-usuario/:usuario', verificarUsuarioDuplicado);

// Obtener todos los laboratoristas (sin paginación)
router.get('/todos', async (req, res) => {  // ✅ AGREGADA
  try {
    const laboratoristas = await Laboratorista.findAll({
      attributes: { exclude: ['contrasena'] },
      include: [
        {
          model: require('../models/Sucursal')(sequelize, DataTypes),
          as: 'Sucursal',
          attributes: ['id', 'nombre', 'ciudad']
        }
      ]
    });
    res.json(laboratoristas);
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ message: 'Error del servidor' });
  }
});

// Obtener uno por ID
router.get('/:id', obtenerLaboratoristasPorId);

// ==================== RUTAS POST ====================

// Crear laboratorista
router.post('/', crearLaboratorista);

// ==================== RUTAS PUT ====================

// Editar laboratorista
router.put('/:id', editarLaboratoristas);

// ==================== RUTAS DELETE ====================

// Eliminar laboratorista
router.delete('/:id', eliminarLaboratorista);

module.exports = router;