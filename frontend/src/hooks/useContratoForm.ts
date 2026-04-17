import { useState, useMemo } from 'react';
import client from '../api/client';
import type { DashboardContrato, HorarioSemana, HorarioDia } from '../types/dashboard';
import { defaultHorario } from '../types/dashboard';

export function useContratoForm() {
  const [contratoData, setContratoData] = useState<Partial<DashboardContrato>>({});
  const [isSavingContrato, setIsSavingContrato] = useState(false);
  const [hayCambiosContrato, setHayCambiosContrato] = useState(false);
  const [funciones, setFunciones] = useState<string[]>([]);
  const [clausulas, setClausulas] = useState<string[]>([]);
  const [horario, setHorario] = useState<HorarioSemana>(defaultHorario);

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

  const handleContratoChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target;
    setContratoData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? (e.target as HTMLInputElement).checked : value
    }));
    setHayCambiosContrato(true);
  };

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
        await client.patch(`/contratos/${contratoData.id}/`, payload);
        alert("¡Contrato actualizado exitosamente!");
      } else {
        const res = await client.post('/contratos/', payload);
        setContratoData(res.data);
        alert("¡Contrato creado exitosamente!");
      }
      setHayCambiosContrato(false);
    } catch (error) {
      console.error("Error guardando contrato:", error);
      alert("Hubo un error al guardar las condiciones del contrato.");
    } finally {
      setIsSavingContrato(false);
    }
  };

  const descargarContratoPDF = async (rut: string) => {
    try {
      const response = await client.get(`/contratos/${contratoData.id}/generar_contrato_pdf/`, { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `Contrato_${rut}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.parentNode?.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error(error);
      alert("Error descargando el contrato.");
    }
  };

  const descargarAnexoPDF = async (rut: string) => {
    try {
      const response = await client.get(`/contratos/${contratoData.id}/generar_anexo/`, { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `Anexo_40h_${rut}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.parentNode?.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error(error);
      alert("Error descargando el anexo.");
    }
  };

  return {
    contratoData,
    setContratoData,
    isSavingContrato,
    hayCambiosContrato,
    setHayCambiosContrato,
    funciones,
    setFunciones,
    clausulas,
    setClausulas,
    horario,
    setHorario,
    totalHorasCalculadas,
    handleContratoChange,
    guardarContrato,
    descargarContratoPDF,
    descargarAnexoPDF,
  };
}
