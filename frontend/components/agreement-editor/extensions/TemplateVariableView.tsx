'use client';

import { NodeViewWrapper } from '@tiptap/react';
import type { NodeViewProps } from '@tiptap/react';
import { getCategoryForVariable } from '../variableDefinitions';

// Colors for special tag categories (loops, conditionals, loop fields)
const TAG_COLORS: Record<string, { bg: string; text: string }> = {
  loop: { bg: 'bg-emerald-100', text: 'text-emerald-700' },
  loop_field: { bg: 'bg-teal-100', text: 'text-teal-700' },
  conditional: { bg: 'bg-amber-100', text: 'text-amber-700' },
};

export function TemplateVariableView({ node }: NodeViewProps) {
  const { variableName, displayName, category } = node.attrs;

  // Get category colors — check special tag categories first, then variable categories
  const tagColors = TAG_COLORS[category];
  let bgColor: string;
  let textColor: string;

  if (tagColors) {
    bgColor = tagColors.bg;
    textColor = tagColors.text;
  } else {
    const categoryInfo = getCategoryForVariable(variableName);
    bgColor = categoryInfo?.bgColor || 'bg-gray-100';
    textColor = categoryInfo?.color || 'text-gray-700';
  }

  return (
    <NodeViewWrapper as="span" className="inline">
      <span
        className={`inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium ${bgColor} ${textColor} cursor-default select-none mx-0.5`}
        contentEditable={false}
        title={`Variable: ${variableName}`}
      >
        {displayName || variableName}
      </span>
    </NodeViewWrapper>
  );
}

export default TemplateVariableView;
