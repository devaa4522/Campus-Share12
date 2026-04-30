"use client";

import { useDeferredValue, useEffect, useState } from "react";

export function useDelayedLoading(isLoading: boolean, delay = 180) {
  const deferredLoading = useDeferredValue(isLoading);
  const [show, setShow] = useState(false);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;

    if (deferredLoading) {
      timer = setTimeout(() => {
        setShow(true);
      }, delay);
    } else {
      timer = setTimeout(() => {
        setShow(false);
      }, 0);
    }

    return () => {
      if (timer) clearTimeout(timer);
    };
  }, [deferredLoading, delay]);

  return show;
}