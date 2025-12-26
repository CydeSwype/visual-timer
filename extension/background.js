var popupWindowID;
var windowIsOpen = false;

// Window state management using in-memory cache (no permissions required)
// Note: Persists during extension lifetime, but not across browser restarts
// The window itself also saves to localStorage for potential future use
let windowStateCache = {
    width: 300,
    height: 100,
    left: undefined,
    top: undefined
};

function loadWindowState() {
    return new Promise((resolve) => {
        // Return cached state
        resolve({
            width: windowStateCache.width,
            height: windowStateCache.height,
            left: windowStateCache.left,
            top: windowStateCache.top
        });
    });
}

function saveWindowState(windowId) {
    chrome.windows.get(windowId, (win) => {
        if (chrome.runtime.lastError) {
            return;
        }
        
        // Update cache
        windowStateCache = {
            width: win.width,
            height: win.height,
            left: win.left,
            top: win.top
        };
    });
}

// Debounce function to avoid excessive saves
let saveTimeout;
function debouncedSaveWindowState(windowId) {
    clearTimeout(saveTimeout);
    saveTimeout = setTimeout(() => {
        saveWindowState(windowId);
    }, 500);
}

chrome.runtime.onInstalled.addListener(() => {
    const foo = 1
});

// Listen for messages from the window to restore its state
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === 'restoreWindowState' && message.state) {
        const state = message.state;
        // Get the window ID from the sender
        if (sender.tab && sender.tab.windowId) {
            chrome.windows.get(sender.tab.windowId, (win) => {
                if (!chrome.runtime.lastError && win) {
                    // Only update if the saved state is different from current
                    const needsUpdate = 
                        (state.width && state.width !== win.width) ||
                        (state.height && state.height !== win.height) ||
                        (state.left !== undefined && state.left !== win.left) ||
                        (state.top !== undefined && state.top !== win.top);
                    
                    if (needsUpdate) {
                        chrome.windows.update(sender.tab.windowId, {
                            width: state.width || win.width,
                            height: state.height || win.height,
                            left: state.left !== undefined ? state.left : win.left,
                            top: state.top !== undefined ? state.top : win.top
                        });
                        
                        // Update cache
                        windowStateCache = {
                            width: state.width || win.width,
                            height: state.height || win.height,
                            left: state.left !== undefined ? state.left : win.left,
                            top: state.top !== undefined ? state.top : win.top
                        };
                    }
                }
            });
        }
    }
});

chrome.action.onClicked.addListener(async (tab) => {
    // see if we already have a timertab open, and do nothing if we do
    if (windowIsOpen){
        // don't create a new window, but bring the existing window into focus
        if (popupWindowID > 0){
            chrome.windows.update(popupWindowID, { "focused": true });  
        }
    } else {
        // Load saved window state from cache (which will be updated when window loads)
        const windowState = await loadWindowState();
        
        // create the window with saved state (or defaults)
        chrome.windows.create({
            url: "index.html",
            type: "popup",
            width: windowState.width || 300,
            height: windowState.height || 100,
            left: windowState.left,
            top: windowState.top,
            focused: true
        }, (win) => {
            popupWindowID = win.id;
            // The window will send a message after it loads to restore its saved position
            // This handles the case where localStorage has a saved position
        });
    }
});

// Global listener for window bounds changes (only one listener needed)
chrome.windows.onBoundsChanged.addListener((changedWindowId) => {
    if (changedWindowId === popupWindowID && windowIsOpen) {
        debouncedSaveWindowState(changedWindowId);
    }
});

chrome.windows.onCreated.addListener((win) => {
    // set a flag so we know that we've created a new window and so we don't create a second one
    if (win.type === 'popup' && win.url && win.url.includes('index.html')) {
        windowIsOpen = true;
        popupWindowID = win.id;
    }
});

chrome.windows.onRemoved.addListener((windowId) => {
    // Clean up when window is removed
    // Note: State is already saved continuously via onBoundsChanged
    if (windowId === popupWindowID) {
        windowIsOpen = false;
        popupWindowID = null;
    }
});

