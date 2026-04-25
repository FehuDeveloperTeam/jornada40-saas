import type { UseDashboardReturn } from '../../../hooks/useDashboard';

type Props = {
  panelMode: UseDashboardReturn['panelMode'];
  selectedEmpleado: UseDashboardReturn['selectedEmpleado'];
  formData: UseDashboardReturn['formData'];
  isValidRut: UseDashboardReturn['isValidRut'];
  handleInputChange: UseDashboardReturn['handleInputChange'];
  guardarEmpleado: UseDashboardReturn['guardarEmpleado'];
  setPanelMode: UseDashboardReturn['setPanelMode'];
  setFormData: UseDashboardReturn['setFormData'];
  setIsValidRut: UseDashboardReturn['setIsValidRut'];
};

const inp: React.CSSProperties = {
  width: '100%',
  background: 'rgba(255,255,255,0.06)',
  border: '1px solid rgba(255,255,255,0.1)',
  borderRadius: '0.625rem',
  padding: '0.625rem 0.75rem',
  color: '#f8fafc',
  fontSize: '0.875rem',
  outline: 'none',
};

const sel: React.CSSProperties = { ...inp, cursor: 'pointer' };

const lbl: React.CSSProperties = {
  display: 'block',
  fontSize: '0.7rem',
  fontWeight: 700,
  textTransform: 'uppercase',
  letterSpacing: '0.07em',
  color: 'rgba(255,255,255,0.4)',
  marginBottom: '0.25rem',
};

const sectionTitle: React.CSSProperties = {
  fontSize: '0.7rem',
  fontWeight: 700,
  textTransform: 'uppercase',
  letterSpacing: '0.1em',
  color: 'rgba(255,255,255,0.3)',
  borderBottom: '1px solid rgba(255,255,255,0.07)',
  paddingBottom: '0.5rem',
  marginBottom: '0',
};

