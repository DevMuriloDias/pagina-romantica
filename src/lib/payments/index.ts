import "server-only";
import { env } from "../env";
import { mercadoPago } from "./mercadopago";
import { mockProvider } from "./mock";
import type { PaymentProvider } from "./types";

export function paymentProvider(): PaymentProvider {
  return env().PAYMENTS_PROVIDER === "mercadopago" ? mercadoPago : mockProvider;
}
