chrome.storage.local.clear()
chrome.tabs.onActivated.addListener(function(activeInfo) {
  chrome.storage.local.get([activeInfo['windowId'] + "-" + activeInfo['tabId']], items => {
    if(!items[activeInfo['windowId'] + "-" + activeInfo['tabId']]){
      chrome.tabs.reload()
      chrome.storage.local.set({ [activeInfo['windowId'] + "-" + activeInfo['tabId']]: true });
    }
    
  })
});
    
chrome.storage.onChanged.addListener((changes, namespace) => {
  if ('camAccess' in changes) {
    console.log('cam access granted');
    setupCam();
  }
});

// If cam acecss has already been granted to this extension, setup webcam.
chrome.storage.local.get('camAccess', items => {
  if (!!items['camAccess']) {
    console.log('cam access already exists');
    setupCam();
  }
});

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

chrome.runtime.onMessage.addListener((request) => {
    if(request.calibrateTop){
      net.estimateSinglePose(vid,imageScaleFactor, flipHorizontal, outputStride).then(pose=>{
           topEyeY = mean([pose.keypoints[1].position.y,pose.keypoints[2].position.y])
            middleEyeDistance = Math.abs(pose.keypoints[1].position.x - pose.keypoints[2].position.x)
           headAngleEyes =  calculateHeadAngle(pose.keypoints[1],pose.keypoints[2])
           headAngleEars =  calculateHeadAngle(pose.keypoints[3],pose.keypoints[4])
           restingHeadAngle = mean([headAngleEyes, headAngleEars])
            console.log("resting head angle" , restingHeadAngle)

       })
    }

    if(request.calibrateBottom){
      net.estimateSinglePose(vid,imageScaleFactor, flipHorizontal, outputStride).then(pose=>{
           bottomEyeY = mean([pose.keypoints[1].position.y,pose.keypoints[2].position.y])
           console.log("calibration heights", topEyeY, bottomEyeY)
           middleY = mean([topEyeY, bottomEyeY])
           eyeYRange = Math.abs(topEyeY - bottomEyeY)
       })
    }
})
setupCam();
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
    chrome.storage.local.set({ 'modelLoaded': true });
  });
  setTimeout(loop, 50);
}

function calculateHeadAngle(leftKeypoint, rightKeyPoint){
  const leftEyeY = leftKeypoint.position.y
  const rightEyeY = rightKeyPoint.position.y
  const leftEyeX = leftKeypoint.position.x
  const rightEyeX = rightKeyPoint.position.x
  const curEyeY = (leftKeypoint.position.y +  rightKeyPoint.position.y)/2
  const diffEyeX = rightEyeX - leftEyeX
  const diffEyeY = rightEyeY - leftEyeY
  const headAngle = Math.atan(diffEyeY/diffEyeX) * 180/Math.PI 

  return headAngle
}
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
function checkHandLift(pose,noseHeight, eyeHeight, earsX){

  const leftHand = pose.keypoints[9]
  const rightHand = pose.keypoints[10]
  console.log(leftHand.score, rightHand.score)
  if(
    Math.max(leftHand.score, rightHand.score) > wristScoreThreshold &&
    Math.max(leftHand.position.y,rightHand.position.y) < noseHeight + noseHeight*.35 &&
    Math.max(leftHand.position.y,rightHand.position.y) > eyeHeight &&
    (
    Math.max(leftHand.position.x,rightHand.position.x) > Math.max(earsX[0],earsX[1]) + Math.abs(earsX[0]-earsX[1]) * .50  ||
    Math.min(leftHand.position.x,rightHand.position.x) < Math.min(earsX[0],earsX[1]) - Math.abs(earsX[0]-earsX[1]) * .50 
    ) &&
    !handLiftTimeout
  ){
    gesturesOn = !gesturesOn
    handLiftTimeout = true;
    console.log("Turn gestures on ", 'on' ? gesturesOn : 'off')
    chrome.tabs.query({"currentWindow": true,"active":true}, function(tabs) {
      if(tabs.length > 0){
        chrome.tabs.sendMessage(tabs[0].id, {toggleGestures : gesturesOn ? 'on' : 'off'});
      }
    });
    setTimeout(function() {
      console.log("can lift again")
      handLiftTimeout = false;
    }, 2000);
  }
}

