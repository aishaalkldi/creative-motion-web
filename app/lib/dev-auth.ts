/**
 * DEV-ONLY Authentication Bypass
 * 
 * This file provides a temporary mock authentication system for development.
 * It allows bypassing the backend login while keeping the existing auth code intact.
 * 
 * ⚠️ WARNING: This only works in development mode (NODE_ENV === 'development')
 * ⚠️ Production builds will ignore this completely.
 */

import { setAuthSession, type ClinicianInfo } from "./auth";

/**
 * Mock clinician data for development
 */
const DEV_MOCK_CLINICIAN: ClinicianInfo = {
  id: 999,
  full_name: "Dr. Dev Therapist",
  email: "dev@creative-motion.local",
  is_active: true,
  created_at: new Date().toISOString(),
};

/**
 * Mock JWT token for development (won't be validated by backend)
 */
const DEV_MOCK_TOKEN = "dev_bypass_token_" + Date.now();

/**
 * Check if dev bypass is enabled
 */
export function isDevBypassEnabled(): boolean {
  if (typeof window === "undefined") return false;
  return process.env.NODE_ENV === "development";
}

/**
 * Set up mock authentication session for development
 * This mimics what loginClinician() does but without hitting the backend
 */
export function setupDevAuthSession(): void {
  if (!isDevBypassEnabled()) {
    console.warn("Dev auth bypass is only available in development mode");
    return;
  }

  setAuthSession(DEV_MOCK_TOKEN, DEV_MOCK_CLINICIAN);
  console.log("✅ Dev auth bypass activated - Mock therapist logged in:", DEV_MOCK_CLINICIAN.full_name);
}

/**
 * Check if user has a dev auth session active
 */
export function hasDevAuthSession(): boolean {
  if (!isDevBypassEnabled()) return false;
  if (typeof window === "undefined") return false;
  
  const token = localStorage.getItem("cm_access_token");
  return token?.startsWith("dev_bypass_token_") ?? false;
}
