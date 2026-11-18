import { normalizeArabicNumbers } from './locale.ts';
import enAssistant from '../locales/en/assistant.json' with { type: 'json' };
import arAssistant from '../locales/ar/assistant.json' with { type: 'json' };
import simpleAssistant from '../locales/ar-simple/assistant.json' with { type: 'json' };

export type AssistantCategory = 'cash' | 'gold' | 'stocks' | 'funds' | 'crypto' | 'ipo' | 'private' | 'lent' | 'bonds' | 'property' | 'debt';
export type AssistantLanguage = 'en' | 'ar' | 'ar-simple';
export type AssistantCommand = 'save' | 'start' | 'confirmStart';

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

const arabicToken = (terms: string) => `(?:^|[^\\p{L}])(?:${terms})(?=$|[^\\p{L}])`;
const categoryPatterns: [AssistantCategory, RegExp][] = [
  ['debt', new RegExp(`\\b(mortgage|owe|debt|credit card|borrowed)\\b|${arabicToken('رهن عقاري|بطاقة ائتمان|مديون|ادين|(?:ال)?دين|(?:ال)?ديون|اقترضت|استلفت')}`, 'iu')],
  ['lent', new RegExp(`\\b(lent|loaned|money owed to me)\\b|${arabicToken('اقرضت|سلفت|اموال اقرضتها|مستحق لي')}`, 'iu')],
  ['gold', new RegExp(`\\b(gold|jewell?ery|karat|carat)\\b|${arabicToken('(?:ال)?ذهب|مجوهرات|عيار')}`, 'iu')],
  ['ipo', new RegExp(`\\bipo\\b|${arabicToken('(?:ال)?اكتتاب(?: عام)?')}`, 'iu')],
  ['crypto', new RegExp(`\\b(bitcoin|btc|ethereum|eth|crypto|solana)\\b|${arabicToken('بيتكوين|بتكوين|ايثيريوم|عملة رقمية|سولانا')}`, 'iu')],
  ['bonds', new RegExp(`\\b(bond|bonds|sukuk)\\b|${arabicToken('سندات|صكوك')}`, 'iu')],
  ['funds', new RegExp(`\\b(fund|funds|etf)\\b|${arabicToken('صندوق|صناديق|صناديق استثمار')}`, 'iu')],
  ['property', new RegExp(`\\b(property|apartment|house|land)\\b|${arabicToken('عقار|عقارات|شقة|شقق|منزل|منازل|(?:ال)?ارض|اراضي')}`, 'iu')],
  ['private', new RegExp(`\\b(relative|family|cousin|brother|sister|private|business)\\b|${arabicToken('استثمار خاص|مشروع خاص|قريب(?:ي|تي|نا|هم)?|اقاربي|اقاربنا|عائلتي|اخي|اختي')}`, 'iu')],
  ['stocks', new RegExp(`\\b(stock|stocks|shares|aapl|apple|tesla|nvda|msft)\\b|${arabicToken('(?:ال)?اسهم|(?:ال)?سهم')}`, 'iu')],
  ['cash', new RegExp(`\\b(cash|savings|deposit|bank balance)\\b|${arabicToken('نقد(?:ا|ي)?|مدخرات|توفير|رصيد بنكي')}`, 'iu')],
];

const arabicSaveCommand = 'أؤكد حفظ هذا السجل';
const arabicStartCommand = 'ابدأ سجلاتي الشخصية';
const arabicConfirmStartCommand = 'أؤكد بدء سجلاتي الشخصية';
const guideCatalogs = { en: enAssistant, ar: arAssistant, 'ar-simple': {
  ...arAssistant, guide: { ...arAssistant.guide, ...simpleAssistant.guide },
} };
const debtByAmount = /(?:^|[^\p{L}])علي(?=\s*(?:\d|مبلغ|رصيد|دين|ديون|قرض|بطاقة))/iu;

/** Only exact, explicit Arabic phrases authorize an action; a generic yes never does. */
export function assistantCommand(text: string, language: AssistantLanguage): AssistantCommand | null {
  const command = text.trim();
  if (language.startsWith('ar')) {
    if (command === arabicSaveCommand) return 'save';
    if (command === arabicStartCommand) return 'start';
    if (command === arabicConfirmStartCommand) return 'confirmStart';
    return null;
  }
  if (/^(confirm and save|save this|yes,? save it)$/i.test(command)) return 'save';
  if (/^start my own records$/i.test(command)) return 'start';
  if (/^confirm start my own records$/i.test(command)) return 'confirmStart';
  return null;
}

