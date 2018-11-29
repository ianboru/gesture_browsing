navigator.mediaDevices.getUserMedia({
    video: true
  }).then(stream => {
    document.querySelector('#title').hidden = true
    document.querySelector('#status').innerHTML =
      'Webcam access granted for extension.<br/><br/>Try extension on a NEW or REFRESHED TAB.<br/><br/>Click extension icon to calibrate.';
    chrome.storage.local.set({
      'camAccess': true
    }, () => {});
  })
  .catch(err => {
    document.querySelector('#status').innerHTML =
      'Error getting webcam access for extension: ' + err.toString();
    console.error(err);
  });
