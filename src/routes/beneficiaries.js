import express from 'express';
import { authenticate } from '../middleware/auth.js';
import {
  getMyBeneficiaries,
  createOrUpdateBeneficiary,
  deleteBeneficiary
} from '../controllers/beneficiaryController.js';

const router = express.Router();

router.use(authenticate);

router.get('/my', getMyBeneficiaries);
router.post('/', createOrUpdateBeneficiary);
router.delete('/:beneficiaryId', deleteBeneficiary);

export default router;
