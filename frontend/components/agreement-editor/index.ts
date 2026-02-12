// Main editor component
export { AgreementEditor } from './AgreementEditor';
export type { default as AgreementEditorType } from './AgreementEditor';

// Sub-components
export { AgreementEditorToolbar } from './AgreementEditorToolbar';
export { AgreementPreviewPanel } from './AgreementPreviewPanel';

// Template utilities
export { renderTemplate, findUnrenderedVariables, analyzeTemplate } from './templateRenderer';

// Variable definitions
export {
  variableCategories,
  conditionalBlocks,
  loopBlocks,
  getCategoryForVariable,
  getAllVariables,
  isKnownVariable,
} from './variableDefinitions';
export type {
  TemplateVariable,
  TemplateCategory,
  ConditionalBlock,
  LoopBlock,
} from './variableDefinitions';

// Sample data
export { getSampleData, sampleRoomOnlyData, sampleWholeHouseData } from './sampleData';
export type { SampleTemplateData, TenantData } from './sampleData';

// Extensions
export { TemplateVariable as TemplateVariableExtension } from './extensions';
