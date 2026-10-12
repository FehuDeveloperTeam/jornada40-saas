# Anexo D. Pantallas {.unnumbered #sec-anexo-d}

Las pantallas de la aplicación web, según las rutas de `frontend/src/App.tsx`, y las vistas del panel lateral de la extensión. Las páginas están en `frontend/src/pages/` y se cargan con `diferida()` (sección 5.2). La sección 7.1 muestra capturas de las principales.

**Cómo leer la columna «Quién entra».**

- **Público:** sin sesión.
- **Panel:** sesión del titular o de un usuario del equipo (`ProtectedRoute`). Si la pantalla exige un módulo, se nombra (`ConPermiso`): basta el permiso «solo ver», salvo que diga «gestionar». «Solo el titular» la cierra al equipo.
- **Plan:** plan mínimo, cuando la pantalla lo exige. Con un plan menor, la pantalla explica qué incluye y enlaza a los planes. El servidor aplica los mismos límites (sección 2.4).
- **Portal, Ley Karin y fiscalización:** sesión propia de cada acceso (sección 4.7).

#### Sitio público {.unnumbered}

| Ruta | Página | Quién entra | Contenido |
|---|---|---|---|
| `/` | `sitio/Landing.tsx` | Público; con sesión, lleva a `/app` | Presentación, funciones, portal del trabajador, cumplimiento, seguridad, planes y preguntas frecuentes |
| `/terminos` | `sitio/Terminos.tsx` | Público | Términos y condiciones del servicio |
| `/privacidad/extension` | `sitio/PrivacidadExtension.tsx` | Público | Política de privacidad de la extensión para Mi DT, que exigen las tiendas |
| `/verificar`, `/verificar/:codigo` | `sitio/Verificar.tsx` | Público | Verificación de un certificado o de una copia de la bitácora por su código |

#### Ingresos y claves {.unnumbered}

| Ruta | Página | Quién entra | Contenido |
|---|---|---|---|
| `/login` | `sitio/Login.tsx` | Público | Ingreso del titular con RUT y clave; enlaces al ingreso del equipo y al de Ley Karin; aviso de cierre por inactividad |
| `/register` | `sitio/Registro.tsx` | Público | Registro en dos pasos: datos del titular y plan, con ciclo mensual o anual |
| `/forgot-password` | `sitio/Recuperar.tsx` | Público | Recuperación de la clave por RUT: el enlace llega al correo registrado |
| `/reset-password/:uid/:token` | `sitio/NuevaContrasena.tsx` | Quien tiene el enlace | Nueva clave del titular |
| `/equipo` | `sitio/IngresoEquipo.tsx` | Público | Ingreso de un usuario del equipo con RUT y clave; elección de cuenta si su clave sirve en varias; recuperación |
| `/equipo/clave/:uid/:token` | `sitio/ClaveEquipo.tsx` | Quien tiene el enlace | Clave de un usuario del equipo, desde la invitación o la recuperación |
| `/karin` | `sitio/IngresoKarin.tsx` | Público | Ingreso del encargado de denuncias de la Ley Karin |
| `/karin/clave/:uid/:token` | `sitio/ClaveEquipo.tsx` (acceso `karin`) | Quien tiene el enlace | Clave del encargado de denuncias |
| `/trabajador` | `sitio/Trabajador.tsx` | Público | Ingreso al portal del trabajador: RUT y luego clave o código al correo |
| `/bienvenida` | `sitio/Bienvenida.tsx` | Panel | Puesta en marcha en tres pasos: datos de la empresa, representante legal y trabajadores |

#### Panel del empleador {.unnumbered}

Todas van dentro de `components/app/AppShell.tsx` (menú lateral, selector de empresa, paleta ⌘K y avisos).

| Ruta | Página | Quién entra | Contenido |
|---|---|---|---|
| `/app` | `app/Inicio.tsx` | Panel | Indicadores del día, cifras de la empresa, tareas que requieren atención y avance de la transición a 40 horas |
| `/app/trabajadores` | `app/Trabajadores.tsx` | Panel: Trabajadores | Lista de trabajadores con búsqueda y filtros; «Agregar trabajador» |
| `/app/trabajadores/importar` | `app/Importar.tsx` | Panel: Trabajadores, gestionar. Plan Pyme | Carga masiva desde una planilla: descarga, revisión previa y resultado |
| `/app/trabajadores/:id` | `app/Carpeta.tsx` | Panel: Trabajadores | Carpeta del trabajador con pestañas: resumen, datos personales, contrato y jornada, remuneraciones, vacaciones y documentos (cada una con su módulo). Admite `?tab=` y `?accion=anexo\|documento\|vacacion` |
| `/app/trabajadores/:id/contrato` | `app/ContratoEditor.tsx` | Panel: Contratos | Editor del contrato con evaluación de la jornada, digitalización y borrador local |
| `/app/trabajadores/:id/finiquito` | `app/Finiquito.tsx` | Panel: Término. Plan Starter | Cálculo del finiquito, modalidad, ficha para Mi DT y registro de la ratificación |
| `/app/remuneraciones` | `app/Remuneraciones.tsx` | Panel: Remuneraciones | Emisión del período, firma de las liquidaciones, Previred, Libro de Remuneraciones Electrónico y Certificado N°6 (algunos archivos desde el plan Pyme) |
| `/app/remuneraciones/conceptos` | `app/Conceptos.tsx` | Panel: Remuneraciones | Catálogo de conceptos de la empresa y del sistema, con su código del Libro de Remuneraciones |
| `/app/firmas` | `app/Firmas.tsx` | Panel: algún módulo de documentos | Solicitudes de firma con su estado; reenvío, cancelación y descarga |
| `/app/solicitudes` | `app/Solicitudes.tsx` | Panel: Solicitudes o Vacaciones | Peticiones y solicitudes de documentos que llegan del portal del trabajador |
| `/app/reportes` | `app/Reportes.tsx` | Panel: Reportes. Plan Pyme | Masa salarial, costo empleador y líquido de todas las empresas, por mes o por año, en Excel o PDF |
| `/app/dt` | `app/DireccionTrabajo.tsx` | Panel: Dirección del Trabajo | Registros pendientes en Mi DT con su plazo y su ficha, consentimiento electrónico, accesos de fiscalización y la extensión (**[Solo en staging]**) |
| `/app/reglamento` | `app/Reglamento.tsx` | Panel: Seguridad. Plan Pyme | Reglamento interno en tres pasos, información de riesgos, canales de la Ley Karin y encargado de denuncias (este último, solo el titular) |
| `/app/empresa` | `app/Empresa.tsx` | Solo el titular | Datos de la empresa, seguridad social, firma del empleador y plan |
| `/app/empresas` | `app/Empresas.tsx` | Solo el titular | Empresas activas y desactivadas; crear o reactivar |
| `/app/plan` | `app/Plan.tsx` | Solo el titular | Plan, uso de cupos, cambio de plan o de ciclo, historial de pagos |
| `/app/cuenta` | `app/Cuenta.tsx` | Panel | Datos del titular o, para el equipo, sus accesos; resumen por correo; cambio de clave; salida |
| `/app/equipo` | `app/Equipo.tsx` | Solo el titular | Usuarios del equipo y sus permisos; pestaña `?tab=bitacora` con filtros, verificación y descarga |

