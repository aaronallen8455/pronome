<?php
$host = substr($_SERVER['HTTP_HOST'], 0, 5);
if (in_array($host, array('local', '127.0', '192.1'))) {
    $local = true;
}else{
    $local = false;
}

$c = file_get_contents('php://input');
$c = json_decode($c);

if($local) {
    $dbc = new mysqli('localhost','root','','test');
}else{
    $dbc = new mysqli('pronome.net','aaron','raybrown','pronome');
}

if($c->type === 'login') {
    $sql = sprintf('SELECT beats FROM accounts WHERE 
    email="%s" AND 
    pass="%s"',
    $c->email,
    $c->pass);
    $r = $dbc->query($sql);
    if ($r->num_rows != 1) {
        exit('false');
    }
    $beats = $r->fetch_object();
    $beats = $beats->beats;
    header('Content-type: application/json');
    exit ($beats);
}

if($c->type === 'update') {
    $sql = sprintf('UPDATE accounts SET beats="%s" WHERE email="%s" AND pass="%s"',
                  $c->beats,
                  $c->email,
                  $c->pass);
    if ($r = $dbc->($sql)) {
        exit ('success');
    }else{
        exit ('fail');
    }
}
?>