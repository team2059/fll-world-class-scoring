var router = require('koa-router');
var cors = require('koa-cors');
var Datastore = require('nedb');
var wrap = require('co-nedb');
var bodyParser = require('koa-bodyparser');
var json = require('koa-json');
var _ = require('lodash');
var send = require('koa-send');

var app = require( 'koa' )();
app.use(bodyParser());
app.use(cors());
app.use(router(app));
app.use(json());

var server = require('http').createServer(app.callback());

var runDB = new Datastore({ filename: "db/runs.db", autoload: true });
var runs = wrap(runDB);

app.get('/', function *() {
    yield send(this, __dirname+'/static/scoring.html');
});

app.get('/standings', function *() {
    yield send(this, __dirname+'/static/standings.html');
});

app.get('/board', function *() {
    yield send(this, __dirname+'/static/board.jpg');
});

app.put('/submit', function *() {
    var body = this.request.body;

});

app.post('/update', function * (){
    var body = this.request.body;
    console.log(body);
    this.body = true;
});

app.get('/rankings', function *() {
    function compare(a,b) {
        if (a["raw_score"] < b["raw_score"])
            return 1;
        if (a["raw_score"] > b["raw_score"])
            return -1;
        return 0;
    }
    var res = yield runs.find({});
    res = res.sort(compare);
    var rankings = [];
    var doneTeams = [];
    for(var x = 0; x < res.length; x++){
        if(doneTeams.indexOf(res[x]["team"]) < 0){
            var newData = {}
            newData["team"]=res[x]["team"];
            newData["score"]=res[x]["raw_score"];
            rankings.push(newData);
            doneTeams.push(res[x]["team"]);
        }
    }
    this.body = _.map(rankings);
});

var io = require('socket.io').listen( app.listen(3000) );

io.on('connection',function(socket){
    socket.on('score', function(data) {
        console.log(data);
        socket.broadcast.emit('update',data);
    });
    socket.on('submit', function(data) {
        var data = JSON.parse(data);
        console.log(data);
        runs.insert(data);
        this.body = true; 
    });
});
