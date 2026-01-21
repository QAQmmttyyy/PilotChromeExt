function x(n){const c=/\/\/ === STEP:\s*(.*?)(?:\s*\((https?:\/\/[^)]+)\))?\s*===/g,p=/\/\/ INSTRUCTION:\s*(.+)/,r=[];let l,u=0,t=null,o,s="";const d=c.exec(n);if(!d)return[{id:"single-step",name:"Main Script",code:n}];for(s=n.substring(0,d.index).trim(),c.lastIndex=0;(l=c.exec(n))!==null;){if(t){const e=n.substring(u,l.index).trim(),g=e.match(p);g&&(t.instruction=g[1].trim()),t.code=s?`${s}

${e}`:e;const m=e.includes("pageAgent.execute");t.isAiStep=m,!m&&t.name==="navigate"?t.url=o:t.url=void 0,r.push(t)}const i=l[1].trim();o=l[2],t={id:`step-${r.length+1}`,name:i,url:void 0,code:""},u=c.lastIndex}if(t){const i=n.substring(u).trim(),a=i.match(p);a&&(t.instruction=a[1].trim()),t.code=s?`${s}

${i}`:i;const e=i.includes("pageAgent.execute");t.isAiStep=e,!e&&t.name==="navigate"?t.url=o:t.url=void 0,r.push(t)}return r}export{x as p};
