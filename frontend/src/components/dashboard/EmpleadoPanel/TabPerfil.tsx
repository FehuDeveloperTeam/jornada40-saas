import type { UseDashboardReturn } from '../../../hooks/useDashboard';

type Props = {
  panelMode: UseDashboardReturn['panelMode'];
  selectedEmpleado: UseDashboardReturn['selectedEmpleado'];
  formData: UseDashboardReturn['formData'];
  isValidRut: UseDashboardReturn['isValidRut'];
  handleInputChange: UseDashboardReturn['handleInputChange'];
  guardarEmpleado: UseDashboardReturn['guardarEmpleado'];
};

export default function TabPerfil({ panelMode, selectedEmpleado, formData, isValidRut, handleInputChange, guardarEmpleado }: Props) {
  return (
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
                  <select name="forma_pago" value={formData.forma_pago || 'TRANSFERENCIA'} onChange={handleInputChange} className="w-full px-3 py-2.5 rounded-xl border border-slate-200 bg-white outline-none font-medium uppercase">
                    <option value="TRANSFERENCIA">Transferencia</option>
                    <option value="DEPOSITO">Depósito</option>
                    <option value="CHEQUE">Cheque</option>
                    <option value="EFECTIVO">Efectivo</option>
                  </select>
                </div>
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
              </div>
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
  );
}
