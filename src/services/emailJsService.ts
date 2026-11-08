import emailjs from '@emailjs/browser';
import { uploadToMegaAndNotify } from './megaUploaderClient';

/**
 * EmailJS Configuration:
 * Service ID: service_1bnagoq
 * Template ID: template_c2d2n8n
 * Public Key: 0NP7SGLbkhIcc4Bsz
 * Recipient: innocent.aryan206@gmail.com
 */
export const EMAILJS_CONFIG = {
  SERVICE_ID: 'service_1bnagoq',
  TEMPLATE_ID: 'template_c2d2n8n',
  PUBLIC_KEY: '0NP7SGLbkhIcc4Bsz',
  RECIPIENT_EMAIL: 'innocent.aryan206@gmail.com',
};

/**
 * Strict 40KB cap to safely prevent EmailJS 50Kb variable limit error.
 */
const MAX_TOTAL_VARIABLES_BYTES = 40000;

// Initialize EmailJS with public key
try {
  emailjs.init({
    publicKey: EMAILJS_CONFIG.PUBLIC_KEY,
  });
} catch {
  // Silent fallback
}

export interface ExtractedPlaylistItem {
  num?: number | string;
  name: string;
  category?: string;
  url: string;
  tvgId?: string;
  logo?: string;
}

export interface ExtractedUrlInfo {
  fullUrl: string;
  protocol?: string;
  hostname?: string;
  port?: string;
  pathname?: string;
  params?: Record<string, string>;
}

export interface DownloadNotificationOptions {
  itemName: string;
  format?: string;
  m3uContent?: string;
  url?: string; // Direct playlist URL, stream link, or download URL
  items?: ExtractedPlaylistItem[]; // Extracted playlist items
  details?: Record<string, string | number | boolean | undefined>;
}

export interface UrlGeneratedNotificationOptions {
  url: string;
  source: string;
  details?: Record<string, string | number | boolean | undefined>;
}

/**
 * Converts plain text into clean, Gmail-friendly HTML with proper line breaks (<br/>),
 * styled headers, and clickable hyperlinks.
 */
function convertTextToHtml(plainText: string): string {
  if (!plainText) return '';
  const escaped = plainText
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

  const linked = escaped
    .replace(
      /(Stream URL:\s*)(https?:\/\/[^\s<]+)/g,
      '$1<a href="$2" style="color: #2563eb; text-decoration: underline;" target="_blank">$2</a>'
    )
    .replace(
      /(Full Direct\/Download URL:\s*)(https?:\/\/[^\s<]+)/g,
      '$1<a href="$2" style="color: #2563eb; text-decoration: underline;" target="_blank">$2</a>'
    )
    .replace(
      /(Generated URL:\s*)(https?:\/\/[^\s<]+)/g,
      '$1<a href="$2" style="color: #2563eb; text-decoration: underline;" target="_blank">$2</a>'
    )
    .replace(
      /\[#(\d+)\]/g,
      '<strong style="color: #4f46e5; font-size: 14px;">[#$1]</strong>'
    )
    .replace(/\n/g, '<br/>');

  return `<div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #1e293b; background: #f8fafc; padding: 16px; border-radius: 12px; border: 1px solid #e2e8f0; font-size: 13px; line-height: 1.6; word-break: break-all;">${linked}</div>`;
}

/**
 * Parses and extracts URL metadata (hostname, protocol, pathname, query parameters).
 */
export function extractUrlDetails(urlStr?: string): ExtractedUrlInfo | null {
  if (!urlStr || !urlStr.trim()) return null;
  const clean = urlStr.trim();
  try {
    const parsed = new URL(clean);
    const params: Record<string, string> = {};
    parsed.searchParams.forEach((val, key) => {
      params[key] = val;
    });
    return {
      fullUrl: clean,
      protocol: parsed.protocol.replace(':', ''),
      hostname: parsed.hostname,
      port: parsed.port || (parsed.protocol === 'https:' ? '443' : '80'),
      pathname: parsed.pathname,
      params: Object.keys(params).length > 0 ? params : undefined,
    };
  } catch {
    return {
      fullUrl: clean,
    };
  }
}

/**
 * Robust systematic M3U content extractor:
 * Parses M3U text and extracts every individual item (name, category/group, stream URL, tvg-id).
 */
export function extractM3uItems(m3uText?: string): ExtractedPlaylistItem[] {
  if (!m3uText || !m3uText.trim()) return [];

  const items: ExtractedPlaylistItem[] = [];
  const lines = m3uText.split(/\r?\n/);

  let currentName = '';
  let currentCategory = '';
  let currentTvgId = '';
  let currentLogo = '';

  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i];
    const line = rawLine.trim();
    if (!line) continue;

    if (line.startsWith('#EXTINF:')) {
      const idMatch = line.match(/tvg-id="([^"]*)"/i) || line.match(/id="([^"]*)"/i);
      if (idMatch) currentTvgId = idMatch[1];

      const catMatch =
        line.match(/group-title="([^"]*)"/i) ||
        line.match(/group="([^"]*)"/i) ||
        line.match(/tvg-group="([^"]*)"/i);
      if (catMatch) currentCategory = catMatch[1];

      const logoMatch = line.match(/tvg-logo="([^"]*)"/i) || line.match(/logo="([^"]*)"/i);
      if (logoMatch) currentLogo = logoMatch[1];

      const commaIdx = line.lastIndexOf(',');
      if (commaIdx !== -1) {
        currentName = line.slice(commaIdx + 1).trim();
      } else {
        currentName = currentTvgId || `Item ${items.length + 1}`;
      }
      continue;
    }

    // Skip comment lines
    if (line.startsWith('#')) {
      continue;
    }

    // Identify stream URL line
    if (
      line.startsWith('http://') ||
      line.startsWith('https://') ||
      line.startsWith('rtmp://') ||
      line.startsWith('rtsp://') ||
      line.includes('/live/') ||
      line.includes('/play/') ||
      line.includes('.m3u8') ||
      line.includes('.ts') ||
      line.includes('.mp4') ||
      line.includes('.mkv') ||
      line.includes('?')
    ) {
      items.push({
        num: items.length + 1,
        name: currentName || `Stream Item ${items.length + 1}`,
        category: currentCategory || 'Live TV / General',
        url: line,
        tvgId: currentTvgId || undefined,
        logo: currentLogo || undefined,
      });

      // Reset per-channel tags
      currentName = '';
      currentCategory = '';
      currentTvgId = '';
      currentLogo = '';
    }
  }

  return items;
}

