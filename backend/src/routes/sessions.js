import { Router } from "express";
import { logSession, getWeekDays } from "../controllers/sessions.js";

const router = Router();

router.post("/",    logSession);
router.get("/week", getWeekDays);

export default router;
