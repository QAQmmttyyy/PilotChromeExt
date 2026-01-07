function o(t){const i=/\/\/ === STEP:\s*(.*?)(?:\s*\((https?:\/\/[^)]+)\))?\s*===/g,l=[];let c,r=0,e=null,s="";const p=i.exec(t);if(!p)return[{id:"single-step",name:"Main Script",code:t}];for(s=t.substring(0,p.index).trim(),i.lastIndex=0;(c=i.exec(t))!==null;){if(e){const u=t.substring(r,c.index).trim();e.code=s?`${s}

${u}`:u,e.isAiStep=u.includes("pageAgent.execute"),l.push(e)}const n=c[1].trim(),a=c[2];e={id:`step-${l.length+1}`,name:n,url:a,code:""},r=i.lastIndex}if(e){const n=t.substring(r).trim();e.code=s?`${s}

${n}`:n,e.isAiStep=n.includes("pageAgent.execute"),l.push(e)}return l}export{o as p};
