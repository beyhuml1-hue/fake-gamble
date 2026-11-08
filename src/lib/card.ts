export const DEMO_CARD = {
  number: "4242424242424242",
  display: "4242 4242 4242 4242",
  exp: "12/28",
  cvc: "123",
  holder: "Alex Morgan",
};

export const CARD_START_CENTS = 2_300;

export function digits(value: string) {
  return value.replace(/\D/g, "");
}

export function cardMatches(number: string, exp: string, cvc: string) {
  return digits(number) === DEMO_CARD.number && exp.trim() === DEMO_CARD.exp && digits(cvc) === DEMO_CARD.cvc;
}
