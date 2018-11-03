/**
 * Copyright 2018 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the 'License');
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *    https://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an 'AS IS' BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
 console.log(document.scripts)
var imageScaleFactor = 0.5;
var outputStride = 16;
var flipHorizontal = false;
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
chrome.extension.onConnect.addListener(function(port) {
  console.log("Connected .....");

  port.onMessage.addListener(function(msg) {
     console.log("new message recieved" + msg);
     calibrationStatus = msg
     if(msg == "calibrate"){
       net.estimateSinglePose(vid,imageScaleFactor, flipHorizontal, outputStride).then(pose=>{
           defaultY = mean([pose.keypoints[1].position.y,pose.keypoints[2].position.y])
       })
     }
     if(msg == "calibrate-top"){
        while(calibrationStatus == msg){
          net.estimateSinglePose(vid,imageScaleFactor, flipHorizontal, outputStride).then(pose=>{
                 topCalibrationEyeY.push(
                  mean([pose.keypoints[1].position.y,pose.keypoints[2].position.y])
                )
          })
        }
     }
     else if(msg == "calibrate-bottom"){
        while(calibrationStatus == msg){
          net.estimateSinglePose(vid,imageScaleFactor, flipHorizontal, outputStride).then(pose=>{
            bottomCalibrationEyeY.push(
              mean([pose.keypoints[1].position.y,pose.keypoints[2].position.y])
            )
          })
        }
     }else if(msg == "calibrate-done"){
        meanTopEyeY = mean(topCalibrationEyeY)
        meanBottomEyeY = mean(bottomCalibrationEyeY)
        defaultY = mean([meanTopEyeY, meanBottomEyeY])
        console.log("calibration done", meanTopEyeY, meanBottomEyeY, defaultY)
     }
     
  });
})
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
async function loop() {
  
  if(net){
     var queryInfo = {
      active: true,
      currentWindow: true
    };
    let headGesture = false
    if(defaultY){

     net.estimateSinglePose(vid,imageScaleFactor, flipHorizontal, outputStride).then(pose=>{
        const leftEyeY = pose.keypoints[1].position.y
        const rightEyeY = pose.keypoints[2].position.y
        const leftEyeX = pose.keypoints[1].position.x
        const rightEyeX = pose.keypoints[2].position.x
        const curEyeY = (pose.keypoints[1].position.y +  pose.keypoints[2].position.y)/2
        const diff = curEyeY-defaultY
        if(numLoops % 7 == 0){
          if(leftEyeXHistory.length > windowSize){
            leftEyeXHistory.shift()
            leftEyeYHistory.shift()
            rightEyeXHistory.shift()
            rightEyeYHistory.shift()
            leftEyeVXHistory.shift()
            leftEyeVYHistory.shift()
            rightEyeVXHistory.shift()
            rightEyeVYHistory.shift()
          }
          leftEyeXHistory.push(leftEyeX)
          leftEyeYHistory.push(leftEyeY)
          rightEyeXHistory.push(rightEyeX)
          rightEyeYHistory.push(rightEyeY)
          if(numLoops > 0){
            let leftEyeVX = calculatDiff(leftEyeXHistory,-1)/windowSize
            let leftEyeVY = calculatDiff(leftEyeYHistory,-1)/windowSize
            let rightEyeVX = calculatDiff(rightEyeXHistory,-1)/windowSize
            let rightEyeVY = calculatDiff(rightEyeYHistory,-1)/windowSize
            leftEyeVXHistory.push(leftEyeVX)
            leftEyeVYHistory.push(leftEyeVY)
            rightEyeVXHistory.push(rightEyeVX)
            rightEyeVYHistory.push(rightEyeVY)
            let leftEyeAX = calculatDiff(leftEyeVXHistory,-1)/windowSize
            let leftEyeAY = calculatDiff(leftEyeVYHistory,-1)/windowSize
            let rightEyeAX = calculatDiff(rightEyeVXHistory,-1)/windowSize
            let rightEyeAY = calculatDiff(rightEyeVYHistory,-1)/windowSize
            
            //console.log(leftEyeVX,leftEyeAX, leftEyeVY, rightEyeVY)


            if( 

              leftEyeVX < -.30  && 
              leftEyeAX < 0 &&
              //leftEyeY > defaultY && 
              leftEyeVY > 0 &&
              rightEyeVY < 0/*&& 
              leftEyeAY > 0 && 
               &&
              rightEyeAY > 0 */
            ){
              console.log("backkkk")
              chrome.tabs.query({"active":true}, function(tabs) {
                chrome.tabs.sendMessage(tabs[0].id, {gesture : "back"});
              });
            }else if(
              rightEyeVX > .30  && 
              rightEyeAX > 0 &&
              //rightEyeY > defaultY && 
              rightEyeVY > 0 &&
              leftEyeVY < 0 /*&& 
              rightEyeAY > 0 && 
              leftEyeVY < 0 &&
              leftEyeAY > 0 */
            ){
              console.log("forward")
              chrome.tabs.query({"active":true}, function(tabs) {
                chrome.tabs.sendMessage(tabs[0].id, {gesture : "forward"});
              });
            }
          }

        }
        if(diff > 3 || diff < -2  && !headGesture){
          chrome.tabs.query({"active":true}, function(tabs) {
            chrome.tabs.sendMessage(tabs[0].id, {change : Math.sign(diff)*Math.pow(Math.abs(diff), 3/2) });
          });
        }          
   
     });
    }
    ++numLoops
  }
  
  setTimeout(loop, 25);
}

