import mongoose, { mongo } from "mongoose";

const connectDB = async () => {
  mongoose.connection.on("connected", () => console.log("db connected"));

  await mongoose.connect(`${process.env.MONGODB_URI}/booking-appointments`);
};

export default connectDB;
