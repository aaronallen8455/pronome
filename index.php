<!DOCTYPE html>
<html>
<head>
    <title>ProNome</title>
    <meta name="viewport" content="user-scalable=no, initial-scale=1, maximum-scale=1, minimum-scale=1, width=device-width, height=device-height, target-densitydpi=device-dpi" />
    <link rel="stylesheet" type="text/css" href="metronome.css?<?php echo filemtime('metronome.css');?>" media="all" />
    <script src="jquery.js" type="text/javascript"></script>
    <script type="application/javascript" src="metronome.js?<?php echo filemtime('metronome.js');?>"></script>
    </head>
<body>
    <div id="mets">
        <span>ProNome</span>
        <div id="controls"><div id="controlWrap">
    <button id="new">Add Layer</button>
        <button id="start">Start</button>
        <button id="stop" style="margin-right:10px;">Stop</button>
        <span><button title="Tap Tempo" id="tapTempoEle"><u>Tempo</u></button>:<input type="number" value="120" id="tempo" style="border-width: 0px; width: 55px; box-shadow: 0 0px 0px;"></span>
        <span>Master Volume:<input type="text" value="5" id="mvol" style="width: 30px;"></span>
        <button id="moreOptns">[more]</button>
    </div></div></div>
    </body>
</html>