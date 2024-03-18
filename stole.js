let canvas = document.querySelector("#canvas");
let ctx = canvas.getContext("2d");
let width = canvas.width;
let height = canvas.height;

const MAX_COMPUTER_SPEED - 2;

const BALL_SIZE = 5;
let ballPosition;

let xSpeed;
let ySpeed;

function initBall() {
 ballPosition = { x: 20, y: 30 };
  xSpeed = 4;
  ySpeed = 2;
}

const PADDLE_WIDTH = 5;
const PADDLE_HEIGHT = 20;
const PADDLE_OFFSET = 10;

let leftPaddleTop = 10;
let rightPaddleTop = 30;

let leftScore = 0
let rightScore = 0
let gameOver = false;


document.addEventListener("mousemove", e => {
  rightPaddleTop = e.y - canvas.offsetTop;
});

function draw() {
  //fill the canvas with black 
   ctx.fillStyle = "black";
   ctx.fillRect(0,0, width, height);

//everything else will be white
ctx.fillStyle = "white";

//draw the ball
ctx.fillRect(ballPosition.x, ballPosition.y, BALL_SIZE, BALL_SIZE);

//draw paddles
ctx.fillRect(
  PADDLE_OFFSET,
  leftPaddleTop,
  PADDLE_WIDTH,
  PADDLE_HEIGHT
  );
  ctx.fillRect(
  PADDLE_OFFSET,
  rightPaddleTop,
  PADDLE_WIDTH,
  PADDLE_HEIGHT
  );
  
