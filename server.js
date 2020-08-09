// Yoonkyung Kim (121389191)
// ykim268@myseneca.ca
// Heroku link: https://sheltered-beyond-52937.herokuapp.com/
// Github link: https://github.com/YoonkyungKim/WEB322-Oneperfectmeal

// data clerk account:
// email: data@c.com
// password: admin1

// To reduce complexity, I separated the module that contains object type data (meal package etc.) and the module dealing with database and user input validation into two files.
// (data.js & db.js)

const express = require("express");
const exphbs = require("express-handlebars");
const app = express();
const bodyParser = require("body-parser");
const nodemailer = require('nodemailer');
const ds = require("./data");
const db = require("./db");
const path = require("path");
const multer = require("multer");
const clientSessions = require("client-sessions");

// Handlebars setup
// register handlebars as the rendering engine for views
app.set("views", "./views");  // indicates handlebars files' location

// Setting up rendering engine
// It tells that we uses .hbs files, and we can just call the filename without the extension when rendering files
app.engine(".hbs", exphbs({ extname: ".hbs",
    defaultLayout: 'main',
    helpers: {
        // custom helper that compares two parameter and return the value based on the result of the comparison
        ifSame: function(a, b, options) {
            if (a == b) {
                return options.fn(this);
            } else {
                return options.inverse(this);
            }
        }
    } 
})
);

// Setup view engine
app.set("view engine", ".hbs"); 

// Setup the static folder
// app.use(express.static("public"));
app.use(express.static(path.join(__dirname, 'public')));

// Set the middleware for urlencoded form data
app.use(bodyParser.urlencoded({ extended: true }));

// Set the port
const HTTP_PORT = process.env.PORT || 3000;

function onHttpStart(){
    console.log("Express http server listening on: " + HTTP_PORT);   
}

// setup client-sessions
app.use(clientSessions({
    cookieName: "session",
    secret: "funnyandexcitingoneperfectmeal", // long un-guessable string
    duration: 2 * 60 * 60 * 1000,  // duration of the session in milliseconds (2 hours)
    activeDuration: 1000 * 60  // the session will be extended by this many ms each req (1 min)
}));

const storage = multer.diskStorage({
    destination: "./public/img/",
    filename: function(req, file, cb){
        // write the filename as current date: simple example
        // for large web service: better to use GUID's for filenames.
        cb(null, Date.now() + path.extname(file.originalname));
    }
});

const imageFilter = (req, file, cb) => {
    if (file.mimetype.startsWith('image')){
        return cb(null, true);
    } else {
        return cb(new Error('Not an image! Please upload an image.', 400), false);
    }
};

// use diskStorage function for naming instead of default
const upload = multer({ storage: storage, fileFilter: imageFilter});

app.get("/", (req, res) => {
    ds.getLocalData().then((inData)=>{
        db.getMealPackages().then((mealPs)=>{
            if (req.session.user){
                res.render("index", { 
                    data: inData, 
                    topMealSection: true,
                    mealPackages: (mealPs.length !== 0) ? mealPs: undefined,
                    loggedIn: true  // for the proper nav menus
                });
            } else {
                res.render("index", { 
                    data: inData, 
                    topMealSection: true,
                    mealPackages: (mealPs.length !== 0) ? mealPs: undefined
                });
            }
        }).catch((err)=>{
            console.log(err);
            res.render("/"); // add error message
        })
    })
});

app.get("/meals-package", (req, res) => {
    ds.getLocalData().then((inData)=>{
        db.getMealPackages().then((mealPs)=>{
            //to change nav bar menus
            if (req.session.user){
                res.render("mealsPackage", { 
                    data: inData,
                    mealPackages: (mealPs.length !== 0) ? mealPs: undefined,
                    loggedIn: true,
                    admin: (req.session.user.admin) ? true : false
                });
            } else {
                res.render("mealsPackage", { 
                    data: inData,
                    mealPackages: (mealPs.length !== 0) ? mealPs: undefined
                });
            }
        }).catch((err)=>{
            console.log(err);
            res.render("mealsPackage");
        })
    })
});

app.get("/register", (req, res) => {
    ds.getLocalData().then((inData)=>{
        res.render("registration", { 
            data: inData, 
            page: "register" 
        });
    })
});

app.get("/login", (req, res) => {
    ds.getLocalData().then((inData)=>{
        res.render("login", { 
            data: inData,
            page: "login"
         });
    })
});

