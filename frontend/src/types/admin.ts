import type { SourceInfo } from "@/types/listing";

export type AdminOverview = {
  total_users: number;
  free_users: number;
  pro_users: number;
  active_subscriptions: number;
  canceled_subscriptions: number;
  past_due_subscriptions: number;
  inactive_subscriptions: number;
  total_listings: number;
  recent_registrations_count: number;
  recent_email_deliveries_count: number;
};

export type AdminUser = {
  id: number;
  email: string;
  display_name: string | null;
  plan: string;
  subscription_status: string;
  subscription_current_period_end: string | null;
  email_verified: boolean;
  created_at: string;
  is_admin: boolean;
};

export type AdminUsersResponse = {
  items: AdminUser[];
};

export type AdminEmailDelivery = {
  id: number;
  user_id: number | null;
  email_type: string;
  provider_message_id: string | null;
  created_at: string;
};

export type AdminEmailDeliveriesResponse = {
  items: AdminEmailDelivery[];
  table_available: boolean;
};

export type AdminSourcesResponse = SourceInfo[];
