import { storage } from "../server/storage";
import bcrypt from "bcryptjs";
import crypto from "crypto";

async function verifyAuthFlow() {
  console.log("🔍 Starting Auth Flow Verification...");

  const testUser = {
    username: "testuser_" + Math.random().toString(36).substring(7),
    password: "password123",
    email: "test_" + Math.random().toString(36).substring(7) + "@example.com",
  };

  try {
    // 1. Create User
    console.log(`[1] Creating test user: ${testUser.username}`);
    const hashedPassword = await bcrypt.hash(testUser.password, 10);
    const user = await storage.createUser({
      username: testUser.username,
      password: hashedPassword,
      email: testUser.email,
    });
    console.log("✅ User created successfully");

    // 2. Test getUserByUsername
    console.log(`[2] Testing getUserByUsername: ${testUser.username}`);
    const fetchedByUsername = await storage.getUserByUsername(testUser.username);
    if (!fetchedByUsername || fetchedByUsername.username !== testUser.username) {
      throw new Error("Failed to fetch user by username");
    }
    console.log("✅ getUserByUsername working");

    // 3. Test getUserByEmail
    console.log(`[3] Testing getUserByEmail: ${testUser.email}`);
    const fetchedByEmail = await storage.getUserByEmail(testUser.email);
    if (!fetchedByEmail || fetchedByEmail.email !== testUser.email) {
      throw new Error("Failed to fetch user by email");
    }
    console.log("✅ getUserByEmail working");

    // 4. Generate Reset Token
    console.log("[4] Generating reset token...");
    const resetToken = crypto.randomBytes(32).toString("hex");
    const resetTokenExpiry = new Date(Date.now() + 3600000);
    await storage.updateUser(user.id, {
      resetToken,
      resetTokenExpiry,
    });
    console.log("✅ Reset token saved");

    // 5. Test getUserByResetToken
    console.log("[5] Testing getUserByResetToken...");
    const fetchedByToken = await storage.getUserByResetToken(resetToken);
    if (!fetchedByToken || fetchedByToken.id !== user.id) {
      throw new Error("Failed to fetch user by reset token");
    }
    console.log("✅ getUserByResetToken working");

    // 6. Reset Password
    console.log("[6] Testing password reset...");
    const newPassword = "newpassword456";
    const newHashedPassword = await bcrypt.hash(newPassword, 10);
    await storage.updateUser(user.id, {
      password: newHashedPassword,
      resetToken: null,
      resetTokenExpiry: null,
    });
    
    const updatedUser = await storage.getUser(user.id);
    const isMatch = await bcrypt.compare(newPassword, updatedUser!.password);
    if (!isMatch) {
      throw new Error("Password update failed verification");
    }
    if (updatedUser?.resetToken !== null) {
      throw new Error("Reset token not cleared");
    }
    console.log("✅ Password reset working");

    console.log("\n✨ ALL TESTS PASSED SUCCESSFULLY! ✨");
  } catch (error) {
    console.error("\n❌ Verification failed:", error);
    process.exit(1);
  }
}

verifyAuthFlow().then(() => process.exit(0));
