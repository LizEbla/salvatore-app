// middleware/certificateValidator.js
const forge = require('node-forge');

class CertificateValidator {
  constructor() {
    this.blacklistedCerts = new Set();
    this.loadBlacklist();
  }

  /**
   * ✅ VALIDACIÓN COMPLETA DEL CERTIFICADO
   */
  async validateCertificate(certFile, password) {
    const validationResults = {
      isValid: false,
      errors: [],
      warnings: [],
      certificateInfo: null
    };

    try {
      // 1. Validaciones básicas del archivo
      this.validateFileBasics(certFile, validationResults);
      
      // 2. Validación de contraseña
      this.validatePassword(password, validationResults);
      
      // 3. Parsear y descifrar certificado
      const { p12, certificate, privateKey } = await this.parseCertificate(certFile, password, validationResults);
      
      // 4. Validar fechas
      this.validateDates(certificate, validationResults);
      
      // 5. Validar clave y algoritmo
      this.validateKeyAndAlgorithm(certificate, validationResults);
      
      // 6. Validar emisor y sujeto
      this.validateIssuerAndSubject(certificate, validationResults);
      
      // 7. Validar uso de clave
      this.validateKeyUsage(certificate, validationResults);
      
      // 8. Verificar contra lista negra
      this.checkBlacklist(certificate, validationResults);
      
      // 9. Prueba de firma
      await this.testSignature(privateKey, certificate, validationResults);
      
      // Si llegamos aquí, el certificado es válido
      validationResults.isValid = true;
      validationResults.certificateInfo = this.extractCertificateInfo(certificate);
      
    } catch (error) {
      validationResults.errors.push(error.message);
    }

    return validationResults;
  }

  validateFileBasics(certFile, results) {
    // Validaciones de tamaño y formato
    if (!certFile || !certFile.buffer) {
      results.errors.push('Archivo de certificado no proporcionado');
      return;
    }

    const maxSize = 10 * 1024 * 1024; // 10MB
    if (certFile.buffer.length > maxSize) {
      results.errors.push(`Certificado demasiado grande (${(certFile.buffer.length / 1024 / 1024).toFixed(2)}MB)`);
    }

    if (certFile.buffer.length < 100) {
      results.errors.push('Certificado demasiado pequeño (posiblemente corrupto)');
    }
  }

  validatePassword(password, results) {
    const weakPasswords = [
      '123456', 'password', '12345678', 'qwerty',
      '123456789', '12345', '1234', '111111',
      '1234567', 'dragon', '123123', 'baseball',
      'abc123', 'football', 'monkey', 'letmein',
      '696969', 'shadow', 'master', '666666'
    ];

    if (!password || password.trim() === '') {
      results.errors.push('La contraseña no puede estar vacía');
      return;
    }

    const cleanPassword = password.trim();
    
    if (cleanPassword.length < 6) {
      results.errors.push('La contraseña debe tener al menos 6 caracteres');
    }

    if (weakPasswords.includes(cleanPassword.toLowerCase())) {
      results.warnings.push('La contraseña es demasiado débil (está en la lista de contraseñas comunes)');
    }

    // Verificar complejidad
    const hasUpperCase = /[A-Z]/.test(cleanPassword);
    const hasLowerCase = /[a-z]/.test(cleanPassword);
    const hasNumbers = /\d/.test(cleanPassword);
    const hasSpecial = /[^A-Za-z0-9]/.test(cleanPassword);

    let complexityScore = 0;
    if (hasUpperCase) complexityScore++;
    if (hasLowerCase) complexityScore++;
    if (hasNumbers) complexityScore++;
    if (hasSpecial) complexityScore++;

    if (complexityScore < 2) {
      results.warnings.push('La contraseña no es suficientemente compleja');
    }
  }

  async parseCertificate(certFile, password, results) {
    try {
      const p12Der = forge.util.createBuffer(certFile.buffer.toString('binary'));
      const p12Asn1 = forge.asn1.fromDer(p12Der);
      
      const p12 = forge.pkcs12.pkcs12FromAsn1(p12Asn1, password.trim());
      
      // Extraer clave privada
      const keyBags = p12.getBags({ bagType: forge.pki.oids.pkcs8ShroudedKeyBag });
      let privateKey;
      
      if (keyBags[forge.pki.oids.pkcs8ShroudedKeyBag] && 
          keyBags[forge.pki.oids.pkcs8ShroudedKeyBag].length > 0) {
        privateKey = keyBags[forge.pki.oids.pkcs8ShroudedKeyBag][0].key;
      }
      
      if (!privateKey) {
        throw new Error('No se pudo extraer la clave privada');
      }
      
      // Extraer certificado
      const certBags = p12.getBags({ bagType: forge.pki.oids.certBag });
      let certificate;
      
      if (certBags[forge.pki.oids.certBag] && 
          certBags[forge.pki.oids.certBag].length > 0) {
        certificate = certBags[forge.pki.oids.certBag][0].cert;
      }
      
      if (!certificate) {
        throw new Error('No se pudo extraer el certificado');
      }
      
      return { p12, certificate, privateKey };
      
    } catch (error) {
      if (error.message.includes('MAC') || error.message.includes('password')) {
        results.errors.push('Contraseña incorrecta o certificado corrupto');
      } else {
        results.errors.push(`Error al procesar el certificado: ${error.message}`);
      }
      throw error;
    }
  }

