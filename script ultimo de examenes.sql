SELECT id, nombre, area, precio, "tipoMuestra", "tiempoEntrega", "tipoTubo", observaciones, "createdAt", "updatedAt", "tipoPrecio", subexamenes
	FROM public."Tipoexamenes";



SELECT * FROM "Tipoexamenes";


SELECT 
  a.nombre AS area,
  e.nombre AS examen,
  s.nombre AS subexamenes,
  s.precio,
  s.tipoMuestra,
  s.tipoTubo,
  s.tiempoEntrega,
  s.observaciones
FROM "subexamenes" s
JOIN "examenes" e ON s.examen_id = e.id
JOIN "Areas" a ON e.area_id = a.id
ORDER BY a.nombre, e.nombre, s.nombre;


SELECT 
  s."nombre",
  s."tipoMuestra",
  s."precio",
  s."tipoTubo",
  s."tiempoEntrega",
  s."observaciones"
FROM "subexamenes" s;


SELECT a.nombre AS area, e.nombre AS examen, s.nombre AS subexamen, s.precio, s."tipoMuestra", s."tipoTubo", s."tiempoEntrega", s."observaciones"
FROM "Areas" a
JOIN "examenes" e ON e.area_id = a.id
LEFT JOIN "subexamenes" s ON s.examen_id = e.id;




SELECT 
  a.nombre AS area,
  e.nombre AS examen,
  s.nombre AS subexamen,
  COALESCE(s.precio, e.precio) AS precio,
  COALESCE(s."tipoMuestra", e."tipoMuestra") AS "tipoMuestra",
  COALESCE(s."tipoTubo", e."tipoTubo") AS "tipoTubo",
  COALESCE(s."tiempoEntrega", e."tiempoEntrega") AS "tiempoEntrega",
  COALESCE(s."observaciones", e."observaciones") AS "observaciones"
FROM "Areas" a
JOIN "examenes" e ON e.area_id = a.id
LEFT JOIN "subexamenes" s ON s.examen_id = e.id
ORDER BY area, examen;



CREATE TABLE historial_importaciones (
  id SERIAL PRIMARY KEY,
  nombre_archivo TEXT,
  fecha_importacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  usuario TEXT
);

SELECT * FROM Tipoexamenes;

SELECT * FROM "Tipoexamenes";

SELECT DISTINCT area FROM "Tipoexamenes" ORDER BY area;

select * from "Pacientes";

