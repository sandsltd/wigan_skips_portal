import { Resend } from 'resend';
import { getBusinessConfig } from './supabase';

let _resend: Resend | null = null;
function getResend() {
  if (!_resend) {
    _resend = new Resend(process.env.RESEND_API_KEY!);
  }
  return _resend;
}

function lightenColor(hex: string, amount: number): string {
  const r = Math.min(255, parseInt(hex.slice(1, 3), 16) + amount);
  const g = Math.min(255, parseInt(hex.slice(3, 5), 16) + amount);
  const b = Math.min(255, parseInt(hex.slice(5, 7), 16) + amount);
  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
}

function darkenColor(hex: string, amount: number): string {
  const r = Math.max(0, parseInt(hex.slice(1, 3), 16) - amount);
  const g = Math.max(0, parseInt(hex.slice(3, 5), 16) - amount);
  const b = Math.max(0, parseInt(hex.slice(5, 7), 16) - amount);
  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
}

export async function sendPinEmail(to: string, pin: string, customerName?: string) {
  const config = await getBusinessConfig();
  const greeting = customerName ? `Hi ${customerName}` : 'Hi there';
  const color = config.primaryColor;
  const colorLight = lightenColor(color, 40);
  const colorFaint = lightenColor(color, 200);
  const colorDark = darkenColor(color, 30);

  // Build individual PIN digit cells
  const pinDigits = pin.split('').map(char =>
    `<td style="padding: 0 3px;">
      <div style="width: 42px; height: 52px; background: ${colorFaint}; border: 2px solid ${colorLight}; border-radius: 10px; text-align: center; line-height: 52px; font-size: 26px; font-weight: 700; color: ${color}; font-family: 'Courier New', Courier, monospace;">
        ${char}
      </div>
    </td>`
  ).join('');

  const logoHtml = config.logoUrl
    ? `<img src="${config.logoUrl}" alt="${config.businessName}" style="max-height: 48px; max-width: 200px; display: block; margin: 0 auto;" />`
    : `<span style="font-size: 22px; font-weight: 700; color: #ffffff; letter-spacing: 0.5px;">${config.businessName}</span>`;

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <!--[if mso]><style>table,td{font-family:Arial,sans-serif!important;}</style><![endif]-->
    </head>
    <body style="margin: 0; padding: 0; background-color: #f0ede8; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif; -webkit-font-smoothing: antialiased;">

      <!-- Outer wrapper -->
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color: #f0ede8;">
        <tr>
          <td align="center" style="padding: 32px 16px;">

            <!-- Main card -->
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width: 480px; background: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 24px rgba(0,0,0,0.08);">

              <!-- Header with gradient -->
              <tr>
                <td style="background: linear-gradient(135deg, ${color} 0%, ${colorDark} 100%); padding: 32px 32px 28px; text-align: center;">
                  <!--[if mso]><v:rect xmlns:v="urn:schemas-microsoft-com:vml" fill="true" style="width:480px;height:100px;"><v:fill type="gradient" color="${color}" color2="${colorDark}" /><v:textbox inset="0,0,0,0"><![endif]-->
                  ${logoHtml}
                  <p style="color: rgba(255,255,255,0.75); margin: 8px 0 0 0; font-size: 13px; font-weight: 500; letter-spacing: 1.5px; text-transform: uppercase;">Customer Portal</p>
                  <!--[if mso]></v:textbox></v:rect><![endif]-->
                </td>
              </tr>

              <!-- Shield icon + heading -->
              <tr>
                <td style="padding: 36px 36px 0; text-align: center;">
                  <!-- Shield icon -->
                  <table role="presentation" cellpadding="0" cellspacing="0" style="margin: 0 auto 20px;">
                    <tr>
                      <td style="width: 56px; height: 56px; background: ${colorFaint}; border-radius: 50%; text-align: center; line-height: 56px;">
                        <img src="https://img.icons8.com/sf-regular-filled/48/${color.replace('#', '')}/lock.png" alt="" width="26" height="26" style="display: inline-block; vertical-align: middle;" />
                      </td>
                    </tr>
                  </table>
                  <h1 style="margin: 0 0 8px; font-size: 22px; font-weight: 700; color: #1a1a1a;">Verification Code</h1>
                  <p style="margin: 0; font-size: 15px; color: #666; line-height: 1.5;">
                    ${greeting}, use the code below to sign in to your portal.
                  </p>
                </td>
              </tr>

              <!-- PIN digits -->
              <tr>
                <td style="padding: 28px 36px 8px; text-align: center;">
                  <table role="presentation" cellpadding="0" cellspacing="0" style="margin: 0 auto;">
                    <tr>
                      ${pinDigits}
                    </tr>
                  </table>
                </td>
              </tr>

              <!-- Expiry badge -->
              <tr>
                <td style="padding: 16px 36px 0; text-align: center;">
                  <table role="presentation" cellpadding="0" cellspacing="0" style="margin: 0 auto;">
                    <tr>
                      <td style="background: #fef3cd; border-radius: 20px; padding: 8px 18px;">
                        <span style="font-size: 13px; color: #856404; font-weight: 600;">&#9200;&nbsp; Expires in 5 minutes</span>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>

              <!-- Security note -->
              <tr>
                <td style="padding: 28px 36px 0; text-align: center;">
                  <p style="margin: 0; font-size: 13px; color: #999; line-height: 1.6;">
                    If you didn&rsquo;t request this code, you can safely ignore this email. Someone may have entered your address by mistake.
                  </p>
                </td>
              </tr>

              <!-- Divider -->
              <tr>
                <td style="padding: 28px 36px 0;">
                  <div style="border-top: 1px solid #eee;"></div>
                </td>
              </tr>

              <!-- Footer with contact info -->
              <tr>
                <td style="padding: 24px 36px 32px; text-align: center;">
                  <p style="margin: 0 0 12px; font-size: 14px; font-weight: 600; color: #333;">Need help?</p>
                  <table role="presentation" cellpadding="0" cellspacing="0" style="margin: 0 auto;">
                    ${config.phoneNumber ? `
                    <tr>
                      <td style="padding: 4px 0;">
                        <a href="tel:${config.phoneNumber.replace(/\s/g, '')}" style="font-size: 13px; color: ${color}; text-decoration: none; font-weight: 500;">&#9742;&nbsp; ${config.phoneNumber}</a>
                      </td>
                    </tr>` : ''}
                    ${config.emailAddress ? `
                    <tr>
                      <td style="padding: 4px 0;">
                        <a href="mailto:${config.emailAddress}" style="font-size: 13px; color: ${color}; text-decoration: none; font-weight: 500;">&#9993;&nbsp; ${config.emailAddress}</a>
                      </td>
                    </tr>` : ''}
                  </table>
                  <p style="margin: 16px 0 0; font-size: 11px; color: #bbb;">
                    &copy; ${new Date().getFullYear()} ${config.businessName} &middot; This is an automated message
                  </p>
                </td>
              </tr>

            </table>

            <!-- Powered by -->
            <table role="presentation" cellpadding="0" cellspacing="0" style="margin: 20px auto 0;">
              <tr>
                <td style="text-align: center;">
                  <a href="https://www.paperroute.co.uk" style="font-size: 11px; color: #bbb; text-decoration: none;">Powered by PaperRoute</a>
                </td>
              </tr>
            </table>

          </td>
        </tr>
      </table>

    </body>
    </html>
  `;

  const text = `
${greeting},

Your verification code to access your ${config.businessName} customer portal is: ${pin}

This code will expire in 5 minutes.

If you didn't request this code, please ignore this email.

Need help?
${config.phoneNumber ? `Phone: ${config.phoneNumber}` : ''}
${config.emailAddress ? `Email: ${config.emailAddress}` : ''}

${config.businessName}
  `.trim();

  await getResend().emails.send({
    from: `${config.businessName} <noreply@saunders-simmons.co.uk>`,
    to: to,
    replyTo: config.emailAddress,
    subject: `${pin} is your ${config.businessName} verification code`,
    text: text,
    html: html,
  });
}

const ITEM_LABELS: Record<string, string> = {
  desktop_computers: 'Desktop Computers',
  laptops: 'Laptops',
  tft_monitors: 'TFT Monitors',
  crt_monitors: 'CRT Monitors',
  servers: 'Servers',
  networking: 'Networking',
  hard_drives: 'Hard Drives',
  data_tapes: 'Data Tapes',
  flat_screen_tvs: 'Flat Screen TVs',
  tablets_mobiles: 'Tablets & Mobiles',
  office_phones: 'Office Phones',
  ups_batteries: 'UPS Batteries',
  printers_domestic: 'Printers (Domestic)',
  printers_commercial: 'Printers (Commercial)',
  toner_cartridges: 'Toner Cartridges',
};

interface CollectionRequestData {
  customer: {
    name: string;
    firstName?: string;
    lastName?: string;
    businessName?: string;
    email: string;
    phone?: string;
    reference: string;
    collectionAddress?: string;
    collectionCity?: string;
    collectionPostcode?: string;
  };
  items: Record<string, number>;
  additionalInfo: string;
}

export async function sendCollectionRequestEmail(data: CollectionRequestData) {
  const config = await getBusinessConfig();
  const { customer, items, additionalInfo } = data;
  const color = config.primaryColor;
  const colorLight = lightenColor(color, 40);
  const colorDark = darkenColor(color, 30);
  const colorFaint = lightenColor(color, 200);

  const collectionAddress = [
    customer.collectionAddress,
    customer.collectionCity,
    customer.collectionPostcode,
  ].filter(Boolean).join(', ');

  // Build items table rows (only items with qty > 0)
  const itemRows = Object.entries(items)
    .filter(([, qty]) => qty > 0)
    .map(([key, qty]) => {
      const label = ITEM_LABELS[key] || key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
      return `<tr>
        <td style="padding: 8px 12px; border-bottom: 1px solid #eee; font-size: 14px; color: #333;">${label}</td>
        <td style="padding: 8px 12px; border-bottom: 1px solid #eee; font-size: 14px; color: #333; text-align: center; font-weight: 600;">${qty}</td>
      </tr>`;
    })
    .join('');

  const logoHtml = config.logoUrl
    ? `<img src="${config.logoUrl}" alt="${config.businessName}" style="max-height: 48px; max-width: 200px; display: block; margin: 0 auto;" />`
    : `<span style="font-size: 22px; font-weight: 700; color: #ffffff; letter-spacing: 0.5px;">${config.businessName}</span>`;

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <!--[if mso]><style>table,td{font-family:Arial,sans-serif!important;}</style><![endif]-->
    </head>
    <body style="margin: 0; padding: 0; background-color: #f0ede8; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif; -webkit-font-smoothing: antialiased;">

      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color: #f0ede8;">
        <tr>
          <td align="center" style="padding: 32px 16px;">

            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width: 560px; background: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 24px rgba(0,0,0,0.08);">

              <!-- Header -->
              <tr>
                <td style="background: linear-gradient(135deg, ${color} 0%, ${colorDark} 100%); padding: 32px 32px 28px; text-align: center;">
                  ${logoHtml}
                  <p style="color: rgba(255,255,255,0.75); margin: 8px 0 0 0; font-size: 13px; font-weight: 500; letter-spacing: 1.5px; text-transform: uppercase;">Collection Request</p>
                </td>
              </tr>

              <!-- Heading -->
              <tr>
                <td style="padding: 28px 32px 0; text-align: center;">
                  <table role="presentation" cellpadding="0" cellspacing="0" style="margin: 0 auto 16px;">
                    <tr>
                      <td style="width: 56px; height: 56px; background: ${colorFaint}; border-radius: 50%; text-align: center; line-height: 56px;">
                        <img src="https://img.icons8.com/sf-regular-filled/48/${color.replace('#', '')}/truck.png" alt="" width="26" height="26" style="display: inline-block; vertical-align: middle;" />
                      </td>
                    </tr>
                  </table>
                  <h1 style="margin: 0 0 4px; font-size: 20px; font-weight: 700; color: #1a1a1a;">New Collection Request</h1>
                  <p style="margin: 0; font-size: 14px; color: #666;">Submitted via the customer portal</p>
                </td>
              </tr>

              <!-- Customer Details -->
              <tr>
                <td style="padding: 24px 32px 0;">
                  <h2 style="margin: 0 0 12px; font-size: 13px; font-weight: 600; color: #999; text-transform: uppercase; letter-spacing: 1px;">Customer Details</h2>
                  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background: #f9f9f7; border-radius: 12px; overflow: hidden;">
                    <tr>
                      <td style="padding: 14px 16px; border-bottom: 1px solid #eee; font-size: 13px; color: #999; width: 120px;">Name</td>
                      <td style="padding: 14px 16px; border-bottom: 1px solid #eee; font-size: 14px; color: #333; font-weight: 500;">${customer.name}</td>
                    </tr>
                    ${customer.businessName ? `<tr>
                      <td style="padding: 14px 16px; border-bottom: 1px solid #eee; font-size: 13px; color: #999;">Business</td>
                      <td style="padding: 14px 16px; border-bottom: 1px solid #eee; font-size: 14px; color: #333; font-weight: 500;">${customer.businessName}</td>
                    </tr>` : ''}
                    <tr>
                      <td style="padding: 14px 16px; border-bottom: 1px solid #eee; font-size: 13px; color: #999;">Reference</td>
                      <td style="padding: 14px 16px; border-bottom: 1px solid #eee; font-size: 14px; color: #333; font-weight: 500;">${customer.reference}</td>
                    </tr>
                    <tr>
                      <td style="padding: 14px 16px; border-bottom: 1px solid #eee; font-size: 13px; color: #999;">Email</td>
                      <td style="padding: 14px 16px; border-bottom: 1px solid #eee; font-size: 14px; color: #333; font-weight: 500;">${customer.email}</td>
                    </tr>
                    ${customer.phone ? `<tr>
                      <td style="padding: 14px 16px; border-bottom: 1px solid #eee; font-size: 13px; color: #999;">Phone</td>
                      <td style="padding: 14px 16px; border-bottom: 1px solid #eee; font-size: 14px; color: #333; font-weight: 500;">${customer.phone}</td>
                    </tr>` : ''}
                    ${collectionAddress ? `<tr>
                      <td style="padding: 14px 16px; font-size: 13px; color: #999;">Collection Address</td>
                      <td style="padding: 14px 16px; font-size: 14px; color: #333; font-weight: 500;">${collectionAddress}</td>
                    </tr>` : ''}
                  </table>
                </td>
              </tr>

              <!-- Items Table -->
              <tr>
                <td style="padding: 24px 32px 0;">
                  <h2 style="margin: 0 0 12px; font-size: 13px; font-weight: 600; color: #999; text-transform: uppercase; letter-spacing: 1px;">Items for Collection</h2>
                  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background: #f9f9f7; border-radius: 12px; overflow: hidden;">
                    <tr>
                      <td style="padding: 10px 12px; background: ${colorFaint}; font-size: 12px; font-weight: 600; color: ${color}; text-transform: uppercase; letter-spacing: 0.5px;">Item</td>
                      <td style="padding: 10px 12px; background: ${colorFaint}; font-size: 12px; font-weight: 600; color: ${color}; text-transform: uppercase; letter-spacing: 0.5px; text-align: center; width: 80px;">Qty</td>
                    </tr>
                    ${itemRows}
                  </table>
                </td>
              </tr>

              ${additionalInfo ? `
              <!-- Additional Information -->
              <tr>
                <td style="padding: 24px 32px 0;">
                  <h2 style="margin: 0 0 12px; font-size: 13px; font-weight: 600; color: #999; text-transform: uppercase; letter-spacing: 1px;">Additional Information</h2>
                  <div style="background: #f9f9f7; border-radius: 12px; padding: 14px 16px;">
                    <p style="margin: 0; font-size: 14px; color: #333; line-height: 1.6; white-space: pre-wrap;">${additionalInfo}</p>
                  </div>
                </td>
              </tr>` : ''}

              <!-- Divider -->
              <tr>
                <td style="padding: 28px 32px 0;">
                  <div style="border-top: 1px solid #eee;"></div>
                </td>
              </tr>

              <!-- Footer -->
              <tr>
                <td style="padding: 20px 32px 28px; text-align: center;">
                  <p style="margin: 0; font-size: 11px; color: #bbb;">
                    &copy; ${new Date().getFullYear()} ${config.businessName} &middot; Collection request submitted via customer portal
                  </p>
                </td>
              </tr>

            </table>

            <table role="presentation" cellpadding="0" cellspacing="0" style="margin: 20px auto 0;">
              <tr>
                <td style="text-align: center;">
                  <a href="https://www.paperroute.co.uk" style="font-size: 11px; color: #bbb; text-decoration: none;">Powered by PaperRoute</a>
                </td>
              </tr>
            </table>

          </td>
        </tr>
      </table>

    </body>
    </html>
  `;

  // Plain text fallback
  const itemLines = Object.entries(items)
    .filter(([, qty]) => qty > 0)
    .map(([key, qty]) => {
      const label = ITEM_LABELS[key] || key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
      return `  - ${label}: ${qty}`;
    })
    .join('\n');

  const text = `
NEW COLLECTION REQUEST

Customer Details:
  Name: ${customer.name}${customer.businessName ? `\n  Business: ${customer.businessName}` : ''}
  Reference: ${customer.reference}
  Email: ${customer.email}${customer.phone ? `\n  Phone: ${customer.phone}` : ''}${collectionAddress ? `\n  Collection Address: ${collectionAddress}` : ''}

Items for Collection:
${itemLines}
${additionalInfo ? `\nAdditional Information:\n  ${additionalInfo}` : ''}

---
Submitted via ${config.businessName} customer portal
  `.trim();

  // Customer confirmation email
  const customerName = customer.firstName || customer.name.split(' ')[0];

  const customerHtml = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <!--[if mso]><style>table,td{font-family:Arial,sans-serif!important;}</style><![endif]-->
    </head>
    <body style="margin: 0; padding: 0; background-color: #f0ede8; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif; -webkit-font-smoothing: antialiased;">

      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color: #f0ede8;">
        <tr>
          <td align="center" style="padding: 32px 16px;">

            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width: 560px; background: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 24px rgba(0,0,0,0.08);">

              <!-- Header -->
              <tr>
                <td style="background: linear-gradient(135deg, ${color} 0%, ${colorDark} 100%); padding: 32px 32px 28px; text-align: center;">
                  ${logoHtml}
                  <p style="color: rgba(255,255,255,0.75); margin: 8px 0 0 0; font-size: 13px; font-weight: 500; letter-spacing: 1.5px; text-transform: uppercase;">Collection Request</p>
                </td>
              </tr>

              <!-- Confirmation message -->
              <tr>
                <td style="padding: 32px 32px 0; text-align: center;">
                  <table role="presentation" cellpadding="0" cellspacing="0" style="margin: 0 auto 20px;">
                    <tr>
                      <td style="width: 56px; height: 56px; background: #ecfdf5; border-radius: 50%; text-align: center; line-height: 56px;">
                        <img src="https://img.icons8.com/sf-regular-filled/48/22c55e/checkmark.png" alt="" width="26" height="26" style="display: inline-block; vertical-align: middle;" />
                      </td>
                    </tr>
                  </table>
                  <h1 style="margin: 0 0 8px; font-size: 22px; font-weight: 700; color: #1a1a1a;">Request Received</h1>
                  <p style="margin: 0; font-size: 15px; color: #666; line-height: 1.6;">
                    Hi ${customerName}, thank you for submitting your collection request. We&rsquo;ll review the details and be in touch to confirm a convenient collection date.
                  </p>
                </td>
              </tr>

              <!-- Items summary -->
              <tr>
                <td style="padding: 28px 32px 0;">
                  <h2 style="margin: 0 0 12px; font-size: 13px; font-weight: 600; color: #999; text-transform: uppercase; letter-spacing: 1px;">Your Items</h2>
                  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background: #f9f9f7; border-radius: 12px; overflow: hidden;">
                    <tr>
                      <td style="padding: 10px 12px; background: ${colorFaint}; font-size: 12px; font-weight: 600; color: ${color}; text-transform: uppercase; letter-spacing: 0.5px;">Item</td>
                      <td style="padding: 10px 12px; background: ${colorFaint}; font-size: 12px; font-weight: 600; color: ${color}; text-transform: uppercase; letter-spacing: 0.5px; text-align: center; width: 80px;">Qty</td>
                    </tr>
                    ${itemRows}
                  </table>
                </td>
              </tr>

              ${collectionAddress ? `
              <!-- Collection address -->
              <tr>
                <td style="padding: 24px 32px 0;">
                  <h2 style="margin: 0 0 12px; font-size: 13px; font-weight: 600; color: #999; text-transform: uppercase; letter-spacing: 1px;">Collection Address</h2>
                  <div style="background: #f9f9f7; border-radius: 12px; padding: 14px 16px;">
                    <p style="margin: 0; font-size: 14px; color: #333;">${collectionAddress}</p>
                  </div>
                </td>
              </tr>` : ''}

              <!-- Note -->
              <tr>
                <td style="padding: 24px 32px 0; text-align: center;">
                  <table role="presentation" cellpadding="0" cellspacing="0" style="margin: 0 auto;">
                    <tr>
                      <td style="background: #fef3cd; border-radius: 20px; padding: 8px 18px;">
                        <span style="font-size: 13px; color: #856404; font-weight: 600;">&#9888;&nbsp; This is a request, not a confirmed booking</span>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>

              <!-- Divider -->
              <tr>
                <td style="padding: 28px 32px 0;">
                  <div style="border-top: 1px solid #eee;"></div>
                </td>
              </tr>

              <!-- Footer with contact info -->
              <tr>
                <td style="padding: 24px 32px 28px; text-align: center;">
                  <p style="margin: 0 0 12px; font-size: 14px; font-weight: 600; color: #333;">Questions?</p>
                  <table role="presentation" cellpadding="0" cellspacing="0" style="margin: 0 auto;">
                    ${config.phoneNumber ? `
                    <tr>
                      <td style="padding: 4px 0;">
                        <a href="tel:${config.phoneNumber.replace(/\s/g, '')}" style="font-size: 13px; color: ${color}; text-decoration: none; font-weight: 500;">&#9742;&nbsp; ${config.phoneNumber}</a>
                      </td>
                    </tr>` : ''}
                    ${config.emailAddress ? `
                    <tr>
                      <td style="padding: 4px 0;">
                        <a href="mailto:${config.emailAddress}" style="font-size: 13px; color: ${color}; text-decoration: none; font-weight: 500;">&#9993;&nbsp; ${config.emailAddress}</a>
                      </td>
                    </tr>` : ''}
                  </table>
                  <p style="margin: 16px 0 0; font-size: 11px; color: #bbb;">
                    &copy; ${new Date().getFullYear()} ${config.businessName} &middot; This is an automated message
                  </p>
                </td>
              </tr>

            </table>

            <table role="presentation" cellpadding="0" cellspacing="0" style="margin: 20px auto 0;">
              <tr>
                <td style="text-align: center;">
                  <a href="https://www.paperroute.co.uk" style="font-size: 11px; color: #bbb; text-decoration: none;">Powered by PaperRoute</a>
                </td>
              </tr>
            </table>

          </td>
        </tr>
      </table>

    </body>
    </html>
  `;

  const customerText = `
Hi ${customerName},

Thank you for submitting your collection request. We'll review the details and be in touch to confirm a convenient collection date.

Items requested:
${itemLines}
${collectionAddress ? `\nCollection Address: ${collectionAddress}` : ''}

Please note: This is a request, not a confirmed booking.

Questions?
${config.phoneNumber ? `Phone: ${config.phoneNumber}` : ''}
${config.emailAddress ? `Email: ${config.emailAddress}` : ''}

${config.businessName}
  `.trim();

  // Send all emails in parallel via Resend
  await Promise.all([
    // Email to business
    getResend().emails.send({
      from: `${config.businessName} <noreply@saunders-simmons.co.uk>`,
      to: config.emailAddress,
      subject: `Collection Request - ${customer.businessName || customer.name} (${customer.reference})`,
      text: text,
      html: html,
      replyTo: customer.email,
    }),
    // Confirmation email to customer
    getResend().emails.send({
      from: `${config.businessName} <noreply@saunders-simmons.co.uk>`,
      to: customer.email,
      replyTo: config.emailAddress,
      subject: `Your Collection Request - ${config.businessName}`,
      text: customerText,
      html: customerHtml,
    }),
  ]);
}

export function generatePin(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let pin = '';

  const crypto = require('crypto');
  const randomBytes = crypto.randomBytes(6);

  for (let i = 0; i < 6; i++) {
    pin += chars.charAt(randomBytes[i] % chars.length);
  }
  return pin;
}
