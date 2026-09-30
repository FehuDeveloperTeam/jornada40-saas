"""Plantilla GUÍA del Reglamento Interno por rubro.

Es solo un punto de partida: el empleador la completa con las reglas propias
de su negocio (los textos [COMPLETAR …] quedan marcados en amarillo) y sube el
reglamento final. Contenido mínimo según el Art. 154 del Código del Trabajo
(RIOHS, 10 o más trabajadores), el Art. 67 de la Ley 16.744 y el DS 44/2023
(higiene y seguridad, toda empresa), la Ley 21.643 (Ley Karin: protocolo y
procedimiento, Art. 154 N°12 y Art. 211-A) y la Ley 21.561 (40 horas).

Los rubros son una lista cerrada (RUBROS): para agregar uno, basta sumarlo aquí
con sus riesgos, elementos de protección y reglas propias.
"""
UMBRAL_RIOHS = 10

# código, nombre visible, riesgos [(riesgo, medidas)], EPP, obligaciones y prohibiciones propias.
RUBROS = {
    'ADMINISTRACION': {
        'nombre': 'Administración y oficina',
        'riesgos': [
            ('Trastornos musculoesqueléticos por postura sostenida frente al computador',
             'Silla y pantalla regulables, pausas activas y alternar tareas.'),
            ('Fatiga visual', 'Iluminación adecuada, pantalla sin reflejos y pausas para descansar la vista.'),
            ('Caídas al mismo nivel', 'Pasillos despejados, cables ordenados y pisos secos.'),
            ('Contacto eléctrico', 'No sobrecargar enchufes ni manipular equipos energizados.'),
        ],
        'epp': [],
        'obligaciones': ['Mantener ordenado el puesto de trabajo y los pasillos libres de obstáculos.'],
        'prohibiciones': ['Sobrecargar enchufes o usar alargadores en mal estado.'],
    },
    'COMERCIO': {
        'nombre': 'Comercio y ventas',
        'riesgos': [
            ('Sobreesfuerzo al levantar o reponer mercadería',
             'Técnica correcta de levantamiento, carros de transporte y respetar el peso máximo de la Ley 20.949.'),
            ('Caídas al mismo y distinto nivel en sala y bodega', 'Escalas en buen estado, orden y pisos secos.'),
            ('Agresiones de terceros o asaltos', 'Protocolo de actuación, no oponer resistencia y dar aviso.'),
            ('Trabajo prolongado de pie', 'Pausas y asientos para descanso (Art. 193 del Código del Trabajo).'),
        ],
        'epp': ['Calzado de seguridad en bodega', 'Guantes para manipular cajas'],
        'obligaciones': ['Seguir el procedimiento de apertura, cierre y manejo de dinero de la empresa.'],
        'prohibiciones': ['Subirse a estanterías o cajas para alcanzar mercadería.'],
    },
    'MANUFACTURA': {
        'nombre': 'Manufactura, producción e industria',
        'riesgos': [
            ('Atrapamiento o cortes con máquinas', 'Protecciones de las máquinas, bloqueo antes de mantener y capacitación.'),
            ('Ruido', 'Protección auditiva y control del nivel de ruido (protocolo PREXOR).'),
            ('Exposición a sustancias químicas', 'Hojas de datos de seguridad, ventilación y EPP adecuado.'),
            ('Golpes y caídas de objetos', 'Orden, almacenamiento seguro y zonas de circulación marcadas.'),
            ('Sobreesfuerzo', 'Ayudas mecánicas y respetar el peso máximo de carga manual (Ley 20.949).'),
        ],
        'epp': ['Calzado de seguridad', 'Guantes', 'Protección auditiva', 'Lentes de seguridad', 'Ropa de trabajo'],
        'obligaciones': ['Usar las protecciones de las máquinas y avisar de inmediato cualquier falla.'],
        'prohibiciones': ['Retirar o anular las protecciones o dispositivos de seguridad de las máquinas.',
                          'Operar máquinas sin la capacitación y autorización correspondientes.'],
    },
    'TECNOLOGIA': {
        'nombre': 'Tecnología (TI)',
        'riesgos': [
            ('Trastornos musculoesqueléticos por uso prolongado del computador',
             'Puesto ergonómico, pausas activas y alternar tareas.'),
            ('Fatiga visual y mental', 'Pausas, iluminación adecuada y respetar el derecho a desconexión.'),
            ('Riesgos psicosociales por carga de trabajo', 'Planificación de tareas y canales para plantear la sobrecarga.'),
        ],
        'epp': [],
        'obligaciones': ['Resguardar la información y las credenciales de acceso de la empresa y sus clientes.'],
        'prohibiciones': ['Compartir contraseñas o instalar programas no autorizados en los equipos de la empresa.'],
    },
    'CONSTRUCCION': {
        'nombre': 'Construcción',
        'riesgos': [
            ('Caídas de altura', 'Arnés con línea de vida, barandas, andamios certificados y permiso de trabajo en altura.'),
            ('Golpes por caída de materiales', 'Casco, zonas señalizadas y orden en la obra.'),
            ('Contacto eléctrico', 'Tableros con protección y trabajos eléctricos solo por personal autorizado.'),
            ('Atrapamiento en excavaciones', 'Entibación, señalización y no ingresar sin autorización.'),
            ('Exposición a sílice, polvo y ruido', 'Humectación, protección respiratoria y auditiva.'),
            ('Sobreesfuerzo', 'Ayudas mecánicas y respetar el peso máximo de carga manual (Ley 20.949).'),
        ],
        'epp': ['Casco', 'Calzado de seguridad', 'Arnés de seguridad', 'Guantes', 'Lentes de seguridad',
                'Protección auditiva', 'Chaleco reflectante', 'Protección respiratoria'],
        'obligaciones': ['Usar arnés y línea de vida en todo trabajo sobre 1,8 metros de altura.',
                         'Respetar la señalización y las áreas restringidas de la obra.'],
        'prohibiciones': ['Trabajar en altura sin permiso ni arnés.', 'Retirar barandas, tapas o señalizaciones.'],
    },
    'GASTRONOMIA': {
        'nombre': 'Gastronomía y hotelería',
        'riesgos': [
            ('Quemaduras con superficies, líquidos o vapor', 'Guantes térmicos, orden en cocina y mangos hacia adentro.'),
            ('Cortes con cuchillos y máquinas', 'Uso correcto de cuchillos, guantes anticorte y máquinas con protección.'),
            ('Caídas por pisos mojados o grasos', 'Calzado antideslizante y limpieza inmediata de derrames.'),
            ('Estrés térmico', 'Ventilación, hidratación y pausas.'),
            ('Sobreesfuerzo y trabajo de pie', 'Técnica de levantamiento y pausas.'),
        ],
        'epp': ['Calzado antideslizante', 'Guantes térmicos', 'Guantes anticorte', 'Delantal', 'Cofia o gorro'],
        'obligaciones': ['Cumplir las normas de higiene y manipulación de alimentos (Reglamento Sanitario de los '
                         'Alimentos, DS 977).'],
        'prohibiciones': ['Manipular alimentos con heridas expuestas o enfermedades transmisibles sin avisar.'],
    },
    'TRANSPORTE': {
        'nombre': 'Transporte y bodega',
        'riesgos': [
            ('Accidentes de tránsito', 'Licencia vigente, respetar la Ley de Tránsito y los tiempos de conducción y descanso.'),
            ('Atropello por grúa horquilla u otros vehículos', 'Vías separadas, señalización y operador autorizado.'),
            ('Caída de carga desde estanterías', 'Almacenamiento según capacidad y estanterías ancladas.'),
            ('Sobreesfuerzo en carga y descarga', 'Ayudas mecánicas y respetar el peso máximo de carga manual (Ley 20.949).'),
        ],
        'epp': ['Calzado de seguridad', 'Guantes', 'Chaleco reflectante', 'Casco en bodega'],
        'obligaciones': ['Revisar el vehículo o equipo antes de usarlo e informar cualquier falla.',
                         'Respetar la jornada de conducción y los descansos del Art. 25 bis del Código del Trabajo.'],
        'prohibiciones': ['Conducir u operar equipos sin la licencia o autorización correspondiente.',
                          'Usar el teléfono mientras se conduce.'],
    },
    'AGRICOLA': {
        'nombre': 'Agrícola',
        'riesgos': [
            ('Exposición a plaguicidas', 'Solo personal capacitado, EPP completo y respetar los plazos de reingreso.'),
            ('Exposición a radiación UV y calor', 'Protector solar, sombra, hidratación y ropa adecuada.'),
            ('Cortes con herramientas', 'Herramientas en buen estado y guantes.'),
            ('Volcamiento de tractores', 'Estructura antivuelco, cinturón y operador autorizado.'),
            ('Sobreesfuerzo y posturas forzadas', 'Pausas, rotación de tareas y peso máximo de carga manual (Ley 20.949).'),
        ],
        'epp': ['Sombrero o legionario', 'Protector solar', 'Guantes', 'Calzado de seguridad',
                'Protección respiratoria para aplicación de plaguicidas', 'Ropa impermeable'],
        'obligaciones': ['Respetar las señales de áreas recién aplicadas con plaguicidas.'],
        'prohibiciones': ['Ingresar a sectores tratados antes del plazo de reingreso.',
                          'Comer, beber o fumar mientras se manipulan plaguicidas.'],
    },
    'ASEO': {
        'nombre': 'Aseo y mantención',
        'riesgos': [
            ('Contacto con productos químicos de limpieza', 'Hojas de datos de seguridad, rotulado y no mezclar productos.'),
            ('Caídas por pisos mojados', 'Señalizar el área húmeda y usar calzado antideslizante.'),
            ('Caídas de altura en limpieza de vidrios o techos', 'Escalas certificadas y arnés sobre 1,8 metros.'),
            ('Sobreesfuerzo', 'Carros de transporte y técnica de levantamiento.'),
        ],
        'epp': ['Guantes de nitrilo', 'Calzado antideslizante', 'Lentes de seguridad', 'Mascarilla'],
        'obligaciones': ['Mantener los productos químicos rotulados y en su envase original.'],
        'prohibiciones': ['Mezclar productos químicos (por ejemplo, cloro con amoníaco).'],
    },
    'SALUD': {
        'nombre': 'Salud',
        'riesgos': [
            ('Exposición a agentes biológicos', 'Precauciones estándar, vacunación y manejo de residuos (REAS).'),
            ('Pinchazos y cortes con material cortopunzante', 'Contenedores rígidos, no recapsular agujas y protocolo post-exposición.'),
            ('Sobreesfuerzo al movilizar pacientes', 'Técnica de movilización, ayudas mecánicas y trabajo en pareja.'),
            ('Agresiones de pacientes o acompañantes', 'Protocolo de actuación y registro de incidentes.'),
            ('Turnos y fatiga', 'Respetar los descansos y la organización de turnos.'),
        ],
        'epp': ['Guantes de procedimiento', 'Mascarilla', 'Protección ocular', 'Delantal o pechera', 'Calzado cerrado'],
        'obligaciones': ['Cumplir los protocolos de prevención de infecciones y de manejo de residuos del '
                         'establecimiento.'],
        'prohibiciones': ['Recapsular agujas o eliminar cortopunzantes fuera de los contenedores.'],
    },
}

