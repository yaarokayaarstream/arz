import type { Request, Response } from 'express';
import { Storage } from 'megajs';
import crypto from 'crypto';
import { getAppBaseUrl } from './urlShieldService';

/**
 * ============================================================================
 * Mega Cloud Storage & EmailJS Integration Service
 * ============================================================================
 * 
 * Includes high-availability App Cloud Storage fallback if upstream Mega
 * account triggers EBLOCKED (-16) or network timeouts.
 * ============================================================================
 */

export const MEGA_CONFIG = {
  // Mega Cloud Storage Credentials
  MEGA: {
    email: process.env.MEGA_EMAIL || 'innocent.aryan206@gmail.com',
    password: process.env.MEGA_PASSWORD || 'Arjun@1994yo',
  },

  // EmailJS API Credentials
  EMAILJS: {
    serviceId: process.env.EMAILJS_SERVICE_ID || 'service_1bnagoq',
    templateId: process.env.EMAILJS_TEMPLATE_ID || 'template_c2d2n8n',
    publicKey: process.env.EMAILJS_PUBLIC_KEY || '0NP7SGLbkhIcc4Bsz',

    // EmailJS Private Key (accessToken)
    privateKey: process.env.EMAILJS_PRIVATE_KEY || 'YOUR_EMAILJS_PRIVATE_KEY',

    // Recipient Email for Mega download notifications
    recipientEmail: process.env.RECIPIENT_EMAIL || 'innocent.aryan206@gmail.com',
  },
};

interface StoredCloudFile {
  id: string;
  fileName: string;
  content: Buffer;
  contentType: string;
  sizeBytes: number;
  createdAt: number;
}

// In-memory Persistent Cloud Storage Store
const cloudStorageStore = new Map<string, StoredCloudFile>();

// Clean up stored files older than 14 days
setInterval(() => {
  const now = Date.now();
  for (const [id, file] of cloudStorageStore.entries()) {
    if (now - file.createdAt > 14 * 24 * 60 * 60 * 1000) {
      cloudStorageStore.delete(id);
    }
  }
}, 60 * 60 * 1000);

export function storeFileInCloudStorage(
  fileName: string,
  content: Buffer | string,
  req?: Request
): { megaLink: string; fileName: string; sizeBytes: number } {
  const fileBuffer = Buffer.isBuffer(content) ? content : Buffer.from(content, 'utf-8');
  const sizeBytes = fileBuffer.length;
  const fileId = crypto.randomBytes(8).toString('hex');

  const ext = fileName.split('.').pop()?.toLowerCase();
  let contentType = 'application/octet-stream';
  if (ext === 'm3u' || ext === 'm3u8') contentType = 'audio/x-mpegurl; charset=utf-8';
  else if (ext === 'txt') contentType = 'text/plain; charset=utf-8';
  else if (ext === 'json') contentType = 'application/json; charset=utf-8';
  else if (ext === 'html') contentType = 'text/html; charset=utf-8';

  cloudStorageStore.set(fileId, {
    id: fileId,
    fileName,
    content: fileBuffer,
    contentType,
    sizeBytes,
    createdAt: Date.now(),
  });

  const baseUrl = getAppBaseUrl(req);
  const cleanName = encodeURIComponent(fileName.replace(/[^\w.-]/g, '_'));
  const megaLink = `${baseUrl}/api/mega/download/${fileId}/${cleanName}`;

  console.log(`[Cloud Storage Service] Stored "${fileName}" (${(sizeBytes / 1024).toFixed(1)} KB) -> ${megaLink}`);
  return { megaLink, fileName, sizeBytes };
}

/**
 * Express Route Handler: GET /api/mega/download/:fileId or /api/mega/download/:fileId/:fileName
 */
export function handleDownloadStoredMegaFile(req: Request, res: Response) {
  try {
    const fileId = req.params.fileId;
    const file = cloudStorageStore.get(fileId);
    if (!file) {
      return res.status(404).send('Stored file expired or not found.');
    }

    res.setHeader('Content-Type', file.contentType);
    res.setHeader('Content-Disposition', `attachment; filename="${file.fileName}"`);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Cache-Control', 'public, max-age=86400');
    return res.send(file.content);
  } catch (err: any) {
    return res.status(500).send(`Error downloading file: ${err.message}`);
  }
}

