export type AssistantCategory = 'cash' | 'gold' | 'stocks' | 'funds' | 'crypto' | 'ipo' | 'private' | 'lent' | 'bonds' | 'property' | 'debt';
export interface AssistantDraft {
  category?: AssistantCategory;
  name?: string;
  currency?: string;
  cost?: number | null;
  value?: number | null;
  valuationDate?: string;
  valuationSource?: 'manual' | 'statement' | 'estimate';
  access?: 'available' | 'restricted' | 'unknown';
  location?: string;
  notes?: string;
  details?: Record<string, string | number | null>;
}

const patterns: [AssistantCategory, RegExp][] = [
  ['debt', /\b(mortgage|owe|debt|credit card|borrowed)\b/i],
  ['lent', /\b(lent|loaned|money owed to me)\b/i],
  ['gold', /\b(gold|jewell?ery|karat|carat)\b/i],
  ['ipo', /\bipo\b/i],
  ['crypto', /\b(bitcoin|btc|ethereum|eth|crypto|solana)\b/i],
  ['bonds', /\b(bond|bonds|sukuk)\b/i],
  ['funds', /\b(fund|funds|etf)\b/i],
  ['property', /\b(property|apartment|house|land)\b/i],
  ['private', /\b(relative|family|cousin|brother|sister|private|business)\b/i],
  ['stocks', /\b(stock|stocks|shares|aapl|apple|tesla|nvda|msft)\b/i],
  ['cash', /\b(cash|savings|deposit|bank balance)\b/i],
];

function amount(text: string): number | undefined {
  const clean = text.replace(/,/g, '').trim();
  const match = clean.match(/^(\d+(?:\.\d{1,8})?)\s*(k|million|m)?$/i);
  if (!match) return undefined;
  const n = Number(match[1]) * (/^k$/i.test(match[2] ?? '') ? 1000 : /^(m|million)$/i.test(match[2] ?? '') ? 1_000_000 : 1);
  return Number.isFinite(n) && n >= 0 && n <= 1e12 ? n : undefined;
}

/** A deliberately bounded, local guide. It is not a pretend language model. */
export function guideMessage(text: string, previous: AssistantDraft | null, baseCurrency: string): { reply: string; draft: AssistantDraft | null } {
  const message = text.trim().slice(0, 4000);
  if (/\b(buy|sell|invest)\b.*\b(should|recommend|best)\b|\b(should|recommend|best)\b.*\b(buy|sell|invest)\b/i.test(message)) {
    return { reply: 'I can help record and explain your finances, but I cannot recommend what to buy or sell. Tell me about something you already own or owe.', draft: previous };
  }
  const found = patterns.find(([, pattern]) => pattern.test(message))?.[0];
  if (!found && !previous) {
    return { reply: 'Tell me the kind of item: gold, cash, stocks, an IPO, crypto, a private investment, money lent, or a debt. For example: “I bought 20g of 22k gold for AED 5,000.” I only prepare a draft; you review and save it.', draft: null };
  }
  const d: AssistantDraft = { ...(previous ?? {}), details: { ...(previous?.details ?? {}) } };
  if (found) d.category = found;
  const currency = message.match(/\b(AED|USD|SAR|EUR|GBP|INR|PKR|QAR|KWD|BHD|OMR|EGP)\b/i)?.[1]?.toUpperCase();
  if (currency) d.currency = currency;
  else if (!d.currency) d.currency = baseCurrency;
  const isoDate = message.match(/\b(\d{4}-\d{2}-\d{2})\b/)?.[1];
  if (isoDate && !Number.isNaN(Date.parse(isoDate))) d.valuationDate = isoDate;
  if (/\btoday\b/i.test(message)) d.valuationDate = new Date().toISOString().slice(0, 10);
  const numberPattern = '(\\d[\\d,]*(?:\\.\\d+)?)';
  const costMatch = message.match(new RegExp(`(?:paid|cost|for|contributed|invested)\\s*(?:AED|USD|SAR|EUR|GBP|INR|PKR|QAR|KWD|BHD|OMR|EGP|dhs|[$€£])?\\s*${numberPattern}\\s*(k\\b|million\\b)?`, 'i'));
  const valueMatch = message.match(new RegExp(`(?:worth|value(?: is)?|balance(?: is)?|outstanding(?: is)?|owe)\\s*(?:AED|USD|SAR|EUR|GBP|INR|PKR|QAR|KWD|BHD|OMR|EGP|dhs|[$€£])?\\s*${numberPattern}\\s*(k\\b|million\\b)?`, 'i'));
  if (costMatch) d.cost = amount(`${costMatch[1]}${costMatch[2] ?? ''}`);
  if (valueMatch) d.value = amount(`${valueMatch[1]}${valueMatch[2] ?? ''}`);
  if (/\b(value unknown|don't know (?:the )?(?:value|worth)|unknown value)\b/i.test(message)) d.value = null;
  const nameMatch = message.match(/(?:name(?: is)?|called)\s+["“]?([^"”\n.]{1,100})/i);
  if (nameMatch) d.name = nameMatch[1].trim();
  if (d.category === 'gold') {
    const grams = message.match(/\b(\d+(?:\.\d+)?)\s*(?:g|grams?)\b/i);
    const purity = message.match(/\b(9|10|14|18|21|22|24)\s*(?:k|karat|carat)\b/i);
    if (grams) d.details!.weightGrams = Number(grams[1]);
    if (purity) d.details!.purity = Number(purity[1]) / 24;
    if (!d.name) d.name = 'Physical gold';
  }
  if (d.category === 'private') {
    if (/\b(equity|ownership|own part|stake)\b/i.test(message)) d.details!.agreementType = 'equity';
    if (/\b(loan|repay|repayment)\b/i.test(message)) d.details!.agreementType = 'loan';
    if (/\bgift\b/i.test(message)) d.details!.agreementType = 'gift';
  }
  if (d.category === 'ipo') {
    if (/\b(applied|application|pending)\b/i.test(message)) d.details!.status = 'applied';
    if (/\b(allocated|allotted|received shares)\b/i.test(message)) d.details!.status = 'allocated';
  }
  if (!d.notes) d.notes = 'Prepared in guided chat. Confirm the details before saving.';
  const missing: string[] = [];
  if (!d.name) missing.push('a name');
  if (d.value === undefined) missing.push('a current value (or mark it unknown)');
  if (!d.valuationDate && d.value != null) missing.push('the valuation date');
  if (d.category === 'private' && !d.details?.agreementType) missing.push('whether this is ownership, a loan, or a gift');
  return {
    reply: missing.length
      ? `I have started a draft. Please add ${missing.join(', ')}. You can reply here or edit the review card below. Nothing has been saved.`
      : 'Your draft is ready to review below. Check the category, currency, amount, and date, then choose “Confirm and save”. Nothing is saved until you confirm.',
    draft: d,
  };
}
