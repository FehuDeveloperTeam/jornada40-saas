import { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { formatRut, validateRut } from '../utils/rutUtils';
import * as XLSX from 'xlsx';
import { Layers, BarChart2, Undo2, Download, FileSpreadsheet, UploadCloud, 
  AlertCircle, CheckCircle2, X, Users, Laptop, Clock, Globe, 
  CircleDollarSign, Building2, Landmark, FileText, FileSignature, 
  AlertTriangle, Briefcase, FolderArchive, ChevronDown} from 'lucide-react';
import { BarChart, Bar, XAxis, Tooltip, ResponsiveContainer, Cell} from 'recharts';

// --- TIPOS E INTERFACES ---
interface Empresa {
  id: number;
  nombre_legal: string;
  rut: string;
  giro?: string;
}

interface Empleado {
  id: number;
  rut: string;
  nombres: string;
  apellido_paterno: string;
  apellido_materno?: string;
  sexo?: string;
  fecha_nacimiento?: string;
  nacionalidad?: string;
  estado_civil?: string;
  direccion?: string;
  comuna?: string;
  numero_telefono?: string;
  email?: string;
  departamento?: string;
  cargo: string;
  sucursal?: string;
  horas_laborales?: number;
  modalidad?: string;
  sueldo_base?: number;
  afp?: string;
  sistema_salud?: string;
  fecha_ingreso?: string;
  activo: boolean;
  empresa: number;
  creado_en?: string;
  centro_costo?: string;
  ficha_numero?: string;
  forma_pago?: string;
  banco?: string;
  tipo_cuenta?: string;
  numero_cuenta?: string;
  plan_isapre_uf?: number;
}

interface HorarioDia {
  activo: boolean;
  entrada: string;
  salida: string;
  colacion: number;
}

type HorarioSemana = Record<string, HorarioDia>;

interface Contrato {
  id?: number;
  empleado: number;
  tipo_contrato: string;
  cargo: string;
  fecha_inicio: string;
  fecha_fin?: string;
  sueldo_base: number;
  tipo_jornada: string;
  horas_semanales: number;
  distribucion_dias: number;
  tiene_colacion_imputable: boolean;
  jornada_personalizada?: string;
  clausulas_especiales?: string[];
  dia_pago: number;
  gratificacion_legal: string;
  tiene_quincena: boolean;
  dia_quincena?: number | null;
  monto_quincena?: number | null;
  funciones_especificas?: string[];
  distribucion_horario?: HorarioSemana;
}

// NUEVA INTERFAZ: DOCUMENTO LEGAL
interface DocumentoLegal {
  id?: number;
  empleado: number;
  tipo: string;
  fecha_emision: string;
  causal_legal?: string;
  hechos: string;
  aviso_previo_pagado: boolean;
  creado_en?: string;
}


interface ItemDinamico {
  glosa: string;
  valor: number;
}

interface HoraExtraItem {
  glosa: string;
  horas: number;
  recargo: number;
  valor: number;
}

// --- INTERFAZ LIQUIDACIÓN ACTUALIZADA ---
interface Liquidacion {
  id?: number;
  empleado: number;
  mes: number;
  anio: number;
  dias_trabajados: number;
  dias_licencia?: number;
  dias_ausencia?: number;
  dias_no_contratados?: number;
  sueldo_base: number;
  gratificacion: number;
  
  // Reemplazamos los antiguos por los nuevos arreglos:
  detalle_haberes_imponibles?: ItemDinamico[];
  detalle_horas_extras?: HoraExtraItem[];
  detalle_haberes_no_imponibles?: ItemDinamico[];
  detalle_otros_descuentos?: ItemDinamico[];
  
  afp_nombre?: string;
  afp_monto: number;
  salud_nombre?: string;
  isapre_cotizacion_uf?: number;
  salud_monto: number;
  seguro_cesantia: number;
  anticipo_quincena: number;
  
  total_imponible: number;
  total_haberes: number;
  total_descuentos: number;
  sueldo_liquido: number;
  fecha_emision?: string;
}

const apiConfig = { withCredentials: true };

const defaultHorario: HorarioSemana = {
  lunes: { activo: true, entrada: '09:00', salida: '18:00', colacion: 60 },
  martes: { activo: true, entrada: '09:00', salida: '18:00', colacion: 60 },
  miercoles: { activo: true, entrada: '09:00', salida: '18:00', colacion: 60 },
  jueves: { activo: true, entrada: '09:00', salida: '18:00', colacion: 60 },
  viernes: { activo: true, entrada: '09:00', salida: '18:00', colacion: 60 },
  sabado: { activo: false, entrada: '09:00', salida: '14:00', colacion: 0 },
  domingo: { activo: false, entrada: '09:00', salida: '14:00', colacion: 0 },
};


export default function Dashboard() {
  const [empresa, setEmpresa] = useState<Empresa | null>(null);
  const [empleados, setEmpleados] = useState<Empleado[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [downloadingId, setDownloadingId] = useState<number | null>(null);
  
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCargos, setSelectedCargos] = useState<string[]>([]);
  const [selectedDeptos, setSelectedDeptos] = useState<string[]>([]);
  const [selectedStatuses, setSelectedStatuses] = useState<boolean[]>([true, false]);
  const [openFilterDropdown, setOpenFilterDropdown] = useState<'cargo' | 'depto' | 'estado' | null>(null);

  const [isModalMasivoOpen, setIsModalMasivoOpen] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isGeneratingZip, setIsGeneratingZip] = useState(false);

  const [selectedEmpleadosIds, setSelectedEmpleadosIds] = useState<number[]>([]);
  const [isDownloadMenuOpen, setIsDownloadMenuOpen] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);

  // Seleccionar/Deseleccionar todos
  const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.checked && filteredEmpleados) {
      setSelectedEmpleadosIds(filteredEmpleados.map(emp => emp.id));
    } else {
      setSelectedEmpleadosIds([]);
    }
  };

  // Seleccionar uno por uno
  const handleSelectEmpleado = (id: number) => {
    setSelectedEmpleadosIds(prev => 
      prev.includes(id) ? prev.filter(empId => empId !== id) : [...prev, id]
    );
  };

  // Función placeholder para la descarga (la conectaremos al back después)
  const ejecutarDescargaMasiva = async (tipo: string) => {
    setIsDownloading(true);
    setIsDownloadMenuOpen(false);
    console.log(`Descargando ${tipo} para IDs:`, selectedEmpleadosIds);
    
    // Aquí irá la llamada a axios.post con responseType: 'blob'
    setTimeout(() => setIsDownloading(false), 2000); // Simulación
  };

  // Estados para Carga Masiva Visual
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [uploadResult, setUploadResult] = useState<{ agregados: number; actualizados: number; errores: string[]; limite_alcanzado: boolean } | null>(null);

  // Estados del panel lateral y Pestañas
  const [isPanelOpen, setIsPanelOpen] = useState<boolean>(false);
  const [panelMode, setPanelMode] = useState<'create' | 'edit' | 'view'>('create');
  const [selectedEmpleado, setSelectedEmpleado] = useState<Empleado | null>(null);
  const [isValidRut, setIsValidRut] = useState<boolean>(true);
  const [activeTab, setActiveTab] = useState<'perfil' | 'contratos' | 'liquidaciones' | 'legal'>('perfil');

  // Formularios
  const [formData, setFormData] = useState<Partial<Empleado>>({});
  const [contratoData, setContratoData] = useState<Partial<Contrato>>({});
  const [isSavingContrato, setIsSavingContrato] = useState(false);
  const [hayCambiosContrato, setHayCambiosContrato] = useState(false); // <--- ESTADO DE CANDADO
  const [expandedLiqId, setExpandedLiqId] = useState<number | null>(null);

  // Estados para Liquidaciones 
  const [liquidaciones, setLiquidaciones] = useState<Liquidacion[]>([]);
  const [showLiqForm, setShowLiqForm] = useState(false);
  const [isGeneratingLiq, setIsGeneratingLiq] = useState(false);
  
  const [liqMes, setLiqMes] = useState(new Date().getMonth() + 1);
  const [liqAnio, setLiqAnio] = useState(new Date().getFullYear());
  const [liqDiasTrabajados, setLiqDiasTrabajados] = useState(30);
  const [liqAusencias, setLiqAusencias] = useState(0);

  // Arreglos dinámicos con Glosa y Valor
  const [haberesImponiblesList, setHaberesImponiblesList] = useState<{glosa: string, valor: number}[]>([]);
  const [haberesNoImponiblesList, setHaberesNoImponiblesList] = useState<{glosa: string, valor: number}[]>([]);
  const [horasExtrasList, setHorasExtrasList] = useState<{glosa: string, horas: number, recargo: number, valor: number}[]>([]);
  
  // Estados de Contratos
  const [funciones, setFunciones] = useState<string[]>([]);
  const [clausulas, setClausulas] = useState<string[]>([]);
  const [horario, setHorario] = useState<HorarioSemana>(defaultHorario);

  // Estados para Documentos Legales 
  const [documentosLegales, setDocumentosLegales] = useState<DocumentoLegal[]>([]);
  const [documentoData, setDocumentoData] = useState<Partial<DocumentoLegal>>({});
  const [showDocumentoForm, setShowDocumentoForm] = useState(false);
  const [isSavingDocumento, setIsSavingDocumento] = useState(false);

  // Calculadora Matemática en tiempo real
  const totalHorasCalculadas = useMemo(() => {
    let total = 0;
    Object.values(horario).forEach((dia: HorarioDia) => {
      if (dia.activo && dia.entrada && dia.salida) {
        const [he, me] = dia.entrada.split(':').map(Number);
        const [hs, ms] = dia.salida.split(':').map(Number);
        const minsTrabajados = ((hs * 60 + ms) - (he * 60 + me)) - (dia.colacion || 0);
        if (minsTrabajados > 0) total += (minsTrabajados / 60);
      }
    });
    return total;
  }, [horario]);

  const navigate = useNavigate();
  const empresaActivaId = localStorage.getItem('empresaActivaId');

  const fetchData = useCallback(async () => {
    if (!empresaActivaId) {
      navigate('/empresas');
      return;
    }
    try {
      const [empresaRes, empleadosRes] = await Promise.all([
        axios.get(`https://jornada40-saas-production.up.railway.app/api/empresas/${empresaActivaId}/`, apiConfig),
        axios.get('https://jornada40-saas-production.up.railway.app/api/empleados/', apiConfig)
      ]);
      setEmpresa(empresaRes.data);
      const empleadosFiltrados = empleadosRes.data.filter(
        (emp: Empleado) => emp.empresa === parseInt(empresaActivaId)
      );
      setEmpleados(empleadosFiltrados);
    } catch (error) {
      console.error('Error al cargar datos:', error);
      navigate('/login');
    } finally {
      setLoading(false);
    }
  }, [empresaActivaId, navigate]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    if (empleados.length > 0) {
      const uniqueCargos = Array.from(new Set(empleados.map(e => e.cargo || 'NO ESPECIFICADO')));
      const uniqueDeptos = Array.from(new Set(empleados.map(e => e.departamento || 'NO ESPECIFICADO')));
      setSelectedCargos(uniqueCargos);
      setSelectedDeptos(uniqueDeptos);
      setSelectedStatuses([true, false]);
    }
  }, [empleados]);

  const allCargos = useMemo(() => Array.from(new Set(empleados.map(e => e.cargo || 'NO ESPECIFICADO'))), [empleados]);
  const allDeptos = useMemo(() => Array.from(new Set(empleados.map(e => e.departamento || 'NO ESPECIFICADO'))), [empleados]);

  const filteredEmpleados = useMemo(() => {
    return empleados
      .filter((emp) => {
        const busqueda = searchTerm.toLowerCase();
        const textoCompleto = `${emp.nombres} ${emp.apellido_paterno} ${emp.apellido_materno || ''} ${emp.rut} ${emp.comuna || ''} ${emp.direccion || ''} ${emp.cargo} ${emp.departamento || ''}`.toLowerCase();
        if (busqueda && !textoCompleto.includes(busqueda)) return false;
        if (!selectedStatuses.includes(emp.activo)) return false;
        const cargoEmp = emp.cargo || 'NO ESPECIFICADO';
        if (!selectedCargos.includes(cargoEmp)) return false;
        const deptoEmp = emp.departamento || 'NO ESPECIFICADO';
        if (!selectedDeptos.includes(deptoEmp)) return false;
        return true;
      })
      .sort((a, b) => {
        if (a.activo === b.activo) return a.apellido_paterno.localeCompare(b.apellido_paterno);
        return a.activo ? -1 : 1; 
      });
  }, [empleados, searchTerm, selectedStatuses, selectedCargos, selectedDeptos]);

  // Estado para controlar qué widget está volteado (Cara B)
  const [flippedWidgets, setFlippedWidgets] = useState<Record<string, boolean>>({});

  const toggleWidget = (id: string) => {
    setFlippedWidgets(prev => ({ ...prev, [id]: !prev[id] }));
  };

  // ==========================================
  // CÁLCULO DE ESTADÍSTICAS VISUALES (BI)
  // ==========================================
  const stats = useMemo(() => {
    if (!empleados || empleados.length === 0) return null;
    
    const total = empleados.length;

    // A. Total Trabajadores (Activos vs Inactivos)
    // Asumimos activo si no dice explicitamente false
    const activos = empleados.filter(e => e.activo !== false).length; 
    const inactivos = total - activos;
    const chartTotal = [
      { name: 'Activos', valor: activos, color: '#3b82f6' }, // blue-500
      { name: 'Inactivos', valor: inactivos, color: '#cbd5e1' } // slate-300
    ];

    // B. Distribución de Género
    const mujeres = empleados.filter(e => e.sexo === 'F').length;
    const hombres = empleados.filter(e => e.sexo === 'M').length;
    const chartGenero = [
      { name: 'Mujeres', valor: mujeres, color: '#e879f9' }, // fuchsia-400
      { name: 'Hombres', valor: hombres, color: '#60a5fa' }  // blue-400
    ];

    // C. Modalidad de Trabajo
    const teletrabajo = empleados.filter(e => e.modalidad?.toUpperCase() === 'TELETRABAJO').length;
    const presencial = total - teletrabajo;
    const chartModalidad = [
      { name: 'Remoto', valor: teletrabajo, color: '#10b981' }, // emerald-500
      { name: 'Oficina', valor: presencial, color: '#f59e0b' }  // amber-500
    ];
    
    // 1. Jornada
    const jornada40 = empleados.filter(e => (e.horas_laborales || 0) <= 40).length;
    const jornadaMayor = total - jornada40;
    const chartJornada = [
      { name: '40 Hrs', valor: jornada40, color: '#10b981' },
      { name: '> 40 Hrs', valor: jornadaMayor, color: '#f59e0b' }
    ];

    // 2. Extranjería
    const chilenos = empleados.filter(e => e.nacionalidad?.toUpperCase() === 'CHILENA').length;
    const extranjeros = total - chilenos;
    const pctExtranjeros = total > 0 ? (extranjeros / total) * 100 : 0;
    const chartNacionalidad = [
      { name: 'Chilenos', valor: chilenos, color: '#3b82f6' },
      { name: 'Extranj.', valor: extranjeros, color: pctExtranjeros > 15 ? '#ef4444' : '#6366f1' }
    ];

    // 3 y 4. Costos y Centros
    const masaSalarial = empleados.reduce((sum, e) => sum + (e.sueldo_base || 0), 0);
    const costosPorCentro: Record<string, number> = {};
    empleados.forEach(e => {
      const centro = e.centro_costo?.toUpperCase() || 'SIN ASIGNAR';
      costosPorCentro[centro] = (costosPorCentro[centro] || 0) + (e.sueldo_base || 0);
    });
    
    // Convertir a array y ordenar para el gráfico de barras de Centros de Costo
    const chartCentros = Object.entries(costosPorCentro)
      .map(([name, valor]) => ({ name, valor }))
      .sort((a, b) => b.valor - a.valor)
      .slice(0, 4); // Top 4 para no saturar el mini gráfico

    const topCentro = chartCentros.length > 0 ? chartCentros[0] : { name: 'N/A', valor: 0 };

    // 7. Generacional
    let menores30 = 0, entre30y50 = 0, mayores50 = 0;
    const hoy = new Date();
    empleados.forEach(e => {
      if (e.fecha_nacimiento) {
        const nac = new Date(e.fecha_nacimiento);
        let edad = hoy.getFullYear() - nac.getFullYear();
        if (hoy.getMonth() < nac.getMonth() || (hoy.getMonth() === nac.getMonth() && hoy.getDate() < nac.getDate())) edad--;
        if (edad < 30) menores30++;
        else if (edad <= 50) entre30y50++;
        else mayores50++;
      }
    });
    const chartGeneraciones = [
      { name: '< 30', valor: menores30, color: '#d946ef' },
      { name: '30-50', valor: entre30y50, color: '#a855f7' },
      { name: '> 50', valor: mayores50, color: '#8b5cf6' }
    ];

    // 8. Bancarización
    const bancarizados = empleados.filter(e => ['TRANSFERENCIA', 'DEPOSITO'].includes(e.forma_pago?.toUpperCase() || '')).length;
    const noBancarizados = total - bancarizados;
    const chartBancos = [
      { name: 'Digital', valor: bancarizados, color: '#06b6d4' },
      { name: 'Manual', valor: noBancarizados, color: '#f59e0b' }
    ];

    return { 
      chartTotal, total, inactivos, mujeres, hombres, chartGenero, teletrabajo, presencial, chartModalidad, jornada40, jornadaMayor, chartJornada,
      extranjeros, pctExtranjeros, chartNacionalidad,
      masaSalarial, topCentro, chartCentros,
      menores30, entre30y50, mayores50, chartGeneraciones,
      bancarizados, noBancarizados, chartBancos
    };
  }, [empleados]);

  const toggleArrayItem = <T,>(array: T[], setArray: React.Dispatch<React.SetStateAction<T[]>>, item: T) => {
    if (array.includes(item)) setArray(array.filter(i => i !== item));
    else setArray([...array, item]);
  };

  const toggleSelectAll = <T,>(allList: T[], currentList: T[], setList: React.Dispatch<React.SetStateAction<T[]>>) => {
    if (currentList.length === allList.length) setList([]);
    else setList(allList);
  };

  const volverAlLobby = () => {
    localStorage.removeItem('empresaActivaId');
    navigate('/empresas');
  };

  const descargarPlantillaExcel = () => {
    const datosEjemplo = [
      {
        RUT: "12.345.678-9",
        Nombres: "JUAN ALBERTO",
        Apellido_Paterno: "PEREZ",
        Apellido_Materno: "GONZALEZ",
        Email: "juan.perez@empresa.cl",
        Sexo: "M",
        Nacionalidad: "CHILENA",
        Fecha_Nacimiento: "1990-01-01",
        Estado_Civil: "SOLTERO",
        Numero_Telefono: "+56912345678",
        Comuna: "SANTIAGO",
        Direccion: "AV. PROVIDENCIA 123",
        Centro_Costo: "ADMINISTRACION",
        Cargo: "VENDEDOR",
        Fecha_Ingreso: "2023-05-01",
        Horas_Laborales: 40,
        Modalidad: "PRESENCIAL",
        Sueldo_Base: 500000,
        AFP: "MODELO",
        Salud: "FONASA",
        Plan_Isapre_UF: 0,
        Departamento: "VENTAS",
        Sucursal: "MATRIZ",
        Forma_Pago: "TRANSFERENCIA",
        Banco: "BANCO ESTADO",
        Tipo_Cuenta: "CORRIENTE",
        Numero_Cuenta: "1234567890"
      },
      {
        RUT: "11.111.111-1",
        Nombres: "CAMILA",
        Apellido_Paterno: "MARTINEZ",
        Apellido_Materno: "GARRIDO",
        Email: "camila@empresa.cl",
        Sexo: "F",
        Nacionalidad: "CHILENA",
        Fecha_Nacimiento: "1995-05-15",
        Estado_Civil: "CASADA",
        Numero_Telefono: "+56987654321",
        Comuna: "PROVIDENCIA",
        Direccion: "LOS LEONES 456",
        Centro_Costo: "OPERACIONES",
        Cargo: "SUPERVISORA",
        Fecha_Ingreso: "2024-01-10",
        Horas_Laborales: 44,
        Modalidad: "TELETRABAJO",
        Sueldo_Base: 1200000,
        AFP: "PROVIDA",
        Salud: "ISAPRE",
        Plan_Isapre_UF: 2.8,
        Departamento: "OPERACIONES",
        Sucursal: "MATRIZ",
        Forma_Pago: "TRANSFERENCIA",
        Banco: "BANCO ESTADO",
        Tipo_Cuenta: "CORRIENTE",
        Numero_Cuenta: "0987654321"
      }
    ];

    const ws = XLSX.utils.json_to_sheet(datosEjemplo);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Trabajadores");
    XLSX.writeFile(wb, "Plantilla_Carga_Masiva.xlsx");
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files?.length === 0 || !empresa) return;
    
    setIsUploading(true);
    setUploadResult(null); // Limpiamos resultados anteriores

    const file = e.target.files[0];
    const formData = new FormData();
    
    // Adjuntamos el archivo físico y el ID de la empresa tal como los espera Django
    formData.append('file', file); 
    formData.append('empresa', empresa.id.toString());

    try {
      const response = await axios.post(
        `https://jornada40-saas-production.up.railway.app/api/empleados/carga_masiva/`,
        formData,
        {
          ...apiConfig,
          headers: {
            'Content-Type': 'multipart/form-data', // Fundamental para enviar archivos
          },
        }
      );

      // Guardamos el resultado para mostrarlo en el Modal Premium
      // (Usamos fallback por si tu backend lo envía en 'resultados' o en la raíz)
      setUploadResult(response.data.resultados || response.data);
      fetchData(); // <-- Recarga la tabla de empleados

    } catch (error) {
      console.error("Error cargando Excel:", error);
      
      // Mensaje por defecto
      let mensajeBackend = "Error de conexión o formato de archivo inválido.";
      
      // Comprobamos si es un error específico de Axios de forma segura
      if (axios.isAxiosError(error)) {
        mensajeBackend = error.response?.data?.error || mensajeBackend;
      } else if (error instanceof Error) {
        // Por si es un error estándar de Javascript
        mensajeBackend = error.message;
      }
      setUploadResult({ 
        agregados: 0, 
        actualizados: 0,
        errores: [mensajeBackend], 
        limite_alcanzado: false 
      });
    } finally {
      setIsUploading(false);
      e.target.value = ''; 
    }
  };
  // ==========================================
  // CARGAR DATOS AL ABRIR EL PANEL
  // ==========================================
  const fetchContratoYDocumentos = async (empleadoId: number) => {
    try {
      // 1. Cargar Contrato
      const resContrato = await axios.get(`https://jornada40-saas-production.up.railway.app/api/contratos/?empleado=${empleadoId}`, apiConfig);
      if (resContrato.data && resContrato.data.length > 0) {
        const contrato = resContrato.data[0];
        setContratoData(contrato);
        setFunciones(contrato.funciones_especificas || []);
        setClausulas(contrato.clausulas_especiales || []);
        if (contrato.distribucion_horario && Object.keys(contrato.distribucion_horario).length > 0) {
            setHorario(contrato.distribucion_horario);
        } else {
            setHorario(defaultHorario);
        }
      } else {
        const emp = empleados.find(e => e.id === empleadoId);
        setContratoData({
          empleado: empleadoId,
          tipo_contrato: 'INDEFINIDO',
          tipo_jornada: 'ORDINARIA',
          cargo: emp?.cargo || 'NO ESPECIFICADO',
          sueldo_base: emp?.sueldo_base || 0,
          horas_semanales: 44,
          distribucion_dias: 5,
          fecha_inicio: emp?.fecha_ingreso || new Date().toISOString().split('T')[0],
          tiene_colacion_imputable: false,
          dia_pago: 5,
          gratificacion_legal: 'MENSUAL',
          tiene_quincena: false
        });
        setFunciones([]);
        setClausulas([]);
        setHorario(defaultHorario);
      }
      
      // Apagamos la alarma al terminar de cargar los datos del servidor
      setHayCambiosContrato(false); 

      // 2. Cargar Documentos Legales 
      const resDocs = await axios.get(`https://jornada40-saas-production.up.railway.app/api/documentos_legales/?empleado=${empleadoId}`, apiConfig);
      setDocumentosLegales(resDocs.data);
      setShowDocumentoForm(false);

      // 3. Cargar Liquidaciones 
      const resLiq = await axios.get(`https://jornada40-saas-production.up.railway.app/api/liquidaciones/?empleado=${empleadoId}`, apiConfig);
      setLiquidaciones(resLiq.data);
      setShowLiqForm(false);

    } catch (error) {
      console.error("Error al cargar datos del panel:", error);
    }
  };

  const abrirVer = (emp: Empleado) => {
    setSelectedEmpleado(emp);
    setPanelMode('view');
    setActiveTab('perfil');
    fetchContratoYDocumentos(emp.id); 
    setIsPanelOpen(true);
  };

  const abrirEditar = (emp: Empleado) => {
    setSelectedEmpleado(emp);
    const telefonoLimpio = emp.numero_telefono ? emp.numero_telefono.replace('+56', '') : '';
    setFormData({ ...emp, numero_telefono: telefonoLimpio });
    setIsValidRut(true);
    setPanelMode('edit');
    setActiveTab('perfil');
    fetchContratoYDocumentos(emp.id); 
    setIsPanelOpen(true);
  };

  const abrirCrear = () => {
    setPanelMode('create');
    setFormData({ 
      activo: true, 
      nacionalidad: 'CHILENA', 
      modalidad: 'PRESENCIAL',
      horas_laborales: 40,
      sueldo_base: 0,
      empresa: parseInt(empresaActivaId!) 
    });
    setIsValidRut(false);
    setActiveTab('perfil');
    setIsPanelOpen(true);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target;
    
    if (name === 'rut') {
      const formateado = formatRut(value);
      setFormData(prev => ({ ...prev, rut: formateado }));
      setIsValidRut(validateRut(formateado));
    } 
    else if (name === 'numero_telefono') {
      const soloNumeros = value.replace(/[^0-9]/g, '').slice(0, 9);
      setFormData(prev => ({ ...prev, numero_telefono: soloNumeros }));
    }
    // ---> Lógica de Forma de Pago corregida
    else if (name === 'forma_pago') {
      const nuevaForma = value.toUpperCase();
      // Si elige Efectivo o Cheque, borramos los datos bancarios al instante
      if (nuevaForma === 'EFECTIVO' || nuevaForma === 'CHEQUE') {
        setFormData(prev => ({
          ...prev,
          forma_pago: nuevaForma,
          banco: '',
          tipo_cuenta: '',
          numero_cuenta: ''
        }));
      } else {
        setFormData(prev => ({ ...prev, forma_pago: nuevaForma }));
      }
    } 
    // ---> EL ERROR ESTABA AQUÍ: faltaba la palabra "else"
    else {
      setFormData(prev => ({
        ...prev,
        [name]: type === 'checkbox' ? (e.target as HTMLInputElement).checked : value
      }));
    }
  };

  const handleContratoChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target;
    setContratoData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? (e.target as HTMLInputElement).checked : value
    }));
    setHayCambiosContrato(true); 
  };

  // ==========================================
  // MANEJADOR PARA GUARDAR CONTRATOS
  // ==========================================
  const guardarContrato = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingContrato(true);

    const payload = {
      ...contratoData,
      funciones_especificas: funciones,
      clausulas_especiales: clausulas,
      distribucion_horario: horario,
      dia_quincena: contratoData.tiene_quincena ? (contratoData.dia_quincena || 15) : null,
      monto_quincena: contratoData.tiene_quincena ? Number(contratoData.monto_quincena) : null
    };

    try {
      if (contratoData.id) {
        await axios.patch(`https://jornada40-saas-production.up.railway.app/api/contratos/${contratoData.id}/`, payload, apiConfig);
        alert("¡Contrato actualizado exitosamente!");
      } else {
        const res = await axios.post(`https://jornada40-saas-production.up.railway.app/api/contratos/`, payload, apiConfig);
        setContratoData(res.data);
        alert("¡Contrato creado exitosamente!");
      }
      // Apagamos la alarma una vez guardado
      setHayCambiosContrato(false);
    } catch (error) {
      console.error("Error guardando contrato:", error);
      alert("Hubo un error al guardar las condiciones del contrato.");
    } finally {
      setIsSavingContrato(false);
    }
  };

  // ==========================================
  // MANEJADOR PARA GUARDAR DOCUMENTOS LEGALES
  // ==========================================
  const guardarDocumentoLegal = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingDocumento(true);

    try {
      const res = await axios.post(`https://jornada40-saas-production.up.railway.app/api/documentos_legales/`, documentoData, apiConfig);
      setDocumentosLegales(prev => [res.data, ...prev]);
      setShowDocumentoForm(false);
      alert("¡Documento legal generado exitosamente!");
    } catch (error) {
      console.error("Error guardando documento:", error);
      alert("Hubo un error al guardar el documento.");
    } finally {
      setIsSavingDocumento(false);
    }
  };

  // ==========================================
  // CALCULADORA LEGAL DE HORAS EXTRAS (CHILE)
  // ==========================================
  const calcularValorHorasExtras = (horas: number, recargo: number) => {
    // Tomamos el sueldo base y horas de la ficha del empleado activo
    const sueldoBase = selectedEmpleado?.sueldo_base || 0;
    const horasSemanales = selectedEmpleado?.horas_laborales || 44; 
    
    if (!sueldoBase || !horasSemanales || !horas) return 0;

    // Fórmula oficial Dirección del Trabajo
    const valorHoraOrdinaria = (sueldoBase / 30) * 7 / horasSemanales;
    const valorHoraExtra = valorHoraOrdinaria * (1 + (recargo / 100));
    
    return Math.round(valorHoraExtra * horas);
  };
  // ==========================================
  // MANEJADOR PARA GENERAR LIQUIDACIÓN
  // ==========================================
  const generarLiquidacion = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsGeneratingLiq(true);
    try {
      const payload = { 
        empleado: selectedEmpleado?.id,
        mes: liqMes,
        anio: liqAnio,
        dias_trabajados: liqDiasTrabajados,
        dias_ausencia: liqAusencias,
        detalle_haberes_imponibles: haberesImponiblesList,
        detalle_horas_extras: horasExtrasList,
        detalle_haberes_no_imponibles: haberesNoImponiblesList,
        detalle_otros_descuentos: [] 
      };

      const res = await axios.post(`https://jornada40-saas-production.up.railway.app/api/liquidaciones/`, payload, apiConfig);
      setLiquidaciones(prev => [res.data, ...prev]);
      setShowLiqForm(false);
      
      // Limpiamos los formularios para el próximo mes
      setHaberesImponiblesList([]);
      setHorasExtrasList([]);
      setHaberesNoImponiblesList([]);
      setLiqAusencias(0);
      
      alert("¡Liquidación calculada y generada exitosamente!");
    } catch (error) {
      console.error("Error generando liquidación:", error);
      if (axios.isAxiosError(error) && error.response?.data?.error) {
        alert(`Error del Servidor: ${error.response.data.error}`);
      } else {
        alert("Ocurrió un error al calcular la liquidación. Revisa la consola.");
      }
    } finally {
      setIsGeneratingLiq(false);
    }
  };

  // ==========================================
  // FUNCIÓN PARA DESCARGAR LIQUIDACIÓN PDF
  // ==========================================
  const descargarLiquidacionPDF = async (liqId: number, mes: number, anio: number) => {
    try {
      const response = await axios.get(`https://jornada40-saas-production.up.railway.app/api/liquidaciones/${liqId}/generar_pdf/`, { 
        ...apiConfig, responseType: 'blob' 
      });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url; 
      link.setAttribute('download', `Liquidacion_${mes}_${anio}_${selectedEmpleado?.rut}.pdf`);
      document.body.appendChild(link); link.click(); link.parentNode?.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (error) { 
      console.error(error); 
      alert("Error descargando la liquidación. Asegúrate de tener el backend actualizado."); 
    }
  };

  const descargarDocumentoPDF = async (docId: number, tipo: string) => {
    try {
      const response = await axios.get(`https://jornada40-saas-production.up.railway.app/api/documentos_legales/${docId}/generar_pdf/`, { ...apiConfig, responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url; 
      link.setAttribute('download', `${tipo}_${selectedEmpleado?.rut}.pdf`);
      document.body.appendChild(link); link.click(); link.parentNode?.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (error) { 
      console.error(error); 
      alert("Error descargando el documento legal."); 
    }
  };

  // ==========================================
  // FUNCIONES DE DESCARGA PDF DE CONTRATOS
  // ==========================================
  const descargarContratoPDF = async () => {
    try {
      const response = await axios.get(`https://jornada40-saas-production.up.railway.app/api/contratos/${contratoData.id}/generar_contrato_pdf/`, { ...apiConfig, responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url; link.setAttribute('download', `Contrato_${selectedEmpleado?.rut}.pdf`);
      document.body.appendChild(link); link.click(); link.parentNode?.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (error) { console.error(error); alert("Error descargando el contrato."); }
  };

  const descargarAnexoPDF = async () => {
    try {
      const response = await axios.get(`https://jornada40-saas-production.up.railway.app/api/contratos/${contratoData.id}/generar_anexo/`, { ...apiConfig, responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url; link.setAttribute('download', `Anexo_40h_${selectedEmpleado?.rut}.pdf`);
      document.body.appendChild(link); link.click(); link.parentNode?.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (error) { console.error(error); alert("Error descargando el anexo."); }
  };

  const guardarEmpleado = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isValidRut || !formData.nombres || !formData.apellido_paterno) return;
    if (formData.numero_telefono && formData.numero_telefono.length > 0 && formData.numero_telefono.length < 9) {
      alert("El número de teléfono debe tener exactamente 9 dígitos (Ej: 912345678).");
      return; // Detenemos el guardado
    }
    const payload: Record<string, unknown> = { ...formData } as Record<string, unknown>;
    if (payload.numero_telefono) {
      payload.numero_telefono = `+56${payload.numero_telefono}`;
    }
    const camposOpcionales = ['apellido_materno', 'sexo', 'fecha_nacimiento', 'estado_civil', 'direccion', 'comuna', 'numero_telefono', 'departamento', 'sucursal', 'afp', 'sistema_salud', 'nacionalidad'];
    camposOpcionales.forEach(campo => { if (payload[campo] === '') delete payload[campo]; });

    if (payload.empresa) payload.empresa = Number(payload.empresa);
    payload.horas_laborales = Number(payload.horas_laborales || 40);
    payload.sueldo_base = Number(payload.sueldo_base || 0);

    try {
      if (panelMode === 'edit' && selectedEmpleado) {
        await axios.patch(`https://jornada40-saas-production.up.railway.app/api/empleados/${selectedEmpleado.id}/`, payload, apiConfig);
        if (contratoData && contratoData.id) {
          try {
            await axios.patch(`https://jornada40-saas-production.up.railway.app/api/contratos/${contratoData.id}/`, {
              sueldo_base: payload.sueldo_base,
              cargo: payload.cargo
            }, apiConfig);
          } catch (syncError) {
            console.error("No se pudo sincronizar el contrato automáticamente", syncError);
          }
        }
      } else {
        await axios.post('https://jornada40-saas-production.up.railway.app/api/empleados/', payload, apiConfig);
      }
      setIsPanelOpen(false);
      setLoading(true);
      fetchData(); 
    } catch (error) {
      console.error("Error al guardar empleado:", error);
      if (axios.isAxiosError(error)) {
        const errorMsg = error.response?.data ? JSON.stringify(error.response.data, null, 2) : "Error de conexión";
        alert(`Django rechazó la operación:\n\n${errorMsg}`);
      } else {
        alert("Ocurrió un error desconocido al guardar.");
      }
    }
  };

  const generarYDescargarPDF = async (empleado: Empleado) => {
    setDownloadingId(empleado.id);
    try {
      const contratosRes = await axios.get(`https://jornada40-saas-production.up.railway.app/api/contratos/?empleado=${empleado.id}`, apiConfig);
      let contratoId;

      if (!contratosRes.data || contratosRes.data.length === 0) {
        const payloadContrato = {
          empleado: empleado.id,
          tipo_contrato: 'INDEFINIDO',
          fecha_inicio: empleado.fecha_ingreso || new Date().toISOString().split('T')[0],
          sueldo_base: empleado.sueldo_base || 0,
          cargo: empleado.cargo || 'NO ESPECIFICADO'
        };
        const nuevoContratoRes = await axios.post(`https://jornada40-saas-production.up.railway.app/api/contratos/`, payloadContrato, apiConfig);
        contratoId = nuevoContratoRes.data.id;
      } else {
        contratoId = contratosRes.data[0].id;
      }

      const response = await axios.get(`https://jornada40-saas-production.up.railway.app/api/contratos/${contratoId}/generar_anexo/`, {
        ...apiConfig, responseType: 'blob' 
      });

      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `Anexo_40h_${empleado.rut}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.parentNode?.removeChild(link);
      window.URL.revokeObjectURL(url);

    } catch (error) {
      console.error("Error gestionando el contrato o anexo:", error);
      alert("Hubo un problema al generar el documento.");
    } finally {
      setDownloadingId(null);
    }
  };

  if (loading) return <div className="min-h-screen bg-gray-50 flex items-center justify-center"><div className="w-12 h-12 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin"></div></div>;

  return (
    <div className="p-6 md:p-10 bg-gray-50 min-h-screen font-sans flex" onClick={() => setOpenFilterDropdown(null)}>
      <div className={`max-w-7xl mx-auto w-full transition-all duration-300 ${isPanelOpen ? 'md:mr-[450px]' : ''}`}>
        
        <div className="flex justify-between items-center mb-8">
          <button onClick={volverAlLobby} className="text-gray-500 hover:text-gray-900 flex items-center gap-2 font-medium transition-colors">
            <svg fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5"><path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5 3 12m0 0 7.5-7.5M3 12h18" /></svg>
            Cambiar de Empresa
          </button>
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center font-bold">
              {empresa?.nombre_legal?.charAt(0)?.toUpperCase() || 'E'}
            </div>
          </div>
        </div>

        <div className="bg-white p-8 rounded-3xl shadow-sm border border-gray-100 mb-8">
          <h1 className="text-3xl font-bold text-gray-900 tracking-tight">{empresa?.nombre_legal}</h1>
          <div className="flex gap-4 mt-3 text-sm text-gray-500 font-medium">
            <span className="bg-gray-100 px-3 py-1 rounded-lg">RUT: {empresa?.rut}</span>
            {empresa?.giro && <span className="bg-gray-100 px-3 py-1 rounded-lg">Giro: {empresa.giro}</span>}
          </div>
        </div>

        {/* ========================================== */}
        {/* WIDGETS DE ESTADÍSTICAS (INTERACTIVOS)     */}
        {/* ========================================== */}
        {stats && (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6 mb-8 animate-in slide-in-from-bottom-4 fade-in duration-500">
            
            {/* WIDGET A: Total Trabajadores */}
            <div className="relative bg-white rounded-2xl p-6 border border-slate-200 shadow-sm min-h-[140px] flex flex-col justify-center">
              <button onClick={() => toggleWidget('w_total')} className="absolute top-4 right-4 p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors z-10">
                {flippedWidgets['w_total'] ? <Undo2 className="w-4 h-4" /> : <BarChart2 className="w-4 h-4" />}
              </button>

              {!flippedWidgets['w_total'] ? (
                <div className="flex items-center gap-4 animate-in fade-in zoom-in-95 duration-300">
                  <div className="w-14 h-14 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center shrink-0">
                    <Users className="w-7 h-7" />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-slate-500">Total Trabajadores</p>
                    <h4 className="text-2xl font-extrabold text-slate-900">{stats.total}</h4>
                    {stats.inactivos > 0 && <p className="text-xs font-bold text-slate-400 mt-1">{stats.inactivos} inactivos</p>}
                  </div>
                </div>
              ) : (
                <div className="h-full w-full pt-4 animate-in fade-in zoom-in-95 duration-300">
                  <ResponsiveContainer width="100%" height={80}>
                    <BarChart data={stats.chartTotal}>
                      <Tooltip cursor={{fill: 'transparent'}} />
                      <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fontSize: 10}} />
                      <Bar dataKey="valor" radius={[4, 4, 0, 0]} maxBarSize={40}>
                        {stats.chartTotal.map((entry, index) => (<Cell key={`cell-${index}`} fill={entry.color} />))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>

            {/* WIDGET B: Distribución de Género */}
            <div className="relative bg-white rounded-2xl p-6 border border-slate-200 shadow-sm min-h-[140px] flex flex-col justify-center">
              <button onClick={() => toggleWidget('w_genero')} className="absolute top-4 right-4 p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors z-10">
                {flippedWidgets['w_genero'] ? <Undo2 className="w-4 h-4" /> : <BarChart2 className="w-4 h-4" />}
              </button>

              {!flippedWidgets['w_genero'] ? (
                <div className="flex items-center gap-4 animate-in fade-in zoom-in-95 duration-300">
                  <div className="w-14 h-14 bg-fuchsia-50 text-fuchsia-500 rounded-xl flex items-center justify-center shrink-0">
                    <Users className="w-7 h-7" />
                  </div>
                  <div className="w-full pr-6">
                    <p className="text-sm font-bold text-slate-500 mb-1">Distribución Género</p>
                    <div className="flex justify-between items-center w-full">
                      <span className="text-sm font-extrabold text-slate-900">{stats.mujeres} <span className="text-xs text-slate-400 font-normal">Muj.</span></span>
                      <span className="text-sm font-extrabold text-slate-900">{stats.hombres} <span className="text-xs text-slate-400 font-normal">Hom.</span></span>
                    </div>
                    {/* Mini barra de progreso rápida */}
                    <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden flex mt-2">
                      <div style={{ width: `${(stats.mujeres / stats.total) * 100}%` }} className="bg-fuchsia-400 h-full"></div>
                      <div style={{ width: `${(stats.hombres / stats.total) * 100}%` }} className="bg-blue-400 h-full"></div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="h-full w-full pt-4 animate-in fade-in zoom-in-95 duration-300">
                  <ResponsiveContainer width="100%" height={80}>
                    <BarChart data={stats.chartGenero}>
                      <Tooltip cursor={{fill: 'transparent'}} />
                      <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fontSize: 10}} />
                      <Bar dataKey="valor" radius={[4, 4, 0, 0]} maxBarSize={40}>
                        {stats.chartGenero.map((entry, index) => (<Cell key={`cell-${index}`} fill={entry.color} />))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>

            {/* WIDGET C: Modalidad de Trabajo */}
            <div className="relative bg-white rounded-2xl p-6 border border-slate-200 shadow-sm min-h-[140px] flex flex-col justify-center">
              <button onClick={() => toggleWidget('w_modalidad')} className="absolute top-4 right-4 p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors z-10">
                {flippedWidgets['w_modalidad'] ? <Undo2 className="w-4 h-4" /> : <BarChart2 className="w-4 h-4" />}
              </button>

              {!flippedWidgets['w_modalidad'] ? (
                <div className="flex items-center gap-4 animate-in fade-in zoom-in-95 duration-300">
                  <div className="w-14 h-14 bg-emerald-50 text-emerald-500 rounded-xl flex items-center justify-center shrink-0">
                    {/* Asegúrate de tener importado el ícono Laptop de lucide-react */}
                    <Laptop className="w-7 h-7" />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-slate-500">Teletrabajo</p>
                    <h4 className="text-2xl font-extrabold text-slate-900">
                      {stats.teletrabajo} <span className="text-sm font-medium text-slate-400">/ {stats.presencial} Ofi.</span>
                    </h4>
                  </div>
                </div>
              ) : (
                <div className="h-full w-full pt-4 animate-in fade-in zoom-in-95 duration-300">
                  <ResponsiveContainer width="100%" height={80}>
                    <BarChart data={stats.chartModalidad}>
                      <Tooltip cursor={{fill: 'transparent'}} />
                      <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fontSize: 10}} />
                      <Bar dataKey="valor" radius={[4, 4, 0, 0]} maxBarSize={40}>
                        {stats.chartModalidad.map((entry, index) => (<Cell key={`cell-${index}`} fill={entry.color} />))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>

            {/* WIDGET 1: Jornada */}
            <div className={`relative bg-white rounded-2xl p-6 border ${stats.jornadaMayor > 0 ? 'border-amber-200' : 'border-slate-200'} shadow-sm min-h-[140px] flex flex-col justify-center`}>
              <button onClick={() => toggleWidget('w1')} className="absolute top-4 right-4 p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors z-10">
                {flippedWidgets['w1'] ? <Undo2 className="w-4 h-4" /> : <BarChart2 className="w-4 h-4" />}
              </button>
              
              {!flippedWidgets['w1'] ? (
                <div className="flex items-center gap-4 animate-in fade-in zoom-in-95 duration-300">
                  <div className={`w-14 h-14 rounded-xl flex items-center justify-center shrink-0 ${stats.jornadaMayor > 0 ? 'bg-amber-50 text-amber-500' : 'bg-emerald-50 text-emerald-500'}`}>
                    <Clock className="w-7 h-7" />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-slate-500">Transición 40 Horas</p>
                    <h4 className="text-2xl font-extrabold text-slate-900">{stats.jornada40} <span className="text-sm font-medium text-slate-400">listos</span></h4>
                    {stats.jornadaMayor > 0 && <p className="text-xs font-bold text-amber-600 mt-1">Faltan {stats.jornadaMayor}</p>}
                  </div>
                </div>
              ) : (
                <div className="h-full w-full pt-4 animate-in fade-in zoom-in-95 duration-300">
                  <ResponsiveContainer width="100%" height={80}>
                    <BarChart data={stats.chartJornada}>
                      <Tooltip cursor={{fill: 'transparent'}} />
                      <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fontSize: 10}} />
                      <Bar dataKey="valor" radius={[4, 4, 0, 0]} maxBarSize={40}>
                        {stats.chartJornada.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>

            {/* WIDGET 2: Extranjería */}
            <div className={`relative bg-white rounded-2xl p-6 border ${stats.pctExtranjeros > 15 ? 'border-red-200' : 'border-slate-200'} shadow-sm min-h-[140px] flex flex-col justify-center`}>
              <button onClick={() => toggleWidget('w2')} className="absolute top-4 right-4 p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors z-10">
                {flippedWidgets['w2'] ? <Undo2 className="w-4 h-4" /> : <BarChart2 className="w-4 h-4" />}
              </button>

              {!flippedWidgets['w2'] ? (
                <div className="flex items-center gap-4 animate-in fade-in zoom-in-95 duration-300">
                  <div className={`w-14 h-14 rounded-xl flex items-center justify-center shrink-0 ${stats.pctExtranjeros > 15 ? 'bg-red-50 text-red-500' : 'bg-blue-50 text-blue-500'}`}>
                    <Globe className="w-7 h-7" />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-slate-500">Cuota Extranjería</p>
                    <h4 className="text-2xl font-extrabold text-slate-900">{stats.extranjeros} <span className="text-sm font-medium text-slate-400">extranjeros</span></h4>
                    <p className={`text-xs font-bold mt-1 ${stats.pctExtranjeros > 15 ? 'text-red-600' : 'text-slate-400'}`}>{stats.pctExtranjeros.toFixed(1)}% (Límite 15%)</p>
                  </div>
                </div>
              ) : (
                <div className="h-full w-full pt-4 animate-in fade-in zoom-in-95 duration-300">
                  <ResponsiveContainer width="100%" height={80}>
                    <BarChart data={stats.chartNacionalidad}>
                      <Tooltip cursor={{fill: 'transparent'}} />
                      <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fontSize: 10}} />
                      <Bar dataKey="valor" radius={[4, 4, 0, 0]} maxBarSize={40}>
                        {stats.chartNacionalidad.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>

            {/* WIDGET 3: Costos por Departamento */}
            <div className="relative bg-white rounded-2xl p-6 border border-slate-200 shadow-sm min-h-[140px] flex flex-col justify-center">
              <button onClick={() => toggleWidget('w3')} className="absolute top-4 right-4 p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors z-10">
                {flippedWidgets['w3'] ? <Undo2 className="w-4 h-4" /> : <BarChart2 className="w-4 h-4" />}
              </button>

              {!flippedWidgets['w3'] ? (
                <div className="flex items-center gap-4 animate-in fade-in zoom-in-95 duration-300">
                  <div className="w-14 h-14 bg-emerald-50 text-emerald-600 rounded-xl flex items-center justify-center shrink-0">
                    <CircleDollarSign className="w-7 h-7" />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-slate-500">Masa Salarial Total</p>
                    <h4 className="text-2xl font-extrabold text-slate-900">${stats.masaSalarial.toLocaleString('es-CL')}</h4>
                  </div>
                </div>
              ) : (
                <div className="h-full w-full pt-4 animate-in fade-in zoom-in-95 duration-300">
                  <ResponsiveContainer width="100%" height={80}>
                    <BarChart data={stats.chartCentros}>
                      <Tooltip cursor={{fill: 'transparent'}} formatter={(value) => `$${Number(value || 0).toLocaleString('es-CL')}`} />
                      <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fontSize: 8}} />
                      <Bar dataKey="valor" fill="#10b981" radius={[4, 4, 0, 0]} maxBarSize={30} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>

            {/* WIDGET 4: Mayor Centro de Costo (Aprovechamos el mismo gráfico detallado) */}
            <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm min-h-[140px] flex items-center gap-4">
              <div className="w-14 h-14 bg-indigo-50 text-indigo-500 rounded-xl flex items-center justify-center shrink-0">
                <Building2 className="w-7 h-7" />
              </div>
              <div className="overflow-hidden">
                <p className="text-sm font-bold text-slate-500 truncate">Mayor Centro de Costo</p>
                <h4 className="text-lg font-extrabold text-slate-900 truncate" title={stats.topCentro.name}>{stats.topCentro.name}</h4>
                <p className="text-xs text-indigo-600 font-bold mt-1">${(stats.topCentro.valor as number).toLocaleString('es-CL')}</p>
              </div>
            </div>

            {/* WIDGET 5: Generaciones */}
            <div className="relative bg-white rounded-2xl p-6 border border-slate-200 shadow-sm min-h-[140px] flex flex-col justify-center">
              <button onClick={() => toggleWidget('w5')} className="absolute top-4 right-4 p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors z-10">
                {flippedWidgets['w5'] ? <Undo2 className="w-4 h-4" /> : <BarChart2 className="w-4 h-4" />}
              </button>

              {!flippedWidgets['w5'] ? (
                <div className="flex items-center gap-4 animate-in fade-in zoom-in-95 duration-300">
                  <div className="w-14 h-14 bg-fuchsia-50 text-fuchsia-500 rounded-xl flex items-center justify-center shrink-0">
                    <Users className="w-7 h-7" />
                  </div>
                  <div className="w-full pr-6">
                    <p className="text-sm font-bold text-slate-500 mb-1">Generaciones</p>
                    <div className="flex justify-between items-end text-center w-full">
                      <div><div className="text-lg font-extrabold text-slate-900">{stats.menores30}</div><div className="text-[10px] font-bold text-slate-400">{'< 30'}</div></div>
                      <div><div className="text-lg font-extrabold text-slate-900">{stats.entre30y50}</div><div className="text-[10px] font-bold text-slate-400">30-50</div></div>
                      <div><div className="text-lg font-extrabold text-slate-900">{stats.mayores50}</div><div className="text-[10px] font-bold text-slate-400">{'> 50'}</div></div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="h-full w-full pt-4 animate-in fade-in zoom-in-95 duration-300">
                  <ResponsiveContainer width="100%" height={80}>
                    <BarChart data={stats.chartGeneraciones}>
                      <Tooltip cursor={{fill: 'transparent'}} />
                      <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fontSize: 10}} />
                      <Bar dataKey="valor" radius={[4, 4, 0, 0]} maxBarSize={40}>
                        {stats.chartGeneraciones.map((entry, index) => (<Cell key={`cell-${index}`} fill={entry.color} />))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>

            {/* WIDGET 6: Bancarización */}
            <div className="relative bg-white rounded-2xl p-6 border border-slate-200 shadow-sm min-h-[140px] flex flex-col justify-center">
              <button onClick={() => toggleWidget('w6')} className="absolute top-4 right-4 p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors z-10">
                {flippedWidgets['w6'] ? <Undo2 className="w-4 h-4" /> : <BarChart2 className="w-4 h-4" />}
              </button>

              {!flippedWidgets['w6'] ? (
                <div className="flex items-center gap-4 animate-in fade-in zoom-in-95 duration-300">
                  <div className="w-14 h-14 bg-cyan-50 text-cyan-500 rounded-xl flex items-center justify-center shrink-0">
                    <Landmark className="w-7 h-7" />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-slate-500">Bancarización (Pagos)</p>
                    <h4 className="text-2xl font-extrabold text-slate-900">{stats.bancarizados} <span className="text-sm font-medium text-slate-400">digital</span></h4>
                    {stats.noBancarizados > 0 && <p className="text-xs font-bold text-amber-500 mt-1">{stats.noBancarizados} pagos manuales</p>}
                  </div>
                </div>
              ) : (
                <div className="h-full w-full pt-4 animate-in fade-in zoom-in-95 duration-300">
                  <ResponsiveContainer width="100%" height={80}>
                    <BarChart data={stats.chartBancos}>
                      <Tooltip cursor={{fill: 'transparent'}} />
                      <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fontSize: 10}} />
                      <Bar dataKey="valor" radius={[4, 4, 0, 0]} maxBarSize={40}>
                        {stats.chartBancos.map((entry, index) => (<Cell key={`cell-${index}`} fill={entry.color} />))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>

          </div>
        )}

        

        <div className="bg-white p-8 rounded-3xl shadow-sm border border-gray-100 min-h-[500px]">
          
          <div className="flex flex-col md:flex-row justify-between items-center mb-6 gap-4">
            <div>
              <h2 className="text-xl font-bold text-gray-900">Directorio de Empleados</h2>
              <p className="text-sm text-gray-500 mt-1">Mostrando {filteredEmpleados?.length || 0} de {empleados?.length || 0}</p>
            </div>

            <div className="relative w-full md:w-64">
                <input 
                  type="text" 
                  placeholder="Buscar rut, nombre, ciudad..." 
                  className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
                <svg fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" className="w-5 h-5 absolute left-3 top-2.5 text-gray-400">
                  <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
                </svg>
            </div>

            {/* ========================================== */}
        {/* PANEL DE ACCIONES MASIVAS                  */}
        {/* ========================================== */}
        {selectedEmpleadosIds.length > 0 && (
          <div className="bg-slate-900 rounded-2xl p-4 mb-6 shadow-lg flex flex-col sm:flex-row items-center justify-between gap-4 animate-in slide-in-from-top-4 fade-in duration-300">
            <div className="flex items-center gap-3">
              <div className="bg-blue-500/20 text-blue-400 px-3 py-1.5 rounded-lg font-bold flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5" />
                {selectedEmpleadosIds.length} seleccionados
              </div>
              <span className="text-slate-300 text-sm font-medium">¿Qué deseas generar?</span>
            </div>

            <div className="relative">
              <button 
                onClick={() => setIsDownloadMenuOpen(!isDownloadMenuOpen)}
                disabled={isDownloading}
                className="bg-blue-600 hover:bg-blue-500 text-white px-5 py-2.5 rounded-xl font-bold flex items-center gap-2 transition-all disabled:opacity-50"
              >
                {isDownloading ? (
                  <span className="animate-pulse">Generando documentos...</span>
                ) : (
                  <>
                    <Download className="w-5 h-5" />
                    Descarga Masiva
                    <ChevronDown className={`w-4 h-4 transition-transform ${isDownloadMenuOpen ? 'rotate-180' : ''}`} />
                  </>
                )}
              </button>

              {isDownloadMenuOpen && (
                <div className="absolute right-0 top-full mt-2 w-72 bg-white rounded-xl shadow-2xl border border-slate-200 overflow-hidden z-50 animate-in fade-in zoom-in-95">
                  <div className="p-2 space-y-1">
                    <button onClick={() => ejecutarDescargaMasiva('contratos')} className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-slate-50 text-slate-700 rounded-lg text-left text-sm font-bold">
                      <Briefcase className="w-5 h-5 text-indigo-500" /> Contratos de Trabajo
                    </button>
                    <button onClick={() => ejecutarDescargaMasiva('anexos')} className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-slate-50 text-slate-700 rounded-lg text-left text-sm font-bold">
                      <FileSignature className="w-5 h-5 text-emerald-500" /> Anexos 40 Horas
                    </button>
                    <div className="h-px bg-slate-100 my-2"></div>
                    <button onClick={() => ejecutarDescargaMasiva('liq_actual')} className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-slate-50 text-slate-700 rounded-lg text-left text-sm font-bold">
                      <FileText className="w-5 h-5 text-blue-500" /> Liquidación (Mes Actual)
                    </button>
                    <button onClick={() => ejecutarDescargaMasiva('liq_12')} className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-slate-50 text-slate-700 rounded-lg text-left text-sm font-bold">
                      <Layers className="w-5 h-5 text-blue-600" /> Últimas 12 Liquidaciones
                    </button>
                    <div className="h-px bg-slate-100 my-2"></div>
                    <button onClick={() => ejecutarDescargaMasiva('amonestacion')} className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-slate-50 text-slate-700 rounded-lg text-left text-sm font-bold">
                      <AlertTriangle className="w-5 h-5 text-amber-500" /> Carta de Amonestación
                    </button>
                    <button onClick={() => ejecutarDescargaMasiva('zip_completo')} className="w-full flex items-center gap-3 px-3 py-2.5 bg-slate-50 hover:bg-slate-900 hover:text-white text-slate-900 rounded-lg text-left text-sm font-bold transition-colors">
                      <FolderArchive className="w-5 h-5" /> Expediente Completo (ZIP)
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
            
            <div className="flex flex-wrap gap-3 items-center">
                
                <button 
                  onClick={() => setIsUploadModalOpen(true)}
                  className="flex items-center gap-2 px-4 py-2.5 bg-white border border-slate-200 text-slate-700 font-bold rounded-xl hover:bg-slate-50 transition-colors shadow-sm"
                >
                  <FileSpreadsheet className="w-5 h-5 text-emerald-600" />
                  <span className="hidden sm:inline">Carga Masiva</span>
                </button>

                <button type="button" onClick={() => setIsModalMasivoOpen(true)} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition text-sm font-medium flex items-center gap-2">
                  <svg fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor" className="w-4 h-4"><path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12.75V12A2.25 2.25 0 0 1 4.5 9.75h15A2.25 2.25 0 0 1 21.75 12v.75m-8.69-6.44-2.12-2.12a1.5 1.5 0 0 0-1.061-.44H4.5A2.25 2.25 0 0 0 2.25 6v12a2.25 2.25 0 0 0 2.25 2.25h15A2.25 2.25 0 0 0 21.75 18V9a2.25 2.25 0 0 0-2.25-2.25h-5.379a1.5 1.5 0 0 1-1.06-.44Z" /></svg>
                  Descarga Masiva Anexo 40h
                </button>

                <button type="button" onClick={abrirCrear} className="px-4 py-2 bg-gray-900 text-white rounded-lg hover:bg-gray-800 transition text-sm font-medium flex items-center gap-2">
                  <svg fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor" className="w-4 h-4"><path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" /></svg>
                  Nuevo Empleado
                </button>
            </div>
          </div>

          {empleados?.length === 0 ? (
            <div className="text-center py-16 border-2 border-dashed border-gray-200 rounded-2xl">
              <p className="text-gray-500 font-medium mb-4">Aún no tienes empleados en esta empresa.</p>
            </div>
          ) : (
            <div className="overflow-x-visible pb-20">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b-2 border-gray-100">
                    <th className="px-6 py-4 text-left w-10">
                      <input 
                        type="checkbox" 
                        className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                        onChange={handleSelectAll}
                        checked={selectedEmpleadosIds.length === filteredEmpleados.length && filteredEmpleados.length > 0}
                      />
                    </th>
                    <th className="p-4 text-sm font-semibold text-gray-400 uppercase">RUT</th>
                    <th className="p-4 text-sm font-semibold text-gray-400 uppercase">Nombre Completo</th>
                    <th className="px-6 py-4 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Email</th>
                    
                    <th className="p-4 text-sm font-semibold text-gray-400 uppercase relative">
                      <button onClick={(e) => { e.stopPropagation(); setOpenFilterDropdown(openFilterDropdown === 'depto' ? null : 'depto'); }} className="flex items-center gap-1 hover:text-gray-600 outline-none">
                        DEPARTAMENTO
                        <svg fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor" className={`w-4 h-4 transition-transform ${openFilterDropdown === 'depto' ? 'rotate-180' : ''}`}><path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" /></svg>
                      </button>
                      {openFilterDropdown === 'depto' && (
                        <div onClick={(e) => e.stopPropagation()} className="absolute top-12 left-0 w-64 bg-white border border-gray-100 shadow-xl rounded-xl p-3 z-50 max-h-64 overflow-y-auto">
                           <label className="flex items-center p-2 hover:bg-gray-50 rounded cursor-pointer border-b mb-1">
                             <input type="checkbox" checked={selectedDeptos.length === allDeptos.length} onChange={() => toggleSelectAll(allDeptos, selectedDeptos, setSelectedDeptos)} className="w-4 h-4 text-blue-600 rounded" />
                             <span className="ml-3 font-semibold text-gray-900">Seleccionar todos</span>
                           </label>
                           {allDeptos.map(depto => (
                             <label key={depto} className="flex items-center p-2 hover:bg-gray-50 rounded cursor-pointer">
                               <input type="checkbox" checked={selectedDeptos.includes(depto)} onChange={() => toggleArrayItem(selectedDeptos, setSelectedDeptos, depto)} className="w-4 h-4 text-blue-600 rounded" />
                               <span className="ml-3 text-gray-700 capitalize">{depto.toLowerCase()}</span>
                             </label>
                           ))}
                        </div>
                      )}
                    </th>

                    <th className="p-4 text-sm font-semibold text-gray-400 uppercase relative">
                      <button onClick={(e) => { e.stopPropagation(); setOpenFilterDropdown(openFilterDropdown === 'cargo' ? null : 'cargo'); }} className="flex items-center gap-1 hover:text-gray-600 outline-none">
                        CARGO
                        <svg fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor" className={`w-4 h-4 transition-transform ${openFilterDropdown === 'cargo' ? 'rotate-180' : ''}`}><path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" /></svg>
                      </button>
                      {openFilterDropdown === 'cargo' && (
                        <div onClick={(e) => e.stopPropagation()} className="absolute top-12 left-0 w-64 bg-white border border-gray-100 shadow-xl rounded-xl p-3 z-50 max-h-64 overflow-y-auto">
                           <label className="flex items-center p-2 hover:bg-gray-50 rounded cursor-pointer border-b mb-1">
                             <input type="checkbox" checked={selectedCargos.length === allCargos.length} onChange={() => toggleSelectAll(allCargos, selectedCargos, setSelectedCargos)} className="w-4 h-4 text-blue-600 rounded" />
                             <span className="ml-3 font-semibold text-gray-900">Seleccionar todos</span>
                           </label>
                           {allCargos.map(cargo => (
                             <label key={cargo} className="flex items-center p-2 hover:bg-gray-50 rounded cursor-pointer">
                               <input type="checkbox" checked={selectedCargos.includes(cargo)} onChange={() => toggleArrayItem(selectedCargos, setSelectedCargos, cargo)} className="w-4 h-4 text-blue-600 rounded" />
                               <span className="ml-3 text-gray-700 capitalize">{cargo.toLowerCase()}</span>
                             </label>
                           ))}
                        </div>
                      )}
                    </th>

                    <th className="p-4 text-sm font-semibold text-gray-400 uppercase relative">
                      <button onClick={(e) => { e.stopPropagation(); setOpenFilterDropdown(openFilterDropdown === 'estado' ? null : 'estado'); }} className="flex items-center gap-1 hover:text-gray-600 outline-none">
                        ESTADO
                        <svg fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor" className={`w-4 h-4 transition-transform ${openFilterDropdown === 'estado' ? 'rotate-180' : ''}`}><path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" /></svg>
                      </button>
                      {openFilterDropdown === 'estado' && (
                        <div onClick={(e) => e.stopPropagation()} className="absolute top-12 left-0 w-56 bg-white border border-gray-100 shadow-xl rounded-xl p-3 z-50">
                           <label className="flex items-center p-2 hover:bg-gray-50 rounded cursor-pointer">
                             <input type="checkbox" checked={selectedStatuses.includes(true)} onChange={() => toggleArrayItem(selectedStatuses, setSelectedStatuses, true)} className="w-4 h-4 text-blue-600 rounded" />
                             <span className="ml-3 text-green-700 font-medium">Vigentes</span>
                           </label>
                           <label className="flex items-center p-2 hover:bg-gray-50 rounded cursor-pointer">
                             <input type="checkbox" checked={selectedStatuses.includes(false)} onChange={() => toggleArrayItem(selectedStatuses, setSelectedStatuses, false)} className="w-4 h-4 text-blue-600 rounded" />
                             <span className="ml-3 text-red-700 font-medium">Desvinculados</span>
                           </label>
                        </div>
                      )}
                    </th>

                    <th className="p-4 text-sm font-semibold text-gray-400 uppercase text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredEmpleados?.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="text-center py-12 text-gray-500 font-medium">No se encontraron trabajadores con los filtros aplicados.</td>
                    </tr>
                  ) : (
                    filteredEmpleados.map((emp) => (
                      <tr key={emp.id} className={`border-b border-gray-50 transition-colors group ${!emp.activo ? 'bg-gray-50/70 opacity-80' : 'hover:bg-gray-50/50'}`}>
                        <td className="px-6 py-4"><input type="checkbox" className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"checked={selectedEmpleadosIds.includes(emp.id)}onChange={() => handleSelectEmpleado(emp.id)}onClick={(e) => e.stopPropagation()} /></td>
                        <td className="p-4 font-mono text-sm text-gray-600">{emp.rut}</td>
                        <td className="p-4 font-medium text-gray-900">{emp.nombres} {emp.apellido_paterno}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600">{emp.email || '---'}</td>
                        <td className="p-4 text-gray-600 capitalize">{emp.departamento?.toLowerCase() || 'No especificado'}</td>
                        <td className="p-4 text-gray-600 capitalize">{emp.cargo.toLowerCase()}</td>
                        <td className="p-4">
                          <span className={`px-3 py-1 rounded-full text-xs font-semibold ${emp.activo ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                            {emp.activo ? 'Vigente' : 'Desvinculado'}
                          </span>
                        </td>
                        <td className="p-4 text-right flex justify-end gap-3">
                          <button onClick={(e) => { e.stopPropagation(); generarYDescargarPDF(emp); }} disabled={downloadingId === emp.id || !emp.activo} className={`p-2 rounded-lg transition-colors ${!emp.activo ? 'text-gray-300 cursor-not-allowed' : 'text-gray-400 hover:text-green-600 hover:bg-green-50'}`} title={emp.activo ? "Descargar Anexo" : "No disponible para inactivos"}>
                            {downloadingId === emp.id ? (
                              <div className="w-5 h-5 border-2 border-green-600 border-t-transparent rounded-full animate-spin"></div>
                            ) : (
                              <svg fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" className="w-5 h-5"><path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3" /></svg>
                            )}
                         </button>
                        <button onClick={(e) => { e.stopPropagation(); abrirVer(emp); }} className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors" title="Ver Perfil">
                           <svg fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" className="w-5 h-5"><path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 0 1 0-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178Z" /><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" /></svg>
                        </button>
                        <button onClick={(e) => { e.stopPropagation(); abrirEditar(emp); }} className="p-2 text-gray-400 hover:text-orange-500 hover:bg-orange-50 rounded-lg transition-colors" title="Editar Trabajador">
                          <svg fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" className="w-5 h-5"><path strokeLinecap="round" strokeLinejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0 1 15.75 21H5.25A2.25 2.25 0 0 1 3 18.75V8.25A2.25 2.25 0 0 1 5.25 6H10" /></svg>
                        </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* === SLIDE-OVER PANEL LATERAL === */}
      {isPanelOpen && (
        <div className="fixed inset-0 z-40 overflow-hidden">
          <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm transition-opacity" onClick={(e) => { e.stopPropagation(); setIsPanelOpen(false); }}></div>
          
          <div className="absolute inset-y-0 right-0 max-w-4xl w-full flex shadow-2xl">
            <div className="h-full w-full bg-white flex flex-col transform transition-transform duration-300" onClick={(e) => e.stopPropagation()}>
              
              {/* HEADER DEL PANEL */}
              <div className="px-8 py-6 border-b border-gray-200 flex items-start justify-between bg-white">
                <div className="flex items-center gap-5">
                  {panelMode !== 'create' && selectedEmpleado ? (
                    <div className="w-16 h-16 bg-slate-800 text-white rounded-2xl flex items-center justify-center text-2xl font-bold shadow-sm">
                      {selectedEmpleado.nombres?.charAt(0) || ''}{selectedEmpleado.apellido_paterno?.charAt(0) || ''}
                    </div>
                  ) : (
                    <div className="w-16 h-16 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center text-2xl font-bold shadow-sm">
                      +
                    </div>
                  )}
                  <div>
                    <h2 className="text-2xl font-bold text-slate-900 tracking-tight">
                      {panelMode === 'create' ? 'Nuevo Trabajador' : `${selectedEmpleado?.nombres} ${selectedEmpleado?.apellido_paterno}`}
                    </h2>
                    {panelMode !== 'create' && selectedEmpleado && (
                      <div className="flex items-center gap-3 mt-1.5">
                        <span className="text-slate-500 font-medium">{selectedEmpleado.cargo}</span>
                        <span className="text-slate-300">•</span>
                        <span className="text-slate-500 font-mono text-sm">{selectedEmpleado.rut}</span>
                        <span className={`px-2.5 py-0.5 rounded-md text-xs font-semibold tracking-wide ${selectedEmpleado.activo ? 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-600/20' : 'bg-rose-50 text-rose-700 ring-1 ring-rose-600/20'}`}>
                          {selectedEmpleado.activo ? 'VIGENTE' : 'DESVINCULADO'}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
                
                <div className="flex items-center gap-2">
                  {panelMode === 'view' && selectedEmpleado && (
                    <button onClick={() => {setFormData({ ...selectedEmpleado });
                      setIsValidRut (true);
                      setPanelMode('edit');}
                     } className="px-4 py-2 text-sm font-semibold text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded-lg transition-colors shadow-sm flex items-center gap-2">
                      <svg fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor" className="w-4 h-4"><path strokeLinecap="round" strokeLinejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0 1 15.75 21H5.25A2.25 2.25 0 0 1 3 18.75V8.25A2.25 2.25 0 0 1 5.25 6H10" /></svg>
                      Editar Ficha
                    </button>
                  )}
                  <button onClick={() => setIsPanelOpen(false)} className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors">
                    <svg fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor" className="w-6 h-6"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" /></svg>
                  </button>
                </div>
              </div>

              {/* SISTEMA DE PESTAÑAS (TABS) */}
              {panelMode !== 'create' && (
                <div className="px-8 border-b border-gray-200 bg-slate-50/50">
                  <nav className="flex gap-6 -mb-px">
                    {[
                      { id: 'perfil', label: 'Datos Generales' },
                      { id: 'contratos', label: 'Contratos y Anexos' },
                      { id: 'liquidaciones', label: 'Liquidaciones' },
                      { id: 'legal', label: 'Historial Legal' },
                    ].map((tab) => (
                      <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id as 'perfil' | 'contratos' | 'liquidaciones' | 'legal')}
                        className={`py-4 px-1 border-b-2 font-medium text-sm whitespace-nowrap transition-colors ${
                          activeTab === tab.id
                            ? 'border-blue-600 text-blue-600'
                            : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
                        }`}
                      >
                        {tab.label}
                      </button>
                    ))}
                  </nav>
                </div>
              )}

              {/* BODY DEL PANEL */}
              <div className="flex-1 overflow-y-auto p-8 bg-slate-50/30">
                
                {activeTab === 'perfil' && (
                  <>
                    {panelMode === 'view' && selectedEmpleado ? (
                      <div className="grid grid-cols-2 gap-10">
                        <div className="space-y-6">
                          <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest border-b border-slate-200 pb-2">Información Personal</h4>
                          <dl className="space-y-4 text-sm">
                            <div className="grid grid-cols-3 gap-4"><dt className="text-slate-500 font-medium">Nacionalidad</dt><dd className="col-span-2 font-semibold text-slate-900 capitalize">{selectedEmpleado.nacionalidad?.toLowerCase() || '-'}</dd></div>
                            <div className="grid grid-cols-3 gap-4"><dt className="text-slate-500 font-medium">Fecha Nac.</dt><dd className="col-span-2 font-semibold text-slate-900">{selectedEmpleado.fecha_nacimiento || '-'}</dd></div>
                            <div className="grid grid-cols-3 gap-4"><dt className="text-slate-500 font-medium">Estado Civil</dt><dd className="col-span-2 font-semibold text-slate-900 capitalize">{selectedEmpleado.estado_civil?.toLowerCase() || '-'}</dd></div>
                            <div className="grid grid-cols-3 gap-4"><dt className="text-slate-500 font-medium">Teléfono</dt><dd className="col-span-2 font-semibold text-slate-900">{selectedEmpleado.numero_telefono || '-'}</dd></div>
                            <div className="grid grid-cols-3 gap-4"><dt className="text-slate-500 font-medium">Email</dt><dd className="col-span-2 font-semibold text-slate-900 capitalize">{selectedEmpleado.email?.toLowerCase() || '-'}</dd></div>
                            <div className="grid grid-cols-3 gap-4"><dt className="text-slate-500 font-medium">Comuna</dt><dd className="col-span-2 font-semibold text-slate-900 capitalize">{selectedEmpleado.comuna?.toLowerCase() || '-'}</dd></div>
                            <div className="grid grid-cols-3 gap-4"><dt className="text-slate-500 font-medium">Dirección</dt><dd className="col-span-2 font-semibold text-slate-900 capitalize">{selectedEmpleado.direccion?.toLowerCase() || '-'}</dd></div>
                          </dl>
                        </div>

                        <div className="space-y-6">
                          <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest border-b border-slate-200 pb-2">Condiciones Laborales</h4>
                          <dl className="space-y-4 text-sm">
                            <div className="grid grid-cols-3 gap-4"><dt className="text-slate-500 font-medium">Departamento</dt><dd className="col-span-2 font-semibold text-slate-900 capitalize">{selectedEmpleado.departamento?.toLowerCase() || '-'}</dd></div>
                            <div className="grid grid-cols-3 gap-4"><dt className="text-slate-500 font-medium">Centro de Costo</dt><dd className="col-span-2 font-semibold text-slate-900">{selectedEmpleado.centro_costo || '-'}</dd></div>
                            <div className="grid grid-cols-3 gap-4"><dt className="text-slate-500 font-medium">Ficha N°</dt><dd className="col-span-2 font-semibold text-slate-900">{selectedEmpleado.ficha_numero || '-'}</dd></div>
                            <div className="grid grid-cols-3 gap-4"><dt className="text-slate-500 font-medium">Sucursal</dt><dd className="col-span-2 font-semibold text-slate-900 capitalize">{selectedEmpleado.sucursal?.toLowerCase() || '-'}</dd></div>
                            <div className="grid grid-cols-3 gap-4"><dt className="text-slate-500 font-medium">Fecha Ingreso</dt><dd className="col-span-2 font-semibold text-slate-900">{selectedEmpleado.fecha_ingreso || '-'}</dd></div>
                            <div className="grid grid-cols-3 gap-4"><dt className="text-slate-500 font-medium">Modalidad</dt><dd className="col-span-2 font-semibold text-slate-900 capitalize">{selectedEmpleado.modalidad?.toLowerCase() || '-'}</dd></div>
                            <div className="grid grid-cols-3 gap-4"><dt className="text-slate-500 font-medium">Jornada</dt><dd className="col-span-2 font-semibold text-slate-900">{selectedEmpleado.horas_laborales} Hrs.</dd></div>
                            <div className="grid grid-cols-3 gap-4"><dt className="text-slate-500 font-medium">Sueldo Base</dt><dd className="col-span-2 font-semibold text-slate-900">${Number(selectedEmpleado.sueldo_base || 0).toLocaleString('es-CL')}</dd></div>
                            <div className="grid grid-cols-3 gap-4"><dt className="text-slate-500 font-medium">Previsión AFP</dt><dd className="col-span-2 font-semibold text-slate-900 capitalize">{selectedEmpleado.afp?.toLowerCase() || '-'}</dd></div>
                            <div className="grid grid-cols-3 gap-4"><dt className="text-slate-500 font-medium">Salud</dt><dd className="col-span-2 font-semibold text-slate-900 capitalize">{selectedEmpleado.sistema_salud?.toLowerCase() || '-'}</dd></div>
                            <div className="grid grid-cols-3 gap-4"><dt className="text-slate-500 font-medium">Forma de Pago</dt><dd className="col-span-2 font-semibold text-slate-900">{selectedEmpleado.forma_pago || '-'}</dd></div>
                            <div className="grid grid-cols-3 gap-4"><dt className="text-slate-500 font-medium">Banco</dt><dd className="col-span-2 font-semibold text-slate-900">{selectedEmpleado.banco || '-'} - {selectedEmpleado.tipo_cuenta || '-'}</dd></div>
                            <div className="grid grid-cols-3 gap-4"><dt className="text-slate-500 font-medium">N° Cuenta</dt><dd className="col-span-2 font-semibold text-slate-900">{selectedEmpleado.numero_cuenta || '-'}</dd></div>
                          </dl>
                        </div>
                      </div>
                    ) : (
                      <form id="empleadoForm" onSubmit={guardarEmpleado} className="grid grid-cols-2 gap-10">
                        <div className="space-y-5">
                          <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest border-b border-slate-200 pb-2">Datos Personales</h4>
                          <div className="grid grid-cols-2 gap-4">
                            <div className="col-span-2">
                              <label className="block text-xs font-semibold text-slate-600 mb-1">RUT *</label>
                              <input type="text" name="rut" required value={formData.rut || ''} onChange={handleInputChange} placeholder="12.345.678-9" 
                                     className={`w-full px-3 py-2 rounded-lg border ${!isValidRut && formData.rut ? 'border-red-400 focus:ring-red-400 bg-red-50' : 'border-slate-300 focus:border-blue-500 focus:ring-1 focus:ring-blue-500'} outline-none transition-all`} />
                            </div>
                            <div className="col-span-2">
                              <label className="block text-xs font-semibold text-slate-600 mb-1">Nombres *</label>
                              <input type="text" name="nombres" required value={formData.nombres || ''} onChange={handleInputChange} className="w-full px-3 py-2 rounded-lg border border-slate-300 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none uppercase transition-all" />
                            </div>
                            <div>
                              <label className="block text-xs font-semibold text-slate-600 mb-1">Ap. Paterno *</label>
                              <input type="text" name="apellido_paterno" required value={formData.apellido_paterno || ''} onChange={handleInputChange} className="w-full px-3 py-2 rounded-lg border border-slate-300 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none uppercase transition-all" />
                            </div>
                            <div>
                              <label className="block text-xs font-semibold text-slate-600 mb-1">Ap. Materno</label>
                              <input type="text" name="apellido_materno" value={formData.apellido_materno || ''} onChange={handleInputChange} className="w-full px-3 py-2 rounded-lg border border-slate-300 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none uppercase transition-all" />
                            </div>
                            <div>
                              <label className="block text-xs font-semibold text-slate-600 mb-1">Nacionalidad</label>
                              <input type="text" name="nacionalidad" value={formData.nacionalidad || ''} onChange={handleInputChange} className="w-full px-3 py-2 rounded-lg border border-slate-300 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none uppercase transition-all" />
                            </div>
                            <div>
                              <label className="block text-xs font-semibold text-slate-600 mb-1">F. Nacimiento</label>
                              <input type="date" name="fecha_nacimiento" value={formData.fecha_nacimiento || ''} onChange={handleInputChange} className="w-full px-3 py-2 rounded-lg border border-slate-300 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition-all text-slate-700" />
                            </div>
                            <div>
                              <label className="block text-xs font-semibold text-slate-600 mb-1">Estado Civil</label>
                              <input type="text" name="estado_civil" value={formData.estado_civil || ''} onChange={handleInputChange} className="w-full px-3 py-2 rounded-lg border border-slate-300 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none uppercase transition-all" />
                            </div>
                            <div>
                              <label className="block text-xs font-semibold text-slate-600 mb-1">Teléfono</label>
                              <div className="relative">
                                {/* El +56 fijo visualmente dentro del input */}
                                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                  <span className="text-slate-500 font-medium">+56</span>
                                </div>
                                <input 
                                  type="text" 
                                  name="numero_telefono" 
                                  value={formData.numero_telefono || ''} 
                                  onChange={handleInputChange} 
                                  placeholder="912345678" 
                                  className="w-full pl-11 pr-3 py-2 rounded-lg border border-slate-300 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition-all" 
                                  />
                              </div>
                            </div>
                            <div className="col-span-2">
                              <label className="block text-xs font-semibold text-slate-600 mb-1">Comuna y Dirección</label>
                              <div className="flex gap-2">
                                <input type="text" name="comuna" placeholder="Comuna" value={formData.comuna || ''} onChange={handleInputChange} className="w-1/3 px-3 py-2 rounded-lg border border-slate-300 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none uppercase transition-all" />
                                <input type="text" name="direccion" placeholder="Calle y número" value={formData.direccion || ''} onChange={handleInputChange} className="w-2/3 px-3 py-2 rounded-lg border border-slate-300 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none uppercase transition-all" />
                              </div>
                            </div>
                          </div>
                          <div className="col-span-2 pt-4 border-t border-slate-100 mt-2">
                              <h5 className="text-xs font-bold text-slate-800 mb-3">Datos Bancarios para Pago</h5>
                              <div className="grid grid-cols-2 gap-4">
                                <div>
                                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Forma de Pago</label>
                                  {/* Nos aseguramos de que los values estén en mayúsculas para que coincidan con la lógica */}
                                  <select name="forma_pago" value={formData.forma_pago || 'TRANSFERENCIA'} onChange={handleInputChange} className="w-full px-3 py-2.5 rounded-xl border border-slate-200 bg-white outline-none font-medium uppercase">
                                    <option value="TRANSFERENCIA">Transferencia</option>
                                    <option value="DEPOSITO">Depósito</option>
                                    <option value="CHEQUE">Cheque</option>
                                    <option value="EFECTIVO">Efectivo</option>
                                  </select>
                                </div>
                                
                                {/* Ocultamos los campos del banco si es Efectivo o Cheque */}
                                {formData.forma_pago !== 'EFECTIVO' && formData.forma_pago !== 'CHEQUE' && (
                                  <>
                                    <div>
                                      <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Banco</label>
                                      <input type="text" name="banco" value={formData.banco || ''} onChange={handleInputChange} placeholder="Ej: Banco Estado" className="w-full px-3 py-2.5 rounded-xl border border-slate-200 bg-white outline-none font-medium" />
                                    </div>
                                    <div>
                                      <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Tipo de Cuenta</label>
                                      <select name="tipo_cuenta" value={formData.tipo_cuenta || ''} onChange={handleInputChange} className="w-full px-3 py-2.5 rounded-xl border border-slate-200 bg-white outline-none font-medium">
                                        <option value="">Seleccione...</option>
                                        <option value="Cuenta Corriente">Cuenta Corriente</option>
                                        <option value="Cuenta Vista / RUT">Cuenta Vista / RUT</option>
                                        <option value="Cuenta de Ahorro">Cuenta de Ahorro</option>
                                      </select>
                                    </div>
                                    <div>
                                      <label className="block text-xs font-bold text-slate-500 uppercase mb-1">N° de Cuenta</label>
                                      <input type="text" name="numero_cuenta" value={formData.numero_cuenta || ''} onChange={handleInputChange} className="w-full px-3 py-2.5 rounded-xl border border-slate-200 bg-white outline-none font-medium" />
                                    </div>
                                  </>
                                )}
                              </div>
                            </div>
                        </div>

                        <div className="space-y-5">
                          <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest border-b border-slate-200 pb-2">Datos Laborales</h4>
                          <div className="grid grid-cols-2 gap-4">
                            <div className="col-span-2">
                              <label className="block text-xs font-semibold text-slate-600 mb-1">Cargo *</label>
                              <input type="text" name="cargo" required value={formData.cargo || ''} onChange={handleInputChange} className="w-full px-3 py-2 rounded-lg border border-slate-300 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none uppercase transition-all" />
                            </div>
                            <div>
                              <label className="block text-xs font-semibold text-slate-600 mb-1">Departamento</label>
                              <input type="text" name="departamento" value={formData.departamento || ''} onChange={handleInputChange} className="w-full px-3 py-2 rounded-lg border border-slate-300 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none uppercase transition-all" />
                            </div>
                            <div>
                              <label className="block text-xs font-semibold text-slate-600 mb-1">Sucursal</label>
                              <input type="text" name="sucursal" value={formData.sucursal || ''} onChange={handleInputChange} className="w-full px-3 py-2 rounded-lg border border-slate-300 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none uppercase transition-all" />
                            </div>
                            <div>
                              <label className="block text-xs font-semibold text-slate-600 mb-1">Fecha Ingreso *</label>
                              <input type="date" name="fecha_ingreso" required value={formData.fecha_ingreso || ''} onChange={handleInputChange} className="w-full px-3 py-2 rounded-lg border border-slate-300 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition-all text-slate-700" />
                            </div>
                            <div>
                              <label className="block text-xs font-semibold text-slate-600 mb-1">Sueldo Base ($)</label>
                              <input type="number" name="sueldo_base" value={formData.sueldo_base || ''} onChange={handleInputChange} className="w-full px-3 py-2 rounded-lg border border-slate-300 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition-all" />
                            </div>
                            <div>
                              <label className="block text-xs font-semibold text-slate-600 mb-1">Jornada (Horas)</label>
                              <input type="number" name="horas_laborales" value={formData.horas_laborales || ''} onChange={handleInputChange} className="w-full px-3 py-2 rounded-lg border border-slate-300 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition-all" />
                            </div>
                            <div>
                              <label className="block text-xs font-semibold text-slate-600 mb-1">Modalidad</label>
                              <select name="modalidad" value={formData.modalidad || 'PRESENCIAL'} onChange={handleInputChange} className="w-full px-3 py-2 rounded-lg border border-slate-300 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition-all text-slate-700">
                                <option value="PRESENCIAL">PRESENCIAL</option>
                                <option value="REMOTO">REMOTO</option>
                                <option value="HIBRIDO">HÍBRIDO</option>
                              </select>
                            </div>
                            <div>
                              <label className="block text-xs font-semibold text-slate-600 mb-1">AFP</label>
                              <input type="text" name="afp" value={formData.afp || ''} onChange={handleInputChange} className="w-full px-3 py-2 rounded-lg border border-slate-300 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none uppercase transition-all" />
                            </div>
                            <div>
                              <label className="block text-xs font-semibold text-slate-600 mb-1">Sistema de Salud</label>
                              <select name="sistema_salud" value={formData.sistema_salud || ''} onChange={handleInputChange} className="w-full px-3 py-2 rounded-lg border border-slate-300 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition-all text-slate-700">
                                <option value="">Seleccione...</option>
                                <option value="FONASA">FONASA</option>
                                <option value="ISAPRE">ISAPRE</option>
                              </select>
                              {formData.sistema_salud === 'ISAPRE' && (
                              <div className="col-span-2 bg-blue-50 p-4 rounded-xl border border-blue-100">
                                <label className="block text-xs font-bold text-blue-800 uppercase mb-1">Valor Plan Isapre (En UF) *</label>
                                <input type="number" step="0.01" min="0" name="plan_isapre_uf" value={formData.plan_isapre_uf || ''} onChange={handleInputChange} placeholder="Ej: 2.15" className="w-full px-3 py-2.5 rounded-xl border border-blue-200 bg-white outline-none font-bold text-blue-900" />
                              </div>
                            )}

                            <div>
                              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Centro de Costo</label>
                              <input type="text" name="centro_costo" value={formData.centro_costo || ''} onChange={handleInputChange} placeholder="Ej: Obra Norte" className="w-full px-3 py-2.5 rounded-xl border border-slate-200 focus:ring-slate-900 bg-white outline-none font-medium uppercase transition-all" />
                            </div>
                            <div>
                              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Ficha N°</label>
                              <input type="text" name="ficha_numero" value={formData.ficha_numero || ''} onChange={handleInputChange} className="w-full px-3 py-2.5 rounded-xl border border-slate-200 focus:ring-slate-900 bg-white outline-none font-medium uppercase transition-all" />
                            </div>
                            </div>
                            
                            <div className="col-span-2 flex items-center justify-between mt-4 bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                              <div>
                                <p className="text-sm font-semibold text-slate-900">Estado del Trabajador</p>
                                <p className="text-xs text-slate-500 mt-0.5">Desactivar para marcar como desvinculado</p>
                              </div>
                              <label className="relative inline-flex items-center cursor-pointer">
                                <input type="checkbox" name="activo" checked={formData.activo} onChange={handleInputChange} className="sr-only peer" />
                                <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                              </label>
                            </div>
                          </div>
                        </div>
                      </form>
                    )}
                  </>
                )}

                {/* ========================================== */}
                {/* PESTAÑA 2: CONTRATOS                       */}
                {/* ========================================== */}
                {activeTab === 'contratos' && (
                  <form id="contratoForm" onSubmit={guardarContrato} onChange={() => setHayCambiosContrato(true)} className="max-w-4xl mx-auto space-y-8 pb-10">
                    <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
                      <h3 className="text-lg font-bold text-slate-900 mb-4 border-b pb-2">1. Condiciones Generales</h3>
                      <div className="grid grid-cols-2 gap-6">
                        <div>
                          <label className="block text-xs font-semibold text-slate-600 mb-1">Tipo de Contrato</label>
                          <select name="tipo_contrato" required value={contratoData.tipo_contrato || 'INDEFINIDO'} onChange={handleContratoChange} className="w-full px-3 py-2.5 rounded-lg border border-slate-300 focus:ring-1 focus:ring-blue-500 bg-slate-50">
                            <option value="INDEFINIDO">Indefinido</option>
                            <option value="PLAZO_FIJO">Plazo Fijo</option>
                            <option value="OBRA_FAENA">Por Obra o Faena</option>
                          </select>
                        </div>
                        <div>
                          <label className="block text-xs font-semibold text-slate-600 mb-1">Fecha de Inicio</label>
                          <input type="date" name="fecha_inicio" required value={contratoData.fecha_inicio || ''} onChange={handleContratoChange} className="w-full px-3 py-2.5 rounded-lg border border-slate-300 focus:ring-1 focus:ring-blue-500 bg-slate-50" />
                        </div>
                        {contratoData.tipo_contrato === 'PLAZO_FIJO' && (
                          <div className="col-span-2 bg-orange-50 p-4 rounded-xl border border-orange-100 flex gap-4">
                            <div className="w-1/2">
                              <label className="block text-xs font-semibold text-orange-800 mb-1">Fecha de Término</label>
                              <input type="date" name="fecha_fin" required value={contratoData.fecha_fin || ''} onChange={handleContratoChange} className="w-full px-3 py-2 rounded-lg border border-orange-200" />
                            </div>
                            <p className="w-1/2 text-xs text-orange-700 flex items-center">Indica la fecha exacta en la que terminará la relación laboral.</p>
                          </div>
                        )}
                        <div className="col-span-2">
                          <label className="block text-xs font-semibold text-slate-600 mb-2">Funciones a Desempeñar (Opcional)</label>
                          <p className="text-xs text-slate-500 mb-2">Por defecto se incluirá un texto legal genérico. Si agregas ítems aquí, se listarán en el contrato.</p>
                          {funciones.map((func, index) => (
                            <div key={index} className="flex gap-2 mb-2">
                              <input type="text" value={func} onChange={(e) => { const newF = [...funciones]; newF[index] = e.target.value; setFunciones(newF); setHayCambiosContrato(true); }} className="flex-1 px-3 py-2 rounded-lg border border-slate-300 bg-white" placeholder="Ej: Atención a público y ventas..." />
                              <button type="button" onClick={() => { setFunciones(funciones.filter((_, i) => i !== index)); setHayCambiosContrato(true); }} className="px-3 py-2 bg-red-50 text-red-600 hover:bg-red-100 rounded-lg font-bold">✕</button>
                            </div>
                          ))}
                          <button type="button" onClick={() => { setFunciones([...funciones, ""]); setHayCambiosContrato(true); }} className="text-sm text-blue-600 font-semibold mt-1">+ Agregar Función Específica</button>
                        </div>
                      </div>
                    </div>

                    <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
                      <h3 className="text-lg font-bold text-slate-900 mb-4 border-b pb-2">2. Remuneraciones y Quincena</h3>
                      <div className="grid grid-cols-2 gap-6">
                        <div>
                          <label className="block text-xs font-semibold text-slate-600 mb-1">Día de Pago (Mensual)</label>
                          <input type="number" min="1" max="31" name="dia_pago" required value={contratoData.dia_pago || 5} onChange={handleContratoChange} className="w-full px-3 py-2.5 rounded-lg border border-slate-300 bg-slate-50" />
                        </div>
                        <div>
                          <label className="block text-xs font-semibold text-slate-600 mb-1">Gratificación Legal</label>
                          <select name="gratificacion_legal" value={contratoData.gratificacion_legal || 'MENSUAL'} onChange={handleContratoChange} className="w-full px-3 py-2.5 rounded-lg border border-slate-300 bg-slate-50">
                            <option value="MENSUAL">Mensual (Art. 50 - 25% con tope)</option>
                            <option value="ANUAL">Anual (Art. 47 - 30% utilidades)</option>
                          </select>
                        </div>
                        
                        <div className="col-span-2 flex items-center gap-3">
                          <input type="checkbox" name="tiene_quincena" checked={contratoData.tiene_quincena || false} onChange={handleContratoChange} className="w-5 h-5 text-blue-600" />
                          <label className="font-semibold text-slate-700">El trabajador recibirá Anticipo Quincenal</label>
                        </div>

                        {contratoData.tiene_quincena && (
                          <div className="col-span-2 grid grid-cols-2 gap-4 bg-blue-50 p-4 rounded-xl border border-blue-100">
                            <div>
                              <label className="block text-xs font-semibold text-blue-800 mb-1">Día de la Quincena</label>
                              <input type="number" min="1" max="31" name="dia_quincena" value={contratoData.dia_quincena || 15} onChange={handleContratoChange} className="w-full px-3 py-2 rounded-lg border border-blue-200" />
                            </div>
                            <div>
                              <label className="block text-xs font-semibold text-blue-800 mb-1">Monto de la Quincena ($)</label>
                              <input type="number" min="10000" max={contratoData.sueldo_base || 5000000} name="monto_quincena" value={contratoData.monto_quincena || ''} onChange={handleContratoChange} placeholder="Ej: 150000" className="w-full px-3 py-2 rounded-lg border border-blue-200" />
                            </div>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
                      <div className="flex justify-between items-end mb-4 border-b pb-2">
                        <h3 className="text-lg font-bold text-slate-900">3. Jornada Laboral</h3>
                        <div className="text-right">
                          <label className="block text-xs font-semibold text-slate-600">Límite Legal (Hrs Semanales)</label>
                          <input type="number" step="0.5" name="horas_semanales" value={contratoData.horas_semanales || 44} onChange={handleContratoChange} className="w-24 px-2 py-1 text-center font-bold text-blue-700 bg-blue-50 border border-blue-200 rounded-lg" />
                        </div>
                      </div>

                      <div className="mb-6">
                        <label className="block text-xs font-semibold text-slate-600 mb-1">Tipo de Jornada</label>
                        <select name="tipo_jornada" required value={contratoData.tipo_jornada || 'ORDINARIA'} onChange={handleContratoChange} className="w-full px-3 py-2.5 rounded-lg border border-slate-300 bg-slate-50">
                          <option value="ORDINARIA">Ordinaria (Asignar Horarios)</option>
                          <option value="ART_22">Artículo 22 (Sin límite de horario)</option>
                          <option value="OTRO">Otra (Redactar manualmente)</option>
                        </select>
                      </div>

                      {contratoData.tipo_jornada === 'OTRO' && (
                        <div className="bg-blue-50 p-4 rounded-xl border border-blue-100 mb-4">
                          <label className="block text-xs font-semibold text-blue-800 mb-1">Detalle de la Jornada</label>
                          <textarea name="jornada_personalizada" rows={3} value={contratoData.jornada_personalizada || ''} onChange={handleContratoChange} className="w-full px-3 py-2 rounded-lg border border-blue-200 resize-none"></textarea>
                        </div>
                      )}

                      {contratoData.tipo_jornada === 'ORDINARIA' && (
                        <div className="space-y-3">
                          <div className="grid grid-cols-12 gap-2 text-xs font-bold text-slate-500 uppercase text-center px-2">
                            <div className="col-span-1">Día</div>
                            <div className="col-span-3 text-left">Habilitado</div>
                            <div className="col-span-2">Entrada</div>
                            <div className="col-span-2">Salida</div>
                            <div className="col-span-2">Colación (Min)</div>
                            <div className="col-span-2">Total Día</div>
                          </div>
                          
                          {['lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado', 'domingo'].map((dia) => {
                            const datos = horario[dia] || { activo: false, entrada: '09:00', salida: '18:00', colacion: 60 };
                            let horasDia = 0;
                            if (datos.activo && datos.entrada && datos.salida) {
                              const [he, me] = datos.entrada.split(':').map(Number);
                              const [hs, ms] = datos.salida.split(':').map(Number);
                              const minsTrabajados = ((hs * 60 + ms) - (he * 60 + me)) - datos.colacion;
                              if (minsTrabajados > 0) horasDia = minsTrabajados / 60;
                            }

                            return (
                              <div key={dia} className={`grid grid-cols-12 gap-2 items-center p-2 rounded-lg border ${datos.activo ? 'bg-white border-blue-100 shadow-sm' : 'bg-slate-50 border-slate-100 opacity-60'}`}>
                                <div className="col-span-1 text-xs font-bold text-slate-400 text-center">{dia.substring(0,2).toUpperCase()}</div>
                                <div className="col-span-3">
                                  <label className="relative inline-flex items-center cursor-pointer">
                                    <input type="checkbox" checked={datos.activo} onChange={(e) => { setHorario({...horario, [dia]: {...datos, activo: e.target.checked}}); setHayCambiosContrato(true); }} className="sr-only peer" />
                                    <div className="w-9 h-5 bg-slate-200 rounded-full peer peer-checked:after:translate-x-full after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-blue-600"></div>
                                  </label>
                                </div>
                                <div className="col-span-2"><input type="time" disabled={!datos.activo} value={datos.entrada} onChange={(e) => { setHorario({...horario, [dia]: {...datos, entrada: e.target.value}}); setHayCambiosContrato(true); }} className="w-full text-sm p-1 border rounded" /></div>
                                <div className="col-span-2"><input type="time" disabled={!datos.activo} value={datos.salida} onChange={(e) => { setHorario({...horario, [dia]: {...datos, salida: e.target.value}}); setHayCambiosContrato(true); }} className="w-full text-sm p-1 border rounded" /></div>
                                <div className="col-span-2"><input type="number" step="15" disabled={!datos.activo} value={datos.colacion} onChange={(e) => { setHorario({...horario, [dia]: {...datos, colacion: Number(e.target.value)}}); setHayCambiosContrato(true); }} className="w-full text-sm p-1 border rounded text-center" /></div>
                                <div className="col-span-2 text-center font-mono font-bold text-slate-700">{horasDia.toFixed(1)}h</div>
                              </div>
                            );
                          })}

                          <div className={`mt-4 p-4 rounded-xl flex justify-between items-center border ${totalHorasCalculadas > (contratoData.horas_semanales || 44) ? 'bg-red-50 border-red-200' : 'bg-emerald-50 border-emerald-200'}`}>
                            <span className="font-bold text-slate-700">Horas asignadas en la semana:</span>
                            <div className="text-right">
                              <span className={`text-2xl font-black ${totalHorasCalculadas > (contratoData.horas_semanales || 44) ? 'text-red-600' : 'text-emerald-600'}`}>
                                {totalHorasCalculadas.toFixed(1)} / {contratoData.horas_semanales || 44}
                              </span>
                              <p className={`text-xs font-bold uppercase mt-1 ${totalHorasCalculadas > (contratoData.horas_semanales || 44) ? 'text-red-500' : 'text-emerald-600'}`}>
                                {totalHorasCalculadas > (contratoData.horas_semanales || 44) ? '¡Has sobrepasado el límite!' : `Quedan ${((contratoData.horas_semanales || 44) - totalHorasCalculadas).toFixed(1)} horas libres`}
                              </p>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>

                    <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
                      <h3 className="text-lg font-bold text-slate-900 mb-4 border-b pb-2">4. Cláusulas Adicionales</h3>
                      {clausulas.map((clausula, index) => (
                        <div key={index} className="flex gap-2 mb-3">
                          <textarea rows={2} value={clausula} onChange={(e) => { const newC = [...clausulas]; newC[index] = e.target.value; setClausulas(newC); setHayCambiosContrato(true); }} className="flex-1 px-3 py-2 rounded-lg border border-slate-300 resize-none" placeholder="Ej: Se acuerda un bono de productividad de..." />
                          <button type="button" onClick={() => { setClausulas(clausulas.filter((_, i) => i !== index)); setHayCambiosContrato(true); }} className="px-3 py-2 bg-red-50 text-red-600 hover:bg-red-100 rounded-lg font-bold">✕</button>
                        </div>
                      ))}
                      <button type="button" onClick={() => { setClausulas([...clausulas, ""]); setHayCambiosContrato(true); }} className="text-sm text-blue-600 font-semibold">+ Añadir Nueva Cláusula</button>
                    </div>

                    {contratoData.id && (
                      <div className="flex gap-4">
                        <button 
                          type="button" 
                          onClick={descargarContratoPDF} 
                          disabled={hayCambiosContrato}
                          className={`flex-1 px-4 py-3 rounded-xl font-semibold shadow-sm transition-all flex items-center justify-center gap-2 ${
                            hayCambiosContrato 
                              ? 'bg-slate-200 text-slate-500 cursor-not-allowed' 
                              : 'bg-slate-800 text-white hover:bg-slate-900'
                          }`}
                        >
                          {hayCambiosContrato ? '⚠️ Guarda los cambios primero' : '📄 Descargar Contrato Base'}
                        </button>
                        
                        <button 
                          type="button" 
                          onClick={descargarAnexoPDF} 
                          disabled={hayCambiosContrato}
                          className={`flex-1 px-4 py-3 rounded-xl font-semibold shadow-sm transition-all flex items-center justify-center gap-2 ${
                            hayCambiosContrato 
                              ? 'bg-slate-200 text-slate-500 cursor-not-allowed border-transparent' 
                              : 'bg-white border border-slate-300 text-slate-700 hover:bg-slate-50'
                          }`}
                        >
                          {hayCambiosContrato ? '⚠️ Guarda los cambios primero' : '📄 Descargar Anexo Ley 40h'}
                        </button>
                      </div>
                    )}
                  </form>
                )}

                {/* ========================================== */}
                {/* PESTAÑA 3: LIQUIDACIONES                   */}
                {/* ========================================== */}
                {activeTab === 'liquidaciones' && (
                  <div className="max-w-4xl mx-auto">
                    
                    {!showLiqForm ? (
                      <div className="space-y-6">
                        <div className="flex justify-between items-center border-b border-slate-200 pb-4">
                          <div>
                            <h3 className="text-lg font-extrabold text-slate-900">Historial de Remuneraciones</h3>
                            <p className="text-sm font-medium text-slate-500">Nómina mensual, haberes y descuentos legales.</p>
                          </div>
                          <button onClick={() => setShowLiqForm(true)} className="px-5 py-2.5 bg-slate-900 text-white rounded-xl text-sm font-bold shadow-md shadow-slate-900/10 hover:bg-slate-800 transition-all flex items-center gap-2">
                            + Calcular Mes
                          </button>
                        </div>

                        {liquidaciones.length === 0 ? (
                          <div className="text-center py-16 bg-white border border-slate-200 rounded-2xl shadow-sm">
                            <p className="text-slate-500 font-medium">No hay liquidaciones emitidas para este trabajador.</p>
                          </div>
                        ) : (
                          <div className="bg-white rounded-[1.5rem] shadow-sm border border-slate-200 overflow-hidden">
                            <table className="w-full text-left border-collapse">
                              <thead>
                                <tr className="bg-slate-50 border-b border-slate-200">
                                  <th className="p-4 text-xs font-bold text-slate-400 uppercase tracking-wider">Periodo</th>
                                  <th className="p-4 text-xs font-bold text-slate-400 uppercase tracking-wider">Total Imponible</th>
                                  <th className="p-4 text-xs font-bold text-slate-400 uppercase tracking-wider">Descuentos Legales</th>
                                  <th className="p-4 text-xs font-extrabold text-slate-900 uppercase tracking-wider text-right">Líquido a Pagar</th>
                                </tr>
                              </thead>
                              {liquidaciones.map(liq => (
                                <tbody key={liq.id}>
                                  {/* FILA PRINCIPAL */}
                                  <tr 
                                    onClick={() => setExpandedLiqId(expandedLiqId === liq.id ? null : liq.id!)}
                                    className="border-b border-slate-100 hover:bg-slate-50 transition-colors cursor-pointer group"
                                  >
                                    <td className="p-4 text-sm font-bold text-slate-900 flex items-center gap-2">
                                      <svg fill="none" viewBox="0 0 24 24" strokeWidth="2.5" stroke="currentColor" className={`w-4 h-4 text-slate-400 transition-transform ${expandedLiqId === liq.id ? 'rotate-90 text-blue-600' : 'group-hover:text-slate-600'}`}><path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" /></svg>
                                      {liq.mes}/{liq.anio}
                                    </td>
                                    <td className="p-4 text-sm font-medium text-slate-600">${liq.total_imponible.toLocaleString('es-CL')}</td>
                                    <td className="p-4 text-sm font-medium text-rose-600">-${liq.total_descuentos.toLocaleString('es-CL')}</td>
                                    <td className="p-4 flex items-center justify-end gap-4">
                                      <span className="font-extrabold text-emerald-600 text-lg">
                                        ${liq.sueldo_liquido.toLocaleString('es-CL')}
                                      </span>
                                      <button 
                                        onClick={(e) => { e.stopPropagation(); descargarLiquidacionPDF(liq.id!, liq.mes, liq.anio); }}
                                        className="p-2 bg-slate-100 text-slate-600 hover:bg-slate-900 hover:text-white rounded-lg transition-colors shadow-sm"
                                        title="Descargar Liquidación Oficial"
                                      >
                                        <svg fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor" className="w-5 h-5"><path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3" /></svg>
                                      </button>
                                    </td>
                                  </tr>

                                  {/* DETALLE DESPLEGABLE (GRILLA) */}
                                  {expandedLiqId === liq.id && (
                                    <tr className="bg-slate-50/80 border-b border-slate-200">
                                      <td colSpan={4} className="p-6">
                                        <div className="grid grid-cols-2 gap-10">
                                          {/* COLUMNA HABERES */}
                                          <div className="space-y-2">
                                            <h5 className="text-xs font-extrabold text-slate-500 uppercase tracking-widest border-b border-slate-200 pb-2 mb-3">Detalle de Haberes</h5>
                                            <div className="flex justify-between text-sm"><span className="text-slate-600">Sueldo Base ({liq.dias_trabajados}d)</span><span className="font-bold text-slate-900">${liq.sueldo_base.toLocaleString('es-CL')}</span></div>
                                            <div className="flex justify-between text-sm"><span className="text-slate-600">Gratificación Legal</span><span className="font-bold text-slate-900">${liq.gratificacion.toLocaleString('es-CL')}</span></div>
                                            
                                            {/* Mapear arreglos si existen */}
                                            {liq.detalle_horas_extras?.map((extra, i) => (
                                              <div key={`he-${i}`} className="flex justify-between text-sm">
                                                <span className="text-slate-600">{extra.glosa} ({extra.horas}h)</span>
                                                <span className="font-bold text-slate-900">${extra.valor.toLocaleString('es-CL')}</span>
                                              </div>
                                            ))}
                                            
                                            {liq.detalle_haberes_no_imponibles?.map((noimp, i) => (
                                              <div key={`ni-${i}`} className="flex justify-between text-sm">
                                                <span className="text-slate-600">{noimp.glosa}</span>
                                                <span className="font-bold text-slate-900">${noimp.valor.toLocaleString('es-CL')}</span>
                                              </div>
                                            ))}
                                            
                                            <div className="flex justify-between text-sm pt-2 mt-2 border-t border-slate-200"><span className="font-extrabold text-slate-900">Total Haberes</span><span className="font-extrabold text-slate-900">${liq.total_haberes.toLocaleString('es-CL')}</span></div>
                                          </div>

                                          {/* COLUMNA DESCUENTOS */}
                                          <div className="space-y-2">
                                            <h5 className="text-xs font-extrabold text-slate-500 uppercase tracking-widest border-b border-slate-200 pb-2 mb-3">Detalle de Descuentos</h5>
                                            <div className="flex justify-between text-sm"><span className="text-slate-600">AFP {liq.afp_nombre}</span><span className="font-bold text-rose-600">-${liq.afp_monto.toLocaleString('es-CL')}</span></div>
                                            <div className="flex justify-between text-sm"><span className="text-slate-600">Salud {liq.salud_nombre}</span><span className="font-bold text-rose-600">-${liq.salud_monto.toLocaleString('es-CL')}</span></div>
                                            <div className="flex justify-between text-sm"><span className="text-slate-600">Seguro de Cesantía</span><span className="font-bold text-rose-600">-${liq.seguro_cesantia.toLocaleString('es-CL')}</span></div>
                                            
                                            {liq.anticipo_quincena > 0 && (
                                              <div className="flex justify-between text-sm"><span className="text-slate-600">Anticipo Quincena</span><span className="font-bold text-rose-600">-${liq.anticipo_quincena.toLocaleString('es-CL')}</span></div>
                                            )}

                                            <div className="flex justify-between text-sm pt-2 mt-2 border-t border-slate-200"><span className="font-extrabold text-slate-900">Total Descuentos</span><span className="font-extrabold text-rose-600">-${liq.total_descuentos.toLocaleString('es-CL')}</span></div>
                                          </div>
                                        </div>
                                      </td>
                                    </tr>
                                  )}
                                </tbody>
                              ))}
                            </table>
                          </div>
                        )}
                      </div>
                    ) : (
                      <form id="liqForm" onSubmit={generarLiquidacion} className="bg-white p-8 rounded-[1.5rem] shadow-sm border border-slate-200 space-y-8">
                        <div className="flex justify-between items-center border-b border-slate-100 pb-4">
                          <div>
                            <h3 className="text-lg font-extrabold text-slate-900">Configurar Liquidación de Sueldo</h3>
                            <p className="text-sm font-medium text-slate-500">AFP {selectedEmpleado?.afp || 'MODELO'} y Salud {selectedEmpleado?.sistema_salud || 'FONASA'} se calcularán automáticamente.</p>
                          </div>
                          <button type="button" onClick={() => setShowLiqForm(false)} className="text-slate-400 hover:text-slate-900 font-bold">✕ Cancelar</button>
                        </div>

                        {/* 1. PERIODO Y ASISTENCIA */}
                        <div className="bg-slate-50 p-6 rounded-2xl border border-slate-100">
                          <h4 className="text-xs font-extrabold text-slate-400 uppercase tracking-widest mb-4">1. Periodo y Asistencia</h4>
                          <div className="grid grid-cols-4 gap-6">
                            <div>
                              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Mes</label>
                              <select required value={liqMes} onChange={(e) => setLiqMes(Number(e.target.value))} className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:ring-slate-900 bg-white outline-none font-bold text-slate-700">
                                {[1,2,3,4,5,6,7,8,9,10,11,12].map(m => <option key={m} value={m}>Mes {m}</option>)}
                              </select>
                            </div>
                            <div>
                              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Año</label>
                              <input type="number" required value={liqAnio} onChange={(e) => setLiqAnio(Number(e.target.value))} className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:ring-slate-900 bg-white outline-none font-bold text-slate-700" />
                            </div>
                            <div>
                              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Días Trabajados</label>
                              <input type="number" min="0" max="30" required value={liqDiasTrabajados} onChange={(e) => setLiqDiasTrabajados(Number(e.target.value))} className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:ring-slate-900 bg-white outline-none font-bold text-slate-900" />
                            </div>
                            <div>
                              <label className="block text-xs font-bold text-rose-500 uppercase tracking-wider mb-1">Días Ausente</label>
                              <input type="number" min="0" max="30" required value={liqAusencias} onChange={(e) => setLiqAusencias(Number(e.target.value))} className="w-full px-4 py-2.5 rounded-xl border border-rose-200 focus:ring-rose-500 bg-rose-50 outline-none font-bold text-rose-700" />
                            </div>
                          </div>
                        </div>

                        {/* 2. HABERES IMPONIBLES (Bonos, Comisiones) */}
                        <div>
                          <div className="flex justify-between items-end mb-4">
                            <h4 className="text-xs font-extrabold text-slate-400 uppercase tracking-widest">2. Otros Haberes Imponibles</h4>
                            <button type="button" onClick={() => setHaberesImponiblesList([...haberesImponiblesList, { glosa: '', valor: 0 }])} className="text-xs font-bold text-blue-600 hover:text-blue-800">+ Añadir Bono</button>
                          </div>
                          
                          {haberesImponiblesList.length === 0 ? (
                            <p className="text-sm text-slate-400 italic">No hay bonos imponibles extra (El Sueldo Base y Gratificación se calculan solos).</p>
                          ) : (
                            <div className="space-y-3">
                              {haberesImponiblesList.map((item, index) => (
                                <div key={index} className="flex gap-4">
                                  <input type="text" placeholder="Glosa (Ej: Bono Producción)" value={item.glosa} onChange={(e) => { const newL = [...haberesImponiblesList]; newL[index].glosa = e.target.value; setHaberesImponiblesList(newL); }} className="flex-1 px-4 py-2.5 rounded-xl border border-slate-200 bg-slate-50 font-medium outline-none" />
                                  <input type="number" placeholder="Valor ($)" value={item.valor || ''} onChange={(e) => { const newL = [...haberesImponiblesList]; newL[index].valor = Number(e.target.value); setHaberesImponiblesList(newL); }} className="w-40 px-4 py-2.5 rounded-xl border border-slate-200 bg-slate-50 font-medium outline-none text-right" />
                                  <button type="button" onClick={() => setHaberesImponiblesList(haberesImponiblesList.filter((_, i) => i !== index))} className="text-rose-500 font-bold px-3 hover:bg-rose-50 rounded-lg">✕</button>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>

                        {/* 3. HORAS EXTRAS (Automatizado) */}
                        <div>
                          <div className="flex justify-between items-end mb-4">
                            <h4 className="text-xs font-extrabold text-slate-400 uppercase tracking-widest">3. Horas Extras (Sobresueldo)</h4>
                            <button type="button" onClick={() => setHorasExtrasList([...horasExtrasList, { glosa: 'Horas Extras al 50%', horas: 0, recargo: 50, valor: 0 }])} className="text-xs font-bold text-blue-600 hover:text-blue-800">+ Añadir Horas Extras</button>
                          </div>
                          
                          {horasExtrasList.length === 0 ? (
                            <p className="text-sm text-slate-400 italic">No se registran horas extras este mes.</p>
                          ) : (
                            <div className="space-y-3">
                              {horasExtrasList.map((item, index) => (
                                <div key={index} className="flex gap-4 items-center">
                                  <input 
                                    type="text" 
                                    placeholder="Glosa" 
                                    value={item.glosa} 
                                    onChange={(e) => { const newL = [...horasExtrasList]; newL[index].glosa = e.target.value; setHorasExtrasList(newL); }} 
                                    className="flex-1 px-4 py-2.5 rounded-xl border border-slate-200 bg-slate-50 font-medium outline-none" 
                                  />
                                  
                                  <div className="w-24 relative">
                                    <span className="absolute text-xs text-slate-400 top-[-16px] left-1">Hrs</span>
                                    <input 
                                      type="number" 
                                      placeholder="0" 
                                      value={item.horas || ''} 
                                      onChange={(e) => { 
                                        const val = Number(e.target.value);
                                        const newL = [...horasExtrasList]; 
                                        newL[index].horas = val; 
                                        newL[index].valor = calcularValorHorasExtras(val, newL[index].recargo);
                                        setHorasExtrasList(newL); 
                                      }} 
                                      className="w-full px-3 py-2.5 rounded-xl border border-slate-200 bg-slate-50 font-bold text-slate-900 outline-none text-center" 
                                    />
                                  </div>

                                  <div className="w-24 relative">
                                    <span className="absolute text-xs text-slate-400 top-[-16px] left-1">% Recargo</span>
                                    <input 
                                      type="number" 
                                      value={item.recargo} 
                                      onChange={(e) => { 
                                        const val = Number(e.target.value);
                                        const newL = [...horasExtrasList]; 
                                        newL[index].recargo = val; 
                                        newL[index].valor = calcularValorHorasExtras(newL[index].horas, val);
                                        setHorasExtrasList(newL); 
                                      }} 
                                      className="w-full px-3 py-2.5 rounded-xl border border-slate-200 bg-slate-50 font-bold text-slate-900 outline-none text-center" 
                                    />
                                  </div>

                                  <div className="w-36 relative">
                                    <span className="absolute text-xs text-slate-400 top-[-16px] left-1">Total Calculado</span>
                                    <input 
                                      type="number" 
                                      readOnly
                                      value={item.valor || 0} 
                                      className="w-full px-4 py-2.5 rounded-xl border border-blue-200 bg-blue-50/50 font-extrabold text-blue-800 outline-none text-right cursor-not-allowed" 
                                    />
                                  </div>

                                  <button type="button" onClick={() => setHorasExtrasList(horasExtrasList.filter((_, i) => i !== index))} className="text-rose-500 font-bold px-3 hover:bg-rose-50 rounded-lg mt-2">✕</button>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>

                        {/* 4. HABERES NO IMPONIBLES (Colación, Movilización) */}
                        <div>
                          <div className="flex justify-between items-end mb-4">
                            <h4 className="text-xs font-extrabold text-slate-400 uppercase tracking-widest">4. Haberes NO Imponibles</h4>
                            <button type="button" onClick={() => setHaberesNoImponiblesList([...haberesNoImponiblesList, { glosa: 'Asignación Colación', valor: 0 }])} className="text-xs font-bold text-blue-600 hover:text-blue-800">+ Añadir Asignación</button>
                          </div>
                          
                          {haberesNoImponiblesList.length === 0 ? (
                            <p className="text-sm text-slate-400 italic">No hay haberes no imponibles.</p>
                          ) : (
                            <div className="space-y-3">
                              {haberesNoImponiblesList.map((item, index) => (
                                <div key={index} className="flex gap-4">
                                  <input type="text" placeholder="Glosa (Ej: Colación, Movilización, Viático)" value={item.glosa} onChange={(e) => { const newL = [...haberesNoImponiblesList]; newL[index].glosa = e.target.value; setHaberesNoImponiblesList(newL); }} className="flex-1 px-4 py-2.5 rounded-xl border border-slate-200 bg-slate-50 font-medium outline-none" />
                                  <input type="number" placeholder="Valor ($)" value={item.valor || ''} onChange={(e) => { const newL = [...haberesNoImponiblesList]; newL[index].valor = Number(e.target.value); setHaberesNoImponiblesList(newL); }} className="w-40 px-4 py-2.5 rounded-xl border border-slate-200 bg-slate-50 font-medium outline-none text-right" />
                                  <button type="button" onClick={() => setHaberesNoImponiblesList(haberesNoImponiblesList.filter((_, i) => i !== index))} className="text-rose-500 font-bold px-3 hover:bg-rose-50 rounded-lg">✕</button>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>

                        <div className="pt-6 border-t border-slate-100 flex justify-end">
                          <button type="submit" disabled={isGeneratingLiq} className="px-10 py-4 bg-slate-900 text-white rounded-xl font-bold hover:bg-slate-800 disabled:bg-slate-300 transition-all shadow-xl shadow-slate-900/10 text-lg">
                            {isGeneratingLiq ? 'Calculando Nómina...' : 'Generar Liquidación'}
                          </button>
                        </div>
                      </form>
                    )}
                  </div>
                )}

                {/* ========================================== */}
                {/* PESTAÑA 4: HISTORIAL LEGAL         */}
                {/* ========================================== */}
                {activeTab === 'legal' && (
                  <div className="max-w-4xl mx-auto">
                    
                    {!showDocumentoForm ? (
                      /* VISTA: LISTA DE DOCUMENTOS */
                      <div className="space-y-6">
                        <div className="flex justify-between items-center border-b pb-4">
                          <div>
                            <h3 className="text-lg font-bold text-slate-900">Historial de Documentos</h3>
                            <p className="text-sm text-slate-500">Cartas de amonestación, despidos y constancias.</p>
                          </div>
                          <button 
                            onClick={() => {
                              setDocumentoData({
                                empleado: selectedEmpleado?.id,
                                tipo: 'AMONESTACION',
                                fecha_emision: new Date().toISOString().split('T')[0],
                                hechos: '',
                                causal_legal: '',
                                aviso_previo_pagado: false
                              });
                              setShowDocumentoForm(true);
                            }}
                            className="px-4 py-2 bg-blue-600 text-white rounded-xl text-sm font-semibold shadow-sm hover:bg-blue-700 transition-colors flex items-center gap-2"
                          >
                            + Nuevo Documento
                          </button>
                        </div>

                        {documentosLegales.length === 0 ? (
                          <div className="text-center py-16 bg-white border border-slate-200 rounded-2xl shadow-sm">
                            <p className="text-slate-500 font-medium">No hay documentos legales registrados para este trabajador.</p>
                          </div>
                        ) : (
                          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                            <table className="w-full text-left border-collapse">
                              <thead>
                                <tr className="bg-slate-50 border-b border-slate-200">
                                  <th className="p-4 text-xs font-semibold text-slate-500 uppercase">Fecha</th>
                                  <th className="p-4 text-xs font-semibold text-slate-500 uppercase">Tipo Documento</th>
                                  <th className="p-4 text-xs font-semibold text-slate-500 uppercase text-right">Acciones</th>
                                </tr>
                              </thead>
                              <tbody>
                                {documentosLegales.map(doc => (
                                  <tr key={doc.id} className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                                    <td className="p-4 text-sm font-medium text-slate-900">{doc.fecha_emision}</td>
                                    <td className="p-4">
                                      <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                                        doc.tipo === 'DESPIDO' ? 'bg-red-100 text-red-700' :
                                        doc.tipo === 'AMONESTACION' ? 'bg-orange-100 text-orange-700' :
                                        'bg-slate-100 text-slate-700'
                                      }`}>
                                        {doc.tipo.replace('_', ' ')}
                                      </span>
                                    </td>
                                    <td className="p-4 text-right">
                                      <button 
                                        onClick={() => descargarDocumentoPDF(doc.id!, doc.tipo)}
                                        className="text-blue-600 hover:text-blue-800 font-semibold text-sm flex items-center justify-end gap-1 ml-auto"
                                      >
                                        <svg fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor" className="w-4 h-4"><path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3" /></svg>
                                        Descargar PDF
                                      </button>
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        )}
                      </div>

                    ) : (

                      /* VISTA: FORMULARIO CREAR DOCUMENTO */
                      <form id="documentoForm" onSubmit={guardarDocumentoLegal} className="bg-white p-8 rounded-2xl shadow-sm border border-slate-200 space-y-6">
                        <div className="flex justify-between items-center border-b pb-4 mb-4">
                          <h3 className="text-lg font-bold text-slate-900">Redactar Documento Legal</h3>
                          <button type="button" onClick={() => setShowDocumentoForm(false)} className="text-slate-400 hover:text-slate-600">✕</button>
                        </div>

                        <div className="grid grid-cols-2 gap-6">
                          <div>
                            <label className="block text-xs font-semibold text-slate-600 mb-1">Tipo de Documento</label>
                            <select 
                              required
                              value={documentoData.tipo} 
                              onChange={(e) => setDocumentoData({...documentoData, tipo: e.target.value})} 
                              className="w-full px-3 py-2.5 rounded-lg border border-slate-300 focus:ring-1 focus:ring-blue-500 bg-slate-50 font-medium"
                            >
                              <option value="AMONESTACION">Carta de Amonestación</option>
                              <option value="DESPIDO">Carta de Despido (Término de Contrato)</option>
                              <option value="CONSTANCIA">Constancia Laboral</option>
                            </select>
                          </div>
                          <div>
                            <label className="block text-xs font-semibold text-slate-600 mb-1">Fecha de Emisión</label>
                            <input 
                              type="date" 
                              required 
                              value={documentoData.fecha_emision} 
                              onChange={(e) => setDocumentoData({...documentoData, fecha_emision: e.target.value})} 
                              className="w-full px-3 py-2.5 rounded-lg border border-slate-300 focus:ring-1 focus:ring-blue-500 bg-slate-50" 
                            />
                          </div>

                          {/* CAMPO ESPECÍFICO PARA DESPIDO */}
                          {documentoData.tipo === 'DESPIDO' && (
                            <>
                              <div className="col-span-2 bg-red-50 p-4 rounded-xl border border-red-100">
                                <label className="block text-xs font-bold text-red-800 mb-1">Causal Legal a Invocar</label>
                                <input 
                                  type="text" 
                                  required 
                                  value={documentoData.causal_legal || ''} 
                                  onChange={(e) => setDocumentoData({...documentoData, causal_legal: e.target.value})} 
                                  placeholder="Ej: Artículo 161 inc. 1 (Necesidades de la Empresa)" 
                                  className="w-full px-3 py-2 rounded-lg border border-red-200 outline-none" 
                                />
                              </div>
                              <div className="col-span-2 flex items-center gap-3 bg-slate-50 p-4 rounded-xl border border-slate-200">
                                <input 
                                  type="checkbox" 
                                  checked={documentoData.aviso_previo_pagado} 
                                  onChange={(e) => setDocumentoData({...documentoData, aviso_previo_pagado: e.target.checked})} 
                                  className="w-5 h-5 text-blue-600" 
                                />
                                <label className="font-semibold text-slate-700">Se pagará el mes de aviso previo (indemnización sustitutiva)</label>
                              </div>
                            </>
                          )}

                          <div className="col-span-2">
                            <label className="block text-xs font-semibold text-slate-600 mb-1">Relato de los Hechos (Fundamento Legal)</label>
                            <textarea 
                              required 
                              rows={5} 
                              value={documentoData.hechos} 
                              onChange={(e) => setDocumentoData({...documentoData, hechos: e.target.value})} 
                              placeholder="Redacte detalladamente los hechos y motivos que fundamentan este documento..." 
                              className="w-full px-3 py-2 rounded-lg border border-slate-300 focus:ring-1 focus:ring-blue-500 resize-none"
                            ></textarea>
                          </div>
                        </div>
                      </form>
                    )}
                  </div>
                )}

              </div>

              {/* FOOTER DEL PANEL */}
              <div className="px-8 py-4 border-t border-gray-200 bg-white flex justify-between items-center shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)]">
                {panelMode === 'view' && activeTab === 'perfil' ? (
                  <div className="w-full flex justify-end">
                    <button onClick={() => setIsPanelOpen(false)} className="px-6 py-2.5 text-slate-700 font-semibold bg-white border border-slate-300 hover:bg-slate-50 rounded-xl transition-colors shadow-sm">
                      Cerrar Ficha
                    </button>
                  </div>
                ) : (
                  <div className="flex w-full justify-end gap-3">
                    
                    {/* Botón Cancelar Global */}
                    {(!showDocumentoForm || activeTab !== 'legal') && (
                      <button type="button" onClick={() => { setIsPanelOpen(false); setActiveTab('perfil'); }} className="px-6 py-2.5 text-slate-600 font-semibold bg-transparent hover:bg-slate-100 rounded-xl transition-colors">
                        Cancelar
                      </button>
                    )}
                    
                    {/* BOTÓN DINÁMICO: Cambia según la pestaña y estado activo */}
                    {activeTab === 'perfil' ? (
                      <button type="submit" form="empleadoForm" disabled={!isValidRut} className="px-8 py-2.5 text-white font-semibold bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 disabled:cursor-not-allowed rounded-xl transition-colors shadow-md flex items-center gap-2">
                        {panelMode === 'create' ? 'Crear Trabajador' : 'Guardar Perfil'}
                      </button>
                    ) : activeTab === 'contratos' ? (
                      <button 
                        type="submit" 
                        form="contratoForm" 
                        disabled={isSavingContrato || (contratoData.tipo_jornada === 'ORDINARIA' && totalHorasCalculadas > (contratoData.horas_semanales || 44))} 
                        className="px-8 py-2.5 text-white font-semibold bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-400 disabled:cursor-not-allowed rounded-xl transition-colors shadow-md flex items-center gap-2"
                      >
                        {isSavingContrato ? 'Guardando...' : 'Guardar Contrato Legal'}
                      </button>
                    ) : (activeTab === 'legal' && showDocumentoForm) ? (
                      <>
                        <button type="button" onClick={() => setShowDocumentoForm(false)} className="px-6 py-2.5 text-slate-600 font-semibold bg-transparent hover:bg-slate-100 rounded-xl transition-colors">
                          Volver al Historial
                        </button>
                        <button 
                          type="submit" 
                          form="documentoForm" 
                          disabled={isSavingDocumento} 
                          className="px-8 py-2.5 text-white font-semibold bg-orange-600 hover:bg-orange-700 disabled:bg-orange-400 rounded-xl transition-colors shadow-md flex items-center gap-2"
                        >
                          {isSavingDocumento ? 'Generando...' : 'Guardar y Generar Documento'}
                        </button>
                      </>
                    ) : null}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL DESCARGA MASIVA */}
      {isModalMasivoOpen && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]" onClick={(e) => e.stopPropagation()}>
            <div className="px-6 py-4 border-b flex justify-between items-center bg-gray-50">
              <h2 className="text-xl font-bold text-gray-800">Selecciona los trabajadores</h2>
              <button onClick={() => setIsModalMasivoOpen(false)} className="text-gray-400 hover:text-gray-600">✕</button>
            </div>
            
            <div className="px-6 py-3 border-b bg-gray-50 flex justify-between items-center">
              <button onClick={() => setSelectedEmpleadosIds(empleados.filter(e => e.activo).map(emp => emp.id))} className="text-sm font-semibold text-blue-600 hover:text-blue-800">
                Seleccionar todos (vigentes)
              </button>
              <button onClick={() => setSelectedEmpleadosIds([])} className="text-sm font-semibold text-red-600 hover:text-red-800">
                Deseleccionar todos
              </button>
            </div>

            <div className="p-6 overflow-y-auto flex-1">
              <div className="space-y-2">
                {filteredEmpleados.map(emp => (
                  <label key={emp.id} className={`flex items-center p-3 border rounded-lg cursor-pointer ${emp.activo ? 'hover:bg-gray-50' : 'bg-gray-100 opacity-60 cursor-not-allowed'}`}>
                    <input 
                      type="checkbox" 
                      className="w-5 h-5 text-blue-600 rounded focus:ring-blue-500 disabled:opacity-50"
                      checked={selectedEmpleadosIds.includes(emp.id)}
                      disabled={!emp.activo} 
                      onChange={(e) => {
                        if (e.target.checked) setSelectedEmpleadosIds(prev => [...prev, emp.id]);
                        else setSelectedEmpleadosIds(prev => prev.filter(id => id !== emp.id));
                      }}
                    />
                    <div className="ml-4">
                      <p className="font-semibold text-gray-800">{emp.nombres} {emp.apellido_paterno}</p>
                      <p className="text-sm text-gray-500">RUT: {emp.rut} • {emp.cargo}</p>
                    </div>
                  </label>
                ))}
              </div>
            </div>

            <div className="px-6 py-4 border-t flex justify-end gap-3 bg-gray-50">
              <button onClick={() => setIsModalMasivoOpen(false)} className="px-4 py-2 text-gray-600 hover:bg-gray-200 rounded-lg">Cancelar</button>
              <button 
                disabled={selectedEmpleadosIds.length === 0 || isGeneratingZip}
                className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium disabled:opacity-50 flex items-center gap-2"
                onClick={async () => {
                   setIsGeneratingZip(true);
                   try {
                     const response = await axios.post(`https://jornada40-saas-production.up.railway.app/api/empleados/descargar_anexos_zip/`, { empleados: selectedEmpleadosIds }, { ...apiConfig, responseType: 'blob' });
                     const url = window.URL.createObjectURL(new Blob([response.data]));
                     const link = document.createElement('a');
                     link.href = url;
                     link.setAttribute('download', 'Anexos_40h_Masivos.zip');
                     document.body.appendChild(link);
                     link.click();
                     link.parentNode?.removeChild(link);
                     window.URL.revokeObjectURL(url);
                     setIsModalMasivoOpen(false);
                     setSelectedEmpleadosIds([]); 
                   } catch (error) {
                    console.error("Error al generar ZIP:", error);
                     alert("Hubo un problema al empaquetar los anexos. Inténtalo de nuevo.");
                   } finally {
                     setIsGeneratingZip(false);
                   }
                }}
              >
                {isGeneratingZip ? 'Comprimiendo...' : `Generar ZIP (${selectedEmpleadosIds.length})`}
              </button>
            </div>
          </div>
        </div>
      )}
      {/* MODAL DESCARGA MASIVA (El de los ZIP que ya tenías) */}
      {isModalMasivoOpen && (
        <div className="fixed inset-0 bg-slate-900/50...">
           {/* ... tu código del zip ... */}
        </div>
      )}

      {/* ======================================================== */}
      {/* PEGA ESTO AQUÍ: MODAL DE CARGA MASIVA PREMIUM (EXCEL)    */}
      {/* ======================================================== */}
      {isUploadModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex justify-center items-center p-4 z-[100] animate-in fade-in">
          <div className="bg-white rounded-3xl w-full max-w-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]" onClick={(e) => e.stopPropagation()}>
            
            <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <div>
                <h3 className="text-xl font-extrabold text-slate-900">Carga Masiva de Trabajadores</h3>
                <p className="text-slate-500 text-sm mt-1">Sube tu Excel o descarga la plantilla base.</p>
              </div>
              <button onClick={() => { setIsUploadModalOpen(false); setUploadResult(null); }} className="p-2 hover:bg-slate-200 rounded-full text-slate-500 transition-colors">
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="p-8 overflow-y-auto">
              
              {/* ESTADO 1: Esperando Archivo (Aún no hay resultados) */}
              {!uploadResult && (
                <div className="space-y-6">
                  {/* Zona de Subida */}
                  <div className="border-2 border-dashed border-slate-200 rounded-2xl p-10 flex flex-col items-center justify-center text-center bg-slate-50/50 relative hover:bg-slate-50 hover:border-blue-400 transition-colors">
                    {isUploading ? (
                      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mb-4"></div>
                    ) : (
                      <UploadCloud className="w-16 h-16 text-blue-500 mb-4" />
                    )}
                    <h4 className="text-lg font-bold text-slate-900 mb-2">
                      {isUploading ? 'Procesando archivo...' : 'Sube tu archivo Excel'}
                    </h4>
                    <p className="text-slate-500 text-sm mb-6 max-w-md">
                      Asegúrate de que las columnas coincidan exactamente con la plantilla oficial.
                    </p>
                    
                    <input 
                      type="file" 
                      accept=".xlsx, .xls" 
                      onChange={handleFileUpload}
                      disabled={isUploading}
                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed" 
                    />
                    
                    <button disabled={isUploading} className="px-6 py-2.5 bg-blue-600 text-white font-bold rounded-xl shadow-md pointer-events-none">
                      Seleccionar Archivo
                    </button>
                  </div>

                  {/* Descarga de Plantilla */}
                  <div className="bg-emerald-50 rounded-2xl p-6 border border-emerald-100 flex items-center justify-between">
                    <div>
                      <h5 className="font-bold text-emerald-900 mb-1">¿No tienes el formato correcto?</h5>
                      <p className="text-emerald-700 text-sm">Usa nuestra plantilla oficial para evitar errores.</p>
                    </div>
                    <button 
                      onClick={descargarPlantillaExcel}
                      className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white font-bold rounded-xl hover:bg-emerald-700 transition-colors shadow-sm"
                    >
                      <Download className="w-4 h-4" /> Plantilla
                    </button>
                  </div>
                </div>
              )}

              {/* ESTADO 2: Resultados de la Carga */}
              {uploadResult && (
                <div className="space-y-6 animate-in slide-in-from-bottom-4">
                  
                  {/* Resumen de Éxito */}
                  <div className="bg-slate-900 rounded-2xl p-6 flex items-center gap-4">
                    <div className="w-12 h-12 bg-emerald-500/20 rounded-full flex items-center justify-center">
                      <CheckCircle2 className="w-6 h-6 text-emerald-400" />
                    </div>
                    <div className="flex-1">
                      <h4 className="text-white font-bold text-lg">Carga Finalizada</h4>
                      <div className="flex gap-4 mt-1">
                        <p className="text-emerald-400 text-sm">
                          <span className="font-bold">{uploadResult.agregados}</span> Nuevos
                        </p>
                        <p className="text-blue-400 text-sm">
                          <span className="font-bold">{uploadResult.actualizados}</span> Actualizados
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Advertencia de Límite de Plan */}
                  {uploadResult.limite_alcanzado && (
                    <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5 flex gap-3">
                      <AlertCircle className="w-6 h-6 text-amber-600 shrink-0" />
                      <div>
                        <h5 className="font-bold text-amber-900">Límite de Plan Alcanzado</h5>
                        <p className="text-amber-700 text-sm mt-1">
                          Se detuvo la carga porque llegaste al límite de trabajadores de tu plan actual. Para ingresar al resto, debes mejorar tu suscripción.
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Lista de Errores Específicos */}
                  {(uploadResult?.errores?.length  || 0) > 0 && (
                    <div>
                      <h5 className="font-bold text-slate-900 mb-3 flex items-center gap-2">
                        <X className="w-5 h-5 text-red-500" /> Errores detectados ({uploadResult?.errores?.length})
                      </h5>
                      <div className="bg-red-50 border border-red-100 rounded-xl max-h-48 overflow-y-auto p-4 space-y-2">
                        {uploadResult?.errores?.map((error, index) => (
                          <div key={index} className="text-sm text-red-800 bg-white p-3 rounded-lg shadow-sm border border-red-50">
                            {error}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <button 
                    onClick={() => { setIsUploadModalOpen(false); setUploadResult(null); }}
                    className="w-full py-4 bg-slate-900 text-white font-bold rounded-xl hover:bg-slate-800 transition-colors"
                  >
                    Aceptar y Cerrar
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

    </div>
  );
}