import { Router } from "express";
import { listNotes, getNote, createNote, updateNote, deleteNote } from "../controllers/notes.js";

const router = Router();

router.get("/",     listNotes);
router.get("/:id",  getNote);
router.post("/",    createNote);
router.patch("/:id", updateNote);
router.delete("/:id", deleteNote);

export default router;
