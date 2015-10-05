var interval;
self.onmessage = function(e){
    if (e.data.s == 'start') {
        interval = setInterval(function() {
            postMessage(null);
        }, e.data.t); //12 default
    }
    if (e.data.s == 'stop') clearInterval(interval);
}
