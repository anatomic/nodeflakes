#!/usr/local/bin/node

var io   = require('socket.io').listen(7979),
    fs   = require('fs'),
    zmq  = require('zmq');

var Throughput = require('./app/throughput');

io.configure(function() {
    //io.set('transports', ['websocket']);
    io.set('log level', 2); // info
    if (process.argv[2]) {
        console.log("restricting origin: "+process.argv[2]);
        io.set("origins", process.argv[2]);
    }
});

var queue = zmq.createSocket('pull');

var throughput = new Throughput(2000);
var handled = {};
var handledArray = [];

queue.bind('tcp://127.0.0.1:5556', function(err) {
    if (err) throw err;
    console.log('bound ZMQ pull server');
    queue.on('message', function(data) {

        throughput.measure(data);

        // @todo ideally we wouldn't parse the inbound data *just* to get the tweet ID. Perhaps
        // the processor daemons can put a delemited message on instead?
        var tweet = {};
        try {
            tweet = JSON.parse(data);
        } catch (e) {
            console.log("could not parse tweet");
            return;
        }
        if (handled[tweet.id] != null) {
            console.log("ignoring duplicate tweet ["+tweet.id+"]");
            return;
        }

        handled[tweet.id] = tweet;
        handledArray.push(tweet.id);
        if (handledArray.length > 20) {
            var id = handledArray.shift();
            delete handled[id];
        }

        io.sockets.emit('tweet', data.toString('utf8'));
    });
});

io.sockets.on('connection', function(socket) {
    // any ack?
    socket.on('disconnect', function() {
        // ?
    });
});