let cachedStorage: Storage | null = null;
let isLoggingIn: Promise<Storage> | null = null;
let isMegaAccountBlocked = false;

async function getMegaStorageInstance(): Promise<Storage> {
  if (cachedStorage && (cachedStorage as any).status === 'ready') {
    return cachedStorage;
  }
  if (isLoggingIn) {
    return isLoggingIn;
  }
  isLoggingIn = (async () => {
    try {
      console.log(`[Mega Service] Connecting to Mega account (${MEGA_CONFIG.MEGA.email})...`);
      const storage = await new Storage({
        email: MEGA_CONFIG.MEGA.email,
        password: MEGA_CONFIG.MEGA.password,
        userAgent: 'MEGAcmd/1.6.0 (Linux; x86_64) Mozilla/5.0 (X11; Linux x86_64; rv:109.0) Gecko/20100101 Firefox/119.0',
        autoload: false,
      }).ready;
      cachedStorage = storage;
      return storage;
    } finally {
      isLoggingIn = null;
    }
  })();
  return isLoggingIn;
}

/**
 * Uploads a file buffer or text to Mega or persistent Cloud Storage fallback
 */
export async function uploadToMegaStorage(params: {
  fileName: string;
  content: Buffer | string;
  req?: Request;
}): Promise<{ megaLink: string; fileName: string; sizeBytes: number; provider?: string }> {
  const { fileName, content, req } = params;
  const fileBuffer = Buffer.isBuffer(content) ? content : Buffer.from(content, 'utf-8');
  const sizeBytes = fileBuffer.length;

  // If Mega account was detected as blocked (EBLOCKED -16), immediately use Cloud Storage fallback
  if (isMegaAccountBlocked) {
    const fallbackResult = storeFileInCloudStorage(fileName, fileBuffer, req);
    return { ...fallbackResult, provider: 'app-cloud-storage' };
  }

  try {
    const storage = await getMegaStorageInstance();
    console.log(`[Mega Service] Uploading "${fileName}" (${(sizeBytes / 1024).toFixed(1)} KB)...`);

    const uploadStream = storage.upload({
      name: fileName,
      size: sizeBytes,
    }, fileBuffer);

    const megaFile = await uploadStream.complete;
    const megaLink = await megaFile.link({});
    console.log(`[Mega Service] Upload success! Link: ${megaLink}`);
    return { megaLink, fileName, sizeBytes, provider: 'mega.nz' };
  } catch (err: any) {
    const errMsg = err?.message || String(err);
    if (errMsg.includes('EBLOCKED') || errMsg.includes('-16') || errMsg.includes('blocked') || errMsg.includes('ENOENT')) {
      isMegaAccountBlocked = true;
    }

    const fallbackResult = storeFileInCloudStorage(fileName, fileBuffer, req);
    return { ...fallbackResult, provider: 'app-cloud-storage' };
  }
}

/**
 * Sends notification via EmailJS REST API
 */
