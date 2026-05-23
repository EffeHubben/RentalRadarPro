import { buildApiUrl, getApiErrorMessage } from "@/lib/apiConfig";
import type {
  GeneratedTenantResponse,
  SavedRentalResponse,
  TenantProfile,
  TenantResponseStyle,
} from "@/types/tenant";

async function tenantRequest<T>(path: string, accessToken: string, init?: RequestInit): Promise<T> {
  const response = await fetch(buildApiUrl(path), {
    ...init,
    cache: "no-store",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
      ...init?.headers,
    },
  });

  if (!response.ok) {
    throw new Error(await getApiErrorMessage(response));
  }

  return response.json() as Promise<T>;
}

export const emptyTenantProfile: TenantProfile = {
  full_name: null,
  age: null,
  occupation_or_study: null,
  monthly_income_range: null,
  household_size: null,
  pets: null,
  pet_notes: null,
  smoker: null,
  preferred_city: null,
  move_in_date: null,
  short_intro: null,
  why_looking: null,
  strengths_as_tenant: null,
  id_ready: false,
  income_proof_ready: false,
  employer_statement_ready: false,
  bank_statement_ready: false,
  motivation_ready: false,
  guarantor_available: false,
  completion_percentage: 0,
};

export function fetchTenantProfile(accessToken: string) {
  return tenantRequest<TenantProfile>("/account/tenant-profile", accessToken);
}

export function updateTenantProfile(accessToken: string, profile: TenantProfile) {
  return tenantRequest<TenantProfile>("/account/tenant-profile", accessToken, {
    method: "PUT",
    body: JSON.stringify({
      full_name: profile.full_name || null,
      age: profile.age,
      occupation_or_study: profile.occupation_or_study || null,
      monthly_income_range: profile.monthly_income_range || null,
      household_size: profile.household_size,
      pets: profile.pets,
      pet_notes: profile.pet_notes || null,
      smoker: profile.smoker,
      preferred_city: profile.preferred_city || null,
      move_in_date: profile.move_in_date || null,
      short_intro: profile.short_intro || null,
      why_looking: profile.why_looking || null,
      strengths_as_tenant: profile.strengths_as_tenant || null,
      id_ready: profile.id_ready,
      income_proof_ready: profile.income_proof_ready,
      employer_statement_ready: profile.employer_statement_ready,
      bank_statement_ready: profile.bank_statement_ready,
      motivation_ready: profile.motivation_ready,
      guarantor_available: profile.guarantor_available,
    }),
  });
}

export function generateTenantProfileExample(accessToken: string, style: TenantResponseStyle) {
  return tenantRequest<GeneratedTenantResponse>("/account/tenant-profile/example-response", accessToken, {
    method: "POST",
    body: JSON.stringify({ style }),
  });
}

export function generateListingResponse(
  listingId: number,
  accessToken: string,
  style: TenantResponseStyle,
) {
  return tenantRequest<GeneratedTenantResponse>(`/listings/${listingId}/generate-response`, accessToken, {
    method: "POST",
    body: JSON.stringify({ style }),
  });
}

export function fetchSavedListingResponse(listingId: number, accessToken: string) {
  return tenantRequest<SavedRentalResponse | null>(`/listings/${listingId}/saved-response`, accessToken);
}

export function saveListingResponse(
  listingId: number,
  accessToken: string,
  payload: { style: TenantResponseStyle; generated_message: string },
) {
  return tenantRequest<SavedRentalResponse>(`/listings/${listingId}/saved-response`, accessToken, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}
