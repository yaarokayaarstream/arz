/**
 * Service to generate sequential URLs and M3U playlists from a base URL with numeric replacement.
 * Logic:
 * 1. Identify if the base URL ends with a file extension.
 *    If so, replace the numeric part preceding the file extension.
 * 2. If not, replace the last numeric sequence in the URL.
 * 3. Supports very high numbers using BigInt without hard-coded limits.
 * 4. Formats into downloadable .m3u playlist.
 */

export interface ParsedPattern {
  hasExtension: boolean;
  extension: string;
  prefix: string;
  numericPart: string;
  suffix: string;
  queryAndHash: string;
  detectedStart: string;
  detectedPadding: number;
}

export interface RangeGenerateOptions {
  baseUrl: string;
  startRange: string;
  endRange: string;
  preservePadding?: boolean;
  paddingLength?: number;
  channelPrefix?: string;
  groupTitle?: string;
}

export interface GeneratedUrlItem {
  index: string; // 1-based order in sequence: 1, 2, ...
  numStr: string; // Formatted sequence number: e.g. "001", "002"
  name: string;
  url: string;
}

export interface RangeGenerateResult {
  totalCount: string;
  startFormatted: string;
  endFormatted: string;
  itemsPreview: GeneratedUrlItem[];
  allItemsCount: number;
  m3uContent: string;
  sampleUrl: string;
  pattern: ParsedPattern;
  padLen: number;
}

/**
 * Common media and file extensions seen in streaming and web URLs.
 */
const EXTENSION_REGEX = /\.([a-zA-Z0-9]{1,10})$/i;

/**
 * Parses a base URL to detect extension and the numeric sequence to be replaced.
 */
