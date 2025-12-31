/**
 * Recorder - 录制核心逻辑，渐进式唯一选择器生成
 */

import { RecordedElement, RecordedStepType, RecordingStepPayload } from './types';

function escapeSelector(str: string): string {
  return CSS.escape(str);
}

/**
 * 核心断言：校验选择器是否在当前页面唯一，且指向的确实是目标元素
 */
function verifySelector(selector: string, target: Element): boolean {
  try {
    const elements = document.querySelectorAll(selector);
    return elements.length === 1 && elements[0] === target;
  } catch (e) {
    return false;
  }
}

/**
 * 获取单个元素的特征片段
 * isTarget: 是否是操作的目标元素。
 */
function getElementSegment(el: Element, isTarget: boolean): string {
  const tag = el.tagName.toLowerCase();
  if (el.id) return `#${escapeSelector(el.id)}`;

  let segment = tag;

  if (isTarget) {
    // 优先提取高度稳定的语义属性
    if (tag === 'a') {
      const href = el.getAttribute('href');
      if (href && !href.startsWith('javascript:') && href !== '#') {
        segment += `[href="${escapeSelector(href)}"]`;
      }
    }

    const stableAttrs = ['name', 'type', 'placeholder', 'title'];
    for (const attr of stableAttrs) {
      const val = el.getAttribute(attr);
      if (val && val.length < 100) {
        segment += `[${attr}="${escapeSelector(val)}"]`;
      }
    }
  }

  // 类名过滤：避开动态生成的类名
  if (el.classList.length > 0) {
    const safeClasses = Array.from(el.classList)
      .filter(c => !/\d/.test(c) && c.length < 40)
      .map(escapeSelector);

    if (safeClasses.length > 0) {
      segment += '.' + safeClasses.join('.');
    }
  }

  return segment;
}

/**
 * 渐进式路径构建逻辑
 * 策略：向上攀爬直至锁定唯一性，不限制层级，使用后代选择器。
 */
function buildProgressivePath(el: Element): string | null {
  let current: Element | null = el;
  const parts: string[] = [];
  let depth = 0;

  while (current && current !== document.documentElement) {
    const isTarget = depth === 0;
    const segment = getElementSegment(current, isTarget);

    // 如果这一层没有任何特征（只是个空的 div 或 span），且不是目标元素
    // 我们在某些情况下可以跳过它以缩短选择器，但为了稳妥，目前保留
    parts.unshift(segment);

    // 每次向上爬一层，都尝试一次组合
    const selector = parts.join(' ');
    if (verifySelector(selector, el)) return selector;

    // 如果是目标元素且属性组合不唯一，尝试添加索引作为局部唯一标识
    if (isTarget) {
      const parent = current.parentElement;
      if (parent) {
        const siblings = Array.from(parent.children).filter(s => s.tagName === current!.tagName);
        if (siblings.length > 1) {
          const index = siblings.indexOf(current) + 1;
          const nthSelector = `${segment}:nth-of-type(${index})`;
          if (verifySelector(nthSelector, el)) return nthSelector;
        }
      }
    }

    // 遇到 ID 后，如果组合还不唯一，说明页面有重复 ID，继续向上爬
    // 否则 ID 通常是最佳的终点
    if (current.id && verifySelector(parts.join(' '), el)) break;

    current = current.parentElement;
    depth++;
  }

  // 如果爬到顶了还不唯一（极罕见），则返回 null 交给兜底
  const finalSelector = parts.join(' ');
  return verifySelector(finalSelector, el) ? finalSelector : null;
}

/**
 * 兜底全路径选择器
 */
function generatePathSelector(el: Element): string {
  const path: string[] = [];
  let current: Element | null = el;

  while (current && current !== document.body) {
    const tag = current.tagName.toLowerCase();
    const parent: Element | null = current.parentElement;
    if (parent) {
      const siblings = Array.from(parent.children).filter((c: Element) => c.tagName === current!.tagName);
      const idx = siblings.indexOf(current) + 1;
      path.unshift(siblings.length > 1 ? `${tag}:nth-of-type(${idx})` : tag);
    } else {
      path.unshift(tag);
    }
    current = parent;
  }
  return path.join(' > ');
}

/**
 * 生成最佳唯一选择器
 */
export function generateBestSelector(el: Element): string {
  // 1. 快轨：自身语义属性是否已足够唯一
  const fastSegment = getElementSegment(el, true);
  if (verifySelector(fastSegment, el)) return fastSegment;

  // 2. 渐进式攀爬
  const progressiveSelector = buildProgressivePath(el);
  if (progressiveSelector) return progressiveSelector;

  // 3. 最终兜底
  return generatePathSelector(el);
}

export function extractElementInfo(el: Element): RecordedElement {
  const tag = el.tagName.toLowerCase();
  const rect = el.getBoundingClientRect();

  let text = '';
  const ariaLabel = el.getAttribute('aria-label');
  if (ariaLabel) {
    text = ariaLabel;
  } else {
    text = (el as HTMLElement).innerText?.trim() || '';
  }

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
  if (href && tag === 'a') attrs.href = href;

  return {
    tag,
    text,
    selectors: [generateBestSelector(el)],
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
  if (tag === 'input' && (el as HTMLInputElement).type === 'password') {
    return true;
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
