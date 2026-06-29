const BASE = '/api';

async function request<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers ?? {}),
    },
    ...options,
  });

  if (!res.ok) {
    const err = (await res.json().catch(() => ({ error: res.statusText }))) as {
      error?: string;
    };
    throw new Error(err.error ?? `HTTP ${res.status}`);
  }

  return res.json() as Promise<T>;
}

export const api = {
  auth: {
    register: (nickname: string, password: string) =>
      request<{ id: string; nickname: string }>('/auth/register', {
        method: 'POST',
        body: JSON.stringify({ nickname, password }),
      }),
    login: (nickname: string, password: string) =>
      request<{ id: string; nickname: string }>('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ nickname, password }),
      }),
    logout: () => request<{ ok: boolean }>('/auth/logout', { method: 'POST' }),
    me: () => request<{ id: string; nickname: string }>('/auth/me'),
  },
  levels: {
    list: () =>
      request<
        Array<{
          id: string;
          name: string;
          data: import('../types').LevelSchema;
          isDemo: boolean;
          isPublic?: boolean;
        }>
      >('/levels'),
    listPublic: () =>
      request<
        Array<{
          id: string;
          name: string;
          data: import('../types').LevelSchema;
          authorNickname: string;
        }>
      >('/levels/public'),
    listFavorites: () =>
      request<
        Array<{
          id: string;
          name: string;
          data: import('../types').LevelSchema;
          isDemo: boolean;
          authorNickname: string;
        }>
      >('/levels/favorites'),
    get: (id: string) =>
      request<{
        id: string;
        name: string;
        data: import('../types').LevelSchema;
        isPublic?: boolean;
        isFavorite?: boolean;
      }>(`/levels/${id}`),
    create: (name: string, data: import('../types').LevelSchema) =>
      request<{ id: string }>('/levels', {
        method: 'POST',
        body: JSON.stringify({ name, data }),
      }),
    update: (id: string, name: string, data: import('../types').LevelSchema) =>
      request<{ ok: boolean }>(`/levels/${id}`, {
        method: 'PUT',
        body: JSON.stringify({ name, data }),
      }),
    delete: (id: string) =>
      request<{ ok: boolean }>(`/levels/${id}`, { method: 'DELETE' }),
    share: (id: string) =>
      request<{ isPublic: boolean }>(`/levels/${id}/share`, { method: 'POST' }),
    favorite: (id: string) =>
      request<{ isFavorite: boolean }>(`/levels/${id}/favorite`, { method: 'POST' }),
    leaderboard: (id: string) =>
      request<import('../types').LeaderboardEntry[]>(`/levels/${id}/leaderboard`),
    myScore: (id: string) =>
      request<{
        timeMs: number | null;
        deaths: number | null;
        achievedAt: number | null;
      }>(`/levels/${id}/score/me`),
    submitScore: (id: string, timeMs: number, deaths: number) =>
      request<{ isPersonalBest: boolean; rank: number; inTop20: boolean }>(
        `/levels/${id}/score`,
        { method: 'POST', body: JSON.stringify({ timeMs, deaths }) }
      ),
  },
  assets: {
    list: () =>
      request<
        Array<{
          id: string;
          name: string;
          data: import('../types').AssetSchema;
          isPublic?: boolean;
        }>
      >('/assets'),
    listPublic: () =>
      request<
        Array<{
          id: string;
          name: string;
          data: import('../types').AssetSchema;
          authorNickname: string;
        }>
      >('/assets/public'),
    get: (id: string) =>
      request<{ id: string; name: string; data: import('../types').AssetSchema }>(
        `/assets/${id}`
      ),
    create: (name: string, data: import('../types').AssetSchema) =>
      request<{ id: string }>('/assets', {
        method: 'POST',
        body: JSON.stringify({ name, data }),
      }),
    update: (id: string, name: string, data: import('../types').AssetSchema) =>
      request<{ ok: boolean }>(`/assets/${id}`, {
        method: 'PUT',
        body: JSON.stringify({ name, data }),
      }),
    delete: (id: string) =>
      request<{ ok: boolean }>(`/assets/${id}`, { method: 'DELETE' }),
    share: (id: string) =>
      request<{ isPublic: boolean }>(`/assets/${id}/share`, { method: 'POST' }),
  },
  skills: {
    list: () =>
      request<
        Array<{
          id: string;
          name: string;
          data: import('../types').SkillSchema;
          isPublic?: boolean;
        }>
      >('/skills'),
    listPublic: () =>
      request<
        Array<{
          id: string;
          name: string;
          data: import('../types').SkillSchema;
          authorNickname: string;
        }>
      >('/skills/public'),
    create: (name: string, data: import('../types').SkillSchema) =>
      request<{ id: string }>('/skills', {
        method: 'POST',
        body: JSON.stringify({ name, data }),
      }),
    update: (id: string, data: import('../types').SkillSchema) =>
      request<{ ok: boolean }>(`/skills/${id}`, {
        method: 'PUT',
        body: JSON.stringify({ data }),
      }),
    delete: (id: string) =>
      request<{ ok: boolean }>(`/skills/${id}`, { method: 'DELETE' }),
    share: (id: string) =>
      request<{ isPublic: boolean }>(`/skills/${id}/share`, { method: 'POST' }),
  },
  music: {
    list: () =>
      request<
        Array<{
          id: string;
          name: string;
          data: import('../types').MusicSchema;
          isPublic?: boolean;
        }>
      >('/music'),
    listPublic: () =>
      request<
        Array<{
          id: string;
          name: string;
          data: import('../types').MusicSchema;
          authorNickname: string;
        }>
      >('/music/public'),
    create: (name: string, data: import('../types').MusicSchema) =>
      request<{ id: string }>('/music', {
        method: 'POST',
        body: JSON.stringify({ name, data }),
      }),
    update: (id: string, name: string, data: import('../types').MusicSchema) =>
      request<{ ok: boolean }>(`/music/${id}`, {
        method: 'PUT',
        body: JSON.stringify({ name, data }),
      }),
    delete: (id: string) =>
      request<{ ok: boolean }>(`/music/${id}`, { method: 'DELETE' }),
    share: (id: string) =>
      request<{ isPublic: boolean }>(`/music/${id}/share`, { method: 'POST' }),
  },
};
