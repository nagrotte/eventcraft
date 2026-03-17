export function LogoMark() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, justifyContent: 'center', marginBottom: 32 }}>
      <div className="ec-logo-mark" style={{ width: 36, height: 36 }}>
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
          <path d="M3 8.5L6.5 12L13 4" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </div>
      <span style={{ fontSize: 17, fontWeight: 600, color: 'var(--ec-text-1)', letterSpacing: '-0.03em' }}>
        EventCraft
      </span>
    </div>
  );
}
