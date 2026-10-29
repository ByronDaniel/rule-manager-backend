# Reporte de rendimiento

## Alcance y metodología

- Ejecución iniciada el 29 de octubre de 2026 a las 00:46 UTC.
- API Node.js local en `127.0.0.1:3010`, conectada a MongoDB Atlas.
- Generador y API en el mismo equipo: Apple M4 Pro, 14 CPU lógicas, 24 GiB de RAM, macOS; Node.js v24.15.0 y k6 v2.3.0.
- Operación: `GET /api/v1/change-requests?page=0&size=20`, autenticada con un JWT temporal de CHECKER. Cada lectura consulta y cuenta solicitudes en MongoDB. No se crean datos de negocio.
- Un segundo de espera por usuario tras cada respuesta; las solicitudes son de ciclo cerrado y la tasa depende de la latencia. El conjunto de datos y el tráfico concurrente ajeno no se controlaron.
- Las métricas de carga sostenida agregan subida, meseta y bajada; no representan exclusivamente la meseta. Las métricas del pico y su recuperación están etiquetadas por fase.
- Carga sostenida: 0 a 100 VUs en 2 min, 100 VUs durante 5 min, descenso a 0 en 1 min.
- Pico: 50 VUs durante 30 s, salto inmediato a 500 VUs durante 1 min, bajada inmediata a 0, pausa de 10 s y una sonda de 1 VU durante 1 min. Los cortes abruptos pueden interrumpir peticiones en vuelo.
- Objetivos de referencia, no SLO acordados: menos de 1 % de solicitudes fallidas, más de 99 % de comprobaciones correctas y p95 inferior a 1 s. La recuperación también se evalúa por separado.
- El ejecutor toma muestras de CPU y memoria residente del proceso Node.js cada 5 s; el generador comparte CPU y memoria con la aplicación.

## Resultados

### Carga sostenida

- 26.714 solicitudes, 55,62 solicitudes/s en promedio y máximo de 100 VUs observados.
- Latencia: promedio 460,93 ms; mediana 334,72 ms; p95 985,90 ms; p99 1.251,70 ms; máximo 3.455,90 ms.
- 0 errores HTTP o de red y 100 % de comprobaciones correctas. Cumplió los objetivos de referencia, aunque el p95 quedó próximo a 1 s y el p99 lo superó.

### Pico y recuperación

| Fase | VUs | Solicitudes | Errores | Latencia p95 | Resultado |
| --- | ---: | ---: | ---: | ---: | --- |
| Referencia, 30 s | 50 | 1.263 | 0 % | 538,98 ms | Cumple |
| Pico, 60 s | 500 | 4.801 | 8,16 % | 6.470,62 ms | No cumple |
| Recuperación, 60 s | 1 | 52 | 0 % | 218,26 ms | Cumple |

En el pico se registraron 392 errores de red: 388 reinicios de conexión y 4 conexiones interrumpidas; no hubo respuestas 429 ni 5xx en esa fase. La tasa media de solicitudes finalizadas durante los 60 s de pico fue aproximadamente 80 solicitudes/s, incluidas las fallidas. El descenso abrupto interrumpe iteraciones y estas no necesariamente quedan reflejadas en los porcentajes de solicitudes completadas. La latencia p95 del pico incluye las solicitudes fallidas registradas por k6. El escenario completo de pico incumplió los umbrales y k6 devolvió el código 99.

El mismo proceso de API siguió activo y la sonda de 1 VU respondió sin errores después de la pausa. Esto muestra recuperación bajo una carga mínima, no demuestra recuperación de capacidad a 50 o 500 VUs ni identifica la causa de los errores.

### Recursos del proceso Node.js

| Fase | Muestras | CPU media | CPU máxima | RSS máxima |
| --- | ---: | ---: | ---: | ---: |
| Carga sostenida completa | 98 | 4,66 % | 16,0 % | 225,88 MiB |
| Referencia del pico | 6 | 2,68 % | 4,9 % | 198,86 MiB |
| Pico | 12 | 3,53 % | 7,8 % | 244,02 MiB |
| Recuperación | 12 | 0,34 % | 0,6 % | 230,59 MiB |

Son muestras de `ps` del proceso API, no de todo el equipo ni del generador. El 100 % corresponde aproximadamente a una CPU lógica; el muestreo cada 5 s puede omitir picos breves.

### Controles funcionales posteriores

- ETag: una lectura de valores respondió 200 con ETag y la siguiente, con `If-None-Match`, respondió 304. La respuesta condicional no demuestra que la consulta a MongoDB se evite ni mide el rendimiento de una caché.
- Límite de autenticación: 21 intentos inválidos secuenciales desde una IP obtuvieron 20 respuestas 401 y una 429. Se comprobó el límite local, no su comportamiento distribuido ni bajo 500 VUs.

### Evidencias

- [Resumen k6 de carga sostenida](results/2026-10-29T00-46-25.670Z/load-summary.json) y [salida completa](results/2026-10-29T00-46-25.670Z/load.txt).
- [Resumen k6 de pico y recuperación](results/2026-10-29T00-46-25.670Z/spike-summary.json) y [salida completa](results/2026-10-29T00-46-25.670Z/spike.txt).
- [Muestras y tiempos de recursos](results/2026-10-29T00-46-25.670Z/resources.json) y [controles funcionales](results/2026-10-29T00-46-25.670Z/controls.json).

## Limitaciones

- La operación sometida a carga no tiene un limitador de tasa; el limitador de autenticación se evaluó solo con la comprobación funcional descrita.
- No se dispone de métricas internas de MongoDB Atlas, por lo que no se pueden afirmar sus niveles de CPU, memoria, conexiones ni saturación.
- Para completar la evaluación de base de datos, consultar en Atlas las métricas disponibles de CPU, memoria, conexiones y operaciones durante la ventana UTC de esta ejecución.
- Se probó una sola instancia local sin autoescalado ni caché distribuida; no se puede concluir cómo respondería un despliegue elástico.
- Una sola operación de lectura no representa el comportamiento de escrituras, aprobaciones ni la distribución real de tráfico. No es una certificación de capacidad para producción.

## Siguientes pasos

- Repetir con un generador separado, datos y tráfico representativos, y métricas de Node.js, red y Atlas correlacionadas por tiempo.
- Investigar la gestión de conexiones ante incrementos abruptos y medir límites de conexiones y colas antes de atribuir una causa a los errores.
- Revisar con `explain` las consultas de listado y conteo, incluidos sus índices, con volúmenes representativos.
- Validar rate limiting distribuido, caché y autoescalado en una arquitectura desplegada que realmente cuente con esos componentes.