console.log("running content")
var bubbleDOM = document.createElement('div');
document.body.style.position = 'relative'
document.body.appendChild(bubbleDOM);
bubbleDOM.style.visibility = 'hidden';
bubbleDOM.id = "selectBubble"
bubbleDOM.height = "200px";
bubbleDOM.style.right = '10px';
bubbleDOM.style.top = '10px';
bubbleDOM.style.padding = '4px 8px';
bubbleDOM.style.fontFamily = '"Helvetica Neue", sans-serif;' 
bubbleDOM.style.position = 'fixed';
bubbleDOM.style.zIndex = '2147483647'
bubbleDOM.style.background = 'rgba(0, 0, 0, 0.9)'
bubbleDOM.style.background = '-moz-linear-gradient(top, rgba(30, 30, 30, 0.95), rgba(0, 0, 0, 0.9))'
bubbleDOM.style.background = '-webkit-gradient(linear, 0 0, 0 100%, from(rgba(30, 30, 30, 0.95)), to(rgba(0, 0, 0, 0.9)))'

bubbleDOM.style.fontSize = '20pt'
bubbleDOM.style.color = '#fff'
bubbleDOM.style.borderRadius = '5px'
  
  

  /*
   background: rgba(0, 0, 0, 0.9);
  background: -moz-linear-gradient(top, rgba(30, 30, 30, 0.95), rgba(0, 0, 0, 0.9));
  background: -webkit-gradient(linear, 0 0, 0 100%, from(rgba(30, 30, 30, 0.95)), to(rgba(0, 0, 0, 0.9)));
  border: 1px solid black;
  border-radius: 5px;
  -moz-border-radius: 5px;
  -webkit-border-radius: 5px;
  box-shadow: inset 0 0 1px #555, 0 0 5px #000;
  -moz-box-shadow: inset 0 1px 0 #555, 0 0 5px #000;
  -webkit-box-shadow: inset 0 1px 0 #555, 0 0 5px #000;
  color: #fff;
  font-family: "Helvetica Neue", sans-serif;  
  font-size: 14px;
  line-height: 1.286;  
  padding: 0;
  text-shadow: 0 -1px 0 #111;
  box-shadow: inset 0 0 1px #555, 0 0 2px #000;
  -moz-box-shadow: inset 0 1px 0 #555, 0 0 2px #000;
  -webkit-box-shadow: inset 0 1px 0 #555, 0 0 2px #000; 

  */
  
  
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


