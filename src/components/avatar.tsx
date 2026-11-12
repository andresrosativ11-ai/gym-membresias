/* eslint-disable @next/next/no-img-element -- fotos privadas servidas por /api/photos */
export function Avatar({ src, name, size = 48 }: { src: string | null; name: string; size?: number }) {
  const initials = name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]!.toUpperCase())
    .join("");
  const style = { width: size, height: size };
  return src ? (
    <img src={src} alt={name} style={style} className="shrink-0 rounded-full object-cover" />
  ) : (
    <span
      style={style}
      aria-hidden
      className="flex shrink-0 items-center justify-center rounded-full bg-zinc-200 font-semibold text-zinc-600"
    >
      {initials}
    </span>
  );
}
