"use client";

import type { FormEvent } from "react";
import type {
  ChatBookmark,
  ChatChannel,
  ChatMessage,
  ChatReactionMember,
  ScheduledChatAnnouncement
} from "@/lib/match-room-api";
import { channelTitle, chatMessageMaxLength } from "./chat-state";

type ReactionOption = {
  key: string;
  label: string;
};

type ChatActionModalsProps = {
  actionMessage: ChatMessage | null;
  activeChannel: ChatChannel;
  bookmarks: ChatBookmark[];
  bookmarkingIds: Set<string>;
  canManageAnyPin: boolean;
  channelList: ChatChannel[];
  currentUserId: string;
  deleteTarget: ChatMessage | null;
  deletingIds: Set<string>;
  editBody: string;
  editTarget: ChatMessage | null;
  forwardChannelSlug: string;
  forwardTarget: ChatMessage | null;
  isCreatingPoll: boolean;
  isEditing: boolean;
  isForwarding: boolean;
  isLoadingBookmarks: boolean;
  isLoadingReactions: boolean;
  isLoadingSchedules: boolean;
  isPinning: boolean;
  isScheduling: boolean;
  pinDurationHours: 24 | 168 | 720;
  pinTarget: ChatMessage | null;
  pinnedMessages: Array<{ message_id: string }>;
  pollClosesAt: string;
  pollMultiple: boolean;
  pollOptions: string[];
  pollQuestion: string;
  reactionMembers: ChatReactionMember[];
  reactionOptions: ReactionOption[];
  reactionTarget: ChatMessage | null;
  scheduledAnnouncements: ScheduledChatAnnouncement[];
  scheduledBody: string;
  scheduledFor: string;
  showBookmarks: boolean;
  showPollCreator: boolean;
  showSchedule: boolean;
  onBeginEdit: (message: ChatMessage) => void;
  onCancelEdit: () => void;
  onCloseActionMessage: () => void;
  onCloseBookmarks: () => void;
  onClosePollCreator: () => void;
  onCloseReactionDetails: () => void;
  onCloseSchedule: () => void;
  onCopyMessageLink: (message: ChatMessage) => Promise<void>;
  onCopyText: (body: string) => Promise<void>;
  onCreatePoll: (event: FormEvent<HTMLFormElement>) => void;
  onDeleteMessage: (message: ChatMessage) => Promise<void>;
  onEditBodyChange: (body: string) => void;
  onForwardChannelSlugChange: (slug: string) => void;
  onForwardMessage: () => Promise<void>;
  onJumpToBookmark: (bookmark: ChatBookmark) => Promise<void>;
  onOpenReactions: (message: ChatMessage) => Promise<void>;
  onOpenThread: (message: ChatMessage) => Promise<void>;
  onPinMessage: (message: ChatMessage, durationHours: 24 | 168 | 720) => Promise<void>;
  onPollClosesAtChange: (value: string) => void;
  onPollMultipleChange: (value: boolean) => void;
  onPollOptionsChange: (options: string[]) => void;
  onPollQuestionChange: (value: string) => void;
  onReportMessage: (message: ChatMessage) => Promise<void>;
  onReply: (message: ChatMessage) => void;
  onSaveEdit: (event: FormEvent<HTMLFormElement>) => void;
  onScheduleAnnouncement: (event: FormEvent<HTMLFormElement>) => void;
  onScheduledBodyChange: (value: string) => void;
  onScheduledForChange: (value: string) => void;
  onSetDeleteTarget: (message: ChatMessage | null) => void;
  onSetForwardTarget: (message: ChatMessage | null) => void;
  onSetPinDurationHours: (hours: 24 | 168 | 720) => void;
  onSetPinTarget: (message: ChatMessage | null) => void;
  onToggleBookmark: (message: ChatMessage) => Promise<void>;
  canDeleteMessage: (message: ChatMessage) => boolean;
  canEditMessage: (message: ChatMessage) => boolean;
};

