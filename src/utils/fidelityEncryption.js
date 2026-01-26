import crypto from 'crypto';

/**
 * Encrypt data using Triple DES encryption for Fidelity API
 * @param {string} sharedKey - The encryption key (API secret)
 * @param {string} plainText - The text to encrypt
 * @returns {string} Base64 encoded encrypted text
 */
function encrypt(sharedKey, plainText) {
    try {
        const bufferedKey = Buffer.from(sharedKey, 'utf16le');
        const key = crypto.createHash('md5').update(bufferedKey).digest();
        const newKey = Buffer.concat([key, key.slice(0, 8)]);
        const IV = Buffer.alloc(8, '\0');
        
        const cipher = crypto.createCipheriv('des-ede3-cbc', newKey, IV);
        cipher.setAutoPadding(true);
        
        let encrypted = cipher.update(plainText, 'utf8', 'base64');
        encrypted += cipher.final('base64');
        
        return encrypted;
    } catch (error) {
        throw new Error(`Encryption failed: ${error.message}`);
    }
}

/**
 * Decrypt data using Triple DES decryption for Fidelity API
 * @param {string} sharedKey - The encryption key (API secret)
 * @param {string} encryptedText - The base64 encoded encrypted text
 * @returns {string} Decrypted plain text
 */
function decrypt(sharedKey, encryptedText) {
    try {
        const bufferedKey = Buffer.from(sharedKey, 'utf16le');
        const key = crypto.createHash('md5').update(bufferedKey).digest();
        const newKey = Buffer.concat([key, key.slice(0, 8)]);
        const IV = Buffer.alloc(8, '\0');
        
        const decipher = crypto.createDecipheriv('des-ede3-cbc', newKey, IV);
        decipher.setAutoPadding(true);
        
        let decrypted = decipher.update(encryptedText, 'base64', 'utf8');
        decrypted += decipher.final('utf8');
        
        return decrypted;
    } catch (error) {
        throw new Error(`Decryption failed: ${error.message}`);
    }
}

/**
 * Generate MD5 signature for Fidelity API
 * @param {string} requestRef - The unique request reference
 * @param {string} clientSecret - The API secret
 * @returns {string} MD5 hash signature
 */
function generateSignature(requestRef, clientSecret) {
    try {
        const signatureData = `${requestRef};${clientSecret}`;
        return crypto.createHash('md5').update(signatureData).digest('hex');
    } catch (error) {
        throw new Error(`Signature generation failed: ${error.message}`);
    }
}

/**
 * Generate a unique request reference
 * @returns {string} Unique request reference
 */
function generateRequestRef() {
    return `REQ-${Date.now()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;
}

export {
    encrypt,
    decrypt,
    generateSignature,
    generateRequestRef
};
