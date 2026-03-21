export function LogoMark() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, justifyContent: 'center', marginBottom: 32 }}>
      <svg width="36" height="36" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
        <g transform="translate(16,18)">
          <ellipse cx="0"   cy="-11" rx="3.5" ry="9"   fill="#4F6FBF" opacity="0.85"/>
          <ellipse cx="9"   cy="-6"  rx="3.5" ry="8.5" fill="#4F6FBF" opacity="0.7"  transform="rotate(38 9 -6)"/>
          <ellipse cx="-9"  cy="-6"  rx="3.5" ry="8.5" fill="#4F6FBF" opacity="0.7"  transform="rotate(-38 -9 -6)"/>
          <ellipse cx="13"  cy="1"   rx="3"   ry="7"   fill="#7B9FD4" opacity="0.45" transform="rotate(65 13 1)"/>
          <ellipse cx="-13" cy="1"   rx="3"   ry="7"   fill="#7B9FD4" opacity="0.45" transform="rotate(-65 -13 1)"/>
          <circle cx="0" cy="-5" r="4.5" fill="#0F0A2E"/>
          <circle cx="0" cy="-5" r="2.8" fill="#D4AF37"/>
          <circle cx="0" cy="-5" r="1.2" fill="#0F0A2E"/>
          <line x1="0" y1="0" x2="0" y2="9" stroke="#4F6FBF" strokeWidth="1.5" strokeLinecap="round"/>
          <line x1="-6" y1="9" x2="6" y2="9" stroke="#4F6FBF" strokeWidth="1" strokeLinecap="round" opacity="0.5"/>
        </g>
      </svg>
      <span style={{ fontSize: 17, fontWeight: 600, color: 'var(--ec-text-1)', letterSpacing: '-0.03em' }}>
        event<span style={{ color: '#D4AF37' }}>craft</span>
      </span>
    </div>
  );
}
