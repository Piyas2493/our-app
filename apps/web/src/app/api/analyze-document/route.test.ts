import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const { mockGenerateContent } = vi.hoisted(() => ({
  mockGenerateContent: vi.fn(),
}));

vi.mock("@google/genai", () => ({
  GoogleGenAI: vi.fn().mockImplementation(() => ({
    models: { generateContent: mockGenerateContent },
  })),
  Type: {
    OBJECT: "OBJECT",
    ARRAY: "ARRAY",
    STRING: "STRING",
  },
}));

vi.mock("@/app/lib/auth", () => ({
  requireRole: vi.fn(),
}));

import { requireRole } from "@/app/lib/auth";
import { POST } from "./route";

const mockedRequireRole = vi.mocked(requireRole);

const patient = {
  id: "patient-1",
  name: "Test Patient",
  email: "patient@example.com",
  role: "PATIENT" as const,
};

function requestWithFile(file: File | null) {
  const formData = new FormData();
  if (file) formData.set("file", file);

  return new NextRequest("http://localhost/api/analyze-document", {
    method: "POST",
    body: formData,
  });
}

function requestWithNoFileField() {
  return new NextRequest("http://localhost/api/analyze-document", {
    method: "POST",
    body: new FormData(),
  });
}

function validPdfFile(sizeBytes = 1024) {
  return new File([new Uint8Array(sizeBytes)], "report.pdf", {
    type: "application/pdf",
  });
}

const validExtraction = {
  documentType: "Lab Report",
  summary: "Routine blood panel.",
  patient: { name: "", age: "", sex: "", patientId: "" },
  documentDate: "",
  medications: [],
  labResults: [
    {
      testName: "Glucose",
      value: "145",
      unit: "mg/dL",
      referenceRange: "70-100",
      status: "High",
    },
  ],
  radiology: {},
  warnings: [],
};

beforeEach(() => {
  vi.clearAllMocks();
  mockedRequireRole.mockResolvedValue(patient);
});

afterEach(() => {
  vi.useRealTimers();
});

describe("POST /api/analyze-document -- request validation", () => {
  it("rejects when the caller is not authenticated/authorized", async () => {
    mockedRequireRole.mockRejectedValue(new Error("AUTHENTICATION_REQUIRED"));

    const response = await POST(requestWithFile(validPdfFile()));
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body.success).toBe(false);
    expect(mockGenerateContent).not.toHaveBeenCalled();
  });

  it("rejects when the caller is authenticated but not a patient", async () => {
    mockedRequireRole.mockRejectedValue(new Error("FORBIDDEN"));

    const response = await POST(requestWithFile(validPdfFile()));

    expect(response.status).toBe(403);
    expect(mockGenerateContent).not.toHaveBeenCalled();
  });

  it("rejects when no file is present in the form data", async () => {
    const response = await POST(requestWithNoFileField());
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toMatch(/no document was uploaded/i);
    expect(mockGenerateContent).not.toHaveBeenCalled();
  });

  it("rejects an unsupported file type", async () => {
    const textFile = new File(["hello"], "notes.txt", { type: "text/plain" });

    const response = await POST(requestWithFile(textFile));
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toMatch(/unsupported file type/i);
    expect(mockGenerateContent).not.toHaveBeenCalled();
  });

  it("rejects a file larger than 15 MB", async () => {
    const oversized = validPdfFile(15 * 1024 * 1024 + 1);

    const response = await POST(requestWithFile(oversized));
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toMatch(/too large/i);
    expect(mockGenerateContent).not.toHaveBeenCalled();
  });

  it("accepts a file right at the 15 MB boundary", async () => {
    mockGenerateContent.mockResolvedValue({
      text: JSON.stringify(validExtraction),
    });

    const atLimit = validPdfFile(15 * 1024 * 1024);
    const response = await POST(requestWithFile(atLimit));

    expect(response.status).toBe(200);
  });
});

describe("POST /api/analyze-document -- successful extraction", () => {
  it("returns the parsed structured data on success", async () => {
    mockGenerateContent.mockResolvedValue({
      text: JSON.stringify(validExtraction),
    });

    const response = await POST(requestWithFile(validPdfFile()));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.data.documentType).toBe("Lab Report");
    expect(body.data.labResults[0].status).toBe("High");
  });
});

describe("POST /api/analyze-document -- malformed AI responses", () => {
  it("returns EMPTY_AI_RESPONSE when Gemini returns no text", async () => {
    mockGenerateContent.mockResolvedValue({ text: "" });

    const response = await POST(requestWithFile(validPdfFile()));
    const body = await response.json();

    expect(response.status).toBe(502);
    expect(body.code).toBe("EMPTY_AI_RESPONSE");
  });

  it("returns INVALID_AI_RESPONSE when Gemini returns non-JSON text", async () => {
    mockGenerateContent.mockResolvedValue({ text: "not valid json {{{" });

    const response = await POST(requestWithFile(validPdfFile()));
    const body = await response.json();

    expect(response.status).toBe(502);
    expect(body.code).toBe("INVALID_AI_RESPONSE");
  });
});

describe("POST /api/analyze-document -- Gemini upstream failures", () => {
  it("maps a non-retryable error to a generic 502 without retrying", async () => {
    mockGenerateContent.mockRejectedValue(new Error("totally unexpected failure"));

    const response = await POST(requestWithFile(validPdfFile()));
    const body = await response.json();

    expect(response.status).toBe(502);
    expect(body.code).toBe("AI_SERVICE_ERROR");
    // Non-retryable errors must fail fast on the first attempt.
    expect(mockGenerateContent).toHaveBeenCalledTimes(1);
  });

  // These two intentionally use real timers with a generous test timeout
  // rather than vi.useFakeTimers(): something in this route's Next.js
  // module context makes both runAllTimersAsync() and a bounded
  // advanceTimersByTimeAsync() hang indefinitely here, even though the
  // identical retry-loop-with-setTimeout pattern advances instantly in
  // isolation. Real time is slower (the route's own 5s/15s/30s backoff)
  // but correct and doesn't fight framework internals.
  it(
    "retries a quota error and eventually maps it to 429 AI_QUOTA_EXCEEDED",
    async () => {
      const quotaError = Object.assign(new Error("RESOURCE_EXHAUSTED: quota"), {
        status: 429,
      });
      mockGenerateContent.mockRejectedValue(quotaError);

      const response = await POST(requestWithFile(validPdfFile()));
      const body = await response.json();

      expect(response.status).toBe(429);
      expect(body.code).toBe("AI_QUOTA_EXCEEDED");
      // Initial attempt + 3 retries = 4 calls to the same underlying client.
      expect(mockGenerateContent).toHaveBeenCalledTimes(4);
    },
    70000,
  );

  it(
    "maps a 503 service-congestion error to AI_SERVICE_UNAVAILABLE",
    async () => {
      const congestionError = Object.assign(new Error("UNAVAILABLE: high demand"), {
        status: 503,
      });
      mockGenerateContent.mockRejectedValue(congestionError);

      const response = await POST(requestWithFile(validPdfFile()));
      const body = await response.json();

      expect(response.status).toBe(503);
      expect(body.code).toBe("AI_SERVICE_UNAVAILABLE");
    },
    70000,
  );
});