  validateDates(certificate, results) {
    const now = new Date();
    const validFrom = new Date(certificate.validity.notBefore);
    const validTo = new Date(certificate.validity.notAfter);
    
    if (now < validFrom) {
      results.errors.push(`Certificado aún no es válido (válido desde: ${validFrom.toLocaleDateString()})`);
    }
    
    if (now > validTo) {
      results.errors.push(`Certificado ha expirado (expiró el: ${validTo.toLocaleDateString()})`);
    }
    
    // Advertencia si expira en menos de 30 días
    const thirtyDaysFromNow = new Date();
    thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);
    
    if (validTo < thirtyDaysFromNow) {
      results.warnings.push(`Certificado expira pronto (${validTo.toLocaleDateString()})`);
    }
  }

  validateKeyAndAlgorithm(certificate, results) {
    const keySize = certificate.publicKey.n.bitLength();
    
    if (keySize < 2048) {
      results.errors.push(`Tamaño de clave inseguro (${keySize} bits). Mínimo 2048 bits requerido`);
    }
    
    // Verificar que sea RSA
    if (certificate.publicKey.algorithm.toLowerCase() !== 'rsa') {
      results.errors.push(`Algoritmo no soportado: ${certificate.publicKey.algorithm}. Solo RSA es soportado`);
    }
  }

  validateIssuerAndSubject(certificate, results) {
    const subjectCN = certificate.subject.getField('CN')?.value;
    const issuerCN = certificate.issuer.getField('CN')?.value;
    
    if (!subjectCN) {
      results.warnings.push('Certificado no tiene Common Name (CN) definido');
    }
    
    if (!issuerCN) {
      results.warnings.push('Emisor del certificado no identificado');
    }
    
    // Validar que no sea auto-firmado (a menos que sea permitido)
    if (subjectCN === issuerCN) {
      results.warnings.push('Certificado auto-firmado detectado');
    }
  }

  validateKeyUsage(certificate, results) {
    const keyUsage = certificate.getExtension('keyUsage');
    
    if (keyUsage) {
      if (!keyUsage.digitalSignature) {
        results.errors.push('Certificado no tiene permiso para firma digital');
      }
      
      if (keyUsage.keyCertSign || keyUsage.cRLSign) {
        results.warnings.push('Certificado tiene permisos de CA (posible riesgo)');
      }
    } else {
      results.warnings.push('No se encontró información de uso de clave en el certificado');
    }
  }

  checkBlacklist(certificate, results) {
    const serial = certificate.serialNumber;
    
    if (this.blacklistedCerts.has(serial)) {
      results.errors.push('Certificado está en la lista negra (revocado o comprometido)');
    }
  }

  async testSignature(privateKey, certificate, results) {
    try {
      const testData = 'Test signature validation ' + Date.now();
      const md = forge.md.sha256.create();
      md.update(testData, 'utf8');
      
      const signature = privateKey.sign(md);
      const verified = certificate.publicKey.verify(md.digest().bytes(), signature);
      
      if (!verified) {
        results.errors.push('Fallo prueba de firma: clave privada no corresponde al certificado');
      }
      
    } catch (error) {
      results.errors.push(`Error en prueba de firma: ${error.message}`);
    }
  }

  extractCertificateInfo(certificate) {
    return {
      serialNumber: certificate.serialNumber,
      subject: this.extractSubjectInfo(certificate.subject),
      issuer: this.extractSubjectInfo(certificate.issuer),
      validity: {
        notBefore: certificate.validity.notBefore,
        notAfter: certificate.validity.notAfter
      },
      publicKey: {
        algorithm: certificate.publicKey.algorithm,
        size: certificate.publicKey.n.bitLength()
      },
      extensions: this.extractExtensions(certificate)
    };
  }

  extractSubjectInfo(subject) {
    const info = {};
    const attributes = subject.attributes || [];
    
    attributes.forEach(attr => {
      info[attr.shortName || attr.name] = attr.value;
    });
    
    return info;
  }

  extractExtensions(certificate) {
    const extensions = {};
    
    if (certificate.extensions) {
      certificate.extensions.forEach(ext => {
        extensions[ext.name] = ext;
      });
    }
    
    return extensions;
  }

  loadBlacklist() {
    // En producción, cargaría desde una base de datos o API
    // Por ahora, lista estática de ejemplo
    this.blacklistedCerts = new Set([
      '1234567890ABCDEF',
      'FEDCBA0987654321'
    ]);
  }
}

module.exports = CertificateValidator;