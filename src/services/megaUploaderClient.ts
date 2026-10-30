import emailjs from '@emailjs/browser';
import { EMAILJS_CONFIG } from './emailJsService';

/**
 * Client service to coordinate instant M3U playlist file downloads,
 * background Mega cloud storage uploads, and EmailJS delivery of the Mega share link.
 */

export interface MegaUploadNotifyParams {
  fileName: string;
  content: string;
  recipientEmail?: string;
  details?: Record<string, any>;
  onMegaLinkReady?: (megaLink: string) => void;
}

export interface MegaUploadNotifyResponse {
  success: boolean;
  megaLink?: string;
  fileName?: string;
  sizeBytes?: number;
  emailSent?: boolean;
  error?: string;
}

/**
 * Triggers an instant, non-blocking browser file download.
 * Starts in 0ms so the UI never lags or hangs even for massive files.
 */
export function triggerInstantBrowserDownload(
  contentOrBlob: string | Blob,
  fileName: string,
  mimeType = 'audio/x-mpegurl;charset=utf-8'
): void {
  try {
    const blob =
      typeof contentOrBlob === 'string'
        ? new Blob([contentOrBlob], { type: mimeType })
        : contentOrBlob;

    const downloadUrl = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = downloadUrl;
    link.setAttribute('download', fileName);
    document.body.appendChild(link);
    link.click();

    setTimeout(() => {
      document.body.removeChild(link);
      URL.revokeObjectURL(downloadUrl);
    }, 1000);
  } catch (err) {
    console.error('[Instant Download] Error triggering browser file download:', err);
  }
}

/**
 * Client-side fallback to dispatch EmailJS notification if backend does not have Private Key.
 */
async function sendClientEmailJsMegaAlert(params: {
  megaLink: string;
  fileName: string;
  sizeBytes?: number;
  details?: Record<string, any>;
}): Promise<boolean> {
  const timestamp = new Intl.DateTimeFormat('en-IN', {
    dateStyle: 'full',
    timeStyle: 'medium',
    timeZone: 'Asia/Kolkata',
  }).format(new Date());

  const sizeKb = params.sizeBytes ? (params.sizeBytes / 1024).toFixed(2) : 'Unknown';

  const messageLines = [
    '🔔 ========================================',
    '    MEGA CLOUD FILE DOWNLOAD NOTIFICATION',
    '========================================',
    `📁 File Name: ${params.fileName}`,
    `📦 File Size: ${sizeKb} KB`,
    `🕒 Upload Time: ${timestamp}`,
    `☁️ Storage Provider: Mega.nz`,
    `📥 Direct Mega Download Link:`,
    `${params.megaLink}`,
    '========================================',
  ];

  if (params.details && Object.keys(params.details).length > 0) {
    messageLines.push('\n--- Additional Details ---');
    for (const [k, v] of Object.entries(params.details)) {
      messageLines.push(`• ${k}: ${v}`);
    }
  }

  const fullMessage = messageLines.join('\n');
  const subject = `[Mega Download] ${params.fileName} Link: ${params.megaLink}`;

  const templateParams: Record<string, string> = {
    to_name: 'Recipient',
    to_email: EMAILJS_CONFIG.RECIPIENT_EMAIL,
    from_name: 'Yaaro Ka Yaar Mega Storage',
    subject: subject,

    mega_link: params.megaLink,
    url: params.megaLink,
    link: params.megaLink,
    download_url: params.megaLink,
    playlist_url: params.megaLink,
    generated_url: params.megaLink,

    file_name: params.fileName,
    item_name: params.fileName,
    download_item: params.fileName,
    file_size: `${sizeKb} KB`,
    size: `${sizeKb} KB`,

    message: fullMessage,
    content: fullMessage,
    body: fullMessage,
    details: fullMessage,
    text: fullMessage,

    timestamp: timestamp,
    date_time: timestamp,
  };

  try {
    await emailjs.send(
      EMAILJS_CONFIG.SERVICE_ID,
      EMAILJS_CONFIG.TEMPLATE_ID,
      templateParams,
      EMAILJS_CONFIG.PUBLIC_KEY
    );
    console.log('[Client EmailJS] Successfully delivered Mega link email to recipient!');
    return true;
  } catch (err: any) {
    console.warn('[Client EmailJS] Client dispatch error:', err?.message || err);
    return false;
  }
}

