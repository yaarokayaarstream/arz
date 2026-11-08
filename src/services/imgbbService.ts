export interface ImgBbUploadResponse {
  id: string;
  title: string;
  urlViewer: string;
  url: string;
  displayUrl: string;
  width: string;
  height: string;
  size: number;
  time: string;
  deleteUrl?: string;
  thumbUrl?: string;
  mediumUrl?: string;
}

export interface UploadedImageHistoryItem {
  id: string;
  name: string;
  url: string;
  displayUrl: string;
  thumbUrl?: string;
  urlViewer: string;
  deleteUrl?: string;
  uploadedAt: string;
  sizeBytes: number;
}

export const IMGBB_API_KEY = '968367d8f0cacd51fe4e8155db4caae2';

/**
 * Upload an image file or base64 to ImgBB API
 * @param imageFile File object or base64 string
 * @param name Optional file name
 * @param expirationSeconds Optional auto-expiration in seconds (60-15552000)
 */
export async function uploadImageToImgbb(
  imageFile: File | string,
  name?: string,
  expirationSeconds?: number
): Promise<ImgBbUploadResponse> {
  const formData = new FormData();

  if (typeof imageFile === 'string') {
    // Strip data:image/...;base64, prefix if present
    const cleanBase64 = imageFile.includes(',') ? imageFile.split(',')[1] : imageFile;
    formData.append('image', cleanBase64);
  } else {
    formData.append('image', imageFile);
  }

  if (name) {
    formData.append('name', name);
  }

  let endpoint = `https://api.imgbb.com/1/upload?key=${encodeURIComponent(IMGBB_API_KEY)}`;
  if (expirationSeconds && expirationSeconds >= 60) {
    endpoint += `&expiration=${expirationSeconds}`;
  }

  const response = await fetch(endpoint, {
    method: 'POST',
    body: formData,
  });

  if (!response.ok) {
    let errorDetail = `Upload failed with HTTP ${response.status}`;
    try {
      const errJson = await response.json();
      if (errJson?.error?.message) {
        errorDetail = errJson.error.message;
      }
    } catch {
      // ignore
    }
    throw new Error(errorDetail);
  }

  const result = await response.json();

  if (!result.success || !result.data) {
    throw new Error(result?.error?.message || 'ImgBB upload returned unsuccessful response');
  }

  const data = result.data;

  return {
    id: data.id,
    title: data.title || name || 'Uploaded Image',
    urlViewer: data.url_viewer,
    url: data.url,
    displayUrl: data.display_url || data.url,
    width: data.width,
    height: data.height,
    size: Number(data.size) || 0,
    time: data.time,
    deleteUrl: data.delete_url,
    thumbUrl: data.thumb?.url || data.display_url || data.url,
    mediumUrl: data.medium?.url || data.url,
  };
}
