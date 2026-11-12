"use client";

/* eslint-disable @next/next/no-img-element -- vista previa local (blob:) */
import { useRef, useState } from "react";

const MAX_SIDE = 800;

async function resizeImage(file: File): Promise<File> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.85));
  if (!blob) throw new Error("No se pudo procesar la imagen");
  return new File([blob], "foto.jpg", { type: "image/jpeg" });
}

/**
 * Toma una foto con la cámara (o desde la galería), la reduce a 800px en el
 * navegador y la deja en un input oculto llamado `photo`.
 */
export function PhotoInput({ currentUrl }: { currentUrl?: string | null }) {
  const [preview, setPreview] = useState<string | null>(currentUrl ?? null);
  const [error, setError] = useState<string | null>(null);
  const hiddenRef = useRef<HTMLInputElement>(null);

  async function handle(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !hiddenRef.current) return;
    setError(null);
    try {
      const resized = await resizeImage(file);
      const dt = new DataTransfer();
      dt.items.add(resized);
      hiddenRef.current.files = dt.files;
      setPreview(URL.createObjectURL(resized));
    } catch {
      setError("No se pudo leer la imagen. Intenta con otra.");
    }
  }

  return (
    <div className="flex items-center gap-4">
      <div className="h-24 w-24 shrink-0 overflow-hidden rounded-full bg-zinc-200">
        {preview && <img src={preview} alt="Foto del socio" className="h-full w-full object-cover" />}
      </div>
      <div className="flex flex-col gap-2">
        <label className="btn-secondary cursor-pointer">
          Tomar foto
          <input type="file" accept="image/*" capture="user" className="sr-only" onChange={handle} />
        </label>
        <label className="cursor-pointer text-sm text-zinc-600 underline">
          Elegir de la galería
          <input type="file" accept="image/*" className="sr-only" onChange={handle} />
        </label>
        {error && <p className="text-sm text-red-600">{error}</p>}
      </div>
      <input ref={hiddenRef} type="file" name="photo" className="hidden" tabIndex={-1} />
    </div>
  );
}
