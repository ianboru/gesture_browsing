
console.log("starting popup")
const video = document.getElementById('webcamVideo');
let numSpace = 0
let calibrating = false
let modelLoaded = false
//posenet
var imageScaleFactor = 0.5;
var outputStride = 16;
var flipHorizontal = true;
let net = null 
const c1 = document.getElementById('c1');
const boxSize = 10
let streaming = false
let buffer 
let range 
let videoWidth 
let videoHeight
let topY
let bottom 
function computeFrame(positions){
  let ctx1 = c1.getContext('2d');
  //ctx1.clearRect(0, 0, videoWidth, videoHeight)
  ctx1.drawImage(video, 0, 0, 640, 480);
  ctx1.strokeStyle="#FF0000";
  console.log(positions)
  ctx1.strokeRect(positions[0].x - boxSize/2 , positions[0].y - boxSize/2 , boxSize, boxSize);
  ctx1.strokeRect(positions[1].x - boxSize/2 , positions[1].y - boxSize/2 , boxSize, boxSize);
  ctx1.fillRect(0,  topY-16, 640, 10);

}

chrome.runtime.onMessage.addListener((request,sender,sendResponse) => {

})
chrome.storage.local.get('modelLoaded', function(result){
  if(result.modelLoaded){
    console.log("model from storage")
    modelLoaded = true
    document.getElementById('calibrate').disabled = false

    document.getElementById('calibrate').innerHTML = "Calibrate"
  }
});
chrome.storage.onChanged.addListener((changes, namespace) => {
  console.log("changes ", changes)
  console.log("loaded changes",changes)
  if ('modelLoaded' in changes) {
    console.log("popup notice load")
    document.getElementById('calibrate').innerHTML = "Calibrate"
    document.getElementById('calibrate').disabled = false

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
  let that = this
  if (streaming) return;
  navigator.mediaDevices.getUserMedia({video: true, audio: false})
    .then(function(s) {
      stream = s
      video.srcObject = s;
      video.play();
      console.log("stream set ")
    })
  .catch(function(err) {
    console.log("An error occured! " + err);
  });

  video.addEventListener("canplay", function(ev){
    if (!streaming) {
      streaming = true
      console.log("all set")
      videoHeight = video.videoHeight
      videoWidth = video.videoWidth
    }
  }, false);
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
  //document.getElementById('webcamVideo').hidden = true

}
function calibrateClicked(){

  calibrating = true
  document.getElementById('calibrate-text').innerHTML = "look at the MIDDLE of the BROWSER</br></br>press SPACE"
  document.getElementById('calibrate').hidden = true
  document.getElementById('calibrate-middle').hidden = false 
  document.getElementById('calibrate-top').hidden = true 
  document.getElementById('calibrate-bottom').hidden = true 
  document.getElementById('examples').hidden = true 
  document.getElementById('gestures').hidden = true
  //document.getElementById('webcamVideo').hidden = true


  console.log("calibrating")
}
function spacePressed(){
  console.log("space pressed ", numSpace)
  if(numSpace == 1 && calibrating){
    document.getElementById('calibrate-text').innerHTML = "Tilt your head to the TOP of where you would read comfortably</br></br>press SPACE"
    console.log(document.getElementById('calibrate-text').innerHTML)
    document.getElementById('calibrate-middle').hidden = true 
    document.getElementById('calibrate-top').hidden = false 
    document.getElementById('calibrate-bottom').hidden = true 
    chrome.runtime.sendMessage({calibrateMiddle: true});
  }
  if(numSpace == 2  && calibrating){
    chrome.runtime.sendMessage({calibrateTop: true});
    document.getElementById('calibrate-text').innerHTML = "Tilt your head to the BOTTOM of where you would read comfortably</br></br>press SPACE"
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