/**
 * Phone Number Utilities
 * Provides E.164 normalization for Twilio Voice and SMS delivery.
 */

export function normalizePhoneNumber(rawPhone, defaultCountryCode = '+91') {
  if (!rawPhone || typeof rawPhone !== 'string') return '';

  // Remove any whitespace, hyphens, brackets, dots
  let cleaned = rawPhone.trim().replace(/[\s\-\(\)\.]/g, '');

  if (cleaned.startsWith('+')) {
    // Already has country code prefix
    return cleaned;
  }

  // Remove leading 0 if 11 digits (e.g., 09928596221 -> 9928596221)
  if (cleaned.startsWith('0') && cleaned.length === 11) {
    cleaned = cleaned.substring(1);
  }

  // If starts with 91 and has 12 digits (e.g., 919928596221 -> +919928596221)
  if (cleaned.startsWith('91') && cleaned.length === 12) {
    return `+${cleaned}`;
  }

  // If standard 10-digit mobile number (e.g., 9928596221, 6296504870)
  if (cleaned.length === 10) {
    const prefix = defaultCountryCode.startsWith('+') ? defaultCountryCode : `+${defaultCountryCode}`;
    return `${prefix}${cleaned}`;
  }

  // Default fallback: prepend default country code if missing '+'
  const prefix = defaultCountryCode.startsWith('+') ? defaultCountryCode : `+${defaultCountryCode}`;
  return `${prefix}${cleaned}`;
}

export function maskPhoneNumber(phone) {
  try {
    if (!phone) return '******';
    const cleaned = String(phone).trim();
    if (cleaned.length <= 4) return '******';
    return `***${cleaned.slice(-4)}`;
  } catch {
    return '******';
  }
}

export default { normalizePhoneNumber, maskPhoneNumber };
