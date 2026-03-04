'use client';

import { PropertyAttributeDefinition } from '@/lib/types';
import Input from '@/components/ui/Input';

interface CustomAttributeFieldProps {
  definition: PropertyAttributeDefinition;
  value: string | number | boolean | null | undefined;
  onChange: (definitionId: number, value: string | number | boolean | null) => void;
}

export default function CustomAttributeField({ definition, value, onChange }: CustomAttributeFieldProps) {
  const { id, name, attribute_type, options, is_required } = definition;

  if (attribute_type === 'boolean') {
    return (
      <label className="flex items-center gap-2 cursor-pointer">
        <input
          type="checkbox"
          checked={value === true}
          onChange={(e) => onChange(id, e.target.checked)}
          className="rounded border-gray-300"
        />
        <span className="text-sm font-medium text-gray-700">{name}</span>
      </label>
    );
  }

  if (attribute_type === 'dropdown') {
    return (
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">{name}{is_required && ' *'}</label>
        <select
          value={(value as string) || ''}
          onChange={(e) => onChange(id, e.target.value || null)}
          required={is_required}
          className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
        >
          <option value="">Select...</option>
          {options?.map((opt) => (
            <option key={opt} value={opt}>{opt}</option>
          ))}
        </select>
      </div>
    );
  }

  if (attribute_type === 'number') {
    return (
      <Input
        label={name + (is_required ? ' *' : '')}
        type="number"
        value={value !== null && value !== undefined ? String(value) : ''}
        onChange={(e) => onChange(id, e.target.value ? Number(e.target.value) : null)}
        required={is_required}
      />
    );
  }

  // Default: text
  return (
    <Input
      label={name + (is_required ? ' *' : '')}
      type="text"
      value={(value as string) || ''}
      onChange={(e) => onChange(id, e.target.value || null)}
      required={is_required}
    />
  );
}
