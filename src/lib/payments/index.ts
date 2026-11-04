/**
 * Zahlungen – Schnittstelle, damit später Stripe ohne Umbau eingesetzt werden kann.
 * Aktuell: StubProvider ("Zahlung kommt bald").
 */
export type PlanId = "start" | "pro";

export interface Plan {
  id: PlanId;
  /** Preis pro Mitarbeiter/Monat in Cent – null = Platzhalter "[ЦЕНА]" (in der Superadmin-Oberfläche pflegbar, Etappe 7) */
  pricePerEmployeeCents: number | null;
}

export interface CheckoutResult {
  status: "redirect" | "unavailable";
  url?: string;
}

export interface PaymentProvider {
  readonly name: string;
  createCheckout(input: { firmId: string; plan: PlanId; employees: number; returnUrl: string }): Promise<CheckoutResult>;
}

export class StubPaymentProvider implements PaymentProvider {
  readonly name = "stub";
  async createCheckout(): Promise<CheckoutResult> {
    return { status: "unavailable" };
  }
}

export function getPaymentProvider(): PaymentProvider {
  // später: if (process.env.STRIPE_SECRET_KEY) return new StripePaymentProvider(...)
  return new StubPaymentProvider();
}

/** Standard-Tarife; Preise werden in Etappe 7 aus der DB (Superadmin) gelesen */
export const DEFAULT_PLANS: Plan[] = [
  { id: "start", pricePerEmployeeCents: null },
  { id: "pro", pricePerEmployeeCents: null },
];
