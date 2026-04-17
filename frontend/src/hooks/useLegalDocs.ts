import { useState } from 'react';
import client from '../api/client';
import type { DashboardDocumentoLegal, DashboardEmpleado } from '../types/dashboard';

export function useLegalDocs(selectedEmpleado: DashboardEmpleado | null) {
  const [documentosLegales, setDocumentosLegales] = useState<DashboardDocumentoLegal[]>([]);
  const [documentoData, setDocumentoData] = useState<Partial<DashboardDocumentoLegal>>({});
  const [showDocumentoForm, setShowDocumentoForm] = useState(false);
  const [isSavingDocumento, setIsSavingDocumento] = useState(false);

  const guardarDocumentoLegal = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingDocumento(true);
    try {
      const res = await client.post('/documentos_legales/', documentoData);
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

  const descargarDocumentoPDF = async (docId: number, tipo: string) => {
    try {
      const response = await client.get(`/documentos_legales/${docId}/generar_pdf/`, { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `${tipo}_${selectedEmpleado?.rut}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.parentNode?.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error(error);
      alert("Error descargando el documento legal.");
    }
  };

  return {
    documentosLegales,
    setDocumentosLegales,
    documentoData,
    setDocumentoData,
    showDocumentoForm,
    setShowDocumentoForm,
    isSavingDocumento,
    guardarDocumentoLegal,
    descargarDocumentoPDF,
  };
}
