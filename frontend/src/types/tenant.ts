export type TenantResponseStyle = "short" | "professional" | "warm";

export type TenantProfile = {
  id?: number;
  user_id?: number;
  full_name: string | null;
  age: number | null;
  occupation_or_study: string | null;
  monthly_income_range: string | null;
  household_size: number | null;
  pets: boolean | null;
  pet_notes: string | null;
  smoker: boolean | null;
  preferred_city: string | null;
  move_in_date: string | null;
  short_intro: string | null;
  why_looking: string | null;
  strengths_as_tenant: string | null;
  id_ready: boolean;
  income_proof_ready: boolean;
  employer_statement_ready: boolean;
  bank_statement_ready: boolean;
  motivation_ready: boolean;
  guarantor_available: boolean;
  completion_percentage: number;
  created_at?: string;
  updated_at?: string;
};

export type GeneratedTenantResponse = {
  message: string;
  style: TenantResponseStyle;
  missing_fields: string[];
  provider_used?: string;
};

export type SavedRentalResponse = {
  id: number;
  user_id: number;
  listing_id: number | null;
  listing_source_id: string | null;
  listing_external_id: string | null;
  style: string;
  generated_message: string;
  created_at: string;
  updated_at: string;
};
