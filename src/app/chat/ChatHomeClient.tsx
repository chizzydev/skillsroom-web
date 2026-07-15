"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import type { ChatChannel, ChatDmRequest } from "@/lib/match-room-api";
import { channelInitials, channelPreview, channelTitle, channelTypeLabel } from "@/components/community/chat-state";

type ChatHomeClientProps = {
  channels: ChatChannel[];
  currentUserId: string;
  dmRequests: ChatDmRequest[];
};

type ChatView = "channels" | "dms";

function channelHref(channel: ChatChannel) {
  return `/chat?channel=${encodeURIComponent(channel.slug || channel.id)}`;
}

function requestPeer(request: ChatDmRequest, currentUserId: string) {
  if (request.requester_user_id === currentUserId) return request.recipient_label || request.recipient_username || "Player";
  return request.requester_label || request.requester_username || "Player";
}

function requestHref(request: ChatDmRequest) {
  return request.channel_slug ? `/chat?channel=${encodeURIComponent(request.channel_slug)}` : "/notifications";
}

function StatPill({ label, value, alert }: { label: string; value: number; alert?: boolean }) {
  return (
    <div className={["min-h-[4.2rem] rounded-md bg-[#162638] p-3", alert ? "ring-1 ring-sky-300" : ""].join(" ")}>
      <p className="text-xl font-black text-white">{value}</p>
      <p className="mt-1 text-[0.7rem] font-extrabold leading-4 text-slate-300">{label}</p>
    </div>
  );
}

function ChannelCard({ channel, featured = false }: { channel: ChatChannel; featured?: boolean }) {
  const unread = Number(channel.unread_count ?? 0);
  const locked = channel.status === "locked" || Boolean(channel.lockdown_until);

  return (
    <Link
      className={[
        "flex min-h-[5.5rem] min-w-0 items-center gap-3 rounded-md border p-3 transition hover:-translate-y-0.5 hover:border-sky-300/50 hover:bg-[#203449]",
        featured ? "border-sky-400/30 bg-[#182d40]" : "border-transparent bg-[#1c2b3a]"
      ].join(" ")}
      href={channelHref(channel)}
    >
      <span className={["relative grid h-14 w-14 shrink-0 place-items-center rounded-md text-xs font-black text-sky-300", featured ? "bg-[#0f1b29]" : "bg-[#233446]"].join(" ")}>
        {channelInitials(channel)}
        {Number(channel.online_count ?? 0) > 0 ? <span className="absolute bottom-1.5 right-1.5 h-3 w-3 rounded-full border-2 border-[#1c2b3a] bg-emerald-400" /> : null}
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex min-w-0 items-center gap-2">
          <strong className="truncate text-base font-black text-white sm:text-lg">{channelTitle(channel)}</strong>
          {locked ? <span className="shrink-0 rounded-full bg-amber-300/15 px-2 py-0.5 text-[0.62rem] font-black uppercase tracking-[0.08em] text-amber-200">Paused</span> : null}
        </span>
        <span className="mt-1 line-clamp-2 block text-sm font-bold leading-5 text-slate-300">
          {channelTypeLabel(channel)} / {channel.online_count ?? 0} online / {channelPreview(channel)}
        </span>
      </span>
      {unread > 0 ? <span className="grid min-w-8 shrink-0 place-items-center rounded-full bg-sky-400 px-2 py-1 text-xs font-black text-navy-950">{unread}</span> : null}
    </Link>
  );
}

function AcceptedDmCard({ request, currentUserId }: { request: ChatDmRequest; currentUserId: string }) {
  const peer = requestPeer(request, currentUserId);

  return (
    <Link className="flex min-h-[5.5rem] min-w-0 items-center gap-3 rounded-md border border-transparent bg-[#1c2b3a] p-3 transition hover:-translate-y-0.5 hover:border-sky-300/50 hover:bg-[#203449]" href={requestHref(request)}>
      <span className="grid h-14 w-14 shrink-0 place-items-center rounded-full bg-[#233446] text-xs font-black text-sky-300">
        {peer.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part.charAt(0)).join("").toUpperCase() || "DM"}
      </span>
      <span className="min-w-0 flex-1">
        <strong className="block truncate text-base font-black text-white sm:text-lg">{peer}</strong>
        <span className="mt-1 block truncate text-sm font-bold text-slate-300">Accepted DM request / open thread</span>
      </span>
    </Link>
  );
}

