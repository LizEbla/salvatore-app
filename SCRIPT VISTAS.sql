SELECT id, nombre, "createdAt", "updatedAt"
	FROM public."Areas";


SELECT
  a.nombre AS area,
  e.nombre AS examen,
  s.nombre AS subexamen,
  s.precio,
  s."tipoMuestra",
  s."tipoTubo",
  s."tiempoEntrega",
  s.observaciones
FROM "Subexamens" s
JOIN "Examens" e ON s.examen_id = e.id
JOIN "Areas" a ON e.area_id = a.id;


-- Exámenes planos desde "TipoExamens"
SELECT
  t.nombre AS examen,
  NULL AS subexamen,
  t.area,
  t.precio,
  t."tipoMuestra",
  t."tipoTubo",
  t."tiempoEntrega",
  t.observaciones
FROM "TipoExamens" t

UNION

-- Exámenes jerárquicos desde "Examens" y "Subexamens"
SELECT
  e.nombre AS examen,
  s.nombre AS subexamen,
  a.nombre AS area,
  s.precio,
  s."tipoMuestra",
  s."tipoTubo",
  s."tiempoEntrega",
  s.observaciones
FROM "Examens" e
JOIN "Areas" a ON a.id = e.area_id
LEFT JOIN "Subexamens" s ON s.examen_id = e.id
WHERE s.nombre IS NOT NULL
ORDER BY area, examen;



CREATE OR REPLACE VIEW vista_examenes_completa AS
-- Exámenes planos (sin subexamen)
SELECT
  t.nombre AS examen,
  NULL AS subexamen,
  t.area,
  t.precio,
  t."tipoMuestra",
  t."tipoTubo",
  t."tiempoEntrega",
  t.observaciones
FROM "TipoExamens" t

UNION

-- Exámenes jerárquicos (con subexamen)
SELECT
  e.nombre AS examen,
  s.nombre AS subexamen,
  a.nombre AS area,
  s.precio,
  s."tipoMuestra",
  s."tipoTubo",
  s."tiempoEntrega",
  s.observaciones
FROM "Examens" e
JOIN "Areas" a ON a.id = e.area_id
JOIN "Subexamens" s ON s.examen_id = e.id;



SELECT * FROM vista_examenes_completa ORDER BY area, examen;


SELECT COUNT(*) FROM "Subexamens";

SELECT COUNT(*) FROM "Examens";

SELECT COUNT(*) FROM "Areas";


