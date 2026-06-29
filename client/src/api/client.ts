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
          playCount?: number;
          clearCount?: number;
          clearRate?: number;
          likeCount?: number;
          userLiked?: boolean;
          tags?: string[];
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
        authorCleared?: boolean;
        authorNickname?: string;
        playCount?: number;
        clearCount?: number;
        clearRate?: number;
        likeCount?: number;
        userLiked?: boolean;
        tags?: string[];
      }>(`/levels/${id}`),
    create: (name: string, data: import('../types').LevelSchema) =>
      request<{ id: string }>('/levels', {
        method: 'POST',
        body: JSON.stringify({ name, data }),
      }),
    update: (id: string, name: string, data: import('../types').LevelSchema, tags?: string[]) =>
      request<{ ok: boolean }>(`/levels/${id}`, {
        method: 'PUT',
        body: JSON.stringify(tags !== undefined ? { name, data, tags } : { name, data }),
      }),
    delete: (id: string) =>
      request<{ ok: boolean }>(`/levels/${id}`, { method: 'DELETE' }),
    share: (id: string) =>
      request<{ isPublic: boolean }>(`/levels/${id}/share`, { method: 'POST' }),
    clearTest: (id: string) =>
      request<{ cleared: boolean }>(`/levels/${id}/clear-test`, { method: 'POST' }),
    recordPlay: (id: string) =>
      request<{ ok: boolean }>(`/levels/${id}/play`, { method: 'POST' }),
    like: (id: string) =>
      request<{ liked: boolean }>(`/levels/${id}/like`, { method: 'POST' }),
    comments: (id: string) =>
      request<
        Array<{ id: string; body: string; createdAt: number; nickname: string }>
      >(`/levels/${id}/comments`),
    addComment: (id: string, body: string) =>
      request<{ id: string; body: string }>(`/levels/${id}/comments`, {
        method: 'POST',
        body: JSON.stringify({ body }),
      }),
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
      request<{
        id: string;
        name: string;
        data: import('../types').AssetSchema;
        isPublic?: boolean;
      }>(`/assets/${id}`),
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
    clone: (id: string) =>
      request<{ id: string; name: string; data: import('../types').AssetSchema }>(
        `/assets/${id}/clone`,
        { method: 'POST' }
      ),
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
    clone: (id: string) =>
      request<{ id: string; name: string; data: import('../types').SkillSchema }>(
        `/skills/${id}/clone`,
        { method: 'POST' }
      ),
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
    clone: (id: string) =>
      request<{ id: string; name: string; data: import('../types').MusicSchema }>(
        `/music/${id}/clone`,
        { method: 'POST' }
      ),
  },
  users: {
    getProfile: (nickname: string) =>
      request<{
        nickname: string;
        createdAt: number;
        levels: Array<{
          id: string;
          name: string;
          data: import('../types').LevelSchema;
          playCount: number;
          clearCount: number;
          likeCount: number;
          clearRate: number;
          tags: string[];
        }>;
      }>(`/users/${encodeURIComponent(nickname)}`),
  },
};
