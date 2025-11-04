const db = require('../models');
const PDFDocument = require('pdfkit');

// Modelos
const { ExamenPaciente, ExamenPacienteDetalle, Examen, Paciente, Area, Subexamen } = db;

// 📄 GENERAR PDF DE RESULTADOS
const generarPDFResultados = async (req, res) => {
  try {
    const { paciente, examen, resultados, fechaGeneracion } = req.body;

    console.log('📄 Generando PDF para:', {
      paciente: paciente.nombres,
      examen: examen.Examen.nombre,
      resultados: resultados
    });

    // Crear documento PDF
    const doc = new PDFDocument({ 
      margin: 50,
      size: 'A4',
      info: {
        Title: `Resultado - ${examen.Examen.nombre}`,
        Author: 'Laboratorio Clínico',
        Subject: 'Resultados de Exámenes'
      }
    });
    
    // Configurar headers para descarga
    res.setHeader('Content-Type', 'application/pdf');
    const fileName = `Resultado_${paciente.nombres}_${paciente.apellidos}_${examen.Examen.nombre}.pdf`.replace(/ /g, '_');
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);

    // Pipe el PDF a la respuesta
    doc.pipe(res);

    // =======================
    // ENCABEZADO
    // =======================
    doc.fillColor('#2c3e50')
       .fontSize(20)
       .font('Helvetica-Bold')
       .text('LABORATORIO CLÍNICO ESPECIALIZADO', { align: 'center' });
    
    doc.moveDown(0.3);
    doc.fillColor('#7f8c8d')
       .fontSize(10)
       .font('Helvetica')
       .text('Resultados de Análisis Clínicos', { align: 'center' });
    
    // Línea separadora
    doc.moveDown(0.5);
    doc.strokeColor('#3498db')
       .lineWidth(2)
       .moveTo(50, doc.y)
       .lineTo(550, doc.y)
       .stroke();
    
    doc.moveDown(1);

    // =======================
    // INFORMACIÓN DEL PACIENTE
    // =======================
    doc.fillColor('#2c3e50')
       .fontSize(14)
       .font('Helvetica-Bold')
       .text('INFORMACIÓN DEL PACIENTE');
    
    doc.moveDown(0.3);
    doc.fillColor('#2c3e50')
       .fontSize(10)
       .font('Helvetica')
       .text(`Nombre: ${paciente.nombres} ${paciente.apellidos}`)
       .text(`Cédula: ${paciente.cedula || 'No especificada'}`)
       .text(`Edad: ${paciente.edad || 'No especificada'} años`)
       .text(`Sexo: ${paciente.sexo || 'No especificado'}`)
       .text(`Fecha de Emisión: ${fechaGeneracion}`);
    
    doc.moveDown(1);

    // =======================
    // INFORMACIÓN DEL EXAMEN
    // =======================
    doc.fillColor('#2c3e50')
       .fontSize(14)
       .font('Helvetica-Bold')
       .text('INFORMACIÓN DEL EXAMEN');
    
    doc.moveDown(0.3);
    doc.fillColor('#2c3e50')
       .fontSize(10)
       .font('Helvetica')
       .text(`Examen: ${examen.Examen.nombre}`)
       .text(`Tipo de Muestra: ${examen.Examen.tipoMuestra || 'No especificado'}`)
       .text(`Fecha de Toma: ${new Date(examen.fechaAsignacion).toLocaleDateString('es-ES')}`)
       .text(`Estado: ${examen.estado || 'Pendiente'}`);
    
    doc.moveDown(1);

    // =======================
    // RESULTADOS
    // =======================
    doc.fillColor('#2c3e50')
       .fontSize(14)
       .font('Helvetica-Bold')
       .text('RESULTADOS DEL ANÁLISIS');
    
    doc.moveDown(0.5);

    // Procesar resultados según la estructura
    if (typeof resultados === 'object' && !Array.isArray(resultados)) {
      // Crear tabla de resultados
      let yPosition = doc.y;
      const startX = 50;
      const columnWidth = 250;
      
      // Encabezado de la tabla
      doc.fillColor('#34495e')
         .fontSize(10)
         .font('Helvetica-Bold')
         .text('PARÁMETRO', startX, yPosition)
         .text('VALOR', startX + columnWidth, yPosition);
      
      yPosition += 20;
      
      // Línea separadora del encabezado
      doc.strokeColor('#bdc3c7')
         .lineWidth(1)
         .moveTo(startX, yPosition - 5)
         .lineTo(550, yPosition - 5)
         .stroke();
      
      // Contenido de la tabla
      for (const [key, value] of Object.entries(resultados)) {
        if (value !== null && value !== undefined && value !== '') {
          doc.fillColor('#2c3e50')
             .fontSize(9)
             .font('Helvetica')
             .text(key.toString(), startX, yPosition)
             .text(value.toString(), startX + columnWidth, yPosition);
          
          yPosition += 15;
          
          // Si nos acercamos al final de la página, crear nueva página
          if (yPosition > 700) {
            doc.addPage();
            yPosition = 50;
          }
        }
      }
    } else if (Array.isArray(resultados)) {
      resultados.forEach((item, index) => {
        if (typeof item === 'object') {
          doc.fillColor('#2c3e50')
             .fontSize(10)
             .font('Helvetica-Bold')
             .text(`Resultado ${index + 1}:`);
          
          for (const [key, value] of Object.entries(item)) {
            doc.fillColor('#2c3e50')
               .fontSize(9)
               .font('Helvetica')
               .text(`  ${key}: ${value}`);
          }
        } else {
          doc.fillColor('#2c3e50')
             .fontSize(9)
             .font('Helvetica')
             .text(`• ${item}`);
        }
        doc.moveDown(0.3);
      });
    } else {
      doc.fillColor('#2c3e50')
         .fontSize(10)
         .font('Helvetica')
         .text(`Resultado: ${resultados}`);
    }

    doc.moveDown(2);

    // =======================
    // PIE DE PÁGINA
    // =======================
    const footerY = doc.page.height - 100;
    
    doc.fillColor('#7f8c8d')
       .fontSize(8)
       .font('Helvetica')
       .text('Este es un documento generado automáticamente y carece de validez sin firma autorizada.', 
             50, footerY, { width: 500, align: 'center' });
    
    doc.moveDown(1);
    doc.text('Firma del Responsable:', 50, doc.y, { align: 'center' });
    
    // Línea para firma
    doc.strokeColor('#95a5a6')
       .lineWidth(1)
       .moveTo(200, doc.y + 20)
       .lineTo(400, doc.y + 20)
       .stroke();
    
    doc.fillColor('#7f8c8d')
       .fontSize(8)
       .text('Dr. Responsable del Laboratorio', 200, doc.y + 25, { width: 200, align: 'center' });

    // Finalizar documento
    doc.end();

    console.log('✅ PDF generado exitosamente');

  } catch (error) {
    console.error('❌ Error generando PDF:', error);
    res.status(500).json({ 
      success: false,
      error: 'Error al generar el PDF',
      detalle: error.message 
    });
  }
};

