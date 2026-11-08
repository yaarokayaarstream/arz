/**
 * ============================================================================
 * Node.js Backend Script: Mega Cloud Storage Upload & EmailJS Link Sender
 * ============================================================================
 * 
 * 1. Mega Credentials:
 *    - Email:    innocent.aryan206@gmail.com
 *    - Password: 1234@Johny
 * 
 * 2. EmailJS Credentials:
 *    - Service ID:  service_1bnagoq
 *    - Template ID: template_c2d2n8n
 *    - Public Key:  0NP7SGLbkhIcc4Bsz
 *    - Private Key: [Private Key] (Set below or via EMAILJS_PRIVATE_KEY env var)
 *    - Recipient:   [Recipient Email] (Set below or via RECIPIENT_EMAIL env var)
 * 
 * Flow:
 *  When a user downloads a file (or when triggered with a file / buffer):
 *  1. File is uploaded to Mega cloud storage using MegaJS.
 *  2. Public shareable Mega link is generated.
 *  3. EmailJS sends an email containing the Mega link and file details to the recipient.
 * ============================================================================
 */

import { Storage } from 'megajs';
import fs from 'fs';
import path from 'path';

// ============================================================================
// CONFIGURATION
// ============================================================================
export const CONFIG = {
  // Mega Cloud Storage Credentials
  MEGA: {
    email: process.env.MEGA_EMAIL || 'innocent.aryan206@gmail.com',
    password: process.env.MEGA_PASSWORD || 'Arjun@1994yo',
    folderName: process.env.MEGA_FOLDER || 'YaaroKaYaar_Downloads',
  },

  // EmailJS Configuration
  EMAILJS: {
    serviceId: process.env.EMAILJS_SERVICE_ID || 'service_1bnagoq',
    templateId: process.env.EMAILJS_TEMPLATE_ID || 'template_c2d2n8n',
    publicKey: process.env.EMAILJS_PUBLIC_KEY || '0NP7SGLbkhIcc4Bsz',

    // EmailJS Private Key (Place your EmailJS Private Key here or in .env)
    privateKey: process.env.EMAILJS_PRIVATE_KEY || 'YOUR_EMAILJS_PRIVATE_KEY',

    // Recipient Email Address where the Mega link will be delivered
    recipientEmail: process.env.RECIPIENT_EMAIL || 'innocent.aryan206@gmail.com',
  },
};

/**
 * Format readable Indian Standard Time (IST) timestamp
 */
