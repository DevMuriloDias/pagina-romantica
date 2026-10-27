import { Img, Section } from "@react-email/components";
import { BRAND } from "../config";
import { colors, CtaButton, EmailLayout, H1, P } from "./Layout";

export function PaymentApprovedEmail({ recipientName, pageUrl, editUrl, qrUrl, expiresText }: { recipientName: string; pageUrl: string; editUrl: string; qrUrl: string; expiresText?: string }) {
  return (
    <EmailLayout preview="🎉 Sua página está pronta! Aqui está o link para entregar a surpresa.">
      <H1>🎉 Sua página está pronta!</H1>
      <P>Pagamento confirmado. A página {recipientName ? `para ${recipientName} ` : ""}já está no ar:</P>
      <Section style={{ textAlign: "center", margin: "18px 0" }}>
        <CtaButton href={pageUrl}>Ver minha página 💌</CtaButton>
        <P muted>
          <br />
          {pageUrl}
        </P>
      </Section>
      <Section style={{ textAlign: "center", margin: "8px 0 18px" }}>
        <Img src={qrUrl} alt="QR Code da página" width="180" height="180" style={{ margin: "0 auto", borderRadius: 12 }} />
        <P muted>Imprima o QR Code e coloque num cartão, numa caixa de presente ou atrás de uma foto.</P>
      </Section>
      <P>
        <strong>Precisa mudar algo?</strong> Use seu link mágico de edição (guarde este e-mail, ele é a sua chave):
      </P>
      <P>
        <a href={editUrl} style={{ color: colors.rose }}>
          Editar minha página
        </a>
        {expiresText ? <span style={{ color: colors.soft }}> · {expiresText}</span> : null}
      </P>
      <P>
        <strong>Dicas para entregar a surpresa:</strong>
      </P>
      <P>
        • Mande o link no WhatsApp numa hora tranquila, com uma mensagem curta como “abre quando estiver sozinho(a) 💌”.
        <br />• Se configurou senha ou pergunta, combine uma dica antes!
        <br />• Peça para abrir com o som ligado se a página tiver música.
        <br />• Quer algo físico? Imprima o QR Code e esconda num presente.
      </P>
    </EmailLayout>
  );
}

export function ContinueDraftEmail({ resumeUrl }: { resumeUrl: string }) {
  return (
    <EmailLayout preview="Seu rascunho está salvo — continue de onde parou 💕">
      <H1>Sua página está esperando por você 💕</H1>
      <P>Salvamos tudo o que você fez até agora. Quando quiser continuar, é só clicar:</P>
      <Section style={{ textAlign: "center", margin: "20px 0" }}>
        <CtaButton href={resumeUrl}>Continuar minha página</CtaButton>
      </Section>
      <P muted>Rascunhos não pagos são apagados automaticamente após 30 dias, junto com as fotos.</P>
    </EmailLayout>
  );
}

export function MyPagesEmail({ loginUrl }: { loginUrl: string }) {
  return (
    <EmailLayout preview={`Seu acesso às páginas do ${BRAND.name}`}>
      <H1>Acesse suas páginas</H1>
      <P>Clique no botão abaixo para ver e editar todas as páginas compradas com este e-mail. O link vale por 30 minutos.</P>
      <Section style={{ textAlign: "center", margin: "20px 0" }}>
        <CtaButton href={loginUrl}>Ver minhas páginas</CtaButton>
      </Section>
      <P muted>Se não foi você que pediu, pode ignorar este e-mail com tranquilidade.</P>
    </EmailLayout>
  );
}

export function PageOpenedEmail({ recipientName, pageUrl }: { recipientName: string; pageUrl: string }) {
  return (
    <EmailLayout preview="💌 Sua página foi aberta!">
      <H1>💌 Sua página foi aberta!</H1>
      <P>{recipientName ? `${recipientName} acabou de abrir` : "Alguém acabou de abrir"} a página que você criou. Agora é só esperar a reação 🥹</P>
      <Section style={{ textAlign: "center", margin: "20px 0" }}>
        <CtaButton href={pageUrl}>Ver a página</CtaButton>
      </Section>
      <P muted>Você pode desligar este aviso no editor, em Configurações.</P>
    </EmailLayout>
  );
}

