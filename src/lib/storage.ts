import "server-only";
import { randomUUID } from "node:crypto";
import { db } from "@/lib/db";

/**
 * Almacenamiento de fotos en Postgres (tabla Photo). Las fotos llegan ya
 * reducidas a 800 px desde el cliente (~100 KB), así que caben bien en la base
 * y funcionan igual en local y en Vercel, cuyo disco no es persistente.
 */
export const MAX_PHOTO_BYTES = 5 * 1024 * 1024;
const EXT_BY_TYPE: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};
const KEY_RE = /^[0-9a-f-]{36}\.(jpg|png|webp)$/;

export class PhotoError extends Error {}

export async function savePhoto(file: File): Promise<string> {
  const ext = EXT_BY_TYPE[file.type];
  if (!ext) throw new PhotoError("Formato de foto no soportado (usa JPG, PNG o WebP)");
  if (file.size > MAX_PHOTO_BYTES) throw new PhotoError("La foto supera 5 MB");
  const key = `${randomUUID()}.${ext}`;
  await db.photo.create({
    data: { key, contentType: file.type, data: Buffer.from(await file.arrayBuffer()) },
  });
  return key;
}

export async function readPhoto(key: string): Promise<{ data: Uint8Array; contentType: string } | null> {
  if (!KEY_RE.test(key)) return null;
  const photo = await db.photo.findUnique({ where: { key } });
  return photo ? { data: photo.data, contentType: photo.contentType } : null;
}

export async function deletePhoto(key: string): Promise<void> {
  if (!KEY_RE.test(key)) return;
  await db.photo.deleteMany({ where: { key } });
}

export function photoUrl(key: string | null): string | null {
  return key ? `/api/photos/${key}` : null;
}
