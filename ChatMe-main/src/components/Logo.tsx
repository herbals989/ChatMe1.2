type LogoProps = {
  size?: number;
  className?: string;
};

export function Logo({ size = 40, className = '' }: LogoProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      <rect width="48" height="48" rx="12" fill="#10B981" />
      <rect width="48" height="48" rx="12" fill="url(#logo-gradient)" />
      <path
        d="M12 17.5C12 15.567 13.567 14 15.5 14H24.5C26.433 14 28 15.567 28 17.5V22.5C28 24.433 26.433 26 24.5 26H21V29.5C21 29.8 20.66 29.97 20.41 29.8L16 26H15.5C13.567 26 12 24.433 12 22.5V17.5Z"
        fill="white"
      />
      <path
        d="M20 25.5C20 23.567 21.567 22 23.5 22H32.5C34.433 22 36 23.567 36 25.5V30.5C36 32.433 34.433 34 32.5 34H32L27.59 37.8C27.34 37.97 27 37.8 27 37.5V34H23.5C21.567 34 20 32.433 20 30.5V25.5Z"
        fill="white"
        fillOpacity="0.85"
      />
      <circle cx="17" cy="20" r="1.3" fill="#10B981" />
      <circle cx="22" cy="20" r="1.3" fill="#10B981" />
      <circle cx="25" cy="28" r="1.3" fill="#10B981" />
      <circle cx="30" cy="28" r="1.3" fill="#10B981" />
      <defs>
        <linearGradient id="logo-gradient" x1="0" y1="0" x2="48" y2="48" gradientUnits="userSpaceOnUse">
          <stop stopColor="#10B981" />
          <stop offset="1" stopColor="#059669" />
        </linearGradient>
      </defs>
    </svg>
  );
}

export function LogoMark({ size = 40, className = '' }: LogoProps) {
  return <Logo size={size} className={className} />;
}