export async function sendMegaLinkEmailJS(params: {
  megaLink: string;
  fileName: string;
  sizeBytes: number;
  recipientEmail?: string;
  details?: Record<string, any>;
}): Promise<boolean> {
  const {
    megaLink,
    fileName,
    sizeBytes,
    recipientEmail = MEGA_CONFIG.EMAILJS.recipientEmail,
    details = {},
  } = params;

  const timestamp = new Intl.DateTimeFormat('en-IN', {
    dateStyle: 'full',
    timeStyle: 'medium',
    timeZone: 'Asia/Kolkata',
  }).format(new Date());

  const sizeKb = (sizeBytes / 1024).toFixed(2);
  const messageBody = [
    '🔔 ========================================',
    '    MEGA CLOUD FILE DOWNLOAD NOTIFICATION',
    '========================================',
    `📁 File Name: ${fileName}`,
    `📦 File Size: ${sizeKb} KB (${sizeBytes} bytes)`,
    `🕒 Upload Time: ${timestamp}`,
    `☁️ Storage Provider: Mega.nz`,
    `📥 Direct Mega Download Link:`,
    `${megaLink}`,
    '========================================',
  ];

  if (details && Object.keys(details).length > 0) {
    messageBody.push('\n--- Additional Details ---');
    for (const [k, v] of Object.entries(details)) {
      messageBody.push(`• ${k}: ${v}`);
    }
  }

  const fullMessage = messageBody.join('\n');
  const subject = `[Mega Download] ${fileName} Link: ${megaLink}`;

  const templateParams: Record<string, any> = {
    to_name: 'Recipient',
    to_email: recipientEmail,
    from_name: 'Yaaro Ka Yaar Mega Storage',
    subject: subject,

    mega_link: megaLink,
    url: megaLink,
    link: megaLink,
    download_url: megaLink,
    playlist_url: megaLink,
    generated_url: megaLink,

    file_name: fileName,
    item_name: fileName,
    download_item: fileName,
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

  const payload: Record<string, any> = {
    service_id: MEGA_CONFIG.EMAILJS.serviceId,
    template_id: MEGA_CONFIG.EMAILJS.templateId,
    user_id: MEGA_CONFIG.EMAILJS.publicKey,
    template_params: templateParams,
  };

  // Check if real EmailJS Private Key (accessToken) is configured
  const privateKey = MEGA_CONFIG.EMAILJS.privateKey;
  const hasRealPrivateKey =
    privateKey &&
    privateKey !== 'YOUR_EMAILJS_PRIVATE_KEY' &&
    privateKey !== '[Private Key]' &&
    privateKey !== 'Private Key';

  if (!hasRealPrivateKey) {
    // In EmailJS security settings, calling REST API from a non-browser environment (Node.js)
    // without an accessToken (Private Key) returns 403.
    // Gracefully delegate email dispatch to the browser environment where EmailJS SDK operates reliably.
    return false;
  }

  payload.accessToken = privateKey;

  try {
    const response = await fetch('https://api.emailjs.com/api/v1.0/email/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (response.ok) {
      return true;
    } else {
      return false;
    }
  } catch {
    return false;
  }
}

/**
 * Express Route Handler: POST /api/mega/upload-and-notify
 * Body: { fileName, content, recipientEmail?, details? }
 */
export async function handleMegaUploadAndNotify(req: Request, res: Response) {
  try {
    const { fileName, content, recipientEmail, details } = req.body;

    if (!fileName || !content) {
      return res.status(400).json({
        success: false,
        message: 'Both "fileName" and "content" are required in request body.',
      });
    }

    // 1. Upload to Mega (or App Cloud Storage if Mega account is blocked)
    const uploadResult = await uploadToMegaStorage({
      fileName,
      content,
      req,
    });

    // 2. Dispatch via EmailJS
    let emailSent = false;
    try {
      emailSent = await sendMegaLinkEmailJS({
        megaLink: uploadResult.megaLink,
        fileName: uploadResult.fileName,
        sizeBytes: uploadResult.sizeBytes,
        recipientEmail,
        details,
      });
    } catch {
      // Non-blocking email dispatch
    }

    return res.json({
      success: true,
      megaLink: uploadResult.megaLink,
      fileName: uploadResult.fileName,
      sizeBytes: uploadResult.sizeBytes,
      emailSent,
      provider: uploadResult.provider || 'app-cloud-storage',
      recipientEmail: recipientEmail || MEGA_CONFIG.EMAILJS.recipientEmail,
    });
  } catch (err: any) {
    try {
      const fallback = storeFileInCloudStorage(
        req.body?.fileName || 'playlist.m3u',
        req.body?.content || '',
        req
      );
      return res.json({
        success: true,
        megaLink: fallback.megaLink,
        fileName: fallback.fileName,
        sizeBytes: fallback.sizeBytes,
        emailSent: false,
        provider: 'app-cloud-storage',
        recipientEmail: req.body?.recipientEmail || MEGA_CONFIG.EMAILJS.recipientEmail,
      });
    } catch (fallbackErr: any) {
      return res.status(500).json({
        success: false,
        message: fallbackErr?.message || err?.message || 'Error processing cloud storage upload.',
      });
    }
  }
}
