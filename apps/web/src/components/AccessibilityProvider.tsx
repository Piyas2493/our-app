"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

type AccessibilityState = {
  highContrast: boolean;
  largeText: boolean;
  audioGuided: boolean;
};

type AccessibilityContextValue = AccessibilityState & {
  toggleHighContrast: () => void;
  toggleLargeText: () => void;
  toggleAudioGuided: () => void;
};

const AccessibilityContext =
  createContext<AccessibilityContextValue | null>(null);

const STORAGE_KEY = "jeevanlink_accessibility";

const defaultState: AccessibilityState = {
  highContrast: false,
  largeText: false,
  audioGuided: false,
};

export default function AccessibilityProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [state, setState] =
    useState<AccessibilityState>(defaultState);

  // The load-from-storage effect below fires setState asynchronously, so
  // the persistence effect's very first run still sees the pre-load
  // default state. Without this guard, that first run would immediately
  // overwrite a real saved value in localStorage with the defaults before
  // the loaded state has even rendered.
  const skipNextPersist = useRef(true);

  useEffect(() => {
    try {
      const saved =
        window.localStorage.getItem(STORAGE_KEY);

      if (saved) {
        const parsed = JSON.parse(saved);

        setState({
          highContrast: Boolean(parsed?.highContrast),
          largeText: Boolean(parsed?.largeText),
          audioGuided: Boolean(parsed?.audioGuided),
        });
      }
    } catch {
      // Keep defaults.
    }
  }, []);

  useEffect(() => {
    document.documentElement.classList.toggle(
      "a11y-high-contrast",
      state.highContrast
    );

    document.documentElement.classList.toggle(
      "a11y-large-text",
      state.largeText
    );

    if (skipNextPersist.current) {
      skipNextPersist.current = false;
      return;
    }

    try {
      window.localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify(state)
      );
    } catch {
      // Ignore storage failures.
    }
  }, [state]);

  function toggle(key: keyof AccessibilityState) {
    // Functional update: two toggles fired back-to-back (e.g. two
    // synchronous clicks in the same batch) must each apply against the
    // latest state, not a shared stale snapshot from render time.
    setState((current) => ({
      ...current,
      [key]: !current[key],
    }));
  }

  const value = useMemo(
    () => ({
      ...state,
      toggleHighContrast: () => toggle("highContrast"),
      toggleLargeText: () => toggle("largeText"),
      toggleAudioGuided: () => toggle("audioGuided"),
    }),
    [state]
  );

  return (
    <AccessibilityContext.Provider value={value}>
      {children}
    </AccessibilityContext.Provider>
  );
}

export function useAccessibility() {
  const context =
    useContext(AccessibilityContext);

  if (!context) {
    throw new Error(
      "useAccessibility must be used inside AccessibilityProvider"
    );
  }

  return context;
}
