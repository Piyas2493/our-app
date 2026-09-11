import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/app/lib/auth", () => ({
  getCurrentUser: vi.fn(),
}));

vi.mock("@/app/lib/prisma", () => ({
  prisma: {
    consentEvent: {
      findMany: vi.fn(),
      create: vi.fn(),
    },
  },
}));

import { getCurrentUser } from "@/app/lib/auth";
import { prisma } from "@/app/lib/prisma";
import { GET, POST } from "./route";

const mockedGetCurrentUser = vi.mocked(getCurrentUser);
const mockedFindMany = vi.mocked(prisma.consentEvent.findMany);
const mockedCreate = vi.mocked(prisma.consentEvent.create);

const patient = {
  id: "patient-1",
  name: "Test Patient",
  email: "patient@example.com",
  role: "PATIENT" as const,
};

function jsonRequest(body: unknown): Request {
  return new Request("http://localhost/api/consent", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("GET /api/consent", () => {
  it("returns 401 when there is no authenticated session", async () => {
    mockedGetCurrentUser.mockResolvedValue(null);

    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body.success).toBe(false);
  });

  it("returns 403 for a non-patient role", async () => {
    mockedGetCurrentUser.mockResolvedValue({
      ...patient,
      role: "CLINICIAN",
    });

    const response = await GET();

    expect(response.status).toBe(403);
  });

  it("collapses history into one status per category, using only the most recent event", async () => {
    mockedGetCurrentUser.mockResolvedValue(patient);

    // Two events for the same category, newest first (as the real
    // findMany orderBy: createdAt desc would return them). The status
    // must reflect the newest (revoked), not the oldest (granted).
    mockedFindMany.mockResolvedValue([
      {
        id: "event-2",
        patientId: patient.id,
        category: "CLINICAL_HISTORY",
        granted: false,
        source: "CONSENT_CENTER",
        notes: null,
        createdAt: new Date("2026-01-02T00:00:00Z"),
      },
      {
        id: "event-1",
        patientId: patient.id,
        category: "CLINICAL_HISTORY",
        granted: true,
        source: "CONSENT_CENTER",
        notes: null,
        createdAt: new Date("2026-01-01T00:00:00Z"),
      },
    ] as any);

    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);

    const clinicalHistory = body.statuses.find(
      (status: any) => status.category === "CLINICAL_HISTORY",
    );

    expect(clinicalHistory.granted).toBe(false);

    // A category with no events at all must default to not-granted
    // rather than throwing or being omitted.
    const research = body.statuses.find(
      (status: any) => status.category === "RESEARCH_DATA_SHARING",
    );

    expect(research.granted).toBe(false);
    expect(research.updatedAt).toBeNull();
  });
});

describe("POST /api/consent", () => {
  it("returns 401 when there is no authenticated session", async () => {
    mockedGetCurrentUser.mockResolvedValue(null);

    const response = await POST(
      jsonRequest({ category: "CLINICAL_HISTORY", granted: true }),
    );

    expect(response.status).toBe(401);
    expect(mockedCreate).not.toHaveBeenCalled();
  });

  it("returns 403 for a non-patient role", async () => {
    mockedGetCurrentUser.mockResolvedValue({ ...patient, role: "HELPDESK" });

    const response = await POST(
      jsonRequest({ category: "CLINICAL_HISTORY", granted: true }),
    );

    expect(response.status).toBe(403);
    expect(mockedCreate).not.toHaveBeenCalled();
  });

  it("rejects an invalid category", async () => {
    mockedGetCurrentUser.mockResolvedValue(patient);

    const response = await POST(
      jsonRequest({ category: "NOT_A_REAL_CATEGORY", granted: true }),
    );
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.success).toBe(false);
    expect(mockedCreate).not.toHaveBeenCalled();
  });

  it("rejects a non-boolean granted value", async () => {
    mockedGetCurrentUser.mockResolvedValue(patient);

    const response = await POST(
      jsonRequest({ category: "CLINICAL_HISTORY", granted: "yes" }),
    );

    expect(response.status).toBe(400);
    expect(mockedCreate).not.toHaveBeenCalled();
  });

  it("rejects malformed JSON instead of throwing", async () => {
    mockedGetCurrentUser.mockResolvedValue(patient);

    const badRequest = new Request("http://localhost/api/consent", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{not valid json",
    });

    const response = await POST(badRequest);

    expect(response.status).toBe(400);
    expect(mockedCreate).not.toHaveBeenCalled();
  });

  it("records a grant as a new row, never mutating a prior event", async () => {
    mockedGetCurrentUser.mockResolvedValue(patient);
    mockedCreate.mockResolvedValue({
      id: "event-new",
      patientId: patient.id,
      category: "CLINICAL_HISTORY",
      granted: true,
      source: "CONSENT_CENTER",
      notes: null,
      createdAt: new Date(),
    } as any);

    const response = await POST(
      jsonRequest({ category: "CLINICAL_HISTORY", granted: true }),
    );
    const body = await response.json();

    expect(response.status).toBe(201);
    expect(body.success).toBe(true);
    expect(body.message).toBe("Consent recorded.");

    // The append-only guarantee: POST must call create, never update or
    // upsert, so a revoke can never silently overwrite an earlier grant.
    expect(mockedCreate).toHaveBeenCalledTimes(1);
    expect(mockedCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        patientId: patient.id,
        category: "CLINICAL_HISTORY",
        granted: true,
        source: "CONSENT_CENTER",
      }),
    });
  });

  it("records a revoke with the correct message", async () => {
    mockedGetCurrentUser.mockResolvedValue(patient);
    mockedCreate.mockResolvedValue({
      id: "event-new",
      patientId: patient.id,
      category: "CLINICAL_HISTORY",
      granted: false,
      source: "CONSENT_CENTER",
      notes: null,
      createdAt: new Date(),
    } as any);

    const response = await POST(
      jsonRequest({ category: "CLINICAL_HISTORY", granted: false }),
    );
    const body = await response.json();

    expect(body.message).toBe("Consent revoked.");
  });

  it("trims notes and stores null when notes are blank", async () => {
    mockedGetCurrentUser.mockResolvedValue(patient);
    mockedCreate.mockResolvedValue({} as any);

    await POST(
      jsonRequest({
        category: "DOCUMENT_PROCESSING",
        granted: true,
        notes: "   ",
      }),
    );

    expect(mockedCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({ notes: null }),
    });
  });
});
