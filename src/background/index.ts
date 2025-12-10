console.log('Pilot background script loaded');

// Example: Listen for messages
chrome.runtime.onMessage.addListener((request) => {
  console.log('Received message:', request);
});

