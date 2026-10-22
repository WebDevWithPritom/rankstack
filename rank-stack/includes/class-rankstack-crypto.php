<?php
if (!defined('ABSPATH')) {
    exit;
}

class RankStack_Crypto {

    private static function get_key() {
        if (defined('AUTH_KEY') && !empty(AUTH_KEY)) {
            return hash('sha256', AUTH_KEY, true);
        }
        return hash('sha256', wp_salt('auth'), true);
    }

    public static function encrypt($plain_text) {
        if (empty($plain_text)) return '';

        $key = self::get_key();
        $cipher = 'aes-256-cbc';
        $ivlen = openssl_cipher_iv_length($cipher);
        $iv = openssl_random_pseudo_bytes($ivlen);

        $ciphertext_raw = openssl_encrypt($plain_text, $cipher, $key, $options = OPENSSL_RAW_DATA, $iv);
        $hmac = hash_hmac('sha256', $ciphertext_raw, $key, true);

        return base64_encode($iv . $hmac . $ciphertext_raw);
    }

    public static function decrypt($cipher_text) {
        if (empty($cipher_text)) return '';

        $c = base64_decode($cipher_text);
        if (empty($c)) return '';

        $key = self::get_key();
        $cipher = 'aes-256-cbc';
        $ivlen = openssl_cipher_iv_length($cipher);
        $sha2len = 32;

        if (strlen($c) < ($ivlen + $sha2len)) {
            return '';
        }

        $iv = substr($c, 0, $ivlen);
        $hmac = substr($c, $ivlen, $sha2len);
        $ciphertext_raw = substr($c, $ivlen + $sha2len);

        $calcmac = hash_hmac('sha256', $ciphertext_raw, $key, true);
        if (hash_equals($hmac, $calcmac)) {
            return openssl_decrypt($ciphertext_raw, $cipher, $key, $options = OPENSSL_RAW_DATA, $iv);
        }

        return '';
    }
}
