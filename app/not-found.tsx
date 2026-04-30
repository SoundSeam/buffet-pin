import Link from "next/link";

export default function NotFound() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[#041F18] px-6 text-center">
      <div>
        <p className="text-sm font-semibold" style={{ color: "#C9A56A" }}>
          404
        </p>
        <h1 className="mt-4 text-5xl font-bold" style={{ color: "#F4E8D2" }}>
          Page introuvable
        </h1>
        <Link
          href="/"
          className="mt-8 inline-block rounded border px-8 py-3 text-sm font-semibold"
          style={{ borderColor: "rgba(201,165,106,0.5)", color: "#C9A56A" }}
        >
          Retour a l&apos;accueil
        </Link>
      </div>
    </main>
  );
}
