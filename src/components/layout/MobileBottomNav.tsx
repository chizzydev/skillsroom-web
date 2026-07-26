import Link from "next/link";

export const mobileNavItems = [
  { key: "home", label: "Home", short: "Home", href: "/" },
  { key: "lobby", label: "Chat", short: "Chat", href: "/chat" },
  { key: "matches", label: "Rooms", short: "Rooms", href: "/matches" },
  { key: "challenges", label: "Challenges", short: "Play", href: "/challenges" },
  { key: "tournaments", label: "Tournaments", short: "Tourney", href: "/tournaments" },
  { key: "wallet", label: "Wallet", short: "Wallet", href: "/wallet" },
  { key: "profile", label: "Profile", short: "Profile", href: "/profile" }
] as const;

export type MobileBottomNavKey = (typeof mobileNavItems)[number]["key"];

type MobileBottomNavProps = {
  active: MobileBottomNavKey;
};

export function MobileBottomNav({ active }: MobileBottomNavProps) {
  return (
    <nav
      className="mobile-bottom-nav fixed inset-x-0 bottom-0 z-40 border-t border-line bg-white/95 px-2 pb-[max(env(safe-area-inset-bottom),0.65rem)] pt-2 shadow-[0_-18px_40px_rgba(15,23,42,0.08)] backdrop-blur md:hidden"
    >
      <div className="mx-auto grid max-w-md grid-cols-7 gap-1">
        {mobileNavItems.map((item) => (
          <Link
            className={[
              "grid min-h-[3.15rem] min-w-0 place-items-center rounded-xl px-1 text-center text-[0.62rem] font-black leading-tight sm:text-[0.68rem]",
              item.key === active ? "bg-cyanSoft text-ink shadow-tight" : "text-muted"
            ].join(" ")}
            href={item.href}
            key={item.key}
          >
            <span className="truncate">{item.short}</span>
          </Link>
        ))}
      </div>
    </nav>
  );
}
