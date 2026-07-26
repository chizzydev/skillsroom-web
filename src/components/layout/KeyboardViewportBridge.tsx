"use client";

import { useEffect } from "react";

function editableElement(element: EventTarget | null): element is HTMLElement {
  if (!(element instanceof HTMLElement)) return false;
  const tagName = element.tagName.toLowerCase();
  return tagName === "input" || tagName === "textarea" || tagName === "select" || element.isContentEditable;
}

function smallTouchViewport() {
  return window.matchMedia("(max-width: 767px), (pointer: coarse)").matches;
}

export function KeyboardViewportBridge() {
  useEffect(() => {
    const root = document.documentElement;
    let blurTimer: number | null = null;

    const setKeyboardOpen = (open: boolean) => {
      if (open) root.dataset.keyboardOpen = "true";
      else {
        delete root.dataset.keyboardOpen;
        root.style.removeProperty("--keyboard-safe-area");
      }
    };

    const updateKeyboardSafeArea = () => {
      const viewport = window.visualViewport;
      if (!viewport) {
        root.style.setProperty("--keyboard-safe-area", "9rem");
        return;
      }

      const keyboardInset = Math.max(0, window.innerHeight - viewport.height - viewport.offsetTop);
      const safeArea = Math.min(Math.max(keyboardInset + 16, 96), Math.round(window.innerHeight * 0.42));
      root.style.setProperty("--keyboard-safe-area", `${safeArea}px`);
    };

    const updateFromActiveElement = () => {
      const activeElement = document.activeElement;
      const focusedEditable = editableElement(activeElement);
      const open = Boolean(focusedEditable && smallTouchViewport());
      setKeyboardOpen(open);
      if (open) {
        updateKeyboardSafeArea();
      }
    };

    const handleFocusIn = (event: FocusEvent) => {
      if (!editableElement(event.target) || !smallTouchViewport()) return;
      if (blurTimer) window.clearTimeout(blurTimer);
      setKeyboardOpen(true);
      updateKeyboardSafeArea();
    };

    const handleFocusOut = () => {
      if (blurTimer) window.clearTimeout(blurTimer);
      blurTimer = window.setTimeout(updateFromActiveElement, 120);
    };

    const handleViewportChange = () => {
      updateFromActiveElement();
    };

    document.addEventListener("focusin", handleFocusIn);
    document.addEventListener("focusout", handleFocusOut);
    window.visualViewport?.addEventListener("resize", handleViewportChange);
    window.visualViewport?.addEventListener("scroll", handleViewportChange);
    window.addEventListener("orientationchange", handleViewportChange);
    updateFromActiveElement();

    return () => {
      if (blurTimer) window.clearTimeout(blurTimer);
      document.removeEventListener("focusin", handleFocusIn);
      document.removeEventListener("focusout", handleFocusOut);
      window.visualViewport?.removeEventListener("resize", handleViewportChange);
      window.visualViewport?.removeEventListener("scroll", handleViewportChange);
      window.removeEventListener("orientationchange", handleViewportChange);
      setKeyboardOpen(false);
    };
  }, []);

  return null;
}
