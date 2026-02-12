'use client';

import { NodeViewWrapper } from '@tiptap/react';
import type { NodeViewProps } from '@tiptap/react';
import { getCategoryForVariable } from '../variableDefinitions';

export function TemplateVariableView({ node }: NodeViewProps) {
  const { variableName, displayName, category } = node.attrs;

  // Get category colors
  const categoryInfo = getCategoryForVariable(variableName);
  const bgColor = categoryInfo?.bgColor || 'bg-gray-100';
  const textColor = categoryInfo?.color || 'text-gray-700';

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
