"use client";

import type {
  ChatChannel,
  ChatChannelControls,
  ChatNotificationLevel,
  ChatPinnedMessage,
  ChatUserBlock
} from "@/lib/match-room-api";
import {
  channelInitials,
  channelPreview,
  channelTitle,
  channelTypeLabel,
  initials,
  pinExpiryLabel
} from "./chat-state";
import type { ChatProfileUser, MediaPage } from "./chat-types";
import { ChatMediaPanel } from "./ChatMediaPanel";

export type ChatInfoTab = "members" | "messages" | "channels" | "media" | "pins" | "settings";

type ChatInfoPanelProps = {
  activeChannel: ChatChannel;
  activeChannelSubtitle: string;
  blockedUsers: ChatUserBlock[];
  canManageAnyPin: boolean;
  channelControls: ChatChannelControls | null;
  communityChannels: ChatChannel[];
  controlAction: "notifications" | "slow" | "lock" | "unlock" | null;
  currentUserId: string;
  displayActiveChannel: ChatChannel;
  dmChannels: ChatChannel[];
  dmNotificationLevel: ChatNotificationLevel;
  infoTab: ChatInfoTab;
  isLoadingBlockedUsers: boolean;
  isLoadingControls: boolean;
  isLoadingMedia: boolean;
  isSavingControls: boolean;
  lockdownMinutes: number;
  lockdownReason: string;
  mediaError: string | null;
  mediaPage: MediaPage | undefined;
  notificationLevel: ChatNotificationLevel;
  pinnedMessages: ChatPinnedMessage[];
  pushEnabled: boolean;
  slowModeSeconds: number;
  unblockingIds: Set<string>;
  unpinningIds: Set<string>;
  userDirectory: ChatProfileUser[];
  onClose: () => void;
  onGoHome: () => void;
  onInfoTabChange: (tab: ChatInfoTab) => void;
  onLoadMedia: (before?: string | null) => Promise<void>;
  onOpenChannel: (channel: ChatChannel) => Promise<void>;
  onOpenPinnedMessage: (messageId: string) => void;
  onOpenUserProfile: (user: ChatProfileUser) => void;
  onSaveModerationControls: (action: "slow" | "lock" | "unlock") => Promise<void>;
  onSaveNotificationControls: () => Promise<void>;
  onSetDmNotificationLevel: (level: ChatNotificationLevel) => void;
  onSetLockdownMinutes: (minutes: number) => void;
  onSetLockdownReason: (reason: string) => void;
  onSetNotificationLevel: (level: ChatNotificationLevel) => void;
  onSetPushEnabled: (enabled: boolean) => void;
  onSetSlowModeSeconds: (seconds: number) => void;
  onUnblockUser: (userId: string) => Promise<void>;
  onUnpinMessage: (messageId: string) => Promise<void>;
  onViewImage: (attachment: MediaPage["attachments"][number], url: string) => void;
};

