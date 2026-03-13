import { Router } from "express";
import { logSession, getWeekDays, getCurrentStreak, getWeeklySummary } from "../controllers/sessions.js";

const router = Router();

router.post("/",    logSession);
router.get("/week", getWeekDays);
router.get("/streak", getCurrentStreak);
router.get("/weekly-summary", getWeeklySummary);

export default router;
