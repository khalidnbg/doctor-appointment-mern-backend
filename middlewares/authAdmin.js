import jwt from "jsonwebtoken";

// Admin authentication middleware
const authAdmin = async (req, res, next) => {
  try {
    // Get the token from headers
    const { atoken } = req.headers;
    if (!atoken) {
      return res.json({
        success: false,
        message: "Not authorized. Login again",
      });
    }

    // Verify the token and decode the email
    const tokenDecode = jwt.verify(atoken, process.env.JWT_SECRET);

    // Check if the decoded email matches the admin email
    if (tokenDecode.email !== process.env.ADMIN_EMAIL) {
      return res.json({
        success: false,
        message: "Not authorized. Login again",
      });
    }

    next();
  } catch (error) {
    console.log(error);
    res.json({ success: false, message: "Error: " + error.message });
  }
};

export default authAdmin;
