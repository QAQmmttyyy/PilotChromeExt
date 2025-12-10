console.log("Pilot background script loaded");chrome.runtime.onMessage.addListener(e=>{console.log("Received message:",e)});
