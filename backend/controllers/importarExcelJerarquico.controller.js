const XLSX = require('xlsx');
const fs = require('fs');
const path = require('path');
const db = require('../models');
const { obtenerTuboPorTipoMuestra } = require('../utils/config-tubos');

exports.importarDesdeExcelJerarquico = async (req, res) => {
  try {
    const archivo = req.file;

    if (!archivo) {
      return res.status(400).json({ error: 'No se subió ningún archivo' });
    }

    const workbook = XLSX.readFile(archivo.path);
    const hoja = workbook.Sheets[workbook.SheetNames[0]];
    const filas = XLSX.utils.sheet_to_json(hoja);

    for (const fila of filas) {
      const nombreArea = fila['Área']?.trim();
      const nombreExamen = fila['Nombre del examen']?.trim();
      const nombreSubexamen = fila['Subexamen']?.trim() || null;

      // Buscar o crear el área
      const [area] = await db.Area.findOrCreate({ where: { nombre: nombreArea } });

      // Buscar o crear el examen asociado a esa área
      const [examen] = await db.Examen.findOrCreate({
        where: { nombre: nombreExamen, areaId: area.id }
      });

      // Crear subexamen asociado
      await db.Subexamen.create({
        nombre: nombreSubexamen,
        precio: parseFloat((fila['Precio'] + '').replace(/[^\d.]/g, '')) || 0,
        tipoMuestra: fila['Tipo de muestra']?.trim(),
        tiempoEntrega: fila['Tiempo de entrega']?.trim(),
        tipoTubo: obtenerTuboPorTipoMuestra(fila['Tipo de muestra']),
        observaciones: fila['Observaciones']?.trim() || '',
        examenId: examen.id
      });
    }

    fs.unlinkSync(archivo.path); // eliminar archivo temporal
    res.json({ mensaje: 'Importación jerárquica exitosa', total: filas.length });

  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al importar el archivo Excel jerárquico' });
  }
};