// 📊 OBTENER HISTORIAL DE EXAMENES
const obtenerHistorialExamenes = async (req, res) => {
  try {
    const { pacienteId, nombreExamen } = req.params;

    console.log('📊 Obteniendo historial para:', { pacienteId, nombreExamen });

    const examenes = await ExamenPaciente.findAll({
      where: {
        pacienteId: pacienteId,
        ...(nombreExamen ? { '$Examen.nombre$': nombreExamen } : {})
      },
      include: [
        {
          model: Examen,
          attributes: ['id', 'nombre', 'tipoMuestra', 'precio'],
          include: [
            {
              model: Area,
              as: 'Area',
              attributes: ['id', 'nombre']
            }
          ]
        }
      ],
      order: [['fechaAsignacion', 'DESC']],
      limit: 10
    });

    console.log(`📋 Exámenes encontrados en historial: ${examenes.length}`);

    // Procesar resultados para gráficos
    const datosGraficos = examenes
      .filter(examen => examen.resultado && examen.estado === 'listo')
      .map(examen => {
        let resultados;
        try {
          resultados = typeof examen.resultado === 'string' ? 
            JSON.parse(examen.resultado) : examen.resultado;
        } catch {
          resultados = { resultado: examen.resultado };
        }

        return {
          id: examen.id,
          fecha: new Date(examen.fechaAsignacion).toLocaleDateString('es-ES'),
          fechaCompleta: examen.fechaAsignacion,
          resultados: resultados,
          estado: examen.estado,
          precio: examen.precio
        };
      });

    res.json({
      success: true,
      historial: datosGraficos,
      total: datosGraficos.length,
      pacienteId: pacienteId,
      nombreExamen: nombreExamen
    });

  } catch (error) {
    console.error('❌ Error obteniendo historial:', error);
    res.status(500).json({ 
      success: false,
      error: 'Error al obtener el historial',
      detalle: error.message 
    });
  }
};

