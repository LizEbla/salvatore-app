// controllers/sucursal.controller.js
const db = require('../models');
const { Sucursal, Laboratorista, ExamenPaciente, Sequelize } = db;
const Op = Sequelize.Op;

// 📌 Obtener todas las sucursales (CON ESTADÍSTICAS)
exports.obtenerSucursales = async (req, res) => {
  try {
    // 🔹 Rango de fecha: solo HOY
    const hoy = new Date();
    const inicioDia = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate(), 0, 0, 0);
    const finDia    = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate(), 23, 59, 59);

    const sucursales = await Sucursal.findAll();

    const data = await Promise.all(
      sucursales.map(async (sucursal) => {
        const json = sucursal.toJSON();

        // ✅ Laboratoristas activos por sucursal
        const totalLaboratoristas = await Laboratorista.count({
          where: {
            sucursalId: sucursal.id,   // O "SucursalId" si tu FK se llama así
            activo: true               // Si no tienes campo activo, elimina esta línea
          }
        });

        // ✅ Exámenes del DÍA ACTUAL por sucursal
        //    (sin filtrar por estado, para evitar el error de columna inexistente)
        const whereExamenes = {
          sucursalId: sucursal.id,
          fechaAsignacion: {
            [Op.between]: [inicioDia, finDia]
          }
        };

        // 👉 Si más adelante creas una columna para el estado, por ejemplo `estadoExamen`,
        //    puedes agregar algo así:
        // whereExamenes.estadoExamen = { [Op.ne]: 'anulado' };

        const totalExamenesRegistrados = await ExamenPaciente.count({
          where: whereExamenes
        });

        return {
          ...json,
          totalLaboratoristas,
          totalExamenesRegistrados
        };
      })
    );

    return res.json({
      success: true,
      data
    });

  } catch (error) {
    console.error('❌ Error al obtener sucursales:', error);
    res.status(500).json({
      success: false,
      mensaje: 'Error al obtener sucursales'
    });
  }
};

// 📌 Crear sucursal
exports.crearSucursal = async (req, res) => {
  console.log("📥 Datos recibidos en crearSucursal:", req.body);

  try {
    const { nombre, direccion, telefono, ciudad } = req.body;

    if (!nombre) {
      return res.status(400).json({ success: false, mensaje: 'El nombre es obligatorio' });
    }

    const nuevaSucursal = await Sucursal.create({ nombre, direccion, telefono, ciudad });
    res.status(201).json({
      success: true,
      data: nuevaSucursal,
      mensaje: 'Sucursal creada exitosamente'
    });
  } catch (error) {
    console.error('❌ Error al crear sucursal:', error);
    res.status(500).json({ success: false, mensaje: 'Error al crear sucursal' });
  }
};

// 📌 Actualizar sucursal
exports.actualizarSucursal = async (req, res) => {
  try {
    const { id } = req.params;
    const { nombre, direccion, telefono, ciudad } = req.body;

    const sucursal = await Sucursal.findByPk(id);
    if (!sucursal) {
      return res.status(404).json({ success: false, mensaje: 'Sucursal no encontrada' });
    }

    await sucursal.update({ nombre, direccion, telefono, ciudad });
    res.json({
      success: true,
      data: sucursal,
      mensaje: 'Sucursal actualizada exitosamente'
    });
  } catch (error) {
    console.error('❌ Error al actualizar sucursal:', error);
    res.status(500).json({ success: false, mensaje: 'Error al actualizar sucursal' });
  }
};

// 📌 Desactivar sucursal
exports.desactivarSucursal = async (req, res) => {
  try {
    const { id } = req.params;

    const sucursal = await Sucursal.findByPk(id);
    if (!sucursal) {
      return res.status(404).json({ success: false, mensaje: 'Sucursal no encontrada' });
    }

    await sucursal.update({ activo: false });
    res.json({
      success: true,
      data: sucursal,
      mensaje: 'Sucursal desactivada exitosamente'
    });
  } catch (error) {
    console.error('❌ Error al desactivar sucursal:', error);
    res.status(500).json({ success: false, mensaje: 'Error al desactivar sucursal' });
  }
};