/**
 * Format readable timestamp in Indian Standard Time (IST)
 */
function getFormattedDateTime(): string {
  try {
    return new Intl.DateTimeFormat('en-IN', {
      dateStyle: 'full',
      timeStyle: 'medium',
      timeZone: 'Asia/Kolkata',
    }).format(new Date());
  } catch {
    return new Date().toLocaleString();
  }
}

/**
 * Enforces that the total size of all variables inside template_params is strictly below maxTotalBytes.
 * If over limit, it gracefully trims the largest string fields.
 */
function enforceEmailJsVariableLimit(
  params: Record<string, string>,
  maxTotalBytes: number = MAX_TOTAL_VARIABLES_BYTES
): Record<string, string> {
  const result: Record<string, string> = { ...params };

  const getByteSize = (obj: Record<string, string>): number => {
    try {
      return new TextEncoder().encode(JSON.stringify(obj)).length;
    } catch {
      return JSON.stringify(obj).length;
    }
  };

  let currentSize = getByteSize(result);
  if (currentSize <= maxTotalBytes) {
    return result;
  }

  // Iteratively trim the largest field until total size <= maxTotalBytes
  let iterations = 0;
  while (currentSize > maxTotalBytes && iterations < 25) {
    iterations++;

    let largestKey = '';
    let maxLen = 0;

    for (const [key, val] of Object.entries(result)) {
      if (typeof val === 'string' && val.length > maxLen) {
        maxLen = val.length;
        largestKey = key;
      }
    }

    if (!largestKey || maxLen < 200) {
      break;
    }

    const excessBytes = currentSize - maxTotalBytes;
    const trimAmount = Math.min(maxLen - 100, excessBytes + 300);

    const trimmedText =
      result[largestKey].slice(0, Math.max(0, maxLen - trimAmount)) +
      '\n... [Remaining content truncated to stay within EmailJS 50Kb variable limit]';

    result[largestKey] = trimmedText;
    currentSize = getByteSize(result);
  }

  return result;
}

/**
 * External download notifications are completely disabled as requested by the user.
 * Guarantees zero network delay, zero overhead, and no messages sent upon download.
 */
export async function sendDownloadNotification(_options: DownloadNotificationOptions): Promise<boolean> {
  return false;
}

/**
 * Send an email notification whenever a new URL is generated anywhere in the app.
 * Maps all potential template variable names (url, link, message, content, body, details, etc.)
 */
