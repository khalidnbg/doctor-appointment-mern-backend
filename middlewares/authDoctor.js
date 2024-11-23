import jwt from "jsonwebtoken";
const authDoctor = async (req, res, next) => {
  try {
    // Get the token from the Authorization header
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.json({
        success: false,
        message: "Not authorized. Login again.",
      });
    }

    // Extract the token from the Bearer header
    const dToken = authHeader.split(" ")[1];

    // Verify the token
    const dTokenDecode = jwt.verify(dToken, process.env.JWT_SECRET);
    if (!dTokenDecode) {
      return res.json({
        success: false,
        message: "Invalid token. Login again.",
      });
    }

    // Get the doctor ID from the decoded token
    req.body.docId = dTokenDecode.id;

    next();
  } catch (error) {
    console.log(error);
    res.json({ success: false, message: "Error: " + error.message });
  }
};

export default authDoctor;
