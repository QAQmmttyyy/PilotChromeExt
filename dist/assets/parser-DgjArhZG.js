function g(t){const i=/\/\/ === STEP:\s*(.*?)(?:\s*\((https?:\/\/[^)]+)\))?\s*===/g,l=[];let r,u=0,e=null,c,n="";const p=i.exec(t);if(!p)return[{id:"single-step",name:"Main Script",code:t}];for(n=t.substring(0,p.index).trim(),i.lastIndex=0;(r=i.exec(t))!==null;){if(e){const o=t.substring(u,r.index).trim();e.code=n?`${n}

${o}`:o;const d=o.includes("pageAgent.execute");e.isAiStep=d,!d&&e.name==="navigate"?e.url=c:e.url=void 0,l.push(e)}const s=r[1].trim();c=r[2],e={id:`step-${l.length+1}`,name:s,url:void 0,code:""},u=i.lastIndex}if(e){const s=t.substring(u).trim();e.code=n?`${n}

${s}`:s;const a=s.includes("pageAgent.execute");e.isAiStep=a,!a&&e.name==="navigate"?e.url=c:e.url=void 0,l.push(e)}return l}export{g as p};
