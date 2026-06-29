import { create } from 'zustand';
import type { User } from '../types';
import { api } from '../api/client';

interface AuthState {
  user: User | null;
  loading: boolean;
  error: string | null;
  checkAuth: () => Promise<void>;
  login: (nickname: string, password: string) => Promise<void>;
  register: (nickname: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  loading: true,
  error: null,

  checkAuth: async () => {
    try {
      set({ loading: true, error: null });
      const user = await api.auth.me();
      set({ user, loading: false });
    } catch {
      set({ user: null, loading: false });
    }
  },

  login: async (nickname, password) => {
    set({ loading: true, error: null });
    try {
      const user = await api.auth.login(nickname, password);
      set({ user, loading: false });
    } catch (err) {
      set({ error: (err as Error).message, loading: false });
      throw err;
    }
  },

  register: async (nickname, password) => {
    set({ loading: true, error: null });
    try {
      const user = await api.auth.register(nickname, password);
      set({ user, loading: false });
    } catch (err) {
      set({ error: (err as Error).message, loading: false });
      throw err;
    }
  },

  logout: async () => {
    await api.auth.logout();
    set({ user: null });
  },
}));
