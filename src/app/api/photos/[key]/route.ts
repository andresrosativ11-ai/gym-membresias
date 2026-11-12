import { getActiveUser } from "@/lib/session";
import { readPhoto } from "@/lib/storage";

export async function GET(_req: Request, { params }: { params: Promise<{ key: string }> }) {
  if (!(await getActiveUser())) return new Response("No autorizado", { status: 401 });

  const { key } = await params;
  const photo = await readPhoto(key);
  if (!photo) return new Response("No encontrado", { status: 404 });

  return new Response(new Uint8Array(photo.data), {
    headers: {
      "Content-Type": photo.contentType,
      // la key es inmutable (uuid): cache privado largo
      "Cache-Control": "private, max-age=31536000, immutable",
    },
  });
}
