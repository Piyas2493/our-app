import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockGenerateContent } = vi.hoisted(() => ({
  mockGenerateContent: vi.fn(),
}));

vi.mock("@google/genai", () => ({
  GoogleGenAI: vi.fn().mockImplementation(() => ({
    models: { generateContent: mockGenerateContent },
  })),
  Type: { ARRAY: "ARRAY", OBJECT: "OBJECT", STRING: "STRING" },
}));

vi.mock("@/app/lib/auth", () => ({
  requireRole: vi.fn(),
}));

vi.mock("@/app/lib/prisma", () => ({
  prisma: {
    medicalRecord: { create: vi.fn() },
    verificationAudit: { create: vi.fn() },
    consentEvent: { createMany: vi.fn() },
  },
}));

import { requireRole } from "@/app/lib/auth";
import { prisma } from "@/app/lib/prisma";
import { POST } from "./route";

const mockedRequireRole = vi.mocked(requireRole);
const mockedRecordCreate = vi.mocked(prisma.medicalRecord.create);
const mockedAuditCreate = vi.mocked(prisma.verificationAudit.create);
const mockedConsentCreateMany = vi.mocked(prisma.consentEvent.createMany);

const patient = {
  id: "patient-1",
  name: "Test Patient",
  email: "patient@example.com",
  role: "PATIENT" as const,
};

const fullConsent = {
  clinicalHistory: true,
  documentProcessing: true,
  clinicianSharing: true,
};

function request(body: unknown) {
  return new Request("http://localhost/api/clinical-intake", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  }) as any;
}

function basePayload(overrides: Record<string, unknown> = {}) {
  return {
    preferredLanguage: "en",
    mode: "GENERAL",
    chiefComplaint: "Fever for three days",
    consent: fullConsent,
    hpi: { onset: "Three days ago" },
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mockedRequireRole.mockResolvedValue(patient);
  mockedRecordCreate.mockResolvedValue({ id: "record-1" } as any);
  mockedAuditCreate.mockResolvedValue({} as any);
  mockedConsentCreateMany.mockResolvedValue({ count: 3 } as any);
});

describe("POST /api/clinical-intake -- consent gate", () => {
  it("rejects submission when clinical-history consent is missing", async () => {
    const response = await POST(
      request(basePayload({ consent: { ...fullConsent, clinicalHistory: false } })),
    );
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toMatch(/clinical history consent/i);
    expect(mockedRecordCreate).not.toHaveBeenCalled();
  });

  it("rejects submission when clinician-sharing consent is missing", async () => {
    const response = await POST(
      request(basePayload({ consent: { ...fullConsent, clinicianSharing: false } })),
    );
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toMatch(/clinician-sharing consent/i);
    expect(mockedRecordCreate).not.toHaveBeenCalled();
  });

  it("rejects submission when the chief complaint is blank", async () => {
    const response = await POST(request(basePayload({ chiefComplaint: "   " })));

    expect(response.status).toBe(400);
    expect(mockedRecordCreate).not.toHaveBeenCalled();
  });
});

describe("POST /api/clinical-intake -- red-flag detection", () => {
  it("returns no red flags for a routine complaint", async () => {
    const response = await POST(request(basePayload()));
    const body = await response.json();

    expect(body.redFlags).toEqual([]);
  });

  it("detects an English red-flag term in the chief complaint", async () => {
    const response = await POST(
      request(basePayload({ chiefComplaint: "Sudden severe chest pain" })),
    );
    const body = await response.json();

    expect(body.redFlags).toContain("Chest pain or chest pressure reported.");
  });

  it("detects a red-flag term written in Hindi inside an HPI field, not just the chief complaint", async () => {
    const response = await POST(
      request(
        basePayload({
          chiefComplaint: "बुखार",
          hpi: { associatedSymptoms: "सांस लेने में तकलीफ हो रही है" },
        }),
      ),
    );
    const body = await response.json();

    expect(body.redFlags).toContain("Severe breathing difficulty reported.");
  });

  it("persists the detected red flags inside the stored interpretation JSON", async () => {
    await POST(request(basePayload({ chiefComplaint: "unconscious and fainting" })));

    const savedInterpretation = JSON.parse(
      mockedRecordCreate.mock.calls[0][0].data.interpretation,
    );

    expect(savedInterpretation.redFlags).toContain(
      "Loss of consciousness or fainting reported.",
    );
  });
});

