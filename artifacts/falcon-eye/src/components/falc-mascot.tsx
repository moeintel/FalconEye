export function FalcMascot({ className = '', speaking = false }: { className?: string; speaking?: boolean }) {
  return (
    <svg viewBox="0 0 120 120" role="img" aria-label="Falc, your financial-record assistant" className={className}>
      <circle cx="60" cy="60" r="58" fill="#FFF1CF" />
      <path d="M27 61 12 45q1 33 23 43m58-27 15-16q-1 33-23 43" fill="#315F65" />
      <path d="M30 35 26 15l24 13q10-3 20 0l24-13-4 20q11 13 10 35-2 35-40 36-38-1-40-36-1-22 10-35" fill="#173D46" />
      <path d="M31 46q13-11 29 6 16-17 29-6l-4 27q-6 23-25 26-19-3-25-26Z" fill="#FCF8EA" />
      <path d="m26 39 27 10-14 1m55-11L67 49l14 1" fill="#E9AE42" />
      <ellipse cx="43" cy="59" rx="7" ry={speaking ? 8 : 7} fill="#173D46" />
      <ellipse cx="77" cy="59" rx="7" ry="7" fill="#173D46" />
      <circle cx="45" cy="56" r="2" fill="#FFF" /><circle cx="79" cy="56" r="2" fill="#FFF" />
      <path d="m51 68 9-7 9 7-9 12Z" fill="#E9AE42" />
      <path d="M43 88q17 9 34 0" stroke="#D8E1D4" strokeWidth="3" fill="none" strokeLinecap="round" />
      <path d="m43 106-5 5m12-5-1 6m21-6 1 6m6-6 5 5" stroke="#E9AE42" strokeWidth="5" strokeLinecap="round" />
    </svg>
  );
}
