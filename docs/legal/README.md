# Borradores legales de Jornada40

Borradores para **revisión de un abogado**. Los preparó el equipo de desarrollo a partir del funcionamiento real del sistema (el documento técnico, `docs/tecnico/`) y del texto oficial de las normas citadas. No reemplazan la asesoría legal y no deben publicarse, firmarse ni enviarse sin esa revisión.

**Convenciones.**

- `[COMPLETAR: …]`: un dato que debe agregar el titular (razón social, RUT, domicilio, contactos).
- `[REVISAR: …]`: una decisión o interpretación que debe confirmar el abogado.
- Las referencias a artículos de la Ley 19.628 corresponden a su texto modificado por la Ley 21.719 (Biblioteca del Congreso Nacional, idNorma 1209272).

**Vigencia de la Ley 21.719.** Se publicó el 13-12-2024 y entra en vigencia el **01-12-2026**. Un proyecto del Ejecutivo (Boletín N° 18.623-07, con suma urgencia) propone postergarla al 01-12-2027; a fines de septiembre de 2026 seguía en primer trámite en el Senado. Mientras no se apruebe, rige la fecha de 2026.

## Documentos

| N° | Documento | Para qué | Norma principal |
|---|---|---|---|
| 1 | [Anexo de tratamiento de datos por encargo](01-anexo-tratamiento-por-encargo.md) | Contrato entre el cliente (responsable de los datos de sus trabajadores) y Jornada40 (encargado). Se agrega a los términos de servicio | Art. 15 bis |
| 2 | [Política de privacidad](02-politica-de-privacidad.md) | Información que Jornada40 debe tener publicada, como responsable y como encargado | Art. 14 ter |
| 3 | [Registro de proveedores y transferencias internacionales](03-registro-proveedores.md) | Subencargados, qué datos tratan, dónde y con qué garantías | Arts. 15 bis, 27 y 28 |
| 4 | [Procedimiento ante vulneraciones de seguridad](04-procedimiento-vulneraciones.md) | Qué hacer ante un incidente, a quién avisar y cómo registrarlo | Arts. 14 quinquies, 14 sexies y 15 bis |
| 5 | [Política de conservación y eliminación](05-politica-conservacion.md) | Cuánto tiempo se guarda cada dato y cómo se elimina | Arts. 3, 14 ter letra i) y 15 bis |
| 6 | [Procedimiento para los derechos de los titulares](06-procedimiento-derechos.md) | Cómo se atienden las solicitudes de acceso, rectificación, supresión, oposición, portabilidad y bloqueo | Arts. 4 a 11 |
| 7 | [Solicitud de pronunciamiento a la Dirección del Trabajo](07-solicitud-dt.md) | Etapa D: reconocimiento del sistema de documentación laboral electrónica | Dictamen N° 0789/015 y ORD. N° 136 de 2025 |

## Orden sugerido

1. Revisión legal de los documentos 1, 2 y 6, que el cliente y el público verán.
2. Completar el registro de proveedores (3) con los contratos de cada uno; de ahí sale la sección de transferencias de la política.
3. Aprobar los procedimientos internos (4 y 5) y asignar a sus responsables.
4. Publicar la política en el sitio y agregar el anexo a los términos de servicio, con aceptación de los clientes actuales.
5. Presentar la solicitud a la DT (7) con todos sus anexos adjuntos, sin exigir una cuenta para verlos.

Cada documento indica lo que el sistema ya hace y lo que falta implementar. Lo que falta está también en `docs/PENDIENTES.md`.

Lo que «ya hace» corresponde a la versión del ambiente de pruebas del 14-10-2026. Algunas medidas que se citan, como que no se puedan borrar los trabajadores ni los documentos que respaldan firmas o la limpieza diaria de los tokens de sesión, llegan a producción cuando se publique esa versión en `main`: debe estar publicada antes de que estos documentos rijan.

## Versiones en Word

`python3 docs/legal/construir.py` genera un Word por documento en `docs/legal/salida/` (no se versiona), con el estilo del documento técnico.
