const multer = require('multer');
const path = require('path');

// Configuración del almacenamiento
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/');
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    const nombreArchivo = Date.now() + ext;
    cb(null, nombreArchivo);
  }
});

// Validar solo archivos Excel
const fileFilter = (req, file, cb) => {
  if (file.mimetype === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
 {
    cb(null, true);
  } else {
    cb(new Error('Solo se permiten archivos .xlsx'), false);
  }
};

const upload = multer({ storage, fileFilter });

module.exports = upload;
