const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const mongoose = require("mongoose");
const cors = require("cors");

const app = express();
app.use(cors());
app.use(express.json());

const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: "*" }
});

// Connect to MongoDB specifying the "resqpilot" database
mongoose.connect("mongodb+srv://biswasadrisha70_db_user:a4PUUnqa4b6saH8W@adrisha.qbvh2pv.mongodb.net/resqpilot?retryWrites=true&w=majority&appName=Adrisha")
  .then(() => console.log("Connected to MongoDB successfully"))
  .catch((err) => console.error("MongoDB connection error:", err));

// Define Emergency Schema
const emergencySchema = new mongoose.Schema({
  dispatchId: String,
  timestamp: String,
  patientProfile: Object,
  emergencyAssessment: Object,
  locationCoordinates: Object,
  status: { type: String, default: "DISPATCHED" }
});

// Force Mongoose to save records into the exact collection "patients" inside the "resqpilot" database
const Emergency = mongoose.model("Emergency", emergencySchema, "patients");

// WebSocket Connection
io.on("connection", (socket) => {
  console.log("A client connected:", socket.id);

  // When a citizen confirms dispatch
  socket.on("citizen_dispatch", async (payload) => {
    try {
      // 1. Save record into MongoDB Atlas under resqpilot.patients
      const newEmergency = new Emergency(payload);
      await newEmergency.save();

      // 2. Broadcast the emergency instantly to all connected drivers & hospital queues
      io.emit("incoming_emergency_alert", newEmergency);
      console.log("Emergency dispatched, saved to resqpilot.patients, and broadcasted.");
    } catch (err) {
      console.error("Error handling dispatch:", err);
    }
  });

  socket.on("disconnect", () => {
    console.log("Client disconnected:", socket.id);
  });
});

server.listen(5000, () => {
  console.log("Production backend server running on port 5000");
});