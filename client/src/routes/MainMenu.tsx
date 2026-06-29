import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';

export function MainMenu() {
  const navigate = useNavigate();
  const { user, logout } = useAuthStore();

  return (
    <div className="main-menu">
      <h1 className="logo">SQUARE GAME</h1>
      <p className="welcome">Hola, {user?.nickname}!</p>

      <div className="menu-buttons">
        <button className="retro-btn menu-btn" onClick={() => navigate('/play')}>
          Jugar Niveles
        </button>
        <button className="retro-btn menu-btn" onClick={() => navigate('/editor')}>
          Crear Nivel
        </button>
        <button className="retro-btn menu-btn" onClick={() => navigate('/assets')}>
          Crear Assets
        </button>
      </div>

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
