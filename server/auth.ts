import passport from "passport";
import { Strategy as LocalStrategy } from "passport-local";
import { Express } from "express";
import session from "express-session";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import { storage } from "./storage";
import { User as SelectUser } from "@shared/schema";
import connectPg from "connect-pg-simple";
import { pool } from "./db";

declare global {
  namespace Express {
    interface User extends SelectUser {}
  }
}

export function setupAuth(app: Express) {
  const PostgresSessionStore = connectPg(session);
  const store = new PostgresSessionStore({
    pool,
    createTableIfMissing: true,
  });

  const sessionSettings: session.SessionOptions = {
    secret: process.env.SESSION_SECRET || "door-designer-secret",
    resave: false,
    saveUninitialized: false,
    store,
    cookie: {
      maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
    },
  };

  if (app.get("env") === "production") {
    app.set("trust proxy", 1);
  }

  app.use(session(sessionSettings));
  app.use(passport.initialize());
  app.use(passport.session());

  passport.use(
    new LocalStrategy(async (username, password, done) => {
      try {
        console.log(`[Auth] Attempting login for user: ${username}`);
        const user = await storage.getUserByUsername(username);
        if (!user) {
          console.warn(`[Auth] Login failed: User '${username}' not found`);
          return done(null, false, { message: "Invalid username or password" });
        }
        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
          console.warn(`[Auth] Login failed: Password mismatch for user '${username}'`);
          return done(null, false, { message: "Invalid username or password" });
        }
        console.log(`[Auth] Successful login for user: ${username}`);
        return done(null, user);
      } catch (err) {
        console.error(`[Auth] Error during authentication:`, err);
        return done(err);
      }
    }),
  );

  passport.serializeUser((user, done) => {
    done(null, user.id);
  });

  passport.deserializeUser(async (id: number, done) => {
    try {
      const user = await storage.getUser(id);
      done(null, user);
    } catch (err) {
      done(err);
    }
  });

  app.post("/api/login", (req, res, next) => {
    passport.authenticate("local", (err, user, info) => {
      if (err) {
        console.error("[Auth API] Passport authentication error:", err);
        return next(err);
      }
      if (!user) {
        return res.status(401).json({ message: info?.message || "Login failed" });
      }
      req.logIn(user, (err) => {
        if (err) {
          console.error("[Auth API] Session login error:", err);
          return next(err);
        }
        const { password, ...userWithoutPassword } = user;
        res.status(200).json(userWithoutPassword);
      });
    })(req, res, next);
  });

  app.post("/api/logout", (req, res, next) => {
    req.logout((err) => {
      if (err) return next(err);
      res.sendStatus(200);
    });
  });

  app.get("/api/user", (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).send("Not authenticated");
    }
    const { password, ...userWithoutPassword } = req.user as SelectUser;
    res.json(userWithoutPassword);
  });

  // Forgot Password
  app.post("/api/forgot-password", async (req, res) => {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ message: "Email is required" });
    }

    try {
      const user = await storage.getUserByEmail(email);
      if (!user) {
        // For security, don't reveal if user exists
        return res.status(200).json({ message: "If an account with that email exists, a reset link has been sent." });
      }

      const resetToken = crypto.randomBytes(32).toString("hex");
      const resetTokenExpiry = new Date(Date.now() + 3600000); // 1 hour

      await storage.updateUser(user.id, {
        resetToken,
        resetTokenExpiry,
      });

      // MOCK EMAIL SENDING
      const resetLink = `${req.protocol}://${req.get("host")}/admin/reset-password?token=${resetToken}`;
      console.log("=========================================");
      console.log("PASSWORD RESET REQUEST");
      console.log(`Email: ${email}`);
      console.log(`Reset Link: ${resetLink}`);
      console.log("=========================================");

      res.status(200).json({ message: "If an account with that email exists, a reset link has been sent." });
    } catch (error: any) {
      console.error("[Auth API] Forgot password error:", error);
      res.status(500).json({ message: "Failed to process request" });
    }
  });

  // Reset Password
  app.post("/api/reset-password", async (req, res) => {
    const { token, password } = req.body;
    if (!token || !password) {
      return res.status(400).json({ message: "Token and password are required" });
    }

    try {
      const user = await storage.getUserByResetToken(token);
      if (!user) {
        return res.status(400).json({ message: "Invalid or expired reset token" });
      }

      const hashedPassword = await bcrypt.hash(password, 10);
      await storage.updateUser(user.id, {
        password: hashedPassword,
        resetToken: null,
        resetTokenExpiry: null,
      });

      res.status(200).json({ message: "Password updated successfully" });
    } catch (error: any) {
      console.error("[Auth API] Reset password error:", error);
      res.status(500).json({ message: "Failed to reset password" });
    }
  });
}

export function isAuthenticated(req: any, res: any, next: any) {
  if (req.isAuthenticated()) {
    return next();
  }
  res.status(401).json({ message: "Unauthorized" });
}
