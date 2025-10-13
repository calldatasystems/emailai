import { PrismaClient } from "@prisma/client";
import { auth as googleAuth, gmail as gmailApi } from "@googleapis/gmail";

const prisma = new PrismaClient();

async function testGmailAPI() {
  console.log("=== Testing Gmail API Access ===\n");

  // Get account from database
  const account = await prisma.account.findFirst({
    where: { provider: "google" },
  });

  if (!account) {
    console.error("❌ No Google account found in database");
    process.exit(1);
  }

  console.log("✅ Found Google account");
  console.log(`   - Has refresh_token: ${!!account.refresh_token}`);
  console.log(`   - Has access_token: ${!!account.access_token}`);
  console.log(`   - Scopes: ${account.scope}`);
  console.log(`   - Expires at: ${new Date((account.expires_at || 0) * 1000).toLocaleString()}\n`);

  // Create OAuth2 client
  const oauth2Client = new googleAuth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
  );

  oauth2Client.setCredentials({
    refresh_token: account.refresh_token,
    access_token: account.access_token,
    expiry_date: account.expires_at ? account.expires_at * 1000 : undefined,
  });

  console.log("✅ Created OAuth2 client\n");

  // Try to refresh token
  try {
    console.log("🔄 Attempting to refresh access token...");
    const { credentials } = await oauth2Client.refreshAccessToken();
    console.log("✅ Token refresh successful!");
    console.log(`   - New access_token length: ${credentials.access_token?.length || 0}`);
    console.log(`   - New expiry: ${credentials.expiry_date ? new Date(credentials.expiry_date).toLocaleString() : 'N/A'}\n`);
  } catch (error: any) {
    console.error("❌ Token refresh failed:", error.message);
    console.error("   This means the refresh_token is invalid/expired\n");
    process.exit(1);
  }

  // Create Gmail client
  const gmail = gmailApi({ version: "v1", auth: oauth2Client });

  // Try to fetch user profile
  try {
    console.log("🔄 Testing Gmail API - Getting user profile...");
    const profile = await gmail.users.getProfile({ userId: "me" });
    console.log("✅ Gmail API works!");
    console.log(`   - Email: ${profile.data.emailAddress}`);
    console.log(`   - Total messages: ${profile.data.messagesTotal}\n`);
  } catch (error: any) {
    console.error("❌ Gmail API failed:", error.message);
    console.error("   Error details:", JSON.stringify(error.response?.data || error, null, 2));
    process.exit(1);
  }

  // Try to fetch first sent message
  try {
    console.log("🔄 Testing Gmail API - Fetching first sent email...");
    const messages = await gmail.users.messages.list({
      userId: "me",
      q: "in:sent",
      maxResults: 1,
    });

    if (messages.data.messages && messages.data.messages.length > 0) {
      const messageId = messages.data.messages[0].id!;
      console.log(`✅ Found sent messages! First message ID: ${messageId}`);

      console.log("🔄 Fetching message content...");
      const message = await gmail.users.messages.get({
        userId: "me",
        id: messageId,
        format: "full",
      });

      console.log("✅ Successfully fetched message content!");
      const headers = message.data.payload?.headers || [];
      const subject = headers.find(h => h.name?.toLowerCase() === "subject")?.value || "";
      console.log(`   - Subject: ${subject}\n`);
    } else {
      console.log("⚠️  No sent messages found\n");
    }
  } catch (error: any) {
    console.error("❌ Failed to fetch sent messages:", error.message);
    console.error("   Error details:", JSON.stringify(error.response?.data || error, null, 2));
    process.exit(1);
  }

  console.log("🎉 All tests passed! Gmail API is working correctly.\n");
  await prisma.$disconnect();
}

testGmailAPI().catch(console.error);
