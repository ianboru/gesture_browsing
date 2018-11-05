// Do first-time setup to gain access to webcam, if necessary.
chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason.search(/install/g) === -1) {
    return;
  }
  chrome.tabs.create({
    url: chrome.extension.getURL('welcome.html'),
    active: true
  });
});

var imageScaleFactor = 0.5;
var outputStride = 16;
var flipHorizontal = false;
let topEyeY
let bottomEyeY
let eyeYRange 
chrome.runtime.onMessage.addListener((request) => {
    if(request.calibrateTop){
      net.estimateSinglePose(vid,imageScaleFactor, flipHorizontal, outputStride).then(pose=>{
           topEyeY = mean([pose.keypoints[1].position.y,pose.keypoints[2].position.y])
       })
    }
    if(request.calibrateBottom){
      net.estimateSinglePose(vid,imageScaleFactor, flipHorizontal, outputStride).then(pose=>{
           bottomEyeY = mean([pose.keypoints[1].position.y,pose.keypoints[2].position.y])
           console.log("eye y", topEyeY, bottomEyeY)
           defaultY = mean([topEyeY, bottomEyeY])// - .1 * eyeYRange
           eyeYRange = Math.abs(topEyeY - bottomEyeY)
       })
    }
})
const vid = document.querySelector('#webcamVideo');
let net = null 
// Setup webcam, initialize the KNN classifier model and start the work loop.
async function setupCam() {
  navigator.mediaDevices.getUserMedia({
    video: true
  }).then(mediaStream => {
    vid.srcObject = mediaStream;
  }).catch((error) => {
    console.warn(error);
  });
  posenet.load().then((data)=>{
    console.log("loaded")
    net = data
  });
  setTimeout(loop, 50);
}

// If cam acecss has already been granted to this extension, setup webcam.
chrome.storage.local.get('camAccess', items => {
  if (!!items['camAccess']) {
    console.log('cam access already exists');
    setupCam();
  }
});

var imageScaleFactor = 0.5;
var outputStride = 16;
var flipHorizontal = true;
let defaultY = null
let calibrationStatus = null
let bottomCalibrationEyeY = []
let topCalibrationEyeY = []
let meanTopEyeY = null
let meanBottomEyeY = null

// If cam acecss gets granted to this extension, setup webcam.
chrome.storage.onChanged.addListener((changes, namespace) => {
  if ('camAccess' in changes) {
    console.log('cam access granted');
    setupCam();
  }
});

var lastEyeY = null
let lastSigDiff = 0
let numLoops = 0
let leftEyeXHistory = []
let leftEyeYHistory = []
let rightEyeXHistory = []
let rightEyeYHistory = []
let leftEyeVXHistory = []
let leftEyeVYHistory = []
let rightEyeVXHistory = []
let rightEyeVYHistory = []
const windowSize = 20
function mean(array){
  let total = 0 
  array.forEach((element,index)=>{
      total = total + element
  })
  return total/array.length
}
function calculatDiff(array,offset){
  return array[array.length-1] - array[array.length + offset-1]
}
var timeoutId = 0 
async function loop() {
  
  if(net && defaultY){
    let headGesture = false

     net.estimateSinglePose(vid,imageScaleFactor, flipHorizontal, outputStride).then(pose=>{
        if(pose.keypoints[1].score > .6){
          const leftEyeY = pose.keypoints[1].position.y
          const rightEyeY = pose.keypoints[2].position.y
          const leftEyeX = pose.keypoints[1].position.x
          const rightEyeX = pose.keypoints[2].position.x
          const curEyeY = (pose.keypoints[1].position.y +  pose.keypoints[2].position.y)/2
          const diffEyeX = rightEyeX - leftEyeX
          const diffEyeY = rightEyeY - leftEyeY
          const headAngle = Math.atan(diffEyeY/diffEyeX) * 180/Math.PI
          //console.log(headAngle)
          const diff = curEyeY-defaultY
          if(headAngle < -12){

            if (timeoutId) {
              clearTimeout(timeoutId);
            }
            timeoutId = setTimeout(function() {
              //console.log("tilted left")
              chrome.tabs.query({"active":true}, function(tabs) {
                chrome.tabs.sendMessage(tabs[0].id, {gesture : "back"});
              });
              timeoutId = 0;
            }, 500);
            
          }
          if(headAngle > 12){
            if (timeoutId) {
              clearTimeout(timeoutId);
            }
            timeoutId = setTimeout(function() {
              //console.log("tilted right", window.innerHeight)
              chrome.tabs.query({"active":true}, function(tabs) {
                chrome.tabs.sendMessage(tabs[0].id, {gesture : "forward"});
              });
              timeoutId = 0;
            }, 500);
          }

          if(diff > .3*eyeYRange || diff < -.25*eyeYRange  && !headGesture){
            chrome.tabs.query({"active":true}, function(tabs) {
              chrome.tabs.sendMessage(tabs[0].id, {change : Math.sign(diff)*Math.pow(Math.abs(diff), 3/2) });
            });
          }          
        }
        
     });
    ++numLoops
  }
  setTimeout(loop, 25);
}

