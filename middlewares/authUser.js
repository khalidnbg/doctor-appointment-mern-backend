import jwt from "jsonwebtoken";

// user authentication middleware
const authUser = async (req, res, next) => {
  try {
    // Get the token from headers
    const { token } = req.headers;
    if (!token) {
      return res.json({
        success: false,
        message: "Not authorized. Login again",
      });
    }

    // Verify the token and decode the email
    const tokenDecode = jwt.verify(token, process.env.JWT_SECRET);

    // get the user id from the token
    req.body.userId = tokenDecode.id;

    next();
  } catch (error) {
    console.log(error);
    res.json({ success: false, message: "Error: " + error.message });
  }
};

export default authUser;
