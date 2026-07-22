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
      else delete root.dataset.keyboardOpen;
    };

    const updateFromActiveElement = () => {
      const activeElement = document.activeElement;
      const focusedEditable = editableElement(activeElement);
      setKeyboardOpen(Boolean(focusedEditable && smallTouchViewport()));
    };

    const handleFocusIn = (event: FocusEvent) => {
      if (!editableElement(event.target) || !smallTouchViewport()) return;
      if (blurTimer) window.clearTimeout(blurTimer);
      setKeyboardOpen(true);
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
