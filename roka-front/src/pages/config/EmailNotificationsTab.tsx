import React, { useState, useEffect } from 'react';
import { Mail, Settings2, ToggleLeft, ToggleRight, Send, Eye, EyeOff, CheckCircle, XCircle, Clock, RefreshCw, ExternalLink } from 'lucide-react';
import {
  getEmailNotificationEventos,
  updateEmailNotificationEvento,
  getEmailSystemConfig,
  updateEmailSystemConfig,
  testEmailConnection,
  getEmailLogs,
} from '../../lib/api';

interface EmailEvento {
  id: number;
  codigo: string;
  nombre: string;
  descripcion: string;
  habilitado: boolean;
}

interface EmailLog {
  id: number;
  evento_codigo: string;
  destinatario: string;
  asunto: string;
  estado: 'enviado' | 'fallido' | 'pendiente';
  error_msg: string | null;
  created_at: string;
}

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

export default function EmailNotificationsTab() {
  const [eventos, setEventos] = useState<EmailEvento[]>([]);
  const [loadingEventos, setLoadingEventos] = useState(true);
  const [togglingCodigo, setTogglingCodigo] = useState<string | null>(null);

  const [config, setConfig] = useState<Record<string, string>>({});
  const [loadingConfig, setLoadingConfig] = useState(true);
  const [showSecrets, setShowSecrets] = useState<Record<string, boolean>>({});
  const [savingConfig, setSavingConfig] = useState(false);
  const [configSaved, setConfigSaved] = useState(false);

  const [testEmail, setTestEmail] = useState('');
  const [testLoading, setTestLoading] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; msg: string } | null>(null);

  const [logs, setLogs] = useState<EmailLog[]>([]);
  const [loadingLogs, setLoadingLogs] = useState(true);

  // Pagination & Filtering state
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;
  const [filterStatus, setFilterStatus] = useState('');
  const [filterSubject, setFilterSubject] = useState('');
  const [filterDate, setFilterDate] = useState('');

  useEffect(() => {
    loadEventos();
    loadConfig();
    loadLogs();
  }, []);

  async function loadEventos() {
    try {
      setLoadingEventos(true);
      const data = await getEmailNotificationEventos();
      setEventos(data);
    } catch {
      /* silent */
    } finally {
      setLoadingEventos(false);
    }
  }

  async function loadConfig() {
    try {
      setLoadingConfig(true);
      const data = await getEmailSystemConfig();
      setConfig(data);
    } catch {
      /* silent */
    } finally {
      setLoadingConfig(false);
    }
  }

  async function loadLogs() {
    try {
      setLoadingLogs(true);
      // Fetch more logs to allow client-side filtering/pagination
      const data = await getEmailLogs(200);
      setLogs(data);
    } catch {
      /* silent */
    } finally {
      setLoadingLogs(false);
    }
  }

  async function handleToggleEvento(codigo: string, habilitado: boolean) {
    setTogglingCodigo(codigo);
    try {
      const updated = await updateEmailNotificationEvento(codigo, habilitado);
      setEventos(prev => prev.map(e => e.codigo === codigo ? { ...e, habilitado: updated.habilitado } : e));
    } catch {
      /* silent */
    } finally {
      setTogglingCodigo(null);
    }
  }

  async function handleSaveConfig() {
    setSavingConfig(true);
    setConfigSaved(false);
    try {
      await updateEmailSystemConfig(config);
      setConfigSaved(true);
      setTimeout(() => setConfigSaved(false), 3000);
    } catch {
      /* silent */
    } finally {
      setSavingConfig(false);
    }
  }

  async function handleTest() {
    if (!testEmail) return;
    setTestLoading(true);
    setTestResult(null);
    try {
      const res = await testEmailConnection(testEmail);
      setTestResult({ ok: true, msg: res.mensaje || 'Email enviado exitosamente' });
      await loadLogs();
    } catch (err: any) {
      setTestResult({ ok: false, msg: err.message || 'Error al enviar email de prueba' });
    } finally {
      setTestLoading(false);
    }
  }

  function toggleShowSecret(key: string) {
    setShowSecrets(prev => ({ ...prev, [key]: !prev[key] }));
  }

  const secretFields = ['gmail_client_secret', 'gmail_refresh_token'];

  const configFields = [
    { key: 'gmail_user', label: 'Cuenta Gmail remitente', placeholder: 'tuempresa@gmail.com', type: 'email' },
    { key: 'from_name', label: 'Nombre visible del remitente', placeholder: 'ROKA Construcciones', type: 'text' },
    { key: 'gmail_client_id', label: 'Client ID', placeholder: '485821130387-xxx.apps.googleusercontent.com', type: 'text' },
    { key: 'gmail_client_secret', label: 'Client Secret', placeholder: 'GOCSPX-...', type: 'password' },
    { key: 'gmail_refresh_token', label: 'Refresh Token', placeholder: '1//...', type: 'password' },
  ];

  const estadoIcon = {
    enviado: <CheckCircle size={14} className="text-green-500" />,
    fallido: <XCircle size={14} className="text-red-500" />,
    pendiente: <Clock size={14} className="text-amber-500" />,
  };

  // Filtered and Paginated Logs
  const filteredLogs = logs.filter(log => {
    const matchStatus = !filterStatus || log.estado === filterStatus;
    const matchSubject = !filterSubject || log.asunto.toLowerCase().includes(filterSubject.toLowerCase()) || log.destinatario.toLowerCase().includes(filterSubject.toLowerCase());
    const matchDate = !filterDate || new Date(log.created_at).toLocaleDateString('en-CA') === filterDate;
    return matchStatus && matchSubject && matchDate;
  });

  const totalPages = Math.ceil(filteredLogs.length / itemsPerPage);
  const paginatedLogs = filteredLogs.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  // Reset page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [filterStatus, filterSubject, filterDate]);

  return (
    <div className="space-y-6">
      {/* Configuración SMTP / OAuth2 */}
      <Section title="Configuración de correo saliente (Gmail OAuth2)">
        <div className="mb-4 flex items-start gap-3 rounded-xl bg-amber-50 p-3 text-sm text-amber-800 dark:bg-amber-900/20 dark:text-amber-200">
          <Mail size={16} className="mt-0.5 flex-shrink-0" />
          <div>
            <strong>Configuración OAuth2 requerida:</strong> Necesitas un Refresh Token de Gmail.
            Ejecuta <code className="rounded bg-amber-100 px-1 py-0.5 font-mono text-xs dark:bg-amber-800/40">npx tsx scripts/gmail-oauth-setup.ts</code> en el servidor
            o usa{' '}
            <a
              href="https://developers.google.com/oauthplayground"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 font-semibold underline"
            >
              OAuth2 Playground <ExternalLink size={12} />
            </a>{' '}
            con scope <code className="rounded bg-amber-100 px-1 py-0.5 font-mono text-xs dark:bg-amber-800/40">https://mail.google.com/</code>.
          </div>
        </div>

        {loadingConfig ? (
          <div className="animate-pulse space-y-3">
            {[1, 2, 3, 4, 5].map(i => <div key={i} className="h-10 rounded-lg bg-slate-100 dark:bg-slate-700" />)}
          </div>
        ) : (
          <div className="space-y-3">
            {configFields.map(({ key, label, placeholder, type }) => {
              const isSecret = secretFields.includes(key);
              const show = showSecrets[key];
              return (
                <div key={key}>
                  <label className="mb-1 block text-xs font-semibold text-slate-600 dark:text-slate-300">{label}</label>
                  <div className="relative flex">
                    <input
                      type={isSecret && !show ? 'password' : 'text'}
                      value={config[key] || ''}
                      onChange={e => setConfig(prev => ({ ...prev, [key]: e.target.value }))}
                      placeholder={placeholder}
                      className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900 focus:border-amber-400 focus:outline-none dark:border-slate-600 dark:bg-slate-700 dark:text-white"
                    />
                    {isSecret && (
                      <button
                        type="button"
                        onClick={() => toggleShowSecret(key)}
                        className="absolute right-2 top-2.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                      >
                        {show ? <EyeOff size={14} /> : <Eye size={14} />}
                      </button>
                    )}
                  </div>
                </div>
              );
            })}

            <div className="flex items-center gap-3 pt-2">
              <button
                onClick={handleSaveConfig}
                disabled={savingConfig}
                className="flex items-center gap-2 rounded-lg bg-amber-500 px-4 py-2 text-sm font-bold text-white hover:bg-amber-600 disabled:opacity-50"
              >
                <Settings2 size={14} />
                {savingConfig ? 'Guardando...' : 'Guardar configuración'}
              </button>
              {configSaved && (
                <span className="flex items-center gap-1 text-sm font-semibold text-green-600">
                  <CheckCircle size={14} /> Guardado
                </span>
              )}
            </div>

            {/* Test */}
            <div className="mt-4 rounded-xl border border-slate-200 p-4 dark:border-slate-600">
              <p className="mb-2 text-xs font-bold text-slate-500 uppercase tracking-wide">Probar conexión</p>
              <div className="flex gap-2">
                <input
                  type="email"
                  value={testEmail}
                  onChange={e => setTestEmail(e.target.value)}
                  placeholder="destinatario@ejemplo.com"
                  className="flex-1 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm focus:border-amber-400 focus:outline-none dark:border-slate-600 dark:bg-slate-700 dark:text-white"
                />
                <button
                  onClick={handleTest}
                  disabled={testLoading || !testEmail}
                  className="flex items-center gap-2 rounded-lg bg-slate-700 px-4 py-2 text-sm font-bold text-white hover:bg-slate-800 disabled:opacity-50 dark:bg-slate-600"
                >
                  <Send size={14} />
                  {testLoading ? 'Enviando...' : 'Probar'}
                </button>
              </div>
              {testResult && (
                <div className={`mt-2 flex items-center gap-2 text-sm font-medium ${testResult.ok ? 'text-green-600' : 'text-red-600'}`}>
                  {testResult.ok ? <CheckCircle size={14} /> : <XCircle size={14} />}
                  {testResult.msg}
                </div>
              )}
            </div>
          </div>
        )}
      </Section>

      {/* Eventos de notificación */}
      <Section title="Eventos de notificación">
        {loadingEventos ? (
          <div className="animate-pulse space-y-3">
            {[1, 2, 3, 4, 5].map(i => <div key={i} className="h-14 rounded-lg bg-slate-100 dark:bg-slate-700" />)}
          </div>
        ) : (
          <div className="space-y-3">
            {eventos.map(evento => (
              <div
                key={evento.codigo}
                className="flex items-start justify-between gap-4 rounded-xl border border-slate-100 p-4 dark:border-slate-800"
              >
                <div className="flex-1">
                  <p className="text-sm font-bold text-slate-800 dark:text-white">{evento.nombre}</p>
                  {evento.descripcion && (
                    <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">{evento.descripcion}</p>
                  )}
                  <span className="mt-1.5 inline-block rounded-full bg-slate-100 px-2 py-0.5 font-mono text-[10px] text-slate-500 dark:bg-slate-700">
                    {evento.codigo}
                  </span>
                </div>
                <div className="flex items-center gap-2 pt-0.5">
                  {togglingCodigo === evento.codigo && (
                    <RefreshCw size={12} className="animate-spin text-slate-400" />
                  )}
                  <Toggle
                    checked={evento.habilitado}
                    onChange={(v) => handleToggleEvento(evento.codigo, v)}
                  />
                  {evento.habilitado
                    ? <ToggleRight size={16} className="text-amber-500" />
                    : <ToggleLeft size={16} className="text-slate-400" />
                  }
                </div>
              </div>
            ))}
          </div>
        )}
      </Section>

      {/* Log de envíos */}
      <Section title="Historial de envíos recientes">
        <div className="mb-4 flex flex-col gap-4 sm:flex-row sm:items-end justify-between">
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3 flex-1">
            <div>
              <label className="mb-1 block text-[10px] font-bold uppercase text-slate-400">Estado</label>
              <select
                value={filterStatus}
                onChange={e => setFilterStatus(e.target.value)}
                className="w-full rounded-lg border border-slate-200 bg-slate-50 px-2 py-1.5 text-xs dark:border-slate-700 dark:bg-slate-800 dark:text-white"
              >
                <option value="">Todos</option>
                <option value="enviado">Enviado</option>
                <option value="fallido">Fallido</option>
                <option value="pendiente">Pendiente</option>
              </select>
            </div>
            <div>
              <label className="mb-1 block text-[10px] font-bold uppercase text-slate-400">Buscar asunto/dest.</label>
              <input
                type="text"
                value={filterSubject}
                onChange={e => setFilterSubject(e.target.value)}
                placeholder="Filtrar..."
                className="w-full rounded-lg border border-slate-200 bg-slate-50 px-2 py-1.5 text-xs dark:border-slate-700 dark:bg-slate-800 dark:text-white"
              />
            </div>
            <div>
              <label className="mb-1 block text-[10px] font-bold uppercase text-slate-400">Fecha</label>
              <input
                type="date"
                value={filterDate}
                onChange={e => setFilterDate(e.target.value)}
                className="w-full rounded-lg border border-slate-200 bg-slate-50 px-2 py-1.5 text-xs dark:border-slate-700 dark:bg-slate-800 dark:text-white"
              />
            </div>
          </div>
          <button
            onClick={loadLogs}
            className="flex items-center gap-1 text-xs font-semibold text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
          >
            <RefreshCw size={12} className={loadingLogs ? 'animate-spin' : ''} />
            Actualizar
          </button>
        </div>

        {loadingLogs ? (
          <div className="animate-pulse space-y-2">
            {[1, 2, 3, 4, 5].map(i => <div key={i} className="h-10 rounded bg-slate-100 dark:bg-slate-700" />)}
          </div>
        ) : filteredLogs.length === 0 ? (
          <p className="py-12 text-center text-sm text-slate-400 border rounded-xl border-dashed dark:border-slate-800">No hay registros que coincidan con los filtros</p>
        ) : (
          <div className="space-y-4">
            <div className="overflow-x-auto rounded-xl border border-slate-100 dark:border-slate-800 max-h-[450px] overflow-y-auto custom-scrollbar">
              <table className="w-full text-xs">
                <thead className="sticky top-0 z-10 bg-slate-50 dark:bg-slate-900">
                  <tr className="border-b border-slate-100 dark:border-slate-800">
                    <th className="px-3 py-2.5 text-left font-bold text-slate-500">Estado</th>
                    <th className="px-3 py-2.5 text-left font-bold text-slate-500">Evento</th>
                    <th className="px-3 py-2.5 text-left font-bold text-slate-500">Destinatario</th>
                    <th className="px-3 py-2.5 text-left font-bold text-slate-500">Asunto</th>
                    <th className="px-3 py-2.5 text-left font-bold text-slate-500">Fecha</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedLogs.map(log => (
                    <tr key={log.id} className="border-b border-slate-50 dark:border-slate-800/50 last:border-0 hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors">
                      <td className="px-3 py-2.5">
                        <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold
                          ${log.estado === 'enviado' ? 'bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-400' :
                            log.estado === 'fallido' ? 'bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-400' :
                            'bg-amber-50 text-amber-700 dark:bg-amber-900/20 dark:text-amber-400'}`}
                        >
                          {estadoIcon[log.estado as keyof typeof estadoIcon]}
                          {log.estado}
                        </span>
                      </td>
                      <td className="px-3 py-2.5 font-mono text-[10px] text-slate-500">{log.evento_codigo || '-'}</td>
                      <td className="px-3 py-2.5 text-slate-600 dark:text-slate-300 truncate max-w-[150px]" title={log.destinatario}>{log.destinatario}</td>
                      <td className="px-3 py-2.5 max-w-[250px] truncate text-slate-600 dark:text-slate-200 font-medium" title={log.asunto}>
                        {log.asunto}
                      </td>
                      <td className="px-3 py-2.5 text-slate-400 whitespace-nowrap">
                        {new Date(log.created_at).toLocaleString('es-CL', { dateStyle: 'short', timeStyle: 'short' })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination controls */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between pt-2">
                <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
                  Página {currentPage} de {totalPages} ({filteredLogs.length} resultados)
                </p>
                <div className="flex gap-2">
                  <button
                    disabled={currentPage === 1}
                    onClick={() => setCurrentPage(p => p - 1)}
                    className="rounded-lg border border-slate-200 px-3 py-1 text-xs font-bold text-slate-600 hover:bg-slate-50 disabled:opacity-30 dark:border-slate-700 dark:text-slate-400 dark:hover:bg-slate-800"
                  >
                    Anterior
                  </button>
                  <button
                    disabled={currentPage === totalPages}
                    onClick={() => setCurrentPage(p => p + 1)}
                    className="rounded-lg border border-slate-200 px-3 py-1 text-xs font-bold text-slate-600 hover:bg-slate-50 disabled:opacity-30 dark:border-slate-700 dark:text-slate-400 dark:hover:bg-slate-800"
                  >
                    Siguiente
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </Section>
    </div>
  );
}
