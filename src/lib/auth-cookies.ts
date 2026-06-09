export const legacyAccessTokenCookie = "skill_rooms_access_token";
export const hardenedAccessTokenCookie = "__Host-skill_rooms_access_token";
export const legacyRefreshTokenCookie = "skill_rooms_refresh_token";
export const hardenedRefreshTokenCookie = "__Host-skill_rooms_refresh_token";
export const legacyAdminStepUpCookie = "skill_rooms_admin_step_up";
export const hardenedAdminStepUpCookie = "__Host-skill_rooms_admin_step_up";

export function accessTokenCookieName() {
  return process.env.NODE_ENV === "production" ? hardenedAccessTokenCookie : legacyAccessTokenCookie;
}

export function accessTokenCookieNames() {
  return Array.from(new Set([accessTokenCookieName(), legacyAccessTokenCookie, hardenedAccessTokenCookie]));
}

export function refreshTokenCookieName() {
  return process.env.NODE_ENV === "production" ? hardenedRefreshTokenCookie : legacyRefreshTokenCookie;
}

export function refreshTokenCookieNames() {
  return Array.from(new Set([refreshTokenCookieName(), legacyRefreshTokenCookie, hardenedRefreshTokenCookie]));
}

export function adminStepUpCookieName() {
  return process.env.NODE_ENV === "production" ? hardenedAdminStepUpCookie : legacyAdminStepUpCookie;
}

export function adminStepUpCookieNames() {
  return Array.from(new Set([adminStepUpCookieName(), legacyAdminStepUpCookie, hardenedAdminStepUpCookie]));
}
