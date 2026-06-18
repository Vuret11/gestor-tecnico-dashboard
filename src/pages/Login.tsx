import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { auth } from '../api/endpoints';

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const data = await auth.login(email, password);
      login(data.access_token, data.user);
      navigate('/');
    } catch {
      setError('Email o contraseña incorrectos');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-screen bg-slate-100 flex items-center justify-center">
      <div className="bg-white rounded-2xl shadow-lg border border-slate-200 w-full max-w-sm overflow-hidden">
        {/* Cabecera con logo */}
        <div className="bg-slate-900 px-8 py-8 flex flex-col items-center">
          <img
            src="https://homeservesolar.es/wp-content/uploads/2024/07/HomeServe-Solar-brand-blanco.svg"
            alt="HomeServe Solar"
            className="h-10 w-auto"
            onError={e => {
              (e.currentTarget as HTMLImageElement).style.display = 'none';
            }}
          />
          <p className="text-slate-400 text-xs mt-2 tracking-widest uppercase">Panel de gestión</p>
        </div>

        {/* Formulario */}
        <div className="px-8 py-8">
          <h1 className="text-lg font-semibold text-slate-900 mb-1">Acceder</h1>
          <p className="text-sm text-slate-500 mb-6">Introduce tus credenciales para continuar</p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Email</label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                className="w-full border border-slate-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand focus:border-brand transition-colors"
                placeholder="usuario@empresa.com"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Contraseña</label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                className="w-full border border-slate-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand focus:border-brand transition-colors"
              />
            </div>
            {error && (
              <p className="text-sm text-brand bg-brand-muted border border-brand/20 rounded-lg px-3 py-2">
                {error}
              </p>
            )}
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-brand hover:bg-brand-dark text-white rounded-lg py-2.5 text-sm font-semibold disabled:opacity-50 transition-colors mt-2"
            >
              {loading ? 'Accediendo...' : 'Entrar'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