function calculateDistance(position1, position2){
  const dxSquared = Math.pow(position1.x - position2.x,2)
  const dySquared = Math.pow(position1.y - position2.y,2)
  return Math.pow(dxSquared + dySquared, .5)
}
const vid = document.querySelector('#webcamVideo');

//posenet
var imageScaleFactor = 0.5;
var outputStride = 16;
var flipHorizontal = false;
let net = null 

//tracking
let topEyeY
let bottomEyeY
let eyeYRange 
let restingHeadAngle

//triggers
var tiltAngle = 16
var scoreThreshold = .93
var earScoreThreshold = .45
const noseScoreThreshold = .95
const wristScoreThreshold = .4

let numLoops = 0
var timeoutId = false
let handLiftTimeout = false
const handLiftThreshold = 120
let gesturesOn = true
let middleEyeDistance
let lastFocusedTab = null
const refreshRate = 80

async function loop() {
  
  if(net && bottomEyeY){

     net.estimateSinglePose(vid,imageScaleFactor, flipHorizontal, outputStride).then(pose=>{
      
      const curEyeDistance = calculateDistance(pose.keypoints[1].position, pose.keypoints[2].position) 
      if(
        Math.abs(curEyeDistance- middleEyeDistance)/middleEyeDistance < .3 &&
        pose.keypoints[1].score > scoreThreshold &&
        pose.keypoints[2].score > scoreThreshold && 
        gesturesOn 
      ){
        curHeadAngleEyes =  calculateHeadAngle(pose.keypoints[1],pose.keypoints[2])
        curHeadAngleEars =  calculateHeadAngle(pose.keypoints[3],pose.keypoints[4])
        const headAngle = mean([curHeadAngleEyes, curHeadAngleEars])
        //console.log("angles " ,headAngle, restingHeadAngle, headAngle- restingHeadAngle)

        if(!timeoutId && headAngle - restingHeadAngle < -1*tiltAngle ){
          gesturesOn = !gesturesOn
          timeoutId = true;
          console.log("back", pose.keypoints[9].position.y, pose.keypoints[1].score )
          setTimeout(function() {
            timeoutId = null;
            chrome.tabs.query({"currentWindow": true,"active":true}, function(tabs) {
              chrome.tabs.sendMessage(tabs[0].id, {gesture : "back"});
            });
            gesturesOn = !gesturesOn
          }, 1000);
        }
        if(!timeoutId && headAngle - restingHeadAngle > tiltAngle){
          gesturesOn = !gesturesOn
          timeoutId = true;
          console.log("forward",pose.keypoints[9].position.y, pose.keypoints[1].score )
          setTimeout(function() {
            chrome.tabs.query({"currentWindow": true,"active":true}, function(tabs) {
              chrome.tabs.sendMessage(tabs[0].id, {gesture : "forward"});
            });
            headGesture = true
            gesturesOn = !gesturesOn
            timeoutId = null;
          }, 1000);
          
        }
      }
      const curEyeY = (pose.keypoints[1].position.y +  pose.keypoints[2].position.y)/2
      checkHandLift(pose, pose.keypoints[0].position.y, curEyeY, [pose.keypoints[3].position.x, pose.keypoints[4].position.x])
      if(
          Math.max(pose.keypoints[1].score,pose.keypoints[2].score) > scoreThreshold &&
          Math.max(pose.keypoints[3].score,pose.keypoints[4].score) > earScoreThreshold &&
          pose.keypoints[0].score > noseScoreThreshold
        ){
        const meanCalibrationY = mean([bottomEyeY, topEyeY])
        const diff = curEyeY- meanCalibrationY
        
        if(
          Math.abs(diff) < Math.max(5.3*eyeYRange, 16) && 
          (diff > eyeYRange/2 || diff <  -1*.8*eyeYRange/2) && 
          gesturesOn
        ){
          chrome.tabs.query({"lastFocusedWindow": true,"active":true}, function(tabs) {
            if(tabs.length > 0){
              chrome.tabs.sendMessage(tabs[0].id, {change : Math.sign(diff)*Math.pow(Math.abs(diff) - Math.abs(topEyeY- meanCalibrationY), 2)/3 });
            }  
          });
        }          
      }
          
    });
    ++numLoops
  }
  setTimeout(loop, refreshRate);
}