export function parseBaseUrlPattern(rawUrl: string): ParsedPattern {
  const trimmed = rawUrl.trim();
  if (!trimmed) {
    throw new Error('Base URL is empty. Please enter a valid stream or video URL.');
  }

  // Split query parameters and hash if present
  let mainUrl = trimmed;
  let queryAndHash = '';

  const queryOrHashIdx = trimmed.search(/[?#]/);
  if (queryOrHashIdx !== -1) {
    mainUrl = trimmed.slice(0, queryOrHashIdx);
    queryAndHash = trimmed.slice(queryOrHashIdx);
  }

  // Check if mainUrl ends with a file extension (e.g. .ts, .m3u8, .mp4, .m3u)
  const extMatch = mainUrl.match(EXTENSION_REGEX);

  if (extMatch) {
    const extension = extMatch[0]; // e.g. ".ts"
    const beforeExt = mainUrl.slice(0, -extension.length);

    // Replace the numeric part preceding it
    const numMatch = beforeExt.match(/^(.*?)(\d+)([^\d]*)$/);
    if (!numMatch) {
      throw new Error(
        `The base URL ends with extension "${extension}", but no numeric sequence was found preceding it. Example: http://example.com/live/1000${extension}`
      );
    }

    const prefix = numMatch[1];
    const numericPart = numMatch[2];
    const suffix = numMatch[3]; // any non-digit between the number and the extension

    return {
      hasExtension: true,
      extension,
      prefix,
      numericPart,
      suffix,
      queryAndHash,
      detectedStart: numericPart,
      detectedPadding: numericPart.length,
    };
  } else {
    // If not ending with an extension: replace the last numeric sequence
    const numMatch = mainUrl.match(/^(.*?)(\d+)([^\d]*)$/);
    if (!numMatch) {
      throw new Error(
        'No numeric sequence found in the base URL to increment. Example: http://example.com/live/user/pass/5000'
      );
    }

    const prefix = numMatch[1];
    const numericPart = numMatch[2];
    const suffix = numMatch[3];

    return {
      hasExtension: false,
      extension: '',
      prefix,
      numericPart,
      suffix,
      queryAndHash,
      detectedStart: numericPart,
      detectedPadding: numericPart.length,
    };
  }
}

/**
 * Validates and parses arbitrary-precision numeric string without hard-coded limits.
 */
export function parseRangeBigInt(val: string, fieldName = 'Range'): bigint {
  const cleaned = val.trim().replace(/,/g, '');
  if (!cleaned) {
    throw new Error(`${fieldName} cannot be empty.`);
  }
  if (!/^\d+$/.test(cleaned)) {
    throw new Error(`${fieldName} must contain valid non-negative digits.`);
  }
  return BigInt(cleaned);
}

/**
 * Generates sequential URLs and formats them into an M3U playlist.
 * Strictly adheres to starting number formatting for leading zero padding,
 * and ensures sequence fully starts at Start Range and finishes at End Range.
 */
export function generateRangeUrls(options: RangeGenerateOptions): RangeGenerateResult {
  const {
    baseUrl,
    startRange,
    endRange,
    preservePadding = true,
    paddingLength,
    channelPrefix = 'Channel',
    groupTitle = 'Generated Streams',
  } = options;

  const pattern = parseBaseUrlPattern(baseUrl);

  const startBig = parseRangeBigInt(startRange, 'Start range');
  const endBig = parseRangeBigInt(endRange, 'End range');

  const isAscending = startBig <= endBig;
  const countBig = isAscending ? endBig - startBig + 1n : startBig - endBig + 1n;

  // Protect client browser memory from catastrophic OOM (e.g. billions of string allocations)
  const MAX_BATCH_LIMIT = 250000n;
  if (countBig > MAX_BATCH_LIMIT) {
    throw new Error(
      `Selected range contains ${countBig.toLocaleString()} URLs. To ensure browser stability and avoid freeze, maximum allowed in one M3U export is ${MAX_BATCH_LIMIT.toLocaleString()} items. Please select a range within this limit.`
    );
  }

  const countNum = Number(countBig);

  // Determine target zero-padding length strictly according to the starting number formatting
  let padLen = 0;
  if (preservePadding) {
    if (typeof paddingLength === 'number' && paddingLength > 0) {
      padLen = paddingLength;
    } else {
      const startStr = startRange.trim().replace(/,/g, '');
      if (startStr.startsWith('0')) {
        // When the starting number has leading zeros, its string length dictates the exact padding width
        // E.g. "01" -> 2 digits ("01", "02"...), "001" -> 3 digits ("001", "002"...), "0005" -> 4 digits ("0005", "0006"...)
        padLen = startStr.length;
      } else {
        // If starting number does not start with '0', no extra artificial padding is forced
        padLen = 0;
      }
    }
  }

  const itemsPreview: GeneratedUrlItem[] = [];
  const m3uLines: string[] = ['#EXTM3U'];

  const step = isAscending ? 1n : -1n;
  let current = startBig;
  let sampleUrl = '';
  let startFormatted = '';
  let endFormatted = '';

  // Max preview items: if sequence is <= 500, include 100% of items in preview.
  // If > 500 items, preview first 100 + last 100 to prevent browser DOM lag while maintaining full M3U download.
  const PREVIEW_ALL_THRESHOLD = 500;
  const isPreviewAll = countNum <= PREVIEW_ALL_THRESHOLD;

  for (let i = 0; i < countNum; i++) {
    const rawNumStr = current.toString();
    const formattedNumStr = padLen > 0 ? rawNumStr.padStart(padLen, '0') : rawNumStr;

    // Construct URL based on pattern
    const generatedUrl = `${pattern.prefix}${formattedNumStr}${pattern.suffix}${pattern.extension}${pattern.queryAndHash}`;

    if (i === 0) {
      sampleUrl = generatedUrl;
      startFormatted = formattedNumStr;
    }
    if (i === countNum - 1) {
      endFormatted = formattedNumStr;
    }

    const channelName = channelPrefix.trim()
      ? `${channelPrefix.trim()} ${formattedNumStr}`
      : `Stream ${formattedNumStr}`;

    // Add to M3U output (always 100% complete sequence from Start Range to End Range)
    m3uLines.push(
      `#EXTINF:-1 tvg-id="${formattedNumStr}" tvg-name="${channelName}" group-title="${groupTitle.trim() || 'Generated Streams'}",${channelName}`
    );
    m3uLines.push(generatedUrl);

    // Keep preview items
    if (isPreviewAll || i < 100 || i >= countNum - 100) {
      itemsPreview.push({
        index: (i + 1).toString(),
        numStr: formattedNumStr,
        name: channelName,
        url: generatedUrl,
      });
    }

    current += step;
  }

  const m3uContent = m3uLines.join('\n');

  return {
    totalCount: countBig.toString(),
    startFormatted,
    endFormatted,
    itemsPreview,
    allItemsCount: countNum,
    m3uContent,
    sampleUrl,
    pattern,
    padLen,
  };
}

import { uploadToMegaAndNotify } from './megaUploaderClient';

/**
 * Triggers browser download of generated .m3u playlist asynchronously,
 * uploads to Mega cloud storage in the background, and notifies via EmailJS.
 */
export function downloadM3uFile(content: string, fileName = 'generated_playlist.m3u'): void {
  const cleanFileName = fileName.endsWith('.m3u') ? fileName : `${fileName}.m3u`;

  // 1. Instant browser download
  setTimeout(() => {
    const blob = new Blob([content], { type: 'audio/x-mpegurl;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = cleanFileName;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }, 1000);
  }, 0);

  // 2. Background: Upload to Mega & send shareable link via EmailJS
  uploadToMegaAndNotify({
    fileName: cleanFileName,
    content,
    details: {
      'Source Feature': 'Sequential Range URL Generator',
      'File Name': cleanFileName,
      'Type': 'Sequential Range M3U Playlist',
    },
  }).catch((e) => console.warn('[Mega Upload on Range M3U Download]:', e));
}
