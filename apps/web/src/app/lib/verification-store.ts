export type Medication = {
  name: string;
  dosage: string;
  frequency: string;
  duration: string;
};

export type VerificationRecord = {
  id: string;
  patientName?: string;
  documentType: string;
  summary: string;
  medications: Medication[];
  submittedAt: string;
  status: "pending" | "approved" | "rejected";
};

// Temporary in-memory store for the prototype
const verificationRecords: VerificationRecord[] = [];

export function addVerificationRecord(record: VerificationRecord) {
  verificationRecords.push(record);
}

export function getVerificationRecords() {
  return verificationRecords;
}

export function getVerificationRecord(id: string) {
  return verificationRecords.find(
    (record) => record.id === id
  );
}

export function updateVerificationRecord(
  id: string,
  updates: Partial<VerificationRecord>
) {
  const index = verificationRecords.findIndex(
    (record) => record.id === id
  );

  if (index === -1) return null;

  verificationRecords[index] = {
    ...verificationRecords[index],
    ...updates,
  };

  return verificationRecords[index];
}