export default function TabPerfil({ panelMode, selectedEmpleado, formData, isValidRut, handleInputChange, guardarEmpleado, setPanelMode, setFormData, setIsValidRut }: Props) {
  return (
    <>
      {panelMode === 'view' && selectedEmpleado ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-10">
          <div className="space-y-6">
            <h4 style={sectionTitle}>Información Personal</h4>
            <dl className="space-y-3 text-sm">
              {[
                ['Nacionalidad', selectedEmpleado.nacionalidad?.toLowerCase()],
                ['Fecha Nac.', selectedEmpleado.fecha_nacimiento],
                ['Estado Civil', selectedEmpleado.estado_civil?.toLowerCase()],
                ['Teléfono', selectedEmpleado.numero_telefono],
                ['Email', selectedEmpleado.email?.toLowerCase()],
                ['Comuna', selectedEmpleado.comuna?.toLowerCase()],
                ['Dirección', selectedEmpleado.direccion?.toLowerCase()],
              ].map(([label, value]) => (
                <div key={label} className="flex flex-col gap-0.5">
                  <dt className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'rgba(255,255,255,0.4)' }}>{label}</dt>
                  <dd className="font-semibold capitalize" style={{ color: '#f8fafc' }}>{value || '-'}</dd>
                </div>
              ))}
            </dl>
          </div>

          <div className="space-y-6">
            <h4 style={sectionTitle}>Condiciones Laborales</h4>
            <dl className="space-y-3 text-sm">
              {[
                ['Departamento', selectedEmpleado.departamento?.toLowerCase()],
                ['Centro de Costo', selectedEmpleado.centro_costo],
                ['Ficha N°', selectedEmpleado.ficha_numero?.toString()],
                ['Sucursal', selectedEmpleado.sucursal?.toLowerCase()],
                ['Fecha Ingreso', selectedEmpleado.fecha_ingreso],
                ['Modalidad', selectedEmpleado.modalidad?.toLowerCase()],
                ['Jornada', `${selectedEmpleado.horas_laborales} Hrs.`],
                ['Sueldo Base', `$${Number(selectedEmpleado.sueldo_base || 0).toLocaleString('es-CL')}`],
                ['Previsión AFP', selectedEmpleado.afp?.toLowerCase()],
                ['Salud', selectedEmpleado.sistema_salud?.toLowerCase()],
                ['Forma de Pago', selectedEmpleado.forma_pago],
                ['Banco / Cuenta', `${selectedEmpleado.banco || '-'} · ${selectedEmpleado.tipo_cuenta || '-'}`],
                ['N° Cuenta', selectedEmpleado.numero_cuenta],
              ].map(([label, value]) => (
                <div key={label} className="flex flex-col gap-0.5">
                  <dt className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'rgba(255,255,255,0.4)' }}>{label}</dt>
                  <dd className="font-semibold" style={{ color: '#f8fafc' }}>{value || '-'}</dd>
                </div>
              ))}
            </dl>
          </div>

          <div className="md:col-span-2 mt-4 flex justify-start">
            <button
              onClick={() => { setFormData({ ...selectedEmpleado! }); setIsValidRut(true); setPanelMode('edit'); }}
              className="px-4 py-2 text-sm font-semibold rounded-lg flex items-center gap-2 transition-colors"
              style={{ color: 'rgba(255,255,255,0.7)', background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.1)' }}
              onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.12)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.07)')}
            >
              <svg fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor" className="w-4 h-4"><path strokeLinecap="round" strokeLinejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0 1 15.75 21H5.25A2.25 2.25 0 0 1 3 18.75V8.25A2.25 2.25 0 0 1 5.25 6H10" /></svg>
              Editar Ficha
            </button>
          </div>
        </div>
      ) : (
        <form id="empleadoForm" onSubmit={guardarEmpleado} className="grid grid-cols-2 gap-10">
          <div className="space-y-5">
            <h4 style={sectionTitle}>Datos Personales</h4>
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <label style={lbl}>RUT *</label>
                <input type="text" name="rut" required value={formData.rut || ''} onChange={handleInputChange} placeholder="12.345.678-9"
                       style={{ ...inp, border: (!isValidRut && formData.rut) ? '1px solid rgba(239,68,68,0.6)' : '1px solid rgba(255,255,255,0.1)', background: (!isValidRut && formData.rut) ? 'rgba(239,68,68,0.08)' : 'rgba(255,255,255,0.06)' }} />
              </div>
              <div className="col-span-2">
                <label style={lbl}>Nombres *</label>
                <input type="text" name="nombres" required value={formData.nombres || ''} onChange={handleInputChange} style={inp} />
              </div>
              <div>
                <label style={lbl}>Ap. Paterno *</label>
                <input type="text" name="apellido_paterno" required value={formData.apellido_paterno || ''} onChange={handleInputChange} style={inp} />
              </div>
              <div>
                <label style={lbl}>Ap. Materno</label>
                <input type="text" name="apellido_materno" value={formData.apellido_materno || ''} onChange={handleInputChange} style={inp} />
              </div>
              <div>
                <label style={lbl}>Nacionalidad</label>
                <input type="text" name="nacionalidad" value={formData.nacionalidad || ''} onChange={handleInputChange} style={inp} />
              </div>
              <div>
                <label style={lbl}>F. Nacimiento</label>
                <input type="date" name="fecha_nacimiento" value={formData.fecha_nacimiento || ''} onChange={handleInputChange} style={{ ...inp, colorScheme: 'dark' }} />
              </div>
              <div>
                <label style={lbl}>Estado Civil</label>
                <input type="text" name="estado_civil" value={formData.estado_civil || ''} onChange={handleInputChange} style={inp} />
              </div>
              <div>
                <label style={lbl}>Teléfono</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <span className="text-sm font-medium" style={{ color: 'rgba(255,255,255,0.4)' }}>+56</span>
                  </div>
                  <input type="text" name="numero_telefono" value={formData.numero_telefono || ''} onChange={handleInputChange} placeholder="912345678"
                    style={{ ...inp, paddingLeft: '2.75rem' }} />
                </div>
              </div>
              <div className="col-span-2">
                <label style={lbl}>Comuna y Dirección</label>
                <div className="flex gap-2">
                  <input type="text" name="comuna" placeholder="Comuna" value={formData.comuna || ''} onChange={handleInputChange} style={{ ...inp, width: '33%' }} />
                  <input type="text" name="direccion" placeholder="Calle y número" value={formData.direccion || ''} onChange={handleInputChange} style={{ ...inp, width: '67%' }} />
                </div>
              </div>
            </div>
            <div className="pt-4 mt-2" style={{ borderTop: '1px solid rgba(255,255,255,0.07)' }}>
              <h5 className="text-xs font-bold mb-3" style={{ color: 'rgba(255,255,255,0.6)' }}>Datos Bancarios para Pago</h5>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label style={lbl}>Forma de Pago</label>
                  <select name="forma_pago" value={formData.forma_pago || 'TRANSFERENCIA'} onChange={handleInputChange} style={sel}>
                    <option value="TRANSFERENCIA" style={{ background: '#0c1a35' }}>Transferencia</option>
                    <option value="DEPOSITO" style={{ background: '#0c1a35' }}>Depósito</option>
                    <option value="CHEQUE" style={{ background: '#0c1a35' }}>Cheque</option>
                    <option value="EFECTIVO" style={{ background: '#0c1a35' }}>Efectivo</option>
                  </select>
                </div>
                {formData.forma_pago !== 'EFECTIVO' && formData.forma_pago !== 'CHEQUE' && (
                  <>
                    <div>
                      <label style={lbl}>Banco</label>
                      <input type="text" name="banco" value={formData.banco || ''} onChange={handleInputChange} placeholder="Ej: Banco Estado" style={inp} />
                    </div>
                    <div>
                      <label style={lbl}>Tipo de Cuenta</label>
                      <select name="tipo_cuenta" value={formData.tipo_cuenta || ''} onChange={handleInputChange} style={sel}>
                        <option value="" style={{ background: '#0c1a35' }}>Seleccione...</option>
                        <option value="Cuenta Corriente" style={{ background: '#0c1a35' }}>Cuenta Corriente</option>
                        <option value="Cuenta Vista / RUT" style={{ background: '#0c1a35' }}>Cuenta Vista / RUT</option>
                        <option value="Cuenta de Ahorro" style={{ background: '#0c1a35' }}>Cuenta de Ahorro</option>
                      </select>
                    </div>
                    <div>
                      <label style={lbl}>N° de Cuenta</label>
                      <input type="text" name="numero_cuenta" value={formData.numero_cuenta || ''} onChange={handleInputChange} style={inp} />
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>

          <div className="space-y-5">
            <h4 style={sectionTitle}>Datos Laborales</h4>
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <label style={lbl}>Cargo *</label>
                <input type="text" name="cargo" required value={formData.cargo || ''} onChange={handleInputChange} style={inp} />
              </div>
              <div>
                <label style={lbl}>Departamento</label>
                <input type="text" name="departamento" value={formData.departamento || ''} onChange={handleInputChange} style={inp} />
              </div>
              <div>
                <label style={lbl}>Sucursal</label>
                <input type="text" name="sucursal" value={formData.sucursal || ''} onChange={handleInputChange} style={inp} />
              </div>
              <div>
                <label style={lbl}>Fecha Ingreso *</label>
                <input type="date" name="fecha_ingreso" required value={formData.fecha_ingreso || ''} onChange={handleInputChange} style={{ ...inp, colorScheme: 'dark' }} />
              </div>
              <div>
                <label style={lbl}>Sueldo Base ($)</label>
                <input type="number" name="sueldo_base" value={formData.sueldo_base || ''} onChange={handleInputChange} style={inp} />
              </div>
              <div>
                <label style={lbl}>Jornada (Horas)</label>
                <input type="number" name="horas_laborales" value={formData.horas_laborales || ''} onChange={handleInputChange} style={inp} />
              </div>
              <div>
                <label style={lbl}>Modalidad</label>
                <select name="modalidad" value={formData.modalidad || 'PRESENCIAL'} onChange={handleInputChange} style={sel}>
                  <option value="PRESENCIAL" style={{ background: '#0c1a35' }}>PRESENCIAL</option>
                  <option value="REMOTO" style={{ background: '#0c1a35' }}>REMOTO</option>
                  <option value="HIBRIDO" style={{ background: '#0c1a35' }}>HÍBRIDO</option>
                </select>
              </div>
              <div>
                <label style={lbl}>AFP</label>
                <input type="text" name="afp" value={formData.afp || ''} onChange={handleInputChange} style={inp} />
              </div>
              <div>
                <label style={lbl}>Sistema de Salud</label>
                <select name="sistema_salud" value={formData.sistema_salud || ''} onChange={handleInputChange} style={sel}>
                  <option value="" style={{ background: '#0c1a35' }}>Seleccione...</option>
                  <option value="FONASA" style={{ background: '#0c1a35' }}>FONASA</option>
                  <option value="ISAPRE" style={{ background: '#0c1a35' }}>ISAPRE</option>
                </select>
              </div>
              {formData.sistema_salud === 'ISAPRE' && (
                <div className="col-span-2 p-4 rounded-xl" style={{ background: 'rgba(37,99,235,0.1)', border: '1px solid rgba(37,99,235,0.25)' }}>
                  <label style={{ ...lbl, color: '#93c5fd' }}>Valor Plan Isapre (En UF) *</label>
                  <input type="number" step="0.01" min="0" name="plan_isapre_uf" value={formData.plan_isapre_uf || ''} onChange={handleInputChange} placeholder="Ej: 2.15" style={{ ...inp, color: '#bfdbfe', fontWeight: 700 }} />
                </div>
              )}
              <div>
                <label style={lbl}>Centro de Costo</label>
                <input type="text" name="centro_costo" value={formData.centro_costo || ''} onChange={handleInputChange} placeholder="Ej: Obra Norte" style={inp} />
              </div>
              <div>
                <label style={lbl}>Ficha N°</label>
                <input type="text" name="ficha_numero" value={formData.ficha_numero || ''} onChange={handleInputChange} style={inp} />
              </div>
              <div className="col-span-2 flex items-center justify-between mt-4 p-4 rounded-xl" style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)' }}>
                <div>
                  <p className="text-sm font-semibold" style={{ color: '#f8fafc' }}>Estado del Trabajador</p>
                  <p className="text-xs mt-0.5" style={{ color: 'rgba(255,255,255,0.4)' }}>Desactivar para marcar como desvinculado</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input type="checkbox" name="activo" checked={formData.activo} onChange={handleInputChange} className="sr-only peer" />
                  <div className="w-11 h-6 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600" style={{ background: 'rgba(255,255,255,0.15)' }}></div>
                </label>
              </div>
            </div>
          </div>
        </form>
      )}
    </>
  );
}
