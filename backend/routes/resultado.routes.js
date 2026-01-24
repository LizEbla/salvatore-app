const express = require("express");
const router = express.Router();
const upload = require("../middleware/upload");
const controller = require("../controllers/resultados.controller");

// Guardar resultados sin firmar
router.put("/:id/guardar", controller.guardarResultados);

// Obtener PDF para firmar
router.get("/:id/iniciar-firma", controller.iniciarFirma);

// Firmar PDF (se sube archivo .p12)
router.post("/:id/firmar", upload.single("certificado"), controller.firmarPdf);

module.exports = router;
