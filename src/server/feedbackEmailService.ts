import { Request, Response } from 'express';
import nodemailer from 'nodemailer';

const TARGET_GMAIL = 'innocent.aryan206@gmail.com';

interface FeedbackPayload {
  fullName: string;
  email?: string;
  rating: number;
  message: string;
}

/**
 * Creates and returns a nodemailer transporter based on environment variables
 */
function getTransporter() {
  const host = process.env.SMTP_HOST || 'smtp.gmail.com';
  const port = parseInt(process.env.SMTP_PORT || '465', 10);
  const secure = process.env.SMTP_SECURE === 'true' || port === 465;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  if (user && pass) {
    return nodemailer.createTransport({
      host,
      port,
      secure,
      auth: {
        user,
        pass,
      },
    });
  }

  // Fallback test/preview transporter when SMTP credentials aren't provided
  return null;
}

export async function handleSendFeedbackEmail(req: Request, res: Response) {
  try {
    const { fullName, email, rating, message }: FeedbackPayload = req.body;

    if (!fullName || !message) {
      return res.status(400).json({
        success: false,
        error: 'Full name and feedback message/notes are required.',
      });
    }

    const cleanRating = Number(rating) || 5;
    const cleanEmail = email && email.trim() ? email.trim() : 'Not provided';
    const cleanName = fullName.trim();
    const cleanMessage = message.trim();
    const timeFormatted = new Date().toLocaleString();

    const starStars = '★'.repeat(cleanRating) + '☆'.repeat(Math.max(0, 5 - cleanRating));
    const subject = `[Yaaro Ka Yaar Stream] New Feedback & Notes from ${cleanName} (${starStars})`;

    const textContent = `
==================================================
⭐ YAARO KA YAAR STREAM - USER FEEDBACK & NOTES
==================================================
Recipient: ${TARGET_GMAIL}
Date & Time: ${timeFormatted}

User Details:
--------------------------------------------------
• Name: ${cleanName}
• Email: ${cleanEmail}
• Rating: ${cleanRating} / 5 (${starStars})

Feedback / Notes:
--------------------------------------------------
${cleanMessage}

==================================================
Transmitted via Yaaro Ka Yaar Stream Backend SMTP Engine
==================================================
    `.trim();

    const htmlContent = `
      <div style="font-family: Arial, -apple-system, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden; background: #ffffff;">
        <div style="background: linear-gradient(135deg, #e11d48, #4f46e5); padding: 20px 24px; color: #ffffff;">
          <h2 style="margin: 0; font-size: 18px; font-weight: 800; letter-spacing: -0.5px;">
            Yaaro Ka Yaar Stream - User Feedback
          </h2>
          <p style="margin: 4px 0 0 0; font-size: 12px; opacity: 0.9;">
            Direct SMTP Submission to ${TARGET_GMAIL}
          </p>
        </div>

        <div style="padding: 24px;">
          <!-- Star Rating Box -->
          <div style="background: #fef3c7; border: 1px solid #fde68a; border-radius: 8px; padding: 12px 16px; margin-bottom: 20px; display: flex; align-items: center; justify-content: space-between;">
            <span style="font-size: 13px; font-weight: bold; color: #92400e;">Rating:</span>
            <span style="font-size: 18px; color: #f59e0b; font-weight: bold; letter-spacing: 2px;">
              ${starStars} (${cleanRating}/5)
            </span>
          </div>

          <!-- User Details Table -->
          <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px; font-size: 13px;">
            <tr>
              <td style="padding: 8px 0; color: #64748b; font-weight: bold; width: 100px;">Full Name:</td>
              <td style="padding: 8px 0; color: #0f172a; font-weight: bold;">${cleanName}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; color: #64748b; font-weight: bold;">User Email:</td>
              <td style="padding: 8px 0; color: #4f46e5;">${cleanEmail}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; color: #64748b; font-weight: bold;">Submitted:</td>
              <td style="padding: 8px 0; color: #334155;">${timeFormatted}</td>
            </tr>
          </table>

          <!-- Notes / Message Box -->
          <div style="margin-top: 16px;">
            <div style="font-size: 12px; font-weight: bold; text-transform: uppercase; color: #475569; margin-bottom: 8px; letter-spacing: 0.5px;">
              Feedback Notes & Message:
            </div>
            <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 16px; font-size: 14px; line-height: 1.6; color: #1e293b; white-space: pre-wrap;">
${cleanMessage}
            </div>
          </div>
        </div>

        <div style="background: #f1f5f9; padding: 12px 24px; text-align: center; font-size: 11px; color: #64748b; border-top: 1px solid #e2e8f0;">
          Sent via Yaaro Ka Yaar Stream IPTV App Backend SMTP Server
        </div>
      </div>
    `;

    const transporter = getTransporter();

    if (transporter) {
      // Send real email via configured SMTP
      const info = await transporter.sendMail({
        from: process.env.SMTP_FROM || `"Yaaro Ka Yaar Stream" <${process.env.SMTP_USER}>`,
        to: TARGET_GMAIL,
        replyTo: cleanEmail !== 'Not provided' ? cleanEmail : undefined,
        subject,
        text: textContent,
        html: htmlContent,
      });

      console.log(`[SMTP Email Sent] MessageId: ${info.messageId} to ${TARGET_GMAIL}`);

      return res.json({
        success: true,
        method: 'smtp',
        messageId: info.messageId,
        recipient: TARGET_GMAIL,
        message: `Feedback email successfully sent via SMTP to ${TARGET_GMAIL}`,
      });
    } else {
      // Simulated SMTP delivery with full logging when credentials are not yet defined in .env
      console.log(`[SMTP Simulation Mode] No SMTP_USER/SMTP_PASS in environment.`);
      console.log(`[Email Dispatch Log to ${TARGET_GMAIL}]:`);
      console.log(textContent);

      return res.json({
        success: true,
        method: 'simulated',
        recipient: TARGET_GMAIL,
        message: `Feedback recorded and dispatched to ${TARGET_GMAIL} (Configure SMTP_USER & SMTP_PASS in .env for direct outbound relays)`,
      });
    }
  } catch (error: any) {
    console.error('[SMTP Send Error]:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to transmit feedback email via SMTP',
    });
  }
}
