require("dotenv").config();

const config = require("./config.json");
const mongoose = require("mongoose");

mongoose.connect(config.connectionString);

const User = require("./models/user.model");
const Note = require("./models/note.model");

const express = require("express");
const cors = require("cors");
const app = express();

const jwt = require("jsonwebtoken");
const { authentication, authenticateToken } = require("./utilities");

app.use(express.json());

app.use(
    cors({
        
        origin: "*"
    })
);

app.get("/" , (req,res) => {
    res.json({data: "hello"});
});

//create account
app.post("/create-account", async (req,res)=>{

    const {fullName , email, password} = req.body;
    if(!fullName)
    {
        return res
        .status(400)
        .json({error: true, message: "FullName is required"});
    }
    if(!email)
    {
        return res.status(400).json({error: true, message: "email is required"});
    }
    if(!password)
    {
        return res
        .status(400)
        .json({error: true, message: "Password is required"});
    }

    const isUser = await User.findOne({email: email});

    if(isUser){
        return res.json({
            error: true,
            message: "user already exist",
        });
    }
    const user = new User({
        fullName,
        email,
        password,
    });
    await user.save();
    const accessToken = jwt.sign({user}, process.env.ACCESS_TOKEN_SECRET, {
        expiresIn: "36000m",
    });

    return res.json({
        error: false,
        user,
        accessToken,
        message: "Registeration Successful"
    });
    
});

//login account
app.post("/login", async (req, res) => {
    const {email, password} = req.body;

    if(!email){
        return res.status(400).json({message: "Email is required"});
    }
    if(!password){
        return res.status(400).json({message: "Password is required"});
    }

    const userInfo = await User.findOne({email: email});
    if(!userInfo){
        return res.status(400).json({message: "User not found"});
    }
    if(userInfo.email == email && userInfo.password == password)
    {
        const user = {user: userInfo};
        const accessToken = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, {
            expiresIn: "36000m",
        });

        return res.json({
            error: false,
            email,
            accessToken,
            message: "Login Successful"
        });
    }
    else
    {
        return res.status(400).json({
            error: true,
            message: "Invalid Credentials",
        });
    }
});

//GET USER 
app.get("/get-user" , authenticateToken, async (req,res) => {
    const {user} = req.user;

    const isUser = await User.findOne({_id: user._id});

    if(!isUser)
    {
        return res.sendStatus(401);
    }
    return res.json({
        user: {
            fullName: isUser.fullName,
            email: isUser.email,
            _id: isUser._id,
            cretedOn: isUser.createdOn,            
        },
        message: "",
    });
});

//ADD NOTE
app.post("/add-note", authenticateToken, async (req,res) => {
    const {title, content, tags} = req.body;
    const {user} = req.user;

    if(!title)
    {
        return res.status(400).json({error: true, message: "Title is required"});
    }
    if(!content)
    {
        return res.status(400).json({error: true, message: "Content is required"});
    }

    try{
        const note = new Note({
            title,
            content,
            tags: tags || [],
            userId: user._id,
        });
        await note.save();
        return res.json({error: false , note, message: "Note added successfully"});
    }
    catch (error) {
        return res.status(500).json({error: true , message:"Internal Server Error"});
    }
});

//EDIT NOTE
app.put("/edit-note/:noteId" , authenticateToken , async (req, res) => {
    const noteId = req.params.noteId;
    const {title , content , tags , isPinned} = req.body;
    const { user } = req.user;

    if(!title && !content && !tags){
        return res.status(400).json({error: true , message: "No Changes Provided"});
    }

    try
    {
        const note = await Note.findOne({_id: noteId, userId: user._id});

        if(!note) {
            return res.status(404).json({error: true, message: "Note not found"});
        }
        if(title) note.title = title;
        if(content) note.content = content;
        if(tags) note.tags = tags;
        if(isPinned) note.isPinned = isPinned;

        await note.save();

        return res.json({
            error: false,
            note,
            message: "Note Updated Successfully",
        });
    }
    catch (error){
        return res.status(500).json({error: true, message: "Internal Serve Error"});
    }
});

//GET ALL NOTES
app.get("/get-all-notes" , authenticateToken, async (req,res) => {
    const {user} = req.user;
    try{
        const notes = await Note.find({userId: user._id}).sort({isPinned: -1});

        return res.json({
            error: false,
            notes,
            message: "All notes retrived successfully",
        });
    }
    catch (error) {
        return res.status(500).json({
            error: true,
            message: "Internal Server Error",
        });
    }
});

//DELETE NOTE
app.delete("/delete-note/:noteId" , authenticateToken, async (req,res) => {
    const noteId = req.params.noteId;
    const { user } = req.user;

    try{
        const note = await Note.findOne({_id: noteId , userId: user._id});

        if(!note){
            return res.status(404).json({error: true, message: "Note not found"});
        }

        await Note.deleteOne({_id: noteId, userId: user._id});

        return res.json({
            error: false,
            message: " Note deleted successfully",
        });
    }
    catch (error) {
        return res.status(500).json({
            error: true,
            message: "Internal server error",
        });
    }
});

//UPDATE ISPINNED VALUE
app.put("/update-note-pinned/:noteId" , authenticateToken, async (req, res) => {
    const noteId = req.params.noteId;
    const {isPinned} = req.body;
    const { user } = req.user;

    try
    {
        const note = await Note.findOne({_id: noteId, userId: user._id});

        if(!note) {
            return res.status(404).json({error: true, message: "Note not found"});
        }
        note.isPinned = isPinned;

        await note.save();

        return res.json({
            error: false,
            note,
            message: "Note Updated Successfully",
        });
    }
    catch (error){
        return res.status(500).json({error: true, message: "Internal Serve Error"});
    }
});

//SEARCH NOTES
app.get("/search-notes" , authenticateToken, async (req, res) => {
    const { user } = req.user;
    const { query } = req.query;

    if(!query){
        return res.status(400).json({error: true, message: "Search query required"});
    }

    try{
        const matchingNotes = await Note.find({
            userId: user._id,
            $or: [
                {title: {$regex: new RegExp(query, "i")}},
                {content: {$regex: new RegExp(query, "i")}},
            ],
        });
        return res.json({
            error: false,
            notes: matchingNotes,
            message: "Notes matching the search query retrived successfully",
        });
    }
    catch (error) {
        return res.status(500).json({error: true, message: "Internal Server Error"});
    }
});

app.listen(8000);

module.exports = app;