// 📝 SUBIR RESULTADO DE EXAMEN
const subirResultadoExamen = async (req, res) => {
  try {
    const { examenPacienteId } = req.params;
    const { resultado, estado } = req.body;

    console.log('📄 BACKEND - Recibiendo solicitud para examen ID:', examenPacienteId);
    console.log('📊 BACKEND - Body recibido:', { resultado, estado });

    if (!examenPacienteId) {
      console.log('❌ BACKEND - ID de examen no proporcionado');
      return res.status(400).json({ error: 'ID de examen no proporcionado' });
    }

    // Buscar el examen
    const examen = await ExamenPaciente.findByPk(examenPacienteId, {
      include: [{ model: Examen }]
    });

    if (!examen) {
      console.log('❌ BACKEND - Examen no encontrado con ID:', examenPacienteId);
      return res.status(404).json({ error: 'Examen no encontrado' });
    }

    console.log('✅ BACKEND - Examen encontrado:', {
      id: examen.id,
      nombre: examen.Examen?.nombre,
      pacienteId: examen.pacienteId
    });

    // Convertir resultado a string si es objeto
    let resultadoString = resultado;
    if (typeof resultado === 'object' || Array.isArray(resultado)) {
      resultadoString = JSON.stringify(resultado);
      console.log('🔧 BACKEND - Resultado convertido a JSON string');
    }

    const datosActualizacion = {
      resultado: resultadoString,
      fechaResultado: new Date()
    };

    // Si se especifica un estado, actualizarlo también
    if (estado) {
      datosActualizacion.estado = estado;
      console.log('🔄 BACKEND - Actualizando estado a:', estado);
    }

    await examen.update(datosActualizacion);

    console.log('✅ BACKEND - Resultados guardados exitosamente para examen ID:', examenPacienteId);
    
    res.json({ 
      success: true, 
      mensaje: 'Resultados guardados correctamente',
      examen: examen 
    });

  } catch (error) {
    console.error('❌ BACKEND - Error al subir resultado:', error);
    res.status(500).json({ 
      success: false,
      error: 'Error al guardar los resultados',
      detalle: error.message 
    });
  }
};

// 📋 OBTENER DETALLES DE RESULTADOS POR EXAMEN
const obtenerDetallesResultados = async (req, res) => {
  try {
    const { examenPacienteId } = req.params;

    console.log('🔍 Obteniendo detalles de resultados para examen:', examenPacienteId);

    const examen = await ExamenPaciente.findByPk(examenPacienteId, {
      include: [
        {
          model: Examen,
          attributes: ['id', 'nombre', 'tipoMuestra', 'metodo', 'valoresReferencia'],
          include: [
            {
              model: Area,
              as: 'Area',
              attributes: ['id', 'nombre']
            }
          ]
        },
        {
          model: Paciente,
          attributes: ['id', 'nombres', 'apellidos', 'cedula', 'edad', 'sexo']
        },
        {
          model: ExamenPacienteDetalle,
          as: 'Detalles',
          include: [
            {
              model: Examen,
              as: 'Examen',
              attributes: ['id', 'nombre', 'metodo']
            },
            {
              model: Subexamen,
              as: 'Subexamen',
              attributes: ['id', 'nombre', 'metodo', 'valoresReferencia']
            }
          ]
        }
      ]
    });

    if (!examen) {
      return res.status(404).json({
        success: false,
        mensaje: 'Examen no encontrado'
      });
    }

    // Procesar resultados
    let resultadosProcesados = {};
    if (examen.resultado) {
      try {
        resultadosProcesados = typeof examen.resultado === 'string' ? 
          JSON.parse(examen.resultado) : examen.resultado;
      } catch (error) {
        console.warn('⚠️ Error parseando resultados, usando raw:', error);
        resultadosProcesados = { resultado: examen.resultado };
      }
    }

    const respuesta = {
      success: true,
      data: {
        examen: {
          id: examen.id,
          estado: examen.estado,
          fechaAsignacion: examen.fechaAsignacion,
          fechaResultado: examen.fechaResultado,
          resultado: resultadosProcesados
        },
        paciente: examen.Paciente,
        examenInfo: examen.Examen,
        detalles: examen.Detalles || []
      }
    };

    res.json(respuesta);

  } catch (error) {
    console.error('❌ Error obteniendo detalles de resultados:', error);
    res.status(500).json({
      success: false,
      error: 'Error al obtener detalles de resultados',
      detalle: error.message
    });
  }
};

