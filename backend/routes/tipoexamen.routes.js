const express = require('express');
const router = express.Router();
const tipoExamenController = require('../controllers/tipoexamen.controller');
const upload = require('../middleware/upload');
const db = require('../models'); // 👈 Agregar esto arriba


// 🔹 Ruta para importar Excel jerárquico CON MULTER
router.post('/importar-jerarquico', upload.single('archivo'), tipoExamenController.importarDesdeExcelJerarquico);

// 🔹 Rutas adicionales
router.get('/', tipoExamenController.findAll);
router.get('/jerarquico', tipoExamenController.obtenerJerarquico);
router.get('/areas', tipoExamenController.obtenerAreasUnicas);
router.get('/buscar', tipoExamenController.buscarExamenes);
router.get('/:id', tipoExamenController.findOne);
router.post('/', tipoExamenController.create);
router.put('/:id', tipoExamenController.update);
router.delete('/:id', tipoExamenController.delete);

// 🔹 Rutas para subexámenes
router.get('/subexamenes/:id', tipoExamenController.findSubexamen);
router.put('/subexamenes/:id', tipoExamenController.updateSubexamen);

// 🔹 Rutas para áreas
router.post('/areas', tipoExamenController.crearArea);
router.put('/areas/:id', tipoExamenController.actualizarArea);
router.delete('/areas/:id', tipoExamenController.eliminarArea);


// 🔍 RUTA DE DEBUG
router.get('/debug/relaciones', async (req, res) => {
  try {
    const examenes = await db.Examen.findAll({
      include: [
        {
          model: db.Area,
          as: 'Area',
          attributes: ['id', 'nombre']
        },
        {
          model: db.Subexamen,
          as: 'Subexamenes',
          attributes: ['id', 'nombre', 'precio', 'examen_id']
        }
      ],
      order: [['id', 'ASC']]
    });

    const subexamenes = await db.Subexamen.findAll({
      include: [
        {
          model: db.Examen,
          as: 'ExamenPadre',
          attributes: ['id', 'nombre']
        }
      ],
      order: [['id', 'ASC']]
    });

    console.log('🔍 DEBUG - RELACIÓN EXAMENES-SUBEXAMENES:');
    
    console.log('📋 EXAMENES PRINCIPALES:');
    examenes.forEach(examen => {
      console.log(`   ID: ${examen.id}, Nombre: "${examen.nombre}", Precio: ${examen.precio}`);
      if (examen.subexamenes && examen.subexamenes.length > 0) {
        examen.subexamenes.forEach(sub => {
          console.log(`      🧪 Subexamen ID: ${sub.id}, Nombre: "${sub.nombre}", Precio: ${sub.precio}, ExamenPadreID: ${sub.examen_id}`);
        });
      }
    });

    console.log('🧪 SUBEXAMENES INDEPENDIENTES:');
    subexamenes.forEach(sub => {
      console.log(`   ID: ${sub.id}, Nombre: "${sub.nombre}", Precio: ${sub.precio}, ExamenPadre: "${sub.ExamenPadre?.nombre}" (ID: ${sub.examen_id})`);
    });

    res.json({
      examenes: examenes.map(e => ({
        id: e.id,
        nombre: e.nombre,
        precio: e.precio,
        area: e.Area?.nombre,
        subexamenes: e.subexamenes.map(s => ({
          id: s.id,
          nombre: s.nombre,
          precio: s.precio,
          examen_id: s.examen_id
        }))
      })),
      subexamenes: subexamenes.map(s => ({
        id: s.id,
        nombre: s.nombre,
        precio: s.precio,
        examen_id: s.examen_id,
        examenPadre: s.ExamenPadre ? {
          id: s.ExamenPadre.id,
          nombre: s.ExamenPadre.nombre
        } : null
      }))
    });

  } catch (error) {
    console.error('❌ Error en debug:', error);
    res.status(500).json({ error: error.message });
  }
});
// 🔹 Rutas de diagnóstico

module.exports = router;