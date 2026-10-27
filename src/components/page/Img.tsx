import type { ImageRef } from "@/lib/content/schema";
import { safeImageUrl } from "@/lib/theme/css";
import { cn } from "@/lib/utils";

/** Imagem do usuário: só aceita URLs do nosso storage, sempre lazy e com alt. */
export function Img({ image, className, alt, eager, sizes }: { image?: ImageRef; className?: string; alt?: string; eager?: boolean; sizes?: string }) {
  const src = safeImageUrl(image?.url);
  if (!src || !image) return null;
  return (
    <img
      src={src}
      alt={alt ?? image.alt ?? ""}
      width={image.width}
      height={image.height}
      loading={eager ? "eager" : "lazy"}
      decoding="async"
      sizes={sizes}
      className={cn("object-cover", className)}
      draggable={false}
    />
  );
}
