<?php
$host = substr($_SERVER['HTTP_HOST'], 0, 5);

if (in_array($host, array('local', '127.0', '192.1'))) { //determine if host is local or on the server.
    $local = true;
}else{
    $local = false;
}
if($_SERVER['REQUEST_METHOD'] != 'POST') { //post is the only way to access.
    exit();
}
$c = file_get_contents('php://input');
$c = json_decode($c);

try { //establish DB connection
    if($local) {
        $dbc = new PDO('mysql:dbname=test;host=localhost','root','');
    }else{
        //echo gethostbyname('www.pronome.net');
        $dbc = new PDO('mysql:dbname=pronzneu_pronome;host=localhost','pronzneu_aaron','raybrown1');
    }
}
catch (PDOException $e) {
    //print_r($e);
    exit ('fail');
}

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