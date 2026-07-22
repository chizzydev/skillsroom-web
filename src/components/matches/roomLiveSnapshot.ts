import type {
  MatchParticipant,
  MatchRoomShell,
  RoomFundingOverview,
  RoomResultOverview,
  MatchStartConfirmation,
  TournamentMatchCheckIn,
  WalletOverview
} from "@/lib/match-room-api";

export type RoomLiveSnapshot = {
  room: MatchRoomShell["room"];
  participants: MatchParticipant[];
  funding: RoomFundingOverview | null;
  results: RoomResultOverview | null;
  wallet: WalletOverview | null;
  tournament_match_check_ins: TournamentMatchCheckIn[];
  start_confirmations: MatchStartConfirmation[];
  current_user_id: string;
  current_user_role: string;
  loaded_at: string;
};
