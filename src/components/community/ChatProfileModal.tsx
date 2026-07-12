"use client";

import type { ChatChannel } from "@/lib/match-room-api";
import { channelTitle, channelTypeLabel, initials } from "./chat-state";
import type { ChatProfileUser } from "./chat-types";

type ChatProfileModalProps = {
  activeChannel: ChatChannel;
  channel: ChatChannel;
  dmIntro: string;
  isSelf: boolean;
  isRequestingDm: boolean;
  profileAction: "report" | "block" | null;
  user: ChatProfileUser;
  onBlock: () => Promise<void>;
  onClose: () => void;
  onDmIntroChange: (value: string) => void;
  onReport: () => Promise<void>;
  onRequestDm: () => Promise<void>;
};

export function ChatProfileModal({
  activeChannel,
  channel,
  dmIntro,
  isSelf,
  isRequestingDm,
  profileAction,
  user,
  onBlock,
  onClose,
  onDmIntroChange,
  onReport,
  onRequestDm
}: ChatProfileModalProps) {
  return (
    <div aria-label={`${user.label} profile`} aria-modal="true" className="fixed inset-0 z-[62] flex items-end bg-black/60 p-2 pb-[max(env(safe-area-inset-bottom),0.5rem)] sm:items-center sm:justify-center sm:p-4" onClick={onClose} role="dialog">
      <section className="max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-lg border border-white/10 bg-[#171b25] text-white shadow-panel" onClick={(event) => event.stopPropagation()}>
        <div className="h-20 rounded-t-lg bg-[linear-gradient(135deg,#22d3ee,#8b5cf6_55%,#111827)]" />
        <div className="px-5 pb-5">
          <div className="-mt-10 flex items-end justify-between gap-3">
            <span className="relative grid h-20 w-20 shrink-0 place-items-center rounded-full border-4 border-[#171b25] bg-navy-900 text-2xl font-black text-action shadow-tight">
              {initials(user.label)}
              {user.is_online ? <span className="absolute bottom-1 right-1 h-4 w-4 rounded-full border-2 border-[#171b25] bg-success" /> : null}
            </span>
            <button aria-label="Close profile" className="mb-2 grid h-10 w-10 shrink-0 place-items-center rounded-full bg-white/10 text-lg font-black text-slate-200 hover:bg-white/20" onClick={onClose} type="button">X</button>
          </div>

          <div className="mt-4 min-w-0">
            <h2 className="break-words text-3xl font-black leading-tight text-white">{isSelf ? "You" : user.label}</h2>
            <p className="mt-1 break-words text-base font-bold text-slate-300">{user.username ? `@${user.username}` : user.label}</p>
            <p className="mt-2 text-sm font-bold text-slate-400">{user.is_online ? "Online now" : "Recent in this channel"} / {channelTitle(channel)}</p>
          </div>

          <div className="mt-5 grid gap-2 sm:grid-cols-[1fr_auto_auto]">
            {isSelf ? (
              <a className="grid min-h-11 place-items-center rounded-full bg-action px-4 text-sm font-black text-navy-950 shadow-action hover:bg-action/90" href="/profile">Edit profile</a>
            ) : (
              <button className="min-h-11 rounded-full bg-action px-4 text-sm font-black text-navy-950 shadow-action hover:bg-action/90 disabled:cursor-wait disabled:bg-slate-600 disabled:text-slate-300 disabled:shadow-none" disabled={isRequestingDm} onClick={() => void onRequestDm()} type="button">
                {isRequestingDm ? "Requesting..." : "Request DM"}
              </button>
            )}
            {!isSelf ? <button className="min-h-11 rounded-full bg-white/10 px-4 text-sm font-black text-white hover:bg-white/15 disabled:cursor-wait disabled:opacity-60" disabled={profileAction !== null} onClick={() => void onReport()} type="button">{profileAction === "report" ? "Reporting..." : "Report"}</button> : null}
            {!isSelf ? <button className="min-h-11 rounded-full bg-red-500/20 px-4 text-sm font-black text-red-100 hover:bg-red-500/30 disabled:cursor-wait disabled:opacity-60" disabled={profileAction !== null} onClick={() => void onBlock()} type="button">{profileAction === "block" ? "Blocking..." : "Block"}</button> : null}
          </div>

          {!isSelf ? (
            <div className="mt-5 rounded-lg border border-white/10 bg-white/5 p-3">
              <label className="grid gap-2 text-sm font-bold text-slate-300">
                <span className="font-black text-white">DM intro</span>
                <textarea className="min-h-20 resize-y rounded-md border border-white/10 bg-[#223447] p-3 text-base leading-6 text-white outline-none placeholder:text-slate-500 focus:border-sky-400" maxLength={240} onChange={(event) => onDmIntroChange(event.target.value)} placeholder={`Say why you want to message ${user.label}`} value={dmIntro} />
              </label>
              <p className="mt-2 text-xs leading-5 text-slate-400">DMs use request-and-accept first. Be careful with links, payment requests, and off-platform claims.</p>
            </div>
          ) : null}

          <div className="mt-5 grid gap-3">
            <section className="rounded-lg border border-white/10 bg-white/5 p-4">
              <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-400">Skillsroom identity</p>
              <p className="mt-2 text-sm leading-6 text-slate-200">This public identity follows the player across Global Chat, game channels, room channels, and future DMs when they update their profile.</p>
            </section>
            <section className="rounded-lg border border-white/10 bg-white/5 p-4">
              <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-400">Channel status</p>
              <div className="mt-3 flex flex-wrap gap-2">
                <span className="rounded-full bg-white/10 px-3 py-1 text-xs font-black text-slate-200">{user.is_online ? "Active now" : "Recent"}</span>
                <span className="rounded-full bg-white/10 px-3 py-1 text-xs font-black text-slate-200">{isSelf ? "Your account" : "Member"}</span>
                <span className="rounded-full bg-white/10 px-3 py-1 text-xs font-black text-slate-200">{channelTypeLabel(activeChannel)}</span>
              </div>
            </section>
          </div>
        </div>
      </section>
    </div>
  );
}
