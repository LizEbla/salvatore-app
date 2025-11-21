// backend/controllers/firma.controller.js
const db = require('../models');
const { ExamenPacienteDetalle } = db;
const fs = require('fs');
const path = require('path');

module.exports = {

  /** ==========================================
   * 🖊️ FIRMAR EXAMEN (estilo FirmaEC)
   * ========================================== */
  async firmarExamen(req, res) {
    try {
      const { detalleId, firmaElectronica, laboratoristaId } = req.body;

      // Validar que el laboratorista sea el mismo usuario autenticado
      if (req.usuario.id !== laboratoristaId) {
        return res.status(403).json({
          success: false,
          mensaje: 'No tiene permisos para firmar este examen'
        });
      }

      const detalle = await ExamenPacienteDetalle.findByPk(detalleId);

      if (!detalle) {
        return res.status(404).json({
          success: false,
          mensaje: 'Examen no encontrado'
        });
      }

      // Guardar firma electrónica y actualizar estado
      await detalle.update({
        firmaElectronica: firmaElectronica,
        estado: 'completado',
        fechaFirma: new Date(),
        laboratoristaFirmaId: laboratoristaId,
        pdfPendiente: true  // 👉 obliga a generar PDF actualizado
      });

      return res.json({
        success: true,
        mensaje: 'Examen firmado correctamente',
        detalleId: detalle.id
      });

    } catch (error) {
      console.error('❌ Error firmar examen:', error);
      res.status(500).json({
        success: false,
        mensaje: 'Error firmando examen',
        error: error.message
      });
    }
  },

  /** ==========================================
   * 🔍 VERIFICAR ESTADO DE FIRMA
   * ========================================== */
  async verificarFirma(req, res) {
    try {
      const { detalleId } = req.params;

      const detalle = await ExamenPacienteDetalle.findByPk(detalleId, {
        attributes: ['id', 'estado', 'firmaElectronica', 'laboratoristaFirmaId']
      });

      if (!detalle) {
        return res.status(404).json({
          success: false,
          mensaje: 'Examen no encontrado'
        });
      }

      return res.json({
        success: true,
        firmado: !!detalle.firmaElectronica,
        estado: detalle.estado,
        laboratoristaFirmaId: detalle.laboratoristaFirmaId
      });

    } catch (error) {
      res.status(500).json({
        success: false,
        mensaje: 'Error verificando firma',
        error: error.message
      });
    }
  },

  /** ==========================================
   * 🔏 FIRMAR PDF CON CERTIFICADO .p12
   * ========================================== */
  async firmarPdf(req, res) {
    try {
      console.log('🔏 Iniciando proceso de firma PDF con certificado...');
      
      if (!req.files || !req.files.pdf) {
        return res.status(400).json({
          success: false,
          mensaje: 'No se recibió el archivo PDF'
        });
      }

      if (!req.files.certificado) {
        return res.status(400).json({
          success: false,
          mensaje: 'No se recibió el certificado .p12'
        });
      }

      const { password, usuario, fechaFirma, hashDocumento } = JSON.parse(req.body.firmaData);
      
      if (!password) {
        return res.status(400).json({
          success: false,
          mensaje: 'No se proporcionó la contraseña del certificado'
        });
      }

      // Validar permisos del usuario
      if (req.usuario.id !== usuario.id) {
        return res.status(403).json({
          success: false,
          mensaje: 'No tiene permisos para firmar con este certificado'
        });
      }

      // Obtener archivos
      const pdfFile = req.files.pdf;
      const certificadoFile = req.files.certificado;

      // Validar tipo de archivos
      if (!certificadoFile.name.toLowerCase().endsWith('.p12') && 
          !certificadoFile.name.toLowerCase().endsWith('.pfx')) {
        return res.status(400).json({
          success: false,
          mensaje: 'El certificado debe ser en formato .p12 o .pfx'
        });
      }

      console.log('📋 Datos recibidos para firma:', {
        usuario: usuario.nombres,
        cedula: usuario.cedula,
        fechaFirma,
        tamañoPDF: pdfFile.size,
        tamañoCertificado: certificadoFile.size
      });

      // 👉 AQUÍ VA LA LÓGICA REAL DE FIRMA DIGITAL
      // Por ahora devolvemos el mismo PDF (implementar firma real después)
      const pdfFirmado = await this.procesarFirmaDigital(
        pdfFile.data,
        certificadoFile.data,
        password,
        usuario,
        fechaFirma
      );

      // Configurar respuesta
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', 'attachment; filename="documento_firmado.pdf"');
      
      res.send(pdfFirmado);

    } catch (error) {
      console.error('❌ Error en firma PDF:', error);
      
      if (error.message.includes('Invalid password') || error.message.includes('contraseña')) {
        return res.status(400).json({ 
          success: false, 
          mensaje: 'Contraseña del certificado incorrecta' 
        });
      }
      
      res.status(500).json({ 
        success: false, 
        mensaje: 'Error en firma electrónica: ' + error.message 
      });
    }
  },

  /** ==========================================
   * 🔐 PROCESAR FIRMA DIGITAL (Método auxiliar)
   * ========================================== */
  async procesarFirmaDigital(pdfBuffer, certificadoBuffer, password, usuario, fechaFirma) {
    try {
      // NOTA: Esta es una implementación temporal
      // Para firma digital real necesitas instalar librerías como:
      // - node-forge: npm install node-forge
      // - pdf-lib: npm install pdf-lib
      // - @peculiar/webcrypto: npm install @peculiar/webcrypto
      
      console.log('🔐 Procesando firma digital (modo desarrollo)...');
      
      // Por ahora, simplemente validamos el certificado pero no firmamos
      // Esto es TEMPORAL - debes implementar la firma real
      
      const certificadoValido = await this.validarCertificado(certificadoBuffer, password);
      
      if (!certificadoValido) {
        throw new Error('Certificado inválido o contraseña incorrecta');
      }
      
      console.log('✅ Certificado validado correctamente');
      console.log('📝 Usuario firmante:', usuario.nombres, usuario.cedula);
      console.log('📅 Firma:', fechaFirma);
      
      // TEMPORAL: Devolver el mismo PDF (sin firma digital real)
      // IMPLEMENTAR FIRMA DIGITAL REAL AQUÍ
      console.log('⚠️  MODO DESARROLLO: PDF devuelto sin firma digital real');
      
      return pdfBuffer;
      
    } catch (error) {
      console.error('❌ Error procesando firma digital:', error);
      throw error;
    }
  },

  /** ==========================================
   * 📋 VALIDAR CERTIFICADO .p12
   * ========================================== */
  async validarCertificado(certificadoBuffer, password) {
    try {
      // TEMPORAL: Validación básica
      // En producción, usar librería como node-forge para validar realmente
      
      if (!certificadoBuffer || certificadoBuffer.length === 0) {
        throw new Error('Certificado vacío');
      }
      
      if (!password || password.length < 1) {
        throw new Error('Contraseña requerida');
      }
      
      // Simular validación (remover en producción)
      console.log('🔍 Validando certificado (simulación)...');
      
      // Aquí iría la validación real con node-forge:
      /*
      const forge = require('node-forge');
      const p12Asn1 = forge.asn1.fromDer(certificadoBuffer);
      const p12 = forge.pkcs12.pkcs12FromAsn1(p12Asn1, password);
      */
      
      return true; // Temporal: siempre retorna true
      
    } catch (error) {
      console.error('❌ Error validando certificado:', error);
      throw new Error('Certificado inválido: ' + error.message);
    }
  }

};