# Square Game

Creador de juegos plataformeros estilo 32-bit. Como Mario Maker, pero con superpoderes configurables.

## Características

- **Auth clásica**: nickname único + contraseña (sin email)
- **Jugar niveles**: incluye nivel demo pregenerado
- **Editor de niveles**: drag-and-drop de plataformas, enemigos y spawn
- **Editor de habilidades low-code**: asigna teclas a saltar, correr, dash, etc.
- **Editor de pixel art**: límites SNES (16 colores, tamaños 8/16/32px)
- **Enemigos triangulares**: patrol y chase
- **Generador procedural**: niveles aleatorios con seed
- **Niveles ligeros**: export/import `.sqlevel` comprimido (gzip)

## Stack

- **Client**: Vite + React + TypeScript + Phaser 3
- **Server**: Fastify + SQLite + bcrypt + JWT

## Inicio rápido

```bash
npm install
npm run dev
```

- Frontend: http://localhost:5173
- API: http://localhost:3001

## Uso

1. Regístrate con un nickname y contraseña
2. **Jugar Niveles** — prueba el demo o tus niveles guardados
3. **Crear Nivel** — coloca plataformas, enemigos, asigna habilidades, playtest
4. **Crear Assets** — dibuja pixel art para el Square, plataformas o enemigos

## Controles (juego)

- Flechas / A D — mover
- Espacio — saltar
- Shift — dash (si está asignado)

## Editor

- Click — colocar según herramienta activa
- Arrastrar — mover objetos
- Flechas — mover cámara
- Rueda — zoom (modo editor)
- Click medio — pan cámara

## Formato .sqlevel

Nivel JSON comprimido con gzip. Típicamente 0.5–2 KB.

## Límites SNES

| Regla | Valor |
|-------|-------|
| Colores por sprite | 16 (0 = transparente) |
| Tamaños | 8×8, 16×16, 32×32 |
| Paleta | 64 colores master |
| Plataformas/nivel | máx. 200 |
| Enemigos/nivel | máx. 50 |

## Desktop (opcional)

```bash
# Empaquetar client
npm run build -w client
# Servir con API en producción
npm run start -w server
```

Tauri puede empaquetar el client como app nativa en una fase futura.
