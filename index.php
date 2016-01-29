<?php
header("Last-Modified: ".date('D, d M Y H:i:s T',filemtime('index.php')));
header("Expires: Mon, 26 Jul 1997 05:00:00 GMT");
header("Pragma: no-cache");
header("Cache-Control: no-cache");
?>
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
        <form action="https://www.paypal.com/cgi-bin/webscr" method="post" target="_top">
<input type="hidden" name="cmd" value="_s-xclick">
<input type="hidden" name="hosted_button_id" value="8BHER43CCWSNY">
<button name="submit" class="donateButton" title="Help keep ProNome alive! via PayPal">[Donate]</button>
</form>
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