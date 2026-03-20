import { SESClient, SendEmailCommand } from "@aws-sdk/client-ses";

const ses = new SESClient({ region: process.env.AWS_REGION || "eu-west-2" });

/**
 * Sends a password reset email using AWS SES.
 * @param to recipient email address
 * @param resetLink the link containing the reset token
 */
export async function sendPasswordResetEmail(to: string, resetLink: string) {
  const fromEmail = process.env.SES_FROM_EMAIL;
  
  if (!fromEmail) {
    console.warn("[SES] SES_FROM_EMAIL not set. Falling back to console log for reset link.");
    console.log(`[PASS_RESET] Link for ${to}: ${resetLink}`);
    return;
  }

  const params = {
    Destination: {
      ToAddresses: [to],
    },
    Message: {
      Body: {
        Html: {
          Charset: "UTF-8",
          Data: `
            <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eee; border-radius: 10px;">
              <h2 style="color: #333;">Password Reset Request</h2>
              <p>You requested a password reset for your Custom Door Designer admin account.</p>
              <p>Click the button below to reset your password. This link will expire in 1 hour.</p>
              <div style="text-align: center; margin: 30px 0;">
                <a href="${resetLink}" style="background-color: #f59e0b; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; font-weight: bold;">Reset Password</a>
              </div>
              <p style="color: #666; font-size: 12px;">If you did not request this, please ignore this email.</p>
              <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
              <p style="color: #999; font-size: 10px;">Custom Door Designer</p>
            </div>
          `,
        },
        Text: {
          Charset: "UTF-8",
          Data: `Password Reset Request\n\nYou requested a password reset for your Custom Door Designer admin account.\n\nReset Link: ${resetLink}\n\nThis link will expire in 1 hour. If you did not request this, please ignore this email.`,
        },
      },
      Subject: {
        Charset: "UTF-8",
        Data: "Password Reset Request - Custom Door Designer",
      },
    },
    Source: fromEmail,
  };

  try {
    const command = new SendEmailCommand(params);
    await ses.send(command);
    console.log(`[SES] Password reset email sent to ${to}`);
  } catch (error) {
    console.error("[SES] Error sending email:", error);
    throw new Error("Failed to send reset email");
  }
}
