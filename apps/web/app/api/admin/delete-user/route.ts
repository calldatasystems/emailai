import { NextResponse } from "next/server";
import prisma from "@/utils/prisma";

export async function POST(request: Request) {
  try {
    const { email } = await request.json();

    if (!email) {
      return NextResponse.json({ error: "Email required" }, { status: 400 });
    }

    console.log(`Finding users with email: ${email}`);

    const users = await prisma.user.findMany({
      where: { email },
      include: {
        accounts: true,
        emailAccounts: true,
      },
    });

    console.log(`Found ${users.length} user(s)`);

    if (users.length === 0) {
      return NextResponse.json({ message: "No users found" }, { status: 404 });
    }

    // Delete all related records first
    for (const user of users) {
      console.log(`Deleting user ${user.id}...`);

      // Delete accounts
      await prisma.account.deleteMany({
        where: { userId: user.id },
      });

      // Delete email accounts
      await prisma.emailAccount.deleteMany({
        where: { userId: user.id },
      });

      // Delete user
      await prisma.user.delete({
        where: { id: user.id },
      });
    }

    return NextResponse.json({
      message: `Deleted ${users.length} user(s)`,
      deletedUsers: users.map((u) => ({ id: u.id, email: u.email, name: u.name })),
    });
  } catch (error) {
    console.error("Error deleting user:", error);
    return NextResponse.json(
      { error: "Failed to delete user", details: String(error) },
      { status: 500 }
    );
  }
}
