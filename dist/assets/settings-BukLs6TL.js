const w=[{id:"openai/gpt-4.1-mini",name:"GPT-4.1 Mini",provider:"OpenAI",context:"1M",description:"快速便宜",recommended:!0},{id:"anthropic/claude-haiku-4.5",name:"Claude Haiku 4.5",provider:"Anthropic",context:"200K",description:"极速响应",thinking:!0,recommended:!0},{id:"google/gemini-3-flash-preview",name:"Gemini 3 Flash",provider:"Google",context:"1M",description:"超快推理",thinking:!0,recommended:!0},{id:"deepseek/deepseek-v3.2",name:"DeepSeek V3.2",provider:"DeepSeek",context:"164K",description:"性价比王",thinking:!0,recommended:!0},{id:"x-ai/grok-4-fast",name:"Grok 4 Fast",provider:"xAI",context:"2M",description:"工具调用强",thinking:!0,recommended:!0},{id:"qwen/qwen3-235b-a22b",name:"Qwen3 235B",provider:"Qwen",context:"262K",description:"中文优化"},{id:"openai/gpt-4.1",name:"GPT-4.1",provider:"OpenAI",context:"1M",description:"编码能力强"},{id:"openai/gpt-4.1-nano",name:"GPT-4.1 Nano",provider:"OpenAI",context:"1M",description:"极速便宜"},{id:"x-ai/grok-4",name:"Grok 4",provider:"xAI",context:"256K",description:"深度推理",thinking:!0},{id:"x-ai/grok-code-fast-1",name:"Grok Code Fast",provider:"xAI",context:"256K",description:"编程专精",thinking:!0},{id:"anthropic/claude-3.5-sonnet",name:"Claude 3.5 Sonnet",provider:"Anthropic",context:"200K",description:"经典稳定"},{id:"anthropic/claude-sonnet-4.5",name:"Claude Sonnet 4.5",provider:"Anthropic",context:"1M",description:"均衡之选",thinking:!0},{id:"anthropic/claude-opus-4.5",name:"Claude Opus 4.5",provider:"Anthropic",context:"200K",description:"深度推理",thinking:!0},{id:"google/gemini-2.5-pro",name:"Gemini 2.5 Pro",provider:"Google",context:"1M",description:"多模态强",thinking:!0},{id:"google/gemini-3-pro-preview",name:"Gemini 3 Pro",provider:"Google",context:"1M",description:"最强多模态",thinking:!0}],m="https://openrouter.ai/api/v1/chat/completions",f=`

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
   \`  if (!window.pageAgent?.execute) throw new Error("PageAgent 未就绪");\`
   \`  await window.pageAgent.execute(<录制中 AI 指令后的 JSON 字符串字面量>);\`
   \`  window.Pilot.workflow.next();\`
   \`} catch (err) {\`
   \`  if (err.message?.includes('disposed')) return;\`
   \`  window.Pilot.workflow.fail(err.message);\`
   \`}\`
   - 录制上下文中 AI 指令后的字符串已经是 JSON.stringify 转义后的字面量（如 \`"点击 \\"提交\\" 按钮"\`），直接复制使用即可。
   - 引擎保证就绪后才执行，无需轮询等待。
   - 必须包裹在上述 try-catch 中。
   - disposed 错误通常由页面跳转触发，可忽略。
8. **数据提取与传递（关键规则）**：
   
   **返回值处理**：
   - \`pageAgent.execute()\` 返回 \`{ success: boolean, data: any, history: string[] }\`
   - **必须先检查 success**：如果为 false，data 是错误信息，必须调用 fail
   - **成功时**：data 包含提取的数据或操作结果
   
   **正确的提取模式**：
   \`\`\`
   const result = await window.pageAgent.execute("获取页面标题");
   if (!result.success) {
     return window.Pilot.workflow.fail(result.data || '提取失败');
   }
   // 只有检查通过后才能使用 result.data
   const title = result.data;
   window.Pilot.workflow.next({ pageTitle: title });
   \`\`\`
   
   **多个数据提取**：
   \`\`\`
   const result = await window.pageAgent.execute("提取商品名称和价格");
   if (!result.success) return window.Pilot.workflow.fail(result.data);
   // data 可能是对象或 JSON 字符串，需要处理
   const info = typeof result.data === 'string' ? JSON.parse(result.data) : result.data;
   window.Pilot.workflow.next({ 
     productName: info.name || '',
     productPrice: info.price || ''
   });
   \`\`\`
   
   **使用上一步的数据**：
   \`\`\`
   const title = window.PilotData?.pageTitle || '';
   if (!title) {
     return window.Pilot.workflow.fail('缺少必需的数据：pageTitle');
   }
   await window.pageAgent.execute(\`在搜索框中输入: "\${title}"\`);
   \`\`\`
   
   **错误的模式（禁止）**：
   \`\`\`
   // 错误：未检查 success
   const result = await window.pageAgent.execute("获取标题");
   window.Pilot.workflow.next({ title: result.data }); // 可能传递错误信息
   
   // 错误：未处理空值
   const title = window.PilotData.pageTitle; // 可能 undefined
   await window.pageAgent.execute(\`输入: \${title}\`); // 可能是 "输入: undefined"
   \`\`\`
   
9. **多步骤格式**：用顶层注释分隔：
   - navigate 步骤：\`// === STEP: navigate (https://目标URL) ===\`
   - ai_step 步骤：\`// === STEP: AI Step ===\`（不要在括号中写 URL）
   注释必须在顶层，不能写在函数内部。

## 生成前自检（必须逐条满足，勿输出自检内容）

- 输出是否只有代码、且首行符合规则？
- 是否包含 TS 语法或非标准选择器？（必须为否）
- 是否有 setTimeout 作为等待？（必须为否；仅允许作为 waitFor 的超时机制）
- 是否所有分支最终会 finish/next/fail 之一？
- 是否在 PAGE_CONTEXT 存在时优先使用其中的元素/属性？
- **数据提取是否正确**：
  * 每个 \`pageAgent.execute()\` 调用后是否立即检查 \`success\`？
  * 是否在 success=false 时调用 \`fail()\` 并 return？
  * 是否只在 success=true 时使用 \`result.data\`？
  * 使用 \`window.PilotData\` 时是否有默认值或空值检查？

## 输出

只输出可执行 JavaScript。`;async function*y(t,e){const i=await fetch(e.endpoint||m,{method:"POST",headers:{"Content-Type":"application/json",Authorization:`Bearer ${e.apiKey}`,"HTTP-Referer":"chrome-extension://pilot","X-Title":"Pilot Chrome Extension"},body:JSON.stringify({model:e.model,messages:[{role:"system",content:f},...t],stream:!0})});if(!i.ok){const s=await i.json().catch(()=>({error:{message:i.statusText}}));throw new Error(s.error?.message||`请求失败: ${i.status}`)}const n=i.body?.getReader();if(!n)throw new Error("无法读取响应流");const a=new TextDecoder;let r="";for(;;){const{done:s,value:h}=await n.read();if(s)break;r+=a.decode(h,{stream:!0});const l=r.split(`
`);r=l.pop()||"";for(const p of l)if(p.startsWith("data: ")){const u=p.slice(6);if(u==="[DONE]")return;try{const g=JSON.parse(u).choices?.[0]?.delta?.content;g&&(yield g)}catch{}}}}function S(t,e){return e?e.startsWith("<<RECORDING_CONTEXT>>")?`${e}

用户需求:
${t}`:`当前页面信息:
${e}

用户需求:
${t}`:t}function T(t,e){const i=[];if(i.push(`Step ${e+1}: ${E(t.type)}`),i.push(`- URL: ${t.url}`),i.push(`- 页面: ${t.pageTitle}`),t.element){const n=t.element,a=Object.entries(n.attributes).map(([r,s])=>`${r}="${s}"`).join(" ");i.push(`- 元素: <${n.tag}${a?" "+a:""}>${n.text}</${n.tag}>`),i.push(`- 选择器候选: ${n.selectors.slice(0,5).join(", ")}`)}return t.value!==void 0&&(t.type==="ai_step"?i.push(`- AI 指令: ${JSON.stringify(t.value)}`):i.push(`- 输入值: "${t.value}"`)),t.key&&i.push(`- 按键: ${t.key}`),i.join(`
`)}function E(t){return{click:"点击",input:"输入",navigate:"页面导航",submit:"提交表单",select:"选择下拉框",keypress:"按键",ai_step:"AI 指令"}[t]||t}function A(t){const e=[];e.push("<<RECORDING_CONTEXT>>"),e.push(`录制名称: ${t.name}`),e.push(`起始 URL: ${t.startUrl}`),e.push(`步骤数量: ${t.steps.length}`),e.push(""),e.push("## 录制的操作流程"),e.push("");let i="";return t.steps.forEach((n,a)=>{n.url!==i&&(i&&e.push(""),e.push(`### 页面: ${n.url}`),i=n.url),e.push(""),e.push(T(n,a))}),e.push(""),e.push("<<END_RECORDING_CONTEXT>>"),e.join(`
`)}function v(t){let e=t;e=e.replace(/^```(?:javascript|js)?\s*\n?/i,""),e=e.replace(/\n?```\s*$/i,"");const i=["// === STEP:","(async () =>",";(async () =>","(() =>",";(() =>","const ","let ","var ","function "];let n=-1;for(const a of i){const r=e.indexOf(a);r>=0&&(n===-1||r<n)&&(n=r)}return n>0&&(e=e.slice(n)),e.trim()}function k(t){return w.find(e=>e.id===t)}const d="pilot_settings",c={ai:{apiKey:"",model:w[0].id,endpoint:"https://openrouter.ai/api/v1/chat/completions"},agentServerUrl:"http://localhost:3000"},o={get:async()=>{const e=(await chrome.storage.local.get(d))[d];return{ai:{apiKey:e?.ai?.apiKey??c.ai.apiKey,model:e?.ai?.model??c.ai.model,endpoint:e?.ai?.endpoint??c.ai.endpoint},agentServerUrl:e?.agentServerUrl??c.agentServerUrl}},set:async t=>{const e=await o.get(),i={ai:{apiKey:t.ai?.apiKey??e.ai.apiKey,model:t.ai?.model??e.ai.model,endpoint:t.ai?.endpoint??e.ai.endpoint},agentServerUrl:t.agentServerUrl??e.agentServerUrl};await chrome.storage.local.set({[d]:i})},getAIConfig:async()=>(await o.get()).ai,setAIConfig:async t=>{const e=await o.get();await o.set({ai:{apiKey:t.apiKey??e.ai.apiKey,model:t.model??e.ai.model,endpoint:t.endpoint??e.ai.endpoint}})},hasApiKey:async()=>!!(await o.get()).ai.apiKey,getServerUrl:async()=>(await o.get()).agentServerUrl},O=o.get;export{w as A,O as a,A as b,v as c,S as d,y as e,k as g,o as s};
