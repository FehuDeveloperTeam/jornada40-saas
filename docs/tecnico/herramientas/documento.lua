--[[ Filtro de pandoc del documento técnico (salida Word).

  - Reemplaza {{clave}} en el texto por el valor de documento.json (versión, fecha…).
  - Convierte <br> en un salto de línea (sirve dentro de las celdas de las tablas).
  - Numera figuras y tablas ("Figura 3.", "Tabla 5.") con campos SEQ de Word, que
    alimentan los índices de figuras y de tablas.
  - Da a las celdas de las tablas los estilos "Celda" y "Celda encabezado" y calcula
    el ancho de cada columna según su contenido (como el diseño automático de una
    tabla HTML), en vez de usar los guiones del Markdown.
  - Convierte los bloques ::: salto-pagina, ::: indice, ::: indice-figuras y
    ::: indice-tablas en el salto o el índice correspondiente (campos TOC).
]]

local meta = {}
local figuras, tablas = 0, 0

local function etiqueta(tipo, numero)
  return pandoc.RawInline('openxml', string.format(
    '<w:r><w:rPr><w:b/><w:bCs/></w:rPr><w:t xml:space="preserve">%s </w:t></w:r>' ..
    '<w:fldSimple w:instr=" SEQ %s \\* ARABIC "><w:r><w:rPr><w:b/><w:bCs/></w:rPr><w:t>%d</w:t></w:r></w:fldSimple>' ..
    '<w:r><w:rPr><w:b/><w:bCs/></w:rPr><w:t xml:space="preserve">. </w:t></w:r>', tipo, tipo, numero))
end

local function numerar(leyenda, tipo, numero)
  local primero = leyenda.long[1]
  if primero and primero.content then
    table.insert(primero.content, 1, etiqueta(tipo, numero))
  end
end

local function indice(instruccion)
  return pandoc.RawBlock('openxml',
    '<w:p><w:r><w:fldChar w:fldCharType="begin" w:dirty="true"/></w:r>' ..
    '<w:r><w:instrText xml:space="preserve"> ' .. instruccion .. ' </w:instrText></w:r>' ..
    '<w:r><w:fldChar w:fldCharType="separate"/></w:r>' ..
    '<w:r><w:t>Para ver este índice, haz clic derecho sobre él y elige «Actualizar campo».</w:t></w:r>' ..
    '<w:r><w:fldChar w:fldCharType="end"/></w:r></w:p>')
end

local function con_estilo(filas, estilo)
  for _, fila in ipairs(filas) do
    for _, celda in ipairs(fila.cells) do
      celda.contents = { pandoc.Div(celda.contents, pandoc.Attr('', {}, { ['custom-style'] = estilo })) }
    end
  end
end

-- Caracteres de 9 pt que caben, aproximadamente, en el ancho útil de la página.
local ANCHO_TOTAL = 95
local PALABRA_MAXIMA = 24   -- una palabra más larga (una ruta, p. ej.) se corta
local MARGEN_CELDA = 5      -- márgenes de la celda y holgura para la negrita
local ANCHO_VACIO = 18      -- columna sin contenido (formularios por llenar)

-- Ancho aproximado en caracteres promedio: las mayúsculas (incluidas las con tilde)
-- ocupan más que las minúsculas, y eso importa en columnas de códigos como RNF-SEG-01.
local function largo(texto)
  local ok, total = pcall(function()
    local t = 0
    for _, cp in utf8.codes(texto) do
      if (cp >= 65 and cp <= 90) or (cp >= 192 and cp <= 222) then t = t + 1.3 else t = t + 1 end
    end
    return t
  end)
  return ok and total or #texto
end

local function medidas(bloques)
  local texto = pandoc.utils.stringify(bloques)
  local palabra = 0
  for p in texto:gmatch('%S+') do palabra = math.max(palabra, largo(p)) end
  return largo(texto), palabra
end

