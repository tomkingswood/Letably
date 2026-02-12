import { Node, mergeAttributes } from '@tiptap/core';
import { ReactNodeViewRenderer } from '@tiptap/react';
import { TemplateVariableView } from './TemplateVariableView';

export interface TemplateVariableOptions {
  HTMLAttributes: Record<string, unknown>;
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    templateVariable: {
      /**
       * Insert a template variable
       */
      insertTemplateVariable: (attributes: {
        variableName: string;
        displayName: string;
        category: string;
      }) => ReturnType;
    };
  }
}

export const TemplateVariable = Node.create<TemplateVariableOptions>({
  name: 'templateVariable',

  group: 'inline',

  inline: true,

  atom: true,

  addOptions() {
    return {
      HTMLAttributes: {},
    };
  },

  addAttributes() {
    return {
      variableName: {
        default: null,
        parseHTML: element => element.getAttribute('data-variable-name'),
        renderHTML: attributes => ({
          'data-variable-name': attributes.variableName,
        }),
      },
      displayName: {
        default: null,
        parseHTML: element => element.getAttribute('data-display-name'),
        renderHTML: attributes => ({
          'data-display-name': attributes.displayName,
        }),
      },
      category: {
        default: 'default',
        parseHTML: element => element.getAttribute('data-category'),
        renderHTML: attributes => ({
          'data-category': attributes.category,
        }),
      },
    };
  },

  parseHTML() {
    return [
      {
        tag: 'span[data-type="template-variable"]',
      },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      'span',
      mergeAttributes(
        { 'data-type': 'template-variable' },
        this.options.HTMLAttributes,
        HTMLAttributes
      ),
      `{{${HTMLAttributes['data-variable-name']}}}`,
    ];
  },

  addNodeView() {
    return ReactNodeViewRenderer(TemplateVariableView);
  },

  addCommands() {
    return {
      insertTemplateVariable:
        attributes =>
        ({ commands }) => {
          return commands.insertContent({
            type: this.name,
            attrs: attributes,
          });
        },
    };
  },
});

export default TemplateVariable;
