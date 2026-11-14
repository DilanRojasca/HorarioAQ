/** Redimensiona una imagen elegida por el usuario a un cuadrado de `size` px (JPEG) y la devuelve como data-URL pequeña. */
export const AVATAR_TYPES = ['image/png', 'image/jpeg', 'image/webp'];
export const AVATAR_MAX_BYTES = 5 * 1024 * 1024;

export async function fileToAvatar(file: File, size = 128): Promise<string> {
  if (!AVATAR_TYPES.includes(file.type)) throw new Error('Usa una imagen PNG, JPG o WebP');
  if (file.size > AVATAR_MAX_BYTES) throw new Error('La imagen no puede superar 5 MB');
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const i = new Image();
      i.onload = () => resolve(i);
      i.onerror = () => reject(new Error('No se pudo leer la imagen'));
      i.src = url;
    });
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = size;
    const side = Math.min(img.width, img.height); // recorte centrado
    canvas.getContext('2d')!.drawImage(img, (img.width - side) / 2, (img.height - side) / 2, side, side, 0, 0, size, size);
    return canvas.toDataURL('image/jpeg', 0.8);
  } finally { URL.revokeObjectURL(url); }
}