// 📈 GENERAR REPORTE ESTADÍSTICO DE RESULTADOS
const generarReporteEstadistico = async (req, res) => {
  try {
    const { pacienteId, fechaInicio, fechaFin } = req.query;

    console.log('📈 Generando reporte estadístico:', { pacienteId, fechaInicio, fechaFin });

    const whereConditions = {
      pacienteId: pacienteId,
      estado: 'listo',
      resultado: { [db.Sequelize.Op.ne]: null }
    };

    // Filtrar por fechas si se proporcionan
    if (fechaInicio && fechaFin) {
      whereConditions.fechaResultado = {
        [db.Sequelize.Op.between]: [
          new Date(fechaInicio + 'T00:00:00'),
          new Date(fechaFin + 'T23:59:59')
        ]
      };
    }

    const examenesCompletados = await ExamenPaciente.findAll({
      where: whereConditions,
      include: [
        {
          model: Examen,
          attributes: ['id', 'nombre', 'areaId'],
          include: [
            {
              model: Area,
              as: 'Area',
              attributes: ['id', 'nombre']
            }
          ]
        },
        {
          model: Paciente,
          attributes: ['id', 'nombres', 'apellidos', 'cedula']
        }
      ],
      order: [['fechaResultado', 'DESC']]
    });

    // Procesar datos para estadísticas
    const estadisticas = {
      totalExamenes: examenesCompletados.length,
      porArea: {},
      porMes: {},
      examenesRecientes: []
    };

    examenesCompletados.forEach(examen => {
      const areaNombre = examen.Examen?.Area?.nombre || 'Sin área';
      const mes = new Date(examen.fechaResultado).toLocaleString('es-ES', { 
        year: 'numeric', 
        month: 'long' 
      });

      // Estadísticas por área
      if (!estadisticas.porArea[areaNombre]) {
        estadisticas.porArea[areaNombre] = 0;
      }
      estadisticas.porArea[areaNombre]++;

      // Estadísticas por mes
      if (!estadisticas.porMes[mes]) {
        estadisticas.porMes[mes] = 0;
      }
      estadisticas.porMes[mes]++;

      // Exámenes recientes (últimos 5)
      if (estadisticas.examenesRecientes.length < 5) {
        let resultados;
        try {
          resultados = typeof examen.resultado === 'string' ? 
            JSON.parse(examen.resultado) : examen.resultado;
        } catch {
          resultados = { resultado: examen.resultado };
        }

        estadisticas.examenesRecientes.push({
          id: examen.id,
          nombre: examen.Examen?.nombre,
          fecha: examen.fechaResultado,
          resultados: resultados,
          area: areaNombre
        });
      }
    });

    res.json({
      success: true,
      data: {
        paciente: examenesCompletados[0]?.Paciente,
        estadisticas,
        periodo: {
          fechaInicio,
          fechaFin,
          totalMeses: Object.keys(estadisticas.porMes).length
        }
      }
    });

  } catch (error) {
    console.error('❌ Error generando reporte estadístico:', error);
    res.status(500).json({
      success: false,
      error: 'Error al generar reporte estadístico',
      detalle: error.message
    });
  }
};

