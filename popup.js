
console.log("starting popup")
let numSpace = 0
let calibrating = false
function setupCam() {
  navigator.mediaDevices.getUserMedia({
    video: true
  }).then(mediaStream => {
    document.querySelector('#webcamVideo').srcObject = mediaStream;
  }).catch((error) => {
    console.warn(error);
  });
}
function getSecondDiff(t1,t2){
  var dif = t1.getTime() - t2.getTime();
  var Seconds_from_T1_to_T2 = dif / 1000;
  return Math.abs(Seconds_from_T1_to_T2);
}
function spacePressed(){
  console.log("space pressed ", numSpace)
  if(numSpace == 1 && calibrating){
    document.getElementById('calibrate-text').innerHTML = "look at the bottom of this tab's window and press space"
    chrome.runtime.sendMessage({calibrateTop: true});
    console.log(document.getElementById('calibrate-text').innerHTML)
  }
  if(numSpace == 2  && calibrating){
    chrome.runtime.sendMessage({calibrateBottom: true});
    numSpace = 0
    calibrating = false
    document.getElementById('calibrate-text').innerHTML = "recalibrate if necessary"
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
function calibrateClicked(){
  calibrating = true
  document.getElementById('calibrate-text').innerHTML = "look the top of this tab's window and press space"

  console.log("calibrating")//port.postMessage("calibrate-top");
  let startTime = new Date()
  let curTime = new Date()
  let numloops = 0
  let numSeconds = 0
  
}
setupCam();


document.getElementById('calibrate').onclick = calibrateClicked;
