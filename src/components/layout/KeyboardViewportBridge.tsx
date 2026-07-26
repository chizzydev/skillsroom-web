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
    let visibilityTimer: number | null = null;

    const clearVisibilityTimer = () => {
      if (!visibilityTimer) return;
      window.clearTimeout(visibilityTimer);
      visibilityTimer = null;
    };

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

    const keepFocusedEditableVisible = () => {
      const activeElement = document.activeElement;
      if (!editableElement(activeElement) || !smallTouchViewport()) return;

      const viewport = window.visualViewport;
      const viewportTop = viewport?.offsetTop ?? 0;
      const viewportBottom = (viewport?.offsetTop ?? 0) + (viewport?.height ?? window.innerHeight);
      const topComfort = Math.min(108, Math.max(72, Math.round(window.innerHeight * 0.12)));
      const bottomComfort = 24;
      const rect = activeElement.getBoundingClientRect();

      if (rect.top < viewportTop + topComfort) {
        window.scrollBy({ top: rect.top - viewportTop - topComfort, left: 0, behavior: "smooth" });
        return;
      }

      if (rect.bottom > viewportBottom - bottomComfort) {
        window.scrollBy({ top: rect.bottom - viewportBottom + bottomComfort, left: 0, behavior: "smooth" });
      }
    };

    const scheduleVisibilityCheck = () => {
      clearVisibilityTimer();
      visibilityTimer = window.setTimeout(keepFocusedEditableVisible, 140);
    };

    const updateFromActiveElement = () => {
      const activeElement = document.activeElement;
      const focusedEditable = editableElement(activeElement);
      const open = Boolean(focusedEditable && smallTouchViewport());
      setKeyboardOpen(open);
      if (open) {
        updateKeyboardSafeArea();
        scheduleVisibilityCheck();
      }
    };

    const handleFocusIn = (event: FocusEvent) => {
      if (!editableElement(event.target) || !smallTouchViewport()) return;
      if (blurTimer) window.clearTimeout(blurTimer);
      setKeyboardOpen(true);
      updateKeyboardSafeArea();
      scheduleVisibilityCheck();
    };

    const handleFocusOut = () => {
      if (blurTimer) window.clearTimeout(blurTimer);
      clearVisibilityTimer();
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
      clearVisibilityTimer();
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
