import{c as w,r as p,s as y,j as e,P as k,R as q,a as z}from"./index-DgdPjMZI.js";const W=[["path",{d:"m12 19-7-7 7-7",key:"1l729n"}],["path",{d:"M19 12H5",key:"x3x0zl"}]],_=w("arrow-left",W);const G=[["path",{d:"M2.062 12.348a1 1 0 0 1 0-.696 10.75 10.75 0 0 1 19.876 0 1 1 0 0 1 0 .696 10.75 10.75 0 0 1-19.876 0",key:"1nclc0"}],["circle",{cx:"12",cy:"12",r:"3",key:"1v7zrd"}]],F=w("eye",G);const L=[["path",{d:"M5 12h14",key:"1ays0h"}],["path",{d:"M12 5v14",key:"s699le"}]],U=w("plus",L);const V=[["path",{d:"M15.2 3a2 2 0 0 1 1.4.6l3.8 3.8a2 2 0 0 1 .6 1.4V19a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z",key:"1c8476"}],["path",{d:"M17 21v-7a1 1 0 0 0-1-1H8a1 1 0 0 0-1 1v7",key:"1ydtos"}],["path",{d:"M7 3v4a1 1 0 0 0 1 1h7",key:"t51u73"}]],H=w("save",V);const O=[["path",{d:"M11.017 2.814a1 1 0 0 1 1.966 0l1.051 5.558a2 2 0 0 0 1.594 1.594l5.558 1.051a1 1 0 0 1 0 1.966l-5.558 1.051a2 2 0 0 0-1.594 1.594l-1.051 5.558a1 1 0 0 1-1.966 0l-1.051-5.558a2 2 0 0 0-1.594-1.594l-5.558-1.051a1 1 0 0 1 0-1.966l5.558-1.051a2 2 0 0 0 1.594-1.594z",key:"1s2grr"}],["path",{d:"M20 2v4",key:"1rf3ol"}],["path",{d:"M22 4h-4",key:"gwowj6"}],["circle",{cx:"4",cy:"20",r:"2",key:"6kqj1y"}]],B=w("sparkles",O);const K=[["path",{d:"M10 11v6",key:"nco0om"}],["path",{d:"M14 11v6",key:"outv1u"}],["path",{d:"M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6",key:"miytrc"}],["path",{d:"M3 6h18",key:"d0wm0j"}],["path",{d:"M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2",key:"e791ji"}]],J=w("trash-2",K);function Q(i){const c=/\/\/ === STEP:\s*(.*?)(?:\s*\((https?:\/\/[^)]+)\))?\s*===/g,m=[];let d,r=0,n=null,a="";const x=c.exec(i);if(!x)return[{id:"single-step",name:"Main Script",code:i}];for(a=i.substring(0,x.index).trim(),c.lastIndex=0;(d=c.exec(i))!==null;){if(n){const g=i.substring(r,d.index).trim();n.code=a?`${a}

${g}`:g,m.push(n)}const h=d[1].trim(),f=d[2];n={id:`step-${m.length+1}`,name:h,url:f,code:""},r=c.lastIndex}if(n){const h=i.substring(r).trim();n.code=a?`${a}

${h}`:h,m.push(n)}return m}const S={id:"baidu-google-workflow",name:"百度 -> Google 搜索",description:"AI 生成的完整脚本示例：工具函数 + 业务逻辑",code:`// ============================================
// 工具函数（AI 根据需要生成）
// ============================================
function waitForElement(selector, timeout = 5000) {
  return new Promise((resolve, reject) => {
    const startTime = Date.now();
    const check = () => {
      const el = document.querySelector(selector);
      if (el) {
        resolve(el);
      } else if (Date.now() - startTime > timeout) {
        reject(new Error(\`超时: 未找到元素 "\${selector}" (\${timeout}ms)\`));
      } else {
        setTimeout(check, 200);
      }
    };
    check();
  });
}

// ============================================
// === STEP: 在百度搜索 (https://www.baidu.com) ===
// ============================================
(async () => {
  try {
    console.log('[Step 1] 等待百度搜索框...');
    const input = await waitForElement('#kw, input[name="wd"]', 5000);
    
    console.log('[Step 1] ✓ 找到搜索框');
    input.value = "Chrome Extension Development";
    input.dispatchEvent(new Event('input', {bubbles: true}));
    
    const btn = await waitForElement('#su, input[type="submit"]', 3000);
    console.log('[Step 1] ✓ 点击搜索按钮');
    btn.click();
    
    // 通知 Pilot：步骤完成
    window.Pilot.workflow.next({ searchTerm: "Chrome Extension" });
  } catch (err) {
    window.Pilot.workflow.fail('百度首页: ' + err.message);
  }
})();

// ============================================
// === STEP: 提取百度结果 (https://www.baidu.com/s) ===
// ============================================
(async () => {
  try {
    console.log('[Step 2] 等待百度搜索结果...');
    const firstResult = await waitForElement('h3.c-title a, .result h3 a, .c-title a', 8000);
    
    const title = firstResult.innerText.trim();
    if (!title) {
      throw new Error('提取到的标题为空');
    }
    
    console.log('[Step 2] ✓ 提取到:', title);
    window.Pilot.workflow.next({ baiduTitle: title });
  } catch (err) {
    window.Pilot.workflow.fail('百度结果页: ' + err.message);
  }
})();

// ============================================
// === STEP: 去 Google 搜索 (https://www.google.com) ===
// ============================================
(async () => {
  try {
    const data = window.PilotData || {};
    const query = data.baiduTitle || data.searchTerm;
    
    if (!query) {
      throw new Error('没有从上一步获取到搜索词');
    }
    
    console.log('[Step 3] 等待 Google 搜索框...');
    const googleInput = await waitForElement('textarea[name="q"], input[name="q"]', 5000);
    
    googleInput.value = query;
    googleInput.dispatchEvent(new Event('input', {bubbles: true}));
    
    console.log('[Step 3] ✅ 完成！已填入:', query);
    alert(\`✅ Workflow 完成！\\n\\n从百度提取: \${query}\\n已填入 Google 搜索框\`);
    window.Pilot.workflow.finish();
  } catch (err) {
    window.Pilot.workflow.fail('Google 页面: ' + err.message);
  }
})();
`,createdAt:Date.now(),updatedAt:Date.now()};function X(){const[i,c]=p.useState("list"),[m,d]=p.useState([]),[r,n]=p.useState(null),[a,x]=p.useState(""),[h,f]=p.useState(!1),[g,N]=p.useState("");p.useEffect(()=>{b()},[]);const b=async()=>{let t=await y.getScripts();t.length===0&&(await y.saveScript(S),t=[S]),d(t)},P=()=>{const t={id:crypto.randomUUID(),name:"New Script",description:"Created by Pilot",code:`// === STEP: Start (https://example.com) ===
// Write your code here`,createdAt:Date.now(),updatedAt:Date.now()};n(t),c("editor")},E=t=>{n(t),c("editor")},$=async(t,o)=>{t.stopPropagation(),confirm("Are you sure you want to delete this script?")&&(await y.deleteScript(o),b())},C=async()=>{if(r){const t={...r,updatedAt:Date.now()};await y.saveScript(t),d(o=>{const s=o.findIndex(l=>l.id===t.id);if(s>=0){const l=[...o];return l[s]=t,l}return[...o,t]})}},v=async t=>{const[o]=await chrome.tabs.query({active:!0,currentWindow:!0});if(!o.id)return;const s=Q(t.code);if(console.log("Parsed Workflow:",s),!(s.length>1||s.length===1&&s[0].url)&&(o.url?.startsWith("chrome://")||o.url?.startsWith("chrome-extension://")||!o.url)){alert(`单页脚本无法在扩展页面运行。
请打开一个真实的网页再试，或者在脚本第一行添加 "// === STEP: Name (https://...) ===" 来指定目标网址。`);return}try{await chrome.runtime.sendMessage({type:"START_WORKFLOW",payload:{steps:s,tabId:o.id}})}catch(u){console.error("Failed to start workflow:",u),alert("Failed to start workflow.")}},T=async()=>{const[t]=await chrome.tabs.query({active:!0,currentWindow:!0});if(t.id)try{const o=await chrome.scripting.executeScript({target:{tabId:t.id},func:()=>{const l=Array.from(document.querySelectorAll("button, a, input, textarea, form")).map(u=>{const A=u.tagName.toLowerCase(),I=u.id?`#${u.id}`:"",M=Array.from(u.classList).map(D=>`.${D}`).join(""),R=u.innerText?.slice(0,50).replace(/\n/g," ")||"";return`${A}${I}${M} [text="${R}"]`}).join(`
`);return{title:document.title,url:window.location.href,dom:l}}});if(o[0]&&o[0].result){const s=o[0].result;N(`Current Page: ${s.title}
URL: ${s.url}
Interactive Elements:
${s.dom}`),x(l=>l||"帮我分析这个页面，写一个脚本...")}}catch(o){console.error("Failed to capture context",o)}},j=async()=>{if(!a.trim())return;f(!0);const t=`User Request: ${a}

${g?`Page Context (Use this to find selectors):
${g}`:""}`;console.log("Sending to AI:",t),setTimeout(()=>{let o=`// AI Response
`;const s=a.toLowerCase();s.includes("google")&&s.includes("bing")?o=`
// === STEP: Google Search (https://www.google.com) ===
const input = document.querySelector('input[name="q"]');
if(input) {
  input.value = "${a.replace("google","").replace("bing","").trim()}";
  input.form.submit();
  window.Pilot.workflow.next();
}

// === STEP: Bing Search (https://www.bing.com) ===
const input = document.querySelector('input[name="q"]');
if(input) {
  input.value = "Result from Google";
  window.Pilot.workflow.finish();
}
`:o+=`console.log("AI executed: ${a}");`,r&&n({...r,code:r.code+`

`+o}),f(!1),x("")},1e3)};return i==="editor"&&r?e.jsxs("div",{className:"h-screen w-full bg-gray-50 flex flex-col",children:[e.jsxs("header",{className:"p-3 bg-white border-b border-gray-200 flex justify-between items-center sticky top-0 z-10",children:[e.jsxs("div",{className:"flex items-center gap-2",children:[e.jsx("button",{onClick:()=>{b(),c("list")},className:"p-1 hover:bg-gray-100 rounded",children:e.jsx(_,{size:20})}),e.jsx("input",{value:r.name,onChange:t=>n({...r,name:t.target.value}),className:"font-bold text-gray-800 bg-transparent border-none focus:ring-0 w-32 truncate"})]}),e.jsxs("div",{className:"flex gap-2",children:[e.jsxs("button",{onClick:()=>v(r),className:"p-2 text-blue-600 bg-blue-50 rounded hover:bg-blue-100 flex items-center gap-1",title:"Run Workflow",children:[e.jsx(k,{size:18}),e.jsx("span",{className:"text-xs font-semibold",children:"Run"})]}),e.jsx("button",{onClick:C,className:"p-2 text-green-600 bg-green-50 rounded hover:bg-green-100",title:"Save",children:e.jsx(H,{size:18})})]})]}),e.jsxs("div",{className:"flex-1 flex flex-col p-4 gap-4 overflow-hidden",children:[e.jsxs("div",{className:"flex-1 border border-gray-300 rounded-lg overflow-hidden flex flex-col bg-white shadow-sm",children:[e.jsxs("div",{className:"bg-gray-100 px-4 py-1 text-xs text-gray-500 border-b border-gray-200 flex justify-between",children:[e.jsx("span",{children:"Workflow Editor"}),e.jsx("span",{className:"text-gray-400",children:"Use // === STEP: Name (Url) === to split steps"})]}),e.jsx("textarea",{className:"flex-1 w-full p-4 font-mono text-xs resize-none focus:outline-none leading-relaxed",value:r.code,onChange:t=>n({...r,code:t.target.value}),spellCheck:!1,placeholder:"// === STEP: Step 1 === ..."})]}),e.jsxs("div",{className:"bg-white p-3 rounded-lg border border-gray-200 shadow-sm flex flex-col gap-2",children:[e.jsxs("div",{className:"flex justify-between items-center",children:[e.jsxs("div",{className:"flex items-center gap-2",children:[e.jsx(B,{size:16,className:"text-purple-600"}),e.jsx("span",{className:"text-xs font-semibold text-purple-600",children:"AI Assistant"})]}),e.jsxs("button",{onClick:T,className:"flex items-center gap-1 text-xs px-2 py-1 rounded border bg-gray-50 text-gray-600 border-gray-200 hover:bg-gray-100",children:[e.jsx(F,{size:12}),g?"Context Loaded":"Read Page"]})]}),e.jsxs("div",{className:"flex gap-2",children:[e.jsx("input",{type:"text",value:a,onChange:t=>x(t.target.value),placeholder:"Describe your workflow...",className:"flex-1 text-sm border border-gray-300 rounded px-3 py-2 focus:outline-none focus:border-purple-400",onKeyDown:t=>t.key==="Enter"&&j()}),e.jsx("button",{onClick:j,disabled:h,className:"bg-purple-600 text-white px-4 py-2 rounded text-sm hover:bg-purple-700 disabled:opacity-50",children:"Send"})]})]})]})]}):e.jsxs("div",{className:"h-screen w-full bg-gray-50 flex flex-col",children:[e.jsxs("header",{className:"p-4 bg-white border-b border-gray-200 shadow-sm flex justify-between items-center sticky top-0 z-10",children:[e.jsx("h1",{className:"text-lg font-bold text-gray-800",children:"Pilot Scripts"}),e.jsx("button",{onClick:P,className:"p-2 bg-blue-600 text-white rounded-full hover:bg-blue-700 transition-colors shadow-md",children:e.jsx(U,{size:20})})]}),e.jsx("main",{className:"flex-1 overflow-y-auto p-4 space-y-3",children:m.map(t=>e.jsxs("div",{onClick:()=>E(t),className:"bg-white p-4 rounded-lg shadow-sm border border-gray-200 hover:border-blue-400 transition-all cursor-pointer group",children:[e.jsxs("div",{className:"flex justify-between items-start mb-2",children:[e.jsx("h3",{className:"font-semibold text-gray-800 group-hover:text-blue-600 transition-colors",children:t.name}),e.jsxs("div",{className:"flex gap-1",onClick:o=>o.stopPropagation(),children:[e.jsx("button",{onClick:()=>v(t),className:"p-1.5 text-gray-400 hover:text-green-600 hover:bg-green-50 rounded transition-colors",title:"Run now",children:e.jsx(k,{size:16})}),e.jsx("button",{onClick:o=>$(o,t.id),className:"p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors",title:"Delete",children:e.jsx(J,{size:16})})]})]}),e.jsx("p",{className:"text-sm text-gray-500 line-clamp-2",children:t.description||"No description"}),e.jsxs("div",{className:"mt-2 text-xs text-gray-400",children:["Updated: ",new Date(t.updatedAt).toLocaleDateString()]})]},t.id))})]})}q.createRoot(document.getElementById("root")).render(e.jsx(z.StrictMode,{children:e.jsx(X,{})}));
