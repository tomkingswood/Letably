import { ReactNode } from 'react';
import { QuestionDefinition } from '@/lib/types';
import DynamicFormField from './DynamicFormField';

interface FormSectionProps {
  sectionLabel: string;
  questions: QuestionDefinition[];
  formData: Record<string, unknown>;
  onChange: (key: string, value: string | number | boolean) => void;
  disabled: boolean;
  complexComponents: Record<string, ReactNode>;
  /** Extra header content (e.g. the "Right to Rent" button) */
  headerExtra?: ReactNode;
}

/**
 * Check whether a question's dependency is satisfied.
 * `dependsOn` can reference a form field or a top-level application property
 * like `guarantor_required`.
 */
function isDependencyMet(
  dep: QuestionDefinition['dependsOn'],
  formData: Record<string, unknown>
): boolean {
  if (!dep) return true;
  return formData[dep.key] === dep.value;
}

export default function FormSection({
  sectionLabel,
  questions,
  formData,
  onChange,
  disabled,
  complexComponents,
  headerExtra,
}: FormSectionProps) {
  // Filter out disabled questions and those whose dependencies aren't met
  const visible = questions.filter(
    (q) => q.enabled && isDependencyMet(q.dependsOn, formData)
  );

  if (visible.length === 0) return null;

  // Group by subSection for rendering sub-headings
  let currentSubSection: string | undefined;

  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-2xl font-bold text-gray-900">{sectionLabel}</h2>
        {headerExtra}
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {visible.map((q) => {
          // Complex components are rendered by dedicated components
          if (q.type === 'complex' && q.component && complexComponents[q.component]) {
            return (
              <div key={q.key} className="col-span-1 md:col-span-2">
                {complexComponents[q.component]}
              </div>
            );
          }

          // Sub-section header — rendered as its own full-width grid item
          const items: ReactNode[] = [];
          if (q.subSection && q.subSection !== currentSubSection) {
            currentSubSection = q.subSection;
            items.push(
              <div key={`sub-${q.subSection}`} className="col-span-1 md:col-span-2 border-t border-gray-200 pt-4 mt-2">
                <h3 className="font-semibold text-gray-900 mb-2">{q.subSection}</h3>
              </div>
            );
          }

          const colSpan = q.gridCols === 2 ? 'col-span-1 md:col-span-2' : '';

          items.push(
            <div key={q.key} className={colSpan}>
              <DynamicFormField
                question={q}
                value={formData[q.key] as string | number | boolean}
                onChange={onChange}
                disabled={disabled}
              />
            </div>
          );

          return items;
        })}
      </div>
    </div>
  );
}
