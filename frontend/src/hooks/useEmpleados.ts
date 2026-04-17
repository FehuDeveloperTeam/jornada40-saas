import { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import client from '../api/client';
import type { DashboardEmpresa, DashboardEmpleado } from '../types/dashboard';

export function useEmpleados() {
  const [empresa, setEmpresa] = useState<DashboardEmpresa | null>(null);
  const [empleados, setEmpleados] = useState<DashboardEmpleado[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [downloadingId, setDownloadingId] = useState<number | null>(null);

  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCargos, setSelectedCargos] = useState<string[]>([]);
  const [selectedDeptos, setSelectedDeptos] = useState<string[]>([]);
  const [selectedStatuses, setSelectedStatuses] = useState<boolean[]>([true, false]);
  const [openFilterDropdown, setOpenFilterDropdown] = useState<'cargo' | 'depto' | 'estado' | null>(null);

  const [selectedEmpleadosIds, setSelectedEmpleadosIds] = useState<number[]>([]);
  const [isDownloadMenuOpen, setIsDownloadMenuOpen] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);

  const navigate = useNavigate();
  const empresaActivaId = localStorage.getItem('empresaActivaId');

  const fetchData = useCallback(async () => {
    if (!empresaActivaId) {
      navigate('/empresas');
      return;
    }
    try {
      const [empresaRes, empleadosRes] = await Promise.all([
        client.get(`/empresas/${empresaActivaId}/`),
        client.get('/empleados/')
      ]);
      setEmpresa(empresaRes.data);
      const empleadosFiltrados = empleadosRes.data.filter(
        (emp: DashboardEmpleado) => emp.empresa === parseInt(empresaActivaId)
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

  // Estadísticas (BI)
  const stats = useMemo(() => {
    if (!empleados || empleados.length === 0) return null;

    const total = empleados.length;

    const activos = empleados.filter(e => e.activo !== false).length;
    const inactivos = total - activos;
    const chartTotal = [
      { name: 'Activos', valor: activos, color: '#3b82f6' },
      { name: 'Inactivos', valor: inactivos, color: '#cbd5e1' }
    ];

    const mujeres = empleados.filter(e => e.sexo === 'F').length;
    const hombres = empleados.filter(e => e.sexo === 'M').length;
    const chartGenero = [
      { name: 'Mujeres', valor: mujeres, color: '#e879f9' },
      { name: 'Hombres', valor: hombres, color: '#60a5fa' }
    ];

    const teletrabajo = empleados.filter(e => e.modalidad?.toUpperCase() === 'TELETRABAJO').length;
    const presencial = total - teletrabajo;
    const chartModalidad = [
      { name: 'Remoto', valor: teletrabajo, color: '#10b981' },
      { name: 'Oficina', valor: presencial, color: '#f59e0b' }
    ];

    const jornada40 = empleados.filter(e => (e.horas_laborales || 0) <= 40).length;
    const jornadaMayor = total - jornada40;
    const chartJornada = [
      { name: '40 Hrs', valor: jornada40, color: '#10b981' },
      { name: '> 40 Hrs', valor: jornadaMayor, color: '#f59e0b' }
    ];

    const chilenos = empleados.filter(e => e.nacionalidad?.toUpperCase() === 'CHILENA').length;
    const extranjeros = total - chilenos;
    const pctExtranjeros = total > 0 ? (extranjeros / total) * 100 : 0;
    const chartNacionalidad = [
      { name: 'Chilenos', valor: chilenos, color: '#3b82f6' },
      { name: 'Extranj.', valor: extranjeros, color: pctExtranjeros > 15 ? '#ef4444' : '#6366f1' }
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

    const topCentro = chartCentros.length > 0 ? chartCentros[0] : { name: 'N/A', valor: 0 };

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

  // Selección masiva
  const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.checked && filteredEmpleados) {
      setSelectedEmpleadosIds(filteredEmpleados.map(emp => emp.id));
    } else {
      setSelectedEmpleadosIds([]);
    }
  };

  const handleSelectEmpleado = (id: number) => {
    setSelectedEmpleadosIds(prev =>
      prev.includes(id) ? prev.filter(empId => empId !== id) : [...prev, id]
    );
  };

  const ejecutarDescargaMasiva = async (tipo: string) => {
    if (!empresa || selectedEmpleadosIds.length === 0) return;

    setIsDownloading(true);
    setIsDownloadMenuOpen(false);

    try {
      const response = await client.post(
        '/empleados/descarga_masiva/',
        {
          empleados: selectedEmpleadosIds,
          tipo: tipo,
          empresa_id: empresa.id
        },
        { responseType: 'blob' }
      );

      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;

      let fileName = `Documentos_${tipo}.zip`;
      const contentDisposition = response.headers['content-disposition'];
      if (contentDisposition && contentDisposition.includes('filename=')) {
         const match = contentDisposition.match(/filename="?([^"]+)"?/);
         if (match && match[1]) fileName = match[1];
      }

      link.setAttribute('download', fileName);
      document.body.appendChild(link);
      link.click();
      link.parentNode?.removeChild(link);
      window.URL.revokeObjectURL(url);

    } catch (error) {
      console.error("Error descargando documentos:", error);
      alert("Hubo un error al generar los documentos. Revisa tu consola para más detalles.");
    } finally {
      setIsDownloading(false);
    }
  };

  const volverAlLobby = () => {
    localStorage.removeItem('empresaActivaId');
    navigate('/empresas');
  };

  const generarYDescargarPDF = async (empleado: DashboardEmpleado) => {
    setDownloadingId(empleado.id);
    try {
      const contratosRes = await client.get(`/contratos/?empleado=${empleado.id}`);
      let contratoId;

      if (!contratosRes.data || contratosRes.data.length === 0) {
        const payloadContrato = {
          empleado: empleado.id,
          tipo_contrato: 'INDEFINIDO',
          fecha_inicio: empleado.fecha_ingreso || new Date().toISOString().split('T')[0],
          sueldo_base: empleado.sueldo_base || 0,
          cargo: empleado.cargo || 'NO ESPECIFICADO'
        };
        const nuevoContratoRes = await client.post('/contratos/', payloadContrato);
        contratoId = nuevoContratoRes.data.id;
      } else {
        contratoId = contratosRes.data[0].id;
      }

      const response = await client.get(`/contratos/${contratoId}/generar_anexo/`, { responseType: 'blob' });

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

  return {
    empresa,
    empleados,
    setEmpleados,
    loading,
    setLoading,
    downloadingId,
    searchTerm,
    setSearchTerm,
    selectedCargos,
    setSelectedCargos,
    selectedDeptos,
    setSelectedDeptos,
    selectedStatuses,
    setSelectedStatuses,
    openFilterDropdown,
    setOpenFilterDropdown,
    selectedEmpleadosIds,
    setSelectedEmpleadosIds,
    isDownloadMenuOpen,
    setIsDownloadMenuOpen,
    isDownloading,
    allCargos,
    allDeptos,
    filteredEmpleados,
    stats,
    handleSelectAll,
    handleSelectEmpleado,
    ejecutarDescargaMasiva,
    volverAlLobby,
    generarYDescargarPDF,
    fetchData,
  };
}
