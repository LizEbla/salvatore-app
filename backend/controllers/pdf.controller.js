// controllers/pdf.controller.js
const PDFDocument = require('pdfkit');
const db = require('../models');

const generarPDFResultados = async (req, res) => {
  try {
    const { paciente, examen, resultados, fechaGeneracion } = req.body;

    // Crear documento PDF
    const doc = new PDFDocument({ margin: 50 });
    
    // Configurar headers para descarga
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="resultado_${examen.Examen.nombre}_${paciente.nombres}.pdf"`);

    // Pipe el PDF a la respuesta
    doc.pipe(res);

    // Encabezado
    doc.fontSize(20).font('Helvetica-Bold')
       .text('LABORATORIO CLÍNICO', { align: 'center' });
    doc.moveDown(0.5);
    
    doc.fontSize(12).font('Helvetica')
       .text('INFORME DE RESULTADOS', { align: 'center' });
    doc.moveDown(1);

    // Información del paciente
    doc.fontSize(14).font('Helvetica-Bold')
       .text('INFORMACIÓN DEL PACIENTE');
    doc.moveDown(0.5);
    
    doc.fontSize(10).font('Helvetica')
       .text(`Nombre: ${paciente.nombres} ${paciente.apellidos}`)
       .text(`Cédula: ${paciente.cedula || 'No especificada'}`)
       .text(`Edad: ${paciente.edad || 'No especificada'} años`)
       .text(`Sexo: ${paciente.sexo || 'No especificado'}`)
       .text(`Fecha: ${fechaGeneracion}`);
    doc.moveDown(1);

    // Información del examen
    doc.fontSize(14).font('Helvetica-Bold')
       .text('INFORMACIÓN DEL EXAMEN');
    doc.moveDown(0.5);
    
    doc.fontSize(10).font('Helvetica')
       .text(`Examen: ${examen.Examen.nombre}`)
       .text(`Tipo de Muestra: ${examen.Examen.tipoMuestra || 'No especificado'}`)
       .text(`Fecha de Asignación: ${new Date(examen.fechaAsignacion).toLocaleDateString('es-ES')}`);
    doc.moveDown(1);

    // Resultados
    doc.fontSize(14).font('Helvetica-Bold')
       .text('RESULTADOS');
    doc.moveDown(0.5);

    // Procesar resultados según la estructura
    if (typeof resultados === 'object' && !Array.isArray(resultados)) {
      for (const [key, value] of Object.entries(resultados)) {
        if (value !== null && value !== undefined && value !== '') {
          doc.fontSize(10).font('Helvetica')
             .text(`${key}: ${value}`);
        }
      }
    } else if (Array.isArray(resultados)) {
      resultados.forEach((item, index) => {
        if (typeof item === 'object') {
          for (const [key, value] of Object.entries(item)) {
            doc.fontSize(10).font('Helvetica')
               .text(`${key}: ${value}`);
          }
        } else {
          doc.fontSize(10).font('Helvetica')
             .text(`Resultado ${index + 1}: ${item}`);
        }
        doc.moveDown(0.3);
      });
    } else {
      doc.fontSize(10).font('Helvetica')
         .text(`Resultado: ${resultados}`);
    }

    doc.moveDown(2);

    // Pie de página
    doc.fontSize(8).font('Helvetica')
       .text('Este es un documento generado automáticamente. Firma del responsable:', 50, doc.page.height - 100)
       .text('_________________________', 50, doc.page.height - 80)
       .text('Dr. Responsable', 50, doc.page.height - 65)
       .text('Laboratorio Clínico', 50, doc.page.height - 50);

    // Finalizar documento
    doc.end();

  } catch (error) {
    console.error('❌ Error generando PDF:', error);
    res.status(500).json({ error: 'Error al generar el PDF' });
  }
};

// Función para obtener historial de exámenes para comparación
const obtenerHistorialExamenes = async (req, res) => {
  try {
    const { pacienteId, nombreExamen } = req.params;

    const examenes = await db.ExamenPaciente.findAll({
      where: {
        pacienteId,
        '$Examen.nombre$': nombreExamen
      },
      include: [
        {
          model: db.Examen,
          attributes: ['id', 'nombre', 'tipoMuestra']
        }
      ],
      order: [['fechaAsignacion', 'DESC']]
    });

    // Procesar resultados para gráficos
    const datosGraficos = examenes
      .filter(examen => examen.resultado)
      .map(examen => {
        let resultados;
        try {
          resultados = typeof examen.resultado === 'string' ? 
            JSON.parse(examen.resultado) : examen.resultado;
        } catch {
          resultados = { resultado: examen.resultado };
        }

        return {
          fecha: examen.fechaAsignacion,
          resultados: resultados,
          estado: examen.estado
        };
      });

    res.json({
      success: true,
      historial: datosGraficos,
      total: datosGraficos.length
    });

  } catch (error) {
    console.error('❌ Error obteniendo historial:', error);
    res.status(500).json({ error: 'Error al obtener el historial' });
  }
};

module.exports = {
  generarPDFResultados,
  obtenerHistorialExamenes
};