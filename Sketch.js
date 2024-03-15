let stalk1;
let stalk2;
let player;
let boulder;
let boulderX = 200;
let boulderY = 0;
let y1 = 0;
let y2 = -600;

let playerX = 200;

function preload() {
  stalk1 = loadImage("IMG_2901.jpeg");
  stalk2 = loadImage("IMG_2902.jpeg");
  player = loadImage("pngwing.com 2.png");
  boulder = loadImage("pngwing.com 3.png");
}

function setup() {
  createCanvas(400, 600);
  this.focus();
}

function draw() {
  background(220);

  //scrolling background
  imageMode(CORNER);
  image(stalk1, 0, y1, 400, 600);
  image(stalk2, 0, y2, 400, 600);

  y1 += 2;
  y2 += 2;

  if (y1 == 600) {
    y1 = -600;
  }

  if (y2 == 600) {
    y2 = -600;
imageMode(CORNER);
  image(stalk1, 0, y1, 400, 600);
  image(stalk2, 0, y2, 400, 600);

  y1 += 2;
  y2 += 2;

  if (y1 == 600) {
    y1 = -600;
  }

  if (y2 == 600) {
    y2 = -600;
  }

  //HERO
  imageMode(CENTER);
  image(player, playerX, 450, 100, 135);

  if (keyIsDown(RIGHT_ARROW)) {
    if (playerX < 250) {
      playerX = playerX + 5;
    }
  }

  if (keyIsDown(LEFT_ARROW)) {
    if (playerX > 100) {
      playerX = playerX - 5;
    }
  }
  //boulder
  image(boulder, boulderX, boulderY, 100, 100);
    image(boulder, boulderX, boulderY, 100, 100);
  boulderY += 4;
  if (boulderY > 600) {
    boulderY = 0;
    boulderX = random(width);
  }
//collision
  d = dist(playerX,450,boulderX,boulderY)
 if(d < 75){
   noLoop()
   console.log("You loose")
    
    
    
    
    } 
  
  
} //end of function draw

