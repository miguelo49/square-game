import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { OnboardingOverlay } from '../components/OnboardingOverlay';

export function MainMenu() {
  const navigate = useNavigate();
  const { user, logout } = useAuthStore();

  return (
    <div className="main-menu">
      <OnboardingOverlay />
      <h1 className="logo">SQUARE GAME</h1>
      <p className="welcome">Hola, {user?.nickname}!</p>
      <p className="tagline">Crea plataformas. Configura superpoderes. Comparte con la comunidad.</p>

      <div className="menu-buttons">
        <button className="retro-btn menu-btn" onClick={() => navigate('/play')}>
          Jugar Niveles
        </button>
        <button className="retro-btn menu-btn" onClick={() => navigate('/editor')}>
          Crear Nivel
        </button>
        <button className="retro-btn menu-btn" onClick={() => navigate('/assets')}>
          Biblioteca · Assets
        </button>
        <button className="retro-btn menu-btn" onClick={() => navigate('/music')}>
          Biblioteca · Música
        </button>
        <button className="retro-btn menu-btn" onClick={() => navigate('/skills')}>
          Biblioteca · Habilidades
        </button>
        <button className="retro-btn menu-btn" onClick={() => navigate('/community')}>
          Comunidad
        </button>
      </div>

      <p className="hint">
        Jugar = tu biblioteca · Comunidad = explorar contenido público
      </p>

      <button
        className="retro-btn secondary logout-btn"
        onClick={async () => {
          await logout();
          navigate('/auth');
        }}
      >
        Cerrar sesión
      </button>
    </div>
  );
}