// 🖨️ GENERAR PDF DE REPORTE COMPLETO
const generarPDFReporteCompleto = async (req, res) => {
  try {
    const { pacienteId, fechaInicio, fechaFin } = req.query;

    console.log('🖨️ Generando PDF de reporte completo:', { pacienteId, fechaInicio, fechaFin });

    // Obtener datos para el reporte
    const response = await obtenerDatosReporte(pacienteId, fechaInicio, fechaFin);
    
    if (!response.success) {
      return res.status(404).json(response);
    }

    const { paciente, examenes, estadisticas } = response.data;

    // Crear documento PDF
    const doc = new PDFDocument({ 
      margin: 50,
      size: 'A4',
      info: {
        Title: `Reporte Completo - ${paciente.nombres} ${paciente.apellidos}`,
        Author: 'Laboratorio Clínico',
        Subject: 'Reporte Completo de Exámenes'
      }
    });

    // Configurar headers para descarga
    res.setHeader('Content-Type', 'application/pdf');
    const fileName = `Reporte_Completo_${paciente.nombres}_${paciente.apellidos}.pdf`.replace(/ /g, '_');
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);

    // Pipe el PDF a la respuesta
    doc.pipe(res);

    // =======================
    // ENCABEZADO
    // =======================
    doc.fillColor('#2c3e50')
       .fontSize(20)
       .font('Helvetica-Bold')
       .text('REPORTE COMPLETO DE EXÁMENES', { align: 'center' });
    
    doc.moveDown(0.3);
    doc.fillColor('#7f8c8d')
       .fontSize(10)
       .font('Helvetica')
       .text('Laboratorio Clínico Especializado', { align: 'center' });
    
    doc.moveDown(0.5);
    doc.strokeColor('#3498db')
       .lineWidth(2)
       .moveTo(50, doc.y)
       .lineTo(550, doc.y)
       .stroke();
    
    doc.moveDown(1);

    // =======================
    // INFORMACIÓN DEL PACIENTE Y PERIODO
    // =======================
    doc.fillColor('#2c3e50')
       .fontSize(14)
       .font('Helvetica-Bold')
       .text('INFORMACIÓN DEL REPORTE');
    
    doc.moveDown(0.3);
    doc.fillColor('#2c3e50')
       .fontSize(10)
       .font('Helvetica')
       .text(`Paciente: ${paciente.nombres} ${paciente.apellidos}`)
       .text(`Cédula: ${paciente.cedula || 'No especificada'}`)
       .text(`Período: ${fechaInicio || 'Inicio'} - ${fechaFin || 'Actual'}`)
       .text(`Fecha de Generación: ${new Date().toLocaleDateString('es-ES')}`)
       .text(`Total de Exámenes: ${estadisticas.totalExamenes}`);
    
    doc.moveDown(1);

    // =======================
    // ESTADÍSTICAS POR ÁREA
    // =======================
    doc.fillColor('#2c3e50')
       .fontSize(14)
       .font('Helvetica-Bold')
       .text('ESTADÍSTICAS POR ÁREA');
    
    doc.moveDown(0.3);

    if (Object.keys(estadisticas.porArea).length > 0) {
      let yPosition = doc.y;
      const startX = 50;
      const col1Width = 200;
      const col2Width = 100;

      // Encabezado de la tabla
      doc.fillColor('#34495e')
         .fontSize(10)
         .font('Helvetica-Bold')
         .text('ÁREA', startX, yPosition)
         .text('CANTIDAD', startX + col1Width, yPosition);
      
      yPosition += 20;
      
      // Línea separadora del encabezado
      doc.strokeColor('#bdc3c7')
         .lineWidth(1)
         .moveTo(startX, yPosition - 5)
         .lineTo(550, yPosition - 5)
         .stroke();

      // Contenido de la tabla
      for (const [area, cantidad] of Object.entries(estadisticas.porArea)) {
        doc.fillColor('#2c3e50')
           .fontSize(9)
           .font('Helvetica')
           .text(area, startX, yPosition)
           .text(cantidad.toString(), startX + col1Width, yPosition);
        
        yPosition += 15;
        
        if (yPosition > 700) {
          doc.addPage();
          yPosition = 50;
        }
      }
    } else {
      doc.fillColor('#7f8c8d')
         .fontSize(10)
         .font('Helvetica')
         .text('No hay datos estadísticos disponibles para el período seleccionado.');
    }

    doc.moveDown(1);

    // =======================
    // DETALLE DE EXAMENES
    // =======================
    doc.fillColor('#2c3e50')
       .fontSize(14)
       .font('Helvetica-Bold')
       .text('DETALLE DE EXÁMENES');
    
    doc.moveDown(0.3);

    if (examenes.length > 0) {
      examenes.forEach((examen, index) => {
        // Si es necesario, agregar nueva página
        if (doc.y > 600) {
          doc.addPage();
        }

        doc.fillColor('#2c3e50')
           .fontSize(11)
           .font('Helvetica-Bold')
           .text(`${index + 1}. ${examen.Examen.nombre}`);
        
        doc.fillColor('#7f8c8d')
           .fontSize(9)
           .font('Helvetica')
           .text(`Fecha: ${new Date(examen.fechaResultado).toLocaleDateString('es-ES')} | Área: ${examen.Examen.Area?.nombre || 'N/A'}`);
        
        // Mostrar resultados si existen
        if (examen.resultado) {
          let resultados;
          try {
            resultados = typeof examen.resultado === 'string' ? 
              JSON.parse(examen.resultado) : examen.resultado;
          } catch {
            resultados = { resultado: examen.resultado };
          }

          if (typeof resultados === 'object' && !Array.isArray(resultados)) {
            for (const [key, value] of Object.entries(resultados)) {
              if (value !== null && value !== undefined && value !== '') {
                doc.fillColor('#2c3e50')
                   .fontSize(9)
                   .font('Helvetica')
                   .text(`   ${key}: ${value}`);
              }
            }
          } else {
            doc.fillColor('#2c3e50')
               .fontSize(9)
               .font('Helvetica')
               .text(`   Resultado: ${resultados}`);
          }
        }

        doc.moveDown(0.5);
      });
    } else {
      doc.fillColor('#7f8c8d')
         .fontSize(10)
         .font('Helvetica')
         .text('No se encontraron exámenes completados en el período seleccionado.');
    }

    // =======================
    // PIE DE PÁGINA
    // =======================
    const footerY = doc.page.height - 100;
    
    doc.fillColor('#7f8c8d')
       .fontSize(8)
       .font('Helvetica')
       .text('Reporte generado automáticamente por el Sistema de Laboratorio Clínico.', 
             50, footerY, { width: 500, align: 'center' });
    
    doc.moveDown(1);
    doc.text('Firma del Responsable:', 50, doc.y, { align: 'center' });
    
    // Línea para firma
    doc.strokeColor('#95a5a6')
       .lineWidth(1)
       .moveTo(200, doc.y + 20)
       .lineTo(400, doc.y + 20)
       .stroke();
    
    doc.fillColor('#7f8c8d')
       .fontSize(8)
       .text('Dr. Responsable del Laboratorio', 200, doc.y + 25, { width: 200, align: 'center' });

    // Finalizar documento
    doc.end();

    console.log('✅ PDF de reporte completo generado exitosamente');

  } catch (error) {
    console.error('❌ Error generando PDF de reporte completo:', error);
    res.status(500).json({ 
      success: false,
      error: 'Error al generar el PDF del reporte',
      detalle: error.message 
    });
  }
};

