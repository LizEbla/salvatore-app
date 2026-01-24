// backend/tests/firma.test.js
const request = require('supertest');
const fs = require('fs');
const path = require('path');

describe('API de Firma Digital', () => {
  const baseURL = 'http://localhost:3000/api/firma';
  
  // Archivos de prueba
  const testPDF = path.join(__dirname, '../test-files/documento.pdf');
  const testP12 = path.join(__dirname, '../test-files/certificado.p12');
  const password = 'password123';
  
  test('Debería firmar un PDF criptográficamente', async () => {
    const response = await request(baseURL)
      .post('/firmar-pdf')
      .field('password', password)
      .field('datosFirma', JSON.stringify({
        usuario: {
          nombres: 'Juan',
          apellidos: 'Pérez',
          id: 'USR001'
        },
        examen: {
          nombre: 'Hemograma Completo',
          id: 'EXM001'
        }
      }))
      .attach('pdf', testPDF)
      .attach('certificado', testP12);
    
    expect(response.status).toBe(200);
    expect(response.headers['content-type']).toBe('application/pdf');
    expect(response.headers['x-firma-algoritmo']).toBeDefined();
    
    // Guardar resultado para inspección
    fs.writeFileSync(
      path.join(__dirname, '../test-files/resultado-firmado.pdf'),
      response.body
    );
  });
  
  test('Debería verificar una firma', async () => {
    // Primero firmar un documento
    const firmaResponse = await request(baseURL)
      .post('/firmar-pdf')
      .field('password', password)
      .attach('pdf', testPDF)
      .attach('certificado', testP12);
    
    // Luego verificar
    const verifyResponse = await request(baseURL)
      .post('/verificar-firma')
      .attach('pdf', firmaResponse.body);
    
    expect(verifyResponse.status).toBe(200);
    expect(verifyResponse.body.success).toBe(true);
  });
});