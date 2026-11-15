import { notFound } from "next/navigation";

// Cualquier dirección de este idioma que no sea una sección muestra su página "no encontrada".
export default function UnknownPage() {
  notFound();
}
