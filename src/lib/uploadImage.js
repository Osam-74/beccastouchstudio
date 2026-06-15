/**
 * uploadImage — upload a File via the Cloudflare Worker backend (ImgBB relay).
 * Falls back to direct Firebase Storage if the worker upload fails.
 *
 * @param {File} file - The file to upload
 * @param {Function} getToken - async fn that returns a Firebase ID token
 * @param {Function} [onProgress] - optional progress callback (0–100)
 * @returns {Promise<string>} public image URL
 */
export async function uploadImage(file, getToken, onProgress = null) {
  if (file.size > 20 * 1024 * 1024) throw new Error(`File too large (max 20 MB): ${file.name}`);

  // Convert file to base64
  const base64 = await fileToBase64(file);
  const mimeType = file.type || 'image/jpeg';

  if (onProgress) onProgress(10);

  // Get auth token
  const tok = await getToken().catch(() => '');
  if (onProgress) onProgress(30);

  // Upload via worker (server-side → ImgBB, no CORS issues)
  const res = await fetch('https://beccastouchstudio-api.amusanolamide74.workers.dev', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(tok ? { Authorization: `Bearer ${tok}` } : {}),
    },
    body: JSON.stringify({ action: 'uploadImage', imageBase64: base64, mimeType }),
  });

  if (onProgress) onProgress(80);

  const data = await res.json().catch(() => ({}));
  if (!data.ok || !data.url) {
    throw new Error(data.error || 'Image upload failed — please try again or paste an image URL instead.');
  }

  if (onProgress) onProgress(100);
  return data.url;
}

/** Read a File and return its raw base64 content (no data: prefix). */
function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result; // "data:image/jpeg;base64,XXXX"
      const base64 = result.split(',')[1];
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}
