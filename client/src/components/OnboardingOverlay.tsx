import { useState } from 'react';

const STEPS = [
  'Coloca plataformas con la herramienta ▬',
  'Añade enemigos △ y define spawn ★ y portal ◉',
  'Asigna habilidades en el panel Nivel',
  'Playtest con ▶ y completa el nivel',
  'Guarda y comparte en Comunidad',
];

export function OnboardingOverlay() {
  const [step, setStep] = useState(() => {
    if (localStorage.getItem('sq-onboarding-done')) return -1;
    return 0;
  });

  if (step < 0) return null;

  const finish = () => {
    localStorage.setItem('sq-onboarding-done', '1');
    setStep(-1);
  };

  return (
    <div className="onboarding-overlay">
      <div className="onboarding-box">
        <h2>Bienvenido a Square Game</h2>
        <p>{STEPS[step]}</p>
        <p className="hint">
          Paso {step + 1} de {STEPS.length}
        </p>
        <div className="btn-row" style={{ justifyContent: 'center' }}>
          {step > 0 && (
            <button className="retro-btn" onClick={() => setStep((s) => s - 1)}>
              Anterior
            </button>
          )}
          {step < STEPS.length - 1 ? (
            <button className="retro-btn primary" onClick={() => setStep((s) => s + 1)}>
              Siguiente
            </button>
          ) : (
            <button className="retro-btn primary" onClick={finish}>
              ¡Empezar!
            </button>
          )}
          <button className="retro-btn secondary" onClick={finish}>
            Saltar
          </button>
        </div>
      </div>
    </div>
  );
}
