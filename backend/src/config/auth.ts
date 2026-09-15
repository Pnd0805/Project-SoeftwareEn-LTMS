import {env} from './env.js';

export const authConfig = {
    secret : env.JWT_SECRET,
    expireIn : Number(env.JWT_EXPIRES_IN)
};
