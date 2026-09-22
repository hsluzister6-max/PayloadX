const MAX_INPUT_BYTES = 5 * 1024 * 1024;
const MAX_EDGE = 256;
const JPEG_QUALITY = 0.82;
const ALLOWED_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);

/**
 * Read an image file and return a compressed JPEG data URL suitable for User.avatar.
 * @param {File} file
 * @returns {Promise<string>}
 */
export async function fileToAvatarDataUrl(file) {
  if (!file || !(file instanceof Blob)) {
    throw new Error('Choose an image file');
  }
  if (file.size > MAX_INPUT_BYTES) {
    throw new Error('Image must be under 5 MB');
  }
  if (file.type && !ALLOWED_TYPES.has(file.type)) {
    throw new Error('Use JPG, PNG, WebP, or GIF');
  }

  const objectUrl = URL.createObjectURL(file);
  try {
    const img = await loadImage(objectUrl);
    const { width, height } = fitWithin(img.naturalWidth || img.width, img.naturalHeight || img.height, MAX_EDGE);
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Could not process image');
    ctx.drawImage(img, 0, 0, width, height);
    const dataUrl = canvas.toDataURL('image/jpeg', JPEG_QUALITY);
    if (!dataUrl || dataUrl.length > 550_000) {
      throw new Error('Image is too large after compression');
    }
    return dataUrl;
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

function fitWithin(w, h, maxEdge) {
  const width = Math.max(1, w || 1);
  const height = Math.max(1, h || 1);
  const scale = Math.min(1, maxEdge / Math.max(width, height));
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Could not read image'));
    img.src = src;
  });
}
