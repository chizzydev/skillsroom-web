"use client";

import { initials } from "./chat-state";
import type { ChatProfileUser } from "./chat-types";

type ChatSideRailProps = {
  users: ChatProfileUser[];
  onOpenUserProfile: (user: ChatProfileUser) => void;
};

export function ChatSideRail({ users, onOpenUserProfile }: ChatSideRailProps) {
  return (
    <aside className="hidden min-h-0 overflow-y-auto border-l border-white/10 bg-[#162536] text-white xl:block">
      <div className="grid gap-4 p-4">
        <section>
          <p className="font-mono text-[0.68rem] font-black uppercase tracking-[0.14em] text-cyan">Active now</p>
          <div className="mt-3 grid gap-2">
            {users.length ? users.slice(0, 18).map((user) => (
              <button className="flex min-w-0 items-center gap-2 rounded-md border border-white/10 bg-white/5 px-2 py-2 text-left hover:bg-white/10" key={user.user_id} onClick={() => onOpenUserProfile(user)} type="button">
                <span className="relative grid h-9 w-9 shrink-0 place-items-center rounded-full bg-navy-900 text-xs font-black text-white">
                  {initials(user.label)}
                  {user.is_online ? <span className="absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full border-2 border-[#162536] bg-success" /> : null}
                </span>
                <div className="min-w-0">
                  <p className="truncate text-sm font-black text-white">{user.label}</p>
                  <p className="truncate text-xs font-bold text-slate-400">{user.username ? `@${user.username}` : user.is_online ? "online" : "recent"}</p>
                </div>
              </button>
            )) : (
              <p className="rounded-md border border-dashed border-white/10 p-3 text-sm font-bold text-slate-400">Active players will appear here.</p>
            )}
          </div>
        </section>
        <section className="rounded-md border border-white/10 bg-white/5 p-3">
          <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-400">Mentions</p>
          <p className="mt-2 text-sm leading-6 text-slate-400">Type @ and choose an active username when available.</p>
        </section>
      </div>
    </aside>
  );
}
