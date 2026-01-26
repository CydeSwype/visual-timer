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

// Helper function to find existing timer windows
async function findExistingTimerWindow() {
    return new Promise((resolve) => {
        // First check our tracked window ID directly (fastest path)
        if (popupWindowID) {
            chrome.windows.get(popupWindowID, (win) => {
                if (!chrome.runtime.lastError && win) {
                    // Verify it still has our timer page
                    chrome.tabs.query({ windowId: win.id }, (tabs) => {
                        for (const tab of tabs) {
                            if (tab.url && (tab.url.includes('index.html') || tab.url.endsWith('/index.html'))) {
                                resolve(win);
                                return;
                            }
                        }
                        // Tracked window exists but doesn't have our page, search all
                        searchAllWindows(resolve);
                    });
                    return;
                }
                // Tracked window doesn't exist, search all windows
                searchAllWindows(resolve);
            });
        } else {
            searchAllWindows(resolve);
        }
    });
}

function searchAllWindows(resolve) {
    chrome.windows.getAll({}, (windows) => {
        const popupWindows = windows.filter(w => w.type === 'popup');
        
        if (popupWindows.length === 0) {
            resolve(null);
            return;
        }
        
        // Check each popup window for our timer page
        let checked = 0;
        let foundWindow = null;
        
        for (const win of popupWindows) {
            chrome.tabs.query({ windowId: win.id }, (tabs) => {
                checked++;
                for (const tab of tabs) {
                    if (tab.url && (tab.url.includes('index.html') || tab.url.endsWith('/index.html'))) {
                        foundWindow = win;
                    }
                }
                // Resolve after checking all popup windows
                if (checked === popupWindows.length) {
                    resolve(foundWindow);
                }
            });
        }
    });
}

// Get setting for resurface behavior (default: true)
async function getResurfaceSetting() {
    return new Promise((resolve) => {
        chrome.storage.local.get(['resurfaceExistingWindow'], (result) => {
            // Default to true if not set
            resolve(result.resurfaceExistingWindow !== false);
        });
    });
}

chrome.action.onClicked.addListener(async (tab) => {
    const resurfaceExisting = await getResurfaceSetting();
    
    if (resurfaceExisting) {
        // Try to find existing timer window
        const existingWindow = await findExistingTimerWindow();
        
        if (existingWindow) {
            // Update our tracking if needed
            if (popupWindowID !== existingWindow.id) {
                popupWindowID = existingWindow.id;
                windowIsOpen = true;
            }
            
            // Resurface existing window
            chrome.windows.update(existingWindow.id, { focused: true });
            // Also bring any tabs in that window to front
            chrome.tabs.query({ windowId: existingWindow.id }, (tabs) => {
                if (tabs.length > 0) {
                    chrome.tabs.update(tabs[0].id, { active: true });
                }
            });
            return;
        }
    }
    
    // No existing window found (or resurface is disabled) - create new window
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

