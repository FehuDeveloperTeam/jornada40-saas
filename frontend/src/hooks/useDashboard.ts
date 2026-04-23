import { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import client from '../api/client';
import { useToast } from '../context/ToastContext';
import { formatRut, validateRut } from '../utils/rutUtils';
import * as XLSX from 'xlsx';
import type {
  Empresa, Empleado, HorarioDia, HorarioSemana,
  Contrato, AnexoContrato, DocumentoLegal, DetalleItem, HoraExtraItem, Liquidacion,
} from '../types';

export const defaultHorario: HorarioSemana = {
  lunes:    { activo: true,  entrada: '09:00', salida: '18:00', colacion: 60 },
  martes:   { activo: true,  entrada: '09:00', salida: '18:00', colacion: 60 },
  miercoles:{ activo: true,  entrada: '09:00', salida: '18:00', colacion: 60 },
  jueves:   { activo: true,  entrada: '09:00', salida: '18:00', colacion: 60 },
  viernes:  { activo: true,  entrada: '09:00', salida: '18:00', colacion: 60 },
  sabado:   { activo: false, entrada: '09:00', salida: '14:00', colacion: 0  },
  domingo:  { activo: false, entrada: '09:00', salida: '14:00', colacion: 0  },
};

export function useDashboard() {
  const navigate = useNavigate();
  const showToast = useToast();
  const empresaActivaId = localStorage.getItem('empresaActivaId');

  // --- Estado principal ---
  const [empresa, setEmpresa] = useState<Empresa | null>(null);
  const [empleados, setEmpleados] = useState<Empleado[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [downloadingId, setDownloadingId] = useState<number | null>(null);

  // --- Filtros de la tabla ---
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCargos, setSelectedCargos] = useState<string[]>([]);
  const [selectedDeptos, setSelectedDeptos] = useState<string[]>([]);
  const [selectedStatuses, setSelectedStatuses] = useState<boolean[]>([true, false]);
  const [openFilterDropdown, setOpenFilterDropdown] = useState<'cargo' | 'depto' | 'estado' | null>(null);

  // --- Acciones masivas ---
  const [isModalMasivoOpen, setIsModalMasivoOpen] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isGeneratingZip, setIsGeneratingZip] = useState(false);
  const [selectedEmpleadosIds, setSelectedEmpleadosIds] = useState<number[]>([]);
  const [isDownloadMenuOpen, setIsDownloadMenuOpen] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [uploadResult, setUploadResult] = useState<{
    agregados: number; actualizados: number; errores: string[]; limite_alcanzado: boolean;
  } | null>(null);

  // --- Panel lateral ---
  const [isPanelOpen, setIsPanelOpen] = useState<boolean>(false);
  const [panelMode, setPanelMode] = useState<'create' | 'edit' | 'view'>('create');
  const [selectedEmpleado, setSelectedEmpleado] = useState<Empleado | null>(null);
  const [isValidRut, setIsValidRut] = useState<boolean>(true);
  const [activeTab, setActiveTab] = useState<'perfil' | 'contratos' | 'liquidaciones' | 'legal'>('perfil');

  // --- Formulario empleado ---
  const [formData, setFormData] = useState<Partial<Empleado>>({});

  // --- Formulario contrato ---
  const [contratoData, setContratoData] = useState<Partial<Contrato>>({});
  const [isSavingContrato, setIsSavingContrato] = useState(false);
  const [hayCambiosContrato, setHayCambiosContrato] = useState(false);
  const [funciones, setFunciones] = useState<string[]>([]);
  const [clausulas, setClausulas] = useState<string[]>([]);
  const [horario, setHorario] = useState<HorarioSemana>(defaultHorario);

  // --- Liquidaciones ---
  const [liquidaciones, setLiquidaciones] = useState<Liquidacion[]>([]);
  const [showLiqForm, setShowLiqForm] = useState(false);
  const [isGeneratingLiq, setIsGeneratingLiq] = useState(false);
  const [expandedLiqId, setExpandedLiqId] = useState<number | null>(null);
  const [liqMes, setLiqMes] = useState(new Date().getMonth() + 1);
  const [liqAnio, setLiqAnio] = useState(new Date().getFullYear());
  const [liqDiasTrabajados, setLiqDiasTrabajados] = useState(30);
  const [liqAusencias, setLiqAusencias] = useState(0);
  const [haberesImponiblesList, setHaberesImponiblesList] = useState<DetalleItem[]>([]);
  const [haberesNoImponiblesList, setHaberesNoImponiblesList] = useState<DetalleItem[]>([]);
  const [horasExtrasList, setHorasExtrasList] = useState<HoraExtraItem[]>([]);

  // --- Documentos legales ---
  const [documentosLegales, setDocumentosLegales] = useState<DocumentoLegal[]>([]);
  const [documentoData, setDocumentoData] = useState<Partial<DocumentoLegal>>({});
  const [showDocumentoForm, setShowDocumentoForm] = useState(false);
  const [isSavingDocumento, setIsSavingDocumento] = useState(false);

  // --- Anexos de contrato ---
  const [anexosContrato, setAnexosContrato] = useState<AnexoContrato[]>([]);
  const [showAnexoContratoForm, setShowAnexoContratoForm] = useState(false);
  const [isSavingAnexoContrato, setIsSavingAnexoContrato] = useState(false);
  const [anexoContratoData, setAnexoContratoData] = useState<Partial<AnexoContrato>>({});

  // --- Generación de PDFs de contrato ---
  const [isGeneratingContratoPDF, setIsGeneratingContratoPDF] = useState(false);
  const [isGeneratingAnexo40hPDF, setIsGeneratingAnexo40hPDF] = useState(false);

  // --- Widgets BI ---
  const [flippedWidgets, setFlippedWidgets] = useState<Record<string, boolean>>({});

  // ─── Computados ────────────────────────────────────────────────────────────

  const totalHorasCalculadas = useMemo(() => {
    let total = 0;
    Object.values(horario).forEach((dia: HorarioDia) => {
      if (dia.activo && dia.entrada && dia.salida) {
        const [he, me] = dia.entrada.split(':').map(Number);
        const [hs, ms] = dia.salida.split(':').map(Number);
        const mins = ((hs * 60 + ms) - (he * 60 + me)) - (dia.colacion || 0);
        if (mins > 0) total += mins / 60;
      }
    });
    return total;
  }, [horario]);

  const allCargos = useMemo(
    () => Array.from(new Set(empleados.map(e => e.cargo || 'NO ESPECIFICADO'))),
    [empleados],
  );

  const allDeptos = useMemo(
    () => Array.from(new Set(empleados.map(e => e.departamento || 'NO ESPECIFICADO'))),
    [empleados],
  );

  const filteredEmpleados = useMemo(() => {
    return empleados
      .filter(emp => {
        const busqueda = searchTerm.toLowerCase();
        const texto = `${emp.nombres} ${emp.apellido_paterno} ${emp.apellido_materno || ''} ${emp.rut} ${emp.comuna || ''} ${emp.direccion || ''} ${emp.cargo} ${emp.departamento || ''}`.toLowerCase();
        if (busqueda && !texto.includes(busqueda)) return false;
        if (!selectedStatuses.includes(emp.activo)) return false;
        if (!selectedCargos.includes(emp.cargo || 'NO ESPECIFICADO')) return false;
        if (!selectedDeptos.includes(emp.departamento || 'NO ESPECIFICADO')) return false;
        return true;
      })
      .sort((a, b) => {
        if (a.activo === b.activo) return a.apellido_paterno.localeCompare(b.apellido_paterno);
        return a.activo ? -1 : 1;
      });
  }, [empleados, searchTerm, selectedStatuses, selectedCargos, selectedDeptos]);

  const stats = useMemo(() => {
    if (!empleados || empleados.length === 0) return null;
    const total = empleados.length;

    const activos   = empleados.filter(e => e.activo !== false).length;
    const inactivos = total - activos;
    const chartTotal = [
      { name: 'Activos',   valor: activos,   color: '#3b82f6' },
      { name: 'Inactivos', valor: inactivos,  color: '#cbd5e1' },
    ];

    const mujeres = empleados.filter(e => e.sexo === 'F').length;
    const hombres = empleados.filter(e => e.sexo === 'M').length;
    const chartGenero = [
      { name: 'Mujeres', valor: mujeres, color: '#e879f9' },
      { name: 'Hombres', valor: hombres, color: '#60a5fa' },
    ];

    const teletrabajo = empleados.filter(e => e.modalidad?.toUpperCase() === 'TELETRABAJO').length;
    const presencial  = total - teletrabajo;
    const chartModalidad = [
      { name: 'Remoto', valor: teletrabajo, color: '#10b981' },
      { name: 'Oficina', valor: presencial,  color: '#f59e0b' },
    ];

    const jornada40   = empleados.filter(e => (e.horas_laborales || 0) <= 40).length;
    const jornadaMayor = total - jornada40;
    const chartJornada = [
      { name: '40 Hrs',   valor: jornada40,    color: '#10b981' },
      { name: '> 40 Hrs', valor: jornadaMayor,  color: '#f59e0b' },
    ];

    const chilenos      = empleados.filter(e => e.nacionalidad?.toUpperCase() === 'CHILENA').length;
    const extranjeros   = total - chilenos;
    const pctExtranjeros = total > 0 ? (extranjeros / total) * 100 : 0;
    const chartNacionalidad = [
      { name: 'Chilenos', valor: chilenos,    color: '#3b82f6' },
      { name: 'Extranj.', valor: extranjeros, color: pctExtranjeros > 15 ? '#ef4444' : '#6366f1' },
    ];

    const masaSalarial = empleados.reduce((sum, e) => sum + (e.sueldo_base || 0), 0);
    const costosPorCentro: Record<string, number> = {};
    empleados.forEach(e => {
      const centro = e.centro_costo?.toUpperCase() || 'SIN ASIGNAR';
      costosPorCentro[centro] = (costosPorCentro[centro] || 0) + (e.sueldo_base || 0);
    });
    const chartCentros = Object.entries(costosPorCentro)
      .map(([name, valor]) => ({ name, valor }))
      .sort((a, b) => b.valor - a.valor)
      .slice(0, 4);
    const topCentro = chartCentros[0] ?? { name: 'N/A', valor: 0 };

    let menores30 = 0, entre30y50 = 0, mayores50 = 0;
    const hoy = new Date();
    empleados.forEach(e => {
      if (!e.fecha_nacimiento) return;
      const nac = new Date(e.fecha_nacimiento);
      let edad = hoy.getFullYear() - nac.getFullYear();
      if (hoy.getMonth() < nac.getMonth() || (hoy.getMonth() === nac.getMonth() && hoy.getDate() < nac.getDate())) edad--;
      if (edad < 30) menores30++;
      else if (edad <= 50) entre30y50++;
      else mayores50++;
    });
    const chartGeneraciones = [
      { name: '< 30',  valor: menores30,   color: '#d946ef' },
      { name: '30-50', valor: entre30y50,  color: '#a855f7' },
      { name: '> 50',  valor: mayores50,   color: '#8b5cf6' },
    ];

    const bancarizados   = empleados.filter(e => ['TRANSFERENCIA', 'DEPOSITO'].includes(e.forma_pago?.toUpperCase() || '')).length;
    const noBancarizados = total - bancarizados;
    const chartBancos = [
      { name: 'Digital', valor: bancarizados,   color: '#06b6d4' },
      { name: 'Manual',  valor: noBancarizados, color: '#f59e0b' },
    ];

    return {
      chartTotal, total, inactivos, mujeres, hombres, chartGenero,
      teletrabajo, presencial, chartModalidad, jornada40, jornadaMayor, chartJornada,
      extranjeros, pctExtranjeros, chartNacionalidad,
      masaSalarial, topCentro, chartCentros,
      menores30, entre30y50, mayores50, chartGeneraciones,
      bancarizados, noBancarizados, chartBancos,
    };
  }, [empleados]);

  // ─── Efectos ───────────────────────────────────────────────────────────────

  const fetchData = useCallback(async () => {
    if (!empresaActivaId) { navigate('/empresas'); return; }
    try {
      const [empresaRes, empleadosRes] = await Promise.all([
        client.get(`/empresas/${empresaActivaId}/`),
        client.get('/empleados/'),
      ]);
      setEmpresa(empresaRes.data);
      const empleadosList: Empleado[] = empleadosRes.data.results ?? empleadosRes.data;
      setEmpleados(
        empleadosList.filter((emp: Empleado) => emp.empresa === parseInt(empresaActivaId)),
      );
    } catch {
      navigate('/login');
    } finally {
      setLoading(false);
    }
  }, [empresaActivaId, navigate]);

  useEffect(() => { fetchData(); }, [fetchData]);

  useEffect(() => {
    if (empleados.length > 0) {
      setSelectedCargos(Array.from(new Set(empleados.map(e => e.cargo || 'NO ESPECIFICADO'))));
      setSelectedDeptos(Array.from(new Set(empleados.map(e => e.departamento || 'NO ESPECIFICADO'))));
      setSelectedStatuses([true, false]);
    }
  }, [empleados]);

  // ─── Helpers genéricos ─────────────────────────────────────────────────────

  const toggleWidget = (id: string) =>
    setFlippedWidgets(prev => ({ ...prev, [id]: !prev[id] }));

  const toggleArrayItem = <T,>(array: T[], setArray: React.Dispatch<React.SetStateAction<T[]>>, item: T) => {
    if (array.includes(item)) setArray(array.filter(i => i !== item));
    else setArray([...array, item]);
  };

  const toggleSelectAll = <T,>(
    allList: T[],
    currentList: T[],
    setList: React.Dispatch<React.SetStateAction<T[]>>,
  ) => {
    if (currentList.length === allList.length) setList([]);
    else setList(allList);
  };

  const volverAlLobby = () => {
    localStorage.removeItem('empresaActivaId');
    navigate('/empresas');
  };

  // ─── Selección de empleados ────────────────────────────────────────────────

  const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSelectedEmpleadosIds(e.target.checked ? filteredEmpleados.map(emp => emp.id) : []);
  };

  const handleSelectEmpleado = (id: number) =>
    setSelectedEmpleadosIds(prev =>
      prev.includes(id) ? prev.filter(empId => empId !== id) : [...prev, id],
    );

  // ─── Descargas masivas ─────────────────────────────────────────────────────

  const ejecutarDescargaMasiva = async (tipo: string) => {
    if (!empresa || selectedEmpleadosIds.length === 0) return;
    setIsDownloading(true);
    setIsDownloadMenuOpen(false);
    try {
      const response = await client.post(
        '/empleados/descarga_masiva/',
        { empleados: selectedEmpleadosIds, tipo, empresa_id: empresa.id },
        { responseType: 'blob' },
      );
      const url  = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href  = url;
      let fileName = `Documentos_${tipo}.zip`;
      const cd = response.headers['content-disposition'];
      if (cd?.includes('filename=')) {
        const match = cd.match(/filename="?([^"]+)"?/);
        if (match?.[1]) fileName = match[1];
      }
      link.setAttribute('download', fileName);
      document.body.appendChild(link);
      link.click();
      link.parentNode?.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch {
      showToast('Hubo un error al generar los documentos. Inténtalo de nuevo.', 'error');
    } finally {
      setIsDownloading(false);
    }
  };

  const descargarPlantillaExcel = () => {
    const datosEjemplo = [
      { RUT: '12.345.678-9', Nombres: 'JUAN ALBERTO', Apellido_Paterno: 'PEREZ', Apellido_Materno: 'GONZALEZ', Email: 'juan.perez@empresa.cl', Sexo: 'M', Nacionalidad: 'CHILENA', Fecha_Nacimiento: '1990-01-01', Estado_Civil: 'SOLTERO', Numero_Telefono: '+56912345678', Comuna: 'SANTIAGO', Direccion: 'AV. PROVIDENCIA 123', Centro_Costo: 'ADMINISTRACION', Cargo: 'VENDEDOR', Fecha_Ingreso: '2023-05-01', Horas_Laborales: 40, Modalidad: 'PRESENCIAL', Sueldo_Base: 500000, AFP: 'MODELO', Salud: 'FONASA', Plan_Isapre_UF: 0, Departamento: 'VENTAS', Sucursal: 'MATRIZ', Forma_Pago: 'TRANSFERENCIA', Banco: 'BANCO ESTADO', Tipo_Cuenta: 'CORRIENTE', Numero_Cuenta: '1234567890' },
      { RUT: '11.111.111-1', Nombres: 'CAMILA', Apellido_Paterno: 'MARTINEZ', Apellido_Materno: 'GARRIDO', Email: 'camila@empresa.cl', Sexo: 'F', Nacionalidad: 'CHILENA', Fecha_Nacimiento: '1995-05-15', Estado_Civil: 'CASADA', Numero_Telefono: '+56987654321', Comuna: 'PROVIDENCIA', Direccion: 'LOS LEONES 456', Centro_Costo: 'OPERACIONES', Cargo: 'SUPERVISORA', Fecha_Ingreso: '2024-01-10', Horas_Laborales: 44, Modalidad: 'TELETRABAJO', Sueldo_Base: 1200000, AFP: 'PROVIDA', Salud: 'ISAPRE', Plan_Isapre_UF: 2.8, Departamento: 'OPERACIONES', Sucursal: 'MATRIZ', Forma_Pago: 'TRANSFERENCIA', Banco: 'BANCO ESTADO', Tipo_Cuenta: 'CORRIENTE', Numero_Cuenta: '0987654321' },
    ];
    const ws = XLSX.utils.json_to_sheet(datosEjemplo);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Trabajadores');
    XLSX.writeFile(wb, 'Plantilla_Carga_Masiva.xlsx');
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files?.length || !empresa) return;
    setIsUploading(true);
    setUploadResult(null);
    const file = e.target.files[0];
    const fd   = new FormData();
    fd.append('file', file);
    fd.append('empresa', empresa.id.toString());
    try {
      const response = await client.post('/empleados/carga_masiva/', fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setUploadResult(response.data.resultados || response.data);
      fetchData();
    } catch (error) {
      let msg = 'Error de conexión o formato de archivo inválido.';
      if (axios.isAxiosError(error)) msg = error.response?.data?.error || msg;
      else if (error instanceof Error) msg = error.message;
      setUploadResult({ agregados: 0, actualizados: 0, errores: [msg], limite_alcanzado: false });
    } finally {
      setIsUploading(false);
      e.target.value = '';
    }
  };

  // ─── Panel lateral ─────────────────────────────────────────────────────────

  const fetchContratoYDocumentos = async (empleadoId: number) => {
    try {
      const resContrato = await client.get(`/contratos/?empleado=${empleadoId}`);
      const contratosList = resContrato.data.results ?? resContrato.data;
      if (contratosList?.length > 0) {
        const contrato = contratosList[0];
        setContratoData(contrato);
        setFunciones(contrato.funciones_especificas || []);
        setClausulas(contrato.clausulas_especiales || []);
        setHorario(
          contrato.distribucion_horario && Object.keys(contrato.distribucion_horario).length > 0
            ? contrato.distribucion_horario
            : defaultHorario,
        );
      } else {
        const emp = empleados.find(e => e.id === empleadoId);
        setContratoData({
          empleado: empleadoId,
          tipo_contrato: 'INDEFINIDO',
          tipo_jornada: 'ORDINARIA',
          cargo: emp?.cargo || 'NO ESPECIFICADO',
          sueldo_base: emp?.sueldo_base || 0,
          horas_semanales: '44',
          distribucion_dias: 5,
          fecha_inicio: emp?.fecha_ingreso || new Date().toISOString().split('T')[0],
          dia_pago: 5,
          gratificacion_legal: 'MENSUAL',
          tiene_quincena: false,
        });
        setFunciones([]);
        setClausulas([]);
        setHorario(defaultHorario);
      }
      setHayCambiosContrato(false);

      const resDocs = await client.get(`/documentos_legales/?empleado=${empleadoId}`);
      setDocumentosLegales(resDocs.data.results ?? resDocs.data);
      setShowDocumentoForm(false);

      const resLiq = await client.get(`/liquidaciones/?empleado=${empleadoId}`);
      setLiquidaciones(resLiq.data.results ?? resLiq.data);
      setShowLiqForm(false);

      const resAnexos = await client.get(`/anexos_contrato/?empleado=${empleadoId}`);
      setAnexosContrato(resAnexos.data.results ?? resAnexos.data);
      setShowAnexoContratoForm(false);
    } catch (error) {
      console.error('Error al cargar datos del panel:', error);
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
      empresa: parseInt(empresaActivaId!),
    });
    setIsValidRut(false);
    setActiveTab('perfil');
    setIsPanelOpen(true);
  };

  // ─── Handlers de formularios ───────────────────────────────────────────────

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target;
    if (name === 'rut') {
      const formateado = formatRut(value);
      setFormData(prev => ({ ...prev, rut: formateado }));
      setIsValidRut(validateRut(formateado));
    } else if (name === 'numero_telefono') {
      setFormData(prev => ({ ...prev, numero_telefono: value.replace(/[^0-9]/g, '').slice(0, 9) }));
    } else if (name === 'forma_pago') {
      const nuevaForma = value.toUpperCase();
      setFormData(prev => ({
        ...prev,
        forma_pago: nuevaForma,
        ...(nuevaForma === 'EFECTIVO' || nuevaForma === 'CHEQUE'
          ? { banco: '', tipo_cuenta: '', numero_cuenta: '' }
          : {}),
      }));
    } else {
      setFormData(prev => ({
        ...prev,
        [name]: type === 'checkbox' ? (e.target as HTMLInputElement).checked : value,
      }));
    }
  };

  const handleContratoChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target;
    setContratoData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? (e.target as HTMLInputElement).checked : value,
    }));
    setHayCambiosContrato(true);
  };

  // ─── Guardado de empleado ──────────────────────────────────────────────────

  const guardarEmpleado = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isValidRut || !formData.nombres || !formData.apellido_paterno) return;
    if (formData.numero_telefono && formData.numero_telefono.length > 0 && formData.numero_telefono.length < 9) {
      showToast('El número de teléfono debe tener exactamente 9 dígitos (Ej: 912345678).', 'warning');
      return;
    }
    const payload: Record<string, unknown> = { ...formData } as Record<string, unknown>;
    if (payload.numero_telefono) payload.numero_telefono = `+56${payload.numero_telefono}`;
    const camposOpcionales = ['apellido_materno', 'sexo', 'fecha_nacimiento', 'estado_civil', 'direccion', 'comuna', 'numero_telefono', 'departamento', 'sucursal', 'afp', 'sistema_salud', 'nacionalidad'];
    camposOpcionales.forEach(campo => { if (payload[campo] === '') delete payload[campo]; });
    if (payload.empresa) payload.empresa = Number(payload.empresa);
    payload.horas_laborales = Number(payload.horas_laborales || 40);
    payload.sueldo_base     = Number(payload.sueldo_base || 0);

    try {
      if (panelMode === 'edit' && selectedEmpleado) {
        await client.patch(`/empleados/${selectedEmpleado.id}/`, payload);
        if (contratoData?.id) {
          try {
            await client.patch(`/contratos/${contratoData.id}/`, {
              sueldo_base: payload.sueldo_base,
              cargo: payload.cargo,
            });
          } catch (syncError) {
            console.error('No se pudo sincronizar el contrato automáticamente', syncError);
          }
        }
      } else {
        await client.post('/empleados/', payload);
      }
      setIsPanelOpen(false);
      setLoading(true);
      fetchData();
    } catch (error) {
      if (axios.isAxiosError(error)) {
        showToast('No se pudo guardar el trabajador. Revisa los datos e inténtalo de nuevo.', 'error');
      } else {
        showToast('Ocurrió un error desconocido al guardar.', 'error');
      }
    }
  };

  // ─── Guardado de contrato ──────────────────────────────────────────────────

  const guardarContrato = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingContrato(true);
    const basePayload = {
      funciones_especificas: funciones,
      clausulas_especiales: clausulas,
      distribucion_horario: horario,
      dia_quincena:   contratoData.tiene_quincena ? (contratoData.dia_quincena || 15) : null,
      monto_quincena: contratoData.tiene_quincena ? Number(contratoData.monto_quincena) : null,
    };
    try {
      if (contratoData.id) {
        // Excluir campos inmutables del payload para que DRF no los procese
        const {
          id: _id, empleado: _emp, creado_en: _cr,
          archivo_contrato: _ac, archivo_anexo_40h: _aa,
          tiene_contrato_pdf: _tcp, tiene_anexo_40h_pdf: _ta,
          ...campos
        } = contratoData;
        const res = await client.patch(`/contratos/${contratoData.id}/`, { ...campos, ...basePayload });
        setContratoData(res.data);
        setFunciones(res.data.funciones_especificas || []);
        setClausulas(res.data.clausulas_especiales || []);
        showToast('¡Contrato actualizado exitosamente!', 'success');
      } else {
        const res = await client.post('/contratos/', { ...contratoData, ...basePayload });
        setContratoData(res.data);
        setFunciones(res.data.funciones_especificas || []);
        setClausulas(res.data.clausulas_especiales || []);
        showToast('¡Contrato creado exitosamente!', 'success');
      }
      setHayCambiosContrato(false);
    } catch {
      showToast('Hubo un error al guardar las condiciones del contrato.', 'error');
    } finally {
      setIsSavingContrato(false);
    }
  };

  // ─── Guardado de documento legal ───────────────────────────────────────────

  const guardarDocumentoLegal = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingDocumento(true);
    try {
      const res = await client.post('/documentos_legales/', documentoData);
      setDocumentosLegales(prev => [res.data, ...prev]);
      setShowDocumentoForm(false);
      showToast('¡Documento legal generado exitosamente!', 'success');
    } catch {
      showToast('Hubo un error al guardar el documento.', 'error');
    } finally {
      setIsSavingDocumento(false);
    }
  };

  // ─── Cálculo horas extras (Chile) ──────────────────────────────────────────

  const calcularValorHorasExtras = (horas: number, recargo: number) => {
    const sueldoBase      = selectedEmpleado?.sueldo_base || 0;
    const horasSemanales  = selectedEmpleado?.horas_laborales || 44;
    if (!sueldoBase || !horasSemanales || !horas) return 0;
    const valorOrdinaria  = (sueldoBase / 30) * 7 / horasSemanales;
    return Math.round(valorOrdinaria * (1 + recargo / 100) * horas);
  };

  // ─── Liquidaciones ─────────────────────────────────────────────────────────

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
        detalle_otros_descuentos: [],
      };
      const res = await client.post('/liquidaciones/', payload);
      setLiquidaciones(prev => [res.data, ...prev]);
      setShowLiqForm(false);
      setHaberesImponiblesList([]);
      setHorasExtrasList([]);
      setHaberesNoImponiblesList([]);
      setLiqAusencias(0);
      showToast('¡Liquidación calculada y generada exitosamente!', 'success');
    } catch (error) {
      if (axios.isAxiosError(error) && error.response?.data?.error) {
        showToast(`Error del Servidor: ${error.response.data.error}`, 'error');
      } else {
        showToast('Ocurrió un error al calcular la liquidación. Revisa los datos e inténtalo de nuevo.', 'error');
      }
    } finally {
      setIsGeneratingLiq(false);
    }
  };

  // ─── Descargas PDF individuales ────────────────────────────────────────────

  const descargarLiquidacionPDF = async (liqId: number, mes: number, anio: number) => {
    try {
      const response = await client.get(`/liquidaciones/${liqId}/generar_pdf/`, { responseType: 'blob' });
      const url  = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href  = url;
      link.setAttribute('download', `Liquidacion_${mes}_${anio}_${selectedEmpleado?.rut}.pdf`);
      document.body.appendChild(link); link.click(); link.parentNode?.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch {
      showToast('Error al descargar la liquidación. Inténtalo de nuevo.', 'error');
    }
  };

  const descargarDocumentoPDF = async (docId: number, tipo: string) => {
    try {
      const response = await client.get(`/documentos_legales/${docId}/generar_pdf/`, { responseType: 'blob' });
      const url  = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href  = url;
      link.setAttribute('download', `${tipo}_${selectedEmpleado?.rut}.pdf`);
      document.body.appendChild(link); link.click(); link.parentNode?.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch {
      showToast('Error al descargar el documento legal.', 'error');
    }
  };

  const descargarContratoPDF = async () => {
    try {
      const response = await client.get(`/contratos/${contratoData.id}/generar_contrato_pdf/`, { responseType: 'blob' });
      const url  = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href  = url;
      link.setAttribute('download', `Contrato_${selectedEmpleado?.rut}.pdf`);
      document.body.appendChild(link); link.click(); link.parentNode?.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch {
      showToast('Error al descargar el contrato.', 'error');
    }
  };

  const descargarAnexoPDF = async () => {
    try {
      const response = await client.get(`/contratos/${contratoData.id}/generar_anexo/`, { responseType: 'blob' });
      const url  = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href  = url;
      link.setAttribute('download', `Anexo_40h_${selectedEmpleado?.rut}.pdf`);
      document.body.appendChild(link); link.click(); link.parentNode?.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch {
      showToast('Error al descargar el anexo.', 'error');
    }
  };

  const generarContratoPDF = async () => {
    if (!contratoData.id) return;
    setIsGeneratingContratoPDF(true);
    try {
      await client.post(`/contratos/${contratoData.id}/generar_contrato_pdf/`);
      setContratoData(prev => ({ ...prev, tiene_contrato_pdf: true }));
      showToast('¡Contrato generado y guardado exitosamente!', 'success');
    } catch {
      showToast('Error al generar el contrato. Inténtalo de nuevo.', 'error');
    } finally {
      setIsGeneratingContratoPDF(false);
    }
  };

  const descargarContratoGuardado = async () => {
    try {
      const response = await client.get(`/contratos/${contratoData.id}/descargar_contrato/`, { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `Contrato_${selectedEmpleado?.rut}.pdf`);
      document.body.appendChild(link); link.click(); link.parentNode?.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch {
      showToast('Error al descargar el contrato.', 'error');
    }
  };

  const generarAnexo40hPDF = async () => {
    if (!contratoData.id) return;
    setIsGeneratingAnexo40hPDF(true);
    try {
      await client.post(`/contratos/${contratoData.id}/generar_anexo_40h/`);
      setContratoData(prev => ({ ...prev, tiene_anexo_40h_pdf: true }));
      showToast('¡Anexo Ley 40h generado y guardado exitosamente!', 'success');
    } catch {
      showToast('Error al generar el anexo 40h. Inténtalo de nuevo.', 'error');
    } finally {
      setIsGeneratingAnexo40hPDF(false);
    }
  };

  const descargarAnexo40hGuardado = async () => {
    try {
      const response = await client.get(`/contratos/${contratoData.id}/descargar_anexo_40h/`, { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `Anexo_40h_${selectedEmpleado?.rut}.pdf`);
      document.body.appendChild(link); link.click(); link.parentNode?.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch {
      showToast('Error al descargar el anexo 40h.', 'error');
    }
  };

  const generarYDescargarPDF = async (empleado: Empleado) => {
    setDownloadingId(empleado.id);
    try {
      const contratosRes = await client.get(`/contratos/?empleado=${empleado.id}`);
      let contratoId: number;
      if (!contratosRes.data?.length) {
        const nuevoRes = await client.post('/contratos/', {
          empleado: empleado.id,
          tipo_contrato: 'INDEFINIDO',
          fecha_inicio: empleado.fecha_ingreso || new Date().toISOString().split('T')[0],
          sueldo_base: empleado.sueldo_base || 0,
          cargo: empleado.cargo || 'NO ESPECIFICADO',
        });
        contratoId = nuevoRes.data.id;
      } else {
        contratoId = contratosRes.data[0].id;
      }
      const response = await client.get(`/contratos/${contratoId}/generar_anexo/`, { responseType: 'blob' });
      const url  = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href  = url;
      link.setAttribute('download', `Anexo_40h_${empleado.rut}.pdf`);
      document.body.appendChild(link); link.click(); link.parentNode?.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch {
      showToast('Hubo un problema al generar el documento.', 'error');
    } finally {
      setDownloadingId(null);
    }
  };

  // ─── Anexos de contrato ────────────────────────────────────────────────────

  const guardarAnexoContrato = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!contratoData.id) { showToast('Guarda el contrato primero.', 'warning'); return; }
    setIsSavingAnexoContrato(true);
    try {
      const payload = { ...anexoContratoData, contrato: contratoData.id };
      const res = await client.post('/anexos_contrato/', payload);
      setAnexosContrato(prev => [res.data, ...prev]);
      setShowAnexoContratoForm(false);
      setAnexoContratoData({});
      showToast('¡Anexo de contrato guardado exitosamente!', 'success');
    } catch {
      showToast('Hubo un error al guardar el anexo.', 'error');
    } finally {
      setIsSavingAnexoContrato(false);
    }
  };

  const descargarAnexoContratoPDF = async (anexoId: number, titulo: string) => {
    try {
      const response = await client.get(`/anexos_contrato/${anexoId}/generar_pdf/`, { responseType: 'blob' });
      const url  = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href  = url;
      link.setAttribute('download', `Anexo_${titulo.replace(/\s+/g, '_')}_${selectedEmpleado?.rut}.pdf`);
      document.body.appendChild(link); link.click(); link.parentNode?.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch {
      showToast('Error al descargar el anexo de contrato.', 'error');
    }
  };

  // ─── Return ────────────────────────────────────────────────────────────────

  return {
    // Estado de datos
    empresa, empleados, loading, downloadingId,
    // Filtros
    searchTerm, setSearchTerm,
    selectedCargos, setSelectedCargos,
    selectedDeptos, setSelectedDeptos,
    selectedStatuses, setSelectedStatuses,
    openFilterDropdown, setOpenFilterDropdown,
    allCargos, allDeptos, filteredEmpleados, stats,
    // Acciones masivas
    isModalMasivoOpen, setIsModalMasivoOpen,
    isUploading, isGeneratingZip, setIsGeneratingZip,
    selectedEmpleadosIds, setSelectedEmpleadosIds,
    isDownloadMenuOpen, setIsDownloadMenuOpen,
    isDownloading,
    isUploadModalOpen, setIsUploadModalOpen,
    uploadResult, setUploadResult,
    // Panel lateral
    isPanelOpen, setIsPanelOpen,
    panelMode, setPanelMode,
    selectedEmpleado,
    isValidRut, setIsValidRut,
    activeTab, setActiveTab,
    // Formulario empleado
    formData, setFormData,
    // Formulario contrato
    contratoData, setContratoData,
    isSavingContrato, hayCambiosContrato, setHayCambiosContrato,
    funciones, setFunciones,
    clausulas, setClausulas,
    horario, setHorario,
    totalHorasCalculadas,
    // Liquidaciones
    liquidaciones,
    showLiqForm, setShowLiqForm,
    isGeneratingLiq,
    expandedLiqId, setExpandedLiqId,
    liqMes, setLiqMes,
    liqAnio, setLiqAnio,
    liqDiasTrabajados, setLiqDiasTrabajados,
    liqAusencias, setLiqAusencias,
    haberesImponiblesList, setHaberesImponiblesList,
    haberesNoImponiblesList, setHaberesNoImponiblesList,
    horasExtrasList, setHorasExtrasList,
    // Documentos legales
    documentosLegales,
    documentoData, setDocumentoData,
    showDocumentoForm, setShowDocumentoForm,
    isSavingDocumento,
    // Anexos de contrato
    anexosContrato,
    showAnexoContratoForm, setShowAnexoContratoForm,
    isSavingAnexoContrato,
    anexoContratoData, setAnexoContratoData,
    // Generación PDFs de contrato
    isGeneratingContratoPDF, isGeneratingAnexo40hPDF,
    // Widgets BI
    flippedWidgets,
    // Handlers
    handleSelectAll, handleSelectEmpleado,
    ejecutarDescargaMasiva,
    descargarPlantillaExcel,
    handleFileUpload,
    abrirVer, abrirEditar, abrirCrear,
    handleInputChange, handleContratoChange,
    guardarEmpleado, guardarContrato, guardarDocumentoLegal, guardarAnexoContrato,
    descargarAnexoContratoPDF,
    calcularValorHorasExtras,
    generarLiquidacion,
    descargarLiquidacionPDF, descargarDocumentoPDF,
    descargarContratoPDF, descargarAnexoPDF,
    generarContratoPDF, descargarContratoGuardado,
    generarAnexo40hPDF, descargarAnexo40hGuardado,
    generarYDescargarPDF,
    toggleWidget, toggleArrayItem, toggleSelectAll,
    volverAlLobby,
    // Utilidades para el JSX
    empresaActivaId,
  };
}

export type UseDashboardReturn = ReturnType<typeof useDashboard>;
