import { Resend } from 'resend';

import type { PortalAccount } from './portalAccounts';
import { formatServiceType, type ServiceType } from './serviceRequest.ts';

interface BusinessEmailConfig {
  businessName: string;
  emailAddress: string;
}

interface ServiceRequestEmailInput {
  config: BusinessEmailConfig;
  customer: PortalAccount;
  portalLoginEmail: string;
  serviceType: ServiceType;
  description: string;
  additionalInfo: string;
}

export interface ServiceRequestEmail {
  from: string;
  to: string;
  replyTo: string;
  subject: string;
  text: string;
  html: string;
}

export class ServiceRequestEmailConfigurationError extends Error {}

const EMAIL_PATTERN = /^[A-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[A-Z0-9](?:[A-Z0-9-]{0,61}[A-Z0-9])?(?:\.[A-Z0-9](?:[A-Z0-9-]{0,61}[A-Z0-9])?)+$/i;

let resend: Resend | null = null;

function getResend(): Resend {
  if (!process.env.RESEND_API_KEY) {
    throw new ServiceRequestEmailConfigurationError('RESEND_API_KEY is not configured');
  }
  resend ||= new Resend(process.env.RESEND_API_KEY);
  return resend;
}

function normalizeEmail(value: string): string | null {
  const email = value.trim().toLowerCase();
  return email.length <= 254 && EMAIL_PATTERN.test(email) ? email : null;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function cleanHeader(value: string): string {
  return value.replace(/[\r\n]+/g, ' ').trim();
}

function customerName(customer: PortalAccount): string {
  return customer.business_name
    || customer.customer
    || customer.full_name
    || `${customer.first_name || ''} ${customer.last_name || ''}`.trim()
    || 'Portal customer';
}

function customerAddress(customer: PortalAccount): string {
  const address = customer.collection_address || customer.shipping_address || customer.billing_address || '';
  const city = customer.collection_city || customer.shipping_city || customer.billing_city || '';
  const postcode = customer.collection_postcode || customer.shipping_postcode || customer.billing_postcode || '';
  return [address, city, postcode].filter(Boolean).join(', ');
}

function htmlValue(value: string): string {
  return escapeHtml(value).replace(/\n/g, '<br>');
}

export function buildServiceRequestEmail(input: ServiceRequestEmailInput): ServiceRequestEmail {
  const recipient = normalizeEmail(input.config.emailAddress);
  const replyTo = normalizeEmail(input.portalLoginEmail);
  if (!recipient) {
    throw new ServiceRequestEmailConfigurationError('The tenant service email is not configured');
  }
  if (!replyTo) {
    throw new ServiceRequestEmailConfigurationError('The portal login email is invalid');
  }

  const businessName = cleanHeader(input.config.businessName) || 'PaperRoute';
  const name = customerName(input.customer);
  const reference = input.customer.unique_reference?.trim() || 'Unknown';
  const address = customerAddress(input.customer);
  const phone = input.customer.contact_number_1 || input.customer.phone || '';
  const serviceType = formatServiceType(input.serviceType);
  const subject = cleanHeader(`New ${serviceType.toLowerCase()} request – ${name} (${reference})`);
  const details = [
    `Service type: ${serviceType}`,
    `Customer: ${name}`,
    `Reference: ${reference}`,
    `Portal login: ${replyTo}`,
    address ? `Address: ${address}` : '',
    phone ? `Phone: ${phone}` : '',
    '',
    'What is being collected, delivered or exchanged:',
    input.description,
    input.additionalInfo ? `\nAdditional information:\n${input.additionalInfo}` : '',
  ].filter((line) => line !== '').join('\n');

  const row = (label: string, value: string) => `
    <tr>
      <td style="padding:8px 12px;color:#64748b;width:145px;vertical-align:top">${escapeHtml(label)}</td>
      <td style="padding:8px 12px;color:#0f172a;font-weight:600">${htmlValue(value)}</td>
    </tr>`;

  return {
    from: `${businessName} <noreply@saunders-simmons.co.uk>`,
    to: recipient,
    replyTo,
    subject,
    text: details,
    html: `<!doctype html>
<html lang="en">
  <body style="margin:0;background:#f1f5f9;font-family:Arial,sans-serif;color:#0f172a">
    <div style="max-width:640px;margin:0 auto;padding:24px">
      <div style="background:#fff;border-radius:14px;overflow:hidden;border:1px solid #e2e8f0">
        <div style="padding:24px 28px;background:#0f172a;color:#fff">
          <div style="font-size:13px;opacity:.75">Submitted via the customer portal</div>
          <h1 style="font-size:22px;margin:6px 0 0">New ${escapeHtml(serviceType)} Request</h1>
        </div>
        <div style="padding:22px 24px">
          <table role="presentation" style="width:100%;border-collapse:collapse;background:#f8fafc;border-radius:10px">
            ${row('Customer', name)}
            ${row('Reference', reference)}
            ${row('Portal login', replyTo)}
            ${address ? row('Address', address) : ''}
            ${phone ? row('Phone', phone) : ''}
          </table>
          <h2 style="font-size:15px;margin:24px 0 8px">What is being collected, delivered or exchanged?</h2>
          <div style="padding:14px 16px;background:#f8fafc;border-radius:10px;line-height:1.55">${htmlValue(input.description)}</div>
          ${input.additionalInfo ? `
            <h2 style="font-size:15px;margin:24px 0 8px">Additional information</h2>
            <div style="padding:14px 16px;background:#f8fafc;border-radius:10px;line-height:1.55">${htmlValue(input.additionalInfo)}</div>
          ` : ''}
          <p style="font-size:12px;color:#64748b;margin:24px 0 0">Reply to this email to contact the signed-in customer.</p>
        </div>
      </div>
    </div>
  </body>
</html>`,
  };
}

export async function sendServiceRequestEmail(input: ServiceRequestEmailInput): Promise<void> {
  const message = buildServiceRequestEmail(input);
  const { error } = await getResend().emails.send(message);
  if (error) throw new Error(`Could not send the service request email: ${error.message}`);
}
