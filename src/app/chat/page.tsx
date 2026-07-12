import { GlobalLobbyClient } from "@/components/community/GlobalLobbyClient";
import { Panel, PanelHeader } from "@/components/ui/Panel";
import { redirect } from "next/navigation";
import {
  listChatBootstrap,
  type ChatChannel,
  type ChatDmRequest,
  type ChatMessage,
  type ChatMessagePageInfo,
  type ChatPinnedMessage,
  type ChatPresenceSummary
} from "@/lib/match-room-api";

export const dynamic = "force-dynamic";

type ChatPageProps = {
  searchParams: Promise<{ channel?: string; message?: string }>;
};

export default async function ChatPage({ searchParams }: ChatPageProps) {
  const requested = await searchParams;

  let channels: ChatChannel[] = [];
  let activeChannel: ChatChannel | null = null;
  let messages: ChatMessage[] = [];
  let pinnedMessages: ChatPinnedMessage[] = [];
  let pageInfo: ChatMessagePageInfo = { has_older: false, older_cursor: null };
  let readBoundary: string | null = null;
  let presence: ChatPresenceSummary = { online_count: 0, active: [], typing: [] };
  let dmRequests: ChatDmRequest[] = [];
  let user: { id: string; role: string } | null = null;

  try {
    const bootstrap = await listChatBootstrap({ channel: requested.channel, limit: 60, view: "list" });
    user = bootstrap.current_user;
    channels = bootstrap.channels;
    dmRequests = bootstrap.dm_requests;
    activeChannel = bootstrap.active_channel;
    messages = bootstrap.messages;
    pinnedMessages = bootstrap.pinned_messages;
    presence = bootstrap.presence;
    pageInfo = bootstrap.page_info;
    readBoundary = bootstrap.read_boundary;
  } catch {
    redirect("/");
  }

  if (!user) redirect("/");

  return (
    <main className="h-[100dvh] overflow-hidden bg-[#0f1b26]">
      {activeChannel ? (
        <GlobalLobbyClient
          channels={channels}
          currentUserId={user.id}
          currentUserRole={user.role}
          initialChannel={activeChannel}
          initialDmRequests={dmRequests}
          initialMessages={messages}
          initialPageInfo={pageInfo}
          initialPinnedMessages={pinnedMessages}
          initialPresence={presence}
          initialReadBoundary={readBoundary}
          layout="full"
        />
      ) : (
        <div className="p-4">
          <Panel>
            <PanelHeader eyebrow="Community Chat" title="Chat unavailable" description="No chat channels are available yet." />
          </Panel>
        </div>
      )}
    </main>
  );
}
