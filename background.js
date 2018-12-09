chrome.storage.local.clear()
const vid = document.querySelector('#webcamVideo');

//posenet
var imageScaleFactor = 0.5;
var outputStride = 16;
var flipHorizontal = false;
let net = null 

//tracking
let topEyeY
let topEarY
let topEyeEarY
let topEyeDistance
let bottomEyeY
let meanCalibrationY
let calibrationEyeYRange
let restingHeadAngle
let calibrated = false
let referenceYRange
let referenceY
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
let lastFocusedTab = null
const refreshRate = 50
const buffer = .60

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
           topNoseY = vid.height - pose.keypoints[0].position.y
           topEyeY = vid.height - mean([pose.keypoints[1].position.y,pose.keypoints[2].position.y])
           topEyeNoseY = Math.abs(topNoseY- topEyeY)
           topEarY = vid.height - mean([pose.keypoints[3].position.y,pose.keypoints[4].position.y])
           topEyeXDistance = Math.abs(pose.keypoints[1].position.x - pose.keypoints[2].position.x)
           topEyeEarY = Math.abs(topEyeY - topEarY)
           topEyeDistance = calculateDistance(pose.keypoints[1].position,pose.keypoints[2].position)
           topEarY = vid.height - mean([pose.keypoints[3].position.y,pose.keypoints[4].position.y])
           headAngleEyes =  calculateLeftRightHeadAngle(pose.keypoints[1],pose.keypoints[2])
           headAngleEars =  calculateLeftRightHeadAngle(pose.keypoints[3],pose.keypoints[4])
           restingHeadAngle = mean([headAngleEyes, headAngleEars])
       })
    }

    if(request.calibrateBottom){

      net.estimateSinglePose(vid,imageScaleFactor, flipHorizontal, outputStride).then(pose=>{
           bottomEyeY = mean([pose.keypoints[1].position.y,pose.keypoints[2].position.y])
           calibrationEyeYRange = Math.abs(topEyeY - bottomEyeY)*buffer
           meanCalibrationY = mean([bottomEyeY, topEyeY])
           referenceY = meanCalibrationY
           referenceYRange = calibrationEyeYRange
           calibrated = true
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

function calculateLeftRightHeadAngle(leftKeypoint, rightKeyPoint){
  const leftY = leftKeypoint.position.y
  const rightY = rightKeyPoint.position.y
  const leftX = leftKeypoint.position.x
  const rightX = rightKeyPoint.position.x
  const diffX = rightX - leftX
  const diffY = rightY - leftY
  const headAngle = Math.atan(diffY/diffX) * 180/Math.PI 

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
      handLiftTimeout = false;
    }, 2000);
  }
}

function calculateDistance(position1, position2){
  const dxSquared = Math.pow(position1.x - position2.x,2)
  const dySquared = Math.pow(position1.y - position2.y,2)
  return Math.pow(dxSquared + dySquared, .5)
}

function checkMotion(curEyeDistance,curEyeNoseY, headAngle){

  console.log("checking motion " ,curEyeDistance, curEyeNoseY, headAngle)
  let gestures = []
  if(
    Math.abs(curEyeDistance - topEyeDistance) > topEyeDistance * .15  && 
    Math.abs(curEyeNoseY - topEyeNoseY) > topEyeNoseY * .15
  ){
    console.log("walked")
    gestures.push("walked")
  }

  if(
    Math.abs(curEyeNoseY - topEyeNoseY) > topEyeNoseY * .10
  ){
    console.log("tilted up down")
    gestures.push("tiltedUpDown")
  }
  /*if(curEyeDistance < topEyeDistance && curEyeNoseY < topEyeNoseY){
    console.log("walked back")
  }*/

  return gestures
}
function calculateCenterOfMass(pose){
  xCOM = (pose.keypoints[0].position.x + 
         pose.keypoints[1].position.x +
         pose.keypoints[2].position.x +
         pose.keypoints[3].position.x +
         pose.keypoints[4].position.x)/5
  yCom = (pose.keypoints[0].position.y + 
         pose.keypoints[1].position.y +
         pose.keypoints[2].position.y +
         pose.keypoints[3].position.y +
         pose.keypoints[4].position.y)/5
  console.log(yCom)
}
async function loop() {
  
  if(net && calibrated){

     net.estimateSinglePose(vid,imageScaleFactor, flipHorizontal, outputStride).then(pose=>{
      //console.log(vid.height, vid.innerHeight,vid.clientHeight)
      
      const curEyeY = vid.height - (pose.keypoints[1].position.y +  pose.keypoints[2].position.y)/2
      const curEarY = vid.height - (pose.keypoints[3].position.y +  pose.keypoints[4].position.y)/2
      const curEyeEarY = Math.abs(curEarY - curEyeY)
      const curNoseY = vid.height - pose.keypoints[0].position.y
      const curEyeNoseY = Math.abs(curEyeY - curNoseY)
      const curShoulderY = vid.height - (pose.keypoints[5].position.y +  pose.keypoints[6].position.y)/2
      const curEyeDistance = calculateDistance(pose.keypoints[1].position, pose.keypoints[2].position) 
      const curEarDistance = calculateDistance(pose.keypoints[3].position, pose.keypoints[4 ].position) 
      const curHeadAngleEyes =  calculateLeftRightHeadAngle(pose.keypoints[1],pose.keypoints[2])
      const curHeadAngleEars =  calculateLeftRightHeadAngle(pose.keypoints[3],pose.keypoints[4])
      const headAngle = mean([curHeadAngleEyes, curHeadAngleEars])

      if(
        Math.abs(curEyeDistance- topEyeDistance)/topEyeDistance < .3 &&
        pose.keypoints[1].score > scoreThreshold &&
        pose.keypoints[2].score > scoreThreshold && 
        gesturesOn 
      ){
        

        if(!timeoutId && headAngle - restingHeadAngle < -1*tiltAngle ){
          gesturesOn = !gesturesOn
          timeoutId = true;
          console.log("back", pose.keypoints[9].position.y, pose.keypoints[1].score )
          setTimeout(function() {
            timeoutId = null;
            chrome.tabs.query({"currentWindow": true,"active":true}, function(tabs) {
              //chrome.tabs.sendMessage(tabs[0].id, {gesture : "back"});
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
              //chrome.tabs.sendMessage(tabs[0].id, {gesture : "forward"});
            });
            headGesture = true
            gesturesOn = !gesturesOn
            timeoutId = null;
          }, 1000);
          
        }
      }

      checkHandLift(pose, pose.keypoints[0].position.y, curEyeY, [pose.keypoints[3].position.x, pose.keypoints[4].position.x])

      if(
          Math.max(pose.keypoints[1].score,pose.keypoints[2].score) > scoreThreshold &&
          Math.max(pose.keypoints[3].score,pose.keypoints[4].score) > earScoreThreshold &&
          pose.keypoints[0].score > noseScoreThreshold
        ){
        
        const diff = curEyeY - referenceY
        if(
          Math.abs(diff) < Math.max(6*referenceYRange, 16) && 
          (diff > referenceYRange/2 || diff <  -1*referenceYRange/2) && 
          gesturesOn
        ){
          chrome.tabs.query({"lastFocusedWindow": true,"active":true}, function(tabs) {
            if(tabs.length > 0){
              chrome.tabs.sendMessage(tabs[0].id, {change : -1*Math.sign(diff)*Math.pow(Math.abs(diff) - referenceYRange/2, 2)/3 });
            }  
          });
        }          
      }
          
    });
    ++numLoops
  }
  setTimeout(loop, refreshRate);
}