export function ChatActionModals({
  actionMessage,
  activeChannel,
  bookmarks,
  bookmarkingIds,
  canManageAnyPin,
  channelList,
  currentUserId,
  deleteTarget,
  deletingIds,
  editBody,
  editTarget,
  forwardChannelSlug,
  forwardTarget,
  isCreatingPoll,
  isEditing,
  isForwarding,
  isLoadingBookmarks,
  isLoadingReactions,
  isLoadingSchedules,
  isPinning,
  isScheduling,
  pinDurationHours,
  pinTarget,
  pinnedMessages,
  pollClosesAt,
  pollMultiple,
  pollOptions,
  pollQuestion,
  reactionMembers,
  reactionOptions,
  reactionTarget,
  scheduledAnnouncements,
  scheduledBody,
  scheduledFor,
  showBookmarks,
  showPollCreator,
  showSchedule,
  onBeginEdit,
  onCancelEdit,
  onCloseActionMessage,
  onCloseBookmarks,
  onClosePollCreator,
  onCloseReactionDetails,
  onCloseSchedule,
  onCopyMessageLink,
  onCopyText,
  onCreatePoll,
  onDeleteMessage,
  onEditBodyChange,
  onForwardChannelSlugChange,
  onForwardMessage,
  onJumpToBookmark,
  onOpenReactions,
  onOpenThread,
  onPinMessage,
  onPollClosesAtChange,
  onPollMultipleChange,
  onPollOptionsChange,
  onPollQuestionChange,
  onReportMessage,
  onReply,
  onSaveEdit,
  onScheduleAnnouncement,
  onScheduledBodyChange,
  onScheduledForChange,
  onSetDeleteTarget,
  onSetForwardTarget,
  onSetPinDurationHours,
  onSetPinTarget,
  onToggleBookmark,
  canDeleteMessage,
  canEditMessage
}: ChatActionModalsProps) {
  return (
    <>
      {pinTarget ? (
        <div aria-label="Choose pin duration" aria-modal="true" className="fixed inset-0 z-[60] grid place-items-center bg-black/60 p-4" role="dialog">
          <section className="w-full max-w-sm rounded-lg border border-white/10 bg-[#172331] p-5 text-white shadow-panel">
            <h2 className="text-xl font-black">Choose how long this pin lasts</h2>
            <p className="mt-2 text-sm leading-6 text-slate-300">You or an authorized team member can unpin it sooner.</p>
            <div className="mt-5 grid gap-2">
              {([
                [24, "24 hours"],
                [168, "7 days"],
                [720, "30 days"]
              ] as const).map(([hours, label]) => (
                <label className={["flex min-h-12 cursor-pointer items-center gap-3 rounded-md border px-3", pinDurationHours === hours ? "border-sky-400 bg-sky-400/10" : "border-white/10 bg-white/5"].join(" ")} key={hours}>
                  <input checked={pinDurationHours === hours} className="h-5 w-5 accent-sky-400" disabled={isPinning} name="pin-duration" onChange={() => onSetPinDurationHours(hours)} type="radio" />
                  <span className="font-black">{label}</span>
                </label>
              ))}
            </div>
            <div className="mt-6 grid grid-cols-2 gap-2">
              <button className="min-h-11 rounded-md border border-white/10 bg-white/5 px-4 font-black text-white hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50" disabled={isPinning} onClick={() => onSetPinTarget(null)} type="button">Cancel</button>
              <button className="min-h-11 rounded-md bg-sky-500 px-4 font-black text-white hover:bg-sky-400 disabled:cursor-wait disabled:bg-sky-700" disabled={isPinning} onClick={() => void onPinMessage(pinTarget, pinDurationHours)} type="button">{isPinning ? "Pinning..." : "Pin"}</button>
            </div>
          </section>
        </div>
      ) : null}

      {actionMessage ? (
        <div aria-label="Message actions" aria-modal="true" className="fixed inset-0 z-[65] flex items-end bg-black/60 p-2 pb-[max(env(safe-area-inset-bottom),0.5rem)] sm:items-center sm:justify-center sm:p-4" onClick={onCloseActionMessage} role="dialog">
          <section className="w-full max-w-md overflow-hidden rounded-lg border border-white/10 bg-[#172331] text-white shadow-panel" onClick={(event) => event.stopPropagation()}>
            <header className="flex items-center justify-between border-b border-white/10 px-4 py-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-black">{actionMessage.sender_user_id === currentUserId ? "Your message" : actionMessage.sender_label}</p>
                <p className="mt-0.5 truncate text-xs text-slate-400">{actionMessage.status === "deleted" ? "Deleted message" : actionMessage.body}</p>
              </div>
              <button aria-label="Close message actions" className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-xl text-slate-300 hover:bg-white/10" onClick={onCloseActionMessage} type="button">X</button>
            </header>
            <div className="grid grid-cols-2 gap-px bg-white/10 sm:grid-cols-3">
              {actionMessage.status === "visible" ? <button className="min-h-14 bg-[#172331] px-3 text-sm font-black hover:bg-[#223447]" onClick={() => onReply(actionMessage)} type="button">Reply</button> : null}
              {actionMessage.status === "visible" ? <button className="min-h-14 bg-[#172331] px-3 text-sm font-black hover:bg-[#223447]" onClick={() => { onCloseActionMessage(); void onOpenThread(actionMessage); }} type="button">Open thread</button> : null}
              {actionMessage.status === "visible" ? <button className="min-h-14 bg-[#172331] px-3 text-sm font-black hover:bg-[#223447]" onClick={() => { onSetForwardTarget(actionMessage); onForwardChannelSlugChange(activeChannel.slug); onCloseActionMessage(); }} type="button">Forward</button> : null}
              {actionMessage.status === "visible" ? <button className="min-h-14 bg-[#172331] px-3 text-sm font-black hover:bg-[#223447]" disabled={bookmarkingIds.has(actionMessage.id)} onClick={() => void onToggleBookmark(actionMessage)} type="button">{actionMessage.bookmarked_by_me ? "Unsave" : "Save"}</button> : null}
              {actionMessage.status === "visible" && actionMessage.reactions?.some((reaction) => reaction.count > 0) ? <button className="min-h-14 bg-[#172331] px-3 text-sm font-black hover:bg-[#223447]" onClick={() => { onCloseActionMessage(); void onOpenReactions(actionMessage); }} type="button">Reactions</button> : null}
              {actionMessage.status === "visible" ? <button className="min-h-14 bg-[#172331] px-3 text-sm font-black hover:bg-[#223447]" onClick={() => void onCopyText(actionMessage.body)} type="button">Copy text</button> : null}
              <button className="min-h-14 bg-[#172331] px-3 text-sm font-black hover:bg-[#223447]" onClick={() => void onCopyMessageLink(actionMessage)} type="button">Copy link</button>
              {canEditMessage(actionMessage) ? <button className="min-h-14 bg-[#172331] px-3 text-sm font-black hover:bg-[#223447]" onClick={() => onBeginEdit(actionMessage)} type="button">Edit</button> : null}
              {canDeleteMessage(actionMessage) ? <button className="min-h-14 bg-[#172331] px-3 text-sm font-black text-red-300 hover:bg-red-950/40" onClick={() => { onSetDeleteTarget(actionMessage); onCloseActionMessage(); }} type="button">Delete</button> : null}
              {actionMessage.status === "visible" && (actionMessage.sender_user_id === currentUserId || canManageAnyPin) && !pinnedMessages.some((pin) => pin.message_id === actionMessage.id) ? <button className="min-h-14 bg-[#172331] px-3 text-sm font-black hover:bg-[#223447]" onClick={() => { onSetPinTarget(actionMessage); onCloseActionMessage(); }} type="button">Pin</button> : null}
              {actionMessage.status === "visible" && actionMessage.sender_user_id !== currentUserId ? <button className="min-h-14 bg-[#172331] px-3 text-sm font-black hover:bg-[#223447]" onClick={() => { onCloseActionMessage(); void onReportMessage(actionMessage); }} type="button">Report</button> : null}
            </div>
          </section>
        </div>
      ) : null}

      {editTarget ? (
        <div aria-label="Edit message" aria-modal="true" className="fixed inset-0 z-[70] flex items-end bg-black/60 p-2 pb-[max(env(safe-area-inset-bottom),0.5rem)] sm:items-center sm:justify-center sm:p-4" role="dialog">
          <form className="w-full max-w-lg rounded-lg border border-white/10 bg-[#172331] p-4 text-white shadow-panel sm:p-5" onSubmit={onSaveEdit}>
            <h2 className="text-lg font-black">Edit message</h2>
            <p className="mt-1 text-sm text-slate-300">Your edit will be marked, and the previous version remains available to authorized moderators.</p>
            <textarea autoFocus className="mt-4 min-h-28 w-full resize-y rounded-md border border-white/10 bg-[#223447] p-3 text-base leading-6 text-white outline-none focus:border-sky-400" disabled={isEditing} maxLength={chatMessageMaxLength} onChange={(event) => onEditBodyChange(event.target.value)} value={editBody} />
            <div className="mt-4 grid grid-cols-2 gap-2">
              <button className="min-h-11 rounded-md border border-white/10 bg-white/5 px-4 font-black hover:bg-white/10 disabled:opacity-50" disabled={isEditing} onClick={onCancelEdit} type="button">Cancel</button>
              <button className="min-h-11 rounded-md bg-sky-500 px-4 font-black hover:bg-sky-400 disabled:cursor-wait disabled:bg-slate-600" disabled={isEditing || !editBody.trim() || editBody.replace(/\s+/g, " ").trim() === editTarget.body} type="submit">{isEditing ? "Saving..." : "Save edit"}</button>
            </div>
          </form>
        </div>
      ) : null}

      {deleteTarget ? (
        <div aria-label="Confirm message deletion" aria-modal="true" className="fixed inset-0 z-[70] grid place-items-center bg-black/60 p-4" role="alertdialog">
          <section className="w-full max-w-sm rounded-lg border border-white/10 bg-[#172331] p-5 text-white shadow-panel">
            <h2 className="text-xl font-black">Delete this message?</h2>
            <p className="mt-2 text-sm leading-6 text-slate-300">Everyone will see &quot;This message was deleted.&quot; Replies will stay connected, and the original is retained only for authorized audit review.</p>
            <div className="mt-6 grid grid-cols-2 gap-2">
              <button className="min-h-11 rounded-md border border-white/10 bg-white/5 px-4 font-black hover:bg-white/10 disabled:opacity-50" disabled={deletingIds.has(deleteTarget.id)} onClick={() => onSetDeleteTarget(null)} type="button">No, keep it</button>
              <button className="min-h-11 rounded-md bg-red-600 px-4 font-black hover:bg-red-500 disabled:cursor-wait disabled:bg-red-900" disabled={deletingIds.has(deleteTarget.id)} onClick={() => void onDeleteMessage(deleteTarget)} type="button">{deletingIds.has(deleteTarget.id) ? "Deleting..." : "Yes, delete"}</button>
            </div>
          </section>
        </div>
      ) : null}

      {forwardTarget ? (
        <div aria-label="Forward message" aria-modal="true" className="fixed inset-0 z-[70] grid place-items-center bg-black/60 p-4" role="dialog">
          <section className="w-full max-w-sm rounded-lg border border-white/10 bg-[#172331] p-5 text-white shadow-panel">
            <h2 className="text-xl font-black">Forward message</h2>
            <p className="mt-2 line-clamp-2 text-sm text-slate-300">{forwardTarget.body || "Photo"}</p>
            <select className="mt-4 min-h-11 w-full rounded-md border border-white/10 bg-[#223447] px-3 text-base" onChange={(event) => onForwardChannelSlugChange(event.target.value)} value={forwardChannelSlug}>
              {channelList.map((channel) => <option key={channel.id} value={channel.slug}>{channelTitle(channel)}</option>)}
            </select>
            <div className="mt-4 grid grid-cols-2 gap-2">
              <button className="min-h-11 rounded-md border border-white/10 bg-white/5 font-black" disabled={isForwarding} onClick={() => onSetForwardTarget(null)} type="button">Cancel</button>
              <button className="min-h-11 rounded-md bg-sky-500 font-black disabled:bg-slate-600" disabled={isForwarding || !forwardChannelSlug} onClick={() => void onForwardMessage()} type="button">{isForwarding ? "Forwarding..." : "Forward"}</button>
            </div>
          </section>
        </div>
      ) : null}

      {showBookmarks ? (
        <div aria-label="Saved messages" aria-modal="true" className="fixed inset-0 z-[70] flex items-end bg-black/60 p-2 pb-[max(env(safe-area-inset-bottom),0.5rem)] sm:items-center sm:justify-center sm:p-4" role="dialog">
          <section className="grid max-h-[90svh] w-full max-w-lg grid-rows-[auto_minmax(0,1fr)] overflow-hidden rounded-lg border border-white/10 bg-[#172331] text-white shadow-panel">
            <header className="flex items-center justify-between border-b border-white/10 px-4 py-3"><h2 className="text-lg font-black">Saved messages</h2><button className="grid h-9 w-9 place-items-center rounded-full text-xl hover:bg-white/10" onClick={onCloseBookmarks} type="button">X</button></header>
            <div className="min-h-0 overflow-y-auto p-3">
              {isLoadingBookmarks ? <p className="p-4 text-center text-sm font-bold text-slate-400">Loading saved messages...</p> : bookmarks.length ? <div className="grid gap-2">{bookmarks.map((bookmark) => <button className="grid gap-1 rounded-md border border-white/10 bg-white/5 p-3 text-left hover:bg-white/10" key={bookmark.message_id} onClick={() => void onJumpToBookmark(bookmark)} type="button"><span className="text-xs font-black text-sky-300">{bookmark.channel_title}</span><span className="line-clamp-2 text-sm leading-6">{bookmark.message.body || "Photo"}</span></button>)}</div> : <p className="rounded-md border border-dashed border-white/10 p-6 text-center text-sm font-bold text-slate-400">Messages you save privately will appear here.</p>}
            </div>
          </section>
        </div>
      ) : null}

      {reactionTarget ? (
        <div aria-label="Reaction details" aria-modal="true" className="fixed inset-0 z-[70] grid place-items-center bg-black/60 p-4" role="dialog">
          <section className="w-full max-w-sm rounded-lg border border-white/10 bg-[#172331] p-5 text-white shadow-panel">
            <div className="flex items-center justify-between"><h2 className="text-xl font-black">Reactions</h2><button className="grid h-9 w-9 place-items-center rounded-full text-xl hover:bg-white/10" onClick={onCloseReactionDetails} type="button">X</button></div>
            <div className="mt-4 grid gap-2">
              {isLoadingReactions ? <p className="text-sm font-bold text-slate-400">Loading...</p> : reactionMembers.length ? reactionMembers.map((member) => <div className="flex items-center justify-between rounded-md bg-white/5 p-3" key={`${member.user_id}-${member.reaction}`}><span className="font-black">{member.label}</span><span>{reactionOptions.find((item) => item.key === member.reaction)?.label ?? member.reaction}</span></div>) : <p className="text-sm font-bold text-slate-400">No reactions yet.</p>}
            </div>
          </section>
        </div>
      ) : null}

      {showPollCreator ? (
        <div aria-label="Create poll" aria-modal="true" className="fixed inset-0 z-[70] flex items-end bg-black/60 p-2 pb-[max(env(safe-area-inset-bottom),0.5rem)] sm:items-center sm:justify-center sm:p-4" role="dialog">
          <form className="w-full max-w-lg rounded-lg border border-white/10 bg-[#172331] p-4 text-white shadow-panel" onSubmit={onCreatePoll}>
            <h2 className="text-lg font-black">Create poll</h2>
            <input className="mt-3 min-h-11 w-full rounded-md border border-white/10 bg-[#223447] px-3 text-base outline-none focus:border-sky-400" maxLength={160} onChange={(event) => onPollQuestionChange(event.target.value)} placeholder="Question" value={pollQuestion} />
            <div className="mt-3 grid gap-2">{pollOptions.map((option, index) => <input className="min-h-10 rounded-md border border-white/10 bg-[#223447] px-3 text-base outline-none focus:border-sky-400" key={index} maxLength={80} onChange={(event) => onPollOptionsChange(pollOptions.map((item, itemIndex) => itemIndex === index ? event.target.value : item))} placeholder={`Option ${index + 1}`} value={option} />)}</div>
            <div className="mt-3 flex flex-wrap gap-2"><button className="rounded-full border border-white/10 px-3 py-2 text-xs font-black" disabled={pollOptions.length >= 10} onClick={() => onPollOptionsChange([...pollOptions, ""])} type="button">Add option</button><label className="inline-flex items-center gap-2 text-sm font-bold"><input checked={pollMultiple} className="h-4 w-4 accent-sky-400" onChange={(event) => onPollMultipleChange(event.target.checked)} type="checkbox" /> Multiple answers</label></div>
            <input className="mt-3 min-h-10 w-full rounded-md border border-white/10 bg-[#223447] px-3 text-base" onChange={(event) => onPollClosesAtChange(event.target.value)} type="datetime-local" value={pollClosesAt} />
            <div className="mt-4 grid grid-cols-2 gap-2"><button className="min-h-11 rounded-md border border-white/10 bg-white/5 font-black" disabled={isCreatingPoll} onClick={onClosePollCreator} type="button">Cancel</button><button className="min-h-11 rounded-md bg-sky-500 font-black disabled:bg-slate-600" disabled={isCreatingPoll || !pollQuestion.trim() || pollOptions.filter((option) => option.trim()).length < 2} type="submit">{isCreatingPoll ? "Creating..." : "Create poll"}</button></div>
          </form>
        </div>
      ) : null}

      {showSchedule ? (
        <div aria-label="Scheduled announcements" aria-modal="true" className="fixed inset-0 z-[70] flex items-end bg-black/60 p-2 pb-[max(env(safe-area-inset-bottom),0.5rem)] sm:items-center sm:justify-center sm:p-4" role="dialog">
          <section className="grid max-h-[92svh] w-full max-w-lg grid-rows-[auto_auto_minmax(0,1fr)] overflow-hidden rounded-lg border border-white/10 bg-[#172331] text-white shadow-panel">
            <header className="flex items-center justify-between border-b border-white/10 px-4 py-3"><h2 className="text-lg font-black">Scheduled announcements</h2><button className="grid h-9 w-9 place-items-center rounded-full text-xl hover:bg-white/10" onClick={onCloseSchedule} type="button">X</button></header>
            <form className="grid gap-2 border-b border-white/10 p-3" onSubmit={onScheduleAnnouncement}><textarea className="min-h-24 rounded-md border border-white/10 bg-[#223447] p-3 text-base" maxLength={1000} onChange={(event) => onScheduledBodyChange(event.target.value)} placeholder="Announcement message" value={scheduledBody} /><input className="min-h-10 rounded-md border border-white/10 bg-[#223447] px-3 text-base" onChange={(event) => onScheduledForChange(event.target.value)} type="datetime-local" value={scheduledFor} /><button className="min-h-10 rounded-md bg-sky-500 font-black disabled:bg-slate-600" disabled={isScheduling || !scheduledBody.trim() || !scheduledFor} type="submit">{isScheduling ? "Scheduling..." : "Schedule"}</button></form>
            <div className="min-h-0 overflow-y-auto p-3">{isLoadingSchedules ? <p className="text-sm font-bold text-slate-400">Loading...</p> : scheduledAnnouncements.length ? <div className="grid gap-2">{scheduledAnnouncements.map((item) => <article className="rounded-md border border-white/10 bg-white/5 p-3" key={item.id}><p className="line-clamp-2 text-sm">{item.body}</p><p className="mt-2 text-xs font-bold text-slate-400">{new Date(item.scheduled_for).toLocaleString("en-NG")} / {item.status}</p></article>)}</div> : <p className="rounded-md border border-dashed border-white/10 p-6 text-center text-sm font-bold text-slate-400">No scheduled announcements.</p>}</div>
          </section>
        </div>
      ) : null}
    </>
  );
}
