import { BRAND } from "@/config";

export const metadata = { title: "Política de Privacidade" };

export default function PrivacyPage() {
  return (
    <>
      <h1>Política de Privacidade</h1>
      <p>Última atualização: [DATA]</p>
      <p>Esta Política explica como o {BRAND.name} ([RAZÃO SOCIAL], CNPJ [CNPJ]) trata dados pessoais, em conformidade com a Lei Geral de Proteção de Dados (Lei nº 13.709/2018 — LGPD).</p>
      <h2>1. Dados que coletamos</h2>
      <ul>
        <li><strong>E-mail</strong>: informado no pagamento, para enviar o link da página, o link de edição e avisos (ex.: “sua página foi aberta”).</li>
        <li><strong>Conteúdo da página</strong>: textos, fotos, datas, locais e músicas que você inserir.</li>
        <li><strong>Dados de pagamento</strong>: processados pelo Mercado Pago. Não armazenamos números de cartão.</li>
        <li><strong>Dados técnicos</strong>: endereço IP (armazenado apenas de forma irreversível — hash), para segurança e prevenção de abuso.</li>
      </ul>
      <h2>2. Fotos</h2>
      <p>Removemos automaticamente os metadados das fotos (EXIF), incluindo a localização GPS, antes de armazená-las.</p>
      <h2>3. Para que usamos</h2>
      <ul>
        <li>Prestar o serviço contratado (base legal: execução de contrato).</li>
        <li>Segurança e prevenção a fraudes (base legal: legítimo interesse).</li>
        <li>Cumprimento de obrigações legais e fiscais.</li>
      </ul>
      <h2>4. Compartilhamento</h2>
      <p>Com operadores necessários ao serviço: Mercado Pago (pagamentos), Resend (e-mails), provedor de armazenamento [Cloudflare R2/AWS S3], Anthropic (geração de textos por IA, quando você usa esse recurso) e provedor de hospedagem [PROVEDOR].</p>
      <h2>5. Retenção</h2>
      <ul>
        <li>Rascunhos não pagos e suas fotos são apagados automaticamente após 30 dias.</li>
        <li>Páginas pagas ficam armazenadas pelo período do plano ou até você excluí-las.</li>
      </ul>
      <h2>6. Seus direitos</h2>
      <p>Você pode acessar, corrigir e excluir seus dados. A exclusão da página e de todas as fotos pode ser feita pelo próprio editor (link de edição → Configurações → Excluir página). Para outros pedidos, escreva para {BRAND.supportEmail}.</p>
      <h2>7. Encarregado (DPO)</h2>
      <p>[NOME DO ENCARREGADO] — [E-MAIL DO DPO]</p>
    </>
  );
}