function LoadingRows() {
  return (
    <div className="grid gap-2">
      {[0, 1, 2].map((item) => (
        <div className="flex min-h-[5.5rem] animate-pulse items-center gap-3 rounded-md bg-[#1c2b3a] p-3 opacity-70" key={item}>
          <div className="h-14 w-14 rounded-md bg-[#233446]" />
          <div className="grid flex-1 gap-2">
            <div className="h-4 w-1/2 rounded-full bg-[#233446]" />
            <div className="h-3 w-5/6 rounded-full bg-[#233446]" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function ChatHomeClient({ channels, currentUserId, dmRequests }: ChatHomeClientProps) {
  const [view, setView] = useState<ChatView>("channels");
  const globalChannel = channels.find((channel) => channel.slug === "global_lobby" || channel.channel_type === "lobby") ?? null;
  const publicChannels = useMemo(
    () => channels.filter((channel) => channel.channel_type !== "dm" && channel.id !== globalChannel?.id),
    [channels, globalChannel?.id]
  );
  const dmChannels = useMemo(() => channels.filter((channel) => channel.channel_type === "dm"), [channels]);
  const pendingRequests = useMemo(() => dmRequests.filter((request) => request.status === "pending"), [dmRequests]);
  const acceptedRequests = useMemo(
    () => dmRequests.filter((request) => request.status === "accepted" && request.channel_slug && !dmChannels.some((channel) => channel.slug === request.channel_slug)),
    [dmChannels, dmRequests]
  );
  const unreadCount = channels.reduce((sum, channel) => sum + Number(channel.unread_count ?? 0), 0);
  const onlineCount = channels.reduce((sum, channel) => sum + Number(channel.online_count ?? 0), 0);

  return (
    <div className="min-h-[100svh] bg-[#edf4fa] px-3 py-4 text-white sm:px-6 lg:px-8">
      <div className="mx-auto grid w-full max-w-5xl gap-4 pb-24">
        <section className="rounded-lg bg-[#0f1b29] p-5 shadow-panel sm:p-6">
          <div className="flex items-start justify-between gap-3">
            <div className="inline-flex min-h-9 items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 text-xs font-black uppercase tracking-[0.16em] text-white">
              <span className="text-sky-300">#</span>
              Chat
            </div>
            {globalChannel ? (
              <Link aria-label="Open Global Chat" className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-white/10 text-lg font-black text-white hover:bg-white/15" href={channelHref(globalChannel)}>
                ↗
              </Link>
            ) : null}
          </div>
          <h1 className="mt-5 max-w-xl text-3xl font-black leading-tight text-white sm:text-4xl">Global, rooms, and DMs.</h1>
          <div className="mt-4 grid grid-cols-3 gap-2">
            <StatPill label="Online" value={onlineCount} />
            <StatPill label="Unread" value={unreadCount} alert={unreadCount > 0} />
            <StatPill label="DM requests" value={pendingRequests.length} alert={pendingRequests.length > 0} />
          </div>
        </section>

        <div className="grid grid-cols-2 rounded-md border border-[#31465a] bg-[#1c2b3a] p-1">
          <button
            className={["min-h-11 rounded-sm text-sm font-black transition", view === "channels" ? "bg-sky-400 text-navy-950 shadow-action" : "text-slate-300 hover:bg-white/5"].join(" ")}
            onClick={() => setView("channels")}
            type="button"
          >
            # Channels
          </button>
          <button
            className={["min-h-11 rounded-sm text-sm font-black transition", view === "dms" ? "bg-sky-400 text-navy-950 shadow-action" : "text-slate-300 hover:bg-white/5"].join(" ")}
            onClick={() => setView("dms")}
            type="button"
          >
            DMs
          </button>
        </div>

        {view === "channels" ? (
          <section className="grid gap-3">
            {globalChannel ? <ChannelCard channel={globalChannel} featured /> : null}
            <p className="mt-1 font-mono text-[0.7rem] font-black uppercase tracking-[0.2em] text-slate-600">Your accessible channels</p>
            {channels.length === 0 ? <LoadingRows /> : null}
            {publicChannels.map((channel) => <ChannelCard channel={channel} key={channel.id} />)}
            {!globalChannel && publicChannels.length === 0 ? (
              <div className="rounded-md border border-dashed border-slate-300 bg-white p-6 text-center text-sm font-bold text-muted">Your community channels will appear here when they are available.</div>
            ) : null}
          </section>
        ) : (
          <section className="grid gap-3">
            <div className="flex min-h-[5rem] items-center gap-3 rounded-md border border-[#31465a] bg-[#0f1b29] p-3">
              <span className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-[#17364a] text-lg font-black text-sky-300">+</span>
              <span className="min-w-0 flex-1">
                <strong className="block text-base font-black text-white">Direct messages</strong>
                <span className="mt-1 block text-sm font-bold text-slate-300">{pendingRequests.length} pending request{pendingRequests.length === 1 ? "" : "s"}</span>
              </span>
              <Link className="inline-flex min-h-10 shrink-0 items-center justify-center rounded-full bg-sky-400 px-4 text-sm font-black text-navy-950 shadow-action" href="/notifications">
                Manage
              </Link>
            </div>
            {dmChannels.map((channel) => <ChannelCard channel={channel} key={channel.id} />)}
            {acceptedRequests.map((request) => <AcceptedDmCard currentUserId={currentUserId} key={request.id} request={request} />)}
            {dmChannels.length === 0 && acceptedRequests.length === 0 ? (
              <div className="rounded-md border border-dashed border-slate-300 bg-white p-6 text-center text-sm font-bold text-muted">Start a request from the DM manager or accept an incoming request.</div>
            ) : null}
          </section>
        )}
      </div>
    </div>
  );
}
