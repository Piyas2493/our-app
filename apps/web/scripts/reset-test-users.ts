import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const patientEmail =
    "patient@jeevanlink.local";

  const clinicianEmail =
    "clinician@jeevanlink.local";

  const patientPassword =
    "Patient@123";

  const clinicianPassword =
    "Clinician@123";

  console.log(
    "Resetting JeevanLink development users..."
  );

  const patientHash =
    await bcrypt.hash(
      patientPassword,
      12
    );

  const clinicianHash =
    await bcrypt.hash(
      clinicianPassword,
      12
    );

  const patient =
    await prisma.user.upsert({
      where: {
        email: patientEmail,
      },

      update: {
        name: "JeevanLink Patient",
        password: patientHash,
        role: "PATIENT",
      },

      create: {
        name: "JeevanLink Patient",
        email: patientEmail,
        password: patientHash,
        role: "PATIENT",
      },
    });

  const clinician =
    await prisma.user.upsert({
      where: {
        email: clinicianEmail,
      },

      update: {
        name: "JeevanLink Clinician",
        password: clinicianHash,
        role: "CLINICIAN",
      },

      create: {
        name: "JeevanLink Clinician",
        email: clinicianEmail,
        password: clinicianHash,
        role: "CLINICIAN",
      },
    });

  /*
   * Verify the hashes immediately.
   * This prevents us from assuming that the reset worked.
   */
  const patientCheck =
    await bcrypt.compare(
      patientPassword,
      patient.password
    );

  const clinicianCheck =
    await bcrypt.compare(
      clinicianPassword,
      clinician.password
    );

  console.log("");
  console.log(
    "Patient:",
    patient.email,
    "| role:",
    patient.role,
    "| password check:",
    patientCheck
  );

  console.log(
    "Clinician:",
    clinician.email,
    "| role:",
    clinician.role,
    "| password check:",
    clinicianCheck
  );

  if (
    !patientCheck ||
    !clinicianCheck
  ) {
    throw new Error(
      "Password verification failed after database reset."
    );
  }

  console.log("");
  console.log(
    "Development users are ready."
  );
}

main()
  .catch((error) => {
    console.error(
      "Failed to reset development users:",
      error
    );

    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });