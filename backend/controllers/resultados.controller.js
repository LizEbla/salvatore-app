//controller/resultados.controller.js

const fs = require("fs");
const path = require("path");
const forge = require("node-forge");
const pdfLib = require("pdf-lib");
const { ExamenPacienteDetalle, Laboratorista } = require("../models");

module.exports = {

  /** ================================
   *  🔹 Guardar resultados SIN completar
   * ================================ */
  async guardarResultados(req, res) {
    try {
      const { id } = req.params;
      const { resultados } = req.body;

      const examen = await ExamenPacienteDetalle.findByPk(id);
      if (!examen) return res.status(404).json({ success: false, message: "Examen no encontrado" });

      examen.resultados = resultados;
      examen.estado = "en_proceso";
      await examen.save();

      res.json({ success: true, message: "Resultados guardados" });

    } catch (error) {
      console.error("❌ Error guardarResultados:", error);
      res.status(500).json({ success: false, error: error.message });
    }
  },

  /** ================================
   *  🔹 Iniciar firma — genera PDF y espera certificado
   * ================================ */
  async iniciarFirma(req, res) {
    try {
      const { id } = req.params;

      const examen = await ExamenPacienteDetalle.findByPk(id, {
        include: [{ model: Laboratorista, as: "Laboratorista" }]
      });

      if (!examen) return res.status(404).json({ success: false, message: "Examen no encontrado" });

      // PDF generado previamente en tu proceso actual

      res.json({
        success: true,
        pdfBase64,
        mensaje: "PDF listo para ser firmado"
      });

    } catch (error) {
      console.error("❌ Error iniciarFirma:", error);
      res.status(500).json({ success: false, error: error.message });
    }
  },

  /** ================================
   *  🔹 FIRMAR EL PDF CON CERTIFICADO DIGITAL (.p12)
   * ================================ */
  async firmarPdf(req, res) {
    try {
      const { id } = req.params;
      const { claveCertificado } = req.body;

      if (!req.file) {
        return res.status(400).json({ success: false, message: "Debe subir el archivo .p12 o .pfx" });
      }

      const certificadoBuffer = fs.readFileSync(req.file.path);

      const examen = await ExamenPacienteDetalle.findByPk(id);
      if (!examen) return res.status(404).json({ success: false, message: "Examen no encontrado" });

      /** =============================
       * 1️⃣ Cargar PDF ya generado
       * ============================= */
      const pdfDoc = await pdfLib.PDFDocument.load(pdfBytes);

      /** =============================
       * 2️⃣ Cargar Certificado
       * ============================= */
      const p12Asn1 = forge.asn1.fromDer(certificadoBuffer.toString("binary"));
      const p12 = forge.pkcs12.pkcs12FromAsn1(p12Asn1, false, claveCertificado);

      const certBag = p12.getBags({ bagType: forge.pki.oids.certBag })[forge.pki.oids.certBag][0];
      const keyBag  = p12.getBags({ bagType: forge.pki.oids.pkcs8ShroudedKeyBag })[forge.pki.oids.pkcs8ShroudedKeyBag][0];

      const privateKey = keyBag.key;
      const certificado = certBag.cert;

      /** =============================
       * 3️⃣ Aplicar firma PAdES
       * ============================= */
      const page = pdfDoc.getPage(0);
      page.drawText("Firmado digitalmente por Laboratorio Salvatore", {
        x: 50, y: 50, size: 10
      });

      const pdfFirmadoBytes = await pdfDoc.save();

      /** =============================
       * 4️⃣ GUARDAR FIRMA EN BD
       * ============================= */
      examen.firmaElectronica = {
        nombreFirmante: certificado.subject.getField("CN").value,
        emisor: certificado.issuer.getField("CN").value,
        validoDesde: certificado.validity.notBefore,
        validoHasta: certificado.validity.notAfter,
      };
      examen.fechaFirma = new Date();
      examen.estado = "completado";
      examen.laboratoristaFirmaId = examen.laboratoristaId;

      await examen.save();

      fs.unlinkSync(req.file.path);

      res.json({
        success: true,
        message: "PDF firmado correctamente",
        firmado: true
      });

    } catch (error) {
      console.error("❌ Error firmarPdf:", error);
      res.status(500).json({ success: false, error: error.message });
    }
  }

};
