export type RecordedStepType = 'click' | 'input' | 'navigate' | 'submit' | 'select' | 'keypress' | 'ai_step';

export interface RecordedElement {
  tag: string;
  text: string;
  selectors: string[];
  attributes: Record<string, string>;
  boundingRect?: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
}

export interface RecordedStep {
  id: string;
  timestamp: number;
  type: RecordedStepType;
  url: string;
  pageTitle: string;
  element?: RecordedElement;
  value?: string;
  key?: string;
}

