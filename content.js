var bubbleDOM = document.createElement('div');
document.body.style.position = 'relative'
document.body.appendChild(bubbleDOM);
bubbleDOM.style.visibility = 'hidden';
bubbleDOM.id = "selectBubble"
bubbleDOM.height = "200px";
bubbleDOM.style.top = '50%';
bubbleDOM.style.left = '46%';
bubbleDOM.style.position = 'fixed';
bubbleDOM.style.zIndex = '1000'
bubbleDOM.style.background = 'blue'
bubbleDOM.style.fontSize = '20pt'
bubbleDOM.style.color = 'white'
bubbleDOM.style.borderRadius = '3px'
// Move that bubble to the appropriate location.
function renderBubble() {
  bubbleDOM.style.visibility = 'visible';
  setTimeout(function() {
    console.log("waiting")
    bubbleDOM.style.visibility = 'hidden';
  }, 1500);
}

let isTabActive = true
window.onfocus = function () { 
  isTabActive = true; 
}; 

window.onblur = function () { 
  isTabActive = false; 
}; 

chrome.runtime.onMessage.addListener((request,sender,sendResponse) => {
  console.log("got chrome request" + JSON.stringify(request))
  //console.log("is hidden " + !document.hidden)
  if (isTabActive) {
    // do what you need
    if(request.change){
      window.scrollBy(0,request.change)
    }
    if(request.toggleGestures){
      if(request.toggleGestures == 'on'){
        bubbleDOM.innerHTML = "Gesture Detection On"
      }else{
        bubbleDOM.innerHTML = "Gesture Detection Off"      
      }
      renderBubble();
    }
    if(request.gesture == "back"){
      console.log("received back")
      console.log(bubbleDOM)
      //window.history.back()
    }else if(request.gesture == "forward"){
      console.log("received forward")
      //window.history.forward()
    }
  }

});


