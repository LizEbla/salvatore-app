const multer = require('multer');
const path = require('path');

// Configuración de multer para resultados de exámenes
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'uploads/resultados/');
  },
  filename: function (req, file, cb) {
    // Generar nombre único para el archivo
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'resultado-' + uniqueSuffix + path.extname(file.originalname));
  }
});

// Filtrar tipos de archivo para resultados
const fileFilter = (req, file, cb) => {
  const allowedTypes = [
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'image/jpeg',
    'image/jpg',
    'image/png'
  ];
  
  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Tipo de archivo no permitido. Solo se permiten PDF, Word, JPG, PNG.'), false);
  }
};

const uploadResultados = multer({
  storage: storage,
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB límite
  },
  fileFilter: fileFilter
});

module.exports = uploadResultados;