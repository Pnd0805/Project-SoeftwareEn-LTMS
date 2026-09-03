import * as FacRepo from '../repositories/faculty.repo.js';
import * as SportRepo from '../repositories/sportType.repo.js';

import { toFacultyDto , toDepartmentDto , toSportTypeDto , toSportStatDefinitionDto} from '../mappers/reference.mapper.js';
import { AppError } from '../utils/AppError.js';

export async function getFaculty(){
    const faculty = await FacRepo.findAllFaculties();
    const data = faculty.map(toFacultyDto); 
    return { items : data };
}


export async function getDepartmentByFaculty(FacId : number){
    const faculty = await FacRepo.findFacultyById(FacId);
    if(!faculty){ //check if faculty exist
        throw new AppError(404 , "FACULTY_NOT_FOUND" , 'ไม่พบคณะนี้ในระบบ');
    }

    const department = await FacRepo.findDepartmentsByFaculty(FacId);
    const data = department.map(toDepartmentDto);

    return { items : data}
}

export async function getSportType(){
    const sportType = await SportRepo.findAllSportTypes();
    const data = sportType.map(toSportTypeDto);
    return { items : data };
}

export async function getStatDefinitionBySportType(sportTypeId : number){ 
    const sport = await SportRepo.findSportTypeById(sportTypeId);
    if(!sport){
        throw new AppError(404 , "SPORT_TYPE_NOT_FOUND" , "ไม่พบประเภทกีฬานี้ในระบบ");
    }

    const statDef = await SportRepo.findStatDefinitionsBySportType(sportTypeId);
    const data = statDef.map(toSportStatDefinitionDto);
    return { items : data};
}