// dashboard: private route
app.get("/dashboard", (req, res) => {
    ds.getLocalData().then((inData)=>{
        if (req.session.user){
            if (req.session.user.admin){
                res.render("clerk_dashboard", {
                    data: inData, 
                    user: req.session.user,
                    loggedIn: true
                });
            } else {
                res.render("dashboard", {
                    data: inData, 
                    user: req.session.user,
                    loggedIn: true
                });
            }
        } else {
            res.redirect("/login");
        }
    })
});

app.get("/logout", (req, res) => {
    req.session.reset();
    res.redirect("/login");
});

app.post("/login", (req, res) => {
    // to not clear the form if the data is invalid. Spaces must be erased
      var inputData = {
        email: req.body.email.trim(),
        password: req.body.password.trim()
    }

    ds.getLocalData().then((inData)=>{
        db.validateLogin(req.body).then(() =>{
            db.validateUser(req.body)
            .then((userData)=>{
                req.session.user = userData; // add it to a session. (log it in as a user)

                console.log(req.session.user);

                if (req.session.user.admin){
                    res.render("clerk_dashboard", {
                        data: inData, 
                        user: req.session.user, 
                        loggedIn: true
                    });
                } else {
                    res.render("dashboard", {
                        data: inData, 
                        user: req.session.user,
                        loggedIn: true
                    });
                }
            })
            .catch((message) => {
                console.log(message);
                res.render("login", {
                    data: inData,
                    formData: inputData,
                    error: true,
                    page: "login",
                    invalidUser: true
                });
            })
        }).catch(()=> {
            db.getErrData().then((errorData)=>{
                res.render("login", {
                    data: inData,
                    error: true,
                    errData: errorData,
                    formData: inputData,
                    page: "login"
                });
            })
        })
    })
});

var transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.NODEMAILER_USER,
        pass: process.env.NODEMAILER_PW
    }
});

app.post("/register", (req, res) => {

    // to not clear the form if the data is invalid. Spaces must be erased
    var inputData = {
        fName: req.body.fName.trim(),
        lName: req.body.lName.trim(),
        email: req.body.email.trim(),
        password: req.body.password.trim()
    }

    // mail options
    var mailOptions = {
        from: process.env.NODEMAILER_USER,
        to: inputData.email,
        subject: 'Welcome to Oneperfectmeal!',
        text: `Hey ${inputData.fName}, welcome to Oneperfectmeal. Enjoy a delicious and varied meal prepared for you!`
    };
        
    ds.getLocalData().then((inData)=>{
        db.validateSignup(req.body)
        .then(() =>{
            db.addUser(req.body)
            .then(() => {
                transporter.sendMail(mailOptions, (err, info)=> {
                    if (err){
                        console.log(err);
                    } else {
                        console.log('Email sent: ' + info.response);
                    }
                })
                // if the user is successfully added, render login page
                res.render("login", { 
                    data: inData,
                    page: "login",
                    afterRegister: true
                });
            }).catch((msg)=>{
                console.log("data fail to stored");
                res.render("registration", {
                    error: true,
                    data: inData,
                    formData: inputData,
                    page: "register",
                    errormsg: msg
                });
            })
        }).catch(()=> {
            db.getErrData().then((errorData)=>{
                res.render("registration", {
                    data: inData,
                    error: true,
                    errData: errorData,
                    formData: inputData,
                    page: "register"
                });
            })
        })
    })
});

// private page to data clerk
app.get("/addMealP", (req, res)=>{
    if (req.session.user){
        if (req.session.user.admin){
            res.render("addMealPackage", {loggedIn: true});
        } else {
            res.redirect("/dashboard");
        }
    } else {
        res.redirect("/login");
    }
});