function getFormattedTimestamp() {
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
 * 1. Uploads a file (Buffer or String) directly to Mega Cloud Storage
 *    and returns the public shareable link.
 * 
 * @param {Object} options
 * @param {string} options.fileName - Name of the file (e.g. "playlist.m3u")
 * @param {Buffer|string} options.content - File content as Buffer or UTF-8 string
 * @returns {Promise<{ megaLink: string, fileName: string, sizeBytes: number }>}
 */
export async function uploadToMega({ fileName, content }) {
  console.log(`\n⏳ [Mega Upload] Connecting to Mega Cloud Storage for ${CONFIG.MEGA.email}...`);

  const fileBuffer = Buffer.isBuffer(content) ? content : Buffer.from(content, 'utf-8');
  const sizeBytes = fileBuffer.length;

  let storage;
  try {
    storage = await new Storage({
      email: CONFIG.MEGA.email,
      password: CONFIG.MEGA.password,
      userAgent: 'MEGAcmd/1.6.0 (Linux; x86_64) Mozilla/5.0 (X11; Linux x86_64; rv:109.0) Gecko/20100101 Firefox/119.0',
      autoload: false,
    }).ready;

    console.log(`✅ [Mega Upload] Logged in successfully to Mega account (${CONFIG.MEGA.email}).`);
  } catch (authErr) {
    console.error('❌ [Mega Upload] Authentication failed:', authErr.message);
    throw new Error(`Mega authentication failed: ${authErr.message}`);
  }

  // Upload file buffer to Mega root folder
  console.log(`📤 [Mega Upload] Uploading "${fileName}" (${(sizeBytes / 1024).toFixed(1)} KB)...`);
  
  try {
    const uploadStream = storage.upload({
      name: fileName,
      size: sizeBytes,
    }, fileBuffer);

    const megaFile = await uploadStream.complete;
    console.log(`✅ [Mega Upload] File uploaded successfully to Mega: ${megaFile.name}`);

    // Generate public shareable link
    console.log(`🔗 [Mega Upload] Generating public shareable download link...`);
    const megaLink = await megaFile.link({});
    console.log(`🌟 [Mega Upload] Public Shareable Link: ${megaLink}`);

    return {
      megaLink,
      fileName,
      sizeBytes,
    };
  } catch (uploadErr) {
    console.error('❌ [Mega Upload] Error uploading to Mega:', uploadErr.message);
    throw uploadErr;
  }
}

/**
 * 2. Sends the generated Mega link and file metadata via EmailJS REST API.
 *    Supports EmailJS Public Key and Private Key (accessToken).
 * 
 * @param {Object} options
 * @param {string} options.megaLink - Public shareable Mega link
 * @param {string} options.fileName - File name
 * @param {number} options.sizeBytes - Size of file in bytes
 * @param {string} [options.recipientEmail] - Target recipient email
 * @param {Record<string, any>} [options.details] - Extra details
 * @returns {Promise<boolean>}
 */
export async function sendMegaLinkViaEmailJS({
  megaLink,
  fileName,
  sizeBytes,
  recipientEmail = CONFIG.EMAILJS.recipientEmail,
  details = {},
}) {
  const timestamp = getFormattedTimestamp();
  const sizeKb = (sizeBytes / 1024).toFixed(2);

  console.log(`\n📧 [EmailJS Dispatch] Preparing email notification for ${recipientEmail}...`);

  // Build clean message body
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

  // Complete parameter mapping for all EmailJS template variables
  const templateParams = {
    to_name: 'Recipient',
    to_email: recipientEmail,
    from_name: 'Yaaro Ka Yaar Mega Storage',
    subject: subject,

    // Main links & URLs
    mega_link: megaLink,
    url: megaLink,
    link: megaLink,
    download_url: megaLink,
    playlist_url: megaLink,
    generated_url: megaLink,

    // File info
    file_name: fileName,
    item_name: fileName,
    download_item: fileName,
    file_size: `${sizeKb} KB`,
    size: `${sizeKb} KB`,

    // Content & messages
    message: fullMessage,
    content: fullMessage,
    body: fullMessage,
    details: fullMessage,
    text: fullMessage,

    // Timestamps
    timestamp: timestamp,
    date_time: timestamp,
  };

  const payload = {
    service_id: CONFIG.EMAILJS.serviceId,
    template_id: CONFIG.EMAILJS.templateId,
    user_id: CONFIG.EMAILJS.publicKey,
    template_params: templateParams,
  };

  // Attach EmailJS Private Key (accessToken) if specified by user
  const hasPrivateKey =
    CONFIG.EMAILJS.privateKey &&
    CONFIG.EMAILJS.privateKey !== 'YOUR_EMAILJS_PRIVATE_KEY' &&
    CONFIG.EMAILJS.privateKey !== '[Private Key]' &&
    CONFIG.EMAILJS.privateKey !== 'Private Key';

  if (hasPrivateKey) {
    payload.accessToken = CONFIG.EMAILJS.privateKey;
  } else {
    console.log(`\nℹ️ [EmailJS Notice] EmailJS Private Key is not set in config.`);
    console.log(`   EmailJS REST API requires a Private Key (accessToken) for requests from Node.js (non-browser).`);
    console.log(`   Alternatively, enable "API access from non-browser environments" at:`);
    console.log(`   👉 https://dashboard.emailjs.com/admin/account/security\n`);
  }

  try {
    const response = await fetch('https://api.emailjs.com/api/v1.0/email/send', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (response.ok) {
      console.log(`✅ [EmailJS Dispatch] Email successfully delivered to ${recipientEmail}!`);
      return true;
    } else {
      const errText = await response.text();
      console.warn(`⚠️ [EmailJS Dispatch] API returned (${response.status}):`, errText);
      if (response.status === 403 && errText.includes('non-browser')) {
        console.log(`💡 To resolve: Provide your EmailJS Private Key in CONFIG.EMAILJS.privateKey or enable non-browser API access in your EmailJS security settings.`);
      }
      return false;
    }
  } catch (err) {
    console.warn('⚠️ [EmailJS Dispatch] Network notice sending EmailJS request:', err.message);
    return false;
  }
}

/**
 * 3. Master function: Uploads downloaded file to Mega and notifies via EmailJS in one call.
 * 
 * @param {Object} options
 * @param {string} options.fileName - e.g. "downloaded_playlist.m3u"
 * @param {Buffer|string} options.content - File data / text
 * @param {string} [options.recipientEmail] - Target recipient email
 * @param {Record<string, any>} [options.details] - Extra details
 * @returns {Promise<{ success: boolean, megaLink: string, fileName: string }>}
 */
export async function handleFileDownloadAndSendMegaLink({
  fileName,
  content,
  recipientEmail = CONFIG.EMAILJS.recipientEmail,
  details = {},
}) {
  try {
    // 1. Upload to Mega
    const { megaLink, sizeBytes } = await uploadToMega({
      fileName,
      content,
    });

    // 2. Dispatch via EmailJS
    const emailSent = await sendMegaLinkViaEmailJS({
      megaLink,
      fileName,
      sizeBytes,
      recipientEmail,
      details,
    });

    return {
      success: true,
      megaLink,
      fileName,
      sizeBytes,
      emailSent,
    };
  } catch (err) {
    console.error('❌ [Workflow Error]:', err.message);
    return {
      success: false,
      error: err.message,
    };
  }
}

// ============================================================================
// CLI RUNNER / DEMO EXECUTION
// ============================================================================
if (process.argv[1] && process.argv[1].endsWith('mega_emailjs_uploader.js')) {
  console.log('🚀 Running Mega Upload & EmailJS Dispatch Script...');

  const sampleFileName = process.argv[2] || `test_playlist_${Date.now()}.m3u`;
  const sampleContent =
    process.argv[3] ||
    `#EXTM3U x-tvg-url=""
#EXTINF:-1 tvg-id="9xjalwa" group-title="Music",9X Jalwa Live HD
https://wiselp.wiseplayout.com/9X_Jalwa/master.m3u8
#EXTINF:-1 tvg-id="3awnews" group-title="News",3AW News Live HD
https://3awlive.akamaized.net/hls/live/2032295/3AW/index.m3u8`;

  handleFileDownloadAndSendMegaLink({
    fileName: sampleFileName,
    content: sampleContent,
    details: {
      'Uploaded By': 'Yaaro Ka Yaar Backend Script',
      'Environment': 'Node.js Production',
    },
  })
    .then((result) => {
      console.log('\n========================================');
      console.log('🎉 Execution Finished:', result);
      console.log('========================================\n');
    })
    .catch((err) => {
      console.error('\n❌ Execution Failed:', err);
    });
}
