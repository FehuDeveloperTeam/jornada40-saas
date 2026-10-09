# Publicación de "Jornada40 para Mi DT" en las tiendas

Todo lo que piden Chrome Web Store y Microsoft Edge Add-ons, listo para copiar. El paquete es el mismo para las dos tiendas: `npm run extension:produccion` (en `frontend/`) deja `extension/dist/jornada40-midt-produccion-<versión>.zip`.

Estado: **esperando la cuenta de desarrollador de Chrome** (US$5, pago único). Edge Add-ons es gratis y se puede abrir antes.

## 1. Cuentas

| Tienda | Dónde | Costo | A nombre de |
|---|---|---|---|
| Chrome Web Store | https://chrome.google.com/webstore/devconsole | US$5, una vez | Fehu Developers (correo del equipo) |
| Edge Add-ons | https://partner.microsoft.com/dashboard/microsoftedge | Gratis | Fehu Developers (cuenta Microsoft del equipo) |

En Chrome hay que verificar el correo de contacto y declarar si la cuenta es de un "comerciante" (trader) para la UE: Fehu Developers vende servicios, así que corresponde marcar que sí y publicar el correo y la dirección comercial.

## 2. Ficha (ambas tiendas)

- **Nombre:** Jornada40 para Mi DT
- **Resumen (máx. 132 caracteres):**
  > Llena los formularios del Registro Electrónico Laboral de Mi DT con los datos de Jornada40. Tú revisas y registras.
- **Categoría:** Chrome: *Herramientas* (o *Flujo de trabajo y planificación*). Edge: *Productividad*.
- **Idioma:** español (Latinoamérica).
- **Sitio web:** https://jornada40.cl
- **Correo de soporte:** contacto.jornada40@gmail.com
- **Política de privacidad:** https://jornada40.cl/privacidad/extension
- **Descripción:**

