<?php

$host = substr($_SERVER['HTTP_HOST'], 0, 5);
if (in_array($host, array('local', '127.0', '192.1'))) { //determine if host is local or on the server.
    $local = true;
}else{
    $local = false;
}

if($local) {
    define('MYSQL', './mysql.inc.php');
}else{//live
    define('MYSQL', '../mysql.inc.php'); //SQL config is outside of webdir on live
}
