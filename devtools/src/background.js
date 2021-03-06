// Tab ID to port of a DevTools page, background script is a singleton.
let connections = {};

// DevTools page connecting.
chrome.runtime.onConnect.addListener(function(port) {
  // Message from the DevTools page.
  let extensionListener = function(message, sender, sendResponse) {
    switch (message.name) {
      case 'init':
        connections[message.tabId] = port;
        chrome.tabs.sendMessage(message.tabId, {messageType: 'init-debug'});
        break;
      case 'command':
        chrome.tabs.sendMessage(message.tabId, message.msg);
        break;
    }
  };

  port.onMessage.addListener(extensionListener);
  port.onDisconnect.addListener(function(port) {
    port.onMessage.removeListener(extensionListener);
    for (let tabId of Object.keys(connections)) {
      if (connections[tabId] === port) delete connections[tabId];
    }
  });
});

// Message from the content script.
chrome.runtime.onMessage.addListener(function(message, sender, sendResponse) {
  let tabId = sender.tab.id;
  if (tabId in connections) {
    connections[tabId].postMessage(message);
  }
  return true;
});

chrome.webNavigation.onCommitted.addListener(function(details) {
  if (details.frameId !== 0) {
    return; // Ignore if it's not the top-frame.
  }
  let tabId = details.tabId;
  if (tabId in connections) {
    connections[tabId].postMessage([{messageType: 'page-refresh'}]);
    chrome.tabs.sendMessage(tabId, {messageType: 'init-debug'});
  }
});
