const XLSX = require('xlsx');
const fs = require('fs');
const path = require('path');
const db = require('../models');
const { obtenerTuboPorTipoMuestra } = require('../utils/config-tubos');

const Examen = db.Examen;
const Subexamen = db.Subexamen;
const Area = db.Area;

// 🔧 Limpiar precios tipo "10,50" o "$10.00"
function limpiarPrecio(valor) {
  if (!valor) return 0;
  const limpio = (valor + '').replace(',', '.');
  const numero = parseFloat(limpio.replace(/[^\d.]/g, ''));
  return isNaN(numero) ? 0 : numero;
}

// ❌ Validar campos obligatorios
function tieneCamposObligatoriosVacios(fila, index) {
  const area = fila['Área'] || '';
  const examen = fila['Nombre del Examen'] || '';
  if (!(area.trim() && examen.trim())) {
    console.warn(`❗ Campos obligatorios vacíos en fila ${index + 1}`);
    return true;
  }
  return false;
}

// ❌ Validar subexamen duplicado
async function esSubexamenDuplicado(nombreSubexamen, examenId) {
  const existente = await Subexamen.findOne({
    where: {
      nombre: nombreSubexamen.trim(),
      examen_id: examenId
    }
  });
  return !!existente;
}

exports.importarDesdeExcel = async (req, res) => {
  try {
    const archivo = req.file;
    if (!archivo) {
      return res.status(400).json({ error: 'No se subió ningún archivo' });
    }

    const workbook = XLSX.readFile(archivo.path);
    const hoja = workbook.Sheets[workbook.SheetNames[0]];
    const datos = XLSX.utils.sheet_to_json(hoja, { defval: '' });

    for (const fila of datos) {
      const nombre = fila['Nombre del Examen'];
      const precio = limpiarPrecio(fila['Precio']);
      const tipoPrecio = fila['Tipo Precio'];
      const tipoMuestra = fila['Tipo de Muestra'];
      const tiempoEntrega = fila['Tiempo de Entrega'];
      const observaciones = fila['Observaciones'];
      const areaNombre = fila['Área'];

      if (!nombre || !areaNombre) continue;

      const [area] = await Area.findOrCreate({
        where: { nombre: areaNombre.trim() }
      });

      await Examen.create({
        nombre: nombre.trim(),
        precio,
        tipoPrecio,
        tipoMuestra,
        tipoTubo: obtenerTuboPorTipoMuestra(tipoMuestra),
        tiempoEntrega,
        observaciones,
        area_id: area.id
      });
    }

    // 📝 Registrar historial
    await db.ImportacionTipoExamen.create({
      usuario: req.usuario?.nombre || 'Administrador',
      archivo: archivo.originalname,
      cantidadFilas: datos.length
    });

    fs.unlinkSync(archivo.path);

    res.json({
      mensaje: '✅ Importación plana completada correctamente',
      totalFilas: datos.length
    });

  } catch (error) {
    console.error('❌ Error al importar Excel plano:', error);
    res.status(500).json({
      error: 'Error al importar el archivo Excel',
      detalle: error.message
    });
  }
};


