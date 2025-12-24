const m=[{id:"anthropic/claude-opus-4.5",name:"Claude Opus 4.5",provider:"Anthropic",context:"200K",description:"最强旗舰",thinking:!0},{id:"anthropic/claude-sonnet-4.5",name:"Claude Sonnet 4.5",provider:"Anthropic",context:"1M",description:"最新推荐",thinking:!0},{id:"anthropic/claude-haiku-4.5",name:"Claude Haiku 4.5",provider:"Anthropic",context:"200K",description:"快速高效",thinking:!0},{id:"anthropic/claude-opus-4.1",name:"Claude Opus 4.1",provider:"Anthropic",context:"200K",description:"编码推理强",thinking:!0},{id:"anthropic/claude-sonnet-4",name:"Claude Sonnet 4",provider:"Anthropic",context:"1M",description:"性价比高",thinking:!0},{id:"anthropic/claude-3.7-sonnet:thinking",name:"Claude 3.7 Sonnet",provider:"Anthropic",context:"200K",description:"思考模式",thinking:!0},{id:"anthropic/claude-3.5-sonnet",name:"Claude 3.5 Sonnet",provider:"Anthropic",context:"200K",description:"经典稳定"},{id:"anthropic/claude-3.5-haiku",name:"Claude 3.5 Haiku",provider:"Anthropic",context:"200K",description:"极速便宜"},{id:"openai/gpt-5.2",name:"GPT-5.2",provider:"OpenAI",context:"400K",description:"最新旗舰",thinking:!0},{id:"openai/gpt-5.2-pro",name:"GPT-5.2 Pro",provider:"OpenAI",context:"400K",description:"深度推理",thinking:!0},{id:"openai/gpt-5.2-chat",name:"GPT-5.2 Chat",provider:"OpenAI",context:"128K",description:"快速对话"},{id:"openai/gpt-4o",name:"GPT-4o",provider:"OpenAI",context:"128K",description:"多模态"},{id:"openai/gpt-4o-mini",name:"GPT-4o Mini",provider:"OpenAI",context:"128K",description:"便宜实惠"},{id:"openai/o3-mini",name:"O3 Mini",provider:"OpenAI",context:"200K",description:"推理模型",thinking:!0},{id:"google/gemini-2.5-pro-preview",name:"Gemini 2.5 Pro",provider:"Google",context:"1M",description:"最强多模态",thinking:!0},{id:"google/gemini-2.0-flash-001",name:"Gemini 2.0 Flash",provider:"Google",context:"1M",description:"快速免费"},{id:"deepseek/deepseek-r1",name:"DeepSeek R1",provider:"DeepSeek",context:"64K",description:"推理能力强",thinking:!0},{id:"deepseek/deepseek-chat",name:"DeepSeek Chat",provider:"DeepSeek",context:"64K",description:"极致性价比"},{id:"mistralai/devstral-2512",name:"Devstral 2",provider:"Mistral",context:"256K",description:"编程专精"}],T="https://openrouter.ai/api/v1/chat/completions",f=`

## 输入约定（非常重要）

用户消息可能包含：
- <<PAGE_CONTEXT>>
- <<END_PAGE_CONTEXT>>

PAGE_CONTEXT 是当前页面可操作元素的提取结果（包含 [uid]、属性、文本）。当它存在时：
- **优先从 PAGE_CONTEXT 里挑选元素与选择器**，不要凭空"猜"选择器。
- 如果 PAGE_CONTEXT 里没有目标元素，再退而求其次用稳定属性（id/name/aria-label/role/语义标签）构造选择器，并提供备选。

用户消息也可能包含：
- <<RECORDING_CONTEXT>>
- <<END_RECORDING_CONTEXT>>

RECORDING_CONTEXT 是用户录制的操作流程，包含每一步的操作类型、元素信息、选择器候选等。当它存在时：
- **严格按照录制的步骤顺序生成脚本**，确保每一步都对应录制中的操作。
- **优先使用录制中提供的选择器候选**，它们是从实际 DOM 中提取的，更可靠。
- 如果录制包含多页面导航，使用 \`// === STEP:\` 格式分隔不同页面的步骤。
- 录制中的元素信息可能不完整，但选择器候选通常是准确的。
## 输出契约（必须满足）

1. **只输出纯 JavaScript 代码**：禁止 TypeScript（as、类型注解、interface、泛型等）。
2. **只输出代码**：禁止解释、禁止 markdown 代码块、禁止前后缀文字。输出必须以 \`// === STEP:\` 或 \`(async () =>\` 开头。
3. **选择器必须可被 querySelector 执行**：
   - 禁止非标准伪类：\`:has-text()\`、\`:contains()\`、\`:text()\`、\`:has()\` 等一律禁止。
   - 允许的策略：\`#id\`、\`[name="..."]\`、\`[aria-label="..."]\`、\`[role="..."]\`、语义标签 + 属性。
   - 当存在多个备选时，用逗号合并（\`'a, b, c'\`），并优先靠稳定属性排序。
4. **等待机制**：禁止用 setTimeout“猜时间”等待页面/元素出现。
   - 需要等待时，必须在脚本顶部定义 \`waitFor(selector, timeout)\`（轮询或 MutationObserver 均可），并在实际等待处使用它。
   - 不需要等待就不要定义 waitFor。
5. **错误必须终止流程**：任意一步失败都调用 \`window.Pilot.workflow.fail(reason)\` 并 return。
6. **流程收尾必须明确**：
    - 单步：\`finish()\`
    - 多步：中间用 \`next(data)\`，最后一步用 \`finish()\`
7. **AI Step 集成**：如果录制中包含 \`ai_step\`（AI 指令），必须生成如下格式的代码：
   \`try {\`
   \`  if (!window.pageAgent) throw new Error("PageAgent 未初始化");\`
   \`  await window.pageAgent.execute("用户指令");\`
   \`  window.Pilot.workflow.next();\`
   \`} catch (err) {\`
   \`  // 忽略由于页面跳转导致的动作中断错误\`
   \`  if (err.message?.includes('disposed')) return;\`
   \`  window.Pilot.workflow.fail(err.message);\`
   \`}\`
   - **必须使用 await**。
   - 不要生成额外的 waitFor 或 selector，因为 pageAgent 会处理。
   - 必须包裹在上述 try-catch 中。
8. **多步骤格式**：用顶层注释分隔：
   \`// === STEP: 名称 (https://目标URL可选) ===\`
   注释必须在顶层，不能写在函数内部。

## 生成前自检（必须逐条满足，勿输出自检内容）

- 输出是否只有代码、且首行符合规则？
- 是否包含 TS 语法或非标准选择器？（必须为否）
- 是否有 setTimeout 作为等待？（必须为否；仅允许作为 waitFor 的超时机制）
- 是否所有分支最终会 finish/next/fail 之一？
- 是否在 PAGE_CONTEXT 存在时优先使用其中的元素/属性？

## 输出

只输出可执行 JavaScript。`;async function*A(t,e){const i=await fetch(e.endpoint||T,{method:"POST",headers:{"Content-Type":"application/json",Authorization:`Bearer ${e.apiKey}`,"HTTP-Referer":"chrome-extension://pilot","X-Title":"Pilot Chrome Extension"},body:JSON.stringify({model:e.model,messages:[{role:"system",content:f},...t],stream:!0})});if(!i.ok){const a=await i.json().catch(()=>({error:{message:i.statusText}}));throw new Error(a.error?.message||`请求失败: ${i.status}`)}const n=i.body?.getReader();if(!n)throw new Error("无法读取响应流");const r=new TextDecoder;let o="";for(;;){const{done:a,value:g}=await n.read();if(a)break;o+=r.decode(g,{stream:!0});const d=o.split(`
`);o=d.pop()||"";for(const l of d)if(l.startsWith("data: ")){const u=l.slice(6);if(u==="[DONE]")return;try{const h=JSON.parse(u).choices?.[0]?.delta?.content;h&&(yield h)}catch{}}}}function O(t,e){return e?e.startsWith("<<RECORDING_CONTEXT>>")?`${e}

用户需求:
${t}`:`当前页面信息:
${e}

用户需求:
${t}`:t}function E(t,e){const i=[];if(i.push(`Step ${e+1}: ${w(t.type)}`),i.push(`- URL: ${t.url}`),i.push(`- 页面: ${t.pageTitle}`),t.element){const n=t.element,r=Object.entries(n.attributes).map(([o,a])=>`${o}="${a}"`).join(" ");i.push(`- 元素: <${n.tag}${r?" "+r:""}>${n.text}</${n.tag}>`),i.push(`- 选择器候选: ${n.selectors.slice(0,5).join(", ")}`)}return t.value!==void 0&&(t.type==="ai_step"?i.push(`- AI 指令: "${t.value}"`):i.push(`- 输入值: "${t.value}"`)),t.key&&i.push(`- 按键: ${t.key}`),i.join(`
`)}function w(t){return{click:"点击",input:"输入",navigate:"页面导航",submit:"提交表单",select:"选择下拉框",keypress:"按键",ai_step:"AI 指令"}[t]||t}function v(t){const e=[];e.push("<<RECORDING_CONTEXT>>"),e.push(`录制名称: ${t.name}`),e.push(`起始 URL: ${t.startUrl}`),e.push(`步骤数量: ${t.steps.length}`),e.push(""),e.push("## 录制的操作流程"),e.push("");let i="";return t.steps.forEach((n,r)=>{n.url!==i&&(i&&e.push(""),e.push(`### 页面: ${n.url}`),i=n.url),e.push(""),e.push(E(n,r))}),e.push(""),e.push("<<END_RECORDING_CONTEXT>>"),e.join(`
`)}function k(t){let e=t;e=e.replace(/^```(?:javascript|js)?\s*\n?/i,""),e=e.replace(/\n?```\s*$/i,"");const i=["// === STEP:","(async () =>",";(async () =>","(() =>",";(() =>","const ","let ","var ","function "];let n=-1;for(const r of i){const o=e.indexOf(r);o>=0&&(n===-1||o<n)&&(n=o)}return n>0&&(e=e.slice(n)),e.trim()}function S(t){return m.find(e=>e.id===t)}const c="pilot_settings",p={ai:{apiKey:"",model:m[0].id,endpoint:"https://openrouter.ai/api/v1/chat/completions"}},s={get:async()=>{const e=(await chrome.storage.local.get(c))[c];return{ai:{apiKey:e?.ai?.apiKey??p.ai.apiKey,model:e?.ai?.model??p.ai.model,endpoint:e?.ai?.endpoint??p.ai.endpoint}}},set:async t=>{const e=await s.get(),i={ai:{apiKey:t.ai?.apiKey??e.ai.apiKey,model:t.ai?.model??e.ai.model,endpoint:t.ai?.endpoint??e.ai.endpoint}};await chrome.storage.local.set({[c]:i})},getAIConfig:async()=>(await s.get()).ai,setAIConfig:async t=>{const e=await s.get();await s.set({ai:{apiKey:t.apiKey??e.ai.apiKey,model:t.model??e.ai.model,endpoint:t.endpoint??e.ai.endpoint}})},hasApiKey:async()=>!!(await s.get()).ai.apiKey};export{m as A,O as a,v as b,A as c,k as d,S as g,s};
