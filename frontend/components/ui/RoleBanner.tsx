import { ReactNode } from 'react';

const ROLE_STYLES: Record<string, { bgClass: string }> = {
  admin: { bgClass: 'bg-primary' },
  landlord: { bgClass: 'bg-green-600' },
  tenant: { bgClass: 'bg-blue-600' },
};

const ADMIN_ICON = (
  <svg className="w-5 h-5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
    <path fillRule="evenodd" d="M11.49 3.17c-.38-1.56-2.6-1.56-2.98 0a1.532 1.532 0 01-2.286.948c-1.372-.836-2.942.734-2.106 2.106.54.886.061 2.042-.947 2.287-1.561.379-1.561 2.6 0 2.978a1.532 1.532 0 01.947 2.287c-.836 1.372.734 2.942 2.106 2.106a1.532 1.532 0 012.287.947c.379 1.561 2.6 1.561 2.978 0a1.533 1.533 0 012.287-.947c1.372.836 2.942-.734 2.106-2.106a1.533 1.533 0 01.947-2.287c1.561-.379 1.561-2.6 0-2.978a1.532 1.532 0 01-.947-2.287c.836-1.372-.734-2.942-2.106-2.106a1.532 1.532 0 01-2.287-.947zM10 13a3 3 0 100-6 3 3 0 000 6z" clipRule="evenodd"/>
  </svg>
);

const HOME_ICON = (
  <svg className="w-5 h-5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
    <path d="M10.707 2.293a1 1 0 00-1.414 0l-7 7a1 1 0 001.414 1.414L4 10.414V17a1 1 0 001 1h2a1 1 0 001-1v-2a1 1 0 011-1h2a1 1 0 011 1v2a1 1 0 001 1h2a1 1 0 001-1v-6.586l.293.293a1 1 0 001.414-1.414l-7-7z"/>
  </svg>
);

export function RoleIcon({ role }: { role: string }) {
  return role === 'admin' ? ADMIN_ICON : HOME_ICON;
}

interface RoleBannerProps {
  role: string;
  /** Override background with inline style (e.g. dynamic agency color) */
  bgStyle?: React.CSSProperties;
  children: ReactNode;
}

export function RoleBanner({ role, bgStyle, children }: RoleBannerProps) {
  const style = ROLE_STYLES[role] || ROLE_STYLES.tenant;

  return (
    <div className={bgStyle ? '' : style.bgClass} style={bgStyle}>
      <div className="container mx-auto px-4">
        {children}
      </div>
    </div>
  );
}
