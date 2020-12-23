const express = require("express");
const app = express();
const bodyParser = require("body-parser");
const mongoose = require("mongoose");
const Campground = require("./models/campground");
const seedsDB = require("./seeds");
const Comment = require("./models/comment");
const passport = require("passport");
const LocalStrategy = require("passport-local");
const User = require("./models/user");
const methodOverride = require("method-override");

//DATA BASE SET UP
app.use(express.static(__dirname + "/public"));

mongoose.connect('mongodb://localhost:27017/yelp_camp', {
    useNewUrlParser: true,
    useUnifiedTopology: true
})
    .then(() => console.log('Connected to DB!'))
    .catch(error => console.log(error.message));

//seedsDB();//seed the DB

//PASSPORT CONFIGURATION

app.use(require("express-session")({
    secret: "cirilo is the best dog ever!",
    resave: false,
    saveUninitialized: false
}));

app.use(passport.initialize());
app.use(passport.session());

passport.use(new LocalStrategy(User.authenticate()));
passport.serializeUser(User.serializeUser());
passport.deserializeUser(User.deserializeUser());

app.use(bodyParser.urlencoded({ extended: true }));
app.set("view engine", "ejs");
app.use(methodOverride("_method"));

/*
    This middleware will help us to provide the current user info got it from app.get("/campgrounds) 
    info that we are using to display the proper navbar link in header.ejs
*/
app.use(function (req, res, next) {
    res.locals.currentUser = req.user;
    next();
});



app.get("/", (req, res) => {
    res.render("landing")
});

app.get("/campgrounds", (req, res) => {
    //Get all campground from DB
    Campground.find({}, (err, campgrounds) => {
        if (err) {
            console.log("SOMETHING WENT WRONG GETTING THE DATA")
        } else {
            console.log("ALL WORKING FINE!")
            res.render("campground/index", { campgrounds, currentUser: req.user });
        }
    });
});

app.get("/campgrounds/new", isLoggedIn, (req, res) => {
    res.render("campground/new");
});

app.get("/campgrounds/:id", (req, res) => {
    //find the campground with the provided ID
    Campground.findById(req.params.id).populate("comments").exec((err, foundCampground) => {
        if (err) {
            console.log("OPS! NO CAMPGROUND FOUND!");
        } else {
            //render show template with that campground
            res.render("campground/show", { foundCampground });
        }
    });
});

app.post("/campgrounds", isLoggedIn, (req, res) => {
    //get data from form and add to campgrounds array
    //redirect back to campgrounds page
    const name = req.body.name;
    const image = req.body.image;
    const description = req.body.description;
    const author = { id: req.user._id, username: req.user.username };
    const newCampGround = { name, image, description, author };
    //Create a new campground and save to the DB
    Campground.create(newCampGround, (err, newlyCreated) => {
        if (err) {
            console.log("SOMETHING WENT WRONG ADDING NEW DATA");
        } else {
            console.log("NEW DATA ADDED TO DB:");
            res.redirect("/campgrounds");
        }
    });

});

/*----------EDIT CAMPGROUND--------*/
app.get("/campgrounds/:id/edit", checkCampgroundOwnerShip, (req, res) => {
    Campground.findById(req.params.id, (err, foundCampground) => {
        res.render("campground/edit", { foundCampground });
    });
});

app.put("/campgrounds/:id", checkCampgroundOwnerShip, (req, res) => {
    Campground.findByIdAndUpdate(req.params.id, req.body.campground, (err, updatedCampground) => {
        if (err) {
            console.log(err);
            res.redirect("/campgrounds");
        } else {
            res.redirect("/campgrounds/" + req.params.id);
        }
    });
});

/*----------DELETE CAMPGROUND--------*/
app.delete("/campgrounds/:id", checkCampgroundOwnerShip, (req, res) => {
    Campground.findByIdAndRemove(req.params.id, (err) => {
        if (err) {
            console.log(err);
            res.redirect("/campgrounds");
        } else {
            res.redirect("/campgrounds");
        }
    });
});
/*----------COMMENTS ROUTE---------*/
/*------NESTED ROUTE------*/

app.get("/campgrounds/:id/comments/new", isLoggedIn, (req, res) => {
    //find the campground by id
    Campground.findById(req.params.id, (err, campground) => {
        if (err) {
            console.log("OPS! COULDN'T FIND ANY CAMPGROUND");
        } else {
            res.render("comments/new", { campground });
        }
    });
});

app.post("/campgrounds/:id/comments", isLoggedIn, (req, res) => {
    Campground.findById(req.params.id, (err, campground) => {
        if (err) {
            console.log(err);
            res.redirect("/campgrounds")
        } else {
            //console.log(req.body.comment)
            Comment.create(req.body.comment, (err, comment) => {
                if (err) {
                    console.log(err);
                } else {
                    //add username and add it to comment
                    comment.author.id = req.user._id;
                    comment.author.username = req.user.username;
                    //save comment
                    comment.save();
                    campground.comments.push(comment);
                    campground.save();
                    res.redirect("/campgrounds/" + campground._id);
                }
            });
        }
    });
});

/*==========AUTH ROUTES==========*/

//show register form

app.get("/register", (req, res) => {
    res.render("register");
});


//handle sign up

app.post("/register", (req, res) => {
    const newUser = new User({ username: req.body.username });

    User.register(newUser, req.body.password, (err, user) => {
        if (err) {
            console.log("OPS! SOMETHING WENT WRONG TRYING TO REGISTER USER");
            console.log(err);
            return res.render("register");
        }

        passport.authenticate("local")(req, res, () => {
            res.redirect("/campgrounds");
        });
    });
});

//show login form

app.get("/login", (req, res) => {
    res.render("login");
});

//handling login logic
app.post("/login", passport.authenticate("local",
    {
        successRedirect: "/campgrounds",
        failureRedirect: "/login"
    }), (req, res) => {

    });

//LOGOUT LOGIC

app.get("/logout", (req, res) => {
    req.logout();
    res.redirect("/campgrounds");
});
/*--------MIDDLEWARE---------*/
function isLoggedIn(req, res, next) {
    if (req.isAuthenticated()) {
        return next();
    }

    res.redirect("/login");
}

function checkCampgroundOwnerShip(req, res, next) {
    if (req.isAuthenticated()) {
        Campground.findById(req.params.id, (err, foundCampground) => {
            if (err) {
                console.log(err);
                res.redirect("back");
            } else {
                //does user own the campground?
                if (foundCampground.author.id.equals(req.user._id)) {
                    next();
                } else {
                    res.redirect("back");
                }
            }
        });
    } else {
        console.log("you need to be logged in");
        res.redirect("back");
    }
}

app.listen(3000, process.env.IP, () => console.log("yelpCamp server running !!"));