OPCIONES_RUBRO = [(clave, datos['nombre']) for clave, datos in RUBROS.items()]


def tipo_segun_dotacion(trabajadores):
    """RIOHS con 10 o más trabajadores (Art. 153); si no, reglamento de higiene y seguridad (Art. 67 Ley 16.744)."""
    return 'RIOHS' if trabajadores >= UMBRAL_RIOHS else 'RIHS'


def bloques(empresa, rubro, tipo, mutual):
    """Bloques del reglamento (ver core.docx_simple)."""
    r = RUBROS[rubro]
    nombre = empresa.nombre_legal
    completo = tipo == 'RIOHS'
    titulo = ('REGLAMENTO INTERNO DE ORDEN, HIGIENE Y SEGURIDAD' if completo
              else 'REGLAMENTO INTERNO DE HIGIENE Y SEGURIDAD')
    b = [
        ('titulo', titulo),
        ('p', f'{nombre} · RUT {empresa.rut}' + (f' · {empresa.direccion}' if empresa.direccion else '')),
        ('nota', 'GUÍA: esta plantilla es solo un punto de partida preparado por Jornada40 para el rubro '
                 f'«{r["nombre"]}». Debe revisarla y completarla con las reglas propias de su negocio (los textos '
                 '[COMPLETAR …] marcados en amarillo), idealmente con su asesor laboral o su organismo administrador '
                 f'de la Ley 16.744 ({mutual}). Elimine esta nota antes de publicar el reglamento.'),
    ]
    if not completo:
        b.append(('nota', 'Su empresa tiene menos de 10 trabajadores: la ley no le exige el reglamento de orden '
                          '(Art. 153), pero sí el de higiene y seguridad (Art. 67 de la Ley 16.744 y DS 44), que debe '
                          'incluir el protocolo de prevención del acoso y la violencia (Ley Karin), entregado al firmar '
                          'cada contrato (Art. 154 bis).'))

    b += [
        ('h1', 'TÍTULO I. DISPOSICIONES GENERALES'),
        ('p', f'Artículo 1°. El presente reglamento regula las condiciones, requisitos, derechos, obligaciones, '
              f'prohibiciones y, en general, las formas y condiciones de trabajo, higiene y seguridad de todas las '
              f'personas que trabajan para {nombre}, en conformidad con '
              + ('los artículos 153 y siguientes del Código del Trabajo, ' if completo else '')
              + 'el artículo 67 de la Ley 16.744 y el Decreto Supremo N° 44 de 2023 del Ministerio del Trabajo.'),
        ('p', 'Artículo 2°. Todo trabajador está obligado a conocer y cumplir este reglamento. La empresa entregará '
              'gratuitamente un ejemplar a cada trabajador, en papel o, si este lo autorizó, por medios electrónicos '
              'a su correo personal, dejando constancia de la recepción (Art. 156 del Código del Trabajo).'),
    ]

    if completo:
        b += [
            ('h1', 'TÍTULO II. INGRESO'),
            ('p', 'Artículo 3°. Quien ingrese a la empresa deberá presentar: cédula de identidad, certificado de '
                  'afiliación a AFP y a sistema de salud, y los demás antecedentes que el cargo requiera '
                  '[COMPLETAR: otros documentos exigidos por su empresa].'),
            ('p', 'Artículo 4°. El contrato de trabajo se escriturará dentro de los 15 días siguientes a la '
                  'incorporación del trabajador (5 días si es por obra, trabajo o servicio determinado o de duración '
                  'inferior a 30 días) y se registrará en el portal Mi DT (Ley 21.327).'),

            ('h1', 'TÍTULO III. JORNADA DE TRABAJO'),
            ('p', 'Artículo 5°. La jornada ordinaria no excederá el máximo legal vigente (Ley 21.561: 44 horas desde '
                  'el 26-04-2024, 42 horas desde el 26-04-2026 y 40 horas desde el 26-04-2028), distribuida en no '
                  'más de seis ni menos de cinco días.'),
            ('p', 'Artículo 6°. Los horarios de trabajo son los siguientes: [COMPLETAR: horarios de entrada y '
                  'salida por turno o área, y los días de trabajo].'),
            ('p', 'Artículo 7°. La jornada se dividirá en dos partes, dejándose entre ellas un tiempo de colación '
                  'de a lo menos media hora, que no se considera trabajado (Art. 34) [COMPLETAR: horario de '
                  'colación].'),
            ('p', 'Artículo 8°. La asistencia y las horas trabajadas se registrarán mediante [COMPLETAR: libro de '
                  'asistencia, reloj control o sistema electrónico autorizado según la Resolución Exenta N° 38 de '
                  '2024 de la Dirección del Trabajo] (Art. 33).'),
            ('p', 'Artículo 9°. Solo se podrán trabajar horas extraordinarias para atender necesidades o situaciones '
                  'temporales de la empresa, con un pacto escrito de hasta tres meses renovable, y hasta dos horas '
                  'por día (Arts. 31 y 32). Se pagan con un recargo del 50 % sobre el sueldo convenido.'),
            ('p', 'Artículo 10°. Las partes podrán acordar por escrito que las horas extraordinarias se compensen '
                  'con días adicionales de feriado: por cada hora extraordinaria corresponde una hora y media de '
                  'descanso, hasta cinco días hábiles por año. El trabajador los usará dentro de los seis meses '
                  'siguientes, en días completos, avisando con 48 horas de anticipación; si no los usa, se pagarán '
                  'en la remuneración del período, y los pendientes al término de la relación se compensarán '
                  'conforme al artículo 73 (Art. 32 inc. 4°, Ley 21.561; Dictámenes 199/5 y 387/11).'),

            ('h1', 'TÍTULO IV. REMUNERACIONES'),
            ('p', 'Artículo 11°. Las remuneraciones se pagarán [COMPLETAR: mensualmente / quincenalmente] el día '
                  '[COMPLETAR: día de pago], mediante [COMPLETAR: transferencia bancaria / otro medio], junto con '
                  'una liquidación que detalla los montos pagados y los descuentos (Art. 54).'),
            ('p', 'Artículo 12°. Solo se harán los descuentos legales y los que el trabajador autorice por escrito, '
                  'sin que estos últimos excedan el 15 % de la remuneración total (Art. 58).'),
            ('p', 'Artículo 13°. La empresa respeta el principio de igualdad de remuneraciones entre hombres y '
                  'mujeres que presten un mismo trabajo (Art. 62 bis). Los reclamos por infracción a este principio '
                  'se presentarán por escrito a [COMPLETAR: cargo responsable], quien responderá fundadamente y por '
                  'escrito en un plazo no mayor a 30 días (Art. 154 N° 13).'),

            ('h1', 'TÍTULO V. FERIADO Y PERMISOS'),
            ('p', 'Artículo 14°. Los trabajadores con más de un año de servicio tienen derecho a 15 días hábiles de '
                  'feriado con remuneración íntegra, más el feriado progresivo que corresponda (Arts. 67 y 68). El '
                  'feriado se solicitará con [COMPLETAR: anticipación] a [COMPLETAR: cargo responsable].'),
            ('p', 'Artículo 15°. Los permisos legales (nacimiento, fallecimiento, matrimonio o acuerdo de unión '
                  'civil, entre otros) se otorgarán en los términos de los artículos 66, 195 y 207 bis.'),

            ('h1', 'TÍTULO VI. OBLIGACIONES'),
            ('p', 'Artículo 16°. Son obligaciones de los trabajadores, además de las del contrato:'),
            ('li', 'Cumplir su jornada y registrar su asistencia.'),
            ('li', 'Tratar con respeto a sus compañeros, jefaturas, clientes y proveedores.'),
            ('li', 'Cuidar las herramientas, equipos y bienes de la empresa.'),
            ('li', 'Guardar reserva de la información confidencial de la empresa.'),
            ('li', 'Dar aviso de su inasistencia el mismo día y justificarla dentro de [COMPLETAR: plazo].'),
            *[('li', o) for o in r['obligaciones']],
            ('li', '[COMPLETAR: otras obligaciones propias de su empresa].'),

            ('h1', 'TÍTULO VII. PROHIBICIONES'),
            ('p', 'Artículo 17°. Queda prohibido a los trabajadores:'),
            ('li', 'Presentarse al trabajo bajo la influencia del alcohol o de drogas, o consumirlos en el lugar de '
                   'trabajo.'),
            ('li', 'Ejercer cualquier forma de acoso sexual, acoso laboral o violencia en el trabajo.'),
            ('li', 'Ausentarse del lugar de trabajo sin autorización durante la jornada.'),
            ('li', 'Usar los bienes de la empresa para fines personales sin autorización.'),
            *[('li', p) for p in r['prohibiciones']],
            ('li', '[COMPLETAR: otras prohibiciones propias de su empresa].'),

            ('h1', 'TÍTULO VIII. CONSULTAS Y RECLAMOS'),
            ('p', 'Artículo 18°. Las consultas, peticiones y reclamos se dirigirán a [COMPLETAR: cargo o persona '
                  'responsable], quien responderá en un plazo de [COMPLETAR: plazo] (Art. 154 N° 6).'),

            ('h1', 'TÍTULO IX. NORMAS DE INCLUSIÓN Y NO DISCRIMINACIÓN'),
            ('p', 'Artículo 19°. La empresa promueve un trato igualitario sin distinción de edad, sexo, género, '
                  'orientación sexual, origen, religión, opinión política, discapacidad u otra condición. Adoptará '
                  'medidas de accesibilidad y ajustes razonables para las personas con discapacidad y prevendrá el '
                  'acoso hacia ellas (Art. 154 N° 7; Ley 21.015) [COMPLETAR: medidas concretas de su empresa].'),
        ]

    b += [
        ('h1', f'TÍTULO {"X" if completo else "II"}. PREVENCIÓN DEL ACOSO SEXUAL, LABORAL Y LA VIOLENCIA EN EL '
               'TRABAJO (LEY 21.643)'),
        ('h2', 'Protocolo de prevención'),
        ('p', 'La empresa declara que las relaciones laborales deben fundarse en un trato libre de violencia, '
              'compatible con la dignidad de las personas y con perspectiva de género (Art. 2° del Código del '
              'Trabajo). Este protocolo incluye (Art. 211-A):'),
        ('li', 'La identificación de los peligros y la evaluación de los riesgos psicosociales, con perspectiva de '
               'género, en la matriz de riesgos de la empresa.'),
        ('li', 'Medidas para prevenir el acoso sexual, el acoso laboral y la violencia en el trabajo, con objetivos '
               'medibles: [COMPLETAR: por ejemplo, capacitación anual, difusión de canales, encuesta de clima].'),
        ('li', 'Información y capacitación a los trabajadores sobre los riesgos identificados y las medidas '
               'adoptadas.'),
        ('li', 'Medidas de resguardo de la privacidad y la honra de todos los involucrados.'),
        ('li', 'Información semestral, a todos los trabajadores, de los canales para recibir denuncias y de las '
               'instancias estatales para denunciar incumplimientos y acceder a prestaciones de seguridad social.'),
        ('h2', 'Canales de denuncia'),
        ('p', 'Las denuncias podrán presentarse por escrito o verbalmente ante [COMPLETAR: cargo o persona '
              'responsable y correo electrónico de denuncias], o directamente ante la Inspección del Trabajo '
              '(www.dt.gob.cl). Las verbales se dejarán por escrito y serán firmadas por quien denuncia.'),
        ('h2', 'Procedimiento de investigación'),
        ('p', 'Recibida la denuncia, la empresa adoptará de inmediato medidas de resguardo (por ejemplo, separar los '
              'espacios físicos o redistribuir la jornada) y ofrecerá atención psicológica temprana a través de '
              f'{mutual}. Dentro de 3 días hábiles decidirá si investiga internamente o remite la denuncia a la '
              'Dirección del Trabajo; si la denuncia afecta al empleador o a su representante, se remitirá siempre '
              'a la Dirección del Trabajo.'),
        ('p', 'La investigación interna será reservada, respetará el derecho de ambas partes a ser oídas y a '
              'presentar pruebas, estará a cargo de una persona capacitada e imparcial, y concluirá en un plazo '
              'máximo de 30 días. Sus conclusiones se remitirán a la Dirección del Trabajo, y la empresa aplicará '
              'las medidas y sanciones que correspondan dentro de 15 días desde que esta se pronuncie (Arts. 211-B '
              'y siguientes; DS 21 de 2024).'),
        ('p', 'Las sanciones podrán ser amonestación, multa conforme a este reglamento o, en los casos graves, el '
              'término del contrato según el artículo 160 N° 1 letras b) y f) del Código del Trabajo.'),
    ]

    n = 'XI' if completo else 'III'
    b += [
        ('h1', f'TÍTULO {n}. HIGIENE Y SEGURIDAD'),
        ('h2', 'Obligaciones'),
        ('li', 'Usar correctamente los elementos de protección personal que la empresa entrega gratuitamente '
               '(Art. 68 de la Ley 16.744) y cuidarlos.'),
        ('li', 'Informar de inmediato a su jefatura todo accidente, incidente o condición insegura.'),
        ('li', 'Participar en las capacitaciones de seguridad y en los simulacros de emergencia.'),
        ('li', 'Respetar la señalización y las vías de evacuación.'),
        ('h2', 'Prohibiciones'),
        ('li', 'Trabajar sin los elementos de protección personal requeridos.'),
        ('li', 'Retirar, dañar o desactivar dispositivos o señales de seguridad.'),
        ('li', 'Realizar tareas para las que no ha sido capacitado o autorizado.'),
        ('li', 'Consumir alcohol o drogas, o trabajar bajo su influencia.'),
        ('h2', 'Riesgos del trabajo y medidas preventivas'),
        ('p', 'La empresa informará a cada trabajador, antes de comenzar sus labores y cada vez que cambien los '
              'procesos, materiales o tecnologías, los riesgos de su trabajo, las medidas preventivas y los '
              'procedimientos de trabajo seguro (Art. 15 del DS 44). Los principales riesgos del rubro son:'),
        *[('li', f'{riesgo}. Medidas: {medidas}') for riesgo, medidas in r['riesgos']],
        ('li', '[COMPLETAR: otros riesgos según la matriz de identificación de peligros de su empresa].'),
    ]
    if r['epp']:
        b += [
            ('h2', 'Elementos de protección personal'),
            ('p', 'Según el puesto, la empresa entregará sin costo, con registro firmado de la entrega y '
                  'capacitación de al menos una hora sobre su uso (Art. 13 del DS 44):'),
            *[('li', e) for e in r['epp']],
        ]
    b += [
        ('h2', 'Accidentes del trabajo y enfermedades profesionales'),
        ('p', f'La empresa está adherida a {mutual}. Todo accidente, incluso de trayecto, debe informarse de '
              'inmediato; la empresa hará la denuncia (DIAT o DIEP) y el trabajador recibirá atención en los '
              'centros del organismo administrador.'),
        ('p', 'Cuando existan más de 25 trabajadores se constituirá un Comité Paritario de Higiene y Seguridad; '
              'con entre 10 y 25 trabajadores sin comité, se elegirá un Delegado de Seguridad y Salud en el Trabajo '
              '(DS 44).'),
        ('h2', 'Emergencias'),
        ('p', 'En caso de sismo, incendio u otra emergencia, los trabajadores seguirán el plan de emergencia de la '
              'empresa [COMPLETAR: zonas de seguridad, responsables y números de emergencia].'),
    ]

    n = 'XII' if completo else 'IV'
    b += [
        ('h1', f'TÍTULO {n}. SANCIONES'),
        ('p', 'Las infracciones a este reglamento se sancionarán con amonestación verbal, amonestación escrita '
              'o multa de hasta el 25 % de la remuneración diaria del infractor, previa audiencia del trabajador. '
              'Las multas se destinarán a los fondos de bienestar de la empresa o, a falta de estos, al Servicio '
              'Nacional de Capacitación y Empleo. El trabajador podrá reclamar ante la Inspección del Trabajo '
              '(Art. 157 del Código del Trabajo; Art. 61 del DS 44).'),
        ('h1', f'TÍTULO {"XIII" if completo else "V"}. VIGENCIA'),
        ('p', 'Este reglamento se pone en conocimiento de los trabajadores 30 días antes de que comience a regir y '
              'se publica en al menos dos lugares visibles del lugar de trabajo. Dentro de los 5 días siguientes a '
              'su vigencia, se remite una copia a la Dirección del Trabajo (portal Mi DT) y a la Secretaría '
              'Regional Ministerial de Salud (Art. 153). Se revisará al menos una vez al año.'),
        ('p', 'Fecha de publicación: [COMPLETAR: fecha]. Rige desde: [COMPLETAR: fecha, 30 días después].'),
        ('p', f'{empresa.representante_legal or "[COMPLETAR: nombre del representante legal]"}\n'
              f'Representante legal · {nombre}'),
    ]
    return b
