import type {InspirationBoard, InspirationPhoto} from './inspiration';
import {canvasOf} from '../pixels';
import {checkPhotoFile,readImage} from '../photo-file';
import {profilePixels, readRecommendationPixels} from './recommend';

const storeName = 'boards';

function openLibrary() {
  return new Promise<IDBDatabase>((resolve,reject) => {
    const request = indexedDB.open('luma-inspiration',1);
    request.onupgradeneeded = () => request.result.createObjectStore(storeName,{keyPath:'id'});
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
  });
}

async function transact<T>(mode: IDBTransactionMode, action: (store: IDBObjectStore) => IDBRequest<T>) {
  const database = await openLibrary();
  try {
    return await new Promise<T>((resolve,reject) => {
      const transaction = database.transaction(storeName,mode);
      const request = action(transaction.objectStore(storeName));
      transaction.oncomplete = () => resolve(request.result);
      transaction.onabort = () => reject(transaction.error);
    });
  } finally { database.close(); }
}

export const listBoards = () => transact<InspirationBoard[]>('readonly',store=>store.getAll());
export const saveBoard = (board: InspirationBoard) => transact('readwrite',store=>store.put(board));
export const deleteBoard = (id: string) => transact('readwrite',store=>store.delete(id));

export async function prepareInspiration(file: File): Promise<InspirationPhoto> {
  checkPhotoFile(file);
  const url = URL.createObjectURL(file);
  try {
    const image = await readImage(url);
    const thumbnail = canvasOf(image,image.naturalWidth,image.naturalHeight,300);
    return { id:crypto.randomUUID(), name:file.name, thumbnail:thumbnail.toDataURL('image/jpeg',.79),
      profile:profilePixels(readRecommendationPixels(thumbnail)) };
  } finally { URL.revokeObjectURL(url); }
}
