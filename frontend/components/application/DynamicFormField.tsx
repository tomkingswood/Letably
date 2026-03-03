import { QuestionDefinition } from '@/lib/types';

interface DynamicFormFieldProps {
  question: QuestionDefinition;
  value: string | number | boolean;
  onChange: (key: string, value: string | number | boolean) => void;
  disabled: boolean;
}

const inputClass =
  'w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent disabled:bg-gray-100';

export default function DynamicFormField({
  question,
  value,
  onChange,
  disabled,
}: DynamicFormFieldProps) {
  const { key, label, type, required, options, placeholder, min, max } = question;

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) => {
    const target = e.target;
    if (target instanceof HTMLInputElement && target.type === 'checkbox') {
      onChange(key, target.checked);
    } else if (type === 'number') {
      const parsed = parseFloat(target.value);
      onChange(key, isNaN(parsed) ? 0 : parsed);
    } else {
      onChange(key, target.value);
    }
  };

  if (type === 'select' && options) {
    return (
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          {label} {required && '*'}
        </label>
        <select
          name={key}
          value={String(value ?? '')}
          onChange={handleChange}
          required={required}
          disabled={disabled}
          className={inputClass}
        >
          <option value="">Select</option>
          {options.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>
    );
  }

  if (type === 'radio' && options) {
    return (
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          {label} {required && '*'}
        </label>
        <div className="space-y-2">
          {options.map((opt) => (
            <label key={opt.value} className="flex items-center">
              <input
                type="radio"
                name={key}
                value={opt.value}
                checked={value === opt.value}
                onChange={handleChange}
                disabled={disabled}
                className="h-4 w-4 text-primary focus:ring-primary border-gray-300"
              />
              <span className="ml-2 text-sm text-gray-900">{opt.label}</span>
            </label>
          ))}
        </div>
      </div>
    );
  }

  if (type === 'textarea') {
    return (
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          {label} {required && '*'}
        </label>
        <textarea
          name={key}
          value={String(value ?? '')}
          onChange={handleChange}
          required={required}
          disabled={disabled}
          rows={3}
          placeholder={placeholder}
          className={inputClass}
        />
      </div>
    );
  }

  // text, email, tel, date, number
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-2">
        {label} {required && '*'}
      </label>
      <input
        type={type}
        name={key}
        value={type === 'number' ? Number(value ?? 0) : String(value ?? '')}
        onChange={handleChange}
        required={required}
        disabled={disabled}
        placeholder={placeholder}
        min={min}
        max={max}
        className={inputClass}
      />
    </div>
  );
}
