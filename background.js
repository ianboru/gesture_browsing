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
const earScoreMin = .3
const noseScoreThreshold = .95
const wristScoreThreshold = .4

let numLoops = 0
var timeoutId = false
let handLiftTimeout = false
const handLiftThreshold = 120
let gesturesOn = true
let lastFocusedTab = null
const refreshRate = 75
const buffer = .8

let lastEyeY
let lastNoseY 
let lastEarY 
let diffEyeY 
let diffEarY 
let diffNoseY 
let stream
let streaming = false
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
  console.log("background request ", request)
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
         bottomEyeY = vid.height - mean([pose.keypoints[1].position.y,pose.keypoints[2].position.y])
         calibrationEyeYRange = Math.abs(topEyeY - bottomEyeY)*buffer
         meanCalibrationY = mean([bottomEyeY, topEyeY])
         referenceY = meanCalibrationY
         referenceYRange = calibrationEyeYRange
         calibrated = true
         console.log("calibrated Y, range",topEyeY, bottomEyeY, referenceY, referenceYRange)
         lastEyeY = null
         lastNoseY = null
         lastEarY = null
         diffEyeY = null
         diffEarY = null
         diffNoseY = null
       })
    }
    if(request.hasOwnProperty('stop')){
      console.log("found stop")
      if(request.stop){
        stopCamera()
      }else{
        setupCam()
      }
    }
})

async function setupCam() {
  navigator.mediaDevices.getUserMedia({
    video: true
  }).then(mediaStream => {
    vid.srcObject = mediaStream;
    stream = mediaStream
    streaming = true
  }).catch((error) => {
    console.warn(error);
  });
  
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
  const leftHandHeight = vid.height - leftHand.position.y
  const rightHand = pose.keypoints[10]
  const rightHandHeight = vid.height - rightHand.position.y
  //console.log(leftHandHeight, rightHandHeight, noseHeight, earsX)
  const offHeadCorrection = Math.abs(earsX[0]-earsX[1])*.8
  const offHeadLimit = Math.abs(earsX[0]-earsX[1])*2.5
  if(
    Math.max(leftHand.score, rightHand.score) > wristScoreThreshold &&
    Math.max(leftHandHeight,rightHandHeight) > noseHeight - noseHeight*.45 &&
    Math.max(leftHandHeight,rightHandHeight) < eyeHeight &&
    (
    rightHand.position.x > Math.max(earsX[0],earsX[1]) + offHeadCorrection ||
    leftHand.position.x < Math.min(earsX[0],earsX[1]) - offHeadCorrection
    ) &&
    rightHand.position.x < Math.max(earsX[0],earsX[1]) + offHeadLimit &&
    leftHand.position.x > Math.min(earsX[0],earsX[1]) - offHeadLimit &&
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
function stopCamera(){
    if(!streaming) return;
    console.log("stremaing state" ,streaming)
    vid.pause();
    vid.srcObject=null;
    stream.getVideoTracks()[0].stop(); 
    streaming = false   
}


async function loop() {
  
  if(net && calibrated && stream){
    let refChanged = false
     net.estimateSinglePose(vid,imageScaleFactor, flipHorizontal, outputStride).then(pose=>{
      //console.log(vid.height, vid.innerHeight,vid.clientHeight)
      curEarScore = [pose.keypoints[1].score, pose.keypoints[2].score ]
      const curEyeY = vid.height - (pose.keypoints[1].position.y +  pose.keypoints[2].position.y)/2
      const curEarY = vid.height - (pose.keypoints[3].position.y +  pose.keypoints[4].position.y)/2
      const curNoseY = vid.height - pose.keypoints[0].position.y
      const curEyeEarY = Math.abs(curEarY - curEyeY)
      const curEyeNoseY = Math.abs(curEyeY - curNoseY)
      const curEyeDistance = calculateDistance(pose.keypoints[1].position, pose.keypoints[2].position) 
      const curEarDistance = calculateDistance(pose.keypoints[3].position, pose.keypoints[4 ].position) 
      const curHeadAngleEyes =  calculateLeftRightHeadAngle(pose.keypoints[1],pose.keypoints[2])
      const curHeadAngleEars =  calculateLeftRightHeadAngle(pose.keypoints[3],pose.keypoints[4])
      const headAngle = mean([curHeadAngleEyes, curHeadAngleEars])

      if(
        Math.abs(curEyeDistance- topEyeDistance)/topEyeDistance < .3 &&
        pose.keypoints[1].score > scoreThreshold &&
        pose.keypoints[2].score > scoreThreshold && 
        gesturesOn && 
        !refChanged
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
          Math.min(pose.keypoints[3].score,pose.keypoints[4].score) > earScoreMin &&

          pose.keypoints[0].score > noseScoreThreshold
        ){
         if(
            numLoops > 5 && 
            numLoops % 5 == 0
          ){
            diffEyeY = curEyeY - lastEyeY
            diffEarY = curEarY - lastEarY
            diffNoseY = curNoseY - lastNoseY
            lastEyeY = curEyeY
            lastNoseY = curNoseY
            lastEarY = curEarY

            if(
              Math.abs(
                Math.sign(diffEyeY) + Math.sign(diffEarY) + Math.sign(diffNoseY)
              ) == 3 && 
              Math.abs(diffEyeY - diffEarY) < referenceYRange*1.2 &&
              Math.abs(diffNoseY - diffEarY) < referenceYRange && 
              Math.abs(diffNoseY - diffEyeY) < referenceYRange && 
              Math.abs(diffEyeY) > referenceYRange * .35 &&
              Math.abs(diffEarY) > referenceYRange * .35 && 
              Math.abs(diffNoseY) > referenceYRange * .35
            ){
              console.log("moved")
              //referenceY = referenceY + diffEyeY
              //refChanged = true
            }
        }
          
          
        const diff = curEyeY - referenceY
        let topShortening = .85
        if(diff > 0 ){
          topShortening = .8
        }

        if(
          Math.abs(diff) < Math.max(6*referenceYRange,20) && 
          Math.abs(diff) > referenceYRange*topShortening && 
          gesturesOn
        ){
          //"lastFocusedWindow": true,"active":true,"currentWindow":true
          chrome.tabs.query({"lastFocusedWindow": true,"active":true}, function(tabs) {
            if(tabs.length > 0){
              chrome.tabs.sendMessage(tabs[0].id, {change : -1*Math.sign(diff)*Math.pow(Math.abs(diff) - topShortening*referenceYRange/2, 2)/3 });
            }  
          });
        }          
      }
          
    });
    ++numLoops
  }
  setTimeout(loop, refreshRate);
}
setupCam();
posenet.load().then((data)=>{
  console.log("loaded")
  net = data
  chrome.storage.local.set({ 'modelLoaded': true });
});
setTimeout(loop, refreshRate);

