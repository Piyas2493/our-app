"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  DEFAULT_LANGUAGE,
  getLanguage,
  translate,
  type LanguageCode,
  type TranslationKey,
} from "@/app/lib/i18n";

type LanguageContextValue = {
  language: LanguageCode;
  setLanguage: (language: LanguageCode) => void;
  t: (key: TranslationKey | string) => string;
};

const LanguageContext =
  createContext<LanguageContextValue | null>(null);

const STORAGE_KEY = "jeevanlink_language";

export default function LanguageProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [language, setLanguageState] =
    useState<LanguageCode>(DEFAULT_LANGUAGE);

  useEffect(() => {
    try {
      const saved =
        window.localStorage.getItem(STORAGE_KEY);

      if (saved) {
        setLanguageState(
          getLanguage(saved)
        );
      }
    } catch {
      // Keep the default language.
    }
  }, []);

  useEffect(() => {
    document.documentElement.lang =
      language;
  }, [language]);

  function setLanguage(
    nextLanguage: LanguageCode
  ) {
    setLanguageState(nextLanguage);

    try {
      window.localStorage.setItem(
        STORAGE_KEY,
        nextLanguage
      );
    } catch {
      // Ignore storage failures.
    }
  }

  const value = useMemo(
    () => ({
      language,
      setLanguage,
      t: (key: TranslationKey | string) =>
        translate(
          language,
          key as TranslationKey
        ),
    }),
    [language]
  );

  return (
    <LanguageContext.Provider value={value}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const context =
    useContext(LanguageContext);

  if (!context) {
    throw new Error(
      "useLanguage must be used inside LanguageProvider"
    );
  }

  return context;
}
