/*
 * Shared urgent-symptom keyword matching, used by both the initial
 * clinical-intake submission (api/clinical-intake/route.ts) and the
 * correction-resubmission path (api/medical-records/route.ts PATCH).
 * These used to be two independently-maintained copies of the same
 * logic -- the medical-records copy had silently drifted back to
 * English-only matching while this one was hardened for all 12
 * languages. Keeping a single shared implementation prevents that
 * from happening again.
 *
 * Term lists cover all 12 languages this app supports (see i18n.ts /
 * clinical-intake-copy.ts), not just English. A patient who spoke or
 * typed their intake in Hindi, Tamil, etc. reports symptoms in that
 * language, so English-only keyword matching would silently miss every
 * non-English emergency report. Labels stay English-only: they're shown
 * on the clinician queue/detail view, which is English-only today.
 *
 * This is still plain substring matching, not semantic understanding --
 * it will miss paraphrases the fixed term lists don't cover in any
 * language. A model-based second pass (routing the intake text through
 * Gemini to ask "does this describe a medical emergency, and why") would
 * catch more, but is deliberately deferred: it needs a Gemini API call
 * per submission and this project's Gemini quota has already run out
 * once this session for other features.
 */

type RedFlagPattern = {
  label: string;
  terms: string[];
};

const RED_FLAG_PATTERNS: RedFlagPattern[] = [
  {
    label: "Chest pain or chest pressure reported.",
    terms: [
      "chest pain",
      "chest pressure",
      "pain in chest",
      "सीने में दर्द",
      "छाती में दर्द",
      "सीने में दबाव",
      "छाती में दबाव",
      "বুকে ব্যথা",
      "বুকে চাপ",
      "மார்பு வலி",
      "மார்பில் வலி",
      "மார்பில் அழுத்தம்",
      "ఛాతి నొప్పి",
      "ఛాతిలో నొప్పి",
      "ఛాతిలో ఒత్తిడి",
      "छातीत दुखणे",
      "छातीत वेदना",
      "छातीत दाब",
      "છાતીમાં દુખાવો",
      "છાતીમાં દબાણ",
      "ಎದೆ ನೋವು",
      "ಎದೆಯಲ್ಲಿ ನೋವು",
      "ಎದೆಯಲ್ಲಿ ಒತ್ತಡ",
      "നെഞ്ചുവേദന",
      "നെഞ്ചിൽ വേദന",
      "നെഞ്ചിൽ അമർച്ച",
      "ਛਾਤੀ ਵਿੱਚ ਦਰਦ",
      "ਛਾਤੀ ਵਿੱਚ ਦਬਾਅ",
      "ଛାତି ବିନ୍ଧା",
      "ଛାତିରେ ଯନ୍ତ୍ରଣା",
      "ଛାତିରେ ଚାପ",
      "বুকুৰ বিষ",
      "বুকুত বিষ",
      "বুকুত টান",
    ],
  },
  {
    label: "Severe breathing difficulty reported.",
    terms: [
      "severe breathlessness",
      "severe shortness of breath",
      "can't breathe",
      "cannot breathe",
      "difficulty breathing",
      "सांस लेने में तकलीफ",
      "सांस फूलना",
      "सांस नहीं आ रही",
      "साँस लेने में कठिनाई",
      "শ্বাসকষ্ট",
      "শ্বাস নিতে কষ্ট",
      "শ্বাস নিতে পারছি না",
      "மூச்சுத் திணறல்",
      "மூச்சு விட முடியவில்லை",
      "மூச்சு விடுவதில் சிரமம்",
      "శ్వాస ఆడకపోవడం",
      "శ్వాస తీసుకోవడంలో ఇబ్బంది",
      "ఊపిరి ఆడటం లేదు",
      "श्वास घेण्यास त्रास",
      "श्वास घेता येत नाही",
      "धाप लागणे",
      "શ્વાસ લેવામાં તકલીફ",
      "શ્વાસ લઈ શકાતો નથી",
      "ಉಸಿರಾಟದ ತೊಂದರೆ",
      "ಉಸಿರಾಡಲು ಆಗುತ್ತಿಲ್ಲ",
      "ಉಸಿರಾಡಲು ಕಷ್ಟ",
      "ശ്വാസതടസ്സം",
      "ശ്വാസം എടുക്കാൻ കഴിയുന്നില്ല",
      "ശ്വാസോച്ഛ്വാസത്തിൽ ബുദ്ധിമുട്ട്",
      "ਸਾਹ ਲੈਣ ਵਿੱਚ ਤਕਲੀਫ਼",
      "ਸਾਹ ਨਹੀਂ ਆ ਰਿਹਾ",
      "ନିଶ୍ୱାସ ନେବାରେ କଷ୍ଟ",
      "ନିଶ୍ୱାସ ନେଇ ପାରୁନାହିଁ",
      "উশাহ-নিশাহত অসুবিধা",
      "উশাহ ল'ব পৰা নাই",
    ],
  },
  {
    label: "Loss of consciousness or fainting reported.",
    terms: [
      "unconscious",
      "loss of consciousness",
      "fainted",
      "fainting",
      "बेहोश",
      "बेहोशी",
      "होश खो दिया",
      "मूर्छा",
      "অজ্ঞান",
      "অচেতন",
      "জ্ঞান হারিয়ে",
      "மயக்கம்",
      "சுயநினைவு இழந்தார்",
      "மயங்கி விழுந்தார்",
      "స్పృహ కోల్పోవడం",
      "అపస్మారక స్థితి",
      "మూర్ఛ",
      "बेशुद्ध",
      "शुद्ध हरपली",
      "चक्कर येऊन पडणे",
      "બેભાન",
      "ભાન ગુમાવ્યું",
      "ચક્કર આવીને પડી ગયા",
      "ಪ್ರಜ್ಞೆ ತಪ್ಪುವುದು",
      "ಮೂರ್ಛೆ",
      "ಎಚ್ಚರ ತಪ್ಪಿದರು",
      "ബോധരഹിതൻ",
      "ബോധക്ഷയം",
      "കുഴഞ്ഞുവീണു",
      "ਬੇਹੋਸ਼",
      "ਹੋਸ਼ ਗੁਆ ਦਿੱਤੀ",
      "ਬੇਹੋਸ਼ੀ",
      "ଅଚେତ",
      "ଚେତନା ହରାଇଲେ",
      "ମୂର୍ଛା",
      "অজ্ঞান",
      "চেতনা হেৰুৱালে",
      "মূৰ্ছা",
    ],
  },
  {
    label: "Possible acute neurological symptom reported.",
    terms: [
      "face drooping",
      "facial droop",
      "slurred speech",
      "sudden weakness",
      "sudden numbness",
      "unable to speak",
      "seizure",
      "चेहरा झुकना",
      "चेहरे का लटकना",
      "बोलने में लड़खड़ाहट",
      "अचानक कमजोरी",
      "अचानक सुन्नपन",
      "बोल नहीं पा रहा",
      "दौरा",
      "मिर्गी का दौरा",
      "মুখ বেঁকে যাওয়া",
      "কথা জড়িয়ে যাওয়া",
      "হঠাৎ দুর্বলতা",
      "হঠাৎ অবশ হয়ে যাওয়া",
      "কথা বলতে না পারা",
      "খিঁচুনি",
      "முகம் கோணல்",
      "பேச்சு தடுமாற்றம்",
      "திடீர் பலவீனம்",
      "திடீர் மரத்துப்போதல்",
      "பேச முடியவில்லை",
      "வலிப்பு",
      "ముఖం వంగిపోవడం",
      "మాట తడబడటం",
      "అకస్మాత్తుగా బలహీనత",
      "అకస్మాత్తుగా తిమ్మిరి",
      "మాట్లాడలేకపోవడం",
      "మూర్ఛ వ్యాధి",
      "चेहरा वाकडा होणे",
      "बोलण्यात अडखळणे",
      "अचानक अशक्तपणा",
      "अचानक बधीरपणा",
      "बोलता येत नाही",
      "फेफरे येणे",
      "ચહેરો લબડવો",
      "બોલવામાં લડખડાટ",
      "અચાનક નબળાઈ",
      "અચાનક બહેરાશ",
      "અચાનક સુન્નતા",
      "બોલી શકતા નથી",
      "તાણ આવવી",
      "ಮುಖ ಜೋತುಬೀಳುವಿಕೆ",
      "ಮಾತು ತೊದಲುವುದು",
      "ಇದ್ದಕ್ಕಿದ್ದಂತೆ ದೌರ್ಬಲ್ಯ",
      "ಇದ್ದಕ್ಕಿದ್ದಂತೆ ಜೋಮು",
      "ಮಾತನಾಡಲು ಸಾಧ್ಯವಾಗುತ್ತಿಲ್ಲ",
      "ಫಿಟ್ಸ್",
      "മുഖം കോടിപ്പോകുക",
      "സംസാരം കുഴയുക",
      "പെട്ടെന്നുള്ള ബലക്ഷയം",
      "പെട്ടെന്നുള്ള മരവിപ്പ്",
      "സംസാരിക്കാൻ കഴിയുന്നില്ല",
      "അപസ്മാരം",
      "ਚਿਹਰਾ ਲਟਕਣਾ",
      "ਬੋਲਣ ਵਿੱਚ ਲੜਖੜਾਹਟ",
      "ਅਚਾਨਕ ਕਮਜ਼ੋਰੀ",
      "ਅਚਾਨਕ ਸੁੰਨਪਨ",
      "ਬੋਲ ਨਹੀਂ ਸਕਦਾ",
      "ਦੌਰਾ",
      "ମୁହଁ ଝୁଲିପଡ଼ିବା",
      "କଥାରେ ଅସ୍ପଷ୍ଟତା",
      "ହଠାତ୍ ଦୁର୍ବଳତା",
      "ହଠାତ୍ ଝାଡ଼ ମାରିବା",
      "କଥା କହିପାରୁନାହାନ୍ତି",
      "ମୂର୍ଚ୍ଛା ଖେଳ",
      "মুখ বেঁকা হোৱা",
      "কথা কোৱাত জঁটলা",
      "অকস্মাৎ দুৰ্বলতা",
      "অকস্মাৎ অবশ হোৱা",
      "কথা ক'ব নোৱাৰা",
      "খিঁচুনি",
    ],
  },
  {
    label: "Severe bleeding reported.",
    terms: [
      "severe bleeding",
      "heavy bleeding",
      "vomiting blood",
      "blood vomiting",
      "coughing blood",
      "अत्यधिक रक्तस्राव",
      "बहुत खून बहना",
      "खून की उल्टी",
      "खांसी में खून",
      "প্রচুর রক্তক্ষরণ",
      "রক্ত বমি",
      "কাশিতে রক্ত",
      "அதிக இரத்தப்போக்கு",
      "இரத்த வாந்தி",
      "இருமலில் இரத்தம்",
      "తీవ్ర రక్తస్రావం",
      "రక్తం వాంతి",
      "దగ్గులో రక్తం",
      "जास्त रक्तस्राव",
      "रक्ताची उलटी",
      "खोकल्यातून रक्त",
      "વધુ પડતું રક્તસ્રાવ",
      "લોહીની ઉલટી",
      "ખાંસીમાં લોહી",
      "ತೀವ್ರ ರಕ್ತಸ್ರಾವ",
      "ರಕ್ತ ವಾಂತಿ",
      "ಕೆಮ್ಮಿನಲ್ಲಿ ರಕ್ತ",
      "കടുത്ത രക്തസ്രാവം",
      "രക്തം ഛർദ്ദിക്കുക",
      "ചുമയിൽ രക്തം",
      "ਬਹੁਤ ਖੂਨ ਵਹਿਣਾ",
      "ਖੂਨ ਦੀ ਉਲਟੀ",
      "ਖੰਘ ਵਿੱਚ ਖੂਨ",
      "ଅଧିକ ରକ୍ତସ୍ରାବ",
      "ରକ୍ତ ବାନ୍ତି",
      "କାଶରେ ରକ୍ତ",
      "অধিক তেজপাত",
      "তেজ বমি",
      "কাহত তেজ",
    ],
  },
];

export function detectRedFlags(text: string): string[] {
  const lower = text.toLowerCase();
  const flags: string[] = [];

  for (const pattern of RED_FLAG_PATTERNS) {
    if (pattern.terms.some((term) => lower.includes(term.toLowerCase()))) {
      flags.push(pattern.label);
    }
  }

  return Array.from(new Set(flags));
}

export function collectIntakeText(payload: {
  chiefComplaint?: unknown;
  hpi?: unknown;
  reviewOfSystems?: unknown;
}): string {
  return [
    payload.chiefComplaint,
    ...(payload.hpi && typeof payload.hpi === "object"
      ? Object.values(payload.hpi as Record<string, unknown>)
      : []),
    ...(payload.reviewOfSystems && typeof payload.reviewOfSystems === "object"
      ? Object.values(payload.reviewOfSystems as Record<string, unknown>)
      : []),
  ]
    .filter((value) => typeof value === "string")
    .join(" ");
}
