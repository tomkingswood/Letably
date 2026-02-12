'use client';

import { useState, useRef, useEffect } from 'react';
import type { Editor } from '@tiptap/react';
import {
  variableCategories,
  conditionalBlocks,
  loopBlocks,
  type TemplateCategory,
  type ConditionalBlock,
  type LoopBlock,
} from './variableDefinitions';

interface AgreementEditorToolbarProps {
  editor: Editor | null;
}

export function AgreementEditorToolbar({ editor }: AgreementEditorToolbarProps) {
  const [showVariableDropdown, setShowVariableDropdown] = useState(false);
  const [showConditionalDropdown, setShowConditionalDropdown] = useState(false);
  const [showLoopDropdown, setShowLoopDropdown] = useState(false);
  const [expandedCategory, setExpandedCategory] = useState<string | null>(null);

  const variableRef = useRef<HTMLDivElement>(null);
  const conditionalRef = useRef<HTMLDivElement>(null);
  const loopRef = useRef<HTMLDivElement>(null);

  // Close dropdowns when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (variableRef.current && !variableRef.current.contains(event.target as Node)) {
        setShowVariableDropdown(false);
        setExpandedCategory(null);
      }
      if (conditionalRef.current && !conditionalRef.current.contains(event.target as Node)) {
        setShowConditionalDropdown(false);
      }
      if (loopRef.current && !loopRef.current.contains(event.target as Node)) {
        setShowLoopDropdown(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  if (!editor) {
    return null;
  }

  const insertVariable = (category: TemplateCategory, variableName: string, displayName: string) => {
    editor
      .chain()
      .focus()
      .insertTemplateVariable({
        variableName,
        displayName,
        category: category.id,
      })
      .run();
    setShowVariableDropdown(false);
    setExpandedCategory(null);
  };

  const insertConditional = (conditional: ConditionalBlock) => {
    // Insert the conditional tags with a space between them for content
    editor
      .chain()
      .focus()
      .insertContent(`${conditional.startTag} ${conditional.endTag}`)
      .run();
    setShowConditionalDropdown(false);
  };

  const insertLoop = (loop: LoopBlock) => {
    // Insert the loop tags with example content
    const exampleContent = `${loop.startTag}\n  {{name}}\n${loop.endTag}`;
    editor
      .chain()
      .focus()
      .insertContent(exampleContent)
      .run();
    setShowLoopDropdown(false);
  };

  const ToolbarButton = ({
    onClick,
    isActive = false,
    title,
    children,
    disabled = false,
  }: {
    onClick: () => void;
    isActive?: boolean;
    title: string;
    children: React.ReactNode;
    disabled?: boolean;
  }) => (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={`p-1.5 rounded transition-colors ${
        isActive
          ? 'bg-primary text-white'
          : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
      } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
    >
      {children}
    </button>
  );

  return (
    <div className="flex flex-wrap items-center gap-1 p-2 border-b border-gray-200 bg-gray-50 rounded-t-lg">
      {/* Text Formatting */}
      <div className="flex items-center gap-0.5 border-r border-gray-300 pr-2 mr-1">
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleBold().run()}
          isActive={editor.isActive('bold')}
          title="Bold (Ctrl+B)"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 4h8a4 4 0 014 4 4 4 0 01-4 4H6z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 12h9a4 4 0 014 4 4 4 0 01-4 4H6z" />
          </svg>
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleItalic().run()}
          isActive={editor.isActive('italic')}
          title="Italic (Ctrl+I)"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 4h4m-2 0v16m-4 0h8" transform="skewX(-12)" />
          </svg>
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleUnderline().run()}
          isActive={editor.isActive('underline')}
          title="Underline (Ctrl+U)"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 4v7a5 5 0 0010 0V4M5 21h14" />
          </svg>
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleStrike().run()}
          isActive={editor.isActive('strike')}
          title="Strikethrough"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h14M12 5c-2 0-4 1-4 3s2 3 4 3 4 1 4 3-2 3-4 3" />
          </svg>
        </ToolbarButton>
      </div>

      {/* Headings */}
      <div className="flex items-center gap-0.5 border-r border-gray-300 pr-2 mr-1">
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
          isActive={editor.isActive('heading', { level: 1 })}
          title="Heading 1"
        >
          <span className="text-xs font-bold">H1</span>
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
          isActive={editor.isActive('heading', { level: 2 })}
          title="Heading 2"
        >
          <span className="text-xs font-bold">H2</span>
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
          isActive={editor.isActive('heading', { level: 3 })}
          title="Heading 3"
        >
          <span className="text-xs font-bold">H3</span>
        </ToolbarButton>
      </div>

      {/* Lists */}
      <div className="flex items-center gap-0.5 border-r border-gray-300 pr-2 mr-1">
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          isActive={editor.isActive('bulletList')}
          title="Bullet List"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            <circle cx="2" cy="6" r="1" fill="currentColor" />
            <circle cx="2" cy="12" r="1" fill="currentColor" />
            <circle cx="2" cy="18" r="1" fill="currentColor" />
          </svg>
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          isActive={editor.isActive('orderedList')}
          title="Numbered List"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 6h13M7 12h13M7 18h13" />
            <text x="2" y="8" fontSize="6" fill="currentColor">1</text>
            <text x="2" y="14" fontSize="6" fill="currentColor">2</text>
            <text x="2" y="20" fontSize="6" fill="currentColor">3</text>
          </svg>
        </ToolbarButton>
      </div>

      {/* Template Variables Dropdown */}
      <div className="relative" ref={variableRef}>
        <button
          type="button"
          onClick={() => {
            setShowVariableDropdown(!showVariableDropdown);
            setShowConditionalDropdown(false);
            setShowLoopDropdown(false);
          }}
          className={`flex items-center gap-1 px-2 py-1 rounded text-sm font-medium transition-colors ${
            showVariableDropdown
              ? 'bg-blue-100 text-blue-700'
              : 'bg-blue-50 text-blue-600 hover:bg-blue-100'
          }`}
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A2 2 0 013 12V7a4 4 0 014-4z" />
          </svg>
          Variable
          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>

        {showVariableDropdown && (
          <div className="absolute top-full left-0 mt-1 w-64 bg-white rounded-lg shadow-lg border border-gray-200 z-50 max-h-80 overflow-y-auto">
            {variableCategories.map((category) => (
              <div key={category.id} className="border-b border-gray-100 last:border-b-0">
                <button
                  type="button"
                  onClick={() => setExpandedCategory(expandedCategory === category.id ? null : category.id)}
                  className={`w-full flex items-center justify-between px-3 py-2 text-sm font-medium hover:bg-gray-50 ${category.color}`}
                >
                  <span className="flex items-center gap-2">
                    <span className={`w-2 h-2 rounded-full ${category.bgColor}`}></span>
                    {category.name}
                  </span>
                  <svg
                    className={`w-4 h-4 transition-transform ${expandedCategory === category.id ? 'rotate-180' : ''}`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
                {expandedCategory === category.id && (
                  <div className="bg-gray-50 py-1">
                    {category.variables.map((variable) => (
                      <button
                        key={variable.name}
                        type="button"
                        onClick={() => insertVariable(category, variable.name, variable.displayName)}
                        className="w-full text-left px-4 py-1.5 text-sm text-gray-700 hover:bg-gray-100"
                      >
                        <span className="font-medium">{variable.displayName}</span>
                        <span className="text-xs text-gray-500 ml-2">
                          {`{{${variable.name}}}`}
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Conditional Blocks Dropdown */}
      <div className="relative" ref={conditionalRef}>
        <button
          type="button"
          onClick={() => {
            setShowConditionalDropdown(!showConditionalDropdown);
            setShowVariableDropdown(false);
            setShowLoopDropdown(false);
          }}
          className={`flex items-center gap-1 px-2 py-1 rounded text-sm font-medium transition-colors ${
            showConditionalDropdown
              ? 'bg-amber-100 text-amber-700'
              : 'bg-amber-50 text-amber-600 hover:bg-amber-100'
          }`}
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          Conditional
          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>

        {showConditionalDropdown && (
          <div className="absolute top-full left-0 mt-1 w-72 bg-white rounded-lg shadow-lg border border-gray-200 z-50 max-h-80 overflow-y-auto">
            <div className="p-2 border-b border-gray-100">
              <p className="text-xs text-gray-500">Insert content that shows only for specific conditions</p>
            </div>
            {conditionalBlocks.map((conditional) => (
              <button
                key={conditional.name}
                type="button"
                onClick={() => insertConditional(conditional)}
                className="w-full text-left px-3 py-2 hover:bg-gray-50 border-b border-gray-100 last:border-b-0"
              >
                <div className="font-medium text-sm text-gray-900">{conditional.displayName}</div>
                <div className="text-xs text-gray-500 mt-0.5">{conditional.description}</div>
                <div className="text-xs text-amber-600 mt-1 font-mono">{conditional.startTag}</div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Loop Blocks Dropdown */}
      <div className="relative" ref={loopRef}>
        <button
          type="button"
          onClick={() => {
            setShowLoopDropdown(!showLoopDropdown);
            setShowVariableDropdown(false);
            setShowConditionalDropdown(false);
          }}
          className={`flex items-center gap-1 px-2 py-1 rounded text-sm font-medium transition-colors ${
            showLoopDropdown
              ? 'bg-emerald-100 text-emerald-700'
              : 'bg-emerald-50 text-emerald-600 hover:bg-emerald-100'
          }`}
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          Loop
          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>

        {showLoopDropdown && (
          <div className="absolute top-full left-0 mt-1 w-80 bg-white rounded-lg shadow-lg border border-gray-200 z-50 max-h-96 overflow-y-auto">
            <div className="p-2 border-b border-gray-100">
              <p className="text-xs text-gray-500">Repeat content for each item in an array</p>
            </div>
            {loopBlocks.map((loop) => (
              <div key={loop.name} className="border-b border-gray-100 last:border-b-0">
                <button
                  type="button"
                  onClick={() => insertLoop(loop)}
                  className="w-full text-left px-3 py-2 hover:bg-gray-50"
                >
                  <div className="font-medium text-sm text-gray-900">{loop.displayName}</div>
                  <div className="text-xs text-gray-500 mt-0.5">{loop.description}</div>
                  <div className="text-xs text-emerald-600 mt-1 font-mono">{loop.startTag}</div>
                </button>
                <div className="px-3 pb-2 flex flex-wrap gap-1">
                  <span className="text-xs text-gray-400">Fields:</span>
                  {loop.fields.map((field) => (
                    <span
                      key={field.name}
                      className="text-xs bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded font-mono"
                    >
                      {`{{${field.name}}}`}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default AgreementEditorToolbar;