// ✅ Importar desde Excel Jerárquico
exports.importarDesdeExcelJerarquico = async (req, res) => {
  try {
    const archivo = req.file;
    if (!archivo) {
      return res.status(400).json({ error: 'No se subió ningún archivo' });
    }

    // ✔️ Validar extensión
    const ext = path.extname(archivo.originalname);
    if (ext !== '.xlsx') {
      fs.unlinkSync(archivo.path);
      return res.status(400).json({ error: 'Solo se permiten archivos .xlsx' });
    }

    const workbook = XLSX.readFile(archivo.path);
    const hoja = workbook.Sheets[workbook.SheetNames[0]];
    const datos = XLSX.utils.sheet_to_json(hoja, { defval: '' });

    console.log('📄 Columnas:', Object.keys(datos[0] || {}));
    console.log('🔍 Primeras filas:', datos.slice(0, 2));

    let subexamenesDuplicados = 0;
    let filasInvalidas = 0;

    for (const [index, fila] of datos.entries()) {
      try {
        const areaNombre = fila['Área'];
        const examenNombre = fila['Nombre del Examen'];
        const subexamenNombre = fila['Nombre del Subexamen'];
        const precio = limpiarPrecio(fila['Precio']);
        const tipoPrecio = fila['Tipo Precio'];
        const tipoMuestra = fila['Tipo de Muestra'];
        const tiempoEntrega = fila['Tiempo de Entrega'];
        const observaciones = fila['Observaciones'];

        // ❌ Campos vacíos
        if (tieneCamposObligatoriosVacios(fila, index)) {
          filasInvalidas++;
          continue;
        }

        const [area] = await Area.findOrCreate({
          where: { nombre: areaNombre.trim() }
        });

        const [examen] = await Examen.findOrCreate({
          where: {
            nombre: examenNombre.trim(),
            area_id: area.id
          },
          defaults: {
            precio: 0,
            tipoPrecio: '',
            tipoMuestra: '',
            tipoTubo: '',
            tiempoEntrega: '',
            observaciones: ''
          }
        });

        const tieneSubexamen = subexamenNombre &&
          subexamenNombre.toString().trim().toLowerCase() !== 'n/a' &&
          subexamenNombre.toString().trim().toLowerCase() !== 'null' &&
          subexamenNombre.toString().trim() !== '';

        if (!tieneSubexamen) {
          // Actualizar examen principal
          await examen.update({
            precio: precio || examen.precio,
            tipoPrecio: tipoPrecio || examen.tipoPrecio,
            tipoMuestra: tipoMuestra || examen.tipoMuestra,
            tipoTubo: obtenerTuboPorTipoMuestra(tipoMuestra) || examen.tipoTubo,
            tiempoEntrega: tiempoEntrega || examen.tiempoEntrega,
            observaciones: observaciones || examen.observaciones
          });
          console.log(`✅ Examen actualizado: ${examen.nombre}`);
        } else {
          const duplicado = await esSubexamenDuplicado(subexamenNombre, examen.id);
          if (duplicado) {
            console.warn(`⚠️ Subexamen duplicado: ${subexamenNombre} para ${examen.nombre}`);
            subexamenesDuplicados++;
            continue;
          }

          await Subexamen.create({
            nombre: subexamenNombre.trim(),
            examen_id: examen.id,
            precio: precio,
            tipoPrecio: tipoPrecio,
            tipoMuestra: tipoMuestra,
            tipoTubo: obtenerTuboPorTipoMuestra(tipoMuestra),
            tiempoEntrega: tiempoEntrega,
            observaciones: observaciones
          });

          console.log(`🧪 Subexamen agregado: ${subexamenNombre}`);
        }

      } catch (error) {
        console.error(`❌ Error fila ${index + 1}:`, error.message);
        filasInvalidas++;
      }
    }

    // 📝 Registrar historial de importación
    if (db.HistorialImportacion) {
      await db.HistorialImportacion.create({
  nombre_archivo: archivo.originalname,
  usuario: req.usuario?.email || 'admin',
  fecha_importacion: new Date() // ✅ Este sí existe
});

    }

    fs.unlinkSync(archivo.path); // Borrar archivo subido

    res.json({
      mensaje: '✅ Importación completada',
      totalFilas: datos.length,
      subexamenesDuplicados,
      filasInvalidas
    });

  } catch (error) {
    console.error('❌ Error general:', error.message);
    res.status(500).json({
      error: 'Error al importar Excel',
      detalle: error.message
    });
  }
};

exports.eliminarTodoJerarquico = async (req, res) => {
  try {
    await db.Subexamen.destroy({ where: {}, truncate: true });
    await db.Examen.destroy({ where: {}, truncate: true });
    await db.Area.destroy({ where: {}, truncate: true });

    res.json({ mensaje: '✅ Todos los registros jerárquicos han sido eliminados correctamente.' });
  } catch (error) {
    console.error('❌ Error al eliminar jerarquía:', error);
    res.status(500).json({ error: 'Error al eliminar los registros jerárquicos.' });
  }
};


