/**
 * uploadImage — proxies image upload through the Cloudflare Worker,
 * which then uploads to Firebase Storage server-side (no CORS issues).
 */
const API_URL = 'https://beccastouchstudio-api.amusanolamide74.workers.dev';

export async function uploadImage(file, getToken, onProgress = null) {
  if (file.size > 20 * 1024 * 1024) throw new Error(`File too large (max 20 MB): ${file.name}`);

  if (onProgress) onProgress(10);

  // Read file as base64
  const base64 = await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload  = () => resolve(reader.result.split(',')[1]);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });

  if (onProgress) onProgress(30);

  const ext      = file.name.split('.').pop() || 'jpg';
  const fileName = `products/${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;
  const mimeType = file.type || 'image/jpeg';
  const tok      = typeof getToken === 'function' ? await getToken().catch(() => '') : (getToken || '');

  if (onProgress) onProgress(50);

  const res = await fetch(API_URL, {
    method : 'POST',
    headers: {
      'Content-Type' : 'application/json',
      ...(tok ? { Authorization: `Bearer ${tok}` } : {}),
    },
    body: JSON.stringify({ action: 'uploadImage', imageBase64: base64, mimeType, fileName }),
  });

  if (onProgress) onProgress(90);

  const data = await res.json().catch(() => ({}));
  if (!data.ok || !data.url) {
    throw new Error(data.error || 'Image upload failed — check your Firebase Storage bucket.');
  }

  if (onProgress) onProgress(100);
  return data.url;
}
