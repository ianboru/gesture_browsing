
console.log("starting popup")
let numSpace = 0
let calibrating = false
let modelLoaded = false
chrome.storage.local.get('modelLoaded', function(result){
  if(result.modelLoaded){
    console.log("model from storage")
    document.getElementById('calibrate').innerHTML = "Calibrate"
  }
});
chrome.storage.onChanged.addListener((changes, namespace) => {
  console.log("loaded changes",changes)
  if ('modelLoaded' in changes) {
    console.log("popup notice load")
    document.getElementById('calibrate').innerHTML = "Calibrate"
  }
});
chrome.storage.local.get('calibrated', function(result){
  console.log("calibrationg store ", JSON.stringify(result))
  if(result.calibrated){
    console.log("already calibrated")
    setCalibratedState()
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

function setCalibratedState(){
  document.getElementById('calibrate').hidden = false
  document.getElementById('calibrate').innerHTML = "Re-calibrate"
  document.getElementById('calibrate-text').innerHTML = "Calibration complete</br></br>Re-calibrate if you dramatically change window size, screen angle or your position"
  document.getElementById('examples').hidden = false
  document.getElementById('gestures').hidden = false
  document.getElementById('calibrate-middle').hidden = true 
  document.getElementById('calibrate-top').hidden = true 
  document.getElementById('calibrate-bottom').hidden = true 
  document.getElementById('webcamVideo').hidden = true

}
function calibrateClicked(){
  calibrating = true
  document.getElementById('webcamVideo').hidden = true
  document.getElementById('calibrate-text').innerHTML = "look at the MIDDLE of the BROWSER</br></br>press SPACE"
  document.getElementById('calibrate').hidden = true
  document.getElementById('calibrate-middle').hidden = false 
  document.getElementById('calibrate-top').hidden = true 
  document.getElementById('calibrate-bottom').hidden = true 
  document.getElementById('examples').hidden = true 
  document.getElementById('gestures').hidden = true


  console.log("calibrating")
}
function spacePressed(){
  console.log("space pressed ", numSpace)
  if(numSpace == 1 && calibrating){
    document.getElementById('calibrate-text').innerHTML = "Tilt your head to look at the TOP of the BROWSER</br></br>press SPACE"
    console.log(document.getElementById('calibrate-text').innerHTML)
    document.getElementById('calibrate-middle').hidden = true 
    document.getElementById('calibrate-top').hidden = false 
    document.getElementById('calibrate-bottom').hidden = true 
    chrome.runtime.sendMessage({calibrateMiddle: true});
  }
  if(numSpace == 2  && calibrating){
    chrome.runtime.sendMessage({calibrateTop: true});
    document.getElementById('calibrate-text').innerHTML = "Tilt your head to look at the BOTTOM of the BROWSER</br></br>press SPACE"
    document.getElementById('calibrate-middle').hidden = true 
    document.getElementById('calibrate-top').hidden = true 
    document.getElementById('calibrate-bottom').hidden = false 
  }
  if(numSpace == 3  && calibrating){
    chrome.runtime.sendMessage({calibrateBottom: true});
    numSpace = 0
    calibrating = false
    setCalibratedState()

    chrome.storage.local.set({ 'calibrated': true });
  }
}
document.body.onkeyup = function(e){
  console.log(e)
    if(e.keyCode == 32){
      e.preventDefault()
      ++numSpace
      spacePressed()
    }
}
setupCam();
document.getElementById('calibrate').onclick = calibrateClicked;