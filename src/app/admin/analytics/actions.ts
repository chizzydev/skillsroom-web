"use server";

import { redirect } from "next/navigation";
import { adminActionErrorMessage } from "@/lib/admin-action-errors";
import { trackServerAnalyticsEvent } from "@/lib/analytics-server";
import {
  excludeAdminAnalyticsUser,
  removeAdminAnalyticsExcludedUser,
  updateAdminAnalyticsSettings
} from "@/lib/match-room-api";

function analyticsUrl(input: { days?: string; success?: string; error?: string }) {
  const params = new URLSearchParams();
  if (input.days) params.set("days", input.days);
  if (input.success) params.set("success", input.success);
  if (input.error) params.set("error", input.error);
  const query = params.toString();
  return `/admin/analytics${query ? `?${query}` : ""}`;
}

function isoFromForm(value: FormDataEntryValue | null) {
  const raw = String(value || "").trim();
  if (!raw) return "";
  const parsed = Date.parse(raw);
  return Number.isFinite(parsed) ? new Date(parsed).toISOString() : raw;
}

export async function updateAnalyticsSettingsAction(formData: FormData) {
  const days = String(formData.get("days") || "28");

  try {
    await updateAdminAnalyticsSettings({
      production_activity_starts_at: isoFromForm(formData.get("production_activity_starts_at")),
      production_revenue_starts_at: isoFromForm(formData.get("production_revenue_starts_at")),
      note: String(formData.get("note") || "").trim()
    });
    await trackServerAnalyticsEvent({
      eventName: "analytics.settings_updated",
      screen: "admin_analytics",
      path: "/admin/analytics",
      metadata: { surface: "admin_web", action: "update_settings" }
    });
  } catch (error) {
    redirect(analyticsUrl({
      days,
      error: await adminActionErrorMessage(error, "Reporting settings could not be updated.")
    }));
  }

  redirect(analyticsUrl({ days, success: "Reporting settings updated." }));
}

export async function excludeAnalyticsUserAction(formData: FormData) {
  const days = String(formData.get("days") || "28");

  try {
    await excludeAdminAnalyticsUser({
      user_id: String(formData.get("user_id") || "").trim(),
      reason: String(formData.get("reason") || "").trim()
    });
    await trackServerAnalyticsEvent({
      eventName: "analytics.user_excluded",
      screen: "admin_analytics",
      path: "/admin/analytics",
      metadata: { surface: "admin_web", action: "exclude_user" }
    });
  } catch (error) {
    redirect(analyticsUrl({
      days,
      error: await adminActionErrorMessage(error, "Player could not be excluded from analytics.")
    }));
  }

  redirect(analyticsUrl({ days, success: "Player excluded from production analytics." }));
}

export async function removeAnalyticsExcludedUserAction(formData: FormData) {
  const days = String(formData.get("days") || "28");

  try {
    await removeAdminAnalyticsExcludedUser(String(formData.get("user_id") || "").trim());
    await trackServerAnalyticsEvent({
      eventName: "analytics.user_restored",
      screen: "admin_analytics",
      path: "/admin/analytics",
      metadata: { surface: "admin_web", action: "restore_user" }
    });
  } catch (error) {
    redirect(analyticsUrl({
      days,
      error: await adminActionErrorMessage(error, "Player could not be restored to analytics.")
    }));
  }

  redirect(analyticsUrl({ days, success: "Player restored to production analytics." }));
}
