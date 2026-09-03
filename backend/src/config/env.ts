import 'dotenv/config';

function requireEnv(name:string):string {
    const value = process.env[name];
    if (!value){
        throw new Error("Missing require environment variable " + name);
    }

    return value;
};

export const env = {
    HOST : requireEnv("DB_HOST"),
    USER : requireEnv("DB_USER"),
    PASSWORD : requireEnv("DB_PASSWORD"),
    DB_PORT : Number(requireEnv("DB_PORT")),
    DB_NAME : requireEnv("DB_NAME"),

    JWT_SECRET : requireEnv("JWT_SECRET"),
    JWT_EXPIRES_IN : requireEnv("JWT_EXPIRES_IN"),

    PORT : Number(requireEnv("PORT"))
};