export function ChatInfoPanel({
  activeChannel,
  activeChannelSubtitle,
  blockedUsers,
  canManageAnyPin,
  channelControls,
  communityChannels,
  controlAction,
  currentUserId,
  displayActiveChannel,
  dmChannels,
  dmNotificationLevel,
  infoTab,
  isLoadingBlockedUsers,
  isLoadingControls,
  isLoadingMedia,
  isSavingControls,
  lockdownMinutes,
  lockdownReason,
  mediaError,
  mediaPage,
  notificationLevel,
  pinnedMessages,
  pushEnabled,
  slowModeSeconds,
  unblockingIds,
  unpinningIds,
  userDirectory,
  onClose,
  onGoHome,
  onInfoTabChange,
  onLoadMedia,
  onOpenChannel,
  onOpenPinnedMessage,
  onOpenUserProfile,
  onSaveModerationControls,
  onSaveNotificationControls,
  onSetDmNotificationLevel,
  onSetLockdownMinutes,
  onSetLockdownReason,
  onSetNotificationLevel,
  onSetPushEnabled,
  onSetSlowModeSeconds,
  onUnblockUser,
  onUnpinMessage,
  onViewImage
}: ChatInfoPanelProps) {
  return (
    <div aria-label={`${channelTitle(displayActiveChannel)} details`} aria-modal="true" className="fixed inset-0 z-50 grid max-w-[100vw] overflow-x-hidden bg-black/60 pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)] sm:place-items-center sm:p-4" role="dialog">
      <section className="grid h-full min-h-0 w-full min-w-0 max-w-full grid-rows-[auto_auto_1fr] overflow-hidden bg-[#172331] text-white shadow-panel sm:h-[min(48rem,92vh)] sm:max-w-2xl sm:rounded-lg sm:border sm:border-white/10">
        <header className="flex min-w-0 items-center gap-2 border-b border-white/10 px-3 py-2.5 sm:gap-3 sm:p-4">
          <button aria-label="Close channel details" className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-sm font-black text-white hover:bg-white/10" onClick={onClose} title="Close details" type="button">X</button>
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-navy-900 text-sm font-black text-action shadow-tight sm:h-14 sm:w-14 sm:text-base">{channelInitials(displayActiveChannel)}</span>
          <div className="min-w-0 flex-1">
            <h2 className="truncate text-base font-black text-white sm:text-xl">{channelTitle(displayActiveChannel)}</h2>
            <p className="mt-0.5 truncate text-xs font-bold text-slate-300 sm:mt-1 sm:text-sm">{activeChannelSubtitle} / {userDirectory.length} active or recent</p>
          </div>
          <button aria-label="Go to chat home" className="min-h-9 shrink-0 rounded-full border border-white/10 bg-white/5 px-3 text-xs font-black text-white hover:bg-white/10" onClick={onGoHome} title="Go to chat home" type="button">Chat</button>
        </header>

        <div className="grid grid-cols-6 border-b border-white/10 px-1 sm:px-3">
          {(["members", "messages", "channels", "media", "pins", "settings"] as const).map((tab) => (
            <button className={["min-h-11 min-w-0 truncate border-b-2 px-1 text-[0.62rem] font-black capitalize sm:min-h-12 sm:px-2 sm:text-sm", infoTab === tab ? "border-sky-400 text-sky-300" : "border-transparent text-slate-400 hover:text-white"].join(" ")} key={tab} onClick={() => onInfoTabChange(tab)} type="button">
              {tab === "messages" ? "DMs" : tab}{tab === "messages" && dmChannels.length ? ` ${dmChannels.length}` : tab === "channels" ? ` ${communityChannels.length}` : tab === "pins" && pinnedMessages.length ? ` ${pinnedMessages.length}` : ""}
            </button>
          ))}
        </div>

        <div className="min-h-0 overflow-y-auto p-3 sm:p-4">
          {infoTab === "members" ? (
            <div className="grid gap-2">
              <p className="mb-1 text-xs font-black uppercase tracking-[0.14em] text-slate-400">Active and recent members</p>
              {userDirectory.length ? userDirectory.map((user) => (
                <button className="flex min-w-0 items-center gap-3 rounded-md bg-white/5 p-2.5 text-left hover:bg-white/10 sm:p-3" key={user.user_id} onClick={() => onOpenUserProfile(user)} type="button">
                  <span className="relative grid h-10 w-10 shrink-0 place-items-center rounded-full bg-navy-900 text-sm font-black text-white sm:h-11 sm:w-11">
                    {initials(user.label)}
                    {user.is_online ? <span className="absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-[#172331] bg-success" /> : null}
                  </span>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-black text-white">{user.label}</p>
                    <p className="truncate text-xs font-bold text-slate-400">{user.username ? `@${user.username} / ` : ""}{user.is_online ? "online" : "recent"}</p>
                  </div>
                </button>
              )) : <p className="rounded-md border border-dashed border-white/10 p-5 text-center text-sm font-bold text-slate-400">Members appear here as they become active in this channel.</p>}
            </div>
          ) : null}

          {infoTab === "messages" ? (
            <div className="grid gap-2">
              <p className="mb-1 text-xs font-black uppercase tracking-[0.14em] text-slate-400">Direct messages</p>
              {dmChannels.length ? dmChannels.map((item) => (
                <button className={["flex min-w-0 items-center gap-3 rounded-md border p-3 text-left", item.id === activeChannel.id ? "border-sky-400 bg-sky-400/10" : "border-white/10 bg-white/5 hover:bg-white/10"].join(" ")} key={item.id} onClick={() => void onOpenChannel(item)} type="button">
                  <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-navy-900 px-1 text-xs font-black text-action">{channelInitials(item)}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-black text-white">{channelTitle(item)}</span>
                    <span className="mt-1 block truncate text-xs font-bold text-slate-400">{channelPreview(item)}</span>
                  </span>
                  {(item.unread_count ?? 0) > 0 ? <span className="rounded-full bg-sky-500 px-2 py-1 text-xs font-black text-white">{item.unread_count}</span> : null}
                </button>
              )) : <p className="rounded-md border border-dashed border-white/10 p-5 text-center text-sm font-bold text-slate-400">Accepted DMs will appear here.</p>}
            </div>
          ) : null}

          {infoTab === "channels" ? (
            <div className="grid gap-2">
              <p className="mb-1 text-xs font-black uppercase tracking-[0.14em] text-slate-400">Your accessible channels</p>
              {communityChannels.map((item) => (
                <button className={["flex min-w-0 items-center gap-3 rounded-md border p-3 text-left", item.id === activeChannel.id ? "border-sky-400 bg-sky-400/10" : "border-white/10 bg-white/5 hover:bg-white/10"].join(" ")} key={item.id} onClick={() => void onOpenChannel(item)} type="button">
                  <span className="grid h-11 w-11 shrink-0 place-items-center rounded-md bg-white/10 px-1 text-xs font-black text-sky-300">{channelInitials(item)}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-black text-white">{channelTitle(item)}</span>
                    <span className="mt-1 block truncate text-xs font-bold text-slate-400">{channelTypeLabel(item)} / {item.online_count ?? 0} online / {channelPreview(item)}</span>
                  </span>
                  {(item.unread_count ?? 0) > 0 ? <span className="rounded-full bg-sky-500 px-2 py-1 text-xs font-black text-white">{item.unread_count}</span> : null}
                </button>
              ))}
            </div>
          ) : null}

          {infoTab === "media" ? (
            <ChatMediaPanel
              attachments={mediaPage?.attachments ?? []}
              channelSlug={activeChannel.slug}
              error={mediaError}
              hasMore={mediaPage?.page_info.has_more ?? false}
              isLoading={isLoadingMedia}
              nextBefore={mediaPage?.page_info.next_before ?? null}
              onLoadMore={onLoadMedia}
              onOpenImage={onViewImage}
            />
          ) : null}

          {infoTab === "pins" ? (
            <div className="grid gap-2">
              <p className="mb-1 text-xs font-black uppercase tracking-[0.14em] text-slate-400">Pinned messages</p>
              {pinnedMessages.length ? pinnedMessages.map((pin) => (
                <article className="rounded-md border border-white/10 bg-white/5 p-3" key={pin.id}>
                  <div className="flex min-w-0 items-start justify-between gap-2">
                    <button className="min-w-0 flex-1 text-left" onClick={() => onOpenPinnedMessage(pin.message_id)} type="button">
                      <span className="block truncate text-sm font-black text-sky-300">{pin.sender_label}</span>
                      <span className="mt-2 block truncate text-sm leading-6 text-white">{pin.body?.trim() || "Photo"}</span>
                      <span className="mt-2 block text-xs font-bold text-slate-400">{pinExpiryLabel(pin.expires_at)}</span>
                    </button>
                    {canManageAnyPin || pin.pinned_by_user_id === currentUserId || pin.sender_user_id === currentUserId ? (
                      <button className="shrink-0 rounded-sm px-2 py-1 text-[0.68rem] font-black uppercase tracking-[0.12em] text-slate-300 hover:bg-white/10 disabled:cursor-wait disabled:opacity-60" disabled={unpinningIds.has(pin.message_id)} onClick={() => void onUnpinMessage(pin.message_id)} type="button">{unpinningIds.has(pin.message_id) ? "Unpinning..." : "Unpin"}</button>
                    ) : null}
                  </div>
                </article>
              )) : <p className="rounded-md border border-dashed border-white/10 p-5 text-center text-sm font-bold text-slate-400">No messages are pinned in this channel yet.</p>}
            </div>
          ) : null}

          {infoTab === "settings" ? (
            <div className="grid gap-5">
              <section className="grid gap-3">
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-400">Notifications</p>
                  <p className="mt-1 text-sm text-slate-300">Choose what this channel can notify you about.</p>
                </div>
                {isLoadingControls ? <p className="text-sm font-bold text-slate-400">Loading settings...</p> : (
                  <>
                    <div className="grid grid-cols-3 gap-1 rounded-md bg-white/5 p-1">
                      {(["all", "mentions", "none"] as const).map((level) => (
                        <button className={["min-h-10 rounded-sm px-2 text-xs font-black capitalize", notificationLevel === level ? "bg-sky-400 text-navy-950" : "text-slate-300 hover:bg-white/10"].join(" ")} key={level} onClick={() => onSetNotificationLevel(level)} type="button">
                          {level === "all" ? "Everything" : level === "mentions" ? "Mentions" : "Nothing"}
                        </button>
                      ))}
                    </div>
                    {activeChannel.channel_type === "dm" ? (
                      <label className="grid gap-2 text-sm font-bold text-slate-200">
                        DM notifications
                        <select className="min-h-11 rounded-md border border-white/10 bg-[#223447] px-3 text-white" onChange={(event) => onSetDmNotificationLevel(event.target.value as ChatNotificationLevel)} value={dmNotificationLevel}>
                          <option value="all">Everything</option>
                          <option value="mentions">Mentions only</option>
                          <option value="none">Nothing</option>
                        </select>
                      </label>
                    ) : null}
                    <label className="flex min-h-12 items-center justify-between gap-4 rounded-md border border-white/10 bg-white/5 p-3 text-sm font-black">
                      <span className="grid gap-1">
                        <span>Browser notifications</span>
                        <span className="text-xs font-bold text-slate-400">Mobile alerts are managed in the app.</span>
                      </span>
                      <input checked={pushEnabled} className="h-5 w-5 accent-sky-400" onChange={(event) => onSetPushEnabled(event.target.checked)} type="checkbox" />
                    </label>
                    <button className="min-h-11 rounded-md bg-sky-500 px-4 text-sm font-black text-white hover:bg-sky-400 disabled:opacity-60" disabled={isSavingControls} onClick={() => void onSaveNotificationControls()} type="button">
                      {controlAction === "notifications" ? "Saving..." : "Save notifications"}
                    </button>
                  </>
                )}
              </section>

              {channelControls?.can_manage_channel ? (
                <section className="grid gap-3 border-t border-white/10 pt-5">
                  <div>
                    <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-400">Channel controls</p>
                    <p className="mt-1 text-sm text-slate-300">Slow mode limits members. Lockdown stops member posting temporarily.</p>
                  </div>
                  <label className="grid gap-2 text-sm font-bold text-slate-200">
                    Slow mode
                    <select className="min-h-11 rounded-md border border-white/10 bg-[#223447] px-3 text-white" onChange={(event) => onSetSlowModeSeconds(Number(event.target.value))} value={slowModeSeconds}>
                      <option value={0}>Off</option>
                      <option value={5}>5 seconds</option>
                      <option value={15}>15 seconds</option>
                      <option value={30}>30 seconds</option>
                      <option value={60}>1 minute</option>
                      <option value={300}>5 minutes</option>
                      <option value={3600}>1 hour</option>
                    </select>
                  </label>
                  <button className="min-h-11 rounded-md border border-sky-300/30 bg-sky-950/30 px-4 text-sm font-black text-sky-200 hover:bg-sky-950/50 disabled:opacity-60" disabled={isSavingControls} onClick={() => void onSaveModerationControls("slow")} type="button">
                    {controlAction === "slow" ? "Saving slow mode..." : "Save slow mode"}
                  </button>
                  <div className="grid grid-cols-[8rem_minmax(0,1fr)] gap-2">
                    <label className="grid gap-2 text-xs font-bold text-slate-300">
                      Lock duration
                      <select className="min-h-11 rounded-md border border-white/10 bg-[#223447] px-2 text-white" onChange={(event) => onSetLockdownMinutes(Number(event.target.value))} value={lockdownMinutes}>
                        <option value={30}>30 min</option>
                        <option value={60}>1 hour</option>
                        <option value={360}>6 hours</option>
                        <option value={1440}>24 hours</option>
                      </select>
                    </label>
                    <label className="grid gap-2 text-xs font-bold text-slate-300">
                      Reason
                      <input className="min-h-11 min-w-0 rounded-md border border-white/10 bg-[#223447] px-3 text-base text-white" onChange={(event) => onSetLockdownReason(event.target.value)} placeholder="Why is posting paused?" value={lockdownReason} />
                    </label>
                  </div>
                  {channelControls.lockdown_until && Date.parse(channelControls.lockdown_until) > Date.now() ? (
                    <button className="min-h-11 rounded-md border border-red-300/30 bg-red-950/30 px-4 text-sm font-black text-red-200 hover:bg-red-950/50 disabled:opacity-60" disabled={isSavingControls} onClick={() => void onSaveModerationControls("unlock")} type="button">
                      {controlAction === "unlock" ? "Unlocking..." : "Remove lockdown"}
                    </button>
                  ) : (
                    <button className="min-h-11 rounded-md bg-amber-400 px-4 text-sm font-black text-navy-950 hover:bg-amber-300 disabled:opacity-60" disabled={isSavingControls || !lockdownReason.trim()} onClick={() => void onSaveModerationControls("lock")} type="button">
                      {controlAction === "lock" ? "Locking channel..." : "Start temporary lockdown"}
                    </button>
                  )}
                </section>
              ) : null}

              <section className="grid gap-3 border-t border-white/10 pt-5">
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-400">Blocked users</p>
                  <p className="mt-1 text-sm text-slate-300">Blocked players cannot start or continue private DMs with you.</p>
                </div>
                {isLoadingBlockedUsers ? <p className="text-sm font-bold text-slate-400">Loading blocked users...</p> : blockedUsers.length ? blockedUsers.map((block) => (
                  <div className="flex items-center justify-between gap-3 rounded-md border border-white/10 bg-white/5 p-3" key={block.blocked_user_id}>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-black text-white">{block.blocked_label}</p>
                      {block.reason ? <p className="mt-1 truncate text-xs text-slate-400">{block.reason}</p> : null}
                    </div>
                    <button className="shrink-0 rounded-sm px-3 py-2 text-xs font-black text-sky-300 hover:bg-white/10 disabled:opacity-60" disabled={unblockingIds.has(block.blocked_user_id)} onClick={() => void onUnblockUser(block.blocked_user_id)} type="button">
                      {unblockingIds.has(block.blocked_user_id) ? "Unblocking..." : "Unblock"}
                    </button>
                  </div>
                )) : <p className="rounded-md border border-dashed border-white/10 p-4 text-center text-sm font-bold text-slate-400">You have not blocked anyone.</p>}
              </section>
            </div>
          ) : null}
        </div>
      </section>
    </div>
  );
}
