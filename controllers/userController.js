import validator from "validator";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { v2 as cloudinary } from "cloudinary";
import Stripe from "stripe";

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

// get all appointment by user for frontend my-appointment page
const listAppointment = async (req, res) => {
  try {
    const { userId } = req.body;
    const appointments = await appointmentModel.find({ userId });
    res.json({ success: true, appointments });
  } catch (error) {
    res.json({ success: false, error: error.message });
  }
};

// api to cancel appointment
const cancelAppointment = async (req, res) => {
  try {
    const { userId, appointmentId } = req.body;

    const appointmentData = await appointmentModel.findById(appointmentId);

    // check appointment user
    if (appointmentData.userId !== userId) {
      return res.json({ success: false, message: "Unauthorized action" });
    }

    await appointmentModel.findByIdAndUpdate(appointmentId, {
      cancelled: true,
    });

    // releasing doctor slot
    const { docId, slotDate, slotTime } = appointmentData;

    const doctorData = await doctorModel.findById(docId);

    let slots_booked = doctorData.slots_booked;

    slots_booked[slotDate] = slots_booked[slotDate].filter(
      (e) => e !== slotTime
    );

    await doctorModel.findByIdAndUpdate(docId, { slots_booked });

    res.json({ success: true, message: "Appointment cancelled" });
  } catch (error) {
    res.json({ success: false, error: error.message });
  }
};

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

const paymentStripe = async (req, res) => {
  try {
    const { appointmentId } = req.body;

    // Validate input
    if (!appointmentId) {
      return res.status(400).json({
        success: false,
        message: "Appointment ID is required.",
      });
    }

    // Fetch appointment data
    const appointmentData = await appointmentModel.findById(appointmentId);

    // Check if appointment exists and is valid
    if (!appointmentData || appointmentData.cancelled) {
      return res.status(404).json({
        success: false,
        message: "Appointment not found or already cancelled.",
      });
    }

    if (appointmentData.payment) {
      return res.status(400).json({
        success: false,
        message: "Payment already completed for this appointment.",
      });
    }

    // Check if the amount is valid
    if (!appointmentData.amount || appointmentData.amount <= 0) {
      return res.status(400).json({
        success: false,
        message: "Invalid appointment amount.",
      });
    }

    // Create Stripe session
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      line_items: [
        {
          price_data: {
            currency: process.env.CURRENCY || "usd",
            product_data: {
              name: `Appointment Payment #${appointmentId}`,
            },
            unit_amount: Math.round(appointmentData.amount * 100), // Stripe expects amount in cents
          },
          quantity: 1,
        },
      ],
      mode: "payment",
      success_url: `http://localhost:5173/payment-success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `http://localhost:5173/cancel`,
      metadata: {
        appointmentId: appointmentId,
      },
    });

    return res.status(200).json({
      success: true,
      sessionUrl: session.url,
      sessionId: session.id,
    });
  } catch (error) {
    console.error("Stripe error:", error.message);
    res.status(500).json({ success: false, message: "Internal Server Error" });
  }
};

// api to verify payment of stripe
const verifyStripe = async (req, res) => {
  try {
    const { session_id } = req.body;

    // Validate input
    if (!session_id) {
      return res.status(400).json({
        success: false,
        message: "Stripe session ID is required.",
      });
    }

    // Fetch session details
    const session = await stripe.checkout.sessions.retrieve(session_id);

    if (session.payment_status === "paid") {
      // Retrieve metadata containing the appointment ID
      const appointmentId = session.metadata.appointmentId;

      if (!appointmentId) {
        return res.status(400).json({
          success: false,
          message: "Appointment ID not found in session metadata.",
        });
      }

      // Update the appointment's payment status in the database
      const updatedAppointment = await appointmentModel.findByIdAndUpdate(
        appointmentId,
        { payment: true },
        { new: true } // Return the updated document
      );

      if (!updatedAppointment) {
        return res.status(404).json({
          success: false,
          message: "Appointment not found for update.",
        });
      }

      return res.status(200).json({
        success: true,
        message: "Payment verified and updated.",
        updatedAppointment,
      });
    } else {
      return res.status(400).json({
        success: false,
        message: "Payment verification failed or incomplete.",
      });
    }
  } catch (error) {
    console.error("Stripe verification error:", error.message);
    res.status(500).json({ success: false, message: "Internal Server Error" });
  }
};

export {
  registerUser,
  loginUser,
  getProfile,
  updateProfile,
  bookAppointment,
  listAppointment,
  cancelAppointment,
  paymentStripe,
  verifyStripe,
};