// 🔧 FUNCIÓN AUXILIAR: Obtener datos para reporte
const obtenerDatosReporte = async (pacienteId, fechaInicio, fechaFin) => {
  try {
    const whereConditions = {
      pacienteId: pacienteId,
      estado: 'listo',
      resultado: { [db.Sequelize.Op.ne]: null }
    };

    // Filtrar por fechas si se proporcionan
    if (fechaInicio && fechaFin) {
      whereConditions.fechaResultado = {
        [db.Sequelize.Op.between]: [
          new Date(fechaInicio + 'T00:00:00'),
          new Date(fechaFin + 'T23:59:59')
        ]
      };
    }

    const examenes = await ExamenPaciente.findAll({
      where: whereConditions,
      include: [
        {
          model: Examen,
          attributes: ['id', 'nombre', 'areaId'],
          include: [
            {
              model: Area,
              as: 'Area',
              attributes: ['id', 'nombre']
            }
          ]
        },
        {
          model: Paciente,
          attributes: ['id', 'nombres', 'apellidos', 'cedula']
        }
      ],
      order: [['fechaResultado', 'DESC']]
    });

    if (examenes.length === 0) {
      return {
        success: false,
        mensaje: 'No se encontraron exámenes completados para el período seleccionado'
      };
    }

    // Calcular estadísticas
    const estadisticas = {
      totalExamenes: examenes.length,
      porArea: {},
      porMes: {}
    };

    examenes.forEach(examen => {
      const areaNombre = examen.Examen?.Area?.nombre || 'Sin área';
      const mes = new Date(examen.fechaResultado).toLocaleString('es-ES', { 
        year: 'numeric', 
        month: 'long' 
      });

      // Estadísticas por área
      if (!estadisticas.porArea[areaNombre]) {
        estadisticas.porArea[areaNombre] = 0;
      }
      estadisticas.porArea[areaNombre]++;

      // Estadísticas por mes
      if (!estadisticas.porMes[mes]) {
        estadisticas.porMes[mes] = 0;
      }
      estadisticas.porMes[mes]++;
    });

    return {
      success: true,
      data: {
        paciente: examenes[0].Paciente,
        examenes,
        estadisticas
      }
    };

  } catch (error) {
    console.error('❌ Error obteniendo datos para reporte:', error);
    throw error;
  }
};

module.exports = {
  // GENERACIÓN DE PDFs
  generarPDFResultados,
  generarPDFReporteCompleto,
  
  // GESTIÓN DE RESULTADOS
  subirResultadoExamen,
  obtenerDetallesResultados,
  
  // CONSULTAS E HISTORIAL
  obtenerHistorialExamenes,
  generarReporteEstadistico,
  
  // FUNCIONES AUXILIARES
  obtenerDatosReporte
};