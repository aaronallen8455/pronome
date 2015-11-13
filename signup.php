<?php
if(isset ($_GET['h'])) {
    $hash = $_GET['h']; //the hashed email string
    $dbc = new PDO('mysql:dbname=pronzneu_pronome;host=localhost','pronzneu_aaron','raybrown1');
    $sql = 'SELECT email,pass FROM pending WHERE hash=?';
    $stmt = $dbc->prepare($sql);
    $stmt->execute(array($hash));
    if ($stmt->rowCount() != 1) { //should return 1 row of data.
        exit('fail');
    }
    $data = $stmt->fetch();
    $email = $data['email'];
    $pass = $data['pass']; //hashed string
    
    $sql = 'INSERT INTO accounts (email, pass) VALUES (?, ?)'; //create the account
    $stmt = $dbc->prepare($sql);
    if($stmt->execute(array($email,$pass))) {
        echo 'successful';
    }else{
        echo 'Failed. possibly because an account already exists under that email';
    }
    
    $sql = "DELETE FROM pending WHERE hash=?"; //delete the entry in pending table.
    $stmt = $dbc->prepare($sql);
    $stmt->execute(array($hash));
    $dbc = null;
    exit;
    
}else if(isset ($_POST['email']) && isset ($_POST['pass'])) { //if we are pending/ sending email verification.
    $email = $_POST['email'];
    $pass = $_POST['pass'];
    $hash = $email >> 5;
    $hash = strrev($hash);
    $hash = sha1($hash);
    $dbc = new PDO('mysql:dbname=pronzneu_pronome;host=localhost','pronzneu_aaron','raybrown1');
    $sql = 'INSERT INTO pending (hash, email, pass) VALUES (?, ?, SHA1(?))';
    $stmt = $dbc->prepare($sql);
    if($stmt->execute(array($hash,$email,$pass))) {
        $from = "admin@pronome.net";
        $headers = "From: ProNome <$from>";
        $string = <<<EOT
Thank you for registering a new ProNome account! To activate your account, follow the link below:

http://www.pronome.net/signup.php?h=$hash

You may then log into your account using the following:

email: $email
password: $pass

Enjoy!
EOT;
        mail($email, 'ProNome Account Activation', $string, $headers, "-f " . $from);
        
        echo "An email has been sent to {$email}. Visit the link in the email to activate your account.";
    }
    $dbc = null;
    exit;
    
}else{ //print the form.
    echo <<<EOT
<form action="signup.php" method="POST">
<label for="email">Email:</label>
<input name="email" type="text" spellchecking="false" id="email"/>
<label for="pass">Password:</label>
<input name="pass" type="password" id="pass"/>
<input name="submit" type="submit" value="Submit" />
EOT;

}
exit;