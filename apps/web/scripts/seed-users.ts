import { PrismaClient, UserRole } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const patientPassword = await bcrypt.hash(
    "Patient@123",
    12
  );

  const clinicianPassword = await bcrypt.hash(
    "Clinician@123",
    12
  );

  await prisma.user.upsert({
    where: {
      email: "patient@jeevanlink.local",
    },

    update: {
      name: "Test Patient",
      password: patientPassword,
      role: UserRole.PATIENT,
    },

    create: {
      name: "Test Patient",
      email: "patient@jeevanlink.local",
      password: patientPassword,
      role: UserRole.PATIENT,
    },
  });

  await prisma.user.upsert({
    where: {
      email: "clinician@jeevanlink.local",
    },

    update: {
      name: "Test Clinician",
      password: clinicianPassword,
      role: UserRole.CLINICIAN,
    },

    create: {
      name: "Test Clinician",
      email: "clinician@jeevanlink.local",
      password: clinicianPassword,
      role: UserRole.CLINICIAN,
    },
  });

  console.log(
    "Test patient and clinician accounts created successfully."
  );
}

main()
  .catch((error) => {
    console.error("Seed failed:", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  }); 