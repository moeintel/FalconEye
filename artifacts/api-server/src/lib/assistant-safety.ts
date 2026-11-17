const forbiddenEnglishAdvice = /\b(I recommend|you should (?:buy|sell|hold|invest|allocate)|consider (?:buying|selling|investing)|guaranteed returns?|portfolio strategy)\b/i;
const negatedArabicAdvice = /(?:لا\s+(?:(?:استطيع|يمكنني|يجوز لي)\s+)?(?:ان\s+)?(?:انصحك|انصح|اوصيك|اوصي)[^.!؟،;\n]*|لا\s+(?:توجد|يوجد|اضمن|اعدك\s+ب)\s+(?:لك\s+)?(?:اي\s+)?(?:عوائد|عائد|ارباح|ربح)\s+مضمون(?:ة|ون)?|(?:ليست|ليس)\s+(?:هناك\s+)?(?:عوائد|عائد|ارباح|ربح)\s+مضمون(?:ة|ون)?)/gu;
const forbiddenArabicAdvice = /(?:انصحك|انصح|اوصيك|اوصي)\s+(?:ب(?:ال)?(?:شراء|بيع)|(?:ان\s+)?(?:تشتري|تبيع))|يجب(?: عليك)?\s+(?:ان\s+)?(?:تشتري|تبيع|شراء|بيع)|(?:عوائد|عائد|ارباح|ربح)\s+مضمون(?:ة|ون)?/u;

/** A narrow output-content screen, not a complete semantic safety guarantee. */
export function hasForbiddenAssistantAdvice(reply: string): boolean {
  if (forbiddenEnglishAdvice.test(reply)) return true;
  const canonical = reply.normalize('NFC')
    .replace(/[\u064b-\u065f\u0670\u0640]/g, '')
    .replace(/[أإآٱ]/g, 'ا')
    .replace(/ى/g, 'ي');
  return forbiddenArabicAdvice.test(canonical.replace(negatedArabicAdvice, ' '));
}
