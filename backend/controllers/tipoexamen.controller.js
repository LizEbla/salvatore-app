const XLSX = require('xlsx');
const fs = require('fs');
const path = require('path');
const db = require('../models');
const { obtenerTuboPorTipoMuestra } = require('../utils/config-tubos');
const { Op } = require('sequelize');


const Examen = db.Examen;
const Subexamen = db.Subexamen;
const Area = db.Area;

const TipoExamen = db.TipoExamen;


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
// Crear nuevo tipo de examen
exports.create = async (req, res) => {
  try {
    const { nombre, precio, tipoPrecio, tipoMuestra, tiempoEntrega, observaciones, area_id, tipoTubo } = req.body;

    // Determinar el tipo de tubo: usar el proporcionado o calcularlo automáticamente
    let tuboFinal = tipoTubo;
    if ((!tipoTubo || tipoTubo.trim() === '') && tipoMuestra) {
      tuboFinal = obtenerTuboPorTipoMuestra(tipoMuestra);
    }

    const nuevoExamen = await db.Examen.create({
      nombre,
      precio,
      tipoPrecio,
      tipoMuestra,
      tipoTubo: tuboFinal,
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
// Obtener todos los tipos de examen - CORREGIDO
// findAll

exports.findAll = async (req, res) => {
  try {
    const examenes = await Examen.findAll({
      include: [
        {
          model: Area,
          as: 'Area',  // ✅ USAR 'Area' (con A mayúscula) - COMO ESTÁ EN index.js
          attributes: ['id', 'nombre']
        },
        {
          model: Subexamen,
          as: 'Subexamenes',  // ✅ USAR 'Subexamenes' (con S mayúscula) - COMO ESTÁ EN index.js
          attributes: ['id', 'nombre', 'precio', 'tipoPrecio', 'tipoMuestra', 'tipoTubo', 'tiempoEntrega', 'observaciones']
        }
      ],
      order: [
        [{ model: Area, as: 'Area' }, 'nombre', 'ASC'], // ✅ También corregir aquí
        ['nombre', 'ASC']
      ]
    });
    res.json(examenes);
  } catch (error) {
    console.error('❌ Error al obtener tipos de examen:', error);
    res.status(500).json({ error: 'Error al obtener los tipos de examen' });
  }
};


exports.findOne = async (req, res) => {
  try {
    const { id } = req.params;
    
    const examen = await db.Examen.findByPk(id, {
      include: [
        {
          model: db.Area,
          as: 'Area',  // ✅ 'Area' con A mayúscula
          attributes: ['id', 'nombre']
        },
        {
          model: db.Subexamen,
          as: 'Subexamenes',  // ✅ 'Subexamenes' con S mayúscula
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

exports.update = async (req, res) => {
  try {
    const { id } = req.params;
    const { nombre, precio, tipoPrecio, tipoMuestra, tiempoEntrega, observaciones, tipoTubo } = req.body;
    // ↑ Remover area_id de los parámetros si no es necesario

    const examen = await db.Examen.findByPk(id);
    
    if (!examen) {
      return res.status(404).json({ error: 'Tipo de examen no encontrado' });
    }

    // Lógica para determinar el tipo de tubo:
    let tuboFinal = tipoTubo;
    
    // Si el tipo de tubo está vacío pero hay tipo de muestra, determinar automáticamente
    if ((!tipoTubo || tipoTubo.trim() === '') && tipoMuestra) {
      tuboFinal = obtenerTuboPorTipoMuestra(tipoMuestra);
    }
    
    // Si tampoco hay tipo de muestra, mantener el valor actual
    if ((!tipoTubo || tipoTubo.trim() === '') && !tipoMuestra) {
      tuboFinal = examen.tipoTubo; // Mantener el valor existente
    }

    await examen.update({
      nombre,
      precio,
      tipoPrecio,
      tipoMuestra,
      tipoTubo: tuboFinal, // Usamos el tubo determinado
      tiempoEntrega,
      observaciones
      // ↑ Remover area_id aquí también
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


// Obtener subexamen por ID
exports.findSubexamen = async (req, res) => {
  try {
    const { id } = req.params;
    const subexamen = await db.Subexamen.findByPk(id, {
      include: [
        {
          model: db.Examen,
          include: [{
            model: db.Area,
            attributes: ['id', 'nombre']
          }]
        }
      ]
    });

    if (!subexamen) {
      return res.status(404).json({ error: 'Subexamen no encontrado' });
    }

    res.json(subexamen);
  } catch (error) {
    console.error('❌ Error al obtener subexamen:', error);
    res.status(500).json({ error: 'Error al obtener el subexamen' });
  }
};

// Actualizar subexamen
exports.updateSubexamen = async (req, res) => {
  try {
    const { id } = req.params;
    const { nombre, precio, tipoMuestra, tiempoEntrega, observaciones, tipoTubo } = req.body;

    const subexamen = await db.Subexamen.findByPk(id);
    
    if (!subexamen) {
      return res.status(404).json({ error: 'Subexamen no encontrado' });
    }

    // Lógica para determinar el tipo de tubo
    let tuboFinal = tipoTubo;
    if ((!tipoTubo || tipoTubo.trim() === '') && tipoMuestra) {
      tuboFinal = obtenerTuboPorTipoMuestra(tipoMuestra);
    }
    if ((!tipoTubo || tipoTubo.trim() === '') && !tipoMuestra) {
      tuboFinal = subexamen.tipoTubo;
    }

    await subexamen.update({
      nombre,
      precio,
      tipoMuestra,
      tiempoEntrega,
      observaciones,
      tipoTubo: tuboFinal
    });

    res.json({ mensaje: '✅ Subexamen actualizado correctamente', subexamen });
  } catch (error) {
    console.error('❌ Error al actualizar subexamen:', error);
    res.status(500).json({ error: 'Error al actualizar el subexamen' });
  }
};


// Agrega estos métodos al controlador

exports.crearArea = async (req, res) => {
  try {
    const { nombre } = req.body;
    
    // Aquí va tu lógica para crear el área en la base de datos
    // Ejemplo con Sequelize:
    const nuevaArea = await Area.create({ nombre });
    
    res.status(201).json({
      success: true,
      message: 'Área creada exitosamente',
      data: nuevaArea
    });
  } catch (error) {
    console.error('Error al crear área:', error);
    res.status(500).json({
      success: false,
      message: 'Error al crear área',
      error: error.message
    });
  }
};

exports.actualizarArea = async (req, res) => {
  try {
    const { id } = req.params;
    const { nombre } = req.body;
    
    const area = await Area.findByPk(id);
    if (!area) {
      return res.status(404).json({
        success: false,
        message: 'Área no encontrada'
      });
    }
    
    await area.update({ nombre });
    
    res.json({
      success: true,
      message: 'Área actualizada exitosamente',
      data: area
    });
  } catch (error) {
    console.error('Error al actualizar área:', error);
    res.status(500).json({
      success: false,
      message: 'Error al actualizar área',
      error: error.message
    });
  }
};

exports.eliminarArea = async (req, res) => {
  try {
    const { id } = req.params;
    
    const area = await Area.findByPk(id);
    if (!area) {
      return res.status(404).json({
        success: false,
        message: 'Área no encontrada'
      });
    }
    
    await area.destroy();
    
    res.json({
      success: true,
      message: 'Área eliminada exitosamente'
    });
  } catch (error) {
    console.error('Error al eliminar área:', error);
    res.status(500).json({
      success: false,
      message: 'Error al eliminar área',
      error: error.message
    });
  }
};

exports.crearConSubexamenes = async (req, res) => {
  try {
    // Lógica para crear examen con subexámenes
    // Debes implementar esta función
    res.status(201).json({ success: true, message: 'Examen con subexámenes creado' });
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ success: false, message: error.message });
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

// Buscar exámenes por área o nombre
// tipoexamen.controller.js
// Buscar exámenes por área o nombre
exports.buscarExamenes = async (req, res) => {
  try {
    const { areaId, nombre } = req.query;

    let where = {};
    if (areaId && areaId !== 'all') {
      where.area_id = areaId; // ✅ en BD la columna es area_id
    }
    if (nombre) {
      where.nombre = { [db.Sequelize.Op.iLike]: `%${nombre}%` }; // ✅ búsqueda parcial
    }

    const examenes = await Examen.findAll({
      where,
      include: [
        {
          model: Area,
          as: 'Area',
          attributes: ['id', 'nombre']
        },
        {
          model: Subexamen,
          attributes: [
            'id',
            'nombre',
            'precio',
            'tipoPrecio',
            'tipoMuestra',
            'tipoTubo',
            'tiempoEntrega',
            'observaciones'
          ]
        }
      ],
      order: [['nombre', 'ASC']]
    });

    // 🔹 Asegurar que precio sea siempre número
    const examenesFormateados = examenes.map(ex => ({
      ...ex.toJSON(),
      precio: Number(ex.precio) || 0
    }));

    res.json(examenesFormateados);
  } catch (error) {
    console.error('❌ Error en buscarExamenes:', error);
    res.status(500).json({ mensaje: 'Error al buscar exámenes', detalle: error.message });
  }
};

// Obtener exámenes por área (con subexámenes)
exports.obtenerPorArea = async (req, res) => {
  try {
    const { id } = req.params;
    const examenes = await Examen.findAll({
      where: { area_id: id },
      include: [
        {
          model: Subexamen,
          as: 'Subexamenes' // ✅ 'Subexamenes' con S mayúscula
        }
      ]
    });
    res.json(examenes);
  } catch (error) {
    console.error('❌ Error al obtener exámenes por área:', error);
    res.status(500).json({ mensaje: 'Error al obtener exámenes por área' });
  }
};




exports.buscarExamenes = async (req, res) => {
  try {
    const { areaId, nombre } = req.query;

    let where = {};
    if (areaId && areaId !== 'all') {
      where.area_id = areaId;
    }
    if (nombre) {
      where.nombre = { [db.Sequelize.Op.iLike]: `%${nombre}%` };
    }

    const examenes = await Examen.findAll({
      where,
      include: [
        {
          model: Area,
          as: 'Area',  // ✅ 'Area' con A mayúscula
          attributes: ['id', 'nombre']
        },
        {
          model: Subexamen,
          as: 'Subexamenes',  // ✅ 'Subexamenes' con S mayúscula
          attributes: ['id', 'nombre', 'precio', 'tipoPrecio', 'tipoMuestra', 'tipoTubo', 'tiempoEntrega', 'observaciones']
        }
      ],
      order: [['nombre', 'ASC']]
    });

    res.json(examenes);
  } catch (error) {
    console.error('❌ Error en buscarExamenes:', error);
    res.status(500).json({ mensaje: 'Error al buscar exámenes', detalle: error.message });
  }
};

// 👉 listar áreas (para el combo del filtro)
exports.listarAreas = async (_req, res) => {
  try {
    const areas = await db.Area.findAll({ order: [['nombre', 'ASC']] });
    res.json(areas);
  } catch (e) {
    console.error(e);
    res.status(500).json({ mensaje: 'Error al listar áreas' });
  }
};


// ✅ Importar desde Excel Jerárquico
exports.importarDesdeExcelJerarquico = async (req, res) => {
  try {
    const archivo = req.file; // ← Ahora es req.file con multer

    if (!archivo) {
      return res.status(400).json({ error: 'No se subió ningún archivo' });
    }

    console.log('📁 Archivo recibido:', archivo.originalname);

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


exports.obtenerJerarquico = async (req, res) => {
  try {
    console.log('🔍 Obteniendo estructura jerárquica con include...');

    const areas = await Area.findAll({
      attributes: ['id', 'nombre'],
      include: [
        {
          model: Examen,
          as: 'Examenes',   // ✅ 'Examenes' con E mayúscula - COMO ESTÁ EN index.js
          attributes: ['id', 'nombre', 'precio', 'tipoMuestra', 'tipoTubo', 'tiempoEntrega', 'observaciones'],
          include: [
            {
              model: Subexamen,
              as: 'Subexamenes',   // ✅ 'Subexamenes' con S mayúscula - COMO ESTÁ EN index.js
              attributes: ['id', 'nombre', 'precio', 'tipoMuestra', 'tipoTubo', 'tiempoEntrega', 'observaciones']
            }
          ]
        }
      ],
      order: [
        ['nombre', 'ASC'],
        [{ model: Examen, as: 'Examenes' }, 'nombre', 'ASC'],
        [{ model: Examen, as: 'Examenes' }, { model: Subexamen, as: 'Subexamenes' }, 'nombre', 'ASC']
      ]
    });

    console.log('✅ Jerarquía lista');
    res.json(areas);

  } catch (error) {
    console.error('❌ Error en obtenerJerarquico:', error);
    res.status(500).json({ error: 'Error al obtener jerarquía', detalle: error.message });
  }
};

