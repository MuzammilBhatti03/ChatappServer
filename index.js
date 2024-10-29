// const app = require("express")();
// const http = require("http").createServer(app);
// const io = require("socket.io")(http, {
//   cors: {
//     origin: "http://localhost:3000",
//   },
// });

// io.use((socket, next) => {
//   const username = socket.handshake.auth.fetched_userName;
//   socket.username = username;
//   next();
// });

// io.on("connection", (socket) => {
//   const users = [];
//   for (let [id, socket] of io.of("/").sockets) {
//     users.push({
//       userID: id,
//       username: socket.username,
//       key: id,
//     });
//   }
//   socket.emit("users", users);
//   console.log(users);

//   socket.broadcast.emit("user connected", {
//     userID: socket.id,
//     username: socket.username,
//     key: socket.id,
//     self: false,
//   });

//   socket.on("private message", ({ content, to }) => {
//     console.log("Content:", content, " To:", to);
//     socket.to(to).emit("private message", {
//       content,
//       from: socket.id,
//     });
//   });
// });

// http.listen(4200, () => {
//   console.log("Listening on port 4200");
// });

const express = require("express");
const http = require("http");
const socketIo = require("socket.io");
const mongoose = require("mongoose");
const Forum = require("./Forum"); // Import the Forum model
const connectDB = require("./db"); // Import your DB connection function
const Message = require("./Message"); // Import the Message model
const User = require("./user");
const { ObjectId } = mongoose.Types;

// Initialize Express app and HTTP server
const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: "http://localhost:3000", // Adjust based on your frontend URL
  },
});

// Connect to MongoDB
connectDB();

// Middleware to handle JSON requests
app.use(express.json());

// Create a map to store username -> socket ID mapping
const usernameToSocketIdMap = new Map();

// Function to get all connected users
const getAllConnectedUsers = () => {
  const users = [];
  console.log("in get all users ");

  for (let [id, socket] of io.of("/").sockets) {
    users.push({
      userID: id,
      username: socket.username,
      key: id,
    });
  }
  return users;
};

// Middleware to handle user authentication and setting username
io.use((socket, next) => {
  const { userID } = socket.handshake.auth; // Now expecting userID

  // Check if the userID is provided
  // console.log("userid in connectioon is ",userID);

  if (!userID || typeof userID !== "string") {
    console.log("Connection rejected due to missing or invalid userID.");
    return next(new Error("Invalid userID"));
  }

  // If the userID is valid, proceed with the connection
  console.log("UserID set in middleware:", userID);
  socket.userID = userID; // Store userID in the socket
  next(); // Allow the connection to proceed
});

// Handle new connections
io.on("connection", (socket) => {
  console.log(`UserID ${socket.userID} connected`);

  // Emit the updated list of users to all connected clients
  const users = getAllConnectedUsers();
  io.emit("users", users); // Emit to all users when a new user connects

  // Fetch connected users upon request
  socket.on("fetch users", () => {
    console.log("Fetching all connected users upon request");
    const users = getAllConnectedUsers();
    socket.emit("users", users); // Emit only to the requesting client
  });

  // Handle joining rooms
  socket.on("join room", (room) => {
    socket.join(room);
    console.log(`${socket.userID} joined room: ${room}`);
  });

  // Handle private messages in rooms
  socket.on("private message", ({ content, room ,createdAt}) => {
    console.log("Content:", content, " Room:", room, "  id is ", socket.userID);

    // Broadcast the message to everyone in the room except the sender
    socket.to(room).emit("private message", {
      content,
      from: socket.userID,
      createdAt,
    });
  });

  // Handle individual private messages
  socket.on("individual message", ({ content, to }) => {
    console.log("Content:", content, " To:", to);
    if (to) {
      io.to(to).emit("private message", {
        content,
        from: socket.username, // Use username instead of socket.id
      });
    } else {
      console.log(`User ${to} not connected`);
    }
  });

  // Handle disconnections
  socket.on("disconnect", () => {
    console.log(`${socket.userID} disconnected`);

    // Remove the user from the map when they disconnect
    usernameToSocketIdMap.delete(socket.userID);

    // Emit the updated list of users to all connected clients
    const updatedUsers = getAllConnectedUsers();
    io.emit("users", updatedUsers); // Emit updated list when a user disconnects
  });
});

