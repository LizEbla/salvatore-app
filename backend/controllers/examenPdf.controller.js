// backend/controllers/examenPdf.controller.js
const db = require('../models');
const { ExamenPacienteDetalle } = db;

module.exports = {

  /** ======================================
   *  💾 GUARDAR PDF GENERADO EN BACKEND
   * ====================================== */
  async guardarPdfFirmado(req, res) {
    try {
      const { detalleId, pdfBuffer } = req.body;

      const detalle = await ExamenPacienteDetalle.findByPk(detalleId);

      if (!detalle) {
        return res.status(404).json({ success: false, mensaje: 'Examen no encontrado' });
      }

      await detalle.update({
        pdfGenerado: Buffer.from(pdfBuffer),
        fechaGeneracionPdf: new Date(),
        pdfPendiente: false
      });

      return res.json({
        success: true,
        mensaje: 'PDF guardado correctamente'
      });

    } catch (error) {
      console.error("❌ Error guardando PDF:", error);
      res.status(500).json({
        success: false,
        mensaje: 'Error guardando PDF',
        error: error.message
      });
    }
  }

};
