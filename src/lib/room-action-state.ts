export type RoomActionState = {
  status: "idle" | "success" | "error";
  message?: string;
  refreshToken?: number;
};

export const initialRoomActionState: RoomActionState = {
  status: "idle"
};

export function roomActionSuccess(message: string): RoomActionState {
  return {
    status: "success",
    message,
    refreshToken: Date.now()
  };
}

export function roomActionError(message: string): RoomActionState {
  return {
    status: "error",
    message,
    refreshToken: Date.now()
  };
}