describe("POST /api/clinical-intake -- English translation", () => {
  it("skips translation entirely when the patient already answered in English", async () => {
    await POST(request(basePayload({ preferredLanguage: "en" })));

    expect(mockGenerateContent).not.toHaveBeenCalled();

    const savedInterpretation = JSON.parse(
      mockedRecordCreate.mock.calls[0][0].data.interpretation,
    );

    expect(savedInterpretation.englishTranslation).toBeNull();
  });

  it("translates non-English answers and stores the result alongside the originals", async () => {
    mockGenerateContent.mockResolvedValue({
      text: JSON.stringify([
        { path: "chiefComplaint", translation: "I have had a fever for three days." },
        { path: "hpi.onset", translation: "Started three days ago." },
      ]),
    });

    await POST(
      request(
        basePayload({
          preferredLanguage: "hi",
          chiefComplaint: "मुझे तीन दिनों से बुखार है",
          hpi: { onset: "तीन दिन पहले शुरू हुआ" },
        }),
      ),
    );

    expect(mockGenerateContent).toHaveBeenCalledTimes(1);

    const savedInterpretation = JSON.parse(
      mockedRecordCreate.mock.calls[0][0].data.interpretation,
    );

    // Original-language answers must still be the source of truth.
    expect(savedInterpretation.chiefComplaint).toBe("मुझे तीन दिनों से बुखार है");

    // English translation is stored alongside, not in place of, the original.
    expect(savedInterpretation.englishTranslation.chiefComplaint).toBe(
      "I have had a fever for three days.",
    );
    expect(savedInterpretation.englishTranslation.hpi.onset).toBe(
      "Started three days ago.",
    );
  });

  it("still saves the submission successfully when translation fails (quota exceeded)", async () => {
    mockGenerateContent.mockRejectedValue(new Error("429 RESOURCE_EXHAUSTED: quota"));

    const response = await POST(
      request(
        basePayload({
          preferredLanguage: "hi",
          chiefComplaint: "मुझे तीन दिनों से बुखार है",
        }),
      ),
    );
    const body = await response.json();

    // The core guarantee: a translation failure must never block the
    // clinical intake from being submitted and saved.
    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(mockedRecordCreate).toHaveBeenCalledTimes(1);

    const savedInterpretation = JSON.parse(
      mockedRecordCreate.mock.calls[0][0].data.interpretation,
    );

    expect(savedInterpretation.chiefComplaint).toBe("मुझे तीन दिनों से बुखार है");
    expect(savedInterpretation.englishTranslation).toBeNull();
  });

  it("still saves successfully when Gemini returns malformed JSON", async () => {
    mockGenerateContent.mockResolvedValue({ text: "not valid json" });

    const response = await POST(
      request(basePayload({ preferredLanguage: "hi", chiefComplaint: "बुखार" })),
    );

    expect(response.status).toBe(200);
    expect(mockedRecordCreate).toHaveBeenCalledTimes(1);
  });
});

describe("POST /api/clinical-intake -- successful submission", () => {
  it("creates the medical record, a SUBMITTED audit entry, and mirrored consent events", async () => {
    const response = await POST(request(basePayload()));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.recordId).toBe("record-1");
    expect(body.status).toBe("PENDING");

    expect(mockedRecordCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          patientId: patient.id,
          documentType: "CLINICAL_INTAKE",
          status: "PENDING",
        }),
      }),
    );

    expect(mockedAuditCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        medicalRecordId: "record-1",
        action: "SUBMITTED",
      }),
    });

    expect(mockedConsentCreateMany).toHaveBeenCalledWith({
      data: [
        expect.objectContaining({
          category: "CLINICAL_HISTORY",
          granted: true,
          medicalRecordId: "record-1",
        }),
        expect.objectContaining({
          category: "DOCUMENT_PROCESSING",
          granted: true,
          medicalRecordId: "record-1",
        }),
        expect.objectContaining({
          category: "CLINICIAN_SHARING",
          granted: true,
          medicalRecordId: "record-1",
        }),
      ],
    });
  });

  it("mirrors documentProcessing as false when the patient did not opt in, without blocking submission", async () => {
    await POST(
      request(
        basePayload({
          consent: { ...fullConsent, documentProcessing: false },
        }),
      ),
    );

    const consentCall = mockedConsentCreateMany.mock.calls[0][0] as any;
    const documentProcessingEvent = consentCall.data.find(
      (event: any) => event.category === "DOCUMENT_PROCESSING",
    );

    expect(documentProcessingEvent.granted).toBe(false);
  });
});

describe("POST /api/clinical-intake -- error handling", () => {
  it("returns a non-2xx response when the caller is not authenticated", async () => {
    mockedRequireRole.mockRejectedValue(new Error("AUTHENTICATION_REQUIRED"));

    const response = await POST(request(basePayload()));

    expect(response.ok).toBe(false);
    expect(mockedRecordCreate).not.toHaveBeenCalled();
  });

  it("returns a non-2xx response when the caller is not a patient", async () => {
    mockedRequireRole.mockRejectedValue(new Error("FORBIDDEN"));

    const response = await POST(request(basePayload()));

    expect(response.ok).toBe(false);
    expect(mockedRecordCreate).not.toHaveBeenCalled();
  });
});
