/**
 * Reads a file and returns a data URL (for small files < 1 MB only).
 * For larger files, use uploadReceiptFile() instead.
 */
export async function fileToDataUrl(file, maxMb = 1) {
  if (!file) return { dataUrl: '', name: '' };
  if (file.size > maxMb * 1024 * 1024) {
    throw new Error(`Please upload a file smaller than ${maxMb} MB.`);
  }
  const dataUrl = await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload  = () => resolve(reader.result);
    reader.onerror = () => reject(new Error('Could not read file.'));
    reader.readAsDataURL(file);
  });
  return { dataUrl, name: file.name };
}

/**
 * Compresses an image file and returns a data URL.
 * Non-image files (PDF etc.) are returned as-is up to 900 KB raw.
 * Product images can be up to 5 MB — they will be compressed to fit.
 */
export async function uploadReceiptFile(file, maxMb = 5) {
  if (!file) return { dataUrl: '', name: '' };

  const MAX_BYTES = 4.5 * 1024 * 1024; // 4.5 MB per image max (20 MB total across all)

  // For non-images just read as-is and check size
  if (!file.type.startsWith('image/')) {
    if (file.size > MAX_BYTES) throw new Error('File too large. Please upload an image or PDF under 1 MB.');
    const dataUrl = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload  = () => resolve(reader.result);
      reader.onerror = () => reject(new Error('Could not read file.'));
      reader.readAsDataURL(file);
    });
    return { dataUrl, name: file.name };
  }

  // For images: allow up to maxMb (5MB by default), compress progressively
  if (file.size > maxMb * 1024 * 1024) {
    throw new Error(`Image too large. Max allowed is ${maxMb} MB.`);
  }

  return new Promise((resolve, reject) => {
    const img = new Image();
    const objectUrl = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(objectUrl);
      const canvas = document.createElement('canvas');
      // Cap dimensions at 2400px on the long side for product images
      const MAX_DIM = 2400;
      let { width, height } = img;
      if (width > MAX_DIM || height > MAX_DIM) {
        if (width > height) { height = Math.round(height * MAX_DIM / width); width = MAX_DIM; }
        else { width = Math.round(width * MAX_DIM / height); height = MAX_DIM; }
      }
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, width, height);

      // Try quality levels until size fits
      let quality = 0.85;
      let dataUrl = canvas.toDataURL('image/jpeg', quality);
      while (dataUrl.length > MAX_BYTES * 1.37 && quality > 0.20) { // base64 ~1.37x raw
        quality -= 0.08;
        dataUrl = canvas.toDataURL('image/jpeg', quality);
      }
      if (dataUrl.length > MAX_BYTES * 1.37) {
        reject(new Error('Image is still too large after compression. Try a smaller file or use an image URL link instead.'));
      } else {
        resolve({ dataUrl, name: file.name });
      }
    };
    img.onerror = () => { URL.revokeObjectURL(objectUrl); reject(new Error('Could not read image.')); };
    img.src = objectUrl;
  });
}
