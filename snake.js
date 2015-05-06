// Snake.js game, AI, and drawing utilities

// TODO: move global game functions into a class
var canvas = document.getElementById('board');
var ctx = canvas.getContext('2d');
var CANVAS_DIMENSION = 600; //TODO scale with canvas
var DIMENSION = 20;
var TILE_DIMENSION = CANVAS_DIMENSION / DIMENSION;
var SNAKE_INIT_LEN = 5;
var SNAKE_LEN_STEP = 1;
var snakes = [];
var gameOver = false;
// Board key -- TODO make symbols
// 0 = empty
// 1 = nibble
// i > 1 = snake i-1
var board = new Array (DIMENSION);
var nibblex = 0;
var nibbley = 0;

////////////////////////////////////////////////////////////////////////////////

function gameInit(){
    // Create the board
    for (var i=0; i<DIMENSION; i++){
        board[i] = new Array(DIMENSION);
        j = DIMENSION;
        while(j--) board[i][j] = 0;
    }
    // Reset 
    gameReset();

    // Play
    window.setInterval(gameMain, 1);
}

function gameReset(){
    // Clear the board
    var i;
    for (i=0; i<DIMENSION; i++){
        for (var j=0; j<DIMENSION; j++){
            board[i][j] = 0;
        }
    }

    // Create the snake and position it
    var id = 1;
    var headPos = [DIMENSION/2, DIMENSION/2];
    var tailPos = [headPos[0], headPos[1] + SNAKE_INIT_LEN - 1];
    snakes[id-1] = new SnakeAgent (id, headPos, tailPos);
    for (i=headPos[1]; i<= tailPos[1]; i++){
        board[headPos[0]][i] = id+1;
    }

    // Position the nibble
    newNibble();
}

function newNibble (){
    do {
        nibblex = Math.floor(Math.random() * DIMENSION);
        nibbley = Math.floor(Math.random() * DIMENSION);
    } while (board[nibblex][nibbley] !== 0);
    board[nibblex][nibbley] = 1;
    console.log("new nibble: ({0},{1})".format(nibblex, nibbley));
}

function gameMain (){
    if (!gameOver) {
        gameDraw();
        var candidateHead = snakes[0].proposeMove();
        console.log("candidate head: ({0},{1})".format(candidateHead[0], candidateHead[1]));
        result = detectCollision(candidateHead);
        console.log(result);
        if (result.match("died") !== null){
            gameOver = true;
        }
        else if (result == "nibble_eaten"){
            newNibble();
            snakes[0].grow();
        }
        else if (result == "ok"){
            snakes[0].grow();
            snakes[0].popTail();
        }
        snakes[0].printSnake();
    }
}

function detectCollision (candidateHead){
    var candx = candidateHead[0];
    var candy = candidateHead[1];

    if ((candx < 0) || (candx >= DIMENSION) || (candy < 0) || (candy >= DIMENSION)){
        return "died_board_edge";
    }
    else if (board[candx][candy] >= 2){
        return "died_hit_self";
    }
    else if (candx == nibblex && candy == nibbley){
        return "nibble_eaten";
    }
    else {
        return "ok";
    }
}

function gameDraw (){
    //console.log("Drawing");
    var outlineTile = false;
    var tileColour = 0;
    for (var i=0; i<DIMENSION; i++){
        for (var j=0; j<DIMENSION; j++){
            switch (board[i][j]){
                case 0:
                    ctx.fillStyle = "white";
                    outlineTile = true;
                    break;
                case 1:
                    ctx.fillStyle = "red";
                    break;
                default:
                    ctx.fillStyle = "green";
            }
            ctx.fillRect(i*TILE_DIMENSION, j*TILE_DIMENSION, TILE_DIMENSION, TILE_DIMENSION);
            if (outlineTile){
                ctx.fillRect(i*TILE_DIMENSION, j*TILE_DIMENSION, TILE_DIMENSION, TILE_DIMENSION);
                outlineTile = false;
            }
        }
    }
}

// Define an abstract SnakeAgent class

var SnakeAgent = function (id, headPos, tailPos) {
    this.id = id;
    this.pos = [];
    this.headPos = headPos;
	this.len = tailPos[1] - headPos[1] + 1;
    this.candidateHead = [-1,-1];
    for (var i=0; i<= this.len; i++){
        this.pos[i] = [this.headPos[0], tailPos[1]-i];
    }

    this.printSnake();
};

SnakeAgent.prototype.dumbMove = function (){
    // Randomly select next move as long as it doesn't interesect self
    var direction = 0;
    var headx, heady;
    var collision = false;
    var directions_tried = [false, false, false, false];
    var dead_end = false;
    for (;;) {
        headx = this.headPos[0];
        heady = this.headPos[1];
        collision = false;
        var i;
        // 0=L, 1=R, 2=U, 3=D
        direction = Math.floor (Math.random() * 4);
        if (directions_tried[direction] && !dead_end) {
            continue;
        }
        else {
            console.log("direction: {0}".format(direction));
            directions_tried[direction] = true;
            dead_end = true;
            for (i=0; i<4; i++){
                dead_end &= directions_tried[i];
            }
            if (dead_end) {
                console.log("No other choices for direction");
            }
        }

        //console.log("direction={0}".format(direction));
        switch (direction){
            case 0:
                headx -= 1;
                break;
            case 1:
                headx += 1;
                break;
            case 2:
                heady += 1;
                break;
            case 3:
                heady -= 1;
                break;
        }

        for (i=0; i<this.pos.length; i++){
            if (((this.pos[i][0] == headx) && (this.pos[i][1] == heady)) || ((headx < 0) || (headx >= DIMENSION) || (heady < 0) || (heady >= DIMENSION))) {
                console.log("badhead: ({0},{1}) ".format(headx, heady));
                collision = true;
            }
        }

        //Break conditions
        if (dead_end || (!collision && !dead_end)) {
            break;
        }
    }
    //console.debug("new head chosen");
    return [headx, heady];
};

