"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";
import { trackWebAnalyticsEvent } from "@/lib/analytics-client";

function screenNameForPath(pathname: string) {
  if (pathname === "/") return "home";
  if (pathname === "/challenges") return "challenges";
  if (pathname === "/matches") return "rooms";
  if (pathname === "/matches/new") return "room_create";
  if (pathname.startsWith("/matches/")) return "room_detail";
  if (pathname === "/tournaments") return "tournaments";
  if (pathname.startsWith("/tournaments/")) return "tournament_detail";
  if (pathname === "/wallet") return "wallet";
  if (pathname === "/profile") return "profile";
  if (pathname.startsWith("/community")) return "community";
  if (pathname.startsWith("/chat")) return "chat";
  if (pathname.startsWith("/notifications")) return "notifications";
  if (pathname === "/admin") return "admin_overview";
  if (pathname.startsWith("/admin/analytics")) return "admin_analytics";
  if (pathname.startsWith("/admin/funding")) return "admin_funding";
  if (pathname.startsWith("/admin/wallet")) return "admin_wallet";
  if (pathname.startsWith("/admin/results")) return "admin_results";
  if (pathname.startsWith("/admin/settlements")) return "admin_settlements";
  if (pathname.startsWith("/admin/tournaments")) return "admin_tournaments";
  if (pathname.startsWith("/admin/players")) return "admin_players";
  if (pathname.startsWith("/admin/team")) return "admin_team";
  if (pathname.startsWith("/admin/risk")) return "admin_risk";
  if (pathname.startsWith("/admin/observability")) return "admin_observability";
  if (pathname.startsWith("/admin")) return "admin";
  if (pathname.startsWith("/sign-in")) return "sign_in";
  if (pathname.startsWith("/register")) return "register";
  return "web";
}

function analyticsPathForPath(pathname: string) {
  if (pathname.startsWith("/matches/") && pathname !== "/matches/new") return "/matches/[matchId]";
  if (pathname.startsWith("/tournaments/")) return "/tournaments/[tournamentId]";
  if (pathname.startsWith("/community/channels/")) return "/community/channels/[channelIdOrSlug]";
  return pathname;
}

export function WebAnalyticsBridge() {
  const pathname = usePathname();
  const lastTrackedPath = useRef<string | null>(null);

  useEffect(() => {
    if (!pathname || lastTrackedPath.current === pathname) return;
    lastTrackedPath.current = pathname;

    trackWebAnalyticsEvent({
      eventName: "screen.viewed",
      screen: screenNameForPath(pathname),
      path: analyticsPathForPath(pathname),
      metadata: {
        surface: pathname.startsWith("/admin") ? "admin_web" : "player_web"
      }
    });
  }, [pathname]);

  return null;
}
