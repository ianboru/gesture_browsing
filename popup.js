
console.log("starting popup")
let numSpace = 0
let calibrating = false
let modelLoaded = false
chrome.storage.local.get('modelLoaded', function(result){
  if(result){
    console.log("model from storage")
    document.getElementById('calibrate').hidden = false
    //document.getElementById('calibrate-text').innerHTML = ""
  }
});
chrome.storage.onChanged.addListener((changes, namespace) => {
  if ('modelLoaded' in changes) {
    console.log("popup notice load")
    document.getElementById('calibrate').hidden = false
    document.getElementById('calibrate-text').innerHTML = ""
  }
});
function setupCam() {
  navigator.mediaDevices.getUserMedia({
    video: true
  }).then(mediaStream => {
    document.querySelector('#webcamVideo').srcObject = mediaStream;
  }).catch((error) => {
    console.warn(error);
  });
}
function spacePressed(){
  console.log("space pressed ", numSpace)
  if(numSpace == 1 && calibrating){
    document.getElementById('calibrate-text').innerHTML = "look at top of browser window press SPACE"
    console.log(document.getElementById('calibrate-text').innerHTML)
    chrome.runtime.sendMessage({calibrateMiddle: true});
  }
  if(numSpace == 2  && calibrating){
    chrome.runtime.sendMessage({calibrateTop: true});
    document.getElementById('calibrate-text').innerHTML = "look at bottom of browser window press SPACE"
  }
  if(numSpace == 3  && calibrating){
    chrome.runtime.sendMessage({calibrateBottom: true});
    numSpace = 0
    calibrating = false
    document.getElementById('calibrate').hidden = false
    document.getElementById('calibrate-text').innerHTML = ""
    window.close()
  }
  setTimeout(function() {
    console.log("can lift again")
    leftWristTimeout = null;
  }, 2000);
}
document.body.onkeyup = function(e){
  console.log(e)
    if(e.keyCode == 32){
      e.preventDefault()
      ++numSpace
      spacePressed()
    }
}
function calibrateClicked(){
  calibrating = true
  document.getElementById('calibrate-text').innerHTML = "look the middle of browser window and press SPACE"
  document.getElementById('calibrate').hidden = true
  console.log("calibrating")
}
setupCam();


document.getElementById('calibrate').onclick = calibrateClicked;
