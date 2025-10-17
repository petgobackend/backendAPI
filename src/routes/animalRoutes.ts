import { Router } from 'express';
import * as animalController from '../controllers/animalController';
import upload from '../middlewares/upload';

const router = Router();

router.get('/', animalController.getAnimals);
router.get('/:id', animalController.getAnimalById);
router.post('/', upload.single('image'), animalController.createAnimal);
router.put('/:id', upload.single('image'), animalController.updateAnimal);
router.delete('/:id', animalController.deleteAnimal);

export default router;