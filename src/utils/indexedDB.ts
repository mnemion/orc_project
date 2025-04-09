import { IDBPDatabase, openDB as idbOpenDB } from 'idb';

export const DB_NAME = 'ocr-images-store';
export const STORE_NAME = 'extracted_images';
export const DB_VERSION = 1;

export const MAX_IMAGE_WIDTH = 1920;
export const MAX_IMAGE_HEIGHT = 1080;
export const IMAGE_QUALITY = 0.85;
export const TARGET_MIME_TYPE = 'image/jpeg';

export const openDB = async (): Promise<IDBPDatabase> => {
  try {
    const db = await idbOpenDB(DB_NAME, DB_VERSION, {
      upgrade(dbInstance, oldVersion, newVersion, transaction) {
        if (!dbInstance.objectStoreNames.contains(STORE_NAME)) {
          dbInstance.createObjectStore(STORE_NAME);
        }
      },
      blocked() {
        alert('IndexedDB가 다른 탭에서 사용 중입니다. 해당 탭을 닫고 다시 시도해주세요.');
      },
      blocking() {
      },
      terminated() {
      }
    });
    return db;
  } catch (error) {
    throw new Error('로컬 데이터베이스 연결에 실패했습니다. 브라우저 설정을 확인해주세요.');
  }
};

export const saveImageToIndexedDB = async (key: string, blob: Blob): Promise<void> => {
  if (!key || !(blob instanceof Blob) || blob.size === 0) {
    throw new Error('저장할 이미지 데이터가 유효하지 않습니다.');
  }

  let db: IDBPDatabase | null = null;
  try {
    db = await openDB();
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);

    await store.put(blob, key);
    await tx.done;

  } catch (error) {
    throw new Error(`이미지 로컬 저장 중 오류가 발생했습니다: ${error}`);
  }
};

export const getImageFromIndexedDB = async (key: string): Promise<Blob | null> => {
  if (!key) {
    return null;
  }

  let db: IDBPDatabase | null = null;
  try {
    db = await openDB();
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);

    const result = await store.get(key);

    if (!result) {
      return null;
    }

    if (!(result instanceof Blob)) {
      if (typeof result === 'string' && result.startsWith('data:')) {
        try {
          const res = await fetch(result);
          const blob = await res.blob();
          return blob;
        } catch (conversionError) {
          return null;
        }
      }
      return null;
    }

    if (result.size === 0) {
      return null;
    }

    return result;

  } catch (error) {
    return null;
  }
};

export const deleteImageFromIndexedDB = async (key: string): Promise<boolean> => {
  if (!key) {
    return false;
  }

  let db: IDBPDatabase | null = null;
  try {
    db = await openDB();
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);

    await store.delete(key);
    await tx.done;

    return true;
  } catch (error) {
    throw new Error(`로컬 이미지 삭제 중 오류 발생: ${error}`);
  }
};

export const resizeAndOptimizeImage = (
    dataUrl: string,
    targetWidth: number = MAX_IMAGE_WIDTH,
    targetHeight: number = MAX_IMAGE_HEIGHT,
    quality: number = IMAGE_QUALITY,
    mimeType: string = TARGET_MIME_TYPE
): Promise<Blob> => {
  return new Promise((resolve, reject) => {
    if (!dataUrl || !dataUrl.startsWith('data:')) {
      return reject(new Error('유효하지 않은 데이터 URL입니다.'));
    }

    const img = new Image();
    img.onload = () => {
      try {
        let width = img.width;
        let height = img.height;
        const aspectRatio = width / height;

        if (width > targetWidth) {
          width = targetWidth;
          height = Math.round(width / aspectRatio);
        }
        if (height > targetHeight) {
          height = targetHeight;
          width = Math.round(height * aspectRatio);
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');

        if (!ctx) {
          return reject(new Error('2D 캔버스 컨텍스트를 가져올 수 없습니다.'));
        }
        ctx.drawImage(img, 0, 0, width, height);

        canvas.toBlob(
          (blob) => {
            if (!blob) {
              return reject(new Error('이미지를 Blob으로 변환하는데 실패했습니다.'));
            }
            resolve(blob);
          },
          mimeType,
          quality
        );
      } catch (e) {
        reject(e);
      }
    };
    img.onerror = (e) => {
        reject(new Error('이미지 로드에 실패했습니다.'));
    };
    img.src = dataUrl;
  });
};

export const getImageAsDataUrl = async (key: string): Promise<string | null> => {
   if (!key) return null;

   try {
     const blob = await getImageFromIndexedDB(key);

     if (!blob || blob.size === 0) {
       return null;
     }

     return new Promise((resolve, reject) => {
       const reader = new FileReader();
       reader.onload = () => {
         const dataUrl = reader.result as string;
         resolve(dataUrl);
       };
       reader.onerror = (error) => {
         reject(new Error('이미지 데이터를 URL로 변환하는데 실패했습니다.'));
       };
       reader.readAsDataURL(blob);
     });

   } catch (error) {
     return null;
   }
};

export const validateAndOptimizeDataUrl = (
    dataUrl: string,
    targetWidth: number = MAX_IMAGE_WIDTH,
    targetHeight: number = MAX_IMAGE_HEIGHT,
    quality: number = IMAGE_QUALITY
): Promise<string> => {
    return new Promise((resolve) => {
        if (!dataUrl || !dataUrl.startsWith('data:image')) {
            resolve(dataUrl);
            return;
        }

        const img = new Image();

        img.onload = () => {
            try {
                let width = img.width;
                let height = img.height;
                const aspectRatio = width / height;

                if (width > targetWidth) {
                    width = targetWidth;
                    height = Math.round(width / aspectRatio);
                }
                if (height > targetHeight) {
                    height = targetHeight;
                    width = Math.round(height * aspectRatio);
                }

                const canvas = document.createElement('canvas');
                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');

                if (!ctx) {
                    resolve(dataUrl);
                    return;
                }
                ctx.drawImage(img, 0, 0, width, height);

                const optimizedDataUrl = canvas.toDataURL(TARGET_MIME_TYPE, quality);
                resolve(optimizedDataUrl);

            } catch (e) {
                 resolve(dataUrl);
            }
        };

        img.onerror = () => {
             resolve(dataUrl);
        };

        img.src = dataUrl;
    });
};