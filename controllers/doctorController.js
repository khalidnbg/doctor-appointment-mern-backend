import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";

import doctorModel from "../models/doctorModel.js";

const changeAvailability = async (req, res) => {
  try {
    const { docId } = req.body;

    const docData = await doctorModel.findById(docId);
    await doctorModel.findByIdAndUpdate(docId, {
      available: !docData.available,
    });
    res.json({ success: true, message: "availability Changed" });
  } catch (error) {
    console.log(error);
    res.json({ success: false, message: error.message });
  }
};

const doctorList = async (req, res) => {
  try {
    const doctors = await doctorModel.find({}).select(["-password", "-email"]);
    res.json({ success: true, doctors });
  } catch (error) {
    console.log(error);
    res.json({ success: false, message: error.message });
  }
};

const loginDoctor = async (req, res) => {
  try {
    const { email, password } = req.body;
    const doctor = await doctorModel.findOne({ email });
    if (!doctor) {
      return res.json({ success: false, message: "Invalid credentials" });
    }

    const isMatch = await bcrypt.compare(password, doctor.password);
    if (isMatch) {
      const token = jwt.sign({ id: doctor._id }, process.env.JWT_SECRET);

      res.json({ success: true, token });
    } else {
      return res.json({ success: false, message: "Invalid doc credentials" });
    }
  } catch (error) {
    console.log(error);
    res.json({ success: false, message: error.message });
  }
};

export { changeAvailability, doctorList, loginDoctor };

name;
("Dr. Richard James");
email;
("doc1@gmail.com");
password;
("$2b$10$cYSEot3RG1uBGpingg18tOml4ppYTTgwILBIKYcEHwiyRg0wMbEzG");
image;
("https://res.cloudinary.com/deqqp45mt/image/upload/v1730827935/mvxgwdxv…");
speciality;
("General physician");
degree;
("MBBS");
experience;
("4 Year");
about;
("Dr. Davis has a strong commitment to delivering comprehensive medical …");
available;
false;
fees;
60;

address;
Object;
date;
1730827946079;

slots_booked;
Object;
