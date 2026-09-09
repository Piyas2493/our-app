-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_MedicalRecord" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "patientName" TEXT NOT NULL,
    "documentName" TEXT NOT NULL,
    "documentType" TEXT NOT NULL,
    "interpretation" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "originalFileUrl" TEXT,
    "originalFileType" TEXT,
    "patientId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "verifiedAt" DATETIME,
    "rejectionReason" TEXT,
    CONSTRAINT "MedicalRecord_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_MedicalRecord" ("createdAt", "documentName", "documentType", "id", "interpretation", "originalFileType", "originalFileUrl", "patientName", "rejectionReason", "status", "updatedAt", "verifiedAt") SELECT "createdAt", "documentName", "documentType", "id", "interpretation", "originalFileType", "originalFileUrl", "patientName", "rejectionReason", "status", "updatedAt", "verifiedAt" FROM "MedicalRecord";
DROP TABLE "MedicalRecord";
ALTER TABLE "new_MedicalRecord" RENAME TO "MedicalRecord";
CREATE TABLE "new_VerificationAudit" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "medicalRecordId" TEXT NOT NULL,
    "clinicianId" TEXT,
    "action" TEXT NOT NULL,
    "note" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "VerificationAudit_medicalRecordId_fkey" FOREIGN KEY ("medicalRecordId") REFERENCES "MedicalRecord" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "VerificationAudit_clinicianId_fkey" FOREIGN KEY ("clinicianId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_VerificationAudit" ("action", "createdAt", "id", "medicalRecordId", "note") SELECT "action", "createdAt", "id", "medicalRecordId", "note" FROM "VerificationAudit";
DROP TABLE "VerificationAudit";
ALTER TABLE "new_VerificationAudit" RENAME TO "VerificationAudit";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");