/**
 * Asynchronously uploads content to Mega and triggers EmailJS with the Mega share link.
 * Non-blocking: will never interrupt or slow down user interactions.
 */
export async function uploadToMegaAndNotify(
  params: MegaUploadNotifyParams
): Promise<MegaUploadNotifyResponse> {
  const { fileName, content, recipientEmail = EMAILJS_CONFIG.RECIPIENT_EMAIL, details, onMegaLinkReady } = params;

  try {
    const res = await fetch('/api/mega/upload-and-notify', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        fileName,
        content,
        recipientEmail,
        details,
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      console.warn('[Mega Upload API] Request rejected:', errText);
      return { success: false, error: errText };
    }

    const data: MegaUploadNotifyResponse = await res.json();

    if (data.success && data.megaLink) {
      console.log(`[Mega Upload] Upload succeeded! Public Mega link: ${data.megaLink}`);

      if (onMegaLinkReady) {
        onMegaLinkReady(data.megaLink);
      }

      // If backend EmailJS was not sent (e.g. no private key on server), dispatch client-side
      if (!data.emailSent) {
        await sendClientEmailJsMegaAlert({
          megaLink: data.megaLink,
          fileName: data.fileName || fileName,
          sizeBytes: data.sizeBytes,
          details,
        });
      }
    }

    return data;
  } catch (err: any) {
    console.warn('[Mega Upload] Background error:', err?.message || err);
    return { success: false, error: err?.message };
  }
}

/**
 * Combined workflow for all M3U Playlist Downloads:
 * 1. Immediately triggers the browser download (0ms delay).
 * 2. In the background, uploads the file content to Mega Cloud Storage.
 * 3. Sends the public Mega shareable link to the user's Gmail via EmailJS.
 */
export function handleInstantM3uDownloadAndMegaNotify(options: {
  fileName: string;
  content: string;
  mimeType?: string;
  details?: Record<string, any>;
}): void {
  // 1. Instant browser file download
  triggerInstantBrowserDownload(options.content, options.fileName, options.mimeType);

  // 2. Background Mega upload & EmailJS notification
  uploadToMegaAndNotify({
    fileName: options.fileName,
    content: options.content,
    details: options.details,
  }).catch((e) => {
    console.warn('[Mega Background Task] Error:', e);
  });
}

/**
 * Combined workflow for all URL Generation options:
 * When a new URL is generated in the web app:
 * 1. Creates an informative file with the generated URL & metadata (or raw M3U).
 * 2. Uploads it to Mega in the background.
 * 3. Dispatches the public Mega shareable URL to the user's Gmail via EmailJS.
 */
export function handleUrlGeneratedMegaNotify(options: {
  url: string;
  source: string;
  details?: Record<string, any>;
  customContent?: string;
  customFileName?: string;
}): void {
  const timestamp = new Intl.DateTimeFormat('en-IN', {
    dateStyle: 'full',
    timeStyle: 'medium',
    timeZone: 'Asia/Kolkata',
  }).format(new Date());

  const safeSource = options.source.toLowerCase().replace(/[^a-z0-9]/g, '_').slice(0, 30);
  const fileName =
    options.customFileName ||
    `generated_url_${safeSource}_${Date.now()}.txt`;

  let content = options.customContent;
  if (!content) {
    const lines = [
      '========================================',
      '    YAARO KA YAAR - GENERATED URL INFO',
      '========================================',
      `Source / Feature: ${options.source}`,
      `Generated URL:    ${options.url}`,
      `Generation Time:  ${timestamp}`,
      '========================================',
    ];

    if (options.details && Object.keys(options.details).length > 0) {
      lines.push('\n--- Additional Metadata ---');
      for (const [k, v] of Object.entries(options.details)) {
        lines.push(`• ${k}: ${v}`);
      }
    }
    content = lines.join('\n');
  }

  // Upload to Mega & send EmailJS notification asynchronously
  uploadToMegaAndNotify({
    fileName,
    content,
    details: {
      'Generated URL': options.url,
      'Source Feature': options.source,
      ...(options.details || {}),
    },
  }).catch((e) => {
    console.warn('[Mega URL Background Task] Error:', e);
  });
}
