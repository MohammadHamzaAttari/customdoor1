import { db } from "./server/db";
import { users } from "./shared/schema";
import bcrypt from "bcryptjs";

async function createAdmin() {
    const username = "admin";
    const password = "password123";
    const email = "admin@example.com";
    const hashedPassword = await bcrypt.hash(password, 10);

    try {
        await db.insert(users).values({
            username,
            password: hashedPassword,
            email,
        }).onConflictDoNothing();
        console.log(`Admin user created successfully (username: ${username}, email: ${email}, password: ${password})`);
    } catch (error) {
        console.error("Failed to create admin user:", error);
    }
    process.exit(0);
}

createAdmin();
