// backend/routes/firma.routes.js
const express = require('express');
const router = express.Router();
const verificarAuth = require('../middleware/auth');
const firmaController = require('../controllers/firma.controller');

// ✅ IMPORTAR MULTER PARA MANEJO DE ARCHIVOS
const multer = require('multer');
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB límite
  }
});

// Todas requieren login
router.use(verificarAuth);

// Firmar examen
router.post('/firmar', firmaController.firmarExamen);

// Verificar estado firma
router.get('/verificar/:detalleId', firmaController.verificarFirma);

// ✅ NUEVA RUTA PARA FIRMAR PDF CON CERTIFICADO
router.post('/firmar-pdf', 
  upload.fields([
    { name: 'pdf', maxCount: 1 },
    { name: 'certificado', maxCount: 1 }
  ]), 
  firmaController.firmarPdf
);

module.exports = router;