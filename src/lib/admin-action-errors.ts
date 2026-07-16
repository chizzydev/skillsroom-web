import { clearAdminStepUpToken } from "./admin-step-up-session";
import { ApiRequestError } from "./match-room-api";

const stepUpCodes = new Set([
  "ADMIN_STEP_UP_REQUIRED",
  "ADMIN_STEP_UP_INVALID",
  "ADMIN_STEP_UP_EXPIRED",
  "SESSION_REQUIRED"
]);

function isStepUpMessage(message: string) {
  return /admin step-up|sensitive actions|step-up token|confirm your password/i.test(message);
}

export function adminErrorMessageFromQuery(message: string) {
  return isStepUpMessage(message)
    ? "Sensitive actions need to be unlocked again. Confirm your password in the security panel, then retry this action."
    : message;
}

export function isAdminStepUpError(error: unknown) {
  if (error instanceof ApiRequestError) {
    return Boolean(error.code && stepUpCodes.has(error.code)) || isStepUpMessage(error.message);
  }
  if (error instanceof Error) return isStepUpMessage(error.message);
  return false;
}

export async function adminActionErrorMessage(error: unknown, fallback: string) {
  if (isAdminStepUpError(error)) {
    await clearAdminStepUpToken();
    return adminErrorMessageFromQuery("Admin step-up token is invalid.");
  }

  if (error instanceof ApiRequestError) {
    return error.requestId ? `${error.message} Request ID: ${error.requestId}` : error.message;
  }

  if (error instanceof Error) return error.message;
  return fallback;
}
