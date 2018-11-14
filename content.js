let isTabActive = true
window.onfocus = function () { 
  isTabActive = true; 
}; 

window.onblur = function () { 
  isTabActive = false; 
}; 

chrome.runtime.onMessage.addListener((request,sender,sendResponse) => {

  //console.log("is hidden " + !document.hidden)
  if (isTabActive) {
    // do what you need
    if(request.change){
      window.scrollBy(0,request.change)
    }
    if(request.gesture == "back"){
      console.log("received back")
      window.history.back()
    }else if(request.gesture == "forward"){
      console.log("received forward")
      window.history.forward()
    }
  }

});


