import express from "express";
import UserController from "@controllers/userController";
import { authorize, isAdmin } from "@middlewares/authorization";
import { handleFileUpload } from "@middlewares/uploadFile";

const router = express.Router();

router.post("/approve/:id", authorize, isAdmin, UserController.approve);
router.post("/block/:id", authorize, isAdmin, UserController.block);
router.post("/unblock/:id", authorize, isAdmin, UserController.unblock);
router.get("/all", authorize, UserController.getAllUsers);
router.get("/info", authorize, UserController.get);
router.put("/update", authorize, handleFileUpload, UserController.update);

export default router;
