function showHide() {
  let x = document.getElementById("work");
  if (x.style.display === "none") {
    x.style.display = "block";
    startTime()
    document.getElementById("resetBtn").innerHTML = "HIDE CLOCK";
    document.getElementById("showBtn").innerHTML = "Hide Clock";
  } else {
    x.style.display = "none";
    document.getElementById("resetBtn").innerHTML = "SHOW CLOCK";
    document.getElementById("showBtn").innerHTML = "Show Clock";
  }
}

function showMinus(){
  let x =  document.getElementById("minus");
  if (x.style.display === ""||x.style.display==="none"){
    x.style.display = "block";
    document.getElementById("reset_minus").innerHTML="HIDE MINUS";
  }else{
    x.style.display = "none";
    document.getElementById("reset_minus").innerHTML="SHOW MINUS";
  }
}

function showHideTop() {
  let x = document.getElementById("sop");
  if (x.style.display === "none") {
    startTime()
    x.style.display = "block";
    document.getElementById("reset_Btn").innerHTML = "CLOCK ONLY";
  } else {
    x.style.display = "none";
    document.getElementById("reset_Btn").innerHTML = "SHOW TOP";
  }
}



function startTime() {
  const today = new Date();
  let h = today.getHours();
  let m = today.getMinutes();
  let s = today.getSeconds();


  m = checkTime(m);

  s = checkTime(s);

  var ampm = h >= 12 ? 'pm' : 'am'

  document.getElementById("work").innerHTML = h + ":" + m  + ampm;

  setTimeout(startTime, 1000);

}


function checkTime(i) {
  if (i < 10) { i = "0" + i };  // add zero in front of numbers < 10
  return i;
}

function displayMsg(){
  document.getElementById("message").classList.remove("hide");
  document.getElementById("message").innerHTML = document.getElementById("words").value
}

function setTime() {

  document.getElementById("menu").style.visibility = "visible";
document.getElementById("top").style.visibility = "hidden";

var minutesLabel = document.getElementById("minuto");
var secondsLabel = document.getElementById("seco");
var totalSeconds = 0;

setInterval(setTime=>{
  ++totalSeconds;
  secondsLabel.innerHTML = pad(totalSeconds % 60);
  minutesLabel.innerHTML = pad(parseInt(totalSeconds / 60));
}, 1000);
 

}

function pad(val) {
  var valString = val + "";
  if (valString.length < 2) {
    return "0" + valString;
  } else {
    return valString;
  }
}

function countDown() {
  document.getElementById("countdown").style.display = "none";

  document.getElementById("down").style.color = "#fff";
  document.getElementById("down").style.width = "100%";

  document.getElementById("down").style.fontSize = "22rem";

  let m = parseInt(document.getElementById("minute").value);

  let sec = document.getElementById("second").value;

  let s = parseInt(sec);

  let countDownDate = new Date(new Date().getTime() + m * 60000);

  countDownDate = countDownDate.getTime() + s * 1000;

  var x = setInterval(function () {
    const today = new Date();

    const now = today.getTime()
    let distance = countDownDate - now;

    var minutes = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60));
    var seconds = Math.floor((distance % (1000 * 60)) / 1000);

    // Display the result in the element with id="demo"
    minutes = checkTime(minutes);
    // seconds = checkSec(seconds)
    seconds = checkTime(seconds);
    document.getElementById("down").innerHTML = minutes + ":" + seconds;

    // If the count down is finished, write some text
    if (distance < 0) {
      setTime()
      clearInterval(x);
      document.getElementById("top").style.backgroundColor = "red";
      document.getElementById("body").style.backgroundColor = "#000";
      document.getElementById("down").style.fontSize = "12rem";
      document.getElementById("down").innerHTML = "TIME UP!";
      document.getElementById("down").classList.add("blink");
      document.getElementById("work").style.color="black";
    }
  }, 1000)
}

const hideMenu = document.querySelector('#menu');
const hide_top = document.querySelector('#hide_menu');

hideMenu.addEventListener('click',(e)=>{
e.preventDefault()
document.getElementById("top").style.visibility = "visible";
document.getElementById("menu").style.visibility = "hidden";
})
hide_top.addEventListener('click',(e)=>{
e.preventDefault()
document.getElementById("top").style.visibility = "hidden";
document.getElementById("menu").style.visibility = "visible";
})