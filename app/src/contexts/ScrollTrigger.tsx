import React, { createContext, useCallback, useContext, useRef } from 'react';

type Listener = () => void;

interface ScrollTriggerCtx {
  subscribe: (fn: Listener) => () => void;
}

export const ScrollTriggerContext = createContext<ScrollTriggerCtx | null>(null);

export function ScrollTriggerProvider({
  children,
  triggerRef,
}: {
  children: React.ReactNode;
  triggerRef: React.MutableRefObject<() => void>;
}) {
  const listeners = useRef(new Set<Listener>());

  const subscribe = useCallback((fn: Listener) => {
    listeners.current.add(fn);
    fn(); // immediate check on subscribe
    return () => {
      listeners.current.delete(fn);
    };
  }, []);

  // Expose trigger to the parent via ref (safe: just a ref mutation, not a side effect)
  triggerRef.current = useCallback(() => {
    listeners.current.forEach((fn) => fn());
  }, []);

  return (
    <ScrollTriggerContext.Provider value={{ subscribe }}>
      {children}
    </ScrollTriggerContext.Provider>
  );
}

export function useScrollTriggerContext() {
  return useContext(ScrollTriggerContext);
}
