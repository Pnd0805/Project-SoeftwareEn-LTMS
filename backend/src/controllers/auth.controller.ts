import type { Response , Request } from 'express';
import * as authService from '../services/auth.service.js';

export async function register(req : Request , res : Response){
    res.status(201).json(await authService.register(req.body))
}

export async function login(req : Request , res : Response){
    res.status(200).json(await authService.login(req.body.email , req.body.password));
}

export async function logout(req : Request , res : Response){
    res.status(204).send();
}