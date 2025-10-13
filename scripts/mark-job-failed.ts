import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const jobId = process.argv[2] || "cmgo1buze0005jp2pyfqi6qa2";

  await prisma.fineTuningJob.update({
    where: { id: jobId },
    data: {
      status: "FAILED",
      errorMessage: "Module import error (fixed in latest code)",
    },
  });

  console.log(`Job ${jobId} marked as FAILED`);
  await prisma.$disconnect();
}

main();
