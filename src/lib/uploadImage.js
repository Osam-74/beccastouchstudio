/**
 * uploadImage — sends file as multipart/form-data to the Cloudflare Worker,
 * which uploads it to Firebase Storage server-side (no CORS, no size issues).
 */
const API_URL = 'https://beccastouchstudio-api.amusanolamide74.workers.dev';

export async function uploadImage(file, getToken, onProgress = null) {
  if (file.size > 20 * 1024 * 1024) throw new Error(`File too large (max 20 MB): ${file.name}`);

  if (onProgress) onProgress(20);

  const tok = typeof getToken === 'function'
    ? await getToken().catch(() => '')
    : (getToken || '');

  if (onProgress) onProgress(40);

  const form = new FormData();
  form.append('file', file, file.name);
  form.append('folder', 'products');

  const res = await fetch(API_URL, {
    method: 'POST',
    headers: tok ? { Authorization: `Bearer ${tok}` } : {},
    body: form,
    // Note: do NOT set Content-Type — browser sets it with the correct boundary
  });

  if (onProgress) onProgress(90);

  const data = await res.json().catch(() => ({}));
  if (!data.ok || !data.url) {
    throw new Error(data.error || `Upload failed (${res.status})`);
  }

  if (onProgress) onProgress(100);
  return data.url;
}
