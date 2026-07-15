"use client";

import { type MouseEvent, type ReactNode, useEffect, useState } from "react";

const storageKey = "skillsroom.profile.fullSectionsOpen";

type ProfileSectionsDisclosureProps = {
  defaultOpen?: boolean;
  summary: ReactNode;
  children: ReactNode;
};

export function ProfileSectionsDisclosure({ defaultOpen = false, summary, children }: ProfileSectionsDisclosureProps) {
  const [open, setOpen] = useState(defaultOpen);

  useEffect(() => {
    if (defaultOpen) {
      setOpen(true);
      window.localStorage.setItem(storageKey, "1");
      return;
    }

    setOpen(window.localStorage.getItem(storageKey) === "1");
  }, [defaultOpen]);

  function setExpanded(nextOpen: boolean) {
    setOpen(nextOpen);
    window.localStorage.setItem(storageKey, nextOpen ? "1" : "0");
  }

  function handleSummaryClick(event: MouseEvent<HTMLDivElement>) {
    const target = event.target;
    if (!(target instanceof Element)) return;
    if (target.closest("[data-profile-sections-toggle]")) setExpanded(true);
  }

  return (
    <>
      <div hidden={open} onClick={handleSummaryClick}>{summary}</div>
      {open ? (
        <div className="grid min-w-0 gap-6" id="full-profile-sections">
          <div className="flex justify-end">
            <button
              className="inline-flex min-h-10 items-center justify-center rounded-md border border-line bg-white px-4 text-sm font-black text-ink hover:bg-surfaceHigh"
              onClick={() => setExpanded(false)}
              type="button"
            >
              Hide full profile sections
            </button>
          </div>
          {children}
        </div>
      ) : null}
    </>
  );
}
