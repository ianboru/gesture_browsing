
window.onfocus = function () { 
  isTabActive = true; 
}; 

window.onblur = function () { 
  isTabActive = false; 
}; 
chrome.runtime.onMessage.addListener(function (message, sender, sendResponse) {
  console.log("content checked")
    sendResponse({
        data: "I am fine, thank you. How is life in the background?"
    }); 
});
var timeoutId = 0;
 chrome.runtime.sendMessage({
                    data: "Hello popup, how are you"
                }, function (response) {
                    console.dir(response);
                });
/*window.addEventListener('resize', function() {
  if (timeoutId) {
    clearTimeout(timeoutId);
  }
  timeoutId = setTimeout(function() {
    console.log("resized", window.innerHeight)
    chrome.runtime.sendMessage({newWindowSize: window.innerHeight });
    timeoutId = 0;
  }, 100);
}, false);*/
chrome.runtime.onMessage.addListener((request,sender,sendResponse) => {
  // If turning scrolling off, clear the timeout and remove any scrolling
  // indicators.
  //console.log("is hidden " + !document.hidden)
  //if (isTabActive) {
    // do what you need
    if(request.change){
      window.scrollBy(0,request.change)
    }
    if(request.gesture == "ASDF"){
      if(request.gesture == "back"){
        console.log("received back")
        window.history.back()
      }else if(request.gesture == "forward"){
        console.log("received forward")
        window.history.forward()
      }
    }
    if(request.checkWindowSize){
      console.log("checking window size")
      //chrome.runtime.sendMessage({newWindowSize: window.innerHeight});

      sendResponse({
        data: window.innerHeight
      }); 
    }
    
});


