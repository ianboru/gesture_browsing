
console.log("starting popup")
/*chrome.runtime.sendMessage({checkWindowSize: true}, function (response) {
    console.log(response);
    //document.body.height = response.data

})*/
chrome.runtime.sendMessage({
    data: "Hello popup, how are you"
}, function (response) {
    console.dir(response);
});
 chrome.runtime.onMessage.addListener((request) => {
  console.log("request" , request)
    if(request.newWindowSize){
      console.log("setting window")
    }
})
     

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
function calibrateClicked(){
  var port = chrome.extension.connect({
        name: "calibrate"
   });
  console.log("calibrating")
  //port.postMessage("calibrate-top");
  //document.getElementById('calibrate-text').innerHTML = "look to top of window for 3 seconds"
  let startTime = new Date()
  let curTime = new Date()
  let numloops = 0
  let numSeconds = 0
  port.postMessage("calibrate");
  chrome.runtime.sendMessage({calibrate: true});
  /*while(getSecondDiff(startTime,curTime) < 3 || numloops < 1500){
    console.log(getSecondDiff(startTime,curTime), getSecondDiff(startTime,curTime)%1, numSeconds )
    let curSecDiff = getSecondDiff(startTime,curTime)
    if(
      curSecDiff%1 < .05 && 
      curSecDiff > numSeconds && 
      curSecDiff > 0
    ){
      console.log("GOT ONE " , curSecDiff)
      document.getElementById('calibrate-text').innerHTML = 3-numSeconds
      ++numSeconds
    }
    curTime = new Date()
    ++numloops
  }
  port.postMessage("calibrate-bottom");
  document.getElementById('calibrate-text').innerHTML = "look to bottom of window for 3 seconds"
  while(getSecondDiff(startTime,curTime) < 3 || numloops < 1500){
    console.log(curSecDiff, curSecDiff%1, numSeconds)
    let curSecDiff = getSecondDiff(startTime,curTime)
    if(
      curSecDiff%1 < .05 && 
      curSecDiff > numSeconds && 
      curSecDiff > 0
    ){
      document.getElementById('calibrate-text').innerHTML = 3-numSeconds
      console.log("GOT ONE " , curSecDiff)
      ++numSeconds
    }
    curTime = new Date()
    ++numloops
  }
  document.getElementById('calibrate-text').innerHTML = "calibration done"
  port.postMessage("calibrate-done");*/
}
setupCam();


document.getElementById('calibrate').onclick = calibrateClicked;
