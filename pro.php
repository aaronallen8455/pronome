<?php
if($_SERVER['REQUEST_METHOD'] != 'POST') { //post is the only way to access.
    exit();
}

require 'config.inc.php';
require MYSQL;
//start session if not already started
if (session_status() === PHP_SESSION_NONE)
    session_start();

$c = file_get_contents('php://input');
$c = json_decode($c);

if($c->type === 'getBeat') { //send the beat json to pronome.
    //if not rememberMe
    if ($c->remembered === false) {
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
    }else if ($c->remembered === true) { //using rm cookie
        $sql = 'SELECT user_id, token FROM rm_tokens WHERE selector=? AND expires > NOW()';
        $stmt = $dbc->prepare($sql);
        $stmt->execute(array($c->email));
        if ($stmt->rowCount() === 1) {
            //check the token against cookie
            $row = $stmt->fetch(PDO::FETCH_ASSOC);
            if (hash_equals($row['token'], hash('sha256', $c->pass))) {
                //get beats for this user
                $sql = $dbc->query('SELECT beats FROM accounts WHERE id='.$row['user_id']);
                $beats = $sql->fetchColumn();
                echo $beats;
                //update the rm_token expiration
                $dbc->exec('UPDATE rm_tokens SET expiration=DATE_ADD(NOW(), INTERVAL 31 DAY) WHERE user_id='.$row['user_id']);
                //use the session to track this user for setBeat actions
                $_SESSION['id'] = $row['user_id'];
                exit();
            }
        }else exit('fail');
    }
}

else if($c->type === 'setBeat') { //update the db with user supplied beat collection.
    //if user is logged in via a remembered cookie:
    
    if (isset($_SESSION['id']) && filter_var($_SESSION['id'], FILTER_VALIDATE_INT, array('min_range'=>1))) {
        $sql = 'UPDATE accounts SET beats=? WHERE id=?';
        $stmt = $dbc->prepare($sql);
        $r = $stmt->execute(array($c->beat, $_SESSION['id']));
        
        if ($r) {
            exit ('success');
        }else {
            exit ('fail');
        }
    }else{ //if user is NOT logged in via a remembered cookie
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
}

/*else if($c->type === 'create') { //create a new account.
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
}*/

?>