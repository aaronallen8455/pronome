<?php

if($local) {
    define('DSN', 'mysql:dbname=test;host=localhost');
    define('USER', 'root');
    define('PASS', '');
}else{//live
    define('DSN', 'mysql:dbname=pronzneu_pronome;host=localhost');
    define('USER', 'pronzneu_aaron');
    define('PASS', 'raybrown1');
}

$dbc = new PDO(DSN,USER,PASS);