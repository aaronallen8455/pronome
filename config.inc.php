<?php

$host = substr($_SERVER['HTTP_HOST'], 0, 5);
if (in_array($host, array('local', '127.0', '192.1'))) { //determine if host is local or on the server.
    $local = true;
}else{
    $local = false;
}

if($local) {
    define('DSN', 'mysql:dbname=test;host=localhost');
    define('USER', 'root');
    define('PASS', '');
}else{//live
    define('DSN', 'mysql:dbname=pronzneu_pronome;host=localhost');
    define('USER', 'pronzneu_aaron');
    define('PASS', 'raybrown1');
}
