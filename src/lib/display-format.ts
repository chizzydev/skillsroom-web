import type { MatchRoom, MatchRoomStatus } from "./match-room-api";

export function formatMinorMoney(currency: string, amountMinor: number) {
  const amount = amountMinor / 100;
  return `${currency} ${new Intl.NumberFormat("en-NG", { maximumFractionDigits: 0 }).format(amount)}`;
}

export function formatEntryAmount(room: Pick<MatchRoom, "currency" | "entry_amount_minor">) {
  return formatMinorMoney(room.currency, room.entry_amount_minor);
}

export function matchStatusLabel(status: MatchRoomStatus) {
  return status
    .split("_")
    .map((part) => part[0]?.toUpperCase() + part.slice(1))
    .join(" ");
}

export function displayEnumLabel(value: string) {
  return value
    .split("_")
    .map((part) => part[0]?.toUpperCase() + part.slice(1))
    .join(" ");
}
