import express from 'express';
import * as Reference from '../controllers/reference.controller.js';

const router = express.Router();

router.get('/faculties' , Reference.getAllFaculty);
router.get('/sport-types' , Reference.getAllSportType);

router.get('/faculties/:id/departments' , Reference.getDepartmentByFaculty);
router.get('/sport-types/:id/stat-definitions' , Reference.getStatDefinitionBySportType);


export default router;