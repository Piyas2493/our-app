"use client";

import {
  Globe2,
  Languages,
} from "lucide-react";

import {
  SUPPORTED_LANGUAGES,
} from "@/app/lib/i18n";

import {
  useLanguage,
} from "@/components/LanguageProvider";

export default function LanguageSwitcher() {
  const {
    language,
    setLanguage,
  } = useLanguage();

  return (
    <label className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-2 py-2 sm:px-3">
      <Globe2
        size={18}
        className="text-slate-500"
      />

      <Languages
        size={16}
        className="hidden text-slate-400 sm:block"
      />

      <select
        id="jeevanlink-language"
        aria-label="Language"
        value={language}
        onChange={(event) =>
          setLanguage(
            event.target.value as typeof language
          )
        }
        className="w-16 bg-transparent text-sm font-medium text-slate-700 outline-none sm:w-auto"
      >
        {SUPPORTED_LANGUAGES.map(
          (item) => (
            <option
              key={item.code}
              value={item.code}
            >
              {item.nativeName}
            </option>
          )
        )}
      </select>
    </label>
  );
}
