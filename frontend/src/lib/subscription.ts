import type { AuthUser } from "@/types/auth";

export function hasPro(user: AuthUser | null): boolean {
  return (
    user?.plan === "pro" &&
    (user.subscription_status === "active" || user.subscription_status === "trialing")
  );
}
