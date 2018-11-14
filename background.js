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
function calculationZTilt(keypoints){

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


const vid = document.querySelector('#webcamVideo');

//posenet
var imageScaleFactor = 0.5;
var outputStride = 16;
var flipHorizontal = true;
let net = null 

//tracking
let middleEyeY
let topEyeY
let bottomEyeY
let eyeYRange 
let restingHeadAngle

//triggers
var tiltAngle = 10
var scoreThreshold = .93
var earScoreThreshold = .65
const wristScoreThreshold = .4
var bufferZoneSize = .6

//initialize
let middleY = null
let calibrationStatus = null
let numLoops = 0
var timeoutId = false
let handLiftTimeout = false
const handLiftThreshold = 140
let gesturesOn = true
function checkHandLift(pose){
  if(
        mean([pose.keypoints[9].score, pose.keypoints[10].score]) > wristScoreThreshold &&
        (pose.keypoints[9].position.y < handLiftThreshold || 
        pose.keypoints[10].position.y < handLiftThreshold) &&
        !handLiftTimeout
      ){

        gesturesOn = !gesturesOn
        handLiftTimeout = true;
        console.log("lifted wrist left")
        console.log(pose.keypoints)
        setTimeout(function() {
          console.log("can lift again")
          handLiftTimeout = null;
        }, 2000);
      }
}
chrome.runtime.onMessage.addListener((request) => {
    if(request.calibrateTop){
      net.estimateSinglePose(vid,imageScaleFactor, flipHorizontal, outputStride).then(pose=>{
           topEyeY = mean([pose.keypoints[1].position.y,pose.keypoints[2].position.y])
           
       })
    }
    if(request.calibrateMiddle){
      net.estimateSinglePose(vid,imageScaleFactor, flipHorizontal, outputStride).then(pose=>{
           middleEyeY = mean([pose.keypoints[1].position.y,pose.keypoints[2].position.y])
           headAngleEyes =  calculateHeadAngle(pose.keypoints[1],pose.keypoints[2])
           headAngleEars =  calculateHeadAngle(pose.keypoints[3],pose.keypoints[4])
           restingHeadAngle = mean([headAngleEyes, headAngleEars])
           console.log("resting head angle" , restingHeadAngle)
       })
    }
    if(request.calibrateBottom){
      net.estimateSinglePose(vid,imageScaleFactor, flipHorizontal, outputStride).then(pose=>{
           bottomEyeY = mean([pose.keypoints[1].position.y,pose.keypoints[2].position.y])
           console.log("eye y", topEyeY, middleEyeY, bottomEyeY)
           middleY = mean([topEyeY, middleEyeY, bottomEyeY])// - .1 * eyeYRange
           eyeYRange = Math.abs(topEyeY - bottomEyeY)
           
       })
    }
})
async function loop() {
  
  if(net && middleY){
    let headGesture = false

     net.estimateSinglePose(vid,imageScaleFactor, flipHorizontal, outputStride).then(pose=>{
      
      if(
        pose.keypoints[1].score > scoreThreshold &&
        pose.keypoints[2].score > scoreThreshold && 
        pose.keypoints[3].score > earScoreThreshold && 
        pose.keypoints[4].score > earScoreThreshold && 
        gesturesOn && !handLiftTimeout){
        curHeadAngleEyes =  calculateHeadAngle(pose.keypoints[1],pose.keypoints[2])
        curHeadAngleEars =  calculateHeadAngle(pose.keypoints[3],pose.keypoints[4])
        const headAngle = mean([curHeadAngleEyes, curHeadAngleEars])
        const curEyeY = (pose.keypoints[1].position.y +  pose.keypoints[2].position.y)/2
        const diff = curEyeY-middleY
        //console.log("angles " ,headAngle, restingHeadAngle, headAngle- restingHeadAngle)
        
        checkHandLift(pose)
        if(!timeoutId && headAngle - restingHeadAngle < -1*tiltAngle ){
          gesturesOn = !gesturesOn
          timeoutId = true;
          headGesture = true
          console.log("back", pose.keypoints[9].position.y, pose.keypoints[1].score )
          setTimeout(function() {
            timeoutId = null;
            chrome.tabs.query({"active":true}, function(tabs) {
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
            chrome.tabs.query({"active":true}, function(tabs) {
              chrome.tabs.sendMessage(tabs[0].id, {gesture : "forward"});
            });
            headGesture = true
            gesturesOn = !gesturesOn
            timeoutId = null;
          }, 1000);
          
        }

        if(diff >  eyeYRange*bufferZoneSize/2 || diff <  -1*.8*eyeYRange*bufferZoneSize/2 && !headGesture){
          //console.log(eyeYRange, diff)
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

