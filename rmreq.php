<?php
//this is an ajax script that returns a selector and token value to assign a 'remember me' cookie.
//only allow post reqs
if ($_SERVER['REQUEST_METHOD'] === 'POST' && isset($_POST['email'], $_POST['pass'])) {
    require './config.inc.php';
    require MYSQL;
    //get user's id
    $q = 'SELECT user_id, id FROM rm_tokens WHERE selector=?';
    $stmt = $dbc->prepare($q);
    if ($stmt->execute(array($_POST['email']))) {
        $row = $stmt->fetch(PDO::FETCH_NUM);
        $uid = $row[0];
        $cid = $row[1];
    }
    //fail if no id found
    if (empty($uid)) {
        echo 'fail';
        exit();
    }
    $stmt->closeCursor();
    //generate the selector
    $s = bin2hex(openssl_random_pseudo_bytes(6));
    $v = bin2hex(openssl_random_pseudo_bytes(6));
    $q = 'REPLACE INTO rm_tokens (id, user_id, token, selector, expires) VALUES (?, ?, ?, ?, DATE_ADD(NOW(), INTERVAL 31 DAY))';
    $stmt = $dbc->prepare($q);
    if ($stmt->execute(array($cid, $uid, hash('sha256', $v), $s))) {
        //send the selector and token
        echo $s . ',' . $v;
    }else echo 'fail';
}
?>