import { PrismaClient, StaffRole } from "@prisma/client";

const email = process.argv[2]?.trim().toLowerCase();
const displayName = process.argv.slice(3).join(" ").trim();
if (!email || !email.includes("@") || !displayName) {
  console.error("Usage: npm run staff:provision-manager -- manager@example.com Display Name");
  process.exit(2);
}
const prisma = new PrismaClient();
try {
  const staff = await prisma.staffMember.upsert({
    where: { email },
    create: { email, displayName, role: StaffRole.MANAGER, isActive: true },
    update: { displayName, role: StaffRole.MANAGER, isActive: true },
  });
  console.log(`Provisioned manager ${staff.email} (${staff.id}).`);
} finally {
  await prisma.$disconnect();
}