#### Portal del trabajador {.unnumbered}

Todas van dentro de `components/trabajador/PortalShell.tsx`, con la sesión del portal (sección 4.7). Se abren desde el plan Pyme de la empresa.

| Ruta | Página | Contenido |
|---|---|---|
| `/trabajador/portal` | `trabajador/Inicio.tsx` | Documentos por firmar, accesos para pedir vacaciones, permisos o conciliación, y para denunciar |
| `/trabajador/portal/liquidaciones` | `trabajador/Liquidaciones.tsx` | Liquidaciones firmadas |
| `/trabajador/portal/documentos` | `trabajador/Documentos.tsx` | Contrato, documentos firmados y reglamento interno |
| `/trabajador/portal/certificados` | `trabajador/Certificados.tsx` | Certificados que la persona emite al instante y el Certificado N°6 |
| `/trabajador/portal/vacaciones` | `trabajador/Vacaciones.tsx` | Saldo, vacaciones aprobadas, horas de descanso y peticiones de vacaciones y permisos |
| `/trabajador/portal/solicitudes` | `trabajador/Solicitudes.tsx` | Petición de documentos de una lista cerrada |
| `/trabajador/portal/conciliacion` | `trabajador/Conciliacion.tsx` | Peticiones de teletrabajo o de cambio de jornada por cuidado (Ley 21.645) |
| `/trabajador/portal/seguridad` | `trabajador/Seguridad.tsx` | Crear o cambiar la clave del portal |
| `/trabajador/portal/ley-karin` | `trabajador/LeyKarin.tsx` | Denuncias en que participa, según su rol, y formulario para denunciar |

#### Firma, fiscalización y Ley Karin {.unnumbered}

| Ruta | Página | Quién entra | Contenido |
|---|---|---|---|
| `/firma/:token` | `sitio/Firma.tsx` | Quien tiene el enlace y verifica su identidad | Firma de un documento en pasos: RUT, código o clave del portal, revisión, aceptación y firma dibujada |
| `/inspeccion` | `sitio/Inspeccion.tsx` | Inspector de la DT con su correo institucional | Ingreso con código; trabajadores y documentos de la empresa, descarga y ratificación en terreno |
| `/karin/panel` | `karin/Panel.tsx` | Encargado de denuncias | Denuncias con su próximo plazo, empresas a cargo, registro reservado y clave |
| `/karin/denuncias/nueva` | `karin/NuevaDenuncia.tsx` | Encargado de denuncias | Registro de una denuncia recibida |
| `/karin/denuncias/:id` | `karin/Expediente.tsx` | Encargado de denuncias | Expediente: plazos, datos, resguardo, decisión, investigación, informe, medidas, cierre, documentos y archivos |

#### Direcciones antiguas {.unnumbered}

`/dashboard`, `/empresas`, `/suscripcion` y `/reportes` llevan a su equivalente en `/app/…`, para que sigan sirviendo los enlaces guardados y los de correos antiguos. Cualquier otra ruta lleva al inicio.

#### Extensión para Mi DT {.unnumbered}

**[Solo en staging]** El panel lateral (`frontend/extension/src/panel/`) tiene estas vistas:

| Vista | Archivo | Contenido |
|---|---|---|
| Conectar | `Conectar.tsx` | Ingreso del código de 8 caracteres que se crea en `/app/dt` |
| Lista | `Lista.tsx` | Lo que falta registrar en Mi DT para la empresa que se reconoce en pantalla; lo vencido primero |
| Ficha | `Ficha.tsx` | Datos de un registro por etapa, con «Copiar» y, si el formulario está mapeado, «Llenar esta etapa»; al final, marcarlo como registrado |
| Levantamiento | `Levantamiento.tsx` | Captura la estructura de los formularios de Mi DT, sin los valores escritos, para preparar los mapeos |
