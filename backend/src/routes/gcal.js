import { Router } from "express";
import { getAuthUrl, handleCallback, getStatus, disconnect, getEvents, addEvent } from "../controllers/gcal.js";

const router = Router();

router.get("/auth-url",    getAuthUrl);
router.get("/callback",    handleCallback);
router.get("/status",      getStatus);
router.delete("/disconnect", disconnect);
router.get("/events",      getEvents);
router.post("/add-event",  addEvent);

export default router;
