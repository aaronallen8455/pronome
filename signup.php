<! DOCTYPE HTML>
<html>
    <head>
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    </head>
    <body style="color:antiquewhite; background-color: #21262c;">
<?php
require 'config.inc.php';
if(isset ($_GET['h'])) {
    $hash = $_GET['h']; //the hashed email string
    //$dbc = new PDO(DSN,USER,PASS);
    require MYSQL;
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
        echo 'Your account has been successfully activated.';
    }else{
        echo 'Failed. Probably because an account already exists under that email';
    }
    
    $sql = "DELETE FROM pending WHERE hash=?"; //delete the entry in pending table.
    $stmt = $dbc->prepare($sql);
    $stmt->execute(array($hash));
    $dbc = null;
    exit;
    
}else if(isset ($_POST['email']) && isset ($_POST['pass'])) { //if we are pending/ sending email verification.
    $email = $_POST['email'];
    $pass = $_POST['pass'];
    $error;
    
    if(!preg_match('/.+@\w+\.\w+$/', $email)) { //validate email
        echo '<i style="color:red">Email must be in format: someone@example.com</i><br />';
        $error = true;
    }
    if(strlen($pass) < 3) { //validate password
        echo '<i style="color:red">Password must be at least 3 characters.</i><br />';
        $error = true;
    }
    if(isset ($error)) { //reprint the form if there was a user error.
        printForm();
        $dbc = null;
        exit;
    }
    
    $hash = $email >> 5;
    $hash = strrev($hash);
    $hash = sha1($hash);
    //$dbc = new PDO(DSN,USER,PASS);
    require MYSQL;
    $sql = 'SELECT id FROM accounts WHERE email=?';
    $stmt = $dbc->prepare($sql);
    $stmt->execute(array($email));
    if($stmt->rowCount() != 0) {
        $dbc = null;
        exit ('An account already exists using that email address. <a href="signup.php">Try again</a>.');
    }
    $sql = 'INSERT INTO pending (hash, email, pass) VALUES (?, ?, SHA1(?))';
    $stmt = $dbc->prepare($sql);
    if($stmt->execute(array($hash,$email,$pass))) {
        $from = "admin@pronome.net";
        $headers = "From: ProNome <$from>";
        $string = <<<EOT
Thank you for registering a new ProNome account! To activate your account, follow the link below:

http://www.pronome.net/signup.php?h=$hash

You may then log into your account.

Enjoy!
EOT;
        mail($email, 'ProNome Account Activation', $string, $headers, "-f " . $from);
        
        echo "An email has been sent to {$email}. Visit the link in the email to activate your account.";
    }
    $dbc = null;
    exit;
    
}else{ //print the form.
    printForm();
}
function printForm() {
    echo <<<EOT
To create an account, enter a valid email address and choose a password.<br /><br />

<form action="signup.php" method="POST">
<label for="email">Email:</label>
<input name="email" type="email" spellchecking="false" id="email"/><br />
<label for="pass">Password:</label>
<input name="pass" type="password" id="pass" style="margin-top:10px; margin-bottom:10px"/><br />
<input name="submit" type="submit" value="Create Account" />
</form>
<p style="font-size:small;">Note: Your email address will not be shared with anyone. Nor will you recieve 
junk mail from this site.</p>
EOT;
}

exit;
        ?>
    </body>
</html>
        