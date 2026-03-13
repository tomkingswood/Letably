'use client';

import { useState, useCallback, useEffect } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Underline from '@tiptap/extension-underline';
import Link from '@tiptap/extension-link';
import Placeholder from '@tiptap/extension-placeholder';
import { TemplateVariable } from './extensions/TemplateVariable';
import { AgreementEditorToolbar } from './AgreementEditorToolbar';
import { AgreementPreviewPanel } from './AgreementPreviewPanel';
import { getCategoryForVariable, isKnownVariable, isLoopField, getLoopFieldDisplayName, getLoopByName, getConditionalByName } from './variableDefinitions';

interface AgreementEditorProps {
  value: string;
  onChange?: (html: string) => void;
  agreementType?: 'tenancy_agreement';
  placeholder?: string;
  readOnly?: boolean;
}

/**
 * Build a template variable span for the editor
 */
function buildVarSpan(varName: string, displayName: string, category: string): string {
  return `<span data-type="template-variable" data-variable-name="${varName}" data-display-name="${displayName}" data-category="${category}">{{${varName}}}</span>`;
}

/**
 * Parse HTML content and convert {{variable}}, {{#each}}, {{#if_*}} text to TemplateVariable nodes
 */
function parseTemplateVariables(html: string): string {
  let result = html;

  // Convert loop tags: {{#each tenants}} → pill, {{/each}} → pill
  result = result.replace(/{{#each\s+(\w+)}}/g, (_match, loopName) => {
    const loop = getLoopByName(loopName);
    const displayName = loop ? `Each: ${loop.displayName}` : `Each: ${loopName}`;
    return buildVarSpan(`#each ${loopName}`, displayName, 'loop');
  });
  result = result.replace(/{{\/each}}/g, () => {
    return buildVarSpan('/each', 'End Loop', 'loop');
  });

  // Convert special conditional tags: {{#if_room_only}} → pill, {{/if_room_only}} → pill
  result = result.replace(/{{#(if_\w+)}}/g, (_match, condName) => {
    const cond = getConditionalByName(condName);
    const displayName = cond ? `If: ${cond.displayName}` : `If: ${condName}`;
    return buildVarSpan(`#${condName}`, displayName, 'conditional');
  });
  result = result.replace(/{{\/(\w+)}}/g, (_match, tagName) => {
    // Match closing tags like {{/if_room_only}}, {{/if_whole_house}}, {{/if}}
    if (tagName === 'each') return _match; // already handled above
    const cond = getConditionalByName(tagName);
    const displayName = cond ? `End: ${cond.displayName}` : `End: ${tagName}`;
    return buildVarSpan(`/${tagName}`, displayName, 'conditional');
  });

  // Convert regular conditional tags: {{#if variable}} → pill
  result = result.replace(/{{#if\s+(\w+)}}/g, (_match, varName) => {
    return buildVarSpan(`#if ${varName}`, `If: ${varName}`, 'conditional');
  });

  // Convert simple variables: {{variable}} → pill (known top-level or loop fields)
  result = result.replace(/{{([a-z_]+)}}/g, (match, variableName) => {
    if (isKnownVariable(variableName)) {
      const category = getCategoryForVariable(variableName);
      const displayName = category?.variables.find(v => v.name === variableName)?.displayName || variableName;
      return buildVarSpan(variableName, displayName, category?.id || 'default');
    }
    if (isLoopField(variableName)) {
      const displayName = getLoopFieldDisplayName(variableName);
      return buildVarSpan(variableName, displayName, 'loop_field');
    }
    return match;
  });

  return result;
}

/**
 * Convert editor HTML output to ensure template variables are properly formatted
 */
function serializeToTemplateHtml(html: string): string {
  // The TemplateVariable extension already outputs {{variableName}} in renderHTML
  // But we need to clean up any extra wrapper spans that might be added
  const parser = typeof window !== 'undefined' ? new DOMParser() : null;
  if (!parser) return html;

  const doc = parser.parseFromString(html, 'text/html');

  // Find all template variable spans and replace with just the text
  const variableSpans = doc.querySelectorAll('span[data-type="template-variable"]');
  variableSpans.forEach(span => {
    const variableName = span.getAttribute('data-variable-name');
    if (variableName) {
      const textNode = doc.createTextNode(`{{${variableName}}}`);
      span.parentNode?.replaceChild(textNode, span);
    }
  });

  return doc.body.innerHTML;
}

export function AgreementEditor({
  value,
  onChange,
  agreementType = 'tenancy_agreement',
  placeholder = 'Start typing your agreement content...',
  readOnly = false,
}: AgreementEditorProps) {
  const [showPreview, setShowPreview] = useState(true);
  const [editorHtml, setEditorHtml] = useState('');

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: {
          levels: [1, 2, 3],
        },
      }),
      Underline,
      Link.configure({
        openOnClick: false,
        HTMLAttributes: {
          rel: 'noopener noreferrer',
          target: '_blank',
        },
      }),
      Placeholder.configure({
        placeholder,
      }),
      TemplateVariable,
    ],
    content: parseTemplateVariables(value),
    editable: !readOnly,
    onUpdate: ({ editor }) => {
      const html = editor.getHTML();
      setEditorHtml(html);
      // Serialize the HTML to proper template format
      const serialized = serializeToTemplateHtml(html);
      onChange?.(serialized);
    },
    editorProps: {
      attributes: {
        class: readOnly
          ? 'prose prose-sm max-w-none focus:outline-none p-4'
          : 'prose prose-sm max-w-none focus:outline-none min-h-[300px] p-4',
      },
    },
  });

  // Update editor content when value prop changes externally
  useEffect(() => {
    if (editor && value !== serializeToTemplateHtml(editor.getHTML())) {
      // Defer setContent to avoid flushSync warning — TipTap's onUpdate
      // triggers a state update, which can't happen during a React render cycle
      queueMicrotask(() => {
        const parsedContent = parseTemplateVariables(value);
        editor.commands.setContent(parsedContent, false);
        setEditorHtml(editor.getHTML());
      });
    }
  }, [value, editor]);

  // Initialize editorHtml when editor is ready
  useEffect(() => {
    if (editor) {
      setEditorHtml(editor.getHTML());
    }
  }, [editor]);

  return (
    <div className={`border border-gray-300 rounded-lg overflow-hidden bg-white ${readOnly ? 'opacity-80' : ''}`}>
      {/* Toolbar */}
      {!readOnly && <AgreementEditorToolbar editor={editor} />}

      {/* Split View Toggle */}
      {!readOnly && (
        <div className="flex items-center justify-between px-3 py-1.5 bg-gray-100 border-b border-gray-200">
          <span className="text-xs text-gray-600">
            Use the toolbar to insert variables, conditionals, and loops
          </span>
          <button
            type="button"
            onClick={() => setShowPreview(!showPreview)}
            className={`flex items-center gap-1 px-2 py-1 rounded text-xs font-medium transition-colors ${
              showPreview
                ? 'bg-primary text-white'
                : 'bg-white text-gray-600 hover:bg-gray-50 border border-gray-300'
            }`}
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
            </svg>
            {showPreview ? 'Hide Preview' : 'Show Preview'}
          </button>
        </div>
      )}

      {/* Editor and Preview */}
      <div className={`flex ${!readOnly && showPreview ? 'divide-x divide-gray-200' : ''}`}>
        {/* Editor */}
        <div className={`${!readOnly && showPreview ? 'w-1/2' : 'w-full'} ${readOnly ? '' : 'min-h-[400px]'}`}>
          <EditorContent editor={editor} />
        </div>

        {/* Preview Panel */}
        {!readOnly && showPreview && (
          <div className="w-1/2 min-h-[400px] bg-gray-50">
            <AgreementPreviewPanel
              content={serializeToTemplateHtml(editorHtml)}
              agreementType={agreementType}
            />
          </div>
        )}
      </div>

      {/* Help Text */}
      {!readOnly && (
        <div className="px-3 py-2 bg-gray-50 border-t border-gray-200 text-xs text-gray-500">
          <p>
            <strong>Tip:</strong> Template variables, loops, and conditionals all appear as colored pills in the editor. Use the toolbar above to insert them.
          </p>
        </div>
      )}

      {/* Editor Styles */}
      <style jsx global>{`
        .ProseMirror {
          min-height: 300px;
          outline: none;
        }
        .ProseMirror p.is-editor-empty:first-child::before {
          color: #adb5bd;
          content: attr(data-placeholder);
          float: left;
          height: 0;
          pointer-events: none;
        }
        .ProseMirror p {
          margin: 0.5em 0;
        }
        .ProseMirror h1 {
          font-size: 1.75em;
          font-weight: 700;
          margin: 0.67em 0;
        }
        .ProseMirror h2 {
          font-size: 1.5em;
          font-weight: 700;
          margin: 0.75em 0;
        }
        .ProseMirror h3 {
          font-size: 1.25em;
          font-weight: 600;
          margin: 0.83em 0;
        }
        .ProseMirror ul,
        .ProseMirror ol {
          padding-left: 1.5em;
          margin: 0.5em 0;
        }
        .ProseMirror li {
          margin: 0.25em 0;
        }
        .ProseMirror ul {
          list-style-type: disc;
        }
        .ProseMirror ol {
          list-style-type: decimal;
        }
        .ProseMirror strong {
          font-weight: 600;
        }
        .ProseMirror a {
          color: #3b82f6;
          text-decoration: underline;
        }
      `}</style>
    </div>
  );
}

export default AgreementEditor;
