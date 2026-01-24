// backend/routes/examenPdf.routes.js
const express = require('express');
const router = express.Router();
const verificarAuth = require('../middleware/auth');
const pdfController = require('../controllers/examenPdf.controller');

router.use(verificarAuth);

// GUARDAR PDF
router.post('/guardar', pdfController.guardarPdfFirmado);

module.exports = router;