// I want to handle the file uploading error and display it to the user, 
// so call upload.single() function inside the route
app.post("/addMealP", (req, res)=>{
    if (req.session.user && req.session.user.admin){
        var errorMsg;
        let fileUpload = upload.single("photo");
        fileUpload(req, res, function (err){
            console.log(err);
            if (!req.file){
                console.log("no file");
                if (err){
                    errorMsg = err;
                } else {
                    errorMsg = "Please choose the image.";
                }
                // to not clear the form if the user doesn't attach any image / user doesn't fill out required field
                var inputData = {
                    mealPNumber: req.body.mealPNumber,
                    name: req.body.name,
                    price: req.body.price,
                    description: req.body.description,
                    noOfMeals: req.body.noOfMeals,
                    topPackage: (req.body.topPackage) ? true : false
                }

                res.render("addMealPackage", {
                    error: "NoFile",
                    errMsg: errorMsg,
                    page: "add",
                    data: inputData,
                    loggedIn: true
                });
            } else if (err instanceof multer.MulterError){
                errorMsg = err;
                res.render("addMealPackage", {error: errorMsg, loggedIn: true});
            } else if (err){
                errorMsg = err;
                res.render("addMealPackage", {error: errorMsg, loggedIn: true});
            } else {
                // if user successfully choose the image
                req.body.image = req.file.filename;
                console.log(req.body);
                db.addMealPackage(req.body).then(()=>{
                    res.redirect("/meals-package");
                }).catch((err)=>{
                    var inputData = {
                        mealPNumber: req.body.mealPNumber,
                        name: req.body.name,
                        price: req.body.price,
                        description: req.body.description,
                        category: req.body.category,
                        noOfMeals: req.body.noOfMeals,
                        topPackage: (req.body.topPackage) ? true : false
                    }
                    if (err === "ValidationError"){
                        console.log("required field empty");
                        db.getErrData().then((errorData)=>{
                            res.render("addMealPackage", {
                                error: "NoRequiredField",
                                errMsg: errorData,
                                page: "add",
                                data: inputData,
                                loggedIn: true
                            });
                        })
                    } else {
                        console.log("Error adding meal package: " + err);
                        // console.log(inputData);
                        db.getErrData().then((errorData)=>{
                            res.render("addMealPackage", {
                                error: "NoRequiredField",
                                errMsg: errorData,
                                page: "add",
                                data: inputData,
                                loggedIn: true
                            });
                        })
                    }               
                }); 
            }
        })
    }else {
        res.redirect("/login");
    }
});

// Edit meal package
// editMealP?mealPNumber=mealPNumber
// private page to data clerk
app.get("/editMealP", (req,res)=>{
    if (req.session.user && req.session.user.admin){
        console.log(req.query);
        if (req.query.mealPNumber){ 
            console.log("number exists in query");
            db.getMealByNumber(req.query.mealPNumber).then((mealP)=>{
                res.render("editMealPackage", {
                    data: mealP,
                    page: "edit",
                    loggedIn: true
                });
            }).catch(()=>{
                console.log("couldn't find the meal package with this number");
                res.redirect("/meals-package");
            });
        }
        else {
            res.redirect("/meals-package");
        }  
    } else {
        res.redirect("/login");
    }
});

app.post("/editMealP", (req,res)=>{
    if (req.session.user && req.session.user.admin){
        let fileUpload = upload.single("photo");
        fileUpload(req, res, function (err){
            // if user doesn't upload the new file (doesn't want to change the original image), that's okay.
            if (!req.file){
                console.log("no file change");
                // Cannot edit meal package number once created. Thus, we can find the original image through it             
                db.getMealByNumber(req.body.mealPNumber).then((mealP)=>{
                    req.body.image = mealP.image;
                    db.editMealPackage(req.body).then(()=>{
                        res.redirect("/meals-package");
                    }).catch((err)=>{
                        console.log(err);
                        if (err === "ValidationError"){
                            db.getErrData().then((errorData)=>{
                                res.render("editMealPackage", {
                                    data: mealP,
                                    error: "NoRequiredField",
                                    errMsg: errorData,
                                    page: "edit",
                                    loggedIn: true
                                });
                            })
                        } else {
                            console.log("Error adding meal package: "+ err);
                            res.render("editMealPackage", {
                                data: mealP,
                                error: "error",
                                errMsg: err,
                                page: "edit",
                                loggedIn: true
                            });
                        }  
                    })
                }).catch((err)=>{
                    console.log(err);
                });
            } else if (err instanceof multer.MulterError){
                errorMsg = err;
                res.render("editMealPackage", {error: errorMsg, loggedIn: true});
            } else if (err){
                errorMsg = err;
                res.render("editMealPackage", {error: errorMsg, loggedIn: true});
            } else {
                // when the user upload a new image (want to change image)
                req.body.image = req.file.filename;
                db.editMealPackage(req.body).then(()=>{
                    res.redirect("/meals-package");
                }).catch((err)=>{
                    console.log(err);
                    res.redirect("/editMealPackage");
                })
            }
        })
    } else {
        redirect("/login");
    }
});

// if db connection is successful, listen the port
db.initialize().then(()=>{
    console.log("Data read successfully");
    app.listen(HTTP_PORT, onHttpStart);
})
.catch((data)=>{
    console.log(data);
})