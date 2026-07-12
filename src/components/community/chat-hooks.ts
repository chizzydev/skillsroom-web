"use client";

import { useCallback, useEffect, useRef } from "react";

export function useStableCallback<TArgs extends unknown[], TResult>(
  callback: (...args: TArgs) => TResult
) {
  const callbackRef = useRef(callback);

  useEffect(() => {
    callbackRef.current = callback;
  }, [callback]);

  return useCallback((...args: TArgs) => callbackRef.current(...args), []);
}
