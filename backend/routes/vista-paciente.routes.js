// backend/routes/vista-paciente.routes.js
const express = require('express');
const router = express.Router();

const vistaPacienteController = require('../controllers/vista-paciente.controller');
const verificarAuth = require('../middleware/auth');

console.log('🧩 vistaPacienteController keys:', Object.keys(vistaPacienteController));

function asegurarFn(nombre) {
  const fn = vistaPacienteController[nombre];
  if (typeof fn !== 'function') {
    console.log(`❌ CONTROLADOR SIN FUNCIÓN: ${nombre} =>`, fn);
    return (req, res) =>
      res.status(500).json({
        message: `Función no implementada en vista-paciente.controller.js: ${nombre}`
      });
  }
  return fn;
}

/* =========================
   DASHBOARD / HISTORIAL
========================= */
router.get('/dashboard', verificarAuth, asegurarFn('obtenerDashboardPaciente'));

// ✅ tu frontend estaba llamando /historial -> lo creamos como alias
router.get('/historial', verificarAuth, asegurarFn('obtenerHistorialAgrupado'));

// ✅ mantén el original por si lo usas en otros lados
router.get('/historial-agrupado', verificarAuth, asegurarFn('obtenerHistorialAgrupado'));

/* =========================
   DATOS PARA PDFMAKE (SIN PDF GUARDADO)
========================= */

// ✅ tu frontend estaba llamando /examenes/:id/datos-completos
/*router.get(
  '/examenes/:detalleId/datos-completos',
  verificarAuth,
  asegurarFn('obtenerDatosExamenCompleto')
);*/

router.get('/examenes/:detalleId/datos-completos', verificarAuth, vistaPacienteController.obtenerDatosExamenCompleto);

// ✅ mantén el endpoint antiguo también (alias)
router.get(
  '/examen-completo/:detalleId',
  verificarAuth,
  asegurarFn('obtenerDatosExamenCompleto')
);

/* =========================
   OPCIONAL (si aún lo usas)
========================= */
router.get('/pdf/por-fecha/:fecha', verificarAuth, asegurarFn('generarPdfPorFecha'));
router.get('/pdf/estado/:examenId', verificarAuth, asegurarFn('verificarEstadoPdf'));
router.get('/pdf/orden/:id', verificarAuth, asegurarFn('generarPdfOrden'));

module.exports = router;
