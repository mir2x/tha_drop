"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const eventController_1 = __importDefault(require("../controllers/eventController"));
const authorization_1 = require("../middlewares/authorization");
const express_fileupload_1 = __importDefault(require("express-fileupload"));
const fileHandler_1 = __importDefault(require("../middlewares/fileHandler"));
const eventServices_1 = __importDefault(require("../services/eventServices"));
const EventRouter = express_1.default.Router();
EventRouter.post("/buy-ticket", authorization_1.authorize, eventServices_1.default.buyTicket);
EventRouter.post("/create", (0, express_fileupload_1.default)(), fileHandler_1.default, authorization_1.authorize, eventController_1.default.create);
EventRouter.get("/", eventController_1.default.getAll);
EventRouter.get("/:id", eventController_1.default.get);
EventRouter.put("/update/:id", (0, express_fileupload_1.default)(), fileHandler_1.default, authorization_1.authorize, eventController_1.default.update);
EventRouter.delete("/delete/:id", authorization_1.authorize, eventController_1.default.remove);
exports.default = EventRouter;
