export function Asterisk({ className = "h-6 w-6" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
      <path d="M12 0c0 6 1 11 12 12-11 1-12 6-12 12 0-6-1-11-12-12C11 11 12 6 12 0Z" />
    </svg>
  );
}
