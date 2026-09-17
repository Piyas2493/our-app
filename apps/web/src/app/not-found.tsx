import Link from "next/link";

export default function NotFound() {
  return (
    <main
      style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 16,
        padding: 24,
        textAlign: "center",
        background: "var(--background)",
        color: "var(--text)",
      }}
    >
      <p style={{ fontSize: 64, fontWeight: 700, color: "var(--accent)", margin: 0 }}>404</p>
      <h1 style={{ fontFamily: "var(--font-sora)", fontSize: 24, margin: 0 }}>
        This page doesn&apos;t exist
      </h1>
      <p style={{ color: "var(--muted)", margin: 0, maxWidth: 380 }}>
        The link you followed may be broken, or the page may have moved.
      </p>
      <Link
        href="/"
        style={{
          marginTop: 8,
          padding: "10px 22px",
          borderRadius: 999,
          background: "var(--accent)",
          color: "white",
          fontWeight: 600,
          textDecoration: "none",
        }}
      >
        Back to JeevanLink
      </Link>
    </main>
  );
}
