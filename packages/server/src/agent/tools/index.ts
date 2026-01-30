export { generateStepsTool } from './generateSteps';
export { generateScriptTool } from './generateScript';
export { executeWorkflowTool } from './executeWorkflow';

// New ReAct tools
export { pageActionTool } from './pageAction';
export {
  createTabTool,
  updateTabTool,
  closeTabTool,
  getTabTool,
  queryTabsTool,
  captureScreenshotTool,
} from './chromeApi';