> Jornada40 para Mi DT es el asistente de los empleadores que usan Jornada40 para registrar en Mi DT (Dirección del Trabajo) sus contratos, anexos y términos de contrato, sin copiar dato por dato.
>
> Cómo funciona:
> 1. Conecta la extensión con tu cuenta de Jornada40 usando un código de un solo uso (Jornada40 → Dirección del Trabajo → Conectar un navegador).
> 2. Entra a Mi DT con tu Clave Única, como siempre. La extensión nunca ve ni guarda tu Clave Única.
> 3. En el panel lateral verás lo que te falta registrar, con los plazos y lo vencido primero.
> 4. Elige un trabajador y presiona "Llenar esta etapa": la extensión escribe los datos en el formulario de Mi DT y marca en verde lo que llenó y en amarillo lo que debes completar tú.
> 5. Revisa y presiona tú los botones de Mi DT. Al terminar, la extensión reconoce el comprobante y lo deja marcado como registrado en Jornada40.
>
> Si un formulario de Mi DT cambia, la extensión no llena nada y te muestra cada dato con un botón para copiarlo.
>
> Requiere una cuenta de Jornada40 (https://jornada40.cl). Funciona en computadores con Chrome o Edge.

## 3. Propósito único (Chrome lo pide aparte)

> Ayudar al empleador a completar los formularios del Registro Electrónico Laboral de Mi DT (midt.dirtrab.cl) con los datos de su cuenta de Jornada40, mostrando en un panel lateral lo que falta registrar y escribiendo los datos en el formulario para que la persona los revise y los envíe ella misma.

## 4. Justificación de permisos

| Permiso | Justificación (para pegar) |
|---|---|
| `storage` | Guarda en el navegador la conexión con la cuenta de Jornada40 (una clave propia del navegador) y la empresa elegida, para no pedir el código cada vez. |
| `sidePanel` | La extensión funciona como un panel lateral junto a Mi DT, donde la persona ve lo que falta registrar y los datos de cada formulario. |
| Acceso a `https://midt.dirtrab.cl/*` | Es el único sitio donde trabaja: reconoce en qué formulario y etapa está la persona y escribe en él los datos de Jornada40. No lee otros sitios. |
| Acceso a `https://api.jornada40.cl/*` | Es la API del servicio de la persona: de ahí salen lo que falta registrar y los datos de cada ficha, y ahí se marca lo registrado. |

- **¿Usa código remoto?** No. Todo el código va en el paquete. Desde la API solo llegan datos (JSON): la lista, las fichas y los "mapeos" (qué dato va en qué campo), que la extensión no ejecuta.

## 5. Prácticas de privacidad (formulario de Chrome)

Datos que maneja (marcar):
- **Información de identificación personal:** sí (datos de los trabajadores que el empleador registra: RUT, nombre, domicilio, contrato).
- **Información de autenticación:** sí (la clave de conexión del navegador; nunca la Clave Única).
- **Contenido de sitios web:** sí (títulos de la pantalla de Mi DT, el RUT del empleador, el nombre que trae Mi DT y el mensaje de registro exitoso).
- Todo lo demás (salud, finanzas, comunicaciones, ubicación, historial web, actividad del usuario): no.

Certificaciones (marcar las tres):
- No vendo ni transfiero datos de usuarios a terceros, salvo los casos permitidos.
- No uso ni transfiero datos de usuarios para fines no relacionados con el propósito único del elemento.
- No uso ni transfiero datos de usuarios para determinar la solvencia crediticia ni para préstamos.

## 6. Imágenes

| Pieza | Tamaño | Estado |
|---|---|---|
| Ícono | 128 × 128 PNG | Listo: `extension/iconos/icono-128.png` |
| Capturas (1 a 5) | 1280 × 800 o 640 × 400 | **Pendiente:** se toman en el piloto, con Mi DT real y datos de prueba o tapados. Propuesta: (1) lista "Por registrar" junto a Mi DT, (2) etapa llenada en verde y amarillo, (3) comprobante reconocido, (4) conexión con código. |
| Mosaico promocional pequeño (Chrome) | 440 × 280 | Opcional. |

Las capturas no deben mostrar RUT, nombres ni correos reales.

## 7. Notas para la revisión

Para pegar en "Instrucciones de prueba" (Chrome) o "Notas para la certificación" (Edge):

> La extensión solo funciona con una cuenta de Jornada40 y una sesión en Mi DT (midt.dirtrab.cl), que requiere la Clave Única chilena de un empleador. Para revisar la conexión y el panel sin Mi DT: entre a https://jornada40.cl con la cuenta de prueba [usuario/clave de una cuenta demo], vaya a Dirección del Trabajo → "Conectar un navegador" y escriba el código en el panel de la extensión. Verá la lista de registros pendientes y la ficha de cada uno con botones para copiar. El llenado de formularios ocurre solo en midt.dirtrab.cl. La extensión nunca presiona los botones de envío de Mi DT ni accede a la Clave Única.

Antes de enviar: crear en producción una cuenta demo (plan Pyme, una empresa ficticia, dos trabajadores con contrato) y poner su usuario y clave en la nota.

## 8. Visibilidad y pasos

1. Subir el ZIP de producción.
2. Visibilidad **"No listado"** (solo quien tiene el enlace) para el piloto.
3. Al aprobarse, poner el enlace de la tienda en la tarjeta de `/app/dt` y mostrar la tarjeta en producción (`VITE_EXTENSION_MIDT=1` en Vercel, o quitar la condición).
4. Terminado el piloto, cambiar a **"Público"** y agregarla al landing, al briefing comercial y al manual.

Cada versión nueva: subir `version` en `extension/manifest.base.json`, compilar y subir el ZIP. Las tiendas revisan cada versión (de horas a pocos días). Un cambio de Mi DT normalmente **no** necesita versión nueva: se corrige el mapeo en el backend (`backend/core/datos/mapeos_midt.json`).
