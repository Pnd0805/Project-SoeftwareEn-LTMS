import type {Request , Response } from 'express';
import * as Reference from '../services/reference.service.js';
import { parseId } from '../utils/parseId.js';


export async function getAllFaculty(req : Request , res : Response){
    res.status(200).json(await Reference.getFaculty());
}

export async function getDepartmentByFaculty(req : Request , res : Response){ 
    const facultyId = parseId(req.params['id'], 'รหัสคณะ');
    res.status(200).json(await Reference.getDepartmentByFaculty(facultyId));
}

export async function getAllSportType(req: Request , res : Response){
    res.status(200).json(await Reference.getSportType());
}

export async function getStatDefinitionBySportType(req : Request , res : Response){
    const sportTypeId = parseId(req.params['id'], 'รหัสกีฬา');
    res.status(200).json(await Reference.getStatDefinitionBySportType(sportTypeId));
}

