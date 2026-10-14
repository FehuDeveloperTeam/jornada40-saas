# Política de conservación y eliminación de datos

**Borrador para revisión legal.** Fija cuánto tiempo guarda Jornada40 cada categoría de datos y cómo se eliminan o anonimizan, conforme a los principios de finalidad y proporcionalidad (artículo 3°), al deber de informar el período de conservación (artículo 14 ter, letra i) y a la devolución o supresión al término del encargo (artículo 15 bis) de la Ley N° 19.628, modificada por la Ley N° 21.719.

**Principio.** Los datos se guardan mientras sirven a la finalidad para la que se recogieron o mientras una ley obligue a conservarlos. Después se eliminan o se anonimizan.

**Dos calidades.** Lo que Jornada40 guarda por cuenta del Cliente (datos de sus trabajadores) se rige por las instrucciones del Cliente y el Anexo de tratamiento por encargo: las obligaciones de conservar documentos laborales, previsionales y tributarios son del empleador. Lo que Jornada40 guarda como responsable (cuentas, registros técnicos) se rige por esta política.

## 1. Plazos por categoría

| Categoría | Plazo propuesto | Fundamento | Estado en el sistema |
|---|---|---|---|
| Datos de los trabajadores y sus documentos (por cuenta del Cliente) | Mientras dure la suscripción; al término, según la cláusula 11 del Anexo de tratamiento por encargo | Instrucciones del Cliente; sus plazos legales de conservación [REVISAR: prescripción laboral, previsional y tributaria] | Se conservan sin límite; no hay exportación completa ni eliminación al término (pendiente) |
| Expedientes de la Ley N° 21.643 | Lo que instruya el Cliente | [REVISAR: plazos del DS N° 21 de 2024 y de la reserva del procedimiento] | Se conservan cifrados sin límite |
| Evidencia de las firmas (solicitud, PDF firmado, huellas, IP) | Mientras exista el documento firmado | Valor probatorio del documento | Protegida: no se puede borrar mientras exista la solicitud |
| Cuenta del Cliente y sus usuarios | Mientras dure la suscripción y [COMPLETAR: 12] meses después | Retomar el servicio; responder reclamos | Al terminar la suscripción, la cuenta pasa al plan gratuito y no se borra |
| Registros de pagos y avisos de la pasarela | [COMPLETAR: plazo tributario] | Obligaciones tributarias [REVISAR] | Se conservan sin límite |
| Bitácora de acciones del panel | Al menos 5 años | Auditoría y prueba de quién hizo cada acción | No se puede modificar ni borrar |
| Registro reservado de la Ley N° 21.643 | Al menos 5 años | Igual que la bitácora | No se puede modificar ni borrar |
| Registros de accesos de fiscalización | [COMPLETAR: 5 años] | Prueba del acceso de la fiscalización | Se conservan sin límite |
| Códigos de un solo uso vencidos (firma, portal, fiscalización, extensión) | 30 días después de vencer | Sin finalidad una vez vencidos | **Falta:** se acumulan sin limpieza |
| Tokens de sesión vencidos | Se eliminan cada día | Sin finalidad una vez vencidos | Implementado: la tarea diaria borra los vencidos |
| PDF por firmar de solicitudes rechazadas, vencidas o canceladas | 90 días después del cierre de la solicitud | Sin finalidad una vez cerrada | **Falta:** quedan en el almacenamiento |
| Levantamientos de la extensión para Mi DT | 12 meses | Ajustar los mapeos de los formularios | **Falta:** se acumulan |
| Registros de ejecución del servidor | Según el proveedor [COMPLETAR: Railway] | Diagnóstico de errores | Gestionados por el proveedor |
| Respaldos de la base de datos | 30 diarios y 12 mensuales | Recuperación ante desastres | **Falta:** no hay respaldos automáticos |

## 2. Cómo se elimina

- **Eliminación:** borrado de la base de datos y del almacenamiento de archivos, incluida la copia en los respaldos al vencer cada uno.
- **Anonimización:** cuando el dato sirve para estadísticas o para mantener la integridad de un registro (por ejemplo, la bitácora), se reemplazan los datos que identifican a la persona. [REVISAR: la bitácora guarda el nombre y RUT de quien actuó; definir si se anonimiza al cumplir el plazo.]
- **Datos cifrados de la Ley N° 21.643:** al eliminar la clave de cifrado de una versión, los datos cifrados con ella quedan ilegibles. [REVISAR: si se usa como método de eliminación.]

## 3. Al término del contrato con un Cliente

1. El Cliente puede descargar sus datos y documentos durante [COMPLETAR: 90] días.
2. Vencido el plazo, Jornada40 elimina o anonimiza los datos tratados por cuenta del Cliente dentro de [COMPLETAR: 30] días, salvo instrucción distinta del Cliente o una obligación legal.
3. Jornada40 deja constancia de la eliminación y la informa al Cliente si este lo pide.

[REVISAR: hoy, al terminar la suscripción, la cuenta pasa al plan gratuito con sus datos. Decidir si se mantiene, con aceptación del Cliente, o si se aplica este procedimiento.]

## 4. Lo que falta implementar

1. Exportación completa de la cuenta del Cliente.
2. Limpieza automática de códigos vencidos, PDF de solicitudes cerradas y levantamientos antiguos.
3. Eliminación o anonimización al término del contrato.
4. Respaldos automáticos con su rotación.

Están en `docs/PENDIENTES.md`.

## 5. Revisión

Esta política se revisa una vez al año o cuando cambien las leyes que fijan plazos de conservación. Responsable: [COMPLETAR].
