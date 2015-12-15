<?php
if($_SERVER['REQUEST_METHOD'] != 'POST') { //post is the only way to access.
    exit();
}

require 'config.inc.php';
require MYSQL;

$c = file_get_contents('php://input');
$c = json_decode($c);
/*
try { 
    $dbc = new PDO(DSN,USER,PASS);
}
catch (PDOException $e) {
    exit ('fail');
}*/

if($c->type === 'getBeat') { //send the beat json to pronome.
    $sql = 'SELECT beats FROM accounts WHERE email=? AND pass=SHA1(?)';
    $stmt = $dbc->prepare($sql);
    $stmt->execute(array($c->email,$c->pass));
    if ($stmt->rowCount() != 1) {
        exit('fail');
    }
    $beats = $stmt->fetch();
    $beats = $beats['beats'];
    $dbc = null;
    echo $beats;
    exit;
}

else if($c->type === 'setBeat') { //update the db with user supplied beat collection.
    $sql = 'UPDATE accounts SET beats=? WHERE email=? AND pass=SHA1(?)';
    $stmt = $dbc->prepare($sql);
    $r = $stmt->execute(array($c->beat, $c->email, $c->pass));
    $dbc = null;
    if($r) {
        exit ('success');
    }
    else {
        exit ('fail');
    }
}

else if($c->type === 'create') { //create a new account.
    $sql = 'INSERT INTO accounts (email, pass, beats) VALUES (?, SHA1(?), ?)';
    $stmt = $dbc->prepare($sql);
    $r = $stmt->execute(array($c->email, $c->pass, json_encode(null)));
    $dbc = null;
    if($r) {
        exit ('success');
    }
    else {
        exit ('fail');
    }
}

?>