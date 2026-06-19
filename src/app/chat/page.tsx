import { GlobalLobbyClient } from "@/components/community/GlobalLobbyClient";
import { Panel, PanelHeader } from "@/components/ui/Panel";
import { getCurrentUser } from "@/lib/auth-bridge";
import { redirect } from "next/navigation";
import {
  listChatChannels,
  listChatMessages,
  listDmRequests,
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
  const user = await getCurrentUser();
  const requested = await searchParams;

  if (!user) {
    redirect("/");
  }

  let channels: ChatChannel[] = [];
  let activeChannel: ChatChannel | null = null;
  let messages: ChatMessage[] = [];
  let pinnedMessages: ChatPinnedMessage[] = [];
  let pageInfo: ChatMessagePageInfo = { has_older: false, older_cursor: null };
  let readBoundary: string | null = null;
  let presence: ChatPresenceSummary = { online_count: 0, active: [], typing: [] };
  let dmRequests: ChatDmRequest[] = [];
  let loadError: string | null = null;

  try {
    const [channelResult, dmRequestResult] = await Promise.all([
      listChatChannels(),
      listDmRequests()
    ]);
    channels = channelResult.channels;
    dmRequests = dmRequestResult.requests;
    activeChannel = channels.find((channel) => channel.slug === requested.channel)
      ?? channels.find((channel) => channel.slug === "global_lobby")
      ?? channels[0]
      ?? null;

    if (activeChannel) {
      const messageResult = await listChatMessages(activeChannel.slug, { limit: 80 });
      activeChannel = messageResult.channel;
      messages = messageResult.messages;
      pinnedMessages = messageResult.pinned_messages;
      presence = messageResult.presence;
      pageInfo = messageResult.page_info;
      readBoundary = messageResult.read_boundary;
      channels = channels.map((channel) => channel.id === messageResult.channel.id ? { ...messageResult.channel, unread_count: 0 } : channel);
    }
  } catch {
    loadError = "Community chat could not load right now.";
  }

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
            <PanelHeader eyebrow="Community Chat" title="Chat unavailable" description={loadError ?? "No chat channels are available yet."} />
          </Panel>
        </div>
      )}
    </main>
  );
}
