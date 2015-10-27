window.onload = function() {
    window.AudioContext = window.AudioContext || window.webkitAudioContext;
    var context = new AudioContext();
    var gain = context.createGain();
    var tempo = 120; //default tempo
    var metronomes = []; //array that holds the mets
    var mets = document.getElementById('mets'); //div that holds the met elements.
    var newButton = document.getElementById('new'); //creates a new met
    var starter = document.getElementById('start'); //starts the mets
    var stopper = document.getElementById('stop'); //stops them
    var tempoInput = document.getElementById('tempo'); //tempo
    var mvol = document.getElementById('mvol');
    var started = false; //metronomes' state
    var worker = new Worker('metWorker.js'); //this worker handles the setInterval tasks (like scheduling notes).
    var mobile;
    if (screen.availWidth <= 850)
        mobile = true;
    else mobile = false;
    
    var lookAhead = .1; //the value in secs that sounds are pre-scheduled by.
    //if (mobile) lookAhead = .1; //works for mobiles
    
    $('<div>', {css: { //copyright footer
        position: 'fixed',
        bottom: '0px',
        width: '100%',
        height: '30px',
        textAlign: 'center',
        color: '#3E444B',
        fontSize: '9pt',
        zIndex: -1
    }}).appendTo(document.body).html('&copy;'+ new Date().getFullYear() + ' Aaron Allen');
    
    var instructions; 
    var request = new XMLHttpRequest();//get the instructions
    request.open('GET','metinstructions.txt?'+Math.floor(Math.random()*1000));
    request.onreadystatechange = function(e) {
        instructions = e.target.response;
    }
    request.send(null);
    
    $('<button>', {text: '[?]'}).attr('title', 'Help').addClass('helpButton').appendTo(mets).click(function() { //the help button
        $('<div>').addClass('help').appendTo(mets).append(instructions).append(
            $('<button>', {text: 'Close'}).addClass('closeHelp').click(function() {
                $(this.parentElement).remove();
            })
        ).append(
            $('<button>', {text: 'Close', css:{position:'absolute',top:'5px',right:'5px'}}).addClass('closeHelp').click(function() {
                $(this.parentElement).remove();
            })
        );//create a div window with the instructions and buttons to close the window.
    });
    
    
    newButton.onclick = function() {
        metronomes.push(new Metronome); //initiate a new Metronome
        if(!mobile && context.createStereoPanner)setPan();
        $(window).trigger('resize');
    };
    
    function setPan() { //set the pan values for each layer based on number of layers
        if (!context.createStereoPanner) return; //do nothing for browsers that don't support the stereopanner node.
        var p = 2/(metronomes.length + 1)
        for (var i =0; i<metronomes.length; i++)
            metronomes[i].pan.pan.value = -1 + (i+1)*p;
    }
    
    starter.onclick = start;
    
    function start() {
        if (metronomes.length === 0) return false;
        if (started) return false;
        newButton.setAttribute('disabled', true); //can't add new layers during play.
        if(context.state === 'suspended') context.resume();
        if(chrInter) clearInterval(chrInter);
        started = true;
        time = context.currentTime+.1; //used as the metronomes' start time and to set the needle on the graph
        if (randomMuteTime.val() > 0) { //the random mute incrementer.
            randMuteStart();
            randMute = 0;
        }
        for (var i in metronomes)
            metronomes[i].start();
        worker.postMessage({'s':'start', 't':25});
        if (setMute1.val() && setMute2.val()) { //initiates the Set Mute feature if its being used.
            setMuteTime1 = (parseBeat(setMute1.val())[0]*60/tempo);
            setMuteTime2 = (parseBeat(setMute2.val())[0]*60/tempo);
            setMuteOn = true;
            muteStart = context.currentTime + .09 + setMuteTime1; //offset by .09 b/c the beat is offset by .1 and we need a little room for error.
            muteEnd = context.currentTime + .09 + setMuteTime1 + setMuteTime2;
        }
        if(visGraph) drawGraph(); //graph it
    }
    
    worker.onmessage = function() { //whenever the worker ticks
        metronomes.forEach(function(x) { x.schd(); });
    };
    
    stopper.onclick = stop;
    
    var chrInter; //holds interval of 'noise' emission for chrome mobile bug.
    function stop() {
        if(!started) return false;
        for (var i in metronomes)
            metronomes[i].stop();
        started = false;
        worker.postMessage({'s':'stop'});
        setMuteStop();
        newButton.removeAttribute('disabled'); //enable the new layer button
        if(navigator.userAgent.indexOf('Silk') == -1) setTimeout(function(){if(!started)context.suspend();},5000); //save battery
        if(mobile && navigator.userAgent.indexOf('Chrome') != -1) //bug workaround for mobile chrome.
            chrInter = setInterval(function() {
                if(started) {
                    return;
                }
                context.resume()
                var _osc = context.createOscillator(); //create some inperceptable noise to keep connection open.
                _osc.frequency.value = 10;
                var _gain = context.createGain();
                _gain.gain.value = .01;
                _osc.connect(_gain);
                _gain.connect(context.destination);
                _osc.start(context.currentTime);
                _osc.stop(context.currentTime + .01);
                setTimeout(function() {
                    if(!started)
                        context.suspend();
                },20);
            },30000);
        /*InstrSamp.played.forEach(function(x,i,a){ //stop any sound samples that may still be ringing such as cymbals.
            if(x instanceof AudioBufferSourceNode)
                setTimeout(function(){x.stop();}, 130);
            a[i] = null;
        });*/
    }
    
    document.addEventListener('keydown', function(e) { //give space bar start/stop action.
        if (e.keyCode === 32 && String(document.activeElement).slice(8,-1) !== 'HTMLInputElement'){
            if (started) stop();
            else start();
        }
    }, false);
    
    
    context.decodeAudioData = context.decodeAudioData || context.webkitdecodeAudioData; //for safari...
    function InstrSamp() { //A class for loading and manipulating sound samples.
        var _this = this;
        this.buffers = []; //holds all the buffers.
        this.hiHatPedal = []; //holds the buffer index of pedal down samples
        this.hiHatHit = []; //holds the index number of any other hihat sound.
        this.counter = 0;
        //var timer = (new Date).getMilliseconds();
        loaderProg(0,InstrSamp.array.length);
        InstrSamp.array.forEach(function(x,i,a) { //create a buffer node for each sound file.
            var path;
            //a = new Audio();
            //if(a.canPlayType("audio/ogg")) //check for compatability
                path = './drums/' + x.toLowerCase() + '.ogg';
            //else path = './drums/aiff/' + x.toLowerCase() + '.aiff';
            //delete a;
            var request = new XMLHttpRequest();
            request.open('GET', path);
            request.responseType = 'arraybuffer';
            request.onload = function() {
                context.decodeAudioData(request.response, function(buffer) {
                    _this.buffers[i] = buffer;
                    if(x.search(/hihat_pedal(down)?/i) != -1)
                        _this.hiHatPedal.push(i); //needed for hihat pedal functionality
                    if (x.search(/hihat_(?!closed)/i) != -1) //closed samples should pass thru.
                        _this.hiHatHit.push(i);
                    _this.counter++;
                    if(_this.counter == a.length) {
                        //console.log(timer - (new Date).getMilliseconds());
                    }
                    var counter = _this.counter;
                    requestAnimationFrame(function() {
                        loaderProg(counter, a.length); //update loading progress
                    });
                });
            }
            request.send();
        });
    }
    InstrSamp.array = [ //sound files to be buffered
        //'Kick',
        //'Ride',
        //'Snare',
        'Snare_Center_V6',
        'Snare_Center_V11',
        'Snare_Center_V16',
        'Snare_Edge_V6',
        'Snare_Edge_V11',
        'Snare_Edge_V16',
        'Snare_Rim_V6',
        'Snare_Rim_V11',
        'Snare_Rim_V16',
        'Snare_XStick_V6',
        'Snare_XStick_V11',
        'Snare_XStick_V16',
        'Ride_Bell_V5',
        'Ride_Bell_V8',
        'Ride_Bell_V10',
        //'Ride_Center_V5',
        'Ride_Center_V6',
        'Ride_Center_V8',
        'Ride_Center_V10',
        'Ride_Edge_V4',
        'Ride_Edge_V7',
        'Ride_Edge_V10',
        'Kick_V7',
        'Kick_V11',
        'Kick_V16',
        'FloorTom_V6',
        'FloorTom_V11',
        'FloorTom_V16',
        'RackTom_V6',
        'RackTom_V11',
        'RackTom_V16',
        'HiHat_Closed_Center_V4',
        'HiHat_Closed_Center_V7',
        'HiHat_Closed_Center_V10',
        'HiHat_Half_Center_V4',
        'HiHat_Half_Center_V7',
        'HiHat_Half_Center_V10',
        'HiHat_Open_Center_V4',
        'HiHat_Open_Center_V7',
        'HiHat_Open_Center_V10',
        'HiHat_Closed_Edge_V10',
        'HiHat_Closed_Edge_V7',
        'HiHat_Half_Edge_V10',
        'HiHat_Half_Edge_V7',
        'HiHat_Open_Edge_V10',
        'HiHat_Open_Edge_V7',
        'HiHat_Pedal_V3',
        'HiHat_Pedal_V5',
        'Crash1_Edge_V10',
        'Crash1_Edge_V8',
        'Crash1_Edge_V5'
    ].sort(function(a,b) { //sort alpha with last digits as secondary sort.
        var a1 = a.replace(/\d+$/,'').toLowerCase();
        var b1 = b.replace(/\d+$/,'').toLowerCase();
        var a2 = parseInt(a.match(/\d+$/)[0]);
        var b2 = parseInt(b.match(/\d+$/)[0]);
        if (a1 === b1 && a2 > b2) return 1;
        else if (a1 === b1 && a2 < b2) return -1;
        else if (a>b)
            return 1;
        else if (a<b)
            return -1;
        else return 0;
    });
    InstrSamp.list = [
        'Hi-Hat',
        'Ride Cymbal',
        'Kick Drum',
        'Floor Tom',
        'Rack Tom',
        'Snare Drum',
        'Crash'
    ].sort();
    InstrSamp.played = new Array(40); //holds most recent buffersources for easy stopping.
    InstrSamp.hiHatSrc = new Array(4); //holds hihat sounds to be stopped when hihat pedal down occurs.
    
    
    tempoInput.onchange = function() {
        if(started && (metronomes.length>1)) //can't change tempo during play if more than 1 nome.
            this.value = tempo;
        else {
            if(this.value !== '') {
                tempo = this.value;
                this.style.borderWidth = 0;
                this.classList.remove('error');
            }else {this.classList.add('error'); this.style.borderWidth = '1px';}
        }
    };
    
    var tapTempo = (function() {
        var temp;
        var temps = [];
        var t;
        return function() { //get the average of consecutive tempo taps.
            if(started && metronomes.length>1) return false; //can't change tempo during play if more than 1 nome.
            if(t)clearTimeout(t);
            if(temp) {
                temp = 60/((new Date().getTime() - temp)/1000);
                temps.push(temp);
                tempoInput.value = tempo = (temps.reduce(function(a,b){return parseFloat(a)+parseFloat(b);}, 0)/temps.length).toFixed(2);
            }
            temp = new Date().getTime();
            t = setTimeout(function() { //if idle for 1.5 sec, reset the vars.
                temp = undefined; 
                temps = [];
            }, 1500);
            return false;
        }
    })();
    if(mobile) $('#tapTempoEle').on('touchend', tapTempo);
    else $('#tapTempoEle').click(tapTempo);
    
    mvol.onchange = function() {
        if (this.value < 0) this.value = 0;
        if (this.value > 10) this.value = 10;
        if(Metronome.validate(this.value,'volume')) {
            gain.gain.value = this.value/10;
            this.classList.remove('error');
        }else this.classList.add('error');
    }
    
    function getCycles() { //returns array of minimum number of cycles for each layer to form a complete repeat of beat.
        var cycles = [];
        var metClone = metronomes.slice(0); //make copy to sort by beat length.
        function metReduce(p,c) { //used to reduce a beat array.
            if(Array.isArray(p) && Array.isArray(c))
                return p[0]+c[0];
            if(Array.isArray(p))
                return p[0]+c;
            if(Array.isArray(c))
                return p+c[0];
            return p+c;
        }
        metClone.sort(function(a,b) {
            if(a.beat.reduce(metReduce,0) > b.beat.reduce(metReduce,0))
                return -1;
            if(a.beat.reduce(metReduce,0) < b.beat.reduce(metReduce,0))
                return 1;
            return 0;
        });
        var top = metClone[0].beat.reduce(metReduce,0);
        
        var count = 1;
        while(count !== 0){ //get the longest beat cycle set (least common denominator).
            count = 0;
            for(var i=1; i<metClone.length; i++) {
            //metClone.forEach(function(m){
                while(((top.toFixed(5) / metClone[i].beat.reduce(metReduce,0)).toFixed(5)).toString().slice(-6) != 0) {
                    top += metClone[0].beat.reduce(metReduce,0);
                    count++; //we'll need to cycle through all the layers again.
                    if(count>500)
                        return false;
                        //throw new Error('This beat is too asymmetrical be graphed.');
                }
                if(i===1) count=0; //avoid unnecessary repetition.
            }
        }
        metronomes.forEach(function(m) { //compute # of cycles for each layer based on the GCD.
            var orig,den;
            orig = den = m.beat.reduce(metReduce,0);
            var count = 1;
            metronomes.forEach(function(m){
                while(((den.toFixed(5) / top.toFixed(5)).toFixed(5)).toString().slice(-6) != 0) {
                    count++;
                    den += orig;
                }
            });
            cycles.push(count);
        });
        return cycles;
    }
    
    var canvas = document.createElement('canvas');
    var graphDiv = $('<div>').css({
        position: 'relative', 
        textAlign: 'left', 
        display: 'block',
        marginLeft: 'auto',
        marginRight: 'auto'
    }).append(canvas).insertBefore('#controls');
    $(canvas).attr({width: 0, height: 0}).css('display','none');
    var c = canvas.getContext('2d');
    var totalCycleTime;
    var time;
    /*var needle = document.createElement('canvas');
    $(needle).css({
        position: 'absolute',
        left: 0,
        top: 0,
        opacity: .3,
        display: 'none'
    }).attr({width: 400, height: 400}).appendTo(graphDiv);
    var needleC = needle.getContext('2d');*/
    
    function graphNeedle(radius) { 
        //if(graphDiv.children().length>1) graphDiv.children()[1].remove(); //replace old needle.
        var needle = document.createElement('div');
        $(needle).css({
            position: 'absolute',
            height: radius, 
            width: '2px',
            backgroundColor: 'black',
            opacity: .3,
            'transform-origin': '50% bottom'
        }).appendTo(graphDiv).css({left: radius-1, top:1});
        var width = radius*2;
        var cycleSec = totalCycleTime*(60/tempo);
        function rotateNeedle() { //rotate and draw the needle
            needle.style.transform = 'rotate('+(context.currentTime-time)/cycleSec*360+'deg)';
            if(!started) {
                if(needle.parentElement)
                    needle.parentElement.removeChild(needle);
            }
            else requestAnimationFrame(rotateNeedle);
        }
        requestAnimationFrame(rotateNeedle);
    }
    
    function drawGraph() { //Create the beat graph.
        var width = mets.clientWidth-8;
        canvas.setAttribute('width', width);
        canvas.setAttribute('height', width);
        graphDiv.css('width', width);
        $(window).trigger('resize');
        c.beginPath();
        c.arc(width/2,width/2,width/2.1,0,2*Math.PI);
        c.fillStyle = '#adbbcc';
        c.fill();
        var cycles;
        if(cycles = getCycles()){}
        else {
            canvas.setAttribute('height',15);
            c.fillText('Error: This beat could not be graphed because its too asymmetrical.',20,10);
            return;
        }
            
        function metReduce(p,c) { //used to reduce a beat array.
            if(Array.isArray(p) && Array.isArray(c))
                return p[0]+c[0];
            if(Array.isArray(p))
                return p[0]+c;
            if(Array.isArray(c))
                return p+c[0];
            return p+c;
        }
        totalCycleTime = metronomes[0].beat.reduce(metReduce,0) * cycles[0]; //the beat cycle sum.
        if(started) graphNeedle(width/2);
        for(var i=0; i<metronomes.length; i++) {
            var radius = width/7 + (metronomes.length-i)*(3/10*width/metronomes.length);
            var tickTop;
            if(i===0) tickTop = 11;
            else tickTop = 3/20*width/metronomes.length;
            var tickBot;
            if(i===metronomes.length-1) tickBot = 11;
            else tickBot = 3/20*width/metronomes.length;
            var beatCycle = [];
            c.save(); //save untransformed state.
            c.translate(width/2,width/2);
            //c.fillStyle = 'black';
            //c.fillRect(0,0,1,1); //mark center for calibration.
            c.rotate(1*Math.PI);
            c.rotate(metronomes[i].offSet/totalCycleTime*2*Math.PI);
            c.beginPath();
            for(var p = 0; p<cycles[i]; p++)
                beatCycle = beatCycle.concat(metronomes[i].beat); //create an array that contains entire beat cycle.
            beatCycle.forEach(function(i,a,x){ //convert beat values to radians.
                if(Array.isArray(i))
                   i = i[0];
                x[a]=i/totalCycleTime*2*Math.PI;
            }); 
            
            for(var p=0; p<beatCycle.length;p++) {
                c.lineTo(0,radius-tickBot+1); //the tick mark
                c.lineTo(0,radius+tickTop-1);
                c.arc(0,0,radius,.5*Math.PI,beatCycle[p]+.5*Math.PI); //the circle.
                c.rotate(beatCycle[p]);
            }
            c.strokeStyle = 'hsl('+ ((metronomes.length-i)*200/metronomes.length) + ',55%,35%)' //give each layer a color.
            c.lineWidth = 1.5;
            if(mobile) c.lineWidth = 2;
            c.stroke();
            c.restore();
        }
    }
                
    
    
    var options = $('<div>').addClass('options');
    
    var moreOptns = $('#moreOptns').click(showOptns); //the more options button
        
    function showOptns() { //the advanced options dialog
        $('#controlWrap').append(options);
        options.slideUp(0).slideDown(300).css({
            top: controlWrap.offsetHeight,
            width: controlWrap.offsetWidth -8.5
        });
        $(this).text('[less]');
        moreOptns.unbind('click');
        moreOptns.click(hideOptns);
    }
    function hideOptns() { //hide the options dialog
        options.slideUp(300);
        $(this).text('[more]');
        moreOptns.unbind('click');
        moreOptns.click(showOptns);
    }
    
    gain.gain.value = .5; //master volume
    
    gain.connect(context.destination);
    
    mets.style.marginTop = ($(window).innerHeight()/2 - mets.offsetHeight/2) + 'px'; //keep it centered vertically.
    
    window.onresize = function() { //keep mets centered.
        mets.style.marginTop = ($(window).innerHeight()/2 - mets.offsetHeight/2) + 'px';
        if(parseFloat(mets.style.marginTop.slice(0,-2)) <0) mets.style.marginTop = '0px';
        options.css({
            top: controlWrap.offsetHeight,
            width: controlWrap.offsetWidth -8.5
        });
        metronomes.forEach(function(x) { x.beatInput.trigger('input') }); //resize the beat input if needed.
    };
    
    function msg(str, inputField, ok, cancel, successCall, failCall) { //dialog creator.
        var back = $('<div>').css({ //darkens the background.
            position: 'absolute',
            left: 0,
            top: 0,
            backgroundColor: 'black',
            opacity: .5,
            zIndex: 99
        }).appendTo(document.body);
        str = str.replace(/\n/g, '<br />');
        var _div = $('<div>').appendTo(document.body).addClass('msg').append('<p>'+str+'</p>'); //message div
        var input;
        var email;
        var pass;
        if (inputField)
            _div.children(0).append('<br /><br />');
        if (inputField === 'createAcct') { //if were creating an account.
            var p = $('<p>').appendTo(_div.children(0)).css('textAlign', 'left').css('padding-left', '20px');
            p.append('E-mail:<br />');
            email = $('<input>').attr('type', 'text').appendTo(p);
            p.append('<br />');
            p.append('Password:<br />');
            pass = $('<input>').attr('type', 'password').appendTo(p);
        }else if (inputField)
            input = $('<input>').attr('type', 'text').appendTo(_div.children(0)).focus();
        if (cancel) {
            _div.append(
                $('<button>').html('Cancel').click(function() {
                    if (failCall)
                        failCall();
                    close();
                })
            );
        }
        if (ok) {
            if (ok === true) ok = 'OK';
            _div.append(
                $('<button>').html(ok).click(function() {
                    if(email && pass) { //creating an account.
                        if(email.val() == '' || pass.val() == '')
                            return;
                        successCall([email.val(),pass.val()]);
                    }else{ //normal dialog
                        if (input && input.val() == '')
                            return;
                        if (!input) input = true;
                        else input = input.val();
                        if (successCall)
                            successCall(input); //success callback
                    }
                    close();
                })
            );
            if (!inputField)
                _div.children(1).focus();
        }
        
        window.addEventListener('resize', resizer, false);
        function resizer() { //keep everything properly positioned.
            var width = window.innerWidth;
            var height = window.innerHeight;
            _div.css('top', height/2 - _div.height()/2);
            _div.css('left', width/2 - 200);
            if(446 > width) _div.css('width', width-32);
            else _div.css('width', 400);
            back.css('width', $(document).width());
            back.css('height', $(document).height());
            //back.css('left', window.pageXOffset);
            //back.css('top', window.pageYOffset);
            if((_div.offset()).top<5) _div.css('top', 5);
            if((_div.offset()).left<5) _div.css('left', 5);
        }
        function close() { //close the window.
            window.removeEventListener('resize', resizer, false);
            _div.remove();
            back.remove();
        }
        resizer();
    }
    
    
    var savedBeats = $('<select>', {css: { width: 165, marginBottom: '3px'}}); //holds the saved beats.
    
    function updateSaved() { //update the list of saved beats. order them alphabetically.
        if (localStorage.length === 0) {
            savedBeats.empty().append(
            $('<option>').attr('value', 'none').html('<i>(No Saved Beats)</i>')
            );
        }else{
            savedBeats.empty().append(
            $('<option>').attr('value', 'none').html('<i>Select a Saved Beat:</i>')
            );
        }
        for (var i=0; i<localStorage.length; i++) {
            var name = localStorage.key(i);
            savedBeats.append(
                $('<option>').attr('value', name).text(name)
            );
        }
        savedBeats.children('option').sort( function (a,b) { //sort beats alphabetically
            if (a.value === 'none') return -1;
            if (b.value === 'none') return 1;
            if (a.value.toLowerCase() > b.value.toLowerCase()) return 1;
            if (a.value.toLowerCase() < b.value.toLowerCase()) return -1;
            return 0;
        }).detach().appendTo(savedBeats);
        savedBeats.val('none'); //make the descriptor the default option
    }
    updateSaved();
    
    $('<div>', {css: {display: 'inline-block', textAlign: 'left'}}).appendTo(options).append(savedBeats).append('<br />').append(
        $('<button>', {text: 'Save'}).css('display', 'inline-block').click( function() { //the save button
            
            var beat = Metronome.stringifyBeat(metronomes); //get text representation of the beat.
            if(!beat) return false;
            function getBeatName() { //ask for a name for the beat
                //var name = prompt('Enter a name for this beat.');
                msg('Enter a name for this beat.',true,'Save Beat',true,entered);
                function entered(name) {
                    if(!name || name === 'none') return;
                    if (localStorage.getItem(name) && name !== 'none') { 
                        function yes() {
                            localStorage.setItem(name, beat);
                            updateSaved();
                        }
                        function no() {
                            getBeatName();
                        }
                        msg('That name is already used. Do you want to replace the old beat with this one?',false,'Yes',true, yes, no);
                        //if(confirm('That name is already used. Do you want to replace the old beat with this one?')) {
                    }else{
                        localStorage.setItem(name, beat);
                        updateSaved();
                    }
                }
            }
            getBeatName();
        })
    ).append(
        $('<button>', {text: 'Load'}).css('display', 'inline-block').click( function() { //load button
            if (savedBeats.val() !== 'none' && !started) {
                var beat = localStorage.getItem(savedBeats.val());
                Metronome.reviveBeat(beat);
            }
        })
    ).append(
        $('<button>', {text: 'Delete'}).css('display', 'inline-block').click( function() {
            if (savedBeats.val() !== 'none') 
                msg('Are you want to delete "'+savedBeats.val()+'" ?',false, 'Delete',true,yes)
                function yes() {
                //if (confirm('Are you want to delete \"'+savedBeats.val()+'\" ?')) {
                    localStorage.removeItem(savedBeats.val());
                    updateSaved();
                }
        })
    );
    
    var inOutDiv = $('<div>').addClass('inOutDiv').appendTo(options);
    
    var inOut = $('<textarea>').attr('wrap', 'soft').appendTo(inOutDiv).css({
        resize: 'none', width: '220px', height: '85px', display: 'inline-block', float: 'left'
    }); //the input/output text element.
    
    $('<div>', {css: {display: 'inline-block', float: 'right'}}).appendTo(inOutDiv).append( //a div that wraps all the buttons
        $('<button>', {text: 'Export'}).click( function() { //the exporter button
            var beat = Metronome.stringifyBeat(metronomes);
            if(beat)
                inOut.val(beat); //export a text representation of each beat layer.
        })
    ).append(
    
        $('<button>', {text: 'Import'}).click(function () { //recreate a 'saved' beat.
            if(!started) {
                var beat = inOut.val();
                beat = beat.replace(/\n/, '');
                Metronome.reviveBeat(beat);
            }
        })
    ).append(
    
        $('<button>', {text: 'Select All'}).click(function () {
            inOut.select();
        })
    );
    
    var randomMute = $('<input>').attr('type', 'text').attr('id', 'randomMute').attr('value', '0').change(function() {
        if(this.value < 0) this.value = 0; //this input is the random mute percentage.
        if(this.value > 100) this.value = 100;
        if(this.value === '') randMute = 0;
        if(Metronome.validate(this.value,'volume')) {
            randMute = this.value/100;
            this.classList.remove('error');
        }else this.classList.add('error');
    });
    
    var randomMuteTime = $('<input>').attr('type', 'text').attr('id', 'randomMuteTime').attr('value', '0').change(function() {
        if(this.value < 0) this.value = 0; //the # of seconds it takes to get up to full muting level.
        if(Metronome.validate(this.value,'volume')) {
            randMuteTime = this.value;
            this.classList.remove('error');
        }else this.classList.add('error');
    });
    
    $('<div>').appendTo(options).append('Random Mute: ').append(randomMute).append('% ').append(randomMuteTime).append('sec');
    
    var setMuteTime1 = '';
    var setMuteTime2 = '';
    
    var setMute1 = $('<input>').attr('type', 'text').addClass('setMute').change( function() {
        if(parseBeat(this.value)[0] == 0 && parseBeat(setMute2.val())[0] == 0) this.value = '';
        if(Metronome.validate(this.value,'offset'))
            this.classList.remove('error');
        else this.classList.add('error');
    });
    var setMute2 = $('<input>').attr('type', 'text').addClass('setMute').change( function() {
        if(parseBeat(this.value)[0] == 0 && parseBeat(setMute1.val())[0] == 0) this.value = '';
        if(Metronome.validate(this.value,'offset'))
            this.classList.remove('error');
        else this.classList.add('error');
    });
    
    $('<div>').css({paddingLeft: '20px'}).appendTo(options).append('Audible: ').append(setMute1).append('<br>').append('Silent: ').append(setMute2);
    
    var visPulse = true;
    var visGraph = false;
    $('<div>').appendTo(options).append('<u>Visualizer</u><br>Pulse:').append( //the visualizer controls
        $('<input>').attr('type','checkbox').attr('checked', 'true').change(function() {
            visPulse=!visPulse;
            if(visPulse)
                if(started)
                    metronomes.forEach(function(x,i,a){x.visualizer()});
        })
    ).append('<br>Graph:').append(
        $('<input>').attr('type','checkbox').change(function() {
            visGraph=!visGraph;
            if(visGraph) {
                canvas.style.display = 'inline';
                //needle.style.display = 'inline';
                drawGraph();
            }
            else {
                $(canvas).attr({width:0,height:0}).css('display','none');
                //$(needle).attr({width:0,height:0}).css('display','none');
                if(graphDiv.children().length>1) graphDiv.children()[1].remove();
                $(window).trigger('resize');
            }
        })
    );
    
    var simpleBeep = false; //PC's can opt for mobile style beeps (works better for super fast stuff).
    
    $('<div>').appendTo(options).append('Beep:').append(
        $('<input>').attr('type','checkbox').change(function() { 
            simpleBeep=!simpleBeep; 
            if(simpleBeep) metronomes.forEach(function(x,i,a) { 
                a[i].lowPass.frequency.value = a[i].frequency; 
            });
            else metronomes.forEach(function(x,i,a) { 
                a[i].lowPass.frequency.value = a[i].frequency*4; 
            });
        })
    );
    
   
    
    
    
    var randMute = 0;
    var randMuteTime = 0;
    var randMuteWorker = new Worker('metWorker.js');
    
    function randMuteStart() { //start incrementing the random mute value (if a time was entered).
        randMute = 0;
        randMuteWorker.postMessage({'s':'start', 't':'100'})
        randMuteWorker.n = 0;
    }
    randMuteWorker.onmessage = function() { //increment every second.
        randMuteWorker.n++;
        randMute = randomMute.val()/100 / (randMuteTime * 10) * randMuteWorker.n;
        
        if(randMute*100 >= randomMute.val()) {
            randMute = randomMute.val()/100;
            randMuteWorker.postMessage({'s':'stop'});
            randMuteWorker.n = 0;
            return;
        }
        if(!started) {
            randMuteWorker.postMessage({'s':'stop'});
            randMuteWorker.n = 0;
            randMute = randomMute.val()/100;
        }
    };
    
    var setMuteOn = false;
    var muteStart = 0; //seconds before we start muting
    var muteEnd = 0; //seconds after which we stop muting
    
    function setMuteStop() { 
        setMuteOn = false;
    }
    
    
    function parseBeat(str) { //convert the input string to an array of integers. Sorta like eval() but for basic math operations.
        var add = /[+-]/g;
        var mult = /[\/\*]/g;
        var parsedBeat = [];
        str = str.replace(/[!].*?[!]/g, ''); //escape comments.
        str = str.replace(/\[\s*\[/g, '[0,['); //need to insert 0's between closley nested reps
        str = str.replace(/\]([^,]+)\]/g, ']$1,0]'); //same as above but for the closing bracket.
        str = str.replace(/x/gi, '*'); //option to use 'x' for multiplication.
        var cells = str.split(','); //beat values are seperated by commas.
        for (var i in cells) {
            if (cells[i].search(/@/) != -1) { //if theres a pitch modifier
                var pitch = cells[i].match(/@[A-Ga-g]?[b#]?\d+/)[0].slice(1);
                pitch = Metronome.getFreq(pitch);
                cells[i] = cells[i].replace(/@[A-Ga-g]?[b#]?\d+/, '');
            }
            if (cells[i].search(/\[/) != -1) { //if this cell has a [ to initiate multi-cell [] repeating
                if(!repStart) var repStart = [];
                repStart.push(parsedBeat.length);
                cells[i] = cells[i].slice(cells[i].search(/\[/)+1);
            }
            if (cells[i].search(/\]/) != -1) { //if this cell ends a multi-cell repeat
                var repTimes = parseInt(cells[i].match(/\]\(?(\d+)\)?/)[1]);
                if (cells[i].search(/\]\w*\(/) != -1) {
                    var repLast = cells[i].match(/\]\((\d+)\)(.*)/)[2]; //modifier for the last iteration
                }
                cells[i] = cells[i].slice(0, cells[i].search(/\]/)); //make the cell parse-able.
            }
            if (cells[i].search(/\((\d+)\)(.*)/) > 0) { //if this cell has () for single cell repeating
                var repeat = parseInt(cells[i].match(/\((\d+)\)(.*)/)[1]); //number of times to repeat
                var last = cells[i].match(/\((\d+)\)(.*)/)[2]; //modifier for last time.
                cells[i] = cells[i].slice(0, cells[i].search(/\(/)); //take out the repeat tag.
            }
            var result = 0;
            var terms = [cells[i]];
            if(cells[i].match(add) != null && cells[i].match(mult) != null)
                terms = cells[i].split(add); // if this beat cell has both +/- and *,/ operations, we need to deal with the *,/ first
            for (var p=0; p<terms.length; p++) {
                if(terms[p].match(mult) != null) { //if the beat cell has *,/ operation(s).
                    var ops = terms[p].split(mult);
                    result = parseFloat(ops[0]);
                    for (var o=0; o<ops.length-1; o++) {
                        switch (mult.exec(terms[p])[0]) {
                            case '\*':
                                result *= parseFloat(ops[o+1]);
                                break;
                            case '\/':
                                result /= parseFloat(ops[o+1]);
                                break;
                        }
                    }

                    terms[p] = result; //we have now reduced the *,/ operation to an integer.       
                }
                mult.lastIndex = 0;
            }
            if (result != 0) {
                var x = add.exec(cells[i]); //if the beat cell contains both operator types and was
                var y = 0;//                  split by add earlier, we now reinsert the +,- operator(s).
                result = terms[y++];

                while(x != null) {
                    switch (x[0]) {
                        case '+':
                            result = result + '+' + terms[y++];
                            break;
                        case '-':
                            result = result + '-' + terms[y++];
                            break;
                    }
                    x = add.exec(cells[i]);
                }

                if (y>1) terms = [result];
                add.lastIndex = 0;
            }

            for (var p in terms) { //finally, we do the +/- calculations.
                if(terms[p].match) { //if its a string...
                    var ops = terms[p].split(add);
                    result = parseFloat(ops[0]);
                    for (var o=0; o<ops.length-1; o++) {
                        switch (add.exec(terms[p])[0]) {
                            case '+':
                                result += parseFloat(ops[o+1]);
                                break;
                            case '-':
                                if (ops[o] == '') {
                                    result = '-' + ops[o+1];
                                    break;
                                }
                                result -= parseFloat(ops[o+1]);
                                break;
                        }
                    }
                }
            }
            if (terms.length === 1) {
                if(pitch) { //if theres a pitch component
                    cells[i] = new Array(parseFloat(result), pitch);
                    pitch = undefined;
                }else cells[i] = parseFloat(result); //if the beat cell has been reduced to a single number, we're done!
                if (repeat) { //if this cell is to be repeated.
                    for (var p =0; p<repeat-1; p++)
                        if(Array.isArray(cells[i])) parsedBeat.push(cells[i].slice(0)); //clone if array.
                        else parsedBeat.push(cells[i]);
                    if (last.search(/\d/) != -1){ //if theres a modifier on the final rep.
                        last = '0' + last; //account for a negative value
                        if(Array.isArray(cells[i])) { //check if its pitch modified
                            cells[i][0] += parseBeat(last)[0];
                            parsedBeat.push(cells[i]);
                        }else parsedBeat.push(cells[i] + parseBeat(last)[0]);
                    }else parsedBeat.push(cells[i]);
                    last = undefined;
                    repeat = undefined;
                }else parsedBeat.push(cells[i]);
                if (repTimes) { //if a multi-cell repeat needs to be executed.
                    var len = repStart.length-1; //get innermost nested repeat.
                    var repStop = parsedBeat.length -1;
                    for(var h=1; h<repTimes; h++)
                        for(var p=repStart[len]; p<=repStop; p++) {
                            if(Array.isArray(parsedBeat[p])) parsedBeat.push(parsedBeat[p].slice(0)); //we have to clone any arrays.
                            else parsedBeat.push(parsedBeat[p]);
                        }
                    repStart.pop(); //in case of nested repeats, get next outer rep.
                    if (repLast && (repLast.search(/\d/) != -1)) { //if modifier on the final rep
                        repLast = '0' + repLast;
                        if(Array.isArray(parsedBeat[parsedBeat.length-1])) { //check if its pitch modified
                            parsedBeat[parsedBeat.length-1][0] += parseBeat(repLast)[0];
                        }else parsedBeat[parsedBeat.length-1] += parseBeat(repLast)[0];
                    }
                    repTimes = undefined;
                    repLast = undefined;
                }
            }
            add.lastIndex = 0;
        }
        return parsedBeat; //return the array of beat cells.
    }
    
    
    function Metronome() { //metronome constructor
        var _this = this;
        this.n = 0; //used as an index value for the beat array.
        this.beat = [1]; //an array of beat cells
        this.offSet = 0; //offset the starting time
        
        this.gain = context.createGain(); //met volume
        this.gain.gain.value = .6;
        this.muteSwitch = context.createGain(); //allows for chrome friendly muting of layers.
        
        if(!mobile && context.createStereoPanner) { //create the pan node if not mobile or safari.
            this.pan = context.createStereoPanner();
            this.pan.pan.value = 0;
            this.pan.connect(this.gain);
        }
        if(mobile || !context.createStereoPanner) this.pan = this.gain; //safari doesn't support the pan node.
        
        this.analyser = context.createAnalyser() || context.webkitcreateAnalyser(); //used for the visual pulse effect.
        this.analyser.fftSize = 32;
        this.analyser.smoothingTimeConstant = .3;
        this.dataArray = new Uint8Array(this.analyser.frequencyBinCount);
        this.analyser.connect(this.pan);
        this.valve = context.createGain();
        this.valve.connect(this.analyser);
        
        this.lowPass = context.createBiquadFilter() || context.webkitcreateBiquadFilter();
        this.lowPass.type = 'lowpass';
        if(simpleBeep) this.lowPass.frequency.value = 440;
        else this.lowPass.frequency.value = 440*4;
        this.lowPass.Q.value = 1;
        this.lowPass.connect(this.analyser);
        
        this.gain.connect(this.muteSwitch);
        this.muteSwitch.connect(gain);
        //else this.gain.connect(gain);
        
        this.time = 0; //holds the time at which schd() is called.
        this.startTime = 0; //holds the start time of the next note.
        this.osc; //oscillator
        var initFreq = metronomes.length ? Metronome.randNote() : 'A4';  //generate a random frequency to assign as the initial pitch.
        this.frequency = Metronome.getFreq(initFreq); //pitch of the beep in hertz.
        this.soloed = false;
        this.muted = false;
        this.cutoff = (1/this.frequency)*20; //get 20 periods of the sine wave as a cutoff point to reduce popping.
        
        this.div = $('<div>').insertBefore(graphDiv).addClass('met').fadeOut(0).fadeIn(240); //main layer element
        
        this.beatTxtWidth = $('<div>', {css: { //this div is used to expand the inputBeat field to it contents size
            //maxWidth: this.div.width() - 60, 
            minWidth: '137px', 
            position: 'absolute', 
            right: '-20px', 
            bottom:'-20px', 
            display: 'none', 
            fontFamily: 'monospace',
            fontSize: '1em'
        }}).appendTo(document.body);
        
        this.beatInput = $('<input>').css('width', '137px').css('fontFamily', 'monospace').css('fontSize','1em').attr('type', 'text').change(function() { //the beat input
            if(Metronome.validate(this.value)) {//validate input.
                this.classList.remove('error');
                _this.beat = parseBeat(this.value);
            }
            else this.classList.add('error');
            //_this.beat.forEach(function(x,i,a) { a[i] = Math.abs(a[i]) }); //negative beat values throw an error
            $(_this.beatInput).trigger('input');
        }).on('input', function() {
            $(_this.beatTxtWidth).text($(_this.beatInput).val());
            $(_this.beatInput).width($(_this.beatTxtWidth).width());
            if ($(_this.beatTxtWidth).width() > $(_this.div).width() -50) $(_this.beatInput).width($(_this.div).width() -50);
        }).val('1');
        $('<span>').append('Beat:').append(_this.beatInput).appendTo(_this.div);
        
        this.pitchInput = $('<input>').attr('type', 'text').css( //the beep frequency
            'width', '25px').attr('value', initFreq).change(function() {
            if(Metronome.validate(this.value, _this.instr[0]?'detune':'pitch'))
                this.classList.remove('error');
            else this.classList.add('error');
            _this.frequency = Metronome.getFreq(this.value) || 440; //get freq from note name.
            _this.cutoff = (1/_this.frequency)*20; //calculate the cutoff time.
            if(simpleBeep) _this.lowPass.frequency.value = _this.frequency;
            else _this.lowPass.frequency.value = _this.frequency*4;
        });
        
        this.instr = [false, 'pitch', 'A4', '0']; //whether or not an instrument sample is being used.
        this.instrInput = $('<select>').val('pitch').append(
            [$('<option>').html('<b>Pitch</b>').attr('value', 'pitch'),
            $('<optgroup>').attr('label','----------------------------')]
        ).change(function() {
            _this.instr[1] = this.value; 
            if (this.value != 'pitch') {
                if(!_this.instr[0]) _this.instr[2] = _this.pitchInput.val();
                _this.instr[0] = true;
                _this.pitchInput.val(_this.instr[3]);
                _this.pitchInput.trigger('change');
            }
            else {
                if(_this.instr[0])  _this.instr[3] = _this.pitchInput.val();
                _this.instr[0] = false;
                _this.pitchInput.val(_this.instr[2]);
                _this.pitchInput.trigger('change');
            }
        });
        InstrSamp.list.forEach(function(x,i,a) {
            var name = x.match(/^[A-Za-z]+/)[0];
            var group = $('<optgroup>').attr('label', x);
            $(_this.instrInput).append(group);
            var counter = 1;
            InstrSamp.array.forEach(function(x,i,a) {
                if(x.substr(0,name.length) == name) {
                    var s = '&nbsp;';
                    if (i<9) s = '&nbsp;&nbsp;';
                    if(i>0 && x.replace(/\d+$/,'') == a[i-1].replace(/\d+$/,''))
                        counter++; //replace the V value with a more readable #.
                    else counter = 1;
                    x = x.replace(/_/g, ' ');
                    x = x.replace(/\d+$/, counter);
                    group.append(
                        $('<option>').html(i+1+'.'+s+x).attr('value', i)
                    );
                }
            });
        });
        
        
        $('<span>').append('Src:').append(_this.instrInput).append(_this.pitchInput).appendTo(_this.div);
        
        this.gainInput = $('<input>').attr('type', 'text').css( //volume
            'width', '21px').attr('value', Math.floor(_this.gain.gain.value*10)).change(function() {
            if(Metronome.validate(this.value,'volume')) {
                _this.gain.gain.value = this.value/10;
                this.classList.remove('error');
            }
            else this.classList.add('error');
            if(parseFloat(this.value) < 0) this.value = '0';
            if(parseFloat(this.value) > 10) this.value = '10';
        });
        $('<span>').append('Volume:').append(_this.gainInput).appendTo(_this.div);
        
        this.offsetInput = $('<input>').attr('type', 'text').css( //offset
            'width', '40px').attr('value', _this.offSet).change(function() {
            if(Metronome.validate(this.value,'offset')) {
                _this.offSet = parseBeat(this.value);
                this.classList.remove('error');
            }else this.classList.add('error');
            //_this.lowPass.Q.value = this.value;
            if (this.value === '') _this.offSet = 0;
        });
        $('<span>').append('Offset:').append(_this.offsetInput).appendTo(_this.div);
        
        $('<button>', {text: 'X'}).appendTo(_this.div).addClass('close').click(function() { //delete layer
            var x = _this.div.outerHeight()/2 + parseFloat(mets.style.marginTop.slice(0,-2));
            _this.stop();
            _this.div.animate({
                height: 'hide', padding: 'hide'},{queue:false, duration:240}).delay(0, function() {
                $(mets).animate({'marginTop': x+1}, 240);
                //$(window).trigger('resize');
            });
            if ((metronomes.filter(function(x) { return x.soloed })).length == 1 && _this.soloed) //if this was the only soloed track
                metronomes.forEach(function(x,i,a) { if (!a[i].muted) a[i].muteSwitch.gain.value = 1; }); //unmute all.
            metronomes.splice(metronomes.indexOf(_this), 1);
            if(!mobile && context.createStereoPanner) setPan();
            if (metronomes.length == 0) stop();
        });
        
        $('<button>', {text: 'S'}).appendTo(_this.div).addClass('solo').click(function() { //solo button
            if (metronomes.some(function(x) { return x.soloed })) { //if any layers are soloed
                if ((metronomes.filter(function(x) { return x.soloed })).length == 1 && _this.soloed) { //if this is the only soloed layer
                    _this.soloed = false;
                    $(this).css({
                        color: '#667587',
                        fontWeight: 'normal'
                    });
                    metronomes.forEach(function(x,i,a) { if (!a[i].muted) a[i].muteSwitch.gain.value = 1; }); //unmute all that are not 'muted'.
                    return;
                }
                if (!_this.soloed) { //if another layer is soloed, add this to the soloed group
                    if (!_this.muted) _this.muteSwitch.gain.value = 1; //unmute if not 'muted'.
                    $(this).css({
                        color: 'chartreuse',
                        fontWeight: 'bolder'
                    });
                    _this.soloed = true;
                    return;
                }
                if (_this.soloed) { //if this and some other layer are soloed, take this out of the soloed group.
                    //_this.gain.disconnect();
                    _this.muteSwitch.gain.value = 0;
                    $(this).css({
                        color: '#667587',
                        fontWeight: 'normal'
                    });
                    _this.soloed = false;
                    return;
                }
            }else{ //this will become the only soloed layer.
                _this.soloed = true;
                $(this).css({
                    color: 'chartreuse',
                    fontWeight: 'bolder'
                });
                for (var i =0; i<metronomes.length; i++) {
                    if (!metronomes[i].soloed) {
                        //metronomes[i].gain.disconnect(); //mute all other layers.
                        metronomes[i].muteSwitch.gain.value = 0;
                    }
                }
            }
        });
        
        $('<button>', {text: 'M'}).appendTo(_this.div).addClass('mute').click(function() { //the mute button
            if (!_this.muted) { //if its not muted, mute it.
                //_this.gain.disconnect();
                _this.muteSwitch.gain.value = 0;
                _this.muted = true;
                $(this).css({
                    color: 'orange',
                    fontWeight: 'bolder'
                });
                return;
            }
            if (_this.muted && _this.soloed) { //if its muted and soloed, we mute.
                //_this.gain.connect(gain);
                _this.muteSwitch.gain.value = 1;
                _this.muted = false;
                $(this).css({
                    color: '#667587',
                    fontWeight: 'normal'
                });
                return;
            }
            if (_this.muted && metronomes.some(function(x) { return x.soloed })) { //if its muted, not soloed, and another layer is soloed, change property but stay muted.
                _this.muted = false;
                $(this).css({
                    color: '#667587',
                    fontWeight: 'normal'
                });
                return;
            }else{ //if this layer is muted and no other layers are soloed, unmute.
                _this.muted = false;
                //_this.gain.connect(gain);
                _this.muteSwitch.gain.value = 1;
                $(this).css({
                    color: '#667587',
                    fontWeight: 'normal'
                });
            }
        });
        
        if (metronomes.some(function(x) { return x.soloed })) { //if any layers are soloed, add this layer to soloed group.
            //this.gain.disconnect();
            this.muteSwitch.gain.value = 0;
        }
        
        if (mets.style.marginTop.slice(0,-2) > 0) { //don't let the top go outside of the document.
            mets.style.marginTop = ($(window).innerHeight()/2 - mets.offsetHeight/2) + 'px'; //reposition the mets div after adding a new metronome.
        }
    }
    
    Metronome.validate = function(str,type) { //check various inputs for syntax errors.
        str = str.replace(/[!].*?[!]/g, ''); //escape comments.
        var message = '';
        var errors = [];
        var beat = [
            [/\)[^,\]@]*\(|\)[^,@]*[a-z]+[^,]*/, 'Invalid final repeat modifier.'],
            [/\(\d*[^\d)]+\d*\)|\(\)/, 'The number of repeats must be an integer.'],
            [/\][^\d(]|\]$/, 'Missing \'n\' value for multi-cell repeat.'],
            [/,$|,\s*,|^,|^$/, 'Empty beat cell.'],
            [/^\[?\D+,|,\[?\D+,|,[^,\d\s]+$|\d[a-wyzA-WYZ]|[+\-*xX/][^\d.]|[^\d).\s]$|\D\.\D|\D\.$|\.\d+\./, 'Invalid beat cell value.'],
            [/@[^a-gA-G\d]|@[a-gA-G]?[b#]?$|@[a-gA-G][^#b\d]/, 'Invalid pitch assignment using \'@\'.']
        ];
        var pitch = [
            [/^\D+$/],
            [/[^a-gA-G\d#]/],
            [/\d[a-z]/i],
            [/^[^a-gA-G\d]/],
            [/^[a-gA-G][^#b\d]/],
            [/^$/]
        ];
        var volume = [
            [/[^\d.]/]
        ];
        var offset = [
            [/[^\d+\-/*xX.]/],
            [/^[^\d\-.]/],
            [/\D$/]
        ];
        var detune = [
            [/[^\d.\-+]/],
            [/.*\..*\./],
            [/^[^+\-\d.]/]
        ]
        switch(type) {
            case 'beat':
                errors = beat;
                break;
            case 'pitch':
                errors = pitch;
                break;
            case 'volume':
                errors = volume;
                break;
            case 'offset':
                errors = offset;
                break;
            case 'detune':
                errors = detune
                break;
            default:
                errors = beat;
        }
        
        if(errors.some(function(x){return str.search(x[0]) > -1;})) {
            errors.forEach(function(x){
                if(str.search(x[0]) > -1)
                    if(x[1]) message += '- ' + x[1] + '\n';
            });
            if(message) msg('<u>The following syntax errors were found:</u>\n' + message,false,true);
            return false;
        }
        return true;
    }
    
    Metronome.getFreq = function(pitch) { //utility for converting notes to frequency in hertz
        var note = pitch.match(/[A-Ga-g]?[b#]?/)[0].toLowerCase(); //get the note name
        if(note == '') return pitch; //return raw pitch numbers.
        var octave = parseFloat(pitch.match(/\d+/))-1; //get octave number
        var noteConv = {
            'a':12, 'a#':13, 'bb': 13, 'b':14, 'c':3,
            'c#':4, 'db':4, 'd':5, 'd#':6, 'eb':6,
            'e':7, 'f':8, 'f#':9, 'gb':9, 'g':10,
            'g#':11, 'ab':11
        };
        note = noteConv[note];
        octave = Math.pow(2,octave);
        note = Math.pow(1.059463,note);
        return ((275*octave*note)/10).toFixed(3);
    }
    
    Metronome.randNote = function() { //generate a note based on the other notes present.
        do {
            var a; //the note name
            var d; //octave
            if(Math.random() >.5) d=5; //determine octave
            else d=4;
            var notes = ['A','A#','B','C','C#','D','D#','E','F','F#','G','G#'];
            var intervals = [3,4,5,7,8,9] //sonorous intervals
            if((Math.random() <.8) && metronomes[metronomes.length-1].pitchInput.val().search(/\D+/) != -1) { //80% chance to select a sonorous interval.
                a = notes.indexOf(metronomes[metronomes.length-1].pitchInput.val().match(/\D+/)[0])+intervals[Math.floor(Math.random()*6)];
                if(a>11) a -=12;
                a = notes[a];
            }
            else a = notes[Math.floor(Math.random()*12)]; //otherwise pick a random note.
        }while (metronomes.some(function(x){return x.pitchInput.val()==a+d;}) && metronomes.length<24); //don't repeat pitches.
        return a+d;
    }
    
    Metronome.stringifyBeat = function(metronomes) { //returns a beat as JSON string for saving/exporting.
        var result = [];
        for (var i = 0; i<metronomes.length; i++) {
            var obj = {};
            if(Metronome.validate(metronomes[i].beatInput.val(), 'beat') &&
               Metronome.validate(metronomes[i].pitchInput.val(), metronomes[i].instr[0]?'detune':'pitch') &&
               Metronome.validate(metronomes[i].gainInput.val(), 'volume') &&
               Metronome.validate(metronomes[i].offsetInput.val(), 'offset')) {
                obj['beat'] = metronomes[i].beatInput.val();
                obj['instr'] = metronomes[i].instrInput.val();
                obj['pitch'] = metronomes[i].pitchInput.val();
                obj['gain'] = metronomes[i].gainInput.val();
                obj['offset'] = metronomes[i].offsetInput.val();
                result.push(obj);
            }else{
                msg('This beat contains errors and could not be saved/exported.',false,true);
                return false;
            }
        }
        return JSON.stringify(result);
    }
    
    Metronome.reviveBeat = function(beat) { //import a beat from a JSON encoded beat.
        beat = $.parseJSON(beat);
        for (var i in beat) {
            var orig = beat[i]
            var nome = new Metronome()
            metronomes.push(nome);
            nome.beatInput.val(orig.beat).triggerHandler('change');
            nome.instrInput.val(orig.instr||'pitch').triggerHandler('change');
            nome.pitchInput.val(orig.pitch).triggerHandler('change');
            nome.gainInput.val(orig.gain).triggerHandler('change');
            nome.offsetInput.val(orig.offset).triggerHandler('change');
            nome.instr[2] = Metronome.randNote();
            nome.instr[3] = '0';
        }
        setPan();
        $(window).trigger('resize');
    }
    
    Metronome.prototype.start = function() {
        var _this = this;
        this.startTime = time;
        this.n = 0;
        this.valve = context.createGain();
        this.valve.connect(this.analyser);
        this.schd();
        if(visPulse)this.visualizer();
    }
    
    Metronome.prototype.stop = function() {
        this.n = 0;
        this.valve.disconnect(); //a way to stop instr samples.
        
        //this.valve.gain.value = 0;
    }
    
    Metronome.prototype.visualizer = function() { //creates the visual pulse effect
        var div = this.div.get(0); //avoid using any jquery methods within an animation.
        var _this = this; //put 'this' in the closure.
        this.analyser.smoothingTimeConstant = this.instr[0]?.5:.3;
        if(this.instr[0]) {
            this.analyser.minDecibels = -79; //makes instrument samples visuals more concise.
        }
        function vis() {
            _this.analyser.getByteFrequencyData(_this.dataArray); //used to create the blinking.
            var perc = _this.dataArray[0]-(_this.instr[0]?150:230); //-230 to make the blink shorter. drum sounds use 150
            if(perc<0) perc = 0;
            div.style.background = 'linear-gradient(to right, #BECCD6 0%,#acbece '+ (perc/(_this.instr[0]?105:25)*40) +'%,#acbece '+ (100-perc/(_this.instr?105:25)*40) +'%,#BECCD6 100%)'; //#B3C8D8
            if((perc === 0 && !started) || (perc === 0 && !visPulse)) return;
            requestAnimationFrame(vis);
        }
        vis();
    }
    
    Metronome.prototype.schd = function(e) { //schedules the notes ahead of time. this function is called every 25 ms while playing.
        this.time = context.currentTime;
        var offset = this.offSet*60/tempo;
        while (this.startTime - this.time < lookAhead - offset) {
            if (this.n >= this.beat.length) this.n = 0; //loop the beat.
            if (Array.isArray(this.beat[this.n])) { //check if its pitch modified
                if(!this.instr[0]) {
                    var freq = parseFloat(this.beat[this.n][1]).toFixed(2);
                    var beat = this.beat[this.n][0];
                    var _lowPass = context.createBiquadFilter() || context.webkitcreateBiquadFilter(); //we need a special LP for the diff pitch.
                    _lowPass.type = 'lowpass'
                    _lowPass.Q.value = 1;
                    _lowPass.connect(this.analyser);
                    if(simpleBeep) {
                        var _cutoff = (1/freq)*20;
                        _lowPass.frequency.value = freq;
                        var _gainDecay = context.createGain(); //this fixes a bug in chrome.
                        _gainDecay.gain.value = 1;
                        _gainDecay.connect(_lowPass);
                        _gainDecay.gain.setTargetAtTime(0, this.startTime + offset + _cutoff+.07, 0||0.0009); //cuts off a pop. 0 throws error in firefox
                    }else _lowPass.frequency.value = freq*4;
                }else{ //if its an instrument with @ modifier.
                    var instr = (parseInt(this.beat[this.n][1])-1).toString(); //make it string so '0' is possible.
                    var beat = this.beat[this.n][0];
                }
            }
            if (setMuteOn && this.startTime+offset >= muteEnd) {
                muteStart = muteEnd + setMuteTime1;
                muteEnd = muteEnd + setMuteTime1 + setMuteTime2;
            }
            if (this.beat[this.n]!=0 && (!setMuteOn || !(this.startTime+offset>=muteStart))) {
                if (randMute === 0 || Math.random() > randMute) {
                    var that = this;
                    if(!this.instr[0]) {
                        this.osc = context.createOscillator();
                        this.osc.frequency.value = freq || this.frequency;
                        if (!simpleBeep) {  //the standard chime sound
                            var gainDecay = context.createGain();
                            gainDecay.gain.value = 1;
                            gainDecay.connect(_lowPass || this.lowPass);
                            gainDecay.gain.setTargetAtTime(0, this.startTime+offset+.13, .045); //.04 also sounds pretty good.
                            this.osc.connect(gainDecay);
                            this.osc.start(this.startTime + offset+.07);
                            this.osc.stop(this.startTime + offset+.37);
                            delete gainDecay;
                            delete this.osc;
                        }else{ //plain tone.
                            this.osc.connect(_gainDecay || this.lowPass);
                            this.osc.start(this.startTime + offset+.07);
                            this.osc.stop(this.startTime + offset + (_cutoff+.37 || this.cutoff+.07)); //'cutoff' prevents popping.
                        }
                        if(_lowPass) {
                            delete _lowPass;
                            delete _gainDecay;
                        }
                    }else{ //if we're using instrument samples
                        this.osc = context.createBufferSource();
                        this.osc.buffer = samples.buffers[instr||this.instr[1]];
                        var x = parseInt(instr||this.instr[1]); 
                        if (samples.hiHatHit.indexOf(x) != -1) { //if its a hihat sound...
                            if (samples.hiHatPedal.indexOf(x) != -1) {
                                for(var x in InstrSamp.hiHatSrc) {
                                    if(InstrSamp.hiHatSrc[x] instanceof AudioBufferSourceNode){
                                        InstrSamp.hiHatSrc[x].stop(this.startTime + offset+.07); //stop all hi hat sounds on a hihat pedal down sound.
                                    }
                                }
                            }else{
                                InstrSamp.hiHatSrc.push(this.osc); //add all hihat sounds except pedal down
                                InstrSamp.hiHatSrc.shift();
                            }
                        }
                        
                        if (this.frequency != 0)
                            this.osc.detune.value = this.frequency; //detune by frequency value in cents
                        this.osc.connect(this.valve);
                        this.osc.start(this.startTime + offset+.07);
                        
                        
                        
                        if (this.beat[this.n]*60/tempo <= .274) //helps with wierd effects from a single sample repeating too quickly
                            if(!Array.isArray(this.beat[this.n+1]) && randMute === 0 && (((this.startTime+this.beat[this.n])*60/tempo)>muteStart))
                                this.osc.stop(this.startTime + offset+.07+(this.beat[this.n]*60/tempo));
                        /*InstrSamp.played.push(this.osc); //this is to allow cymbal sounds to stop precisely. Not sure if it will cause hangups.
                        InstrSamp.played.shift();*/
                        delete this.osc;
                    }
                }
            }
            this.startTime += (beat || this.beat[this.n]) * 60/tempo; //get start time of the next note.
            this.n++;
        }
    }
    
    var loadingCanvas = document.createElement('canvas'); //the loading bar for samples buffering.
    loadingCanvas.setAttribute('height', '150px'); //has to be 150px bc of chrome bug.
    var lc = loadingCanvas.getContext('2d');
    var loadingDiv = $('<div>').css({ //div that holds the canvas
        'position': 'relative',
        'width' : '100%',
        top : '20px',
        textAlign : 'center',
        margin : 0,
        zIndex : -1
    }).insertAfter(mets).append(loadingCanvas);
    
    function loaderProg(c, t) { //draw the loading bar
        var width = mets.offsetWidth*.70;
        loadingCanvas.setAttribute('width',width+'px');
        lc.strokeStyle = '#5C5C5C';
        lc.fillStyle = '#5C5C5C';
        lc.save();
        lc.scale(.75,1); //make it less rounded
        lc.lineCap = 'round';
        lc.lineWidth= 28;
        lc.beginPath();
        lc.moveTo(18,20);
        lc.lineTo(width*1.333-18,20); //draw outline
        lc.stroke();
        lc.globalCompositeOperation = 'destination-out';
        lc.lineWidth= 24;
        lc.beginPath();
        lc.moveTo(19,20);
        lc.lineTo(width*1.333-19,20);
        lc.stroke();
        lc.globalCompositeOperation = 'source-over';
        lc.lineWidth = 20;
        lc.beginPath();
        lc.moveTo(19,20);
        if(c) lc.lineTo(19+((width*1.333-38)*(c/t)),20); //draw progress bar
        lc.stroke();
        lc.restore();
        lc.font = "bold 12px serif";
        var text = 'Loading Drum Sounds... '+parseInt(c/t*100)+'%';
        txtWidth = lc.measureText(text).width;
        
        lc.globalCompositeOperation = "xor";
        
        lc.fillText(text,(width/2-txtWidth/2),24.5); //draw text.
        
        
        if (c == t) {
            loadingDiv.fadeOut(); //remove when done loading.
        }
    }
    
    if(location.search) { //if theres a query, we extract the beat from it
        var beat = decodeURI(location.href.slice(location.href.indexOf('?')+1));
        Metronome.reviveBeat(beat);
    }else{
        metronomes.push(new Metronome); //otherwise, add a default metronome.
        $(window).trigger('resize');
    }
    
    var samples = new InstrSamp(); //start buffering samples.
}