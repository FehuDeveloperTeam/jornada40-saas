import { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { formatRut, validateRut } from '../utils/rutUtils';
import * as XLSX from 'xlsx';

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
}

const apiConfig = { withCredentials: true };

export default function Dashboard() {
  const [empresa, setEmpresa] = useState<Empresa | null>(null);
  const [empleados, setEmpleados] = useState<Empleado[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [downloadingId, setDownloadingId] = useState<number | null>(null);
  
  // --- ESTADOS DE BÚSQUEDA Y FILTROS ---
  const [searchTerm, setSearchTerm] = useState('');
  
  const [selectedCargos, setSelectedCargos] = useState<string[]>([]);
  const [selectedDeptos, setSelectedDeptos] = useState<string[]>([]);
  const [selectedStatuses, setSelectedStatuses] = useState<boolean[]>([true, false]);
  
  // Control de los menús desplegables
  const [openFilterDropdown, setOpenFilterDropdown] = useState<'cargo' | 'depto' | 'estado' | null>(null);

  // Estados para Generación Masiva
  const [isModalMasivoOpen, setIsModalMasivoOpen] = useState(false);
  const [selectedEmpleadosIds, setSelectedEmpleadosIds] = useState<number[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [isGeneratingZip, setIsGeneratingZip] = useState(false);

  // Estados del panel lateral
  const [isPanelOpen, setIsPanelOpen] = useState<boolean>(false);
  const [panelMode, setPanelMode] = useState<'create' | 'edit' | 'view'>('create');
  const [selectedEmpleado, setSelectedEmpleado] = useState<Empleado | null>(null);
  const [isValidRut, setIsValidRut] = useState<boolean>(true);

  const [formData, setFormData] = useState<Partial<Empleado>>({});

  const navigate = useNavigate();
  const empresaActivaId = localStorage.getItem('empresaActivaId');

  // --- OBTENER DATOS ---
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

  // ==========================================
  // INICIALIZAR FILTROS CUANDO CARGAN LOS DATOS
  // ==========================================
  useEffect(() => {
    if (empleados.length > 0) {
      const uniqueCargos = Array.from(new Set(empleados.map(e => e.cargo || 'NO ESPECIFICADO')));
      const uniqueDeptos = Array.from(new Set(empleados.map(e => e.departamento || 'NO ESPECIFICADO')));
      // Iniciar con todos seleccionados
      setSelectedCargos(uniqueCargos);
      setSelectedDeptos(uniqueDeptos);
      setSelectedStatuses([true, false]);
    }
  }, [empleados]);

  // ==========================================
  // MOTOR DE BÚSQUEDA Y ORDENAMIENTO (useMemo)
  // ==========================================
  // Obtenemos los valores únicos (dinámicos) basados en la lista real
  const allCargos = useMemo(() => Array.from(new Set(empleados.map(e => e.cargo || 'NO ESPECIFICADO'))), [empleados]);
  const allDeptos = useMemo(() => Array.from(new Set(empleados.map(e => e.departamento || 'NO ESPECIFICADO'))), [empleados]);

  const filteredEmpleados = useMemo(() => {
    return empleados
      .filter((emp) => {
        // 1. Filtro Búsqueda Global (revisa todos los campos de texto importantes)
        const busqueda = searchTerm.toLowerCase();
        const textoCompleto = `${emp.nombres} ${emp.apellido_paterno} ${emp.apellido_materno || ''} ${emp.rut} ${emp.comuna || ''} ${emp.direccion || ''} ${emp.cargo} ${emp.departamento || ''}`.toLowerCase();
        if (busqueda && !textoCompleto.includes(busqueda)) return false;

        // 2. Filtro Estado (Vigente / Desvinculado)
        if (!selectedStatuses.includes(emp.activo)) return false;

        // 3. Filtro Cargo
        const cargoEmp = emp.cargo || 'NO ESPECIFICADO';
        if (!selectedCargos.includes(cargoEmp)) return false;

        // 4. Filtro Departamento
        const deptoEmp = emp.departamento || 'NO ESPECIFICADO';
        if (!selectedDeptos.includes(deptoEmp)) return false;

        return true;
      })
      .sort((a, b) => {
        // Ordenamiento mágico: Siempre los VIGENTES primero, DESVINCULADOS al final
        if (a.activo === b.activo) {
            // Si tienen el mismo estado, los ordena alfabéticamente por apellido
            return a.apellido_paterno.localeCompare(b.apellido_paterno);
        }
        return a.activo ? -1 : 1; 
      });
  }, [empleados, searchTerm, selectedStatuses, selectedCargos, selectedDeptos]);


  // ==========================================
  // MANEJADORES DE CHECKBOXES (SELECCIONAR TODOS)
  // ==========================================
  const toggleArrayItem = <T,>(array: T[], setArray: React.Dispatch<React.SetStateAction<T[]>>, item: T) => {
    if (array.includes(item)) {
      setArray(array.filter(i => i !== item));
    } else {
      setArray([...array, item]);
    }
  };

  const toggleSelectAll = <T,>(allList: T[], currentList: T[], setList: React.Dispatch<React.SetStateAction<T[]>>) => {
    if (currentList.length === allList.length) {
      setList([]); // Deseleccionar todos
    } else {
      setList(allList); // Seleccionar todos
    }
  };

  const volverAlLobby = () => {
    localStorage.removeItem('empresaActivaId');
    navigate('/empresas');
  };

  const descargarPlantillaExcel = () => {
    const datosEjemplo = [{
      nombres: "JUAN ALBERTO",
      apellido_paterno: "PEREZ",
      apellido_materno: "GONZALEZ",
      rut: "12.345.678-9",
      sexo: "M",
      nacionalidad: "CHILENA",
      fecha_nacimiento: "1990-01-01",
      estado_civil: "SOLTERO",
      numero_telefono: "+56912345678",
      comuna: "SANTIAGO",
      direccion: "AV. PROVIDENCIA 123",
      departamento: "VENTAS",
      cargo: "VENDEDOR",
      sucursal: "CASA MATRIZ",
      fecha_ingreso: "2023-05-01",
      horas_laborales: 40,
      modalidad: "PRESENCIAL",
      sueldo_base: 500000,
      afp: "MODELO",
      sistema_salud: "FONASA"
    }];

    const ws = XLSX.utils.json_to_sheet(datosEjemplo);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Trabajadores");
    XLSX.writeFile(wb, "Plantilla_Carga_Masiva.xlsx");
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    const reader = new FileReader();

    reader.onload = async (evt) => {
      try {
        const arrayBuffer = evt.target?.result as ArrayBuffer;
        const wb = XLSX.read(arrayBuffer, { type: 'array' });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        
        const data = XLSX.utils.sheet_to_json(ws, { raw: false, defval: "" });
        
        const response = await axios.post(`https://jornada40-saas-production.up.railway.app/api/empleados/carga_masiva/`, data, apiConfig);
        
        if (response.data.advertencia) {
          alert(response.data.advertencia);
        } else {
          alert("¡Todos los trabajadores fueron cargados exitosamente!");
        }
        
        window.location.reload();
      } catch (error) {
        console.error("Error procesando el Excel:", error);
        if (axios.isAxiosError(error)) {
          const errorMsg = error.response?.data ? JSON.stringify(error.response.data, null, 2) : error.message;
          alert(`Django rechazó el archivo:\n\n${errorMsg}`);
        } else {
          alert("Error al leer el archivo Excel en tu computador.");
        }
      } finally {
        setIsUploading(false);
        e.target.value = ''; 
      }
    };
    reader.readAsArrayBuffer(file);
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
    setIsPanelOpen(true);
  };

  const abrirVer = (emp: Empleado) => {
    setSelectedEmpleado(emp);
    setPanelMode('view');
    setIsPanelOpen(true);
  };

  const abrirEditar = (emp: Empleado) => {
    setSelectedEmpleado(emp);
    setFormData({ ...emp });
    setIsValidRut(true);
    setPanelMode('edit');
    setIsPanelOpen(true);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    if (name === 'rut') {
      const formateado = formatRut(value);
      setFormData(prev => ({ ...prev, rut: formateado }));
      setIsValidRut(validateRut(formateado));
    } else {
      setFormData(prev => ({
        ...prev,
        [name]: type === 'checkbox' ? (e.target as HTMLInputElement).checked : value
      }));
    }
  };

  const guardarEmpleado = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isValidRut || !formData.nombres || !formData.apellido_paterno) return;

    const payload: Record<string, unknown> = { ...formData } as Record<string, unknown>;
    
    const camposOpcionales = [
      'apellido_materno', 'sexo', 'fecha_nacimiento', 'estado_civil', 
      'direccion', 'comuna', 'numero_telefono', 'departamento', 'sucursal', 
      'afp', 'sistema_salud', 'nacionalidad'
    ];
    camposOpcionales.forEach(campo => {
      if (payload[campo] === '') delete payload[campo];
    });

    if (payload.empresa) payload.empresa = Number(payload.empresa);
    payload.horas_laborales = Number(payload.horas_laborales || 40);
    payload.sueldo_base = Number(payload.sueldo_base || 0);

    try {
      if (panelMode === 'edit' && selectedEmpleado) {
        await axios.patch(`https://jornada40-saas-production.up.railway.app/api/empleados/${selectedEmpleado.id}/`, payload, apiConfig);
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
      const contratos = contratosRes.data;
      let contratoId;

      if (!contratos || contratos.length === 0) {
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
        contratoId = contratos[0].id;
      }

      const response = await axios.get(`https://jornada40-saas-production.up.railway.app/api/contratos/${contratoId}/generar_anexo/`, {
        ...apiConfig,
        responseType: 'blob' 
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
      if (axios.isAxiosError(error)) {
        const errorMsg = error.response?.data ? JSON.stringify(error.response.data) : "Error de conexión";
        alert(`Hubo un problema al generar el documento.\nDetalle: ${errorMsg}`);
      } else {
        alert("Hubo un problema al generar el documento.");
      }
    } finally {
      setDownloadingId(null);
    }
  };

  if (loading) return <div className="min-h-screen bg-gray-50 flex items-center justify-center"><div className="w-12 h-12 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin"></div></div>;

  return (
    <div className="p-6 md:p-10 bg-gray-50 min-h-screen font-sans flex" onClick={() => setOpenFilterDropdown(null)}>
      <div className={`max-w-7xl mx-auto w-full transition-all duration-300 ${isPanelOpen ? 'md:mr-[450px]' : ''}`}>
        
        {/* === NAVEGACIÓN Y HEADER === */}
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

        {/* === TABLA DE EMPLEADOS === */}
        <div className="bg-white p-8 rounded-3xl shadow-sm border border-gray-100 min-h-[500px]">
          
          <div className="flex flex-col md:flex-row justify-between items-center mb-6 gap-4">
            <div>
              <h2 className="text-xl font-bold text-gray-900">Directorio de Empleados</h2>
              <p className="text-sm text-gray-500 mt-1">Mostrando {filteredEmpleados.length} de {empleados.length}</p>
            </div>

            {/* BARRA DE BÚSQUEDA GLOBAL */}
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
            
            {/* BOTONERA SUPERIOR */}
            <div className="flex flex-wrap gap-3 items-center">
                <button type="button" onClick={descargarPlantillaExcel} className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition text-sm font-medium flex items-center gap-2">
                  <svg fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor" className="w-4 h-4"><path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3" /></svg>
                  Plantilla
                </button>

                <label className="cursor-pointer px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition flex items-center gap-2 text-sm font-medium m-0">
                  <svg fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor" className="w-4 h-4"><path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5m-13.5-9L12 3m0 0 4.5 4.5M12 3v13.5" /></svg>
                  {isUploading ? "Cargando..." : "Subir Excel"}
                  <input type="file" accept=".xlsx, .xls, .csv" className="hidden" onChange={handleFileUpload} disabled={isUploading} />
                </label>

                <button type="button" onClick={() => setIsModalMasivoOpen(true)} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition text-sm font-medium flex items-center gap-2">
                  <svg fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor" className="w-4 h-4"><path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12.75V12A2.25 2.25 0 0 1 4.5 9.75h15A2.25 2.25 0 0 1 21.75 12v.75m-8.69-6.44-2.12-2.12a1.5 1.5 0 0 0-1.061-.44H4.5A2.25 2.25 0 0 0 2.25 6v12a2.25 2.25 0 0 0 2.25 2.25h15A2.25 2.25 0 0 0 21.75 18V9a2.25 2.25 0 0 0-2.25-2.25h-5.379a1.5 1.5 0 0 1-1.06-.44Z" /></svg>
                  Descarga Masiva
                </button>

                <button type="button" onClick={abrirCrear} className="px-4 py-2 bg-gray-900 text-white rounded-lg hover:bg-gray-800 transition text-sm font-medium flex items-center gap-2">
                  <svg fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor" className="w-4 h-4"><path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" /></svg>
                  Nuevo Empleado
                </button>
            </div>
          </div>

          {empleados.length === 0 ? (
            <div className="text-center py-16 border-2 border-dashed border-gray-200 rounded-2xl">
              <p className="text-gray-500 font-medium mb-4">Aún no tienes empleados en esta empresa.</p>
            </div>
          ) : (
            <div className="overflow-x-visible pb-20">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b-2 border-gray-100">
                    <th className="p-4 text-sm font-semibold text-gray-400 uppercase">RUT</th>
                    <th className="p-4 text-sm font-semibold text-gray-400 uppercase">Nombre Completo</th>
                    
                    {/* FILTRO DEPARTAMENTO */}
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

                    {/* FILTRO CARGO */}
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

                    {/* FILTRO ESTADO */}
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
                  {filteredEmpleados.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="text-center py-12 text-gray-500 font-medium">No se encontraron trabajadores con los filtros aplicados.</td>
                    </tr>
                  ) : (
                    filteredEmpleados.map((emp) => (
                      <tr key={emp.id} className={`border-b border-gray-50 transition-colors group ${!emp.activo ? 'bg-gray-50/70 opacity-80' : 'hover:bg-gray-50/50'}`}>
                        <td className="p-4 font-mono text-sm text-gray-600">{emp.rut}</td>
                        <td className="p-4 font-medium text-gray-900">{emp.nombres} {emp.apellido_paterno}</td>
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
          <div className="absolute inset-0 bg-black/30 backdrop-blur-sm transition-opacity" onClick={(e) => { e.stopPropagation(); setIsPanelOpen(false); }}></div>
          
          <div className="absolute inset-y-0 right-0 max-w-lg w-full flex">
            <div className="h-full w-full bg-white shadow-2xl flex flex-col transform transition-transform duration-300" onClick={(e) => e.stopPropagation()}>
              
              {/* HEADER DEL PANEL */}
              <div className="px-6 py-5 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
                <h2 className="text-xl font-bold text-gray-900">
                  {panelMode === 'create' ? 'Nuevo Trabajador' : panelMode === 'edit' ? 'Editar Trabajador' : 'Perfil del Trabajador'}
                </h2>
                <div className="flex items-center gap-2">
                  {panelMode === 'view' && selectedEmpleado && (
                    <button onClick={() => abrirEditar(selectedEmpleado)} className="p-2 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors" title="Cambiar a modo edición">
                      <svg fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" className="w-5 h-5"><path strokeLinecap="round" strokeLinejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0 1 15.75 21H5.25A2.25 2.25 0 0 1 3 18.75V8.25A2.25 2.25 0 0 1 5.25 6H10" /></svg>
                    </button>
                  )}
                  <button onClick={() => setIsPanelOpen(false)} className="p-2 text-gray-400 hover:text-gray-600 rounded-lg transition-colors">
                    <svg fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" className="w-6 h-6"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" /></svg>
                  </button>
                </div>
              </div>

              {/* BODY DEL PANEL */}
              <div className="flex-1 overflow-y-auto p-6">
                
                {panelMode === 'view' && selectedEmpleado ? (
                  <div className="space-y-6">
                    <div className="flex items-center gap-4 border-b border-gray-100 pb-6">
                      <div className="w-16 h-16 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-2xl font-bold">
                        {selectedEmpleado.nombres?.charAt(0) || ''}{selectedEmpleado.apellido_paterno?.charAt(0) || ''}
                      </div>
                      <div>
                        <h3 className="text-xl font-bold text-gray-900">{selectedEmpleado.nombres} {selectedEmpleado.apellido_paterno} {selectedEmpleado.apellido_materno}</h3>
                        <p className="text-gray-500 capitalize">{selectedEmpleado.cargo.toLowerCase()}</p>
                        <span className={`inline-block mt-2 px-2 py-1 rounded text-xs font-semibold ${selectedEmpleado.activo ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                          {selectedEmpleado.activo ? 'Vigente' : 'Desvinculado'}
                        </span>
                      </div>
                    </div>
                    
                    <div>
                      <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Datos Personales</h4>
                      <dl className="grid grid-cols-2 gap-x-4 gap-y-4 text-sm">
                        <div><dt className="text-gray-500">RUT</dt><dd className="font-medium text-gray-900 font-mono">{selectedEmpleado.rut}</dd></div>
                        <div><dt className="text-gray-500">Nacionalidad</dt><dd className="font-medium text-gray-900 capitalize">{selectedEmpleado.nacionalidad?.toLowerCase() || '-'}</dd></div>
                        <div><dt className="text-gray-500">Fecha Nac.</dt><dd className="font-medium text-gray-900">{selectedEmpleado.fecha_nacimiento || '-'}</dd></div>
                        <div><dt className="text-gray-500">Estado Civil</dt><dd className="font-medium text-gray-900 capitalize">{selectedEmpleado.estado_civil?.toLowerCase() || '-'}</dd></div>
                        <div><dt className="text-gray-500">Teléfono</dt><dd className="font-medium text-gray-900">{selectedEmpleado.numero_telefono || '-'}</dd></div>
                        <div><dt className="text-gray-500">Comuna</dt><dd className="font-medium text-gray-900 capitalize">{selectedEmpleado.comuna?.toLowerCase() || '-'}</dd></div>
                        <div className="col-span-2"><dt className="text-gray-500">Dirección</dt><dd className="font-medium text-gray-900 capitalize">{selectedEmpleado.direccion?.toLowerCase() || '-'}</dd></div>
                      </dl>
                    </div>

                    <div>
                      <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3 mt-6">Datos Laborales</h4>
                      <dl className="grid grid-cols-2 gap-x-4 gap-y-4 text-sm">
                        <div><dt className="text-gray-500">Departamento</dt><dd className="font-medium text-gray-900 capitalize">{selectedEmpleado.departamento?.toLowerCase() || '-'}</dd></div>
                        <div><dt className="text-gray-500">Sucursal</dt><dd className="font-medium text-gray-900 capitalize">{selectedEmpleado.sucursal?.toLowerCase() || '-'}</dd></div>
                        <div><dt className="text-gray-500">Fecha Ingreso</dt><dd className="font-medium text-gray-900">{selectedEmpleado.fecha_ingreso || '-'}</dd></div>
                        <div><dt className="text-gray-500">Modalidad</dt><dd className="font-medium text-gray-900 capitalize">{selectedEmpleado.modalidad?.toLowerCase() || '-'}</dd></div>
                        <div><dt className="text-gray-500">Jornada</dt><dd className="font-medium text-gray-900">{selectedEmpleado.horas_laborales} Hrs.</dd></div>
                        <div><dt className="text-gray-500">Sueldo Base</dt><dd className="font-medium text-gray-900">${selectedEmpleado.sueldo_base?.toLocaleString('es-CL') || '0'}</dd></div>
                        <div><dt className="text-gray-500">AFP</dt><dd className="font-medium text-gray-900 capitalize">{selectedEmpleado.afp?.toLowerCase() || '-'}</dd></div>
                        <div><dt className="text-gray-500">Previsión Salud</dt><dd className="font-medium text-gray-900 capitalize">{selectedEmpleado.sistema_salud?.toLowerCase() || '-'}</dd></div>
                      </dl>
                    </div>
                  </div>
                ) : (
                  
                  /* === MODO EDICIÓN / CREACIÓN === */
                  <form id="empleadoForm" onSubmit={guardarEmpleado} className="space-y-6">
                    <div className="space-y-4">
                      <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider border-b pb-2">Datos Personales</h4>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="col-span-2">
                          <label className="block text-sm font-medium text-gray-700 mb-1">RUT *</label>
                          <input type="text" name="rut" required value={formData.rut || ''} onChange={handleInputChange} placeholder="12.345.678-9" 
                                 className={`w-full px-3 py-2 rounded-lg border ${!isValidRut && formData.rut ? 'border-red-400 focus:ring-red-400' : 'border-gray-200 focus:ring-blue-500'} focus:outline-none focus:ring-2`} />
                        </div>
                        <div className="col-span-2">
                          <label className="block text-sm font-medium text-gray-700 mb-1">Nombres *</label>
                          <input type="text" name="nombres" required value={formData.nombres || ''} onChange={handleInputChange} className="w-full px-3 py-2 rounded-lg border border-gray-200 focus:ring-2 focus:ring-blue-500 outline-none uppercase" />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Ap. Paterno *</label>
                          <input type="text" name="apellido_paterno" required value={formData.apellido_paterno || ''} onChange={handleInputChange} className="w-full px-3 py-2 rounded-lg border border-gray-200 focus:ring-2 focus:ring-blue-500 outline-none uppercase" />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Ap. Materno</label>
                          <input type="text" name="apellido_materno" value={formData.apellido_materno || ''} onChange={handleInputChange} className="w-full px-3 py-2 rounded-lg border border-gray-200 focus:ring-2 focus:ring-blue-500 outline-none uppercase" />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">F. Nacimiento</label>
                          <input type="date" name="fecha_nacimiento" value={formData.fecha_nacimiento || ''} onChange={handleInputChange} className="w-full px-3 py-2 rounded-lg border border-gray-200 focus:ring-2 focus:ring-blue-500 outline-none" />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Sexo</label>
                          <select name="sexo" value={formData.sexo || ''} onChange={handleInputChange} className="w-full px-3 py-2 rounded-lg border border-gray-200 focus:ring-2 focus:ring-blue-500 outline-none">
                            <option value="">Seleccione...</option>
                            <option value="M">Masculino</option>
                            <option value="F">Femenino</option>
                            <option value="O">Otro</option>
                          </select>
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Nacionalidad</label>
                          <input type="text" name="nacionalidad" value={formData.nacionalidad || ''} onChange={handleInputChange} className="w-full px-3 py-2 rounded-lg border border-gray-200 focus:ring-2 focus:ring-blue-500 outline-none uppercase" />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Estado Civil</label>
                          <input type="text" name="estado_civil" value={formData.estado_civil || ''} onChange={handleInputChange} placeholder="Ej: Soltero" className="w-full px-3 py-2 rounded-lg border border-gray-200 focus:ring-2 focus:ring-blue-500 outline-none uppercase" />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Teléfono</label>
                          <input type="text" name="numero_telefono" value={formData.numero_telefono || ''} onChange={handleInputChange} placeholder="+569 1234 5678" className="w-full px-3 py-2 rounded-lg border border-gray-200 focus:ring-2 focus:ring-blue-500 outline-none" />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Comuna</label>
                          <input type="text" name="comuna" value={formData.comuna || ''} onChange={handleInputChange} className="w-full px-3 py-2 rounded-lg border border-gray-200 focus:ring-2 focus:ring-blue-500 outline-none uppercase" />
                        </div>
                        <div className="col-span-2">
                          <label className="block text-sm font-medium text-gray-700 mb-1">Dirección Completa</label>
                          <input type="text" name="direccion" value={formData.direccion || ''} onChange={handleInputChange} className="w-full px-3 py-2 rounded-lg border border-gray-200 focus:ring-2 focus:ring-blue-500 outline-none uppercase" />
                        </div>
                      </div>

                      <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider border-b pb-2 pt-4">Datos Laborales</h4>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="col-span-2">
                          <label className="block text-sm font-medium text-gray-700 mb-1">Cargo *</label>
                          <input type="text" name="cargo" required value={formData.cargo || ''} onChange={handleInputChange} className="w-full px-3 py-2 rounded-lg border border-gray-200 focus:ring-2 focus:ring-blue-500 outline-none uppercase" />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Departamento</label>
                          <input type="text" name="departamento" value={formData.departamento || ''} onChange={handleInputChange} className="w-full px-3 py-2 rounded-lg border border-gray-200 focus:ring-2 focus:ring-blue-500 outline-none uppercase" />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Sucursal</label>
                          <input type="text" name="sucursal" value={formData.sucursal || ''} onChange={handleInputChange} className="w-full px-3 py-2 rounded-lg border border-gray-200 focus:ring-2 focus:ring-blue-500 outline-none uppercase" />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">F. Ingreso *</label>
                          <input type="date" name="fecha_ingreso" required value={formData.fecha_ingreso || ''} onChange={handleInputChange} className="w-full px-3 py-2 rounded-lg border border-gray-200 focus:ring-2 focus:ring-blue-500 outline-none" />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Horas Laborales</label>
                          <input type="number" name="horas_laborales" value={formData.horas_laborales || ''} onChange={handleInputChange} className="w-full px-3 py-2 rounded-lg border border-gray-200 focus:ring-2 focus:ring-blue-500 outline-none" />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Modalidad</label>
                          <select name="modalidad" value={formData.modalidad || 'PRESENCIAL'} onChange={handleInputChange} className="w-full px-3 py-2 rounded-lg border border-gray-200 focus:ring-2 focus:ring-blue-500 outline-none">
                            <option value="PRESENCIAL">Presencial</option>
                            <option value="REMOTO">Remoto</option>
                            <option value="HIBRIDO">Híbrido</option>
                          </select>
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Sueldo Base ($)</label>
                          <input type="number" name="sueldo_base" value={formData.sueldo_base || ''} onChange={handleInputChange} className="w-full px-3 py-2 rounded-lg border border-gray-200 focus:ring-2 focus:ring-blue-500 outline-none" />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">AFP</label>
                          <input type="text" name="afp" value={formData.afp || ''} onChange={handleInputChange} className="w-full px-3 py-2 rounded-lg border border-gray-200 focus:ring-2 focus:ring-blue-500 outline-none uppercase" />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Sistema Salud</label>
                          <select name="sistema_salud" value={formData.sistema_salud || ''} onChange={handleInputChange} className="w-full px-3 py-2 rounded-lg border border-gray-200 focus:ring-2 focus:ring-blue-500 outline-none">
                            <option value="">Seleccione...</option>
                            <option value="FONASA">Fonasa</option>
                            <option value="ISAPRE">Isapre</option>
                          </select>
                        </div>
                        <div className="col-span-2 flex items-center gap-2 mt-4 bg-gray-50 p-3 rounded-lg border border-gray-100">
                          <input type="checkbox" id="activo" name="activo" checked={formData.activo} onChange={handleInputChange} className="w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500" />
                          <label htmlFor="activo" className="text-sm font-medium text-gray-700">Trabajador Vigente (Activo)</label>
                        </div>
                      </div>
                    </div>
                  </form>
                )}
              </div>

              {/* FOOTER DEL PANEL */}
              <div className="px-6 py-4 border-t border-gray-100 bg-gray-50 flex justify-between items-center">
                {panelMode === 'view' && selectedEmpleado ? (
                  <button onClick={() => setIsPanelOpen(false)} className="px-5 py-2.5 text-gray-700 font-medium bg-white border border-gray-300 hover:bg-gray-50 rounded-xl transition-colors">
                    Cerrar
                  </button>
                ) : (
                  <div className="flex w-full justify-end gap-3">
                    <button type="button" onClick={() => setIsPanelOpen(false)} className="px-5 py-2 text-gray-600 font-medium bg-transparent hover:bg-gray-200 rounded-xl transition-colors">
                      Cancelar
                    </button>
                    <button type="submit" form="empleadoForm" disabled={!isValidRut} className="px-5 py-2 text-white font-medium bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 rounded-xl transition-colors shadow-md">
                      {panelMode === 'create' ? 'Crear Trabajador' : 'Guardar Cambios'}
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* === MODAL GENERACIÓN MASIVA === */}
      {isModalMasivoOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]" onClick={(e) => e.stopPropagation()}>
            <div className="px-6 py-4 border-b flex justify-between items-center bg-gray-50">
              <h2 className="text-xl font-bold text-gray-800">Selecciona los trabajadores para generar anexos</h2>
              <button onClick={() => setIsModalMasivoOpen(false)} className="text-gray-400 hover:text-gray-600">
                ✕
              </button>
            </div>
            
            <div className="px-6 py-3 border-b bg-gray-50 flex justify-between items-center">
              <button 
                onClick={() => setSelectedEmpleadosIds(empleados.filter(e => e.activo).map(emp => emp.id))}
                className="text-sm font-semibold text-blue-600 hover:text-blue-800"
              >
                Seleccionar todos (solo vigentes)
              </button>
              <button 
                onClick={() => setSelectedEmpleadosIds([])}
                className="text-sm font-semibold text-red-600 hover:text-red-800"
              >
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
                      disabled={!emp.activo} // No dejar seleccionar desvinculados
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
                {filteredEmpleados.length === 0 && (
                  <p className="text-center text-gray-500 py-4">No hay trabajadores para mostrar.</p>
                )}
              </div>
            </div>

            <div className="px-6 py-4 border-t flex justify-end gap-3 bg-gray-50">
              <button onClick={() => setIsModalMasivoOpen(false)} className="px-4 py-2 text-gray-600 hover:bg-gray-200 rounded-lg">
                Cancelar
              </button>
              <button 
                disabled={selectedEmpleadosIds.length === 0 || isGeneratingZip}
                className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium disabled:opacity-50 flex items-center gap-2"
                onClick={async () => {
                   setIsGeneratingZip(true);
                   try {
                     const response = await axios.post(
                       `https://jornada40-saas-production.up.railway.app/api/empleados/descargar_anexos_zip/`, 
                       { empleados: selectedEmpleadosIds }, 
                       { ...apiConfig, responseType: 'blob' }
                     );
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
                    console.error("Error al generar el ZIP:", error);
                     alert("Hubo un problema al empaquetar los anexos. Inténtalo de nuevo.");
                   } finally {
                     setIsGeneratingZip(false);
                   }
                }}
              >
                {isGeneratingZip ? (
                  <>
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    Comprimiendo...
                  </>
                ) : (
                  `Generar ZIP (${selectedEmpleadosIds.length})`
                )}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}