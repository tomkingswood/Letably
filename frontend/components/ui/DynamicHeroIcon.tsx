import * as HeroIconsOutline from '@heroicons/react/24/outline';
import * as HeroIconsSolid from '@heroicons/react/24/solid';

interface DynamicHeroIconProps {
  icon: string;
  className?: string;
  solid?: boolean;
}

/**
 * Dynamically renders a Heroicon based on the icon name
 * Supports both outline (default) and solid variants
 *
 * Icon names should use kebab-case (e.g., 'shield-check', 'light-bulb')
 * and will be converted to PascalCase for the component lookup
 */
export default function DynamicHeroIcon({ icon, className = 'w-5 h-5', solid = false }: DynamicHeroIconProps) {
  // Convert kebab-case to PascalCase (e.g., 'shield-check' -> 'ShieldCheckIcon')
  const iconName = icon
    .split('-')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join('') + 'Icon';

  // Get the icon from the appropriate set
  const IconComponent = solid
    ? (HeroIconsSolid as any)[iconName]
    : (HeroIconsOutline as any)[iconName];

  // Fallback to a default icon if not found
  if (!IconComponent) {
    console.warn(`Icon "${icon}" (${iconName}) not found in Heroicons`);
    const FallbackIcon = HeroIconsOutline.DocumentTextIcon;
    return <FallbackIcon className={className} />;
  }

  return <IconComponent className={className} />;
}
