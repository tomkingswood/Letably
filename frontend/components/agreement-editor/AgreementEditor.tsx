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
import { getCategoryForVariable, isKnownVariable } from './variableDefinitions';

interface AgreementEditorProps {
  value: string;
  onChange: (html: string) => void;
  agreementType?: 'tenancy_agreement';
  placeholder?: string;
}

/**
 * Parse HTML content and convert {{variable}} text to TemplateVariable nodes
 */
function parseTemplateVariables(html: string): string {
  // This converts {{variable}} patterns in the HTML to our custom node format
  // We need to do this when loading existing content
  return html.replace(/{{([a-z_]+)}}/g, (match, variableName) => {
    if (isKnownVariable(variableName)) {
      const category = getCategoryForVariable(variableName);
      const displayName = category?.variables.find(v => v.name === variableName)?.displayName || variableName;
      return `<span data-type="template-variable" data-variable-name="${variableName}" data-display-name="${displayName}" data-category="${category?.id || 'default'}">{{${variableName}}}</span>`;
    }
    // Return as-is if not a known variable (might be a conditional/loop)
    return match;
  });
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
    onUpdate: ({ editor }) => {
      const html = editor.getHTML();
      setEditorHtml(html);
      // Serialize the HTML to proper template format
      const serialized = serializeToTemplateHtml(html);
      onChange(serialized);
    },
    editorProps: {
      attributes: {
        class: 'prose prose-sm max-w-none focus:outline-none min-h-[300px] p-4',
      },
    },
  });

  // Update editor content when value prop changes externally
  useEffect(() => {
    if (editor && value !== serializeToTemplateHtml(editor.getHTML())) {
      const parsedContent = parseTemplateVariables(value);
      editor.commands.setContent(parsedContent, false);
      setEditorHtml(editor.getHTML());
    }
  }, [value, editor]);

  // Initialize editorHtml when editor is ready
  useEffect(() => {
    if (editor) {
      setEditorHtml(editor.getHTML());
    }
  }, [editor]);

  return (
    <div className="border border-gray-300 rounded-lg overflow-hidden bg-white">
      {/* Toolbar */}
      <AgreementEditorToolbar editor={editor} />

      {/* Split View Toggle */}
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

      {/* Editor and Preview */}
      <div className={`flex ${showPreview ? 'divide-x divide-gray-200' : ''}`}>
        {/* Editor */}
        <div className={`${showPreview ? 'w-1/2' : 'w-full'} min-h-[400px]`}>
          <EditorContent editor={editor} />
        </div>

        {/* Preview Panel */}
        {showPreview && (
          <div className="w-1/2 min-h-[400px] bg-gray-50">
            <AgreementPreviewPanel
              content={serializeToTemplateHtml(editorHtml)}
              agreementType={agreementType}
            />
          </div>
        )}
      </div>

      {/* Help Text */}
      <div className="px-3 py-2 bg-gray-50 border-t border-gray-200 text-xs text-gray-500">
        <p>
          <strong>Tip:</strong> Template variables appear as colored pills in the editor.
          Use conditionals like <code className="bg-gray-200 px-1 rounded">{`{{#if_room_only}}`}</code> for content that only shows for specific tenancy types.
        </p>
      </div>

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
