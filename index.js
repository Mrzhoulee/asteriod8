const firebaseConfig = {
    apiKey: "AIzaSyCIQI2esuEbw8OPg22go8-As9trmUK-eBo",
    authDomain: "aster-4dc60.firebaseapp.com",
    projectId: "aster-4dc60",
    storageBucket: "aster-4dc60.appspot.com",
    messagingSenderId: "961728738956",
    appId: "1:961728738956:web:61ef8c2d85f16bfb47ada9"
  };

  firebase.initializeApp(firebaseConfig);

  var fileText = document.querySelector(".fileText");
  var uploadPercentage = document.querySelector(".uploadPercentage");
  var progress = document.querySelector(".progress");
  var percentVal;
  var fileItem;
  var fileName;
  
  function getFile(e){
    fileItem = e.taget.files[0];
    fileItem = fileItem.name;
    fileText.innerHTML = fileName;
  }


  function upload() {
    const fileInput = document.getElementById('fileInp');
    const titleInput = document.getElementById('title').value;
    const isPublic = document.getElementById('Public').checked;
    const file = fileInput.files[0];
  
    if (!file) {
      alert('Please select a file to upload.');
      return;
    }
  
    const storageRef = firebase.storage().ref('videos/' + file.name);
    const uploadTask = storageRef.put(file);
  
    uploadTask.on('state_changed', 
      (snapshot) => {
        // Handle progress
        const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
        document.querySelector('.progress').style.width = progress + '%';
        document.querySelector('.uploadPercentage').textContent = Math.round(progress) + '%';
      }, 
      (error) => {
        // Handle error
        console.error('Upload failed:', error);
        alert('Upload failed. Please try again.');
      }, 
      () => {
        // Handle success
        uploadTask.snapshot.ref.getDownloadURL().then((downloadURL) => {
          console.log('File available at', downloadURL);
          // Here you can save the downloadURL, title, and isPublic status to your database
          alert('File uploaded successfully!');
          document.getElementById('uploadForm').reset();
        });
      }
    );
  }