export function ProposalAnswerEmail({ answer, question, recipientName }: { answer: "yes" | "no"; question: string; recipientName: string }) {
  const yes = answer === "yes";
  return (
    <EmailLayout preview={yes ? "💍 A resposta chegou: SIM!" : "A resposta do seu pedido chegou"}>
      <H1>{yes ? "💍 A resposta foi SIM!" : "A resposta do seu pedido chegou"}</H1>
      <P>
        À pergunta “{question}”, {recipientName || "seu amor"} respondeu: <strong>{yes ? "SIM! 🎉" : "não"}</strong>.
      </P>
      <P>{yes ? "Parabéns! Que venham muitos capítulos lindos dessa história. 💖" : "Às vezes o tempo certo ainda não chegou. Cuide do seu coração. 💕"}</P>
    </EmailLayout>
  );
}

export function CouponRedeemedEmail({ couponTitle, recipientName }: { couponTitle: string; recipientName: string }) {
  return (
    <EmailLayout preview={`🎟️ Vale resgatado: ${couponTitle}`}>
      <H1>🎟️ Um vale foi resgatado!</H1>
      <P>
        {recipientName || "Seu amor"} resgatou o vale <strong>“{couponTitle}”</strong>. Hora de cumprir a promessa 😉
      </P>
    </EmailLayout>
  );
}

export function GuestbookEmail({ message, name, editUrl }: { message: string; name: string; editUrl: string }) {
  return (
    <EmailLayout preview="📝 Você recebeu um recadinho">
      <H1>📝 Você recebeu um recado</H1>
      <P>{name ? `${name} deixou` : "Deixaram"} um recado na sua página:</P>
      <Section style={{ backgroundColor: colors.paper, borderRadius: 12, padding: "14px 18px", margin: "8px 0 18px", borderLeft: `4px solid ${colors.rose}` }}>
        <P>{message}</P>
      </Section>
      <P muted>
        Os recados ficam guardados no seu editor: <a href={editUrl} style={{ color: colors.rose }}>abrir</a>.
      </P>
    </EmailLayout>
  );
}

export function PixCreatedEmail({ pixCode, amount, expiresText, resumeUrl }: { pixCode: string; amount: string; expiresText: string; resumeUrl: string }) {
  return (
    <EmailLayout preview={`Seu Pix de ${amount} foi gerado`}>
      <H1>Seu Pix foi gerado</H1>
      <P>
        Valor: <strong>{amount}</strong> · {expiresText}
      </P>
      <P>Copie o código abaixo e cole no app do seu banco, na opção “Pix copia e cola”:</P>
      <Section style={{ backgroundColor: colors.paper, borderRadius: 12, padding: 14, wordBreak: "break-all", fontFamily: "monospace", fontSize: 12 }}>{pixCode}</Section>
      <Section style={{ textAlign: "center", margin: "20px 0" }}>
        <CtaButton href={resumeUrl}>Voltar para o pagamento</CtaButton>
      </Section>
      <P muted>Assim que o pagamento for confirmado, você recebe o link da página por aqui.</P>
    </EmailLayout>
  );
}

export const EMAIL_TEMPLATES = {
  payment_approved: { component: PaymentApprovedEmail, subject: () => "🎉 Sua página está pronta!" },
  continue_draft: { component: ContinueDraftEmail, subject: () => "Continue criando sua página 💕" },
  my_pages: { component: MyPagesEmail, subject: () => `Seu acesso ao ${BRAND.name}` },
  page_opened: { component: PageOpenedEmail, subject: () => "💌 Sua página foi aberta!" },
  proposal_answer: { component: ProposalAnswerEmail, subject: (p: { answer: string }) => (p.answer === "yes" ? "💍 A resposta foi SIM!" : "A resposta do seu pedido chegou") },
  coupon_redeemed: { component: CouponRedeemedEmail, subject: (p: { couponTitle: string }) => `🎟️ Vale resgatado: ${p.couponTitle}` },
  guestbook: { component: GuestbookEmail, subject: () => "📝 Você recebeu um recado" },
  pix_created: { component: PixCreatedEmail, subject: () => "Seu Pix foi gerado — finalize sua página" },
} as const;

export type EmailTemplateName = keyof typeof EMAIL_TEMPLATES;
export type EmailProps<T extends EmailTemplateName> = Parameters<(typeof EMAIL_TEMPLATES)[T]["component"]>[0];
