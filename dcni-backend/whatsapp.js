// whatsapp.js
//
// Optional: sends a notification via the official WhatsApp Business
// Platform (Meta Cloud API). Disabled by default — nothing is sent, and
// nothing is faked as sent, until WHATSAPP_ENABLED=true and the other
// WHATSAPP_* variables are filled in .env.
//
// Never automate a personal WhatsApp Web session — only the official
// Business Platform / an approved provider (Meta, Twilio, 360dialog, etc).

const isEnabled = () => String(process.env.WHATSAPP_ENABLED).toLowerCase() === 'true';

async function sendNewRenewalAlert(renewal) {
  if (!isEnabled()) {
    return { sent: false, reason: 'not_configured' };
  }

  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  const token = process.env.WHATSAPP_TOKEN;
  const adminNumber = process.env.WHATSAPP_ADMIN_NUMBER;

  if (!phoneNumberId || !token || !adminNumber) {
    throw new Error('WHATSAPP_ENABLED is true but WHATSAPP_PHONE_NUMBER_ID / WHATSAPP_TOKEN / WHATSAPP_ADMIN_NUMBER are missing in .env');
  }

  const message =
    `New Membership Renewal Received.\n\n` +
    `Pastor: ${renewal.pastor_full_name}\n` +
    `Country: ${renewal.nationality}\n` +
    `Church: ${renewal.church_name}\n` +
    `Reference: ${renewal.registration_reference}\n\n` +
    `The full registration PDF has been sent to the administrator's email.`;

  const response = await fetch(`https://graph.facebook.com/v20.0/${phoneNumberId}/messages`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      to: adminNumber,
      type: 'text',
      text: { body: message },
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`WhatsApp API error (${response.status}): ${errText}`);
  }

  return { sent: true };
}

module.exports = { sendNewRenewalAlert, isEnabled };
