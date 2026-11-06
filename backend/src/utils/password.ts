import bcrypt from 'bcrypt';

const SALT_ROUND = 10;

export async function hashPassword(plain:string): Promise<string> {
    return bcrypt.hash(plain , SALT_ROUND);
}

export async function verifyPassword(plain:string , password_hash:string): Promise<boolean>{
    return bcrypt.compare(plain , password_hash);
}