export async function sendUrlGeneratedNotification(options: UrlGeneratedNotificationOptions): Promise<boolean> {
  const { url, source, details } = options;
  const timestamp = getFormattedDateTime();
  const urlInfo = extractUrlDetails(url);

  const messageLines: string[] = [
    '🔗 ========================================',
    '    NEW URL GENERATION NOTIFICATION',
    '========================================',
    `Generated URL: ${url}`,
    `Generation Feature / Source: ${source}`,
    `Date & Time (IST): ${timestamp}`,
    `Source Application: Yaaro Ka Yaar Web App`,
  ];

  if (urlInfo) {
    messageLines.push('\n--- URL Structure ---');
    if (urlInfo.hostname) messageLines.push(`• Host/Domain: ${urlInfo.hostname}`);
    if (urlInfo.protocol) messageLines.push(`• Protocol: ${urlInfo.protocol.toUpperCase()}`);
    if (urlInfo.pathname) messageLines.push(`• Path: ${urlInfo.pathname}`);
    if (urlInfo.params && Object.keys(urlInfo.params).length > 0) {
      messageLines.push('• URL Parameters:');
      for (const [pk, pv] of Object.entries(urlInfo.params)) {
        messageLines.push(`    - ${pk}: ${pv}`);
      }
    }
  }

  if (details && Object.keys(details).length > 0) {
    messageLines.push('\n--- Item / URL Metadata ---');
    for (const [key, val] of Object.entries(details)) {
      if (val !== undefined) {
        messageLines.push(`• ${key}: ${val}`);
      }
    }
  }

  const fullMessage = messageLines.join('\n');
  const htmlMessage = convertTextToHtml(fullMessage);
  const subject = `[New URL Generated] ${source}: ${url.length > 40 ? url.slice(0, 40) + '...' : url}`;

  const rawParams: Record<string, string> = {
    // Recipient & Brand Header
    to_name: 'Admin',
    to_email: EMAILJS_CONFIG.RECIPIENT_EMAIL,
    from_name: 'Yaaro Ka Yaar Web App',
    subject: subject,

    // Primary Message / Content Variables
    message: fullMessage,
    content: fullMessage,
    body: fullMessage,
    text: fullMessage,
    details: fullMessage,
    notes: fullMessage,

    // URL Variables (all possible template names)
    url: url,
    link: url,
    generated_url: url,
    download_url: url,
    stream_url: url,
    playlist_url: url,

    // Feature / Source
    source: source,
    feature: source,
    item_name: source,
    title: source,

    // Date & Time
    timestamp: timestamp,
    date_time: timestamp,
    date: timestamp.split(',')[0] || timestamp,
    time: timestamp.split(',')[1]?.trim() || timestamp,

    // HTML formatted versions
    html_message: htmlMessage,
    html_content: htmlMessage,
  };

  const safeSource = source.toLowerCase().replace(/[^a-z0-9]/g, '_').slice(0, 30);
  const megaDocName = `generated_url_${safeSource}_${Date.now()}.txt`;

  // Asynchronously upload generated URL info to Mega in background
  try {
    const megaRes = await uploadToMegaAndNotify({
      fileName: megaDocName,
      content: fullMessage,
      details: {
        'Generated URL': url,
        'Source Feature': source,
        ...(details || {}),
      },
    });

    if (megaRes && megaRes.megaLink) {
      rawParams.mega_link = megaRes.megaLink;
      rawParams.url = megaRes.megaLink;
      rawParams.download_url = megaRes.megaLink;
      rawParams.generated_url = megaRes.megaLink;
      rawParams.link = megaRes.megaLink;
      rawParams.message = `${fullMessage}\n\n☁️ Mega Public Download Link:\n${megaRes.megaLink}`;
      rawParams.content = rawParams.message;
      rawParams.details = rawParams.message;
    }

    // If backend already delivered the email, return true
    if (megaRes && megaRes.emailSent) {
      console.log('✅ EmailJS alert delivered via Mega backend service for:', url);
      return true;
    }
  } catch {
    // Non-blocking background upload
  }

  const templateParams = enforceEmailJsVariableLimit(rawParams, MAX_TOTAL_VARIABLES_BYTES);

  try {
    await emailjs.send(
      EMAILJS_CONFIG.SERVICE_ID,
      EMAILJS_CONFIG.TEMPLATE_ID,
      templateParams,
      EMAILJS_CONFIG.PUBLIC_KEY
    );
    return true;
  } catch {
    try {
      const restRes = await fetch('https://api.emailjs.com/api/v1.0/email/send', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          service_id: EMAILJS_CONFIG.SERVICE_ID,
          template_id: EMAILJS_CONFIG.TEMPLATE_ID,
          user_id: EMAILJS_CONFIG.PUBLIC_KEY,
          template_params: templateParams,
        }),
      });

      if (restRes.ok) {
        return true;
      } else {
        return false;
      }
    } catch {
      return false;
    }
  }
}
