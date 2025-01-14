import to from "await-to-ts";
import createError from "http-errors";
import Category from "@models/categoryModel";
import { StatusCodes } from "http-status-codes";
import { NextFunction, Request, Response } from "express";
import fs from "fs";
import path from "path";
import { logger } from "@shared/logger";
import Cloudinary from "@shared/cloudinary";

const create = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
  const { title, categoryImageUrl } = req.body;

  if (!title || !categoryImageUrl)
    return next(createError(StatusCodes.BAD_REQUEST, "Category Title and Image is required"));

  const [error, category] = await to(Category.create({ title, categoryImage: categoryImageUrl }));
  if (error) return next(error);
  return res.status(StatusCodes.CREATED).json({ success: true, message: "Success", data: category });
};

const get = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
  const id = req.params.id;
  const [error, category] = await to(Category.findById(id).lean());
  if (error) return next(error);
  if (!category) return next(createError(StatusCodes.NOT_FOUND, "Category Not Found"));
  return res.status(StatusCodes.OK).json({ success: true, message: "Success", data: category });
};

const getAll = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
  const page = parseInt(req.query.page as string) || 1;
  const limit = parseInt(req.query.limit as string) || 10;
  const skip = (page - 1) * limit;

  const [error, categories] = await to(Category.find().select("title categoryImage").skip(skip).limit(limit).lean());
  if (error) return next(error);

  const total = categories.length;
  const totalPages = Math.ceil(total / limit);

  if (!categories)
    return res.status(StatusCodes.OK).json({
      success: true,
      message: "No Categories found",
      data: { categories: [], page, limit, total, totalPages },
    });
  return res
    .status(StatusCodes.OK)
    .json({ success: true, message: "Success", data: { categories, page, limit, total, totalPages } });
};

const getSubCategories = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
  const page = parseInt(req.query.page as string) || 1;
  const limit = parseInt(req.query.limit as string) || 10;
  const skip = (page - 1) * limit;

  const id = req.params.id;
  const [error, category] = await to(
    Category.findById(id)
      .populate({ path: "subCategories", select: "title subCategoryImage", options: { skip, limit } })
      .lean()
  );
  if (error) return next(error);
  if (!category) return next(createError(StatusCodes.NOT_FOUND, "Category not found"));

  const total = category.subCategories.length;
  const totalPages = Math.ceil(total / limit);
  if (total === 0)
    return res
      .status(StatusCodes.OK)
      .json({ success: true, message: "No Subcategory found", data: { category, page, limit, total, totalPages } });
  return res
    .status(StatusCodes.OK)
    .json({ success: true, message: "Success", data: { category, page, limit, total, totalPages } });
};

const update = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
  const id = req.params.id;
  const { title, categoryImageUrl } = req.body;

  if (!title && !categoryImageUrl) {
    return next(createError(StatusCodes.BAD_REQUEST, "Nothing to update"));
  }

  let error, category;
  [error, category] = await to(Category.findById(id));
  if (error) return next(error);
  if (!category) return next(createError(StatusCodes.NOT_FOUND, "Category Not Found"));

  if (categoryImageUrl) {
    // await Cloudinary.remove(category.categoryImage);
    category.categoryImage = categoryImageUrl;
  }
  category.title = title || category.title;
  [error] = await to(category.save());
  if (error) return next(error);

  return res.status(StatusCodes.OK).json({ success: true, message: "Success", data: category });
};

const remove = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
  const id = req.params.id;
  let error, category;

  [error, category] = await to(Category.findById(id));
  if (error) return next(error);
  if (!category) return next(createError(StatusCodes.NOT_FOUND, "Category Not Found"));

  if (category.categoryImage) {
    await Cloudinary.remove(category.categoryImage);
  }

  [error] = await to(Category.findByIdAndDelete(id));
  if (error) return next(error);

  return res.status(StatusCodes.OK).json({ success: true, message: "Success", data: {} });
};

const CategoryController = {
  create,
  getAll,
  get,
  getSubCategories,
  update,
  remove,
};

export default CategoryController;