// API to get all forum posts
app.get("/api/forums", async (req, res) => {
  try {
    const forums = await Forum.find();
    /* console.log("Fetched forums:", forums); // Log fetched data*/
    res.status(200).json(forums);
  } catch (error) {
    console.error("Error fetching forums:", error); // Log any error
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

// API to create a new forum post
app.post("/api/forums", async (req, res) => {
  try {
    // Check if required fields are present
    const { id, title, description, image } = req.body;
    if (!id || !title || !description || !image) {
      return res.status(400).json({ message: "All fields are required" });
    }

    // Create a new forum post
    const forumPost = new Forum({
      id,
      title,
      description,
      image,
    });

    // Save the forum post to the database
    await forumPost.save();
    res.status(201).json({ message: "Forum post created successfully" });
  } catch (error) {
    console.error("Error creating forum post:", error.message);
    res
      .status(500)
      .json({ message: "Error creating forum post", error: error.message });
  }
});

// Helper function to save a message
const saveMessage = async (forumID, userID, username, content) => {
  try {
    // Validate that the forumID is a valid ObjectId
    if (!ObjectId.isValid(forumID)) {
      throw new Error("Invalid forumID");
    }

    // Convert forumID to ObjectId
    const forumObjectId = new ObjectId(forumID);

    const newMessage = new Message({
      userID,
      username,
      content,
      forumID: forumObjectId, // Use validated ObjectId for forumID
      createdAt: new Date(),
    });

    // Save the new message to the database
    await newMessage.save();
    return newMessage; // Return the saved message
  } catch (error) {
    console.error("Error saving message:", error.message);
    throw new Error("Error saving message: " + error.message);
  }
};

// API to save a message to a specific forum
app.post("/forums/:forumID/messages", async (req, res) => {
  const { forumID } = req.params; // Get the forum ID from the URL
  const { userID, username, content, createdAt } = req.body;
  console.log("in save message api ", req.body);
  // Validate request body
  if (!userID || !username || !content) {
    return res.status(400).json({ message: "All fields are required" });
  }

  try {
    // Call the saveMessage function to save the message
    const message = await saveMessage(
      forumID,
      userID,
      username,
      content,
      createdAt
    );

    res.status(201).json({
      message: "Message saved successfully",
      data: message,
    });
  } catch (error) {
    res.status(500).json({
      message: "Error saving message",
      error: error.message,
    });
  }
});
// API to get all messages for a specific forum, sorted by createdAt in increasing order
app.get("/forums/:forumID/messages", async (req, res) => {
  const { forumID } = req.params; // Extract forumID from the URL parameters

  try {
    // Find messages that belong to the specified forum and sort by createdAt in increasing order
    const messages = await Message.find({ forumID })
      .populate("userID", "username") // Optionally populate user data
      .sort({ createdAt: 1 }); // Sort messages by creation date, oldest first

    if (messages.length === 0) {
      return res
        .status(404)
        .json({ message: "No messages found for this forum." });
    }

    res.status(200).json(messages); // Send the retrieved messages
  } catch (error) {
    console.error("Error fetching messages:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

// API to add new user with device ID
app.post("/addnewuser", async (req, res) => {
  const { username, deviceId } = req.body;
  console.log("user is in adduser ", req.body);
  if (!username || !deviceId) {
    return res
      .status(400)
      .json({ error: "Username and device ID are required" });
  }

  try {
    // Check if the username is already taken
    const existingUser = await User.findOne({ username });
    if (existingUser) {
      return res.status(400).json({ error: "Username already exists" });
    }

    // Create a new user with device ID
    const newUser = new User({
      username,
      deviceId, // Store the device ID in the database
    });

    // Save the user to the database
    await newUser.save();
    res.status(201).json({ message: "User added successfully", user: newUser });
  } catch (error) {
    res.status(500).json({ error: "Failed to add user" });
  }
});

// API to get userID by username
app.get("/getuser/:identifier", async (req, res) => {
  const { identifier } = req.params; // Extract identifier from the URL

  try {
    let user;

    // Check if the identifier is a valid ObjectId (assuming you use MongoDB)
    if (mongoose.Types.ObjectId.isValid(identifier)) {
      // If valid, find the user by _id
      user = await User.findById(identifier);
    } else {
      // If not valid, find the user by username
      user = await User.findOne({ username: identifier });
    }

    if (!user) {
      // If user is not found, return a 404 error
      return res.status(404).json({ message: "User not found" });
    }

    // If user is found, return user
    res.status(200).json({ user });
  } catch (error) {
    // Handle any server error
    console.error("Error fetching user:", error.message);
    res.status(500).json({ message: "Server error", error: error.message });
  }
});
app.delete('/cleanup-user/:username', async (req, res) => {
  const { username } = req.params;

  try {
    // Find the user by username
    const user = await User.findOne({ username });
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Fetch the user's last message time from both Message and IndividualMessage collections
    const lastForumMessage = await Message.findOne({ username })
      .sort({ createdAt: -1 }) // Get the most recent message
      .select('createdAt');

    const lastIndividualMessage = await IndividualMessage.findOne({ senderID: user._id })
      .sort({ createdAt: -1 }) // Get the most recent message
      .select('createdAt');

    // Get the latest timestamp of both
    const latestMessageTime = lastForumMessage && lastIndividualMessage
      ? new Date(Math.max(lastForumMessage.createdAt, lastIndividualMessage.createdAt))
      : lastForumMessage
        ? lastForumMessage.createdAt
        : lastIndividualMessage
          ? lastIndividualMessage.createdAt
          : null;

    if (!latestMessageTime) {
      return res.status(404).json({ message: 'User has no messages' });
    }

    // Check if the last message is older than 10 minutes
    const TEN_MINUTES = 10 * 60 * 1000; // in milliseconds
    const currentTime = new Date();

    if (currentTime - latestMessageTime > TEN_MINUTES) {
      // Remove the user from the User model
      await User.findOneAndDelete({ username });

      // Remove all forum messages of the user
      await Message.deleteMany({ username });

      // Remove all individual messages of the user
      await IndividualMessage.deleteMany({ senderID: user._id });

      // Remove this user from the connectedUsers list of all other users
      await User.updateMany(
        { connectedUsers: user._id.toString() }, // Match all users with this user in connectedUsers
        { $pull: { connectedUsers: user._id.toString() } } // Remove user from connectedUsers array
      );

      return res.status(200).json({ message: 'User and all associated data removed successfully' });
    } else {
      return res.status(400).json({ message: 'User’s last message was sent within the last 10 minutes' });
    }
  } catch (error) {
    console.error("Error cleaning up user data:", error);
    return res.status(500).json({ message: 'Server error' });
  }
});
// API to add a connected user
app.post("/add-connected-user", async (req, res) => {
  const { username, userIDToAdd } = req.body; // Expecting username of the user and the userID to be added
  // console.log("user in add api",username,"  ",userIDToAdd);
  if (!username || !userIDToAdd) {
    return res
      .status(400)
      .json({ message: "Username and userID to add are required." });
  }

  try {
    // Find the user by username
    const user = await User.findOne({ username });
    // console.log("user in add api",user);
    if (!user) {
      return res.status(404).json({ message: "User not found." });
    }

    // Check if userIDToAdd is already in the connectedUsers array
    if (user.connectedUsers.includes(userIDToAdd)) {

      user.connectedUsers.includes(userIDToAdd)
      console.log(user.connectedUsers.includes(userIDToAdd));
      return res.status(400).json({ message: "User is already connected." });
    }

    // Add userIDToAdd to the connectedUsers array
    user.connectedUsers.push(userIDToAdd);
    await user.save();

    return res
      .status(200)
      .json({
        message: "Connected user added successfully.",
        connectedUsers: user.connectedUsers,
      });
  } catch (error) {
    console.error("Error adding connected user:", error);
    return res.status(500).json({ message: "Internal server error." });
  }
});
app.get('/connected-users/:username', async (req, res) => {
  const { username } = req.params;

  try {
    // Find the user by username
    const user = await User.findOne({ username });

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Find the full details of the connected users using the ObjectIds stored in connectedUsers
    const connectedUserDetails = await User.find({
      _id: { $in: user.connectedUsers }  // Match ObjectIds stored in connectedUsers
    });

    // Respond with the connected users details
    return res.status(200).json({
      connectedUsers: connectedUserDetails,
    });
  } catch (error) {
    console.error("Error retrieving connected users:", error);
    return res.status(500).json({ message: 'Server error' });
  }
});

const IndividualMessage = require("./IndividualMessage"); // Import the IndividualMessage model

// API to send an individual message
app.post("/api/messages/send", async (req, res) => {
  const { senderID, receiverID, content } = req.body;

  // Validate required fields
  if (!senderID || !receiverID || !content) {
    return res.status(400).json({ message: "All fields are required." });
  }

  try {
    // Create a new message
    const newMessage = new IndividualMessage({
      senderID,
      receiverID,
      content,
    });

    // Save the message to the database
    await newMessage.save();

    res.status(201).json({ message: "Message sent successfully", data: newMessage });
  } catch (error) {
    console.error("Error sending message:", error.message);
    res.status(500).json({ message: "Error sending message", error: error.message });
  }
});
// API to get all individual messages between two users
app.get("/api/messages/:user1/:user2", async (req, res) => {
  const { user1, user2 } = req.params; // Get the two users' IDs from the URL

  try {
    // Find all messages between the two users (either user1 is sender and user2 is receiver or vice versa)
    const messages = await IndividualMessage.find({
      $or: [
        { senderID: user1, receiverID: user2 },
        { senderID: user2, receiverID: user1 },
      ],
    }).sort({ createdAt: 1 }); // Sort by message creation time

    if (messages.length === 0) {
      return res.status(404).json({ message: "No messages found between the two users." });
    }

    res.status(200).json({ messages });
  } catch (error) {
    console.error("Error fetching messages:", error.message);
    res.status(500).json({ message: "Error fetching messages", error: error.message });
  }
});

// Start the server
server.listen(4200, () => {
  console.log("Listening on port 4200");
});
