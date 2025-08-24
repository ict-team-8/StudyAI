// 인증 컨텍스트 (로그인/로그아웃/내 정보 조회)

import React, { createContext, useContext, useEffect, useState } from "react";
import api, { getAuthToken, setAuthToken } from "./api";

export type User = { id: string; email: string } | null;

type AuthCtx = {
  user: User;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  refresh: () => Promise<void>;
};

const AuthContext = createContext<AuthCtx>({
  user: null,
  login: async () => {},
  logout: () => {},
  refresh: async () => {},
});

export const useAuth = () => useContext(AuthContext);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User>(null);

  // /users/me 로 현재 사용자 조회 → 상단 이메일/버튼 표시용
  async function refresh() {
    if (!getAuthToken()) { setUser(null); return; }
    try {
      const { data } = await api.get("/users/me");
      setUser(data);
    } catch {
      setUser(null);
    }
  }
  useEffect(() => { refresh(); }, []);

  // fastapi-users 로그인: x-www-form-urlencoded 필요
  async function login(email: string, password: string) {
    const form = new URLSearchParams();
    form.append("username", email);
    form.append("password", password);
    const { data } = await api.post("/auth/jwt/login", form, {
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
    });
    setAuthToken(data.access_token); // 로컬스토리지에 토큰 저장
    await refresh();                 // /users/me 재호출하여 user 상태 갱신
  }
  function logout(){ setAuthToken(undefined); setUser(null); }

  return (
    <AuthContext.Provider value={{ user, login, logout, refresh }}>
      {children}
    </AuthContext.Provider>
  );
}

