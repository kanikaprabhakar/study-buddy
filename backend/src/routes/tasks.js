import { Router } from "express";
import { listTasks, createTask, updateTask, deleteTask, generateWeeklyPlan, confirmWeeklyPlan } from "../controllers/tasks.js";

const router = Router();

router.get("/",               listTasks);
router.post("/",              createTask);
router.post("/generate-plan", generateWeeklyPlan);
router.post("/confirm-plan",  confirmWeeklyPlan);
router.patch("/:id",          updateTask);
router.delete("/:id",         deleteTask);

export default router;
