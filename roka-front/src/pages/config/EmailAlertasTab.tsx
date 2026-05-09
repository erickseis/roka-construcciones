import React, { useState, useEffect } from 'react';
import { Bell, Clock, Calendar, Users, Save, ToggleLeft, ToggleRight, CheckCircle, X, Plus } from 'lucide-react';
import { getEmailAlertasConfig, updateEmailAlertasConfig, getUsuariosAlertas, type AlertaEmailConfig, type UsuarioAlerta } from '../../lib/api';

function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none
        ${checked ? 'bg-amber-500' : 'bg-slate-300 dark:bg-slate-600'}`}
      role="switch"
      aria-checked={checked}
    >
      <span
        className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200
          ${checked ? 'translate-x-5' : 'translate-x-0'}`}
      />
    </button>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-[#111827]/40">
      <h3 className="mb-4 text-sm font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">{title}</h3>
      {children}
    </div>
  );
}

export default function EmailAlertasTab() {
  const [config, setConfig] = useState<AlertaEmailConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [usuarios, setUsuarios] = useState<UsuarioAlerta[]>([]);
  const [loadingUsuarios, setLoadingUsuarios] = useState(true);
  const [showModal, setShowModal] = useState(false);

  // Form state
  const [habilitada, setHabilitada] = useState(false);
  const [umbralTipo, setUmbralTipo] = useState<'horas' | 'dias'>('horas');
  const [umbralValor, setUmbralValor] = useState(24);
  const [recordatoriosHabilitados, setRecordatoriosHabilitados] = useState(false);
  const [recordatoriosCantidad, setRecordatoriosCantidad] = useState(3);
  const [recordatoriosFrecuencia, setRecordatoriosFrecuencia] = useState(24);
  const [destinatarioIds, setDestinatarioIds] = useState<number[]>([]);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    try {
      setLoading(true);
      const [configData, usuariosData] = await Promise.all([
        getEmailAlertasConfig(),
        getUsuariosAlertas(),
      ]);
      setConfig(configData);
      setUsuarios(usuariosData);

      // Set form state from config
      setHabilitada(configData.habilitada);
      setUmbralTipo(configData.umbral_tipo);
      setUmbralValor(configData.umbral_valor);
      setRecordatoriosHabilitados(configData.recordatorios_habilitados);
      setRecordatoriosCantidad(configData.recordatorios_cantidad);
      setRecordatoriosFrecuencia(configData.recordatorios_frecuencia_hs);
      setDestinatarioIds(configData.destinatarios_usuario_ids || []);
    } catch {
      /* silent */
    } finally {
      setLoading(false);
      setLoadingUsuarios(false);
    }
  }

  async function handleSave() {
    setSaving(true);
    setSaved(false);
    setError(null);

    // Validación: al menos 1 destinatario si está habilitada
    if (habilitada && destinatarioIds.length === 0) {
      setError('Debes seleccionar al menos un destinatario');
      setSaving(false);
      return;
    }

    try {
      const updated = await updateEmailAlertasConfig({
        habilitada,
        umbral_tipo: umbralTipo,
        umbral_valor: umbralValor,
        recordatorios_habilitados: recordatoriosHabilitados,
        recordatorios_cantidad: recordatoriosCantidad,
        recordatorios_frecuencia_hs: recordatoriosFrecuencia,
        destinatarios_usuario_ids: destinatarioIds,
      });
      setConfig(updated);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err: any) {
      setError(err.message || 'Error al guardar');
    } finally {
      setSaving(false);
    }
  }

  function toggleUsuario(id: number) {
    setDestinatarioIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  }

  const selectedUsuarios = usuarios.filter(u => destinatarioIds.includes(u.id));

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="animate-pulse space-y-4">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-40 rounded-2xl bg-slate-100 dark:bg-slate-700" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Sección: Configuración de Alertas */}
      <Section title="Configuración de Alertas">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Bell size={20} className="text-amber-500" />
            <span className="font-semibold text-slate-800 dark:text-white">Habilitar alertas de fecha de entrega</span>
          </div>
          <div className="flex items-center gap-2">
            <Toggle checked={habilitada} onChange={setHabilitada} />
            {habilitada
              ? <ToggleRight size={16} className="text-amber-500" />
              : <ToggleLeft size={16} className="text-slate-400" />
            }
          </div>
        </div>

        {habilitada && (
          <div className="mt-6 space-y-4">
            <div className="flex items-center gap-4">
              <div className="flex-1">
                <label className="mb-1 block text-xs font-semibold text-slate-600 dark:text-slate-300">
                  Tipo de umbral
                </label>
                <select
                  value={umbralTipo}
                  onChange={e => setUmbralTipo(e.target.value as 'horas' | 'dias')}
                  className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm focus:border-amber-400 focus:outline-none dark:border-slate-600 dark:bg-slate-700 dark:text-white"
                >
                  <option value="horas">Horas</option>
                  <option value="dias">Días</option>
                </select>
              </div>
              <div className="flex-1">
                <label className="mb-1 block text-xs font-semibold text-slate-600 dark:text-slate-300">
                  Valor del umbral
                </label>
                <input
                  type="number"
                  min={1}
                  value={umbralValor}
                  onChange={e => setUmbralValor(Math.max(1, parseInt(e.target.value) || 1))}
                  className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm focus:border-amber-400 focus:outline-none dark:border-slate-600 dark:bg-slate-700 dark:text-white"
                />
              </div>
            </div>
            <div className="flex items-start gap-2 rounded-lg bg-slate-50 p-3 text-sm text-slate-600 dark:bg-slate-800/50 dark:text-slate-300">
              <Calendar size={16} className="mt-0.5 flex-shrink-0 text-slate-400" />
              <p>Se enviará una alerta <strong>{umbralValor} {umbralTipo}</strong> antes de la fecha requerida de cada solicitud.</p>
            </div>
          </div>
        )}
      </Section>

      {/* Sección: Recordatorios */}
      <Section title="Recordatorios">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Clock size={20} className="text-amber-500" />
            <span className="font-semibold text-slate-800 dark:text-white">Habilitar recordatorios</span>
          </div>
          <div className="flex items-center gap-2">
            <Toggle checked={recordatoriosHabilitados} onChange={setRecordatoriosHabilitados} />
            {recordatoriosHabilitados
              ? <ToggleRight size={16} className="text-amber-500" />
              : <ToggleLeft size={16} className="text-slate-400" />
            }
          </div>
        </div>

        {recordatoriosHabilitados && (
          <div className="mt-6 space-y-4">
            <div className="flex items-center gap-4">
              <div className="flex-1">
                <label className="mb-1 block text-xs font-semibold text-slate-600 dark:text-slate-300">
                  Cantidad de recordatorios
                </label>
                <input
                  type="number"
                  min={1}
                  max={30}
                  value={recordatoriosCantidad}
                  onChange={e => setRecordatoriosCantidad(Math.min(30, Math.max(1, parseInt(e.target.value) || 1)))}
                  className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm focus:border-amber-400 focus:outline-none dark:border-slate-600 dark:bg-slate-700 dark:text-white"
                />
              </div>
              <div className="flex-1">
                <label className="mb-1 block text-xs font-semibold text-slate-600 dark:text-slate-300">
                  Frecuencia (horas)
                </label>
                <input
                  type="number"
                  min={1}
                  max={168}
                  value={recordatoriosFrecuencia}
                  onChange={e => setRecordatoriosFrecuencia(Math.min(168, Math.max(1, parseInt(e.target.value) || 1)))}
                  className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm focus:border-amber-400 focus:outline-none dark:border-slate-600 dark:bg-slate-700 dark:text-white"
                />
              </div>
            </div>
            <div className="flex items-start gap-2 rounded-lg bg-slate-50 p-3 text-sm text-slate-600 dark:bg-slate-800/50 dark:text-slate-300">
              <Clock size={16} className="mt-0.5 flex-shrink-0 text-slate-400" />
              <p>Se enviarán <strong>{recordatoriosCantidad}</strong> recordatorios cada <strong>{recordatoriosFrecuencia} horas</strong> después de la alerta inicial.</p>
            </div>
          </div>
        )}
      </Section>

      {/* Sección: Destinatarios */}
      <Section title="Destinatarios">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Users size={20} className="text-amber-500" />
            <span className="font-semibold text-slate-800 dark:text-white">Usuarios que recibirán las alertas</span>
          </div>
          <button
            onClick={() => setShowModal(true)}
            className="flex items-center gap-1 rounded-lg bg-slate-100 px-3 py-1.5 text-sm font-semibold text-slate-700 hover:bg-slate-200 dark:bg-slate-700 dark:text-slate-200 dark:hover:bg-slate-600"
          >
            <Plus size={14} />
            Seleccionar usuarios
          </button>
        </div>

        {/* Tags de usuarios seleccionados */}
        {selectedUsuarios.length > 0 ? (
          <div className="mt-4 flex flex-wrap gap-2">
            {selectedUsuarios.map(u => (
              <span
                key={u.id}
                className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-3 py-1 text-sm font-medium text-amber-800 dark:bg-amber-900/30 dark:text-amber-200"
              >
                {u.nombre} {u.apellido}
                <button
                  onClick={() => toggleUsuario(u.id)}
                  className="ml-1 rounded-full p-0.5 hover:bg-amber-200 dark:hover:bg-amber-800"
                >
                  <X size={12} />
                </button>
              </span>
            ))}
          </div>
        ) : (
          <p className="mt-4 text-sm text-slate-400">No hay destinatarios seleccionados</p>
        )}
      </Section>

      {/* Botón Guardar */}
      <div className="flex items-center gap-4">
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-2 rounded-lg bg-amber-500 px-6 py-2.5 text-sm font-bold text-white hover:bg-amber-600 disabled:opacity-50"
        >
          <Save size={16} />
          {saving ? 'Guardando...' : 'Guardar configuración'}
        </button>
        {saved && (
          <span className="flex items-center gap-1 text-sm font-semibold text-green-600">
            <CheckCircle size={14} /> Guardado
          </span>
        )}
        {error && (
          <span className="text-sm font-medium text-red-600">{error}</span>
        )}
      </div>

      {/* Modal de selección de usuarios */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 dark:bg-slate-800">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-bold text-slate-800 dark:text-white">Seleccionar destinatarios</h3>
              <button
                onClick={() => setShowModal(false)}
                className="rounded-full p-1 hover:bg-slate-100 dark:hover:bg-slate-700"
              >
                <X size={20} className="text-slate-500" />
              </button>
            </div>

            {loadingUsuarios ? (
              <div className="animate-pulse space-y-2">
                {[1, 2, 3, 4, 5].map(i => (
                  <div key={i} className="h-12 rounded-lg bg-slate-100 dark:bg-slate-700" />
                ))}
              </div>
            ) : usuarios.length === 0 ? (
              <p className="py-6 text-center text-sm text-slate-400">No hay usuarios disponibles</p>
            ) : (
              <div className="max-h-64 space-y-2 overflow-y-auto">
                {usuarios.map(u => (
                  <label
                    key={u.id}
                    className={`flex cursor-pointer items-center gap-3 rounded-lg p-3 transition-colors
                      ${destinatarioIds.includes(u.id) ? 'bg-amber-50 dark:bg-amber-900/20' : 'hover:bg-slate-50 dark:hover:bg-slate-700/50'}`}
                  >
                    <input
                      type="checkbox"
                      checked={destinatarioIds.includes(u.id)}
                      onChange={() => toggleUsuario(u.id)}
                      className="h-4 w-4 rounded border-slate-300 text-amber-500 focus:ring-amber-500"
                    />
                    <div className="flex-1">
                      <p className="font-medium text-slate-800 dark:text-white">{u.nombre} {u.apellido}</p>
                      <p className="text-xs text-slate-500">{u.correo}</p>
                    </div>
                  </label>
                ))}
              </div>
            )}

            <div className="mt-4 flex justify-end gap-2">
              <button
                onClick={() => setShowModal(false)}
                className="rounded-lg px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-700"
              >
                Cancelar
              </button>
              <button
                onClick={() => setShowModal(false)}
                className="rounded-lg bg-amber-500 px-4 py-2 text-sm font-bold text-white hover:bg-amber-600"
              >
                Aceptar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}