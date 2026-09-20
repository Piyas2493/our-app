/**
 * One-time SQLite -> MongoDB Atlas data migration (2026-09-19).
 *
 * Run this AFTER:
 *   1. prisma/schema.prisma's datasource provider is "mongodb" (already done)
 *   2. DATABASE_URL in apps/web/.env points at your real Atlas connection string
 *   3. `npx prisma db push` has been run against that Atlas cluster (creates
 *      the collections/indexes)
 *   4. the legacy SQLite client is generated (gitignored build output, not
 *      checked in): `npx prisma generate --schema=scripts/mongo-migration/schema.sqlite-legacy.prisma`
 *
 * Then, from apps/web (Prisma resolves a SQLite `file:` URL relative to
 * the schema file's own directory, not your shell's cwd -- use an
 * absolute path to avoid that entirely; adjust the drive/path below to
 * wherever your checkout actually lives):
 *   SQLITE_LEGACY_URL="file:D:/JeevanLink_working/apps/web/prisma/dev.db" npx tsx scripts/mongo-migration/migrate.ts
 *
 * Reuses every record's EXISTING id (a cuid string) as-is in MongoDB --
 * Mongo's `_id` accepts any string, not just ObjectId, and the schema
 * was deliberately kept on plain `String @default(cuid())` ids (see
 * schema.prisma) specifically so this migration needs no ID remapping
 * table: every relation (foreign-key string) already matches.
 *
 * Reads via a temporary SQLite-flavored Prisma Client (generated from
 * schema.sqlite-legacy.prisma) rather than raw SQL, so every value
 * arrives already correctly typed (real Date objects, parsed JSON,
 * real booleans) exactly the way the Mongo client expects to write
 * them -- no manual type coercion to get wrong.
 *
 * Idempotent: upserts on id, so re-running after a partial failure (or
 * just to pick up newer local test data) overwrites already-migrated
 * rows instead of erroring on them.
 */

import { PrismaClient as SqliteClient } from "./generated-sqlite-legacy-client";
import { PrismaClient as MongoClient } from "@prisma/client";

const sqlite = new SqliteClient();
const mongo = new MongoClient();

async function upsertAll(
  model: { upsert: (args: { where: { id: string }; create: unknown; update: unknown }) => Promise<unknown> },
  rows: { id: string }[]
) {
  for (const row of rows) {
    const { id, ...update } = row;
    await model.upsert({ where: { id }, create: row, update });
  }
  return rows.length;
}

async function migrate() {
  console.log("Reading from SQLite, writing to MongoDB...\n");

  console.log(`Users: ${await upsertAll(mongo.user, await sqlite.user.findMany())}`);
  console.log(`Hospitals: ${await upsertAll(mongo.hospital, await sqlite.hospital.findMany())}`);
  console.log(`Labs: ${await upsertAll(mongo.lab, await sqlite.lab.findMany())}`);
  console.log(`MedicalRecords: ${await upsertAll(mongo.medicalRecord, await sqlite.medicalRecord.findMany())}`);
  console.log(`Medications: ${await upsertAll(mongo.medication, await sqlite.medication.findMany())}`);
  console.log(`MedicationReminders: ${await upsertAll(mongo.medicationReminder, await sqlite.medicationReminder.findMany())}`);
  console.log(`MedicationLogs: ${await upsertAll(mongo.medicationLog, await sqlite.medicationLog.findMany())}`);
  console.log(`VerificationAudits: ${await upsertAll(mongo.verificationAudit, await sqlite.verificationAudit.findMany())}`);
  console.log(`VitalMeasurements: ${await upsertAll(mongo.vitalMeasurement, await sqlite.vitalMeasurement.findMany())}`);
  console.log(`HospitalAdmissions: ${await upsertAll(mongo.hospitalAdmission, await sqlite.hospitalAdmission.findMany())}`);
  console.log(`HospitalEncounters: ${await upsertAll(mongo.hospitalEncounter, await sqlite.hospitalEncounter.findMany())}`);
  console.log(`HospitalTests: ${await upsertAll(mongo.hospitalTest, await sqlite.hospitalTest.findMany())}`);
  console.log(`HospitalProcedures: ${await upsertAll(mongo.hospitalProcedure, await sqlite.hospitalProcedure.findMany())}`);
  console.log(`HospitalBills: ${await upsertAll(mongo.hospitalBill, await sqlite.hospitalBill.findMany())}`);
  console.log(`HospitalBillItems: ${await upsertAll(mongo.hospitalBillItem, await sqlite.hospitalBillItem.findMany())}`);
  console.log(`InsuranceClaims: ${await upsertAll(mongo.insuranceClaim, await sqlite.insuranceClaim.findMany())}`);
  console.log(`LabOrders: ${await upsertAll(mongo.labOrder, await sqlite.labOrder.findMany())}`);
  console.log(`LabReports: ${await upsertAll(mongo.labReport, await sqlite.labReport.findMany())}`);
  console.log(`ConsentEvents: ${await upsertAll(mongo.consentEvent, await sqlite.consentEvent.findMany())}`);
  console.log(`Tickets: ${await upsertAll(mongo.ticket, await sqlite.ticket.findMany())}`);
  console.log(`TicketMessages: ${await upsertAll(mongo.ticketMessage, await sqlite.ticketMessage.findMany())}`);

  // Sessions are deliberately NOT migrated -- they're short-lived
  // (7-day) login tokens, not data worth preserving; everyone just
  // logs in again on the new deployment.

  console.log("\nDone.");
}

migrate()
  .catch((error) => {
    console.error("\nMigration failed:", error);
    process.exit(1);
  })
  .finally(async () => {
    await sqlite.$disconnect();
    await mongo.$disconnect();
  });
