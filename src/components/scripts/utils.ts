import { Script } from '../../lib/storage';
import { RecordedStep } from '../../lib/types';

// Seed data
export const SEED_SCRIPT: Script = {
  id: 'demo-workflow',
  name: '示例：百度搜索',
  description: '演示如何使用 Pilot 进行多步骤任务',
  code: `// === STEP: 打开百度 (https://www.baidu.com) ===
(async () => {
  try {
    const input = document.querySelector('#kw');
    if (!input) throw new Error('未找到搜索框');
    input.value = "Pilot Chrome Extension";
    input.dispatchEvent(new Event('input', {bubbles: true}));
    document.querySelector('#su')?.click();
    window.Pilot.workflow.next({ keyword: "Pilot" });
  } catch (err) {
    window.Pilot.workflow.fail(err.message);
  }
})();

// === STEP: 提取搜索结果 (https://www.baidu.com/s) ===
(async () => {
  function waitFor(sel, timeout = 5000) {
    return new Promise((res, rej) => {
      const t = Date.now();
      (function c() {
        const e = document.querySelector(sel);
        e ? res(e) : Date.now() - t > timeout ? rej(new Error('超时')) : setTimeout(c, 200);
      })();
    });
  }
  
  try {
    const result = await waitFor('h3.c-title a', 8000);
    alert('✅ 找到: ' + result.innerText.trim());
    window.Pilot.workflow.finish();
  } catch (err) {
    window.Pilot.workflow.fail(err.message);
  }
})();
`,
  createdAt: Date.now(),
  updatedAt: Date.now()
};

export function getStepDescription(step: RecordedStep): string {
  switch (step.type) {
    case 'click':
      return `点击 <${step.element?.tag}> ${step.element?.text?.slice(0, 20) || ''}`;
    case 'input':
      return `输入 "${step.value?.slice(0, 15) || ''}${(step.value?.length || 0) > 15 ? '...' : ''}"`;
    case 'navigate':
      return step.url;
    case 'submit':
      return `提交表单`;
    case 'select':
      return `选择 "${step.value}"`;
    case 'keypress':
      return `按键 ${step.key}`;
    case 'ai_step':
      return `AI 指令: ${step.value}`;
    default:
      return step.type;
  }
}

