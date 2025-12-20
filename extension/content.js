chrome.runtime.onMessage.addListener((msg) => {
    console.log('message received...evaluating...', msg.changeInfo)
    if (msg.cmd == 'eval_page'){
        // start monitoring for page DOM changes
    }
});