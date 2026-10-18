import { create } from "zustand";
import { persist } from "zustand/middleware";

import { api } from "@/api";
import type { AuthResponse, LoginResponse, UserResponse } from "@/generated/api";

type TokenPayload = { access: string; refresh?: string | null };

type AuthState = {
  user: UserResponse | null;
  access: string | null;
  refresh: string | null;
  login: (username: string, password: string) => Promise<void>;
  register: (
    username: string,
    password: string,
    passwordConfirm: string,
  ) => Promise<void>;
  logout: () => void;
  applyTokens: {
    (access: string, refresh?: string | null): void;
    (tokens: TokenPayload): void;
  };
};

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      access: null,
      refresh: null,

      login: async (username, password) => {
        const response: LoginResponse = await api.authLogin({
          loginRequest: { username, password },
        });
        // Apply tokens first so the auth middleware can attach them to /auth/me.
        useAuthStore.getState().applyTokens(response.access, response.refresh);
        const user = await api.authMe();
        set({
          user,
          access: response.access,
          refresh: response.refresh,
        });
      },

      register: async (username, password, passwordConfirm) => {
        const response: AuthResponse = await api.authRegister({
          registerRequest: {
            username,
            password,
            passwordConfirm,
          },
        });
        // Apply tokens first so the auth middleware can attach them to /auth/me.
        useAuthStore.getState().applyTokens(response.access, response.refresh);
        const user = await api.authMe();
        set({
          user,
          access: response.access,
          refresh: response.refresh,
        });
      },

      logout: () => {
        set({ user: null, access: null, refresh: null });
        window.localStorage.removeItem("auth");
      },

      applyTokens: (...args: unknown[]) => {
        let access: string;
        let refresh: string | null | undefined;
        if (typeof args[0] === "string") {
          access = args[0];
          refresh = args[1] as string | null | undefined;
        } else {
          const tokens = args[0] as TokenPayload;
          access = tokens.access;
          refresh = tokens.refresh;
        }
        set((state) => ({
          access,
          refresh: refresh ?? state.refresh,
        }));
      },
    }),
    { name: "auth" },
  ),
);