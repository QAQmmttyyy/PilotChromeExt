/**
 * DOM Extractor for Pilot
 * 简洁版：提取页面可交互元素，生成标准 CSS 选择器
 */

export interface ActionableElement {
  uid: number;
  tag: string;
  text: string;
  selector: string;
  attrs: Record<string, string>;
}

export interface DOMExtractionResult {
  url: string;
  title: string;
  elements: ActionableElement[];
  llmText: string;
}

const INTERACTIVE_TAGS = ['a', 'button', 'input', 'textarea', 'select', 'summary'];
const INTERACTIVE_ROLES = ['button', 'link', 'textbox', 'checkbox', 'radio', 'switch', 'menuitem', 'tab', 'option', 'combobox', 'slider'];

function isVisible(el: Element): boolean {
  const style = getComputedStyle(el);
  if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') {
    return false;
  }
  const rect = el.getBoundingClientRect();
  if (rect.width <= 0 || rect.height <= 0) return false;
  const buffer = 300;
  if (rect.bottom < -buffer || rect.top > window.innerHeight + buffer) return false;
  return true;
}

function isInteractive(el: Element): boolean {
  const tag = el.tagName.toLowerCase();
  if (INTERACTIVE_TAGS.includes(tag)) return true;
  
  const role = el.getAttribute('role');
  if (role && INTERACTIVE_ROLES.includes(role)) return true;
  
  if (el.hasAttribute('onclick') || el.hasAttribute('tabindex')) return true;
  if (el.getAttribute('contenteditable') === 'true') return true;
  
  return false;
}

function generateSelector(el: Element): string {
  // 1. ID（最优先）
  if (el.id) {
    return `#${CSS.escape(el.id)}`;
  }
  
  // 2. data-testid
  const testId = el.getAttribute('data-testid') || el.getAttribute('data-test-id');
  if (testId) {
    return `[data-testid="${CSS.escape(testId)}"]`;
  }
  
  // 3. name 属性（表单元素）
  const name = el.getAttribute('name');
  if (name) {
    return `${el.tagName.toLowerCase()}[name="${CSS.escape(name)}"]`;
  }
  
  // 4. aria-label
  const ariaLabel = el.getAttribute('aria-label');
  if (ariaLabel && ariaLabel.length < 40) {
    return `${el.tagName.toLowerCase()}[aria-label="${CSS.escape(ariaLabel)}"]`;
  }
  
  // 5. role + 文本（用 :nth-of-type 定位）
  const role = el.getAttribute('role');
  if (role) {
    const parent = el.parentElement;
    if (parent) {
      const siblings = Array.from(parent.querySelectorAll(`[role="${role}"]`));
      const idx = siblings.indexOf(el);
      if (siblings.length === 1) {
        return `[role="${role}"]`;
      }
      if (idx >= 0) {
        return `[role="${role}"]:nth-of-type(${idx + 1})`;
      }
    }
  }
  
  // 6. 路径选择器（兜底）
  const tag = el.tagName.toLowerCase();
  const parent = el.parentElement;
  if (!parent || parent === document.body) {
    return tag;
  }
  
  const siblings = Array.from(parent.children).filter(c => c.tagName === el.tagName);
  if (siblings.length === 1) {
    return `${generateSelector(parent)} > ${tag}`;
  }
  const idx = siblings.indexOf(el) + 1;
  return `${generateSelector(parent)} > ${tag}:nth-of-type(${idx})`;
}

function extractText(el: Element): string {
  const ariaLabel = el.getAttribute('aria-label');
  if (ariaLabel) return ariaLabel.slice(0, 50);
  
  const title = el.getAttribute('title');
  if (title) return title.slice(0, 50);
  
  const placeholder = (el as HTMLInputElement).placeholder;
  if (placeholder) return placeholder.slice(0, 50);
  
  const innerText = (el as HTMLElement).innerText?.trim();
  return innerText?.slice(0, 50) || '';
}

function getRelevantAttrs(el: Element): Record<string, string> {
  const attrs: Record<string, string> = {};
  const tag = el.tagName.toLowerCase();
  
  if (el.id) attrs.id = el.id;
  
  const role = el.getAttribute('role');
  if (role) attrs.role = role;
  
  const type = (el as HTMLInputElement).type;
  if (type && type !== 'text') attrs.type = type;
  
  const href = (el as HTMLAnchorElement).href;
  if (href && tag === 'a') {
    attrs.href = href.length > 60 ? href.slice(0, 57) + '...' : href;
  }
  
  const value = (el as HTMLInputElement).value;
  if (value) attrs.value = value.slice(0, 30);
  
  if ((el as HTMLInputElement).checked) attrs.checked = 'true';
  if ((el as HTMLInputElement).disabled) attrs.disabled = 'true';
  
  return attrs;
}

export function extractActionableElements(maxElements = 80): DOMExtractionResult {
  const allElements = document.querySelectorAll('*');
  const elements: ActionableElement[] = [];
  let uid = 1;
  
  for (const el of allElements) {
    if (uid > maxElements) break;
    if (!isInteractive(el)) continue;
    if (!isVisible(el)) continue;
    if ((el as HTMLInputElement).disabled) continue;
    
    elements.push({
      uid: uid++,
      tag: el.tagName.toLowerCase(),
      text: extractText(el),
      selector: generateSelector(el),
      attrs: getRelevantAttrs(el),
    });
  }
  
  // 生成 LLM 文本表示
  const lines = elements.map(el => {
    const attrStr = Object.entries(el.attrs)
      .map(([k, v]) => `${k}="${v}"`)
      .join(' ');
    return `[${el.uid}] <${el.tag}${attrStr ? ' ' + attrStr : ''}>${el.text}</${el.tag}>  → ${el.selector}`;
  });
  
  return {
    url: location.href,
    title: document.title,
    elements,
    llmText: lines.join('\n'),
  };
}

export function getPageContextForAI(maxElements = 80): string {
  const result = extractActionableElements(maxElements);
  return [
    `页面: ${result.title}`,
    `URL: ${result.url}`,
    `元素数: ${result.elements.length}`,
    '',
    result.llmText,
  ].join('\n');
}
