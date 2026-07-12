"use client";

import type { FormEvent } from "react";
import { Virtuoso } from "react-virtuoso";
import type { ChatMessage, ChatSearchPageInfo } from "@/lib/match-room-api";
import type { ChatProfileUser } from "./chat-types";

type SearchMentionsFilter = "" | "any" | "me";

type ChatSearchPanelProps = {
  channelTitle: string;
  dateFrom: string;
  dateTo: string;
  error: string | null;
  isSearching: boolean;
  linksOnly: boolean;
  mentions: SearchMentionsFilter;
  pageInfo: ChatSearchPageInfo;
  pinnedOnly: boolean;
  query: string;
  results: ChatMessage[];
  userDirectory: ChatProfileUser[];
  userId: string;
  onClose: () => void;
  onDateFromChange: (value: string) => void;
  onDateToChange: (value: string) => void;
  onJumpToMessage: (messageId: string) => Promise<void>;
  onLinksOnlyChange: (value: boolean) => void;
  onMentionsChange: (value: SearchMentionsFilter) => void;
  onPinnedOnlyChange: (value: boolean) => void;
  onQueryChange: (value: string) => void;
  onSearch: (event?: FormEvent<HTMLFormElement>, cursor?: string | null) => Promise<void>;
  onUserChange: (value: string) => void;
};

export function ChatSearchPanel({
  channelTitle,
  dateFrom,
  dateTo,
  error,
  isSearching,
  linksOnly,
  mentions,
  pageInfo,
  pinnedOnly,
  query,
  results,
  userDirectory,
  userId,
  onClose,
  onDateFromChange,
  onDateToChange,
  onJumpToMessage,
  onLinksOnlyChange,
  onMentionsChange,
  onPinnedOnlyChange,
  onQueryChange,
  onSearch,
  onUserChange
}: ChatSearchPanelProps) {
  return (
    <div aria-label={`Search ${channelTitle}`} aria-modal="true" className="fixed inset-0 z-[60] flex items-end bg-black/60 p-2 pb-[max(env(safe-area-inset-bottom),0.5rem)] sm:items-center sm:justify-center sm:p-4" role="dialog">
      <section className="grid max-h-[92svh] w-full max-w-2xl grid-rows-[auto_auto_minmax(0,1fr)] overflow-hidden rounded-lg border border-white/10 bg-[#172331] text-white shadow-panel" data-testid="chat-search-panel">
        <header className="flex items-center justify-between gap-3 border-b border-white/10 px-4 py-3">
          <div className="min-w-0">
            <h2 className="truncate text-lg font-black">Search {channelTitle}</h2>
            <p className="mt-0.5 text-xs text-slate-400">Find messages without leaving the channel.</p>
          </div>
          <button aria-label="Close search" className="grid h-9 w-9 place-items-center rounded-full text-xl hover:bg-white/10" onClick={onClose} type="button">X</button>
        </header>
        <form className="grid gap-3 border-b border-white/10 p-3 sm:p-4" onSubmit={(event) => void onSearch(event)}>
          <input className="min-h-11 rounded-md border border-white/10 bg-[#223447] px-3 text-base text-white outline-none placeholder:text-slate-400 focus:border-sky-400" data-testid="chat-search-input" maxLength={120} onChange={(event) => onQueryChange(event.target.value)} placeholder="Search message text" type="search" value={query} />
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <select className="min-h-10 min-w-0 rounded-md border border-white/10 bg-[#223447] px-2 text-base text-white sm:text-sm" onChange={(event) => onUserChange(event.target.value)} value={userId}>
              <option value="">Any user</option>
              {userDirectory.map((user) => <option key={user.user_id} value={user.user_id}>{user.label}</option>)}
            </select>
            <select className="min-h-10 min-w-0 rounded-md border border-white/10 bg-[#223447] px-2 text-base text-white sm:text-sm" onChange={(event) => onMentionsChange(event.target.value as SearchMentionsFilter)} value={mentions}>
              <option value="">Any mention</option>
              <option value="any">Has mentions</option>
              <option value="me">Mentions me</option>
            </select>
            <input aria-label="Messages from date" className="min-h-10 min-w-0 rounded-md border border-white/10 bg-[#223447] px-2 text-base text-white sm:text-sm" onChange={(event) => onDateFromChange(event.target.value)} type="date" value={dateFrom} />
            <input aria-label="Messages through date" className="min-h-10 min-w-0 rounded-md border border-white/10 bg-[#223447] px-2 text-base text-white sm:text-sm" onChange={(event) => onDateToChange(event.target.value)} type="date" value={dateTo} />
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <label className="inline-flex min-h-9 items-center gap-2 text-sm font-bold"><input checked={linksOnly} className="h-4 w-4 accent-sky-400" onChange={(event) => onLinksOnlyChange(event.target.checked)} type="checkbox" /> Has links</label>
            <label className="inline-flex min-h-9 items-center gap-2 text-sm font-bold"><input checked={pinnedOnly} className="h-4 w-4 accent-sky-400" onChange={(event) => onPinnedOnlyChange(event.target.checked)} type="checkbox" /> Pinned</label>
            <button className="ml-auto min-h-10 rounded-md bg-sky-500 px-4 text-sm font-black text-white hover:bg-sky-400 disabled:cursor-wait disabled:bg-slate-600" disabled={isSearching} type="submit">{isSearching ? "Searching..." : "Search"}</button>
          </div>
          {error ? <p className="rounded-md border border-red-400/30 bg-red-950/30 p-2 text-sm font-bold text-red-200">{error}</p> : null}
        </form>
        <div className="min-h-0 p-3 sm:p-4">
          {results.length ? (
            <Virtuoso
              className="h-full"
              data={results}
              increaseViewportBy={420}
              itemContent={(_, message) => (
                <div className="pb-2">
                  <button className="grid w-full gap-1 rounded-md border border-white/10 bg-white/5 p-3 text-left hover:bg-white/10" data-testid="chat-search-result" onClick={() => void onJumpToMessage(message.id)} type="button">
                    <span className="flex min-w-0 items-center justify-between gap-3"><strong className="truncate text-sm text-sky-300">{message.sender_label}</strong><span className="shrink-0 text-xs text-slate-400">{new Date(message.created_at).toLocaleString("en-NG")}</span></span>
                    <span className="line-clamp-3 text-sm leading-6 text-slate-200">{message.body}</span>
                    {message.attachment_count || message.has_poll || message.thread_reply_count ? (
                      <span className="flex flex-wrap gap-2 pt-1 text-[0.68rem] font-black uppercase tracking-[0.12em] text-slate-400">
                        {message.attachment_count ? <span>{message.attachment_count} file{message.attachment_count === 1 ? "" : "s"}</span> : null}
                        {message.has_poll ? <span>Poll</span> : null}
                        {message.thread_reply_count ? <span>{message.thread_reply_count} replies</span> : null}
                      </span>
                    ) : null}
                  </button>
                </div>
              )}
              components={{
                Footer: () => (
                  pageInfo.has_more && pageInfo.next_cursor ? (
                    <div className="pt-1">
                      <button className="min-h-11 w-full rounded-md border border-white/10 bg-white/5 font-black hover:bg-white/10 disabled:cursor-wait" disabled={isSearching} onClick={() => void onSearch(undefined, pageInfo.next_cursor)} type="button">{isSearching ? "Loading..." : "More results"}</button>
                    </div>
                  ) : <div className="h-1" />
                )
              }}
            />
          ) : <p className="rounded-md border border-dashed border-white/10 p-6 text-center text-sm font-bold text-slate-400">Search results will appear here.</p>}
        </div>
      </section>
    </div>
  );
}
