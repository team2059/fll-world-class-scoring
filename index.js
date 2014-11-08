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

app.post('/update', function * (){
    var body = this.request.body;
    console.log(body);
    this.body = true;
});

app.get('/rankings', function *() {
    function compare(a,b) {
        if (a["score"] < b["score"])
            return 1;
        if (a["score"] > b["score"])
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
            newData["score"]=res[x]["score"];
            rankings.push(newData);
            doneTeams.push(res[x]["team"]);
        }
    }
    this.body = _.map(rankings);
});

app.get('/runs', function *() {
    runDB.persistence.compactDatafile;
    var run_id = this.params.id;
    var res = yield runs.find({});
    this.body = _.map(res);
})

app.get('/run/:id', function *() {
    var run_id = this.params.id;
    var res = yield runs.find({"_id":run_id});
    this.body = _.map(res);
})

app.get('/edit/:id', function *() {
    yield send(this, __dirname+'/static/update.html');
})

var io = require('socket.io').listen( app.listen(process.env.PORT || 3000) );

io.on('connection',function(socket){
    socket.on('score', function(data) {
        socket.broadcast.emit('update',data);
    });
    socket.on('submit', function(data) {
        var data = JSON.parse(data);
        runs.insert(data);
        this.body = true;
        socket.broadcast.emit('finished',data.table);
    });
    socket.on('update', function(data) {
        var data = JSON.parse(data);
        runs.update({"_id":data["id"]},{$set:data["message"]},{upsert: true}, function (err, numReplaced){
            console.log(err);
            console.log(numReplaced);
        });
        runDB = new Datastore({ filename: "db/runs.db", autoload: true }); // persistence.compactDatafile is having issues, so the database is reloaded here. 
        runs = wrap(runDB);
        this.body = true;
    });
});
