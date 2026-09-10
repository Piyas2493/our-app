"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  AudioLines,
  Check,
  ChevronLeft,
  ChevronRight,
  CircleAlert,
  ClipboardList,
  FileText,
  Globe2,
  HeartPulse,
  Loader2,
  Mic,
  MicOff,
  ShieldCheck,
  Sparkles,
  Stethoscope,
  Volume2,
} from "lucide-react";
import { useLanguage } from "../../components/LanguageProvider";
import LanguageSwitcher from "../../components/LanguageSwitcher";
import { useAccessibility } from "../../components/AccessibilityProvider";
import { CLINICAL_INTAKE_COPY as copy } from "../clinical-intake-copy";

type IntakeMode = "GENERAL" | "AYUSH";
type ComplaintCategory = "chestPain" | "fever" | "cough" | "abdominalPain" | "headache" | "general";
type HistoryState = {
  chiefComplaint: string;
  onset: string;
  duration: string;
  character: string;
  location: string;
  radiation: string;
  severity: string;
  aggravating: string;
  relieving: string;
  associatedSymptoms: string;
  pastMedical: string;
  pastSurgical: string;
  medications: string;
  allergies: string;
  family: string;
  diet: string;
  sleep: string;
  smoking: string;
  alcohol: string;
  occupation: string;
  ros: string;
  investigations: string;
  ayush: Record<string, string>;
};

const languageLocales: Record<string, string> = {
  en: "en-IN",
  hi: "hi-IN",
  bn: "bn-IN",
  ta: "ta-IN",
  te: "te-IN",
  mr: "mr-IN",
  gu: "gu-IN",
  kn: "kn-IN",
  ml: "ml-IN",
  pa: "pa-IN",
  or: "or-IN",
  as: "as-IN",
};

const ayushFields = [
  ["prakriti", "Prakriti"],
  ["prakritiNotes", "Prakriti notes"],
  ["vikriti", "Vikriti"],
  ["vikritiNotes", "Vikriti notes"],
  ["sara", "Sara"],
  ["saraNotes", "Sara notes"],
  ["samhanana", "Samhanana"],
  ["samhananaNotes", "Samhanana notes"],
  ["pramana", "Pramana"],
  ["pramanaNotes", "Pramana notes"],
  ["satmya", "Satmya"],
  ["satmyaNotes", "Satmya notes"],
  ["sattva", "Sattva"],
  ["sattvaNotes", "Sattva notes"],
  ["abhyavaharanaShakti", "Abhyavaharana Shakti"],
  ["jaranaShakti", "Jarana Shakti"],
  ["aharaShaktiNotes", "Ahara Shakti notes"],
  ["vyayamaShakti", "Vyayama Shakti"],
  ["vyayamaShaktiNotes", "Vyayama Shakti notes"],
  ["vaya", "Vaya"],
  ["vayaYears", "Exact age (years)"],
  ["aharaVihara", "Ahara-Vihara"],
  ["nidana", "Nidana"],
  ["samprapti", "Samprapti"],
] as const;

// Dashavidha Pariksha (ten-fold examination) selectable option sets.
// Values are stable identifiers persisted in history.ayush; labels are
// resolved from the localized copy object at render/summary time.
const doshaOptionValues = [
  "vata",
  "pitta",
  "kapha",
  "vata-pitta",
  "pitta-kapha",
  "vata-kapha",
  "sama",
] as const;

const gradeOptionValues = ["pravara", "madhyama", "avara"] as const;
const satmyaOptionValues = ["sama", "vishama", "ekarasa"] as const;
const vayaOptionValues = ["bala", "madhyama", "vriddha"] as const;

const defaultState: HistoryState = {
  chiefComplaint: "",
  onset: "",
  duration: "",
  character: "",
  location: "",
  radiation: "",
  severity: "",
  aggravating: "",
  relieving: "",
  associatedSymptoms: "",
  pastMedical: "",
  pastSurgical: "",
  medications: "",
  allergies: "",
  family: "",
  diet: "",
  sleep: "",
  smoking: "",
  alcohol: "",
  occupation: "",
  ros: "",
  investigations: "",
  ayush: Object.fromEntries(ayushFields.map(([key]) => [key, ""])),
};

const steps = ["consent", "complaint", "hpi", "history", "review", "reviewSubmit"] as const;

type HpiFieldKey =
  | "onset"
  | "duration"
  | "character"
  | "location"
  | "radiation"
  | "severity"
  | "aggravating"
  | "relieving"
  | "associatedSymptoms";

// The full SOCRATES-style field set, in teaching order. Which of these are
// actually asked is adaptive: it narrows based on the chief-complaint
// category the patient picked (see hpiFieldsByCategory below), rather than
// always showing all nine fields to every patient regardless of complaint.
const ALL_HPI_FIELDS: HpiFieldKey[] = [
  "onset",
  "duration",
  "character",
  "location",
  "radiation",
  "severity",
  "aggravating",
  "relieving",
  "associatedSymptoms",
];

const hpiFieldsByCategory: Record<ComplaintCategory, ReadonlySet<HpiFieldKey>> = {
  // Chest pain and abdominal pain are classic full-SOCRATES presentations
  // (location + radiation both carry real clinical signal) — ask everything.
  chestPain: new Set(ALL_HPI_FIELDS),
  abdominalPain: new Set(ALL_HPI_FIELDS),
  general: new Set(ALL_HPI_FIELDS),
  // Headache rarely "radiates" in the SOCRATES sense.
  headache: new Set(ALL_HPI_FIELDS.filter((field) => field !== "radiation")),
  // Fever and cough don't have a body "location" or "radiation" pattern.
  fever: new Set(ALL_HPI_FIELDS.filter((field) => field !== "location" && field !== "radiation")),
  cough: new Set(ALL_HPI_FIELDS.filter((field) => field !== "location" && field !== "radiation")),
};

