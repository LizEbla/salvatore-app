// backend/routes/dashboardAdmin.routes.js - VERSIÓN CORREGIDA
const express = require('express');
const router = express.Router();

const dashboardAdminController = require('../controllers/dashboardAdmin.controller');

// ✅ Dashboard (KPI + charts + pendientes)
router.get('/estadisticas', dashboardAdminController.getEstadisticasDashboard);

// ✅ Predictivo (real)
router.get('/analisis-predictivo', dashboardAdminController.getAnalisisPredictivo);

// ✅ Charts con filtros
router.get('/exams-trend', dashboardAdminController.getExamsTrend);
router.get('/top-exams', dashboardAdminController.getTopExams);
router.get('/patients-by-branch', dashboardAdminController.getPatientsByBranch);
router.get('/workload-heatmap', dashboardAdminController.getWorkloadHeatmap);

// ✅ NUEVOS (los que tu Angular llama)
router.get('/estado-proceso', dashboardAdminController.getProcessStatus);
router.get('/turnaround', dashboardAdminController.getTurnaroundTime);
// ✅ CORREGIR: getIngresosPorSucursal en lugar de getRevenueByBranch
router.get('/ingresos-por-sucursal', dashboardAdminController.getIngresosPorSucursal);

// ✅ Extra (si lo usas)
router.get('/revenue-trend', dashboardAdminController.getRevenueTrend);
router.get('/demographics', dashboardAdminController.getDemographics);

// ✅ Debug endpoints (si los quieres exponer)
router.get('/debug-sucursales', dashboardAdminController.debugSucursales);
router.get('/check-examen-data', dashboardAdminController.checkExamenPacienteData);
router.get('/check-laboratoristas', dashboardAdminController.checkLaboratoristasData);

module.exports = router;