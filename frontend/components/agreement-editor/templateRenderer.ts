/**
 * Client-side template renderer that mirrors the backend renderTemplate function
 * from agreementService.js
 *
 * Supports:
 * - {{variable}} - simple replacements
 * - {{#if condition}}...{{/if}} - conditional blocks
 * - {{#if_room_only}}...{{/if_room_only}} - special conditionals
 * - {{#each array}}...{{/each}} - loops (with {{name}}, {{room}}, etc.)
 */

import type { SampleTemplateData, TenantData } from './sampleData';

type TemplateData = SampleTemplateData | Record<string, unknown>;

/**
 * Render a template string with the provided data
 * @param template - The template string containing {{variables}}, conditionals, and loops
 * @param data - The data object to use for replacements
 * @returns The rendered template string
 */
export function renderTemplate(template: string, data: TemplateData): string {
  let rendered = template;

  // Handle special conditionals FIRST (these should not be inside loops)
  rendered = rendered.replace(/{{#if_room_only}}([\s\S]*?){{\/if_room_only}}/g, (_match, content) => {
    return data.tenancy_type === 'room_only' ? content : '';
  });

  rendered = rendered.replace(/{{#if_whole_house}}([\s\S]*?){{\/if_whole_house}}/g, (_match, content) => {
    return data.tenancy_type === 'whole_house' ? content : '';
  });

  rendered = rendered.replace(/{{#if_individual_rents}}([\s\S]*?){{\/if_individual_rents}}/g, (_match, content) => {
    return data.individual_rents ? content : '';
  });

  rendered = rendered.replace(/{{#if_individual_deposits}}([\s\S]*?){{\/if_individual_deposits}}/g, (_match, content) => {
    return data.individual_deposits ? content : '';
  });

  rendered = rendered.replace(/{{#if_rolling_monthly}}([\s\S]*?){{\/if_rolling_monthly}}/g, (_match, content) => {
    return data.is_rolling_monthly ? content : '';
  });

  rendered = rendered.replace(/{{#if_fixed_term}}([\s\S]*?){{\/if_fixed_term}}/g, (_match, content) => {
    return !data.is_rolling_monthly ? content : '';
  });

  // Handle each loops BEFORE regular conditionals: {{#each array}}...{{/each}}
  rendered = rendered.replace(/{{#each\s+(\w+)}}([\s\S]*?){{\/each}}/g, (_match, arrayName, itemTemplate) => {
    const array = data[arrayName as keyof TemplateData];
    if (!Array.isArray(array)) return '';

    return (array as TenantData[]).map(item => {
      let itemRendered = itemTemplate;

      // Handle conditionals inside loops: {{#if property}}...{{/if}}
      itemRendered = itemRendered.replace(/{{#if\s+(\w+)}}([\s\S]*?){{\/if}}/g, (_m: string, propName: string, content: string) => {
        return item[propName as keyof TenantData] ? content : '';
      });

      // Replace item properties
      Object.keys(item).forEach(key => {
        const value = item[key as keyof TenantData];
        const displayValue = value !== null && value !== undefined ? String(value) : '';
        itemRendered = itemRendered.replace(new RegExp(`{{${key}}}`, 'g'), displayValue);
      });
      return itemRendered;
    }).join('\n');
  });

  // Handle regular conditionals AFTER loops: {{#if variable}}...{{/if}}
  // Process conditionals iteratively from innermost to outermost
  let previousRendered;
  do {
    previousRendered = rendered;
    // Match conditionals that don't contain nested {{#if (innermost first)
    rendered = rendered.replace(/{{#if\s+(\w+)}}((?:(?!{{#if).)*?){{\/if}}/s, (_match, varName, content) => {
      return data[varName as keyof TemplateData] ? content : '';
    });
  } while (rendered !== previousRendered);

  // Handle simple variable replacements: {{variable}}
  Object.keys(data).forEach(key => {
    const value = data[key as keyof TemplateData];
    // Skip arrays and objects for simple replacement
    if (typeof value === 'object' && value !== null) return;
    const displayValue = value !== null && value !== undefined ? String(value) : '';
    rendered = rendered.replace(new RegExp(`{{${key}}}`, 'g'), displayValue);
  });

  return rendered;
}

/**
 * Check if a template contains any unrendered variables
 * @param template - The template string to check
 * @returns Array of unrendered variable names
 */
export function findUnrenderedVariables(template: string): string[] {
  const regex = /{{([a-z_]+)}}/g;
  const matches: string[] = [];
  let match;
  while ((match = regex.exec(template)) !== null) {
    if (!matches.includes(match[1])) {
      matches.push(match[1]);
    }
  }
  return matches;
}

/**
 * Extract all template syntax from a string for debugging
 * @param template - The template string to analyze
 * @returns Object with variables, conditionals, and loops found
 */
export function analyzeTemplate(template: string): {
  variables: string[];
  conditionals: string[];
  loops: string[];
} {
  const variables: string[] = [];
  const conditionals: string[] = [];
  const loops: string[] = [];

  // Find variables (excluding those inside conditionals/loops)
  const varRegex = /{{([a-z_]+)}}/g;
  let match;
  while ((match = varRegex.exec(template)) !== null) {
    if (!variables.includes(match[1])) {
      variables.push(match[1]);
    }
  }

  // Find conditionals
  const condRegex = /{{#if[_\s](\w+)}}/g;
  while ((match = condRegex.exec(template)) !== null) {
    if (!conditionals.includes(match[1])) {
      conditionals.push(match[1]);
    }
  }

  // Find loops
  const loopRegex = /{{#each\s+(\w+)}}/g;
  while ((match = loopRegex.exec(template)) !== null) {
    if (!loops.includes(match[1])) {
      loops.push(match[1]);
    }
  }

  return { variables, conditionals, loops };
}
