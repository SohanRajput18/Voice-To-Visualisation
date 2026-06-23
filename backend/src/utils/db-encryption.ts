import crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const SALT = 'vtov_salt_for_key_derivation';

// Derives a 32-byte key from the environment key
function getEncryptionKey(): Buffer {
  const secret = process.env.DB_ENCRYPTION_KEY || 'vtov_default_db_secure_secret_key_32_chars';
  // Standardize the key length to exactly 32 bytes using SHA-256
  return crypto.createHash('sha256').update(secret + SALT).digest();
}

/**
 * Encrypts cleartext using AES-256-GCM.
 * Returns formatted cipher text: "iv:authTag:encryptedContent"
 */
export function encrypt(text: string): string {
  try {
    const key = getEncryptionKey();
    const iv = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
    
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    const authTag = cipher.getAuthTag().toString('hex');
    
    return `${iv.toString('hex')}:${authTag}:${encrypted}`;
  } catch (error: any) {
    console.error('Encryption error:', error);
    throw new Error(`Credential encryption failed: ${error.message}`);
  }
}

/**
 * Decrypts cipher text back to cleartext.
 */
export function decrypt(encryptedText: string): string {
  try {
    const key = getEncryptionKey();
    const parts = encryptedText.split(':');
    
    if (parts.length !== 3) {
      throw new Error('Invalid encrypted format. Expected iv:tag:content');
    }
    
    const iv = Buffer.from(parts[0], 'hex');
    const authTag = Buffer.from(parts[1], 'hex');
    const encryptedContent = parts[2];
    
    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(authTag);
    
    let decrypted = decipher.update(encryptedContent, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
  } catch (error: any) {
    console.error('Decryption error:', error);
    throw new Error(`Credential decryption failed: ${error.message}`);
  }
}
