import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';

export function AuthPage() {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [nickname, setNickname] = useState('');
  const [password, setPassword] = useState('');
  const { login, register, error, loading } = useAuthStore();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (mode === 'login') await login(nickname, password);
      else await register(nickname, password);
      navigate('/');
    } catch {
      // error in store
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-box">
        <h1 className="logo">SQUARE GAME</h1>
        <p className="tagline">Crea plataformas. Dales superpoderes.</p>

        <div className="auth-tabs">
          <button
            className={`retro-btn tab ${mode === 'login' ? 'active' : ''}`}
            onClick={() => setMode('login')}
          >
            Entrar
          </button>
          <button
            className={`retro-btn tab ${mode === 'register' ? 'active' : ''}`}
            onClick={() => setMode('register')}
          >
            Registrarse
          </button>
        </div>

        <form onSubmit={handleSubmit} className="auth-form">
          <label>
            Nickname
            <input
              className="retro-input"
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              placeholder="tu_nick"
              minLength={3}
              maxLength={16}
              required
            />
          </label>
          <label>
            Contraseña
            <input
              className="retro-input"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••"
              minLength={6}
              required
            />
          </label>
          {error && <p className="error">{error}</p>}
          <button className="retro-btn primary" type="submit" disabled={loading}>
            {loading ? '...' : mode === 'login' ? 'Entrar' : 'Crear cuenta'}
          </button>
        </form>

        <p className="hint">Solo nickname y contraseña. Nada de email.</p>
      </div>
    </div>
  );
}
