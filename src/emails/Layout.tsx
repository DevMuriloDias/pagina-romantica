import { Body, Container, Head, Hr, Html, Preview, Section, Text } from "@react-email/components";
import type { ReactNode } from "react";
import { BRAND } from "../config";

export const colors = { rose: "#c2264f", ink: "#2a1418", soft: "#6b4c52", paper: "#fbf6f1", line: "#ecdcd2" };

export function EmailLayout({ preview, children }: { preview: string; children: ReactNode }) {
  return (
    <Html lang="pt-BR">
      <Head />
      <Preview>{preview}</Preview>
      <Body style={{ backgroundColor: colors.paper, fontFamily: "Georgia, 'Times New Roman', serif", margin: 0, padding: "24px 0" }}>
        <Container style={{ maxWidth: 560, margin: "0 auto", backgroundColor: "#ffffff", borderRadius: 18, overflow: "hidden", border: `1px solid ${colors.line}` }}>
          <Section style={{ background: `linear-gradient(135deg, ${colors.rose}, #e9718f)`, padding: "28px 32px" }}>
            <Text style={{ margin: 0, color: "#fff", fontSize: 22, fontStyle: "italic", letterSpacing: 0.3 }}>♥ {BRAND.name}</Text>
          </Section>
          <Section style={{ padding: "28px 32px 8px", color: colors.ink, fontFamily: "Helvetica, Arial, sans-serif", fontSize: 15, lineHeight: "24px" }}>{children}</Section>
          <Hr style={{ borderColor: colors.line, margin: "16px 32px" }} />
          <Section style={{ padding: "0 32px 24px" }}>
            <Text style={{ color: colors.soft, fontSize: 12, lineHeight: "18px", fontFamily: "Helvetica, Arial, sans-serif", margin: 0 }}>
              Você recebeu este e-mail porque criou uma página no {BRAND.name}. Dúvidas? Responda este e-mail ou escreva para {BRAND.supportEmail}.
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  );
}

export function CtaButton({ href, children }: { href: string; children: ReactNode }) {
  return (
    <a
      href={href}
      style={{ display: "inline-block", backgroundColor: colors.rose, color: "#fff", padding: "14px 26px", borderRadius: 999, fontWeight: 700, textDecoration: "none", fontSize: 15 }}
    >
      {children}
    </a>
  );
}

export function H1({ children }: { children: ReactNode }) {
  return <Text style={{ fontFamily: "Georgia, serif", fontSize: 26, lineHeight: "32px", margin: "0 0 12px", color: colors.ink }}>{children}</Text>;
}

export function P({ children, muted }: { children: ReactNode; muted?: boolean }) {
  return <Text style={{ margin: "0 0 14px", color: muted ? colors.soft : colors.ink, fontSize: muted ? 13 : 15 }}>{children}</Text>;
}
