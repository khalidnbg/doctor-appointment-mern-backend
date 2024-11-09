import validator from "validator";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { v2 as cloudinary } from "cloudinary";

import userModel from "../models/userModel.js";
import doctorModel from "../models/doctorModel.js";
import appointmentModel from "../models/appointmentModel.js";

// api to register user
const registerUser = async (req, res) => {
  try {
    const { name, email, password } = req.body;

    if (!name || !email || !password) {
      return res.json({ success: false, message: "Missing details" });
    }

    if (!validator.isEmail(email)) {
      return res.json({ success: false, message: "Enter a valid email" });
    }

    if (password.length < 8) {
      return res.json({ success: false, message: "Enter a strong password" });
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const userData = {
      name,
      email,
      password: hashedPassword,
    };

    const newUser = new userModel(userData);
    const user = await newUser.save();

    // create a new token
    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET);
    res.json({ success: true, token });
  } catch (error) {
    console.log(error);
    res.json({ success: false, error: error.message });
  }
};

// api to login user
const loginUser = async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = await userModel.findOne({ email });
    if (!user) {
      return res.json({ success: false, message: "User does not exist!" });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      res.json({ success: false, message: "Invalid credentials!" });
    }
    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET);
    res.json({ success: true, token });
  } catch (error) {
    console.log(error);
    res.json({ success: false, error: error.message });
  }
};

// api to get user profile
const getProfile = async (req, res) => {
  try {
    const { userId } = req.body;
    const userData = await userModel.findById(userId).select("-password");

    res.json({ success: true, userData });
  } catch (error) {
    console.log(error);
    res.json({ success: false, error: error.message });
  }
};

// api to update user profile
const updateProfile = async (req, res) => {
  try {
    const { userId, name, phone, address, dob, gender } = req.body;
    const imageFile = req.file;

    if (!name || !phone || !dob || !gender) {
      return res.json({ success: false, message: "Data missing" });
    }

    await userModel.findByIdAndUpdate(userId, {
      name,
      phone,
      address: JSON.parse(address),
      dob,
      gender,
    });

    if (imageFile) {
      // upload image to cloudinary
      const imageUpload = await cloudinary.uploader.upload(imageFile.path, {
        resource_type: "image",
      });
      const imageUrl = imageUpload.secure_url;

      await userModel.findByIdAndUpdate(userId, { image: imageUrl });
    }

    res.json({ success: true, message: "Profile updated successfully" });
  } catch (error) {
    console.log(error);
    res.json({ success: false, error: error.message });
  }
};

// api to book appointment
const bookAppointment = async (req, res) => {
  try {
    // Destructure request body to extract userId, docId, slotDate, and slotTime
    const { userId, docId, slotDate, slotTime } = req.body;

    // Fetch doctor data by doctor ID, excluding password for security
    const docData = await doctorModel.findById(docId).select("-password");

    // Check if the doctor is marked as available; if not, return an error response
    if (!docData) {
      return res.json({ success: false, message: "Doctor not available" });
    }

    // Retrieve the doctor's booked slots data
    let slots_booked = docData.slots_booked;

    // Check if there are already slots booked on the requested slot date
    if (slots_booked[slotDate]) {
      // If the slot date exists, check if the specific slot time is already taken
      if (slots_booked[slotDate].includes(slotTime)) {
        // If the slot time is already booked, return an error response
        return res.json({ success: false, message: "Slot not available" });
      } else {
        // If the slot time is free, add it to the booked slots for that date
        slots_booked[slotDate].push(slotTime);
      }
    } else {
      // If no slots are booked for the requested date, initialize it with an empty array
      slots_booked[slotDate] = [];
      // Add the requested slot time to the newly created date array
      slots_booked[slotDate].push(slotTime);
    }

    // Fetch user data by user ID, excluding password for security
    const userData = await userModel.findById(userId).select("-password");

    // Remove the slots_booked data from the doctor information to prevent it from being stored in the appointment
    delete docData.slots_booked;

    // Prepare appointment data with all necessary details
    const appointmentData = {
      userId, // ID of the user booking the appointment
      docId, // ID of the doctor being booked
      userData, // User data object without password
      docData, // Doctor data object without password or booked slots
      amount: docData.fees, // Appointment fees from doctor's data
      slotTime, // Requested time of the slot
      slotDate, // Requested date of the slot
      date: Date.now(), // Current date/time as the appointment booking timestamp
    };

    // Create a new appointment document using the appointment data
    const newAppointment = new appointmentModel(appointmentData);
    // Save the appointment document to the database
    await newAppointment.save();

    // Update the doctor's booked slots data to include the newly booked slot
    await doctorModel.findByIdAndUpdate(docId, { slots_booked });

    // Send a success response confirming the appointment booking
    res.json({ success: true, message: "Appointment booked" });
  } catch (error) {
    // Log any errors that occur and send an error response
    console.log(error);
    res.json({ success: false, error: error.message });
  }
};

export { registerUser, loginUser, getProfile, updateProfile, bookAppointment };
