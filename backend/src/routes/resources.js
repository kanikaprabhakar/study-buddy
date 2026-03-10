import { Router } from "express";
import { listResources, createResource, updateResource, deleteResource } from "../controllers/resources.js";

const router = Router();

router.get("/",       listResources);
router.post("/",      createResource);
router.patch("/:id",  updateResource);
router.delete("/:id", deleteResource);

export default router;
