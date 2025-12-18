/**
 * Recorder - 录制核心逻辑，多选择器生成
 */

import { RecordedElement, RecordedStepType, RecordingStepPayload } from './types';

function escapeSelector(str: string): string {
  return CSS.escape(str);
}

function generatePathSelector(el: Element, maxDepth = 5): string {
  const path: string[] = [];
  let current: Element | null = el;
  let depth = 0;

  while (current && current !== document.body && depth < maxDepth) {
    const tag = current.tagName.toLowerCase();
    const parent: Element | null = current.parentElement;
    const currentEl = current;
    
    if (parent) {
      const siblings = Array.from(parent.children).filter((c: Element) => c.tagName === currentEl.tagName);
      if (siblings.length > 1) {
        const idx = siblings.indexOf(currentEl) + 1;
        path.unshift(`${tag}:nth-of-type(${idx})`);
      } else {
        path.unshift(tag);
      }
    } else {
      path.unshift(tag);
    }
    
    current = parent;
    depth++;
  }

  return path.join(' > ');
}

export function generateMultiSelectors(el: Element): string[] {
  const selectors: string[] = [];
  const tag = el.tagName.toLowerCase();
  
  // 1. ID (最稳定)
  if (el.id) {
    selectors.push(`#${escapeSelector(el.id)}`);
  }
  
  // 2. data-testid / data-test-id / data-cy
  const testId = el.getAttribute('data-testid') || el.getAttribute('data-test-id');
  if (testId) {
    selectors.push(`[data-testid="${escapeSelector(testId)}"]`);
  }
  const dataCy = el.getAttribute('data-cy');
  if (dataCy) {
    selectors.push(`[data-cy="${escapeSelector(dataCy)}"]`);
  }
  
  // 3. name 属性（表单元素）
  const name = el.getAttribute('name');
  if (name) {
    selectors.push(`${tag}[name="${escapeSelector(name)}"]`);
  }
  
  // 4. aria-label
  const ariaLabel = el.getAttribute('aria-label');
  if (ariaLabel && ariaLabel.length < 50) {
    selectors.push(`${tag}[aria-label="${escapeSelector(ariaLabel)}"]`);
  }
  
  // 5. role + 上下文
  const role = el.getAttribute('role');
  if (role) {
    selectors.push(`[role="${role}"]`);
  }
  
  // 6. type 属性（input）
  const type = (el as HTMLInputElement).type;
  if (tag === 'input' && type) {
    const nameAttr = el.getAttribute('name');
    if (nameAttr) {
      selectors.push(`input[type="${type}"][name="${escapeSelector(nameAttr)}"]`);
    } else {
      selectors.push(`input[type="${type}"]`);
    }
  }
  
  // 7. placeholder
  const placeholder = (el as HTMLInputElement).placeholder;
  if (placeholder && placeholder.length < 50) {
    selectors.push(`${tag}[placeholder="${escapeSelector(placeholder)}"]`);
  }
  
  // 8. 结构路径 (兜底)
  selectors.push(generatePathSelector(el));
  
  // 去重
  return [...new Set(selectors)];
}

export function extractElementInfo(el: Element): RecordedElement {
  const tag = el.tagName.toLowerCase();
  const rect = el.getBoundingClientRect();
  
  // 提取文本
  let text = '';
  const ariaLabel = el.getAttribute('aria-label');
  if (ariaLabel) {
    text = ariaLabel;
  } else {
    text = (el as HTMLElement).innerText?.trim().slice(0, 50) || '';
  }
  
  // 提取关键属性
  const attrs: Record<string, string> = {};
  if (el.id) attrs.id = el.id;
  
  const role = el.getAttribute('role');
  if (role) attrs.role = role;
  
  const type = (el as HTMLInputElement).type;
  if (type && type !== 'text') attrs.type = type;
  
  const name = el.getAttribute('name');
  if (name) attrs.name = name;
  
  const placeholder = (el as HTMLInputElement).placeholder;
  if (placeholder) attrs.placeholder = placeholder;
  
  const href = (el as HTMLAnchorElement).href;
  if (href && tag === 'a') {
    attrs.href = href.length > 60 ? href.slice(0, 57) + '...' : href;
  }
  
  return {
    tag,
    text,
    selectors: generateMultiSelectors(el),
    attributes: attrs,
    boundingRect: {
      x: rect.x,
      y: rect.y,
      width: rect.width,
      height: rect.height,
    },
  };
}

export function createStepPayload(
  type: RecordedStepType,
  element?: Element,
  value?: string,
  key?: string
): RecordingStepPayload {
  return {
    type,
    url: location.href,
    pageTitle: document.title,
    element: element ? extractElementInfo(element) : undefined,
    value,
    key,
  };
}

export function isInteractiveElement(el: Element): boolean {
  const tag = el.tagName.toLowerCase();
  const interactiveTags = ['a', 'button', 'input', 'textarea', 'select', 'summary', 'details'];
  
  if (interactiveTags.includes(tag)) return true;
  
  const role = el.getAttribute('role');
  const interactiveRoles = ['button', 'link', 'textbox', 'checkbox', 'radio', 'switch', 'menuitem', 'tab', 'option', 'combobox'];
  if (role && interactiveRoles.includes(role)) return true;
  
  if (el.hasAttribute('onclick') || el.hasAttribute('tabindex')) return true;
  if (el.getAttribute('contenteditable') === 'true') return true;
  
  return false;
}

export function shouldRecordClick(el: Element): boolean {
  const tag = el.tagName.toLowerCase();
  
  // 不记录密码输入框的点击（但会记录输入）
  if (tag === 'input' && (el as HTMLInputElement).type === 'password') {
    return true; // 点击可以记录，只是不记录值
  }
  
  return isInteractiveElement(el);
}

export function findClickableAncestor(el: Element): Element | null {
  let current: Element | null = el;
  
  while (current && current !== document.body) {
    if (isInteractiveElement(current)) {
      return current;
    }
    current = current.parentElement;
  }
  
  return null;
}

