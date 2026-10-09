# Probar la extensión "Jornada40 para Mi DT" (versión de prueba)

Esta versión trabaja con **staging** (staging.jornada40.cl) y se instala con un archivo ZIP, sin la tienda de Chrome. Se instala una sola vez.

## Antes de empezar

- Un computador con **Chrome** o **Edge**.
- Tu cuenta de staging, con al menos un trabajador con contrato.
- El último archivo `jornada40-midt-staging-<versión>.zip` que te envié.

## 1. Instalar

1. Descomprime el ZIP en una carpeta que no vayas a borrar, por ejemplo `Documentos\Jornada40 Mi DT`. Chrome usa esa carpeta mientras la extensión esté instalada.
2. Escribe `chrome://extensions` en la barra de direcciones (en Edge: `edge://extensions`).
3. Activa **Modo de desarrollador**: en Chrome está arriba a la derecha; en Edge, en el menú de la izquierda.
4. Presiona **Cargar descomprimida** (según la versión puede decir «Cargar sin empaquetar» o «Cargar desempaquetada») y elige la carpeta que tiene el archivo `manifest.json`.
5. Aparece **Jornada40 para Mi DT (pruebas)**. Presiona el ícono de la pieza de rompecabezas junto a la barra de direcciones y la chincheta de Jornada40, para dejar su ícono siempre a la vista.

Chrome puede mostrar un aviso sobre extensiones en modo de desarrollador. Es normal mientras la extensión no esté en la tienda.

## 2. Conectar con tu cuenta (una sola vez)

1. Entra a https://staging.jornada40.cl → **Dirección del Trabajo**. Más abajo está la tarjeta **Extensión para Mi DT**. Presiona **Conectar un navegador**: aparece un código de 8 letras y números, que vale 10 minutos.
2. Haz clic en el ícono de Jornada40 junto a la barra de direcciones. Se abre el panel a la derecha. Escribe el código y presiona **Conectar**.
3. Si recargas la página de Jornada40, tu navegador aparece en la lista de conectados. Desde ahí también se desconecta.

## 3. Ver lo que falta registrar

1. En la misma ventana, entra a **Mi DT** (midt.dirtrab.cl) con tu Clave Única, como siempre. La extensión nunca ve la Clave Única.
2. El panel muestra «Mi DT abierto» y la lista **Por registrar**, con los vencidos primero. Si tienes varias empresas, elige la misma con que entraste a Mi DT.
3. Toca un trabajador para ver su ficha: cada dato tiene un botón **Copiar**, en el orden del formulario de Mi DT.

Por ahora el panel dice «El llenado automático de este formulario estará listo pronto». Para que llene los formularios por ti, falta el levantamiento del paso 4.

## 4. Levantamiento (lo más importante de esta prueba)

El levantamiento le enseña a Jornada40 cómo son los formularios de Mi DT. Registra solo su estructura: nombres de los campos, tipos y opciones de las listas. **Nunca registra lo escrito**, y los RUT y correos que aparezcan en pantalla se tapan antes de enviarse.

1. En el panel, abajo, presiona **Modo levantamiento**.
2. Para cada pantalla de la lista (contrato, anexo, término, LRE, teletrabajo, finiquito y registro masivo):
   1. Presiona **Abrir**. Si no te lleva a ese formulario, llega a él con el menú de Mi DT, y avísame que «Abrir» no funcionó.
   2. Con la pantalla ya cargada, presiona **Registrar esta pantalla** y luego **Enviar a Jornada40**.
3. **El contrato tiene 4 etapas: registra cada una.** Para pasar de etapa, Mi DT pide completar la anterior. Usa los datos de un contrato real que tengas pendiente; puedes copiarlos desde la ficha del panel.
4. Al final del contrato, si todo está correcto, puedes registrarlo de verdad, ya que igual tenías que hacerlo. Si lo haces:
   1. Con el mensaje de confirmación a la vista, presiona otra vez **Registrar esta pantalla** y **Enviar a Jornada40**. Así Jornada40 aprende a reconocer el comprobante.
   2. Vuelve a la lista, abre ese trabajador y presiona **Ya lo registré en Mi DT**.
5. **No presiones «Registrar» ni «Enviar» en Mi DT solo por la prueba.** Si no quieres registrar ese contrato todavía, sal del formulario sin enviarlo.
6. Si «Enviar a Jornada40» falla, usa **Guardar archivo** y mándame los archivos que se descargan.

Cuando termines, avísame. Con eso escribo los mapeos y el panel empezará a llenar los formularios por ti, sin reinstalar la extensión.

## Problemas frecuentes

| Aviso | Qué hacer |
|---|---|
| «Recarga la página de Mi DT» | La pestaña de Mi DT estaba abierta antes de instalar la extensión: presiona F5 en esa pestaña. |
| «Abre Mi DT en esta ventana» | El panel mira la pestaña que tienes a la vista: deja Mi DT en la misma ventana que el panel. |
| «Entraste a Mi DT con otra empresa» | El RUT con que entraste a Mi DT no es el de la empresa elegida. Cambia de empresa en Mi DT. |
| «La extensión se desconectó» | Se desconectó desde Jornada40 o pasaron 90 días sin uso. Pide un código nuevo (paso 2). |

**Para instalar una versión nueva** que te envíe: reemplaza los archivos de la carpeta por los del ZIP nuevo y presiona ↻ (recargar) en la tarjeta de la extensión, en `chrome://extensions`.
