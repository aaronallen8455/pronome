<! DOCTYPE HTML>
<html>
    <head>
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    </head>
    <body style="color:antiquewhite; background-color: #21262c;">
<?php
require 'config.inc.php';
//on form submit
$emailError = false;
if ($_SERVER['REQUEST_METHOD'] === 'POST' && !isset($_GET['t'])) {
    //validate email
    if (isset($_POST['email']) && filter_var($_POST['email'], FILTER_VALIDATE_EMAIL)) {
        $email = $_POST['email'];
        require MYSQL;
        $q = "SELECT id FROM accounts WHERE email=?";
        $stmt = $dbc->prepare($q);
        if ($stmt->execute(array($email)) && $uid = $stmt->fetchColumn()) {
            //generate random token string
            $token = openssl_random_pseudo_bytes(32);
            $token = bin2hex($token);
            //store token in DB
            $q = 'REPLACE INTO auth_tokens (user_id, token, expires)
            VALUES (?,?, DATE_ADD(NOW(), INTERVAL 15 MINUTE))';
            $stmt = $dbc->prepare($q);
            if ($stmt->execute(array($uid, $token)) && $stmt->rowCount() > 0) {
                //Send email with instructions and token link
                $from = "admin@pronome.net";
                $headers = "From: ProNome <$from>";
                $url = 'http://pronome.net/forgot.php?t=' . $token;
                $body = <<<EOT
This email is in response to a forgotten password reset request at ProNome. If you did make this request, click the following link to be able to reset your password:
$url
If you do not use this link to reset your password within 15 minutes, you'll need to request a password reset again.
If you have _not_ forgotten your password, you can safely ignore this message and you will still be able to login with your existing password.
EOT;
                mail($email, 'Password Reset Request', $body, $headers, '-f '.$from);
                //display the instruction message
                echo '<h3>Forgot your password?</h3><p>You will receive an access code via email. Click the link in that email to reset your password.</p>';
            }
        }else $emailError = true;
        exit();
    }else $emailError = true;
}
//token submitted
else if (isset($_GET['t']) && strlen($_GET['t']) === 64) {
    require MYSQL;
    //get associated user id.
    $q = "SELECT user_id FROM auth_tokens JOIN accounts ON user_id=id
    WHERE token=? AND expires > NOW()";
    $stmt = $dbc->prepare($q);
    if ($stmt->execute(array($_GET['t'])) && $row = $stmt->fetch(PDO::FETCH_ASSOC)) {
        if (!empty($row['user_id'])) { //user acct is active
            $uid = $row['user_id'];
        }else{
            echo '<h3>The supplied token has expired.</h3>
            You\'ll need to start the process over before you can reset your password.';
            exit();
        }
    }  
    //on pw change form submit
    $passError = false;
    if ($_SERVER['REQUEST_METHOD'] === 'POST' && isset($_POST['pass'])) {
        //validate password
        if (strlen($_POST['pass']) >= 3) {
            //change users password
            $pass = sha1($_POST['pass']);
            $q = "UPDATE accounts SET pass=? WHERE id=?";
            $stmt = $dbc->prepare($q);
            if ($stmt->execute(array($pass, $uid))) {
                //delete the token
                $dbc->exec('DELETE FROM auth_tokens WHERE user_id='.$uid);
                //delete any rm_tokens
                $dbc->exec('DELETE FROM rm_tokens WHERE user_id='.$uid);
                echo '<h3>Your password has been changed.</h3>';
                echo 'You are being redirected to ProNome.net';
                //redirect to pronome after 3 seconds
                ?>
        <script type="application/javascript">
        setTimeout(function() {
            window.location = 'http://pronome.net';
        }, 3000);
        </script>
        <?php
                
                exit();
            }
        }else $passError = true;
    }
    //display password change form
    ?>
        <h3>Reset Password</h3>
        Enter your new password:
        <form method="post" action="">
            <input type="password" name="pass" /><br />
            <input type="submit" value="Submit" />
        
        </form>
    <?php
    if ($passError) echo 'Your password must be at least 3 characters.';
    exit();
    
}
    ?>
<h3>Forgot your password?</h3>
Please enter your email, then click 'Submit.'<br><br>
<form method="post" action="forgot.php">
    <input type="text" name="email" placeholder="Email Address" />
    <?php
    if (!empty($emailError)) {
        echo '<br><i>You entered an invalid email address.</i><br>';
    }
    ?>
    <br><br>
    <input type="submit" value="Submit" />
</form>

    </body>
</html>