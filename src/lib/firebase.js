import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getStorage, ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';

const firebaseConfig = {
  apiKey: 'AIzaSyClmvYRY8dyvabeRyCTRde4gk59rTcnBho',
  authDomain: 'beccastouch-studio.firebaseapp.com',
  projectId: 'beccastouch-studio',
  storageBucket: 'beccastouch-studio.appspot.com',
  messagingSenderId: '333178706405',
  appId: '1:333178706405:web:6a9e1af3f6792138c8f70c',
};

export const firebaseApp = initializeApp(firebaseConfig);
export const firebaseAuth = getAuth(firebaseApp);
export const firebaseStorage = getStorage(firebaseApp);

/**
 * Upload a file to Firebase Storage and return the public download URL.
 */
export async function uploadToStorage(file, folder = 'products', onProgress = null) {
  const ext = file.name.split('.').pop();
  const fileName = `${folder}/${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;
  const storageRef = ref(firebaseStorage, fileName);
  const task = uploadBytesResumable(storageRef, file);

  return new Promise((resolve, reject) => {
    task.on(
      'state_changed',
      (snap) => {
        if (onProgress) onProgress(Math.round((snap.bytesTransferred / snap.totalBytes) * 100));
      },
      reject,
      async () => {
        const url = await getDownloadURL(task.snapshot.ref);
        resolve(url);
      }
    );
  });
}
