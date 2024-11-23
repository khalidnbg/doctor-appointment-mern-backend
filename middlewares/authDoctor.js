import jwt from "jsonwebtoken";

// doctor authentication middleware
const authDoctor = async (req, res, next) => {
  try {
    // Get the dToken from headers
    const { dToken } = req.headers;
    if (!dToken) {
      return res.json({
        success: false,
        message: "Not authorized. Login again",
      });
    }

    // Verify the dToken and decode the email
    const dTokenDecode = jwt.verify(dToken, process.env.JWT_SECRET);

    // get the doctor id from the dToken
    console.log(dTokenDecode);
    req.body.docId = dTokenDecode.id;

    next();
  } catch (error) {
    console.log(error);
    res.json({ success: false, message: "Error: " + error.message });
  }
};

export default authDoctor;
