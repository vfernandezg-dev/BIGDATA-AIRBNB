import { createHash, timingSafeEqual } from "node:crypto";

import { revalidateTag } from "next/cache";

import { MARTS_TAG } from "@/lib/queries";

/** Compara dos secretos en tiempo constante (sobre sus hashes, para que la longitud tampoco se filtre). */
function secretsMatch(received: string, expected: string): boolean {
  const digest = (value: string) => createHash("sha256").update(value).digest();
  return timingSafeEqual(digest(received), digest(expected));
}

/**
 * Invalida la caché de los marts. Lo llama el pipeline al terminar de publicar:
 *
 *   POST /api/revalidate   con la cabecera   x-revalidate-secret: <REVALIDATE_SECRET>
 *
 * La siguiente visita a cada página la regenera con los datos nuevos.
 */
export async function POST(request: Request) {
  const expected = process.env.REVALIDATE_SECRET;
  if (!expected) {
    return Response.json({ error: "La revalidación no está configurada en este despliegue." }, { status: 503 });
  }

  const received = request.headers.get("x-revalidate-secret");
  if (!received || !secretsMatch(received, expected)) {
    return Response.json({ error: "No autorizado." }, { status: 401 });
  }

  // `expire: 0`: la siguiente petición espera a los datos nuevos en lugar de recibir los anteriores.
  revalidateTag(MARTS_TAG, { expire: 0 });
  return Response.json({ revalidated: true, tag: MARTS_TAG });
}
