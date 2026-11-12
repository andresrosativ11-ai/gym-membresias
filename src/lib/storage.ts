import "server-only";
import { randomUUID } from "node:crypto";
import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import path from "node:path";

/**
 * Almacenamiento de fotos. Implementación local para desarrollo; en producción
 * se reemplaza por R2/S3 manteniendo esta misma interfaz.
 */
const ROOT = path.resolve(process.env.STORAGE_DIR ?? "./storage", "photos");

export const MAX_PHOTO_BYTES = 5 * 1024 * 1024;
const EXT_BY_TYPE: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};
const TYPE_BY_EXT: Record<string, string> = { jpg: "image/jpeg", png: "image/png", webp: "image/webp" };
const KEY_RE = /^[0-9a-f-]{36}\.(jpg|png|webp)$/;

export class PhotoError extends Error {}

export async function savePhoto(file: File): Promise<string> {
  const ext = EXT_BY_TYPE[file.type];
  if (!ext) throw new PhotoError("Formato de foto no soportado (usa JPG, PNG o WebP)");
  if (file.size > MAX_PHOTO_BYTES) throw new PhotoError("La foto supera 5 MB");
  const key = `${randomUUID()}.${ext}`;
  await mkdir(ROOT, { recursive: true });
  await writeFile(path.join(ROOT, key), Buffer.from(await file.arrayBuffer()));
  return key;
}

export async function readPhoto(key: string): Promise<{ data: Buffer; contentType: string } | null> {
  if (!KEY_RE.test(key)) return null;
  try {
    const data = await readFile(path.join(ROOT, key));
    return { data, contentType: TYPE_BY_EXT[key.split(".").pop()!] };
  } catch {
    return null;
  }
}

export async function deletePhoto(key: string): Promise<void> {
  if (!KEY_RE.test(key)) return;
  await unlink(path.join(ROOT, key)).catch(() => undefined);
}

export function photoUrl(key: string | null): string | null {
  return key ? `/api/photos/${key}` : null;
}
