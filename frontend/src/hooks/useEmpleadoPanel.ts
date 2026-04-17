import { useState } from 'react';
import axios from 'axios';
import client from '../api/client';
import { formatRut, validateRut } from '../utils/rutUtils';
import type { DashboardEmpleado } from '../types/dashboard';

export function useEmpleadoPanel(empresaActivaId: string | null) {
  const [isPanelOpen, setIsPanelOpen] = useState<boolean>(false);
  const [panelMode, setPanelMode] = useState<'create' | 'edit' | 'view'>('create');
  const [selectedEmpleado, setSelectedEmpleado] = useState<DashboardEmpleado | null>(null);
  const [isValidRut, setIsValidRut] = useState<boolean>(true);
  const [activeTab, setActiveTab] = useState<'perfil' | 'contratos' | 'liquidaciones' | 'legal'>('perfil');

  const [formData, setFormData] = useState<Partial<DashboardEmpleado>>({});

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
    else if (name === 'forma_pago') {
      const nuevaForma = value.toUpperCase();
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
    else {
      setFormData(prev => ({
        ...prev,
        [name]: type === 'checkbox' ? (e.target as HTMLInputElement).checked : value
      }));
    }
  };

  const guardarEmpleado = async (
    e: React.FormEvent,
    opts: {
      contratoId?: number;
      onSuccess: () => void;
    }
  ) => {
    e.preventDefault();
    if (!isValidRut || !formData.nombres || !formData.apellido_paterno) return;
    if (formData.numero_telefono && formData.numero_telefono.length > 0 && formData.numero_telefono.length < 9) {
      alert("El número de teléfono debe tener exactamente 9 dígitos (Ej: 912345678).");
      return;
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
        await client.patch(`/empleados/${selectedEmpleado.id}/`, payload);
        if (opts.contratoId) {
          try {
            await client.patch(`/contratos/${opts.contratoId}/`, {
              sueldo_base: payload.sueldo_base,
              cargo: payload.cargo
            });
          } catch (syncError) {
            console.error("No se pudo sincronizar el contrato automáticamente", syncError);
          }
        }
      } else {
        await client.post('/empleados/', payload);
      }
      setIsPanelOpen(false);
      opts.onSuccess();
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

  return {
    isPanelOpen,
    setIsPanelOpen,
    panelMode,
    setPanelMode,
    selectedEmpleado,
    setSelectedEmpleado,
    isValidRut,
    setIsValidRut,
    activeTab,
    setActiveTab,
    formData,
    setFormData,
    abrirCrear,
    handleInputChange,
    guardarEmpleado,
  };
}
