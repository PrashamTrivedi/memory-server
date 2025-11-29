import { Env } from '../../types';

const EMAIL_API_ENDPOINT = 'https://email-sender.prashamhtrivedi.in/api/send';

interface EmailPayload {
  from: string;
  to: string[];
  subject: string;
  htmlBody?: string;
  textBody?: string;
}

interface SendKeyEmailParams {
  to: string;
  entityName: string;
  apiKey: string;
}

/**
 * Sends an email notification when a new API key is created.
 * This is a fire-and-forget operation - failures are logged but not thrown.
 */
export async function sendKeyCreatedEmail(
  env: Env,
  params: SendKeyEmailParams
): Promise<void> {
  const { to, entityName, apiKey } = params;

  const payload: EmailPayload = {
    from: 'Memory Server <memories@prashamhtrivedi.in>',
    to: [to],
    subject: `New API Key Created: ${entityName}`,
    htmlBody: `
      <html>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: white; padding: 30px; border-radius: 8px 8px 0 0;">
            <h2 style="margin: 0; font-size: 24px;">New API Key Created</h2>
          </div>
          <div style="background: #f9fafb; padding: 30px; border-radius: 0 0 8px 8px; border: 1px solid #e5e7eb;">
            <table style="width: 100%; border-collapse: collapse;">
              <tr>
                <td style="padding: 12px 0; font-weight: 600; color: #374151; width: 140px;">Entity:</td>
                <td style="padding: 12px 0; color: #6b7280;">${entityName}</td>
              </tr>
              <tr>
                <td style="padding: 12px 0; font-weight: 600; color: #374151;">API Key:</td>
                <td style="padding: 12px 0; color: #6b7280; font-family: monospace; word-break: break-all;">${apiKey}</td>
              </tr>
            </table>
            <div style="margin-top: 24px; padding: 16px; background: #fef3c7; border-radius: 8px; border-left: 4px solid #f59e0b;">
              <p style="margin: 0; font-size: 14px; color: #92400e;">
                <strong>Important:</strong> Save this API key securely. It will not be shown again.
              </p>
            </div>
          </div>
        </body>
      </html>
    `,
    textBody: `New API Key Created\n\nEntity: ${entityName}\nAPI Key: ${apiKey}\n\nSave this key securely. It will not be shown again.`,
  };

  try {
    const response = await fetch(EMAIL_API_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': env.EMAIL_API_KEY || '',
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Email API error: ${response.status} - ${errorText}`);
    } else {
      console.log(`Email sent successfully to ${to} for entity: ${entityName}`);
    }
  } catch (error) {
    console.error('Failed to send email notification:', error);
  }
}
