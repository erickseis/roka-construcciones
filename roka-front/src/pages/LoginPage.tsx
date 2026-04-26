import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { motion } from 'motion/react';
import { Lock, Mail, ChevronRight, AlertCircle, Construction } from 'lucide-react';
import logoRoka from '../assets/image.png';

export default function LoginPage() {
  const [correo, setCorreo] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await login({ correo, password });
      navigate('/');
    } catch (err: any) {
      setError(err.message || 'Credenciales incorrectas');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 p-6">
      <div className="flex w-full max-w-5xl overflow-hidden rounded-3xl bg-white shadow-2xl shadow-slate-200">
        
        {/* Visual Side */}
        <div className="hidden w-1/2 bg-slate-900 p-12 lg:flex lg:flex-col lg:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded bg-slate-800 text-amber-500">
              <img src={logoRoka} alt="Logo" className="h-full w-full object-cover" />
            </div>
            <h1 className="font-headline text-lg font-black uppercase tracking-tight text-white">
              Roka Construcciones
            </h1>
          </div>

          <div>
            <h2 className="text-4xl font-black leading-tight text-white mb-6">
              Gestión Inteligente <br />
              <span className="text-amber-500 italic">para Proyectos</span>
            </h2>
            <div className="space-y-4">
              {[
                'Control de Materiales',
                'Gestión de Cotizaciones',
                'Órdenes de Compra',
                'Administración de Personal'
              ].map(item => (
                <div key={item} className="flex items-center gap-3 text-slate-400">
                  <div className="h-1.5 w-1.5 rounded-full bg-amber-500"></div>
                  <span className="text-sm font-medium">{item}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-2xl border border-slate-800 bg-slate-800/50 p-6 flex items-center gap-4">
            <div className="h-12 w-12 rounded-full border-2 border-amber-500/20 flex items-center justify-center text-amber-500">
              <Construction size={24} />
            </div>
            <div>
              <p className="text-xs font-bold text-white tracking-widest uppercase mb-0.5">Estado del Sistema</p>
              <p className="text-[10px] text-slate-500">Versión 2.0.4 • Sincronizado con Obra</p>
            </div>
          </div>
        </div>

        {/* Form Side */}
        <div className="w-full p-12 lg:w-1/2">
          <div className="mx-auto max-w-sm">
            <div className="mb-10 text-center lg:text-left">
              <h3 className="text-3xl font-black tracking-tight text-slate-900">Iniciar Sesión</h3>
              <p className="mt-2 text-sm text-slate-500">Ingresa tus credenciales para acceder al sistema administrativo.</p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
              {error && (
                <motion.div 
                  initial={{ opacity: 0, y: -10 }} 
                  animate={{ opacity: 1, y: 0 }}
                  className="flex items-center gap-2 rounded-xl bg-red-50 p-4 text-xs font-bold text-red-600 border border-red-100"
                >
                  <AlertCircle size={14} />
                  {error}
                </motion.div>
              )}

              <div className="space-y-1.5">
                <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Correo Corporativo</label>
                <div className="relative flex items-center">
                  <Mail className="absolute left-3 text-slate-400" size={18} />
                  <input
                    required
                    type="email"
                    value={correo}
                    onChange={(e) => setCorreo(e.target.value)}
                    placeholder="ejemplo@roka.cl"
                    title="Correo corporativo institucional para acceder al sistema de gestión de compras"
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 py-3 pl-11 pr-4 text-sm text-black outline-none transition-all placeholder:text-black focus:border-amber-400 focus:ring-4 focus:ring-amber-100"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Contraseña</label>
                  <a href="#" className="text-[10px] font-bold text-amber-600 hover:underline">¿Olvidaste tu contraseña?</a>
                </div>
                <div className="relative flex items-center">
                  <Lock className="absolute left-3 text-slate-400" size={18} />
                  <input
                    required
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    title="Contraseña de acceso al sistema, mínimo 6 caracteres"
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 py-3 pl-11 pr-4 text-sm text-black outline-none transition-all placeholder:text-black focus:border-amber-400 focus:ring-4 focus:ring-amber-100"
                  />
                </div>
              </div>

              <div className="flex items-center gap-2 pt-2">
                <input type="checkbox" id="remember" className="rounded-md border-slate-300 text-amber-500 focus:ring-amber-400" title="Mantener la sesión activa para no tener que ingresar credenciales en cada visita" />
                <label htmlFor="remember" className="text-xs font-medium text-slate-500">Recordar mi sesión</label>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="group flex w-full items-center justify-center gap-2 rounded-2xl bg-amber-500 py-3.5 text-sm font-black text-white shadow-xl shadow-amber-500/30 transition-all hover:bg-amber-600 hover:translate-y-[-2px] active:scale-[0.98] disabled:opacity-60"
              >
                {loading ? 'Accediendo...' : 'Entrar al Sistema'}
                <ChevronRight className="transition-transform group-hover:translate-x-1" size={18} />
              </button>
            </form>

            <div className="mt-12 text-center">
              <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 opacity-50">
                Soporte Técnico Stitch IT
              </p>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
