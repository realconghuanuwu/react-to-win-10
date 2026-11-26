import type { SVGProps } from 'react';

export function Win10StartLogo(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 88 88" width="16" height="16" fill="currentColor" aria-hidden="true" {...props}>
      <path d="M0 12.402l35.687-4.86.016 34.423-35.67.203zm35.67 33.529l.028 34.453L.028 75.48.026 45.7zm4.326-39.025L87.314 0v41.527l-47.318.376zm47.329 39.349l-.011 41.34-47.318-6.678-.066-34.739z" />
    </svg>
  );
}

export function Win10SearchIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden="true" {...props}>
      <circle cx="14.5" cy="9.5" r="5.5" />
      <path d="M10.5 13.5L4 20" strokeLinecap="round" />
    </svg>
  );
}

export function Win10CortanaIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 20 20" width="17" height="17" fill="none" aria-hidden="true" {...props}>
      <circle cx="10" cy="10" r="7.2" stroke="currentColor" strokeWidth="2.1" opacity="0.95" />
      <circle cx="10" cy="10" r="3.6" stroke="#60cdff" strokeWidth="1.4" opacity="0.9" />
    </svg>
  );
}

export function Win10TaskViewIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 20 20" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.35" aria-hidden="true" {...props}>
      <rect x="4.5" y="4.5" width="9" height="8.5" rx="0.5" />
      <path d="M13.5 6.5H16.5V15H7.5V13" />
      <path d="M2.5 7V13M17.5 7V13" strokeLinecap="round" opacity="0.7" />
    </svg>
  );
}

export function Win10PeopleIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 20 20" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.35" aria-hidden="true" {...props}>
      <circle cx="7.5" cy="6.5" r="2.5" />
      <path d="M2.5 15.5C2.5 12.7 4.7 11 7.5 11C10.3 11 12.5 12.7 12.5 15.5" strokeLinecap="round" />
      <circle cx="13.5" cy="7.5" r="2" />
      <path d="M12.5 11.4C15 11.6 17 13.1 17 15.5" strokeLinecap="round" />
    </svg>
  );
}

export function Win10InkIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 20 20" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.35" aria-hidden="true" {...props}>
      <path d="M12.8 3.2L16.8 7.2L8.2 15.8L3.5 16.5L4.2 11.8L12.8 3.2Z" strokeLinejoin="round" />
      <path d="M10.8 5.2L14.8 9.2" />
      <path d="M9.5 16.5C11.5 16.5 12.5 14.5 14.5 14.5C15.8 14.5 16.6 15.5 17.5 16.5" strokeLinecap="round" />
    </svg>
  );
}

export function Win10TouchKeyboardIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 20 20" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.3" aria-hidden="true" {...props}>
      <rect x="2" y="5" width="16" height="10" rx="1" />
      <path d="M4.5 8H6M7.5 8H9M10.5 8H12M13.5 8H15.5" strokeLinecap="round" />
      <path d="M4.5 10.5H6M7.5 10.5H9M10.5 10.5H12M13.5 10.5H15.5" strokeLinecap="round" />
      <path d="M6 12.8H14" strokeLinecap="round" />
    </svg>
  );
}

export function Win10ChevronUpIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 16 16" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="1.4" aria-hidden="true" {...props}>
      <path d="M3.5 10L8 5.5L12.5 10" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function Win10WifiIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 20 20" width="16" height="16" fill="currentColor" aria-hidden="true" {...props}>
      <path d="M10 14.5a1.25 1.25 0 1 1 0 2.5 1.25 1.25 0 0 1 0-2.5zm-3.54-2.06a5 5 0 0 1 7.08 0 .65.65 0 0 1-.92.92 3.7 3.7 0 0 0-5.24 0 .65.65 0 0 1-.92-.92zm-2.47-2.48a8.5 8.5 0 0 1 12.02 0 .65.65 0 0 1-.92.92 7.2 7.2 0 0 0-10.18 0 .65.65 0 0 1-.92-.92zm-2.48-2.47a12 12 0 0 1 16.98 0 .65.65 0 1 1-.92.92 10.7 10.7 0 0 0-15.14 0 .65.65 0 0 1-.92-.92z" />
    </svg>
  );
}

export function Win10VolumeIcon({
  muted = false,
  level = 85,
  ...props
}: SVGProps<SVGSVGElement> & { muted?: boolean; level?: number }) {
  const isMuted = muted || level === 0;
  return (
    <svg viewBox="0 0 20 20" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.4" aria-hidden="true" {...props}>
      <path d="M3.5 7.75H6.5L10.5 4.25V15.75L6.5 12.25H3.5V7.75Z" strokeLinejoin="round" />
      {isMuted ? (
        <>
          <path d="M13 7.5L17 12.5" strokeLinecap="round" />
          <path d="M17 7.5L13 12.5" strokeLinecap="round" />
        </>
      ) : (
        <>
          {level > 0 && <path d="M13 7.5C14.1 8.6 14.1 11.4 13 12.5" strokeLinecap="round" />}
          {level >= 45 && <path d="M15.2 5.5C17.2 7.8 17.2 12.2 15.2 14.5" strokeLinecap="round" />}
        </>
      )}
    </svg>
  );
}

export function Win10ActionCenterIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 20 20" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.35" aria-hidden="true" {...props}>
      <path d="M3 4.5H17V13.5H9L5.5 16.5V13.5H3V4.5Z" strokeLinejoin="round" />
    </svg>
  );
}
