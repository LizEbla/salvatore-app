// controllers/sucursal.controller.js
const db = require('../models');
const Sucursal = db.Sucursal;

// 📌 Obtener todas las sucursales
exports.obtenerSucursales = async (req, res) => {
  try {
    const sucursales = await Sucursal.findAll();
    res.json({ success: true, data: sucursales });
  } catch (error) {
    console.error('❌ Error al obtener sucursales:', error);
    res.status(500).json({ success: false, mensaje: 'Error al obtener sucursales' });
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
    res.status(201).json({ success: true, data: nuevaSucursal, mensaje: 'Sucursal creada exitosamente' });
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
    res.json({ success: true, data: sucursal, mensaje: 'Sucursal actualizada exitosamente' });
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
    res.json({ success: true, data: sucursal, mensaje: 'Sucursal desactivada exitosamente' });
  } catch (error) {
    console.error('❌ Error al desactivar sucursal:', error);
    res.status(500).json({ success: false, mensaje: 'Error al desactivar sucursal' });
  }
};
