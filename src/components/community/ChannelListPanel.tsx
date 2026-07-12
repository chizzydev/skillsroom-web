"use client";

import type { FormEvent } from "react";
import type { ChatChannel, ChatDmRequest } from "@/lib/match-room-api";
import { channelInitials, channelPreview, channelTitle, channelTypeLabel } from "./chat-state";

type ChannelListPanelProps = {
  activeChannel: ChatChannel;
  communityChannels: ChatChannel[];
  dmChannels: ChatChannel[];
  dmIntro: string;
  dmUsername: string;
  fullLayout: boolean;
  pendingIncomingDmRequests: ChatDmRequest[];
  onCreateDmRequest: (event: FormEvent<HTMLFormElement>) => void;
  onDmIntroChange: (value: string) => void;
  onDmUsernameChange: (value: string) => void;
  onOpenChannel: (channel: ChatChannel) => void;
  onRespondDmRequest: (requestId: string, responseValue: "accepted" | "declined") => void;
};

export function ChannelListPanel({
  activeChannel,
  communityChannels,
  dmChannels,
  dmIntro,
  dmUsername,
  fullLayout,
  pendingIncomingDmRequests,
  onCreateDmRequest,
  onDmIntroChange,
  onDmUsernameChange,
  onOpenChannel,
  onRespondDmRequest
}: ChannelListPanelProps) {
  return (
    <aside className={[
      "border-line",
      fullLayout ? "hidden min-h-0 overflow-hidden border-r border-white/10 bg-[#162536] md:block" : "border-b bg-white lg:border-b-0 lg:border-r"
    ].join(" ")}>
      <div className={[
        "overflow-y-auto p-3",
        fullLayout ? "max-h-64 lg:h-full lg:max-h-none" : "max-h-72 lg:max-h-[62vh]"
      ].join(" ")}>
        <a
          className={[
            "mb-3 flex min-h-11 items-center justify-between rounded-md border px-3 text-sm font-black transition",
            fullLayout ? "border-sky-400/30 bg-sky-400/10 text-sky-200 hover:bg-sky-400/15" : "border-cyan bg-cyanSoft text-ink hover:border-action"
          ].join(" ")}
          href="/notifications"
        >
          <span>Message requests</span>
          <span className={["rounded-full px-2 py-0.5 text-xs", fullLayout ? "bg-white/10 text-white" : "bg-white text-cyan"].join(" ")}>
            {pendingIncomingDmRequests.length}
          </span>
        </a>
        <form className={["mb-3 grid gap-2 rounded-md border p-3", fullLayout ? "border-white/10 bg-white/5" : "border-line bg-surface"].join(" ")} onSubmit={onCreateDmRequest}>
          <p className="font-mono text-[0.68rem] font-black uppercase tracking-[0.14em] text-cyan">DM Request</p>
          <input
            className={["min-h-10 rounded-md border px-3 text-sm outline-none focus:border-action", fullLayout ? "border-white/10 bg-[#223447] text-white placeholder:text-slate-400" : "border-line bg-white"].join(" ")}
            onChange={(event) => onDmUsernameChange(event.target.value)}
            placeholder="username"
            value={dmUsername}
          />
          <input
            className={["min-h-10 rounded-md border px-3 text-sm outline-none focus:border-action", fullLayout ? "border-white/10 bg-[#223447] text-white placeholder:text-slate-400" : "border-line bg-white"].join(" ")}
            maxLength={500}
            onChange={(event) => onDmIntroChange(event.target.value)}
            placeholder="intro message"
            value={dmIntro}
          />
          <button className="min-h-10 rounded-md bg-action px-3 text-sm font-black text-navy-950 shadow-action" type="submit">Request DM</button>
        </form>
        {pendingIncomingDmRequests.length ? (
          <div className="mb-3 grid gap-2 rounded-md border border-line bg-white p-3">
            <p className="font-mono text-[0.68rem] font-black uppercase tracking-[0.14em] text-muted">Pending DMs</p>
            {pendingIncomingDmRequests.slice(0, 3).map((request) => (
              <div className="grid gap-2 rounded-md bg-surfaceHigh p-2" key={request.id}>
                <p className="text-xs font-bold text-ink">{request.requester_label}</p>
                {request.intro_message ? <p className="text-xs text-muted">{request.intro_message}</p> : null}
                <div className="grid grid-cols-2 gap-2">
                  <button className="rounded-md bg-action px-2 py-1 text-xs font-black text-navy-950" onClick={() => onRespondDmRequest(request.id, "accepted")} type="button">Accept</button>
                  <button className="rounded-md border border-line bg-white px-2 py-1 text-xs font-black text-ink" onClick={() => onRespondDmRequest(request.id, "declined")} type="button">Decline</button>
                </div>
              </div>
            ))}
          </div>
        ) : null}
        <div className="mb-3 grid gap-2">
          <p className={["font-mono text-[0.68rem] font-black uppercase tracking-[0.14em]", fullLayout ? "text-sky-300" : "text-cyan"].join(" ")}>Messages</p>
          {dmChannels.length ? dmChannels.map((item) => {
            const active = item.id === activeChannel.id;
            return (
              <button
                className={[
                  "grid min-h-16 min-w-0 gap-1 rounded-md border px-3 py-2 text-left transition",
                  fullLayout
                    ? active ? "border-sky-400/50 bg-sky-400/10" : "border-white/10 bg-white/5 hover:bg-white/10"
                    : active ? "border-cyan bg-cyanSoft" : "border-line bg-white hover:bg-surfaceHigh"
                ].join(" ")}
                key={item.id}
                onClick={() => onOpenChannel(item)}
                type="button"
              >
                <span className="flex min-w-0 items-center justify-between gap-2">
                  <strong className={["flex min-w-0 items-center gap-2 truncate text-sm font-black", fullLayout ? "text-white" : "text-ink"].join(" ")}><span className="grid h-8 min-w-8 shrink-0 place-items-center rounded-full bg-navy-900 px-1 text-[0.62rem] text-action">{channelInitials(item)}</span><span className="truncate">{channelTitle(item)}</span></strong>
                  {(item.unread_count ?? 0) > 0 ? (
                    <span className="rounded-md bg-danger px-2 py-0.5 text-[0.65rem] font-black text-white">{item.unread_count}</span>
                  ) : null}
                </span>
                <span className={["truncate text-xs font-bold", fullLayout ? "text-slate-400" : "text-muted"].join(" ")}>{channelPreview(item)}</span>
              </button>
            );
          }) : <p className={["rounded-md border border-dashed p-3 text-xs font-bold", fullLayout ? "border-white/10 text-slate-400" : "border-line text-muted"].join(" ")}>Accepted DMs appear here.</p>}
        </div>
        <div className="grid gap-2">
          <p className={["font-mono text-[0.68rem] font-black uppercase tracking-[0.14em]", fullLayout ? "text-sky-300" : "text-cyan"].join(" ")}>Channels</p>
          {communityChannels.map((item) => {
            const active = item.id === activeChannel.id;
            return (
              <button
                className={[
                  "grid min-h-16 min-w-0 gap-1 rounded-md border px-3 py-2 text-left transition",
                  fullLayout
                    ? active ? "border-sky-400/50 bg-sky-400/10" : "border-white/10 bg-white/5 hover:bg-white/10"
                    : active ? "border-cyan bg-cyanSoft" : "border-line bg-white hover:bg-surfaceHigh"
                ].join(" ")}
                key={item.id}
                onClick={() => onOpenChannel(item)}
                type="button"
              >
                <span className="flex min-w-0 items-center justify-between gap-2">
                  <strong className={["flex min-w-0 items-center gap-2 truncate text-sm font-black", fullLayout ? "text-white" : "text-ink"].join(" ")}><span className="grid h-7 min-w-9 shrink-0 place-items-center rounded-sm bg-navy-900 px-1 text-[0.62rem] text-action">{channelInitials(item)}</span><span className="truncate">{channelTitle(item)}</span></strong>
                  {(item.unread_count ?? 0) > 0 ? (
                    <span className="rounded-md bg-danger px-2 py-0.5 text-[0.65rem] font-black text-white">{item.unread_count}</span>
                  ) : null}
                </span>
                <span className={["truncate text-xs font-bold", fullLayout ? "text-slate-400" : "text-muted"].join(" ")}>{channelTypeLabel(item)} - {item.online_count ?? 0} online - {channelPreview(item)}</span>
              </button>
            );
          })}
        </div>
      </div>
    </aside>
  );
}
