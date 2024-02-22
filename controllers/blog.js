const { ObjectId } = require("bson");
const blogModel = require("../models/blog");
const { parseIncomingBodyData, parseFormData } = require("../utils");
const { getUser } = require("../service/auth");
const fs = require("fs");
const path = require("path");
const slugify = require("slugify");
const { ApiResponse } = require("../ApiResponse");

async function createBlog(req, res) {
    try {
        const { fields, files } = await parseFormData(req);
        if (!fields || !files) {
            res.writeHead(400);
            res.end("No form data or files found");
            return;
        }
        const { blogTitle, blogContent } = fields;
        const authHeader = req.headers["authorization"];
        if (!authHeader) {
            res.writeHead(400);
            res.end("Token not found");
            return;
        }
        const token = authHeader.split("Bearer ")[1];
        const verifyToken = await getUser(token);
        if (!verifyToken) {
            res.writeHead(400);
            res.end("Invalid token blog not created");
            return;
        }

        if (!blogTitle || !blogContent) {
            res.writeHead(400);
            res.end("Please provide all requirements");
            return;
        }

        const BlogTitle = String(blogTitle);
        const BlogContent = String(blogContent);
        const blogSlug = slugify(BlogTitle);

        const uploadDir = path.join(__dirname, "../public", "images");
        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
        }

        const file = files && files.image ? files.image[0] : null;
        // console.log(files.image[0]);
        if (file) {
            const imagePath = path.join(uploadDir, file.newFilename);
            const fileStream = fs.createWriteStream(imagePath);
            fileStream.on('error', (err) => {
                console.error("Error uploading file:", err);
                res.writeHead(500);
                res.end("Error uploading file");
            });
            fileStream.on('finish', async () => {
                await blogModel.createBlog(req, BlogTitle, BlogContent, imagePath, blogSlug);
                res.writeHead(200);
                const apiResponse = new ApiResponse(200, "", "blog created successfully!!");
                const metaTitle = "Welcome!";
                const metaDescription = "thank you for creating the blog"
                const responseBody = JSON.stringify({ ...apiResponse, blogSlug, metaTitle, metaDescription })
                res.end(responseBody);
            });
            req.pipe(fileStream);
        } else {
            await blogModel.createBlog(req, blogTitle, blogContent, null);
            res.writeHead(200);
            res.end("Blog created successfully (without image)!");
        }
    } catch (error) {
        console.error("Error creating blog:", error);
        res.writeHead(500);
        res.end("Internal server error");
    }
}

async function deleteBlog(req, res) {
    try {
        const urlParts = req.url.split("/");
        const blogId = urlParts[2];
        const existingBlog = await blogModel.getBlogById(req, blogId);
        const authHeader = req.headers["authorization"];
        if (!authHeader) {
            res.writeHead(400).end("token not found");
        }
        const token = authHeader.split("Bearer ")[1];
        const verify_Token = getUser(token);
        if (existingBlog) {
            if (verify_Token) {
                await blogModel.deleteBlog(req, blogId);
                res.writeHead(200).end("blog deleted successfully!");
            } else {
                res.writeHead(400).end("invalid token! Blog not deleted");
            }
        } else {
            res.writeHead(400).end("blog which you wants to deleted is not existed!");
        }
    } catch (error) {
        console.log("error deleted blog", error);
        res.writeHead(500).end("Internal Server Error");
    }
}

async function updateBlog(req, res) {
    try {
        const urlParts = req.url.split("/");
        const blogId = urlParts[2];
        const { updatedTitle, updatedContent } = await parseIncomingBodyData(req);
        const existingBlog = await blogModel.getBlogById(req, blogId);
        const authHeader = req.headers["authorization"];
        if (!authHeader) {
            res.writeHead(400).end("token not found");
        }
        const token = authHeader.split("Bearer ")[1];
        const verify_Token = getUser(token);
        if (existingBlog) {
            if (verify_Token) {
                await blogModel.updateBlog(
                    req,
                    { _id: existingBlog._id },
                    { $set: { blogTitle: updatedTitle, blogContent: updatedContent } }
                );
                res.writeHead(200).end("Blog updated successfully");
            } else {
                res.writeHead("invalid token! Blog not updated")
            }
        } else {
            res.writeHead(400).end("Blog not updated");
        }
    } catch (error) {
        console.log("error updating blog", error);
        res.writeHead(500).end("Internal Server Error");
    }
}

async function listBlog(req, res) {
    try {
        const authHeader = req.headers["authorization"];
        if (!authHeader) {
            res.writeHead(400).end("token not found");
        }
        const token = authHeader.split("Bearer ")[1];
        const verify_Token = await getUser(token);
        if (verify_Token && verify_Token.userRole === "ADMIN") {
            const blogs = await blogModel.findAllBlogs(req);
            res.writeHead(200).end(JSON.stringify({ blogs }));
        } else {
            res.writeHead(403).end("unAuthorized access");
        }
    } catch (error) {
        console.error("Error fetching blogList", error);
        res.writeHead(500).end("Internal Server Error");;

    }
}

module.exports = {
    createBlog,
    deleteBlog,
    updateBlog,
    listBlog
}