// Crear nuevo tipo de examen
exports.create = async (req, res) => {
  try {
    const { nombre, precio, tipoPrecio, tipoMuestra, tiempoEntrega, observaciones, area_id } = req.body;

    const nuevoExamen = await db.Examen.create({
      nombre,
      precio,
      tipoPrecio,
      tipoMuestra,
      tipoTubo: obtenerTuboPorTipoMuestra(tipoMuestra),
      tiempoEntrega,
      observaciones,
      area_id
    });

    res.status(201).json(nuevoExamen);
  } catch (error) {
    console.error('❌ Error al crear tipo de examen:', error);
    res.status(500).json({ error: 'Error al crear el tipo de examen' });
  }
};

// Obtener todos los tipos de examen
exports.findAll = async (req, res) => {
  try {
    const examenes = await db.Examen.findAll({
      include: [
        {
          model: db.Area,
          attributes: ['id', 'nombre']
        },
        {
          model: db.Subexamen,
          attributes: ['id', 'nombre', 'precio', 'tipoPrecio', 'tipoMuestra', 'tipoTubo', 'tiempoEntrega', 'observaciones']
        }
      ],
      order: [
  [db.Area, 'nombre', 'ASC'],
  ['nombre', 'ASC']
]

    });
    
    res.json(examenes);
  } catch (error) {
    console.error('❌ Error al obtener tipos de examen:', error);
    res.status(500).json({ error: 'Error al obtener los tipos de examen' });
  }
};

// Obtener un tipo de examen por ID
exports.findOne = async (req, res) => {
  try {
    const { id } = req.params;
    const examen = await db.Examen.findByPk(id, {
      include: [
        {
          model: db.Area,
          attributes: ['id', 'nombre']
        },
        {
          model: db.Subexamen,
          attributes: ['id', 'nombre', 'precio', 'tipoPrecio', 'tipoMuestra', 'tipoTubo', 'tiempoEntrega', 'observaciones']
        }
      ]
    });

    if (!examen) {
      return res.status(404).json({ error: 'Tipo de examen no encontrado' });
    }

    res.json(examen);
  } catch (error) {
    console.error('❌ Error al obtener tipo de examen:', error);
    res.status(500).json({ error: 'Error al obtener el tipo de examen' });
  }
};

// Actualizar un tipo de examen
exports.update = async (req, res) => {
  try {
    const { id } = req.params;
    const { nombre, precio, tipoPrecio, tipoMuestra, tiempoEntrega, observaciones, area_id } = req.body;

    const examen = await db.Examen.findByPk(id);
    
    if (!examen) {
      return res.status(404).json({ error: 'Tipo de examen no encontrado' });
    }

    await examen.update({
      nombre,
      precio,
      tipoPrecio,
      tipoMuestra,
      tipoTubo: obtenerTuboPorTipoMuestra(tipoMuestra),
      tiempoEntrega,
      observaciones,
      area_id
    });

    res.json({ mensaje: '✅ Tipo de examen actualizado correctamente', examen });
  } catch (error) {
    console.error('❌ Error al actualizar tipo de examen:', error);
    res.status(500).json({ error: 'Error al actualizar el tipo de examen' });
  }
};

// Eliminar un tipo de examen
exports.delete = async (req, res) => {
  try {
    const { id } = req.params;
    
    const examen = await db.Examen.findByPk(id);
    
    if (!examen) {
      return res.status(404).json({ error: 'Tipo de examen no encontrado' });
    }

    // Primero eliminar subexámenes relacionados
    await db.Subexamen.destroy({ where: { examen_id: id } });
    
    // Luego eliminar el examen
    await examen.destroy();

    res.json({ mensaje: '✅ Tipo de examen eliminado correctamente' });
  } catch (error) {
    console.error('❌ Error al eliminar tipo de examen:', error);
    res.status(500).json({ error: 'Error al eliminar el tipo de examen' });
  }
};

exports.obtenerAreasUnicas = async (req, res) => {
  try {
    const areas = await db.Area.findAll({
      attributes: ['id', 'nombre'],
      order: [['nombre', 'ASC']],
    });

    res.json(areas);
  } catch (error) {
    console.error('Error al obtener las áreas:', error);
    res.status(500).json({ mensaje: 'Error al obtener las áreas' });
  }
};
