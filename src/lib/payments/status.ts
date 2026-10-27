import type { OrderStatus } from "@prisma/client";
import type { ProviderStatus } from "./types";

export function mapStatus(status: ProviderStatus, statusDetail: string | null, method: "pix" | "card"): OrderStatus {
  switch (status) {
    case "approved":
      return "APPROVED";
    case "rejected":
      return "REJECTED";
    case "cancelled":
      return method === "pix" && (statusDetail === "expired" || statusDetail === null) ? "EXPIRED" : "CANCELLED";
    case "refunded":
      return "REFUNDED";
    case "charged_back":
      return "CHARGED_BACK";
    default:
      return "PENDING";
  }
}

/** Mensagens amigáveis para recusas de cartão (status_detail do Mercado Pago). */
const REJECTIONS: Record<string, string> = {
  cc_rejected_bad_filled_card_number: "Confira o número do cartão.",
  cc_rejected_bad_filled_date: "Confira a data de validade do cartão.",
  cc_rejected_bad_filled_security_code: "Confira o código de segurança (CVV).",
  cc_rejected_bad_filled_other: "Confira os dados do cartão.",
  cc_rejected_blacklist: "Não foi possível processar este cartão. Tente outro cartão ou pague com Pix.",
  cc_rejected_call_for_authorize: "Seu banco pediu autorização para este pagamento. Ligue para o banco e tente de novo, ou pague com Pix.",
  cc_rejected_card_disabled: "Seu cartão não está ativo. Ligue para o banco ou use outro cartão.",
  cc_rejected_card_error: "Não conseguimos processar o cartão. Tente novamente ou use Pix.",
  cc_rejected_duplicated_payment: "Você já fez um pagamento com este valor. Se precisar pagar de novo, use outro cartão ou Pix.",
  cc_rejected_high_risk: "O pagamento foi recusado por segurança. Tente pagar com Pix — é aprovado na hora.",
  cc_rejected_insufficient_amount: "Limite insuficiente. Tente outro cartão, menos parcelas ou Pix.",
  cc_rejected_invalid_installments: "Este cartão não aceita essa quantidade de parcelas.",
  cc_rejected_max_attempts: "Você atingiu o limite de tentativas. Use outro cartão ou Pix.",
  cc_rejected_other_reason: "Seu banco recusou o pagamento. Tente outro cartão ou pague com Pix.",
  cc_amount_rate_limit_exceeded: "O valor ultrapassa o limite deste cartão. Tente outro cartão ou Pix.",
  pending_contingency: "Estamos processando o pagamento. Em até 2 dias úteis você recebe a confirmação por e-mail.",
  pending_review_manual: "Seu pagamento está em análise. Você recebe a confirmação por e-mail em breve.",
};

export function friendlyStatusMessage(statusDetail: string | null | undefined): string {
  if (!statusDetail) return "Não foi possível concluir o pagamento. Tente novamente ou use Pix.";
  return REJECTIONS[statusDetail] ?? "Não foi possível concluir o pagamento. Tente novamente ou use Pix.";
}
