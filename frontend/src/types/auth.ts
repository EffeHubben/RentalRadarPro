import type { Language } from "@/lib/i18n";

export type AuthUser = {
  id: number;
  email: string;
  display_name: string | null;
  preferred_language: Language | null;
  is_active: boolean;
  created_at: string;
  last_login_at: string | null;
  plan: string;
  subscription_status: string;
  subscription_current_period_end: string | null;
};

export type AuthResponse = {
  user: AuthUser;
  access_token: string;
  token_type: "bearer";
  expires_in: number;
};

export type RefreshResponse = {
  access_token: string;
  token_type: "bearer";
  expires_in: number;
};

export type RegisterPayload = {
  email: string;
  password: string;
  display_name?: string;
  preferred_language?: Language;
};

export type LoginPayload = {
  email: string;
  password: string;
};