var Tile = function (x, y){
    this.n = x*DIMENSION + y;
    this.id = n.toString(this.n);
    this.x = x;
    this.y = y;
    this.futurePathScore = -1;
    this.pastPathScore = -1;
};

// A*
SnakeAgent.prototype.calculatePathToNibble = function(startPoint, endPoint) {

    var allTilesExplored = {};

    // ** BEGIN HELPER FUNCTIONS **

    // function to generate the neighbours of a tile
    function generateNeighbourNodes(n) {
        var neighbours = [];
        if (n.x > 0){
            neighbours.push(new Tile(n.x-1, n.y));
        }
        if (n.x < DIMENSION-1){
            neighbours.push(new Tile(n.x+1), n.y);
        }
        if (n.y > 0){
            neighbours.push(new Tile(n.x, n.y+1));
        }
        if (n.y < DIMENSION-1){
            neighbours.push(new Tile(n.x, n.y-1));
        }

        var neighbourIds = [];
        for (var b in neighbours){
            allTilesExplored[b.id] = b;
            neighbourIds.push(b.id);
        }

        return neighbourIds;
    }

    // function to reconstruct the lowest cost path
    function reconstructPath(predMap, endId) {
        var orderedPath = [endId];
        var nextId = endId;
        var currentId;
        while (predMap.hasOwnProperty(currentId) {
            nextId = predMap[currentId];
            orderedPath = [nextId].concat(orderedPath);
            delete predMap[currentId];
            currentId = nextId;
        }
        return orderedPath;
    }

    function getTileWithLowestFuturePathScore(tileIdList) {
        var currentTile;
        var lowestScore = Number.MAX_VALUE;
        var lowestTile;
        for (var currentId in tileIdList) {
            currentTile = allTilesExplored[currentId];
            if (currentTile.futurePathScore < 0) {
                continue;
            }

            if (currentTile.futurePathScore < lowestScore) {
                lowestScore = currentTile.futurePathScore;
                lowestId = currentId;
            }
        }

        return lowestId;
    }

    // heuristic cost estimate
    function distance(id_a, id_b) {
        var a = allTilesExplored[id_a];
        var b = allTilesExplored[id_b];
        return Math.sqrt((a.x-b.x)*(a.x-b.x) + (a.y-b.y)*(a.y-b.y));
    }

    // ** END HELPER FUNCTIONS / BEGIN A-STAR **

    var nibbleTile = new Tile (nibblex, nibbley);
    var startTile = new Tile (startPoint[0], startPoint[1]);

    startTile.pastPathScore = 0;
    startTile.futurePathScore = distance(startTile.id, nibbleTile.id);

    allTilesExplored[startTile.id] = startTile;
    allTilesExplored[nibbleTile.id] = nibbleTile;

    var openSet = [startTile.id];
    var closedSet = [];
    var predecessors = {};

    while (openSet.length > 0){
        var currentId = getTileWithLowestFuturePathScore(openSet);
        var currentTile = allTilesExplored[currentId];

        if (currentId == nibbleTile.id) {
            return reconstructPath(predecessors, nibbleTile.id);
        }

        openSet.splice(openSet.indexOf(currentId), 1);
        closedSet.push(currentId);

        for (var neighbourId in generateNeighbourNodes(currentId)) {

            if (closedSet.indexOf(neighbourId) >= 0) {
                continue;
            }

            var neighbourTile = allTilesExplored[neighbourId];
            var tentativePastPathScore = currentTile.pastPathScore + distance(currentId, neighbourId);

            if ((openSet.indexOf(neighbourId) < 0) || (tentativePastPathScore < neighbourTile.pastPathScore)) {

                predecessors[neighbourId] = currentId;
                neighbourTile.pastPathScore = tentativePastPathScore;
                neighbourTile.futurePathScore = tentativePastPathScore + distance(neighbourId, nibbleTile.id);

                if (openSet.indexOf(neighbourId) < 0) {
                    openSet.push(neighbourId);
                }
            }
        }
    }

};

SnakeAgent.prototype.proposeMove = function (){
    this.candidateHead = this.dumbMove();
    return this.candidateHead;
};

SnakeAgent.prototype.grow = function (){
    this.headPos = this.candidateHead;
    console.log("new head: ({0},{1})".format(this.headPos[0], this.headPos[1]));
    this.pos.push(this.candidateHead);
    this.len++;
    board[this.headPos[0]][this.headPos[1]] = this.id + 1;
};

SnakeAgent.prototype.popTail = function (){
    var oldTail = this.pos.splice(0, 1)[0];
    console.log("oldTail: ({0},{1})".format(oldTail[0], oldTail[1]));
    this.len--;
    board[oldTail[0]][oldTail[1]] = 0;
};

SnakeAgent.prototype.printSnake = function() {
    var snakeStr = "Snake: [";
    var x,y;

    for (var i=0; i<this.pos.length; i++){
        x = this.pos[i][0];
        y = this.pos[i][1];
        snakeStr += "(" + x.toString() + "," + y.toString() + "), ";
    }
    snakeStr += "]";
    console.log(snakeStr);
};

// end SnakeAgent

String.prototype.format = function() {
    var formatted = this;
    for( var arg in arguments ) {
        formatted = formatted.replace("{" + arg + "}", arguments[arg]);
    }
    return formatted;
};
