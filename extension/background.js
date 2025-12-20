var popupWindowID;
var windowIsOpen = false;

chrome.runtime.onInstalled.addListener(() => {
    const foo = 1
});

chrome.action.onClicked.addListener((tab) => {
    // see if we already have a timertab open, and do nothing if we do
    if (windowIsOpen){
        // don't create a new window, but bring the existing window into focus
        if (popupWindowID > 0){
            chrome.windows.update(popupWindowID, { "focused": true });  
        }
    } else {
        // create the window
        chrome.windows.create({
            url: "index.html",
            type: "popup",
            width: 300,
            height: 100,
            left: 0,
            top: 0,
            focused: true,
            type: "popup" // or normal
        }, (win) => {
            // TODO: store the window ID so we can reference it later to bring it into focus - need to move this to localstorage for persistence
            popupWindowID = win.id
        });
    }
});

chrome.windows.onCreated.addListener(() => {
    // set a flag so we know that we've created a new window and so we don't create a second one
    windowIsOpen = true
})

chrome.windows.onRemoved.addListener(() => {
    // set a flag so we know that we've created a new window and so we don't create a second one
    windowIsOpen = false
})