function canonicalArabic(text: string): string {
  return text.replace(/[\u064b-\u065f\u0670\u0640]/g, '')
    .replace(/[أإآٱ]/g, 'ا').replace(/ى/g, 'ي');
}

function guideReply(language: AssistantLanguage, key: 'advice' | 'help' | 'missing' | 'ready', missing: ('name' | 'value' | 'valuationDate' | 'agreementType')[] = []): string {
  const catalog = guideCatalogs[language].guide;
  const fields = missing.map((field) => catalog.fields[field]).join(catalog.fieldSeparator);
  return catalog[key].replace('{{fields}}', fields);
}

function amount(text: string): number | undefined {
  const clean = normalizeArabicNumbers(text).replace(/[\s٬,]/g, '').trim();
  const match = clean.match(/^(\d+(?:\.\d{1,8})?)\s*(k|million|m|الف|مليون)?$/i);
  if (!match) return undefined;
  const n = Number(match[1]) * (/^(k|الف)$/i.test(match[2] ?? '') ? 1000 : /^(m|million|مليون)$/i.test(match[2] ?? '') ? 1_000_000 : 1);
  return Number.isFinite(n) && n >= 0 && n <= 1e12 ? n : undefined;
}

/** A deliberately bounded, local guide. It is not a pretend language model. */
export function guideMessage(text: string, previous: AssistantDraft | null, baseCurrency: string, language: AssistantLanguage = 'en'): { reply: string; draft: AssistantDraft | null } {
  const message = normalizeArabicNumbers(text.trim().slice(0, 4000));
  const searchable = canonicalArabic(message);
  if (/\b(buy|sell|invest)\b.*\b(should|recommend|best)\b|\b(should|recommend|best)\b.*\b(buy|sell|invest)\b|هل (?:اشتري|ابيع|استثمر)|(?:تنصحني|توصيني) (?:ب?ال)?(?:شراء|بيع|استثمار)|افضل استثمار/i.test(searchable)) {
    return { reply: guideReply(language, 'advice'), draft: previous };
  }
  const found = categoryPatterns.find(([, pattern]) => pattern.test(searchable))?.[0]
    ?? (debtByAmount.test(searchable) ? 'debt' : undefined);
  if (!found && !previous) {
    return { reply: guideReply(language, 'help'), draft: null };
  }
  const d: AssistantDraft = { ...(previous ?? {}), details: { ...(previous?.details ?? {}) } };
  if (found) d.category = found;
  const currencyCodes = message.match(/\b(AED|USD|SAR|EUR|GBP|INR|PKR|QAR|KWD|BHD|OMR|EGP)\b/i)?.[1]?.toUpperCase();
  const currencyArabic = /درهم(?: إماراتي)?|د\.إ/.test(searchable) ? 'AED'
    : /دولار(?: أمريكي)?/.test(searchable) ? 'USD'
      : /يورو/.test(searchable) ? 'EUR'
        : /جنيه استرليني/.test(searchable) ? 'GBP'
          : /روبية هندية/.test(searchable) ? 'INR'
            : /روبية باكستانية/.test(searchable) ? 'PKR'
              : /ريال سعودي/.test(searchable) ? 'SAR'
                : /ريال قطري/.test(searchable) ? 'QAR'
                  : /دينار كويتي/.test(searchable) ? 'KWD'
                    : /دينار بحريني/.test(searchable) ? 'BHD'
                      : /ريال عماني/.test(searchable) ? 'OMR'
                        : /جنيه مصري/.test(searchable) ? 'EGP' : undefined;
  const currency = currencyCodes ?? currencyArabic;
  if (currency) d.currency = currency;
  else if (!d.currency) d.currency = baseCurrency;
  const isoDate = message.match(/\b(\d{4}-\d{2}-\d{2})\b/)?.[1];
  if (isoDate && !Number.isNaN(Date.parse(isoDate)) && new Date(`${isoDate}T00:00:00.000Z`).toISOString().slice(0, 10) === isoDate) d.valuationDate = isoDate;
  if (/\btoday\b/i.test(message) || /اليوم/.test(searchable)) d.valuationDate = new Date().toISOString().slice(0, 10);
  const numberPattern = '(\\d[\\d,]*(?:\\.\\d+)?)';
  const currencyWords = '(?:AED|USD|SAR|EUR|GBP|INR|PKR|QAR|KWD|BHD|OMR|EGP|dhs|[$€£]|درهم(?: اماراتي)?|دولار(?: امريكي)?|يورو|جنيه(?: مصري| استرليني)|روبية(?: هندية| باكستانية)|ريال(?: سعودي| قطري| عماني)|دينار(?: كويتي| بحريني))?';
  const costMatch = searchable.match(new RegExp(`(?:paid|cost|for|contributed|invested|اشتريت(?:ها)? مقابل|مقابل|دفعت|تكلف|بمبلغ|استثمرت|اقرضت|سلفت)\\s*${currencyWords}\\s*${numberPattern}\\s*(k\\b|million\\b|الف|مليون)?`, 'i'));
  const lentCostMatch = d.category === 'lent'
    ? searchable.match(new RegExp(`(?:اقرضت|سلفت)\\s+[^\\d]{0,100}?${numberPattern}`, 'i'))
    : null;
  const valueMatch = searchable.match(new RegExp(`(?:worth|value(?: is)?|balance(?: is)?|outstanding(?: is)?|owe|قيمة|قيمته|قيمتها|يساوي|رصيده?|المبلغ المستحق|علي مبلغ|علي|ادين)\\s*${currencyWords}\\s*${numberPattern}\\s*(k\\b|million\\b|الف|مليون)?`, 'i'));
  if (costMatch) d.cost = amount(`${costMatch[1]}${costMatch[2] ?? ''}`);
  else if (lentCostMatch) d.cost = amount(lentCostMatch[1]);
  if (valueMatch) d.value = amount(`${valueMatch[1]}${valueMatch[2] ?? ''}`);
  if (/\b(value unknown|don't know (?:the )?(?:value|worth)|unknown value)\b/i.test(message) || /(?:القيمة|قيمتها|قيمته) غير معروفة|لا اعرف (?:القيمة|قيمتها|قيمته)|قيمة غير معروفة/.test(searchable)) d.value = null;
  const nameMatch = message.match(/(?:name(?: is)?|called|اسمه|اسمها|اسم|يسمى|تسمى)\s+["“]?([^"”\n.،]{1,100})/i);
  if (nameMatch) d.name = nameMatch[1].trim();
  if (d.category === 'gold') {
    const grams = message.match(/\b(\d+(?:\.\d+)?)\s*(?:g|grams?)\b|(\d+(?:\.\d+)?)\s*(?:جرام|غرام)/i);
    const purity = message.match(/\b(9|10|14|18|21|22|24)\s*(?:k|karat|carat)\b|عيار\s*(9|10|14|18|21|22|24)|(9|10|14|18|21|22|24)\s*قيراط/i);
    if (grams) d.details!.weightGrams = Number(grams[1] ?? grams[2]);
    if (purity) d.details!.purity = Number(purity[1] ?? purity[2] ?? purity[3]) / 24;
    if (!d.name) d.name = guideCatalogs[language].draftNames.gold;
  }
  if (d.category === 'private') {
    if (/\b(equity|ownership|own part|stake)\b/i.test(message) || /ملكية|حصة/.test(searchable)) d.details!.agreementType = 'equity';
    if (/\b(loan|repay|repayment)\b/i.test(message) || /قرض|سداد/.test(searchable)) d.details!.agreementType = 'loan';
    if (/\bgift\b/i.test(message) || /هدية/.test(searchable)) d.details!.agreementType = 'gift';
  }
  if (d.category === 'ipo') {
    if (/\b(applied|application|pending)\b/i.test(message) || /قدمت|طلب اكتتاب|بانتظار التخصيص/.test(searchable)) d.details!.status = 'applied';
    if (/\b(allocated|allotted|received shares)\b/i.test(message) || /تم تخصيص|خصصت لي|حصلت على الاسهم/.test(searchable)) d.details!.status = 'allocated';
  }
  if (!d.notes) d.notes = guideCatalogs[language].draftNotes;
  const missing: ('name' | 'value' | 'valuationDate' | 'agreementType')[] = [];
  if (d.category === 'private' && !d.details?.agreementType) missing.push('agreementType');
  if (!d.name) missing.push('name');
  if (d.value === undefined) missing.push('value');
  if (!d.valuationDate && d.value != null) missing.push('valuationDate');
  return {
    reply: missing.length
        ? guideReply(language, 'missing', missing.slice(0, 1))
      : guideReply(language, 'ready'),
    draft: d,
  };
}