-- Mínimo: la palabra más larga de la columna. Preferido: su celda más larga en una
-- línea. Si todo cabe, se reparte según lo preferido; si no, cada columna recibe su
-- mínimo y el resto del ancho se reparte según lo que le falta para el preferido.
local function anchos_automaticos(tabla)
  local n = #tabla.colspecs
  local minimo, preferido, con_texto = {}, {}, {}
  for j = 1, n do minimo[j], preferido[j], con_texto[j] = 3, 3, false end
  local function medir(filas, es_cuerpo)
    for _, fila in ipairs(filas) do
      local j = 1
      for _, celda in ipairs(fila.cells) do
        local tramo = celda.col_span or 1
        if tramo == 1 and j <= n then
          local total, palabra = medidas(celda.contents)
          minimo[j] = math.max(minimo[j], math.min(palabra, PALABRA_MAXIMA) + MARGEN_CELDA)
          preferido[j] = math.max(preferido[j], total + MARGEN_CELDA)
          if es_cuerpo and total > 0 then con_texto[j] = true end
        end
        j = j + tramo
      end
    end
  end
  medir(tabla.head.rows, false)
  for _, cuerpo in ipairs(tabla.bodies) do
    medir(cuerpo.head, false)
    medir(cuerpo.body, true)
  end
  medir(tabla.foot.rows, true)
  local suma_min, suma_pref = 0, 0
  for j = 1, n do
    if not con_texto[j] then preferido[j] = math.max(preferido[j], ANCHO_VACIO) end
    preferido[j] = math.max(preferido[j], minimo[j])
    suma_min, suma_pref = suma_min + minimo[j], suma_pref + preferido[j]
  end
  for j = 1, n do
    local ancho
    if suma_pref <= ANCHO_TOTAL then
      ancho = preferido[j] / suma_pref
    elseif suma_min >= ANCHO_TOTAL then
      ancho = minimo[j] / suma_min
    else
      local extra = (ANCHO_TOTAL - suma_min) * (preferido[j] - minimo[j]) / (suma_pref - suma_min)
      ancho = (minimo[j] + extra) / ANCHO_TOTAL
    end
    tabla.colspecs[j] = { tabla.colspecs[j][1], ancho }
  end
end

local function reemplazar(texto)
  return texto:gsub('{{([%w_-]+)}}', function(clave)
    return meta[clave] or ('{{' .. clave .. '}}')
  end)
end

-- Después de cada tabla, un párrafo pequeño separa la tabla del texto que sigue
-- (Word no deja espacio tras una tabla), salvo que siga su nota de fuente.
local ESPACIO_TABLA = '<w:p><w:pPr><w:pStyle w:val="EspacioTabla"/></w:pPr></w:p>'

local function es_nota_de_tabla(bloque)
  return bloque and bloque.t == 'Div' and bloque.attributes['custom-style'] == 'Nota de tabla'
end

local leer_meta = {
  Meta = function(m)
    for clave, valor in pairs(m) do
      meta[clave] = pandoc.utils.stringify(valor)
    end
  end,
}

local formato = {
  -- <br> dentro de una celda de tabla: salto de línea (Word no conoce el HTML).
  RawInline = function(r)
    if r.format == 'html' and r.text:match('^<br%s*/?>$') then return pandoc.LineBreak() end
  end,

  Str = function(s)
    local texto, cambios = reemplazar(s.text)
    if cambios > 0 then return pandoc.Str(texto) end
  end,

  Code = function(c)
    local texto, cambios = reemplazar(c.text)
    if cambios > 0 then
      c.text = texto
      return c
    end
  end,

  Figure = function(figura)
    if #figura.caption.long == 0 then return nil end
    figuras = figuras + 1
    numerar(figura.caption, 'Figura', figuras)
    return figura
  end,

  Table = function(tabla)
    anchos_automaticos(tabla)
    con_estilo(tabla.head.rows, 'Celda encabezado')
    for _, cuerpo in ipairs(tabla.bodies) do
      con_estilo(cuerpo.head, 'Celda encabezado')
      con_estilo(cuerpo.body, 'Celda')
    end
    con_estilo(tabla.foot.rows, 'Celda')
    if #tabla.caption.long > 0 then
      tablas = tablas + 1
      numerar(tabla.caption, 'Tabla', tablas)
    end
    return tabla
  end,

  Blocks = function(bloques)
    local salida = pandoc.List()
    for i, bloque in ipairs(bloques) do
      salida:insert(bloque)
      if bloque.t == 'Table' and not es_nota_de_tabla(bloques[i + 1]) then
        salida:insert(pandoc.RawBlock('openxml', ESPACIO_TABLA))
      end
    end
    return salida
  end,

  Div = function(div)
    if div.classes:includes('salto-pagina') then
      return pandoc.RawBlock('openxml', '<w:p><w:r><w:br w:type="page"/></w:r></w:p>')
    elseif div.classes:includes('indice') then
      return indice('TOC \\o "1-3" \\h \\z \\u')
    elseif div.classes:includes('indice-figuras') then
      return indice('TOC \\h \\z \\c "Figura"')
    elseif div.classes:includes('indice-tablas') then
      return indice('TOC \\h \\z \\c "Tabla"')
    end
  end,
}

return { leer_meta, formato }
