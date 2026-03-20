"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

export interface AuthUser {
  user_id: string;
  email: string;
  token: string;
}

export function useAuth() {
  const router = useRouter();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem("db_host_token");
    const user_id = localStorage.getItem("db_host_user_id");
    const email = localStorage.getItem("db_host_email");
    if (token && user_id && email) {
      setUser({ token, user_id, email });
    }
    setLoading(false);
  }, []);

  const login = useCallback((data: { access_token: string; user_id: string; email: string }) => {
    localStorage.setItem("db_host_token", data.access_token);
    localStorage.setItem("db_host_user_id", data.user_id);
    localStorage.setItem("db_host_email", data.email);
    setUser({ token: data.access_token, user_id: data.user_id, email: data.email });
    router.push("/dashboard");
  }, [router]);

  const logout = useCallback(() => {
    localStorage.removeItem("db_host_token");
    localStorage.removeItem("db_host_user_id");
    localStorage.removeItem("db_host_email");
    setUser(null);
    router.push("/");
  }, [router]);

  return { user, loading, login, logout };
}
