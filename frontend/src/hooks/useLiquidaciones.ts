import { useState } from 'react';
import axios from 'axios';
import client from '../api/client';
import type { DashboardLiquidacion, DashboardEmpleado, ItemDinamico, HoraExtraItem } from '../types/dashboard';

export function useLiquidaciones(selectedEmpleado: DashboardEmpleado | null) {
  const [liquidaciones, setLiquidaciones] = useState<DashboardLiquidacion[]>([]);
  const [showLiqForm, setShowLiqForm] = useState(false);
  const [isGeneratingLiq, setIsGeneratingLiq] = useState(false);
  const [expandedLiqId, setExpandedLiqId] = useState<number | null>(null);

  const [liqMes, setLiqMes] = useState(new Date().getMonth() + 1);
  const [liqAnio, setLiqAnio] = useState(new Date().getFullYear());
  const [liqDiasTrabajados, setLiqDiasTrabajados] = useState(30);
  const [liqAusencias, setLiqAusencias] = useState(0);

  const [haberesImponiblesList, setHaberesImponiblesList] = useState<ItemDinamico[]>([]);
  const [haberesNoImponiblesList, setHaberesNoImponiblesList] = useState<ItemDinamico[]>([]);
  const [horasExtrasList, setHorasExtrasList] = useState<HoraExtraItem[]>([]);

  const calcularValorHorasExtras = (horas: number, recargo: number) => {
    const sueldoBase = selectedEmpleado?.sueldo_base || 0;
    const horasSemanales = selectedEmpleado?.horas_laborales || 44;
    if (!sueldoBase || !horasSemanales || !horas) return 0;
    const valorHoraOrdinaria = (sueldoBase / 30) * 7 / horasSemanales;
    const valorHoraExtra = valorHoraOrdinaria * (1 + (recargo / 100));
    return Math.round(valorHoraExtra * horas);
  };

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

      const res = await client.post('/liquidaciones/', payload);
      setLiquidaciones(prev => [res.data, ...prev]);
      setShowLiqForm(false);
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

  const descargarLiquidacionPDF = async (liqId: number, mes: number, anio: number) => {
    try {
      const response = await client.get(`/liquidaciones/${liqId}/generar_pdf/`, { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `Liquidacion_${mes}_${anio}_${selectedEmpleado?.rut}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.parentNode?.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error(error);
      alert("Error descargando la liquidación. Asegúrate de tener el backend actualizado.");
    }
  };

  return {
    liquidaciones,
    setLiquidaciones,
    showLiqForm,
    setShowLiqForm,
    isGeneratingLiq,
    expandedLiqId,
    setExpandedLiqId,
    liqMes,
    setLiqMes,
    liqAnio,
    setLiqAnio,
    liqDiasTrabajados,
    setLiqDiasTrabajados,
    liqAusencias,
    setLiqAusencias,
    haberesImponiblesList,
    setHaberesImponiblesList,
    haberesNoImponiblesList,
    setHaberesNoImponiblesList,
    horasExtrasList,
    setHorasExtrasList,
    calcularValorHorasExtras,
    generarLiquidacion,
    descargarLiquidacionPDF,
  };
}
