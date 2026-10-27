"use client";

export default function GlobalError({ reset }: { error: Error; reset: () => void }) {
  return (
    <html lang="pt-BR">
      <body style={{ fontFamily: "system-ui, sans-serif", display: "flex", minHeight: "100vh", alignItems: "center", justifyContent: "center", textAlign: "center", background: "#fbf6f1", color: "#2a1418" }}>
        <div>
          <p style={{ fontSize: 48 }}>🥺</p>
          <h1>Ops, algo deu errado</h1>
          <p>Seu progresso está salvo. Tente recarregar a página.</p>
          <button onClick={reset} style={{ marginTop: 16, padding: "10px 20px", borderRadius: 999, border: 0, background: "#c2264f", color: "#fff" }}>
            Tentar de novo
          </button>
        </div>
      </body>
    </html>
  );
}
