import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { KeyRound, User as UserIcon, AlertCircle, ArrowRight } from 'lucide-react';

export const Login: React.FC = () => {
  const { login, user } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  // Redirect if already logged in
  React.useEffect(() => {
    if (user) {
      navigate('/');
    }
  }, [user, navigate]);

  const from = location.state?.from?.pathname || '/';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username || !password) {
      setError('Please fill in all fields.');
      return;
    }

    setError(null);
    setLoading(true);

    try {
      await login(username, password);
      navigate(from, { replace: true });
    } catch (err: any) {
      setError(err.message || 'Invalid username or password.');
    } finally {
      setLoading(false);
    }
  };

  // Helper shortcut to auto-fill accounts for testing
  const handleQuickFill = (u: string) => {
    setUsername(u);
    setPassword('password123');
    setError(null);
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-950 px-4 py-12 sm:px-6 lg:px-8 relative overflow-hidden">
      {/* Background radial glow */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-sky-500/10 rounded-full blur-[120px] pointer-events-none"></div>

      <div className="w-full max-w-md space-y-8 relative z-10">
        <div className="flex flex-col items-center text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-tr from-sky-500 to-indigo-600 shadow-xl shadow-sky-500/20">
            <span className="text-2xl font-black text-white">IP</span>
          </div>
          <h2 className="mt-6 text-3xl font-extrabold tracking-tight text-white">Sign in to PayTrack</h2>
          <p className="mt-2 text-sm text-slate-400">Invoice Approval & Payment Tracking</p>
        </div>

        <div className="rounded-2xl border border-slate-800 bg-slate-900/50 p-8 shadow-2xl backdrop-blur-md">
          {error && (
            <div className="mb-6 flex items-start space-x-2 rounded-lg border border-rose-500/20 bg-rose-500/10 p-3 text-sm text-rose-400">
              <AlertCircle className="h-5 w-5 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <form className="space-y-6" onSubmit={handleSubmit}>
            <div>
              <label htmlFor="username" className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
                Username
              </label>
              <div className="relative">
                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-slate-500">
                  <UserIcon className="h-5 w-5" />
                </div>
                <input
                  id="username"
                  name="username"
                  type="text"
                  required
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="block w-full rounded-lg border border-slate-800 bg-slate-950/50 py-2.5 pl-10 pr-3 text-white placeholder-slate-500 outline-none ring-offset-slate-950 focus:border-sky-500 focus:ring-1 focus:ring-sky-500 sm:text-sm"
                  placeholder="Enter your username"
                />
              </div>
            </div>

            <div>
              <label htmlFor="password" className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
                Password
              </label>
              <div className="relative">
                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-slate-500">
                  <KeyRound className="h-5 w-5" />
                </div>
                <input
                  id="password"
                  name="password"
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="block w-full rounded-lg border border-slate-800 bg-slate-950/50 py-2.5 pl-10 pr-3 text-white placeholder-slate-500 outline-none ring-offset-slate-950 focus:border-sky-500 focus:ring-1 focus:ring-sky-500 sm:text-sm"
                  placeholder="••••••••"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="flex w-full items-center justify-center space-x-2 rounded-lg bg-gradient-to-r from-sky-500 to-indigo-500 py-3 text-sm font-semibold text-white shadow-lg shadow-sky-500/20 hover:from-sky-400 hover:to-indigo-400 focus:outline-none focus:ring-2 focus:ring-sky-500 focus:ring-offset-2 focus:ring-offset-slate-950 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <div className="h-5 w-5 animate-spin rounded-full border-2 border-white border-t-transparent"></div>
              ) : (
                <>
                  <span>Sign In</span>
                  <ArrowRight className="h-4 w-4" />
                </>
              )}
            </button>
          </form>

          {/* Quick Fills */}
          <div className="mt-8 border-t border-slate-800/80 pt-6">
            <h3 className="text-xs font-bold uppercase tracking-widest text-slate-500 mb-3">Quick Fill Demo Accounts</h3>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
              <button
                type="button"
                onClick={() => handleQuickFill('submitter_user')}
                className="rounded-lg border border-slate-800 bg-slate-950/30 px-3 py-2 text-left text-xs hover:border-emerald-500/30 hover:bg-emerald-500/5 hover:text-emerald-400"
              >
                <p className="font-semibold">Submitter</p>
                <p className="text-[10px] text-slate-500">submitter_user</p>
              </button>
              <button
                type="button"
                onClick={() => handleQuickFill('approver_1')}
                className="rounded-lg border border-slate-800 bg-slate-950/30 px-3 py-2 text-left text-xs hover:border-amber-500/30 hover:bg-amber-500/5 hover:text-amber-400"
              >
                <p className="font-semibold">Approver 1</p>
                <p className="text-[10px] text-slate-500">approver_1</p>
              </button>
              <button
                type="button"
                onClick={() => handleQuickFill('finance_admin')}
                className="rounded-lg border border-slate-800 bg-slate-950/30 px-3 py-2 text-left text-xs hover:border-rose-500/30 hover:bg-rose-500/5 hover:text-rose-400"
              >
                <p className="font-semibold">Finance Admin</p>
                <p className="text-[10px] text-slate-500">finance_admin</p>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
