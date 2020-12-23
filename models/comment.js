var mongoose = require("mongoose");

//user assosiation: comments
/*
    1. adding author as object 
        1.1: id is a reference to user model id
        1.2: user name is just a string
    2. we need to go into comment route (post)
        2.1: In Comment.create
            2.1.1: we add the id and the user name into the comment (comment.author.id = req.user._id;)
                                                                    (comment.author.username = req.user.username;)
            2.1.2: comment.save();
*/
var commentSchema = mongoose.Schema({
    text: String,
    author: {
        id: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User"
        },
        username: String
    }
});

module.exports = mongoose.model("Comment", commentSchema);