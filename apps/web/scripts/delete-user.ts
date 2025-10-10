import prisma from "../utils/prisma";

async function deleteUser() {
  const email = "alawson@aqorn.com";

  console.log(`Finding users with email: ${email}`);

  const users = await prisma.user.findMany({
    where: { email },
    include: {
      accounts: true,
      emailAccounts: true,
    },
  });

  console.log(`Found ${users.length} user(s):`);
  users.forEach((user) => {
    console.log(`  - ID: ${user.id}, Name: ${user.name}, Accounts: ${user.accounts.length}, EmailAccounts: ${user.emailAccounts.length}`);
  });

  if (users.length === 0) {
    console.log("No users found to delete.");
    return;
  }

  console.log("\nDeleting all users with this email...");

  // Delete all related records first
  for (const user of users) {
    console.log(`\nDeleting user ${user.id}...`);

    // Delete accounts
    await prisma.account.deleteMany({
      where: { userId: user.id },
    });
    console.log(`  ✓ Deleted ${user.accounts.length} account(s)`);

    // Delete email accounts
    await prisma.emailAccount.deleteMany({
      where: { userId: user.id },
    });
    console.log(`  ✓ Deleted ${user.emailAccounts.length} email account(s)`);

    // Delete user
    await prisma.user.delete({
      where: { id: user.id },
    });
    console.log(`  ✓ Deleted user`);
  }

  console.log("\n✓ All users deleted successfully");
}

deleteUser()
  .catch((error) => {
    console.error("Error:", error);
    process.exit(1);
  })
  .finally(() => {
    prisma.$disconnect();
  });