export default function ClinicalIntakePage() {
  const router = useRouter();
  const { language } = useLanguage() as { language?: string };
  const {
    highContrast,
    largeText,
    audioGuided,
    toggleHighContrast,
    toggleLargeText,
    toggleAudioGuided,
  } = useAccessibility();

  // LanguageProvider uses locale-style codes such as bn-IN, while the
  // clinical-intake translation dictionary uses base language codes such as bn.
  // Normalize both forms so the UI always selects the correct translation.
  const rawLanguage = typeof language === "string" ? language.trim().toLowerCase() : "en";
  const lang = (() => {
    if (copy[rawLanguage]) return rawLanguage;
    const baseLanguage = rawLanguage.split("-")[0];
    return copy[baseLanguage] ? baseLanguage : "en";
  })();
  const text = { ...copy.en, ...(copy[lang] ?? {}) };

  const [userName, setUserName] = useState("Patient");
  const [correctionRecordId, setCorrectionRecordId] = useState<string | null>(null);
  const [loadingCorrection, setLoadingCorrection] = useState(false);
  const [mode, setMode] = useState<IntakeMode>("GENERAL");
  const [step, setStep] = useState(0);
  const [history, setHistory] = useState<HistoryState>(defaultState);
  const [complaintCategory, setComplaintCategory] = useState<ComplaintCategory>("general");
  const [consent, setConsent] = useState({
    clinicalHistory: false,
    documentProcessing: false,
    clinicianSharing: false,
  });
  const [listening, setListening] = useState(false);
  const [voiceSupported, setVoiceSupported] = useState(true);
  const [voiceError, setVoiceError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [redFlags, setRedFlags] = useState<string[]>([]);
  const [submitError, setSubmitError] = useState("");
  const [selectedDocuments, setSelectedDocuments] = useState<File[]>([]);
  const [analyzingDocument, setAnalyzingDocument] = useState(false);
  const [documentInsights, setDocumentInsights] = useState<string[]>([]);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const audioPlaybackRef = useRef<HTMLAudioElement | null>(null);
  const ttsAbortRef = useRef<AbortController | null>(null);
  const ttsCacheRef = useRef<Map<string, Blob>>(new Map());
  const ttsRequestIdRef = useRef(0);
  const activeFieldRef = useRef<keyof HistoryState | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadCorrectionRecord() {
      if (typeof window === "undefined") return;

      const requestedId = new URLSearchParams(window.location.search).get(
        "correctionRecordId",
      );

      if (!requestedId) return;

      setCorrectionRecordId(requestedId);
      setLoadingCorrection(true);
      setSubmitError("");

      try {
        const response = await fetch("/api/medical-records", {
          method: "GET",
          credentials: "include",
          cache: "no-store",
        });
        const result = await response.json().catch(() => null);

        if (!response.ok || !result?.success) {
          throw new Error(result?.error || "Unable to load the record for correction.");
        }

        const records = Array.isArray(result.records) ? result.records : [];
        const record = records.find((item: any) => String(item?.id) === requestedId);

        if (!record) {
          throw new Error("The clinical intake record could not be found.");
        }

        const status = String(record.status || "").trim().toUpperCase();
        const documentType = String(record.documentType || "").trim().toUpperCase();
        const documentName = String(record.documentName || "").trim().toLowerCase();
        const isClinicalIntake =
          documentType === "CLINICAL_INTAKE" ||
          documentName === "pre-consultation clinical intake";

        if (status !== "REJECTED") {
          throw new Error("This record is not currently awaiting correction.");
        }

        if (!isClinicalIntake) {
          throw new Error("The selected record is not a clinical intake record.");
        }

        let intake: any = record.interpretation;

        if (typeof intake === "string") {
          try {
            intake = JSON.parse(intake);
          } catch {
            throw new Error("The saved clinical intake could not be read for correction.");
          }
        }

        if (!intake || typeof intake !== "object") {
          throw new Error("The saved clinical intake does not contain editable answers.");
        }

        const hpi = intake.hpi && typeof intake.hpi === "object" ? intake.hpi : {};
        const personal =
          intake.personalHistory && typeof intake.personalHistory === "object"
            ? intake.personalHistory
            : {};
        const reviewOfSystems =
          intake.reviewOfSystems && typeof intake.reviewOfSystems === "object"
            ? intake.reviewOfSystems
            : {};
        const ayush = intake.ayush && typeof intake.ayush === "object" ? intake.ayush : {};

        const toText = (value: unknown) =>
          Array.isArray(value)
            ? value.filter((item) => item != null && String(item).trim()).map(String).join("\n")
            : value == null
              ? ""
              : String(value);

        const nextHistory: HistoryState = {
          ...defaultState,
          ayush: Object.fromEntries(
            ayushFields.map(([key]) => [key, toText(ayush[key])]),
          ),
          chiefComplaint: toText(intake.chiefComplaint),
          onset: toText(hpi.onset),
          duration: toText(hpi.duration),
          character: toText(hpi.character),
          location: toText(hpi.location),
          radiation: toText(hpi.radiation),
          severity: toText(hpi.severity),
          aggravating: toText(hpi.aggravating),
          relieving: toText(hpi.relieving),
          associatedSymptoms: toText(hpi.associatedSymptoms),
          pastMedical: toText(intake.pastMedicalHistory),
          pastSurgical: toText(intake.pastSurgicalHistory),
          medications: toText(intake.medications),
          allergies: toText(intake.allergies),
          family: toText(intake.familyHistory),
          diet: toText(personal.diet),
          sleep: toText(personal.sleep),
          smoking: toText(personal.smoking),
          alcohol: toText(personal.alcohol),
          occupation: toText(personal.occupation),
          ros: toText(reviewOfSystems.general ?? reviewOfSystems),
          investigations: toText(intake.priorInvestigations),
        };

        if (cancelled) return;

        setMode(intake.mode === "AYUSH" ? "AYUSH" : "GENERAL");
        setConsent({
          clinicalHistory: Boolean(intake.consent?.clinicalHistory),
          documentProcessing: Boolean(intake.consent?.documentProcessing),
          clinicianSharing: Boolean(intake.consent?.clinicianSharing),
        });
        setHistory(nextHistory);
        setStep(1);
      } catch (error) {
        if (!cancelled) {
          setSubmitError(
            error instanceof Error
              ? error.message
              : "Unable to load the record for correction.",
          );
        }
      } finally {
        if (!cancelled) setLoadingCorrection(false);
      }
    }

    void loadCorrectionRecord();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function loadSession() {
      try {
        const response = await fetch("/api/auth/session", { credentials: "include", cache: "no-store" });
        const result = await response.json().catch(() => null);
        if (cancelled) return;
        if (!response.ok || !result?.authenticated || !result?.user) {
          router.replace("/login");
          return;
        }
        if (result.user.role !== "PATIENT") {
          router.replace("/clinician");
          return;
        }
        setUserName(result.user.name || "Patient");
      } catch {
        if (!cancelled) router.replace("/login");
      }
    }
    loadSession();
    return () => {
      cancelled = true;
      mediaRecorderRef.current?.stop();
      audioPlaybackRef.current?.pause();
      audioPlaybackRef.current = null;
      ttsAbortRef.current?.abort();
      ttsAbortRef.current = null;
      ttsRequestIdRef.current += 1;
    };
  }, [router]);

  useEffect(() => {
    setVoiceSupported(
      typeof window !== "undefined" &&
      typeof MediaRecorder !== "undefined" &&
      typeof navigator !== "undefined" &&
      Boolean(navigator.mediaDevices?.getUserMedia),
    );
  }, []);

  const progress = ((step + 1) / steps.length) * 100;
  const ayushMode = mode === "AYUSH";

  function updateField(field: keyof HistoryState, value: string) {
    setHistory((current) => ({ ...current, [field]: value }));

    // Free-typed or dictated chief-complaint text doesn't carry a known
    // category the way a quick-choice tap does, so fall back to asking
    // the full HPI field set rather than guessing from the text.
    if (field === "chiefComplaint") {
      setComplaintCategory("general");
    }
  }

  function selectQuickComplaint(category: ComplaintCategory, label: string) {
    setHistory((current) => ({ ...current, chiefComplaint: label }));
    setComplaintCategory(category);
  }

  function updateAyushField(field: string, value: string) {
    setHistory((current) => ({
      ...current,
      ayush: { ...current.ayush, [field]: value },
    }));
  }

  // Dashavidha Pariksha option sets, localized. Built from the same
  // stable identifiers stored in history.ayush so the selected pill
  // stays correctly highlighted when the language is switched mid-form.
  const doshaLabels: Record<string, string> = {
    vata: text.doshaVata,
    pitta: text.doshaPitta,
    kapha: text.doshaKapha,
    "vata-pitta": text.doshaVataPitta,
    "pitta-kapha": text.doshaPittaKapha,
    "vata-kapha": text.doshaVataKapha,
    sama: text.doshaSama,
  };
  const gradeLabels: Record<string, string> = {
    pravara: text.gradePravara,
    madhyama: text.gradeMadhyama,
    avara: text.gradeAvara,
  };
  const satmyaLabels: Record<string, string> = {
    sama: text.satmyaSama,
    vishama: text.satmyaVishama,
    ekarasa: text.satmyaEkaRasa,
  };
  const vayaLabels: Record<string, string> = {
    bala: text.vayaBala,
    madhyama: text.vayaMadhyama,
    vriddha: text.vayaVriddha,
  };

  const doshaOptions: PillOption[] = doshaOptionValues.map((value) => ({ value, label: doshaLabels[value] }));
  const vikritiOptions: PillOption[] = [...doshaOptions, { value: "none", label: text.vikritiNoImbalance }];
  const gradeOptions: PillOption[] = gradeOptionValues.map((value) => ({ value, label: gradeLabels[value] }));
  const satmyaOptions: PillOption[] = satmyaOptionValues.map((value) => ({ value, label: satmyaLabels[value] }));
  const vayaOptions: PillOption[] = vayaOptionValues.map((value) => ({ value, label: vayaLabels[value] }));

  // Renders the captured Dashavidha Pariksha as readable review lines,
  // resolving stored identifiers back to their localized labels.
  function formatDashavidhaSummary(ayush: Record<string, string>): string {
    const lines: string[] = [];

    function pushLine(title: string, valueLabel: string | undefined, notes?: string) {
      const parts = [valueLabel, notes].filter((part): part is string => Boolean(part));
      if (parts.length) lines.push(`${title}: ${parts.join(" — ")}`);
    }

    pushLine(text.prakritiTitle, doshaLabels[ayush.prakriti], ayush.prakritiNotes);
    pushLine(text.vikritiTitle, ayush.vikriti === "none" ? text.vikritiNoImbalance : doshaLabels[ayush.vikriti], ayush.vikritiNotes);
    pushLine(text.saraTitle, gradeLabels[ayush.sara], ayush.saraNotes);
    pushLine(text.samhananaTitle, gradeLabels[ayush.samhanana], ayush.samhananaNotes);
    pushLine(text.pramanaTitle, gradeLabels[ayush.pramana], ayush.pramanaNotes);
    pushLine(text.satmyaTitle, satmyaLabels[ayush.satmya], ayush.satmyaNotes);
    pushLine(text.sattvaTitle, gradeLabels[ayush.sattva], ayush.sattvaNotes);

    const aharaShaktiParts = [
      gradeLabels[ayush.abhyavaharanaShakti] && `${text.abhyavaharanaShaktiLabel}: ${gradeLabels[ayush.abhyavaharanaShakti]}`,
      gradeLabels[ayush.jaranaShakti] && `${text.jaranaShaktiLabel}: ${gradeLabels[ayush.jaranaShakti]}`,
    ].filter(Boolean).join("; ");
    pushLine(text.aharaShaktiTitle, aharaShaktiParts || undefined, ayush.aharaShaktiNotes);

    pushLine(text.vyayamaShaktiTitle, gradeLabels[ayush.vyayamaShakti], ayush.vyayamaShaktiNotes);
    pushLine(text.vayaTitle, vayaLabels[ayush.vaya], ayush.vayaYears ? `${ayush.vayaYears}` : undefined);

    if (ayush.aharaVihara) lines.push(`${text.aharaVihara}: ${ayush.aharaVihara}`);
    if (ayush.nidana) lines.push(`${text.nidana}: ${ayush.nidana}`);
    if (ayush.samprapti) lines.push(`${text.samprapti}: ${ayush.samprapti}`);

    return lines.join("\n");
  }

  async function say(textToSpeak: string) {
    const cleanText = textToSpeak.trim();
    if (!cleanText) return;

    // Stop any microphone recording before playing audio.
    // This prevents the microphone from picking up the speaker output.
    if (mediaRecorderRef.current?.state === "recording") {
      mediaRecorderRef.current.stop();
    }

    const requestId = ++ttsRequestIdRef.current;

    // Cancel any previous TTS request.
    ttsAbortRef.current?.abort();
    ttsAbortRef.current = null;

    // Stop any previous playback immediately.
    audioPlaybackRef.current?.pause();
    audioPlaybackRef.current = null;

    try {
      setVoiceError("");

      const cacheKey = `${lang}:${cleanText}`;
      let audioBlob = ttsCacheRef.current.get(cacheKey);

      if (!audioBlob) {
        const controller = new AbortController();
        ttsAbortRef.current = controller;

        const response = await fetch("/api/clinical-intake/speak", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          signal: controller.signal,
          body: JSON.stringify({
            text: cleanText,
            language: lang,
            languageCode: languageLocales[lang] || "en-IN",
          }),
        });

        if (requestId !== ttsRequestIdRef.current) return;

        if (!response.ok) {
          const result = await response.json().catch(() => null);
          throw new Error(
            result?.error ||
              "Unable to generate the spoken explanation.",
          );
        }

        audioBlob = await response.blob();

        if (requestId !== ttsRequestIdRef.current) return;

        if (!audioBlob.size) {
          throw new Error("The speech service returned empty audio.");
        }

        // Cache the generated audio so repeated explanations are instant.
        ttsCacheRef.current.set(cacheKey, audioBlob);

        // Keep the cache small.
        if (ttsCacheRef.current.size > 30) {
          const firstKey = ttsCacheRef.current.keys().next().value;
          if (firstKey) {
            ttsCacheRef.current.delete(firstKey);
          }
        }
      }

      if (requestId !== ttsRequestIdRef.current) return;

      const url = URL.createObjectURL(audioBlob);
      const audio = new Audio(url);

      audio.preload = "auto";
      audio.volume = 1;
      audioPlaybackRef.current = audio;

      audio.onended = () => {
        URL.revokeObjectURL(url);
        if (audioPlaybackRef.current === audio) {
          audioPlaybackRef.current = null;
        }
      };

      audio.onerror = () => {
        URL.revokeObjectURL(url);
        if (audioPlaybackRef.current === audio) {
          audioPlaybackRef.current = null;
        }
        setVoiceError("Unable to play the generated speech.");
      };

      await audio.play();
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        return;
      }

      if (requestId !== ttsRequestIdRef.current) return;

      setVoiceError(
        error instanceof Error
          ? error.message
          : "Unable to generate the spoken explanation.",
      );
    } finally {
      if (ttsAbortRef.current && requestId === ttsRequestIdRef.current) {
        ttsAbortRef.current = null;
      }
    }
  }

  async function startVoice(field: keyof HistoryState) {
    setVoiceError("");

    if (
      typeof MediaRecorder === "undefined" ||
      !navigator.mediaDevices?.getUserMedia
    ) {
      setVoiceError(
        "Voice input is not available in this browser. Please type the answer instead.",
      );
      return;
    }

    if (listening) return;

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          channelCount: 1,
        },
      });

      let mimeType = "";

      if (MediaRecorder.isTypeSupported("audio/webm;codecs=opus")) {
        mimeType = "audio/webm;codecs=opus";
      } else if (MediaRecorder.isTypeSupported("audio/webm")) {
        mimeType = "audio/webm";
      } else if (MediaRecorder.isTypeSupported("audio/ogg;codecs=opus")) {
        mimeType = "audio/ogg;codecs=opus";
      } else if (MediaRecorder.isTypeSupported("audio/mp4")) {
        mimeType = "audio/mp4";
      }

      const recorder = mimeType
        ? new MediaRecorder(stream, { mimeType })
        : new MediaRecorder(stream);

      audioChunksRef.current = [];
      activeFieldRef.current = field;

      recorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      recorder.onerror = () => {
        stream.getTracks().forEach((track) => track.stop());
        setListening(false);
        setVoiceError(
          "Voice capture could not be completed. Please try again or type your answer.",
        );
      };

      recorder.onstop = async () => {
        stream.getTracks().forEach((track) => track.stop());
        mediaRecorderRef.current = null;
        setListening(false);

        const activeField = activeFieldRef.current;
        const chunks = audioChunksRef.current;
        audioChunksRef.current = [];

        if (!activeField || !chunks.length) {
          setVoiceError("No speech was captured. Please try again.");
          return;
        }

        const blobType = recorder.mimeType || mimeType || "audio/webm";
        const blob = new Blob(chunks, { type: blobType });

        if (blob.size === 0) {
          setVoiceError("No speech was captured. Please try again.");
          return;
        }

        setVoiceError("");

        try {
          const formData = new FormData();
          const extension = blobType.includes("ogg")
            ? "ogg"
            : blobType.includes("mp4")
              ? "mp4"
              : "webm";

          formData.append(
            "audio",
            new File(
              [blob],
              `clinical-intake-${Date.now()}.${extension}`,
              { type: blobType },
            ),
          );
          formData.append("language", lang);

          const response = await fetch(
            "/api/clinical-intake/transcribe",
            {
              method: "POST",
              body: formData,
              credentials: "include",
            },
          );

          const result = await response.json().catch(() => null);

          if (!response.ok || !result?.success || !result?.transcript) {
            throw new Error(
              result?.error ||
                "Unable to transcribe the recording.",
            );
          }

          updateField(activeField, result.transcript.trim());
        } catch (error) {
          setVoiceError(
            error instanceof Error
              ? error.message
              : "Unable to transcribe the recording. Please try again or type your answer.",
          );
        }
      };

      mediaRecorderRef.current = recorder;
      recorder.start();
      setListening(true);
    } catch (error) {
      setListening(false);
      setVoiceError(
        error instanceof DOMException && error.name === "NotAllowedError"
          ? "Microphone permission was denied. Please allow microphone access and try again."
          : "Unable to access the microphone. Please check your microphone and try again.",
      );
    }
  }

  function stopVoice() {
    const recorder = mediaRecorderRef.current;

    if (recorder && recorder.state !== "inactive") {
      recorder.stop();
      return;
    }

    setListening(false);
  }

  const hpiFields = useMemo(() => {
    const labels: Record<HpiFieldKey, string> = {
      onset: text.onset,
      duration: text.duration,
      character: text.character,
      location: text.location,
      radiation: text.radiation,
      severity: text.severity,
      aggravating: text.aggravating,
      relieving: text.relieving,
      associatedSymptoms: text.associatedSymptoms,
    };

    const active = hpiFieldsByCategory[complaintCategory];

    return ALL_HPI_FIELDS.filter((field) => active.has(field)).map(
      (field) => [field, labels[field]] as const,
    );
  }, [text, complaintCategory]);

  const hpiHint = ({
    chestPain: text.hpiHintChestPain,
    fever: text.hpiHintFever,
    cough: text.hpiHintCough,
    abdominalPain: text.hpiHintAbdominalPain,
    headache: text.hpiHintHeadache,
  } as Partial<Record<ComplaintCategory, string>>)[complaintCategory];

  function getStepNarration(stepIndex: number): string {
    switch (steps[stepIndex]) {
      case "consent":
        return [text.consentTitle, text.consentText].filter(Boolean).join(". ");
      case "complaint":
        return [text.chiefComplaint, text.chiefComplaintSubtitle].filter(Boolean).join(". ");
      case "hpi":
        return [text.hpiTitle, text.hpiSubtitle, hpiHint].filter(Boolean).join(". ");
      case "history":
        return [text.pastTitle, text.pastSubtitle].filter(Boolean).join(". ");
      case "review":
        return [text.reviewTitle, text.reviewSubtitle].filter(Boolean).join(". ");
      case "reviewSubmit":
        return [text.review, text.reviewSubtitle2].filter(Boolean).join(". ");
      default:
        return "";
    }
  }

  // Audio-guided mode: narrate each screen automatically as the patient
  // moves through the intake, reusing the same TTS pipeline the manual
  // "Listen to explanation" button on the consent step already uses.
  useEffect(() => {
    if (!audioGuided || submitted || loadingCorrection) return;

    const narration = getStepNarration(step);

    if (narration) {
      void say(narration);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, audioGuided, lang]);

  const canContinue = useMemo(() => {
    if (step === 0) return consent.clinicalHistory && consent.clinicianSharing;
    if (step === 1) return history.chiefComplaint.trim().length > 0;
    return true;
  }, [step, consent, history.chiefComplaint]);

  async function analyzeDocument(file: File) {
    setSubmitError("");
    try {
      const formData = new FormData();
      formData.append("file", file);
      const response = await fetch("/api/analyze-document", { method: "POST", body: formData });
      const result = await response.json().catch(() => null);
      if (!response.ok || !result?.success) {
        throw new Error(result?.error || "Unable to analyze this document.");
      }
      const data = result.data || result.extractedData || result.result || result;
      const extractedMeds = Array.isArray(data?.medications)
        ? data.medications
            .map((item: any) => [item?.name, item?.dosage, item?.frequency].filter(Boolean).join(" — "))
            .filter(Boolean)
        : [];
      const extractedLabs = Array.isArray(data?.labResults)
        ? data.labResults.map((item: any) => typeof item === "string" ? item : JSON.stringify(item)).filter(Boolean)
        : [];
      const extractedDiagnoses = Array.isArray(data?.diagnoses)
        ? data.diagnoses.map((item: any) => typeof item === "string" ? item : JSON.stringify(item)).filter(Boolean)
        : [];
      const extracted = [...extractedMeds, ...extractedLabs, ...extractedDiagnoses];
      if (extracted.length) {
        setDocumentInsights((current) => {
          const merged = [...current, ...extracted];
          return Array.from(new Set(merged));
        });
      }
      if (extractedMeds.length) {
        setHistory((current) => ({
          ...current,
          medications: current.medications
            ? `${current.medications}\n${extractedMeds.join("\n")}`
            : extractedMeds.join("\n"),
        }));
      }
      if (extractedLabs.length || extractedDiagnoses.length) {
        const combined = [...extractedLabs, ...extractedDiagnoses].join("\n");
        setHistory((current) => ({
          ...current,
          investigations: current.investigations ? `${current.investigations}\n${combined}` : combined,
        }));
      }
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : "Unable to analyze this document.");
    }
  }

  async function analyzeSelectedDocuments() {
    if (!selectedDocuments.length || analyzingDocument) return;
    setAnalyzingDocument(true);
    try {
      for (const file of selectedDocuments) {
        await analyzeDocument(file);
      }
    } finally {
      setAnalyzingDocument(false);
    }
  }

  async function submitIntake() {
    if (submitting || submitted) return;

    setSubmitting(true);
    setSubmitError("");

    try {
      // Store any REAL newly selected documents first.
      const storedDocuments: { name: string; type: string; url: string }[] = [];

      for (const file of selectedDocuments) {
        const uploadFormData = new FormData();
        uploadFormData.append("file", file);

        const uploadResponse = await fetch("/api/upload-document", {
          method: "POST",
          body: uploadFormData,
          credentials: "include",
        });

        const uploadResult = await uploadResponse.json().catch(() => null);

        if (!uploadResponse.ok || !uploadResult?.success) {
          throw new Error(
            uploadResult?.error ||
              `Unable to store the original document: ${file.name}`,
          );
        }

        const originalFileUrl = uploadResult.file?.url;
        const originalFileType = uploadResult.file?.type || file.type;

        if (!originalFileUrl) {
          throw new Error(
            `The original document was stored but no file reference was returned: ${file.name}`,
          );
        }

        storedDocuments.push({
          name: file.name,
          type: originalFileType,
          url: originalFileUrl,
        });
      }

      const intakePayload = {
        preferredLanguage: lang,
        mode,
        consent,
        chiefComplaint: history.chiefComplaint,
        hpi: {
          onset: history.onset,
          duration: history.duration,
          character: history.character,
          location: history.location,
          radiation: history.radiation,
          severity: history.severity,
          aggravating: history.aggravating,
          relieving: history.relieving,
          associatedSymptoms: history.associatedSymptoms,
        },
        pastMedicalHistory: history.pastMedical
          .split(/\n|,/)
          .map((v) => v.trim())
          .filter(Boolean),
        pastSurgicalHistory: history.pastSurgical
          .split(/\n|,/)
          .map((v) => v.trim())
          .filter(Boolean),
        medications: history.medications
          .split(/\n|,/)
          .map((v) => v.trim())
          .filter(Boolean),
        allergies: history.allergies
          .split(/\n|,/)
          .map((v) => v.trim())
          .filter(Boolean),
        familyHistory: history.family
          .split(/\n|,/)
          .map((v) => v.trim())
          .filter(Boolean),
        personalHistory: {
          diet: history.diet,
          sleep: history.sleep,
          smoking: history.smoking,
          alcohol: history.alcohol,
          occupation: history.occupation,
        },
        reviewOfSystems: { general: history.ros },
        priorInvestigations: history.investigations
          .split(/\n|,/)
          .map((v) => v.trim())
          .filter(Boolean),
        ayush: history.ayush,
        sourceDocuments: storedDocuments.map((document) => ({
          name: document.name,
          type: document.type,
          url: document.url,
        })),
      };

      /*
       * CORRECTION WORKFLOW
       *
       * The patient must update the SAME rejected record.
       * We PATCH REJECTED -> PENDING instead of creating a duplicate.
       */
      if (correctionRecordId) {
        const correctedInterpretation = JSON.stringify(intakePayload);

        const validMedications = intakePayload.medications.map((name) => ({
          name,
          dosage: null,
          frequency: null,
          duration: null,
        }));

        const updateBody: Record<string, unknown> = {
          id: correctionRecordId,
          status: "PENDING",
          interpretation: correctedInterpretation,
          medications: validMedications,
          documentName: "Pre-consultation Clinical Intake",
          documentType: "CLINICAL_INTAKE",
        };

        // If the patient supplied a new real document, make it the
        // primary original document for the updated record.
        if (storedDocuments.length > 0) {
          updateBody.originalFileUrl = storedDocuments[0].url;
          updateBody.originalFileType = storedDocuments[0].type;
        }

        const updateResponse = await fetch("/api/medical-records", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          cache: "no-store",
          body: JSON.stringify(updateBody),
        });

        const updateResult = await updateResponse.json().catch(() => null);

        if (!updateResponse.ok || !updateResult?.success) {
          throw new Error(
            updateResult?.error ||
              "Unable to resubmit the corrected clinical intake.",
          );
        }

        setRedFlags(
          Array.isArray(updateResult.redFlags) ? updateResult.redFlags : [],
        );
        setSubmitted(true);

        // Return to the real records list after the SAME record has been
        // moved from REJECTED back to PENDING.
        router.push("/records");
        router.refresh();
        return;
      }

      /*
       * NORMAL NEW SUBMISSION
       */
      const response = await fetch("/api/clinical-intake", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(intakePayload),
      });

      const result = await response.json().catch(() => null);
      if (!response.ok || !result?.success) {
        throw new Error(result?.error || "Unable to submit clinical intake.");
      }

      setRedFlags(Array.isArray(result.redFlags) ? result.redFlags : []);
      setSubmitted(true);
    } catch (error) {
      setSubmitError(
        error instanceof Error
          ? error.message
          : "Unable to submit clinical intake.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  function next() {
    if (!canContinue) return;
    setStep((current) => Math.min(current + 1, steps.length - 1));
  }

  function previous() {
    if (submitted) return;
    setStep((current) => Math.max(current - 1, 0));
  }

  return (
    <main className="min-h-screen bg-[#f4f8f7] text-slate-900">
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute left-[5%] top-[8%] h-64 w-64 rounded-full bg-teal-200/20 blur-3xl" />
        <div className="absolute right-[5%] top-[22%] h-80 w-80 rounded-full bg-cyan-200/20 blur-3xl" />
      </div>

      <div className="relative mx-auto max-w-6xl px-4 py-5 sm:px-6 lg:px-8">
        <header className="mb-6 flex items-center justify-between gap-4">
          <button
            type="button"
            onClick={() => router.push("/dashboard")}
            className="inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium text-slate-600 hover:bg-white"
          >
            <ArrowLeft size={17} />
            {text.backDashboard}
          </button>
          <div className="flex flex-wrap items-center justify-end gap-2">
            <AccessibilityToggle
              active={audioGuided}
              icon={<Volume2 size={14} />}
              label={text.a11yAudioGuided}
              onClick={toggleAudioGuided}
            />
            <AccessibilityToggle
              active={highContrast}
              icon={<CircleAlert size={14} />}
              label={text.a11yHighContrast}
              onClick={toggleHighContrast}
            />
            <AccessibilityToggle
              active={largeText}
              icon={<span className="text-[13px] font-black leading-none">A</span>}
              label={text.a11yLargeText}
              onClick={toggleLargeText}
            />
            <LanguageSwitcher />
            <div className="hidden items-center gap-2 rounded-full border border-white/70 bg-white/80 px-3 py-2 text-xs font-semibold text-slate-600 shadow-sm sm:flex">
              <ShieldCheck size={15} />
              {text.humanVerification}
            </div>
          </div>
        </header>

        <section className="mb-6 overflow-hidden rounded-[30px] border border-white/80 bg-white/90 shadow-[0_25px_70px_rgba(15,118,110,0.10)] backdrop-blur">
          <div className="relative overflow-hidden bg-gradient-to-br from-[#0f766e] via-[#0e9388] to-[#164e63] px-6 py-8 text-white sm:px-9 sm:py-10">
            <div className="absolute -right-20 -top-24 h-72 w-72 rounded-full border border-white/10" />
            <div className="absolute -right-5 bottom-[-120px] h-64 w-64 rounded-full border border-white/10" />
            <div className="relative flex flex-col gap-7 lg:flex-row lg:items-end lg:justify-between">
              <div className="max-w-3xl">
                <div className="mb-4 flex items-center gap-2 text-xs font-bold uppercase tracking-[0.2em] text-teal-100">
                  <Sparkles size={15} />
                  Pre-consultation clinical intake
                </div>
                <h1 className="text-3xl font-semibold tracking-tight sm:text-5xl">{text.title}</h1>
                <p className="mt-4 max-w-2xl text-sm leading-6 text-teal-50 sm:text-base">{text.subtitle}</p>
              </div>
              <div className="flex items-center gap-3 rounded-2xl border border-white/15 bg-white/10 px-4 py-3 backdrop-blur">
                <HeartPulse size={21} />
                <div>
                  <p className="text-[11px] uppercase tracking-[0.18em] text-teal-100">{text.patient}</p>
                  <p className="font-semibold">{userName}</p>
                </div>
              </div>
            </div>
          </div>

          <div className="px-6 py-4 sm:px-9">
            <div className="flex items-center justify-between text-xs font-semibold text-slate-500">
              <span>Step {step + 1} of {steps.length}</span>
              <span>{Math.round(progress)}%</span>
            </div>
            <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100">
              <div className="h-full rounded-full bg-gradient-to-r from-teal-600 to-cyan-500 transition-all duration-300" style={{ width: `${progress}%` }} />
            </div>
          </div>
        </section>

        <section className="grid gap-6 lg:grid-cols-[1fr_320px]">
          <div className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
            {correctionRecordId && loadingCorrection && (
              <div className="mb-6 flex items-center gap-3 rounded-2xl border border-teal-200 bg-teal-50 p-4 text-sm text-teal-800">
                <Loader2 size={18} className="animate-spin" />
                Loading your previous clinical intake for correction…
              </div>
            )}

            {correctionRecordId && !loadingCorrection && !submitted && !submitError && (
              <div className="mb-6 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
                <strong>{text.correctionRequested || "Correction requested:"}</strong> {text.correctionBody || "Your previously submitted answers have been loaded. Review and edit the information before resubmitting it for clinician verification."}
              </div>
            )}

            {!submitted && step === 0 && (
              <div>
                <div className="mb-6 flex items-start gap-4">
                  <div className="rounded-2xl bg-teal-50 p-3 text-teal-700"><ShieldCheck size={24} /></div>
                  <div>
                    <h2 className="text-2xl font-semibold">{text.consentTitle}</h2>
                    <p className="mt-1 text-sm leading-6 text-slate-500">{text.consentText}</p>
                  </div>
                </div>

                <div className="mb-7 grid gap-3 sm:grid-cols-2">
                  <button type="button" onClick={() => say(text.consentText)} className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-left hover:bg-slate-100">
                    <Volume2 size={19} className="text-teal-700" />
                    <div><p className="text-sm font-semibold">{text.listenExplanation}</p><p className="text-xs text-slate-500">{text.audioGuided}</p></div>
                  </button>
                  <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <Globe2 size={19} className="text-teal-700" />
                    <div><p className="text-sm font-semibold">{languageLocales[lang]}</p><p className="text-xs text-slate-500">{text.voiceLanguage}</p></div>
                  </div>
                </div>

                <div className="space-y-3">
                  {[
                    ["clinicalHistory", text.consentClinicalHistory],
                    ["documentProcessing", text.consentDocumentProcessing],
                    ["clinicianSharing", text.consentClinicianSharing],
                  ].map(([key, label]) => (
                    <label key={key} className="flex cursor-pointer items-start gap-3 rounded-2xl border border-slate-200 p-4 hover:bg-slate-50">
                      <input
                        type="checkbox"
                        className="mt-1 h-4 w-4 accent-teal-700"
                        checked={Boolean(consent[key as keyof typeof consent])}
                        onChange={(event) => setConsent((current) => ({ ...current, [key]: event.target.checked }))}
                      />
                      <span className="text-sm text-slate-700">{label}</span>
                    </label>
                  ))}
                </div>

                <div className="mt-7">
                  <p className="mb-3 text-sm font-semibold text-slate-700">{text.historyMode}</p>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <button type="button" onClick={() => setMode("GENERAL")} className={`rounded-2xl border p-4 text-left transition ${mode === "GENERAL" ? "border-teal-500 bg-teal-50 ring-2 ring-teal-100" : "border-slate-200 hover:bg-slate-50"}`}>
                      <div className="flex items-center gap-3"><Stethoscope size={19} className="text-teal-700" /><span className="font-semibold">{text.general}</span></div>
                      <p className="mt-2 text-xs text-slate-500">{text.generalDescription}</p>
                    </button>
                    <button type="button" onClick={() => setMode("AYUSH")} className={`rounded-2xl border p-4 text-left transition ${mode === "AYUSH" ? "border-teal-500 bg-teal-50 ring-2 ring-teal-100" : "border-slate-200 hover:bg-slate-50"}`}>
                      <div className="flex items-center gap-3"><Sparkles size={19} className="text-teal-700" /><span className="font-semibold">{text.ayush}</span></div>
                      <p className="mt-2 text-xs text-slate-500">{text.ayushDescription}</p>
                    </button>
                  </div>
                </div>
              </div>
            )}

            {!submitted && step === 1 && (
              <div>
                <SectionHeading icon={<ClipboardList size={22} />} title={text.chiefComplaint} subtitle={text.chiefComplaintSubtitle} />
                <VoiceField label={text.chiefComplaint} value={history.chiefComplaint} onChange={(value) => updateField("chiefComplaint", value)} onVoice={() => startVoice("chiefComplaint")} listening={listening && activeFieldRef.current === "chiefComplaint"} supported={voiceSupported} />
                <QuickChoices
                  options={[
                    { label: text.quickChestPain, category: "chestPain" },
                    { label: text.quickFever, category: "fever" },
                    { label: text.quickCough, category: "cough" },
                    { label: text.quickAbdominalPain, category: "abdominalPain" },
                    { label: text.quickHeadache, category: "headache" },
                    { label: text.quickOther, category: "general" },
                  ]}
                  onSelect={selectQuickComplaint}
                />
              </div>
            )}

            {!submitted && step === 2 && (
              <div>
                <SectionHeading icon={<Stethoscope size={22} />} title={text.hpiTitle} subtitle={text.hpiSubtitle} />
                {hpiHint && (
                  <div className="mb-4 rounded-2xl border border-teal-100 bg-teal-50/60 p-3 text-xs leading-5 text-teal-800">
                    {hpiHint}
                  </div>
                )}
                <div className="grid gap-4 md:grid-cols-2">
                  {hpiFields.map(([field, label]) => (
                    <VoiceField key={field} label={label} value={history[field]} onChange={(value) => updateField(field, value)} onVoice={() => startVoice(field)} listening={listening && activeFieldRef.current === field} supported={voiceSupported} multiline={field === "associatedSymptoms"} speakLabel={text.speak} listeningLabel={text.listening} />
                  ))}
                </div>
              </div>
            )}

            {!submitted && step === 3 && (
              <div>
                <SectionHeading icon={<FileText size={22} />} title={text.pastTitle} subtitle={text.pastSubtitle} />
                <div className="grid gap-4 md:grid-cols-2">
                  <TextArea label={text.pastMedical} value={history.pastMedical} onChange={(value) => updateField("pastMedical", value)} placeholder={text.enterAnswer} />
                  <TextArea label={text.pastSurgical} value={history.pastSurgical} onChange={(value) => updateField("pastSurgical", value)} placeholder={text.enterAnswer} />
                  <TextArea label={text.medications} value={history.medications} onChange={(value) => updateField("medications", value)} placeholder={text.enterAnswer} />
                  <TextArea label={text.allergies} value={history.allergies} onChange={(value) => updateField("allergies", value)} placeholder={text.enterAnswer} />
                  <TextArea label={text.family} value={history.family} onChange={(value) => updateField("family", value)} placeholder={text.enterAnswer} />
                  <TextArea label={text.occupation} value={history.occupation} onChange={(value) => updateField("occupation", value)} placeholder={text.enterAnswer} />
                  <TextArea label={text.diet} value={history.diet} onChange={(value) => updateField("diet", value)} placeholder={text.enterAnswer} />
                  <TextArea label={text.sleep} value={history.sleep} onChange={(value) => updateField("sleep", value)} placeholder={text.enterAnswer} />
                  <TextArea label={text.smoking} value={history.smoking} onChange={(value) => updateField("smoking", value)} placeholder={text.enterAnswer} />
                  <TextArea label={text.alcohol} value={history.alcohol} onChange={(value) => updateField("alcohol", value)} placeholder={text.enterAnswer} />
                </div>
                {ayushMode && (
                  <div className="mt-7 rounded-3xl border border-teal-100 bg-teal-50/50 p-5">
                    <div className="mb-4 flex items-center gap-3"><Sparkles size={20} className="text-teal-700" /><div><h3 className="font-semibold">{text.dashavidhaReviewTitle}</h3><p className="text-xs text-slate-500">{text.ayushIntro}</p></div></div>

                    <div className="space-y-4">
                      <DashavidhaParam title={text.prakritiTitle} description={text.prakritiDescription} value={history.ayush.prakriti} onChange={(value) => updateAyushField("prakriti", value)} options={doshaOptions} notesLabel={text.dashavidhaNotesPlaceholder} notesValue={history.ayush.prakritiNotes} onNotesChange={(value) => updateAyushField("prakritiNotes", value)} />
                      <DashavidhaParam title={text.vikritiTitle} description={text.vikritiDescription} value={history.ayush.vikriti} onChange={(value) => updateAyushField("vikriti", value)} options={vikritiOptions} notesLabel={text.dashavidhaNotesPlaceholder} notesValue={history.ayush.vikritiNotes} onNotesChange={(value) => updateAyushField("vikritiNotes", value)} />
                      <DashavidhaParam title={text.saraTitle} description={text.saraDescription} value={history.ayush.sara} onChange={(value) => updateAyushField("sara", value)} options={gradeOptions} notesLabel={text.dashavidhaNotesPlaceholder} notesValue={history.ayush.saraNotes} onNotesChange={(value) => updateAyushField("saraNotes", value)} />
                      <DashavidhaParam title={text.samhananaTitle} description={text.samhananaDescription} value={history.ayush.samhanana} onChange={(value) => updateAyushField("samhanana", value)} options={gradeOptions} notesLabel={text.dashavidhaNotesPlaceholder} notesValue={history.ayush.samhananaNotes} onNotesChange={(value) => updateAyushField("samhananaNotes", value)} />
                      <DashavidhaParam title={text.pramanaTitle} description={text.pramanaDescription} value={history.ayush.pramana} onChange={(value) => updateAyushField("pramana", value)} options={gradeOptions} notesLabel={text.dashavidhaNotesPlaceholder} notesValue={history.ayush.pramanaNotes} onNotesChange={(value) => updateAyushField("pramanaNotes", value)} />
                      <DashavidhaParam title={text.satmyaTitle} description={text.satmyaDescription} value={history.ayush.satmya} onChange={(value) => updateAyushField("satmya", value)} options={satmyaOptions} notesLabel={text.dashavidhaNotesPlaceholder} notesValue={history.ayush.satmyaNotes} onNotesChange={(value) => updateAyushField("satmyaNotes", value)} />
                      <DashavidhaParam title={text.sattvaTitle} description={text.sattvaDescription} value={history.ayush.sattva} onChange={(value) => updateAyushField("sattva", value)} options={gradeOptions} notesLabel={text.dashavidhaNotesPlaceholder} notesValue={history.ayush.sattvaNotes} onNotesChange={(value) => updateAyushField("sattvaNotes", value)} />

                      <div className="rounded-2xl border border-white bg-white/70 p-4">
                        <p className="text-sm font-semibold text-slate-800">{text.aharaShaktiTitle}</p>
                        <p className="mt-1 text-xs leading-5 text-slate-500">{text.aharaShaktiDescription}</p>
                        <div className="mt-3 grid gap-4 sm:grid-cols-2">
                          <div>
                            <p className="mb-2 text-xs font-semibold text-slate-600">{text.abhyavaharanaShaktiLabel}</p>
                            <PillGroup value={history.ayush.abhyavaharanaShakti} onChange={(value) => updateAyushField("abhyavaharanaShakti", value)} options={gradeOptions} />
                          </div>
                          <div>
                            <p className="mb-2 text-xs font-semibold text-slate-600">{text.jaranaShaktiLabel}</p>
                            <PillGroup value={history.ayush.jaranaShakti} onChange={(value) => updateAyushField("jaranaShakti", value)} options={gradeOptions} />
                          </div>
                        </div>
                        <textarea value={history.ayush.aharaShaktiNotes} onChange={(event) => updateAyushField("aharaShaktiNotes", event.target.value)} placeholder={text.dashavidhaNotesPlaceholder} rows={2} className="mt-3 w-full resize-y rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs outline-none placeholder:text-slate-400 focus:border-teal-500 focus:ring-2 focus:ring-teal-100" />
                      </div>

                      <DashavidhaParam title={text.vyayamaShaktiTitle} description={text.vyayamaShaktiDescription} value={history.ayush.vyayamaShakti} onChange={(value) => updateAyushField("vyayamaShakti", value)} options={gradeOptions} notesLabel={text.dashavidhaNotesPlaceholder} notesValue={history.ayush.vyayamaShaktiNotes} onNotesChange={(value) => updateAyushField("vyayamaShaktiNotes", value)} />

                      <div className="rounded-2xl border border-white bg-white/70 p-4">
                        <p className="text-sm font-semibold text-slate-800">{text.vayaTitle}</p>
                        <p className="mt-1 text-xs leading-5 text-slate-500">{text.vayaDescription}</p>
                        <div className="mt-3"><PillGroup value={history.ayush.vaya} onChange={(value) => updateAyushField("vaya", value)} options={vayaOptions} /></div>
                        <input type="number" min={0} max={130} value={history.ayush.vayaYears} onChange={(event) => updateAyushField("vayaYears", event.target.value)} placeholder={text.vayaYearsLabel} className="mt-3 w-full max-w-[220px] rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs outline-none placeholder:text-slate-400 focus:border-teal-500 focus:ring-2 focus:ring-teal-100" />
                      </div>

                      <div className="grid gap-4 md:grid-cols-2">
                        <TextArea label={text.aharaVihara} value={history.ayush.aharaVihara} onChange={(value) => updateAyushField("aharaVihara", value)} placeholder={text.aharaViharaPlaceholder} rows={3} />
                        <TextArea label={text.nidana} value={history.ayush.nidana} onChange={(value) => updateAyushField("nidana", value)} placeholder={text.nidanaPlaceholder} rows={3} />
                        <TextArea label={text.samprapti} value={history.ayush.samprapti} onChange={(value) => updateAyushField("samprapti", value)} placeholder={text.sampraptiPlaceholder} rows={3} />
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {!submitted && step === 4 && (
              <div>
                <SectionHeading icon={<CircleAlert size={22} />} title={text.reviewTitle} subtitle={text.reviewSubtitle} />
                <div className="grid gap-4">
                  <TextArea label={text.ros} value={history.ros} onChange={(value) => updateField("ros", value)} placeholder={text.enterAnswer} rows={6} />
                  <TextArea label={text.investigations} value={history.investigations} onChange={(value) => updateField("investigations", value)} placeholder={text.enterAnswer} rows={5} />
                </div>
                <div className="mt-6 rounded-3xl border border-dashed border-teal-200 bg-teal-50/50 p-5">
                  <div className="flex items-start gap-3">
                    <div className="rounded-xl bg-white p-2.5 text-teal-700"><FileText size={19} /></div>
                    <div className="flex-1">
                      <h3 className="font-semibold">{text.documentsTitle}</h3>
                      <p className="mt-1 text-xs leading-5 text-slate-500">{text.documentsDescription}</p>
                      <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center">
                        <input
                          type="file"
                          accept="image/*,.pdf"
                          multiple
                          onChange={(event) => {
                            const files = Array.from(event.target.files || []);
                            setSelectedDocuments(files);
                          }}
                          className="block w-full text-sm text-slate-600 file:mr-4 file:rounded-xl file:border-0 file:bg-teal-700 file:px-4 file:py-2.5 file:text-sm file:font-semibold file:text-white hover:file:bg-teal-800"
                        />
                        <button
                          type="button"
                          onClick={() => void analyzeSelectedDocuments()}
                          disabled={!selectedDocuments.length || analyzingDocument}
                          className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl border border-teal-200 bg-white px-4 py-2.5 text-sm font-semibold text-teal-700 disabled:opacity-40"
                        >
                          {analyzingDocument ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
                          {analyzingDocument ? text.analyzing : text.analyze}
                        </button>
                      </div>
                      {!!selectedDocuments.length && <p className="mt-3 text-xs text-slate-500">{selectedDocuments.length} {text.selectedSuffix}</p>}
                      {!!documentInsights.length && (
                        <div className="mt-4 rounded-2xl bg-white p-4">
                          <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">{text.aiContext}</p>
                          <ul className="mt-2 space-y-1 text-sm text-slate-700">
                            {documentInsights.slice(-8).map((item, index) => <li key={`${item}-${index}`}>• {item}</li>)}
                          </ul>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
                <div className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
                  <div className="flex gap-3"><CircleAlert size={19} className="mt-0.5 shrink-0" /><p><strong>{text.safetyScreen}:</strong> {text.safetyText}</p></div>
                </div>
              </div>
            )}

            {!submitted && step === 5 && (
              <div>
                <SectionHeading icon={<Check size={22} />} title={text.review} subtitle={text.reviewSubtitle2} />
                <div className="space-y-4">
                  <SummaryBlock title={text.chiefComplaint} value={history.chiefComplaint} emptyLabel={text.notReported} />
                  <SummaryBlock title={text.hpiTitle} value={[history.onset, history.duration, history.character, history.location, history.radiation, history.severity, history.aggravating, history.relieving, history.associatedSymptoms].filter(Boolean).join(" • ")} emptyLabel={text.notReported} />
                  <SummaryBlock title={text.pastTitle} value={[history.pastMedical, history.pastSurgical, history.medications, history.allergies].filter(Boolean).join(" • ")} emptyLabel={text.notReported} />
                  <SummaryBlock title={`${text.family} / ${text.occupation}`} value={[history.family, history.occupation, history.diet, history.sleep, history.smoking, history.alcohol].filter(Boolean).join(" • ")} emptyLabel={text.notReported} />
                  <SummaryBlock title={text.investigations} value={history.investigations} emptyLabel={text.notReported} />
                  {ayushMode && <SummaryBlock title={text.dashavidhaReviewTitle} value={formatDashavidhaSummary(history.ayush)} emptyLabel={text.notReported} />}
                </div>
                {submitError && <div className="mt-5 rounded-xl bg-rose-50 p-4 text-sm text-rose-700">{submitError}</div>}
              </div>
            )}

            {submitted && (
              <div className="py-5">
                <div className="mx-auto max-w-xl text-center">
                  <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-emerald-50 text-emerald-600"><Check size={38} /></div>
                  <p className="mt-5 text-xs font-bold uppercase tracking-[0.2em] text-emerald-700">{text.submitted}</p>
                  <h2 className="mt-2 text-3xl font-semibold tracking-tight">{text.complete}</h2>
                  <p className="mt-3 text-sm leading-6 text-slate-500">{text.completionNote}</p>
                  {redFlags.length > 0 && (
                    <div className="mt-6 rounded-2xl border border-rose-200 bg-rose-50 p-5 text-left">
                      <div className="flex gap-3"><CircleAlert size={20} className="mt-0.5 text-rose-600" /><div><p className="font-semibold text-rose-900">{text.urgent}</p><ul className="mt-2 space-y-1 text-sm text-rose-800">{redFlags.map((flag) => <li key={flag}>• {flag}</li>)}</ul><p className="mt-3 text-xs text-rose-700">{text.triageNote}</p></div></div>
                    </div>
                  )}
                  <div className="mt-7 flex flex-col justify-center gap-3 sm:flex-row">
                    <button type="button" onClick={() => router.push("/records")} className="rounded-xl bg-teal-700 px-5 py-3 text-sm font-semibold text-white hover:bg-teal-800">{text.openRecords}</button>
                    <button type="button" onClick={() => router.push("/dashboard")} className="rounded-xl border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50">{text.backDashboard}</button>
                  </div>
                </div>
              </div>
            )}

            {!submitted && (
              <div className="mt-8 flex items-center justify-between gap-3 border-t border-slate-100 pt-5">
                <button type="button" onClick={previous} disabled={step === 0 || submitting} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-700 disabled:cursor-not-allowed disabled:opacity-40"><ChevronLeft size={17} /> {text.back}</button>
                {step < steps.length - 1 ? (
                  <button type="button" onClick={next} disabled={!canContinue || submitting} className="inline-flex items-center gap-2 rounded-xl bg-teal-700 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-teal-800 disabled:cursor-not-allowed disabled:opacity-40">{text.next}<ChevronRight size={17} /></button>
                ) : (
                  <button type="button" onClick={submitIntake} disabled={submitting} className="inline-flex items-center gap-2 rounded-xl bg-teal-700 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-teal-800 disabled:cursor-not-allowed disabled:opacity-50">{submitting ? <Loader2 size={17} className="animate-spin" /> : <Check size={17} />}{submitting ? text.submitting : text.submit}</button>
                )}
              </div>
            )}
          </div>

          <aside className="space-y-4">
            <div className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex items-center gap-3"><div className="rounded-xl bg-teal-50 p-2.5 text-teal-700"><AudioLines size={19} /></div><div><p className="font-semibold">{text.voiceTouch}</p><p className="text-xs text-slate-500">{text.voiceTouchDescription}</p></div></div>
              <div className="mt-4 rounded-2xl bg-slate-50 p-4 text-xs leading-5 text-slate-600">{text.speakPrompt}</div>
              {voiceError && <p className="mt-3 text-xs text-rose-600">{voiceError}</p>}
            </div>
            <div className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex items-center gap-3"><div className="rounded-xl bg-amber-50 p-2.5 text-amber-700"><CircleAlert size={19} /></div><div><p className="font-semibold">{text.redFlagEscalation}</p><p className="text-xs text-slate-500">{text.redFlagDescription}</p></div></div>
              <p className="mt-4 text-xs leading-5 text-slate-600">{text.redFlagBody}</p>
            </div>
            <div className="rounded-[24px] border border-teal-100 bg-teal-50/70 p-5">
              <div className="flex items-center gap-3"><ShieldCheck size={19} className="text-teal-700" /><p className="font-semibold text-teal-900">{text.verificationGate}</p></div>
              <p className="mt-3 text-xs leading-5 text-teal-900/70">{text.verificationBody}</p>
            </div>
          </aside>
        </section>
      </div>
    </main>
  );
}

function SectionHeading({ icon, title, subtitle }: { icon: React.ReactNode; title: string; subtitle: string }) {
  return (
    <div className="mb-6 flex items-start gap-3">
      <div className="rounded-2xl bg-teal-50 p-3 text-teal-700">{icon}</div>
      <div><h2 className="text-2xl font-semibold tracking-tight">{title}</h2><p className="mt-1 text-sm leading-6 text-slate-500">{subtitle}</p></div>
    </div>
  );
}

function VoiceField({ label, value, onChange, onVoice, listening, supported, multiline = false, speakLabel = "Speak", listeningLabel = "Listening…" }: { label: string; value: string; onChange: (value: string) => void; onVoice: () => void; listening: boolean; supported: boolean; multiline?: boolean; speakLabel?: string; listeningLabel?: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
      <div className="mb-2 flex items-center justify-between gap-3"><label className="text-sm font-semibold text-slate-800">{label}</label><button type="button" onClick={onVoice} disabled={!supported || listening} className={`inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-semibold ${listening ? "bg-rose-50 text-rose-700" : "bg-white text-teal-700 shadow-sm hover:bg-teal-50"}`}>{listening ? <MicOff size={14} /> : <Mic size={14} />}{listening ? listeningLabel : speakLabel}</button></div>
      {multiline ? <textarea value={value} onChange={(event) => onChange(event.target.value)} rows={4} className="w-full resize-y rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-100" /> : <input value={value} onChange={(event) => onChange(event.target.value)} className="w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-100" />}
    </div>
  );
}

function AccessibilityToggle({
  active,
  icon,
  label,
  onClick,
}: {
  active: boolean;
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-2 text-xs font-semibold transition ${
        active
          ? "border-teal-600 bg-teal-600 text-white"
          : "border-white/70 bg-white/80 text-slate-600 hover:bg-white"
      }`}
    >
      {icon}
      {label}
    </button>
  );
}

function TextArea({ label, value, onChange, placeholder, rows = 4 }: { label: string; value: string; onChange: (value: string) => void; placeholder?: string; rows?: number }) {
  return <label className="block"><span className="mb-2 block text-sm font-semibold text-slate-800">{label}</span><textarea value={value} onChange={(event) => onChange(event.target.value)} rows={rows} placeholder={placeholder} className="w-full resize-y rounded-2xl border border-slate-200 bg-slate-50/60 px-4 py-3 text-sm outline-none placeholder:text-slate-400 focus:border-teal-500 focus:bg-white focus:ring-2 focus:ring-teal-100" /></label>;
}

function QuickChoices({
  options,
  onSelect,
}: {
  options: { label: string; category: ComplaintCategory }[];
  onSelect: (category: ComplaintCategory, label: string) => void;
}) {
  return (
    <div className="mt-4 flex flex-wrap gap-2">
      {options.map((option) => (
        <button
          key={option.label}
          type="button"
          onClick={() => onSelect(option.category, option.label)}
          className="rounded-full border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600 hover:border-teal-300 hover:bg-teal-50 hover:text-teal-700"
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

function SummaryBlock({ title, value, emptyLabel = "Not reported" }: { title: string; value: string; emptyLabel?: string }) {
  return <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4"><p className="text-[11px] font-bold uppercase tracking-[0.16em] text-slate-500">{title}</p><p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-800">{value || emptyLabel}</p></div>;
}

type PillOption = { value: string; label: string };

function PillGroup({ value, onChange, options }: { value: string; onChange: (value: string) => void; options: PillOption[] }) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          onClick={() => onChange(option.value)}
          className={`rounded-full border px-3 py-2 text-xs font-semibold transition ${
            value === option.value
              ? "border-teal-500 bg-teal-50 text-teal-700 ring-2 ring-teal-100"
              : "border-slate-200 bg-white text-slate-600 hover:border-teal-300 hover:bg-teal-50 hover:text-teal-700"
          }`}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

// A single Dashavidha Pariksha parameter: classical definition, a
// closed set of standard categorical choices (never free-typed, so the
// captured value stays a clean, comparable classical term), and an
// optional free-text note for clinician-facing nuance.
function DashavidhaParam({
  title,
  description,
  value,
  onChange,
  options,
  notesLabel,
  notesValue,
  onNotesChange,
}: {
  title: string;
  description: string;
  value: string;
  onChange: (value: string) => void;
  options: PillOption[];
  notesLabel: string;
  notesValue: string;
  onNotesChange: (value: string) => void;
}) {
  return (
    <div className="rounded-2xl border border-white bg-white/70 p-4">
      <p className="text-sm font-semibold text-slate-800">{title}</p>
      <p className="mt-1 text-xs leading-5 text-slate-500">{description}</p>
      <div className="mt-3">
        <PillGroup value={value} onChange={onChange} options={options} />
      </div>
      <textarea
        value={notesValue}
        onChange={(event) => onNotesChange(event.target.value)}
        placeholder={notesLabel}
        rows={2}
        className="mt-3 w-full resize-y rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs outline-none placeholder:text-slate-400 focus:border-teal-500 focus:ring-2 focus:ring-teal-100"
      />
    </div>
  );
}
