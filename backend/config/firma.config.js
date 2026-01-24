// backend/config/firma.config.js
module.exports = {
  // Configuración de firma digital
  firma: {
    // Niveles de firma PAdES
    niveles: {
      basico: 'PAdES-B-B',
      timestamp: 'PAdES-B-T',
      largoPlazo: 'PAdES-B-LT'
    },
    
    // Algoritmos soportados
    algoritmos: {
      hash: ['SHA256', 'SHA384', 'SHA512'],
      encriptacion: ['RSA', 'ECDSA']
    },
    
    // Configuración de certificados
    certificados: {
      tiposPermitidos: ['.p12', '.pfx'],
      tamañoMaximo: 10 * 1024 * 1024, // 10MB
      contraseñaIntentos: 3
    },
    
    // Configuración de PDF
    pdf: {
      tamañoMaximo: 15 * 1024 * 1024, // 15MB
      versionMinima: '1.4',
      metadatosRequeridos: ['Title', 'Author', 'Subject']
    },
    
    // Configuración de firma visual
    selloVisual: {
      habilitado: true,
      posicion: 'ultima-pagina',
      mostrar: {
        certificado: true,
        fecha: true,
        hash: true,
        qr: true
      },
      estilo: {
        colorPrincipal: '#0061A8', // Azul Salvatore
        colorSecundario: '#D54C53', // Rojo Salvatore
        fuente: 'Helvetica',
        tamañoFuente: 10
      }
    },
    
    // Auditoría y logging
    auditoria: {
      habilitado: true,
      nivel: 'detallado',
      almacenamiento: 'base-datos', // o 'archivo'
      retencionDias: 365
    },
    
    // Validaciones
    validaciones: {
      fechaCertificado: true,
      revocacionCRL: false, // Requiere conexión a internet
      politicaFirma: true
    }
  },
  
  // Entornos
  entornos: {
    desarrollo: {
      modoPrueba: true,
      firmarSinPassword: false,
      logDetallado: true
    },
    produccion: {
      modoPrueba: false,
      validacionesEstrictas: true,
      sslRequerido: true
    }
  }
};