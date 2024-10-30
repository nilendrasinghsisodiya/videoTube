import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { User } from "../models/user.model.js";
import { uploadOnCloudinary } from "../utils/cloudinary.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { JsonWebTokenError as jwt } from "jsonwebtoken";

const registerUser = asyncHandler(async (req, res) => {
  // get user details

  // validation -not empty
  // check if exists _ username, email
  // check if avtar and coverimage
  // upload them to cloudinary
  // put limits to register
  //create user object - create entry n db
  // remove password  and refresh token field from response
  // check for user creation
  // return res

  const { fullname, username, email, password } = req.body;
  console.log("email: ", email);

  if (
    [fullname, email.username, password].some((field) => field?.trim() === "")
  ) {
    throw new ApiError(400, "somefields are empty");
  }

  const existedUser = await User.findOne({
    $or: [{ username }, { email }],
  });

  if (existedUser) {
    throw new ApiError(409, "User with this email or username exists");
  }
  console.log("user Check ", existedUser);
  console.log(req.files);

  const avatarLocalPath = req.files?.avatar[0]?.path;

  console.log(avatarLocalPath);

  let coverImageLocalPath;

  if (
    req.files &&
    Array.isArray(req.files.coverImage) &&
    req.files.coverImage.length > 0
  ) {
    coverImageLocalPath = req.files.coverImage[0]?.path;
  }

  console.log(req.files, avatarLocalPath, coverImageLocalPath);
  if (!avatarLocalPath) {
    throw new ApiError(400, "Avatar file needed");
  }

  const avatar = await uploadOnCloudinary(avatarLocalPath);
  console.log("avatar upload result on cloudinary : ", avatar);
  const coverImage = await uploadOnCloudinary(coverImageLocalPath);
  console.log("coverImage upload result : ", coverImage);
  if (!avatar) {
    throw new ApiError(400, "Avatar file is required");
  }

  const user = await User.create({
    fullname,
    avatar: avatar.url,
    coverImage: coverImage.url,
    email,
    password,
    username: username.toLowerCase(),
  });

  const userExist = await User.findById(user._id).select(
    "-password -refreshToken -watchHistory"
  );

  if (!userExist) {
    throw new ApiError(500, "Something went wrong while registering the user");
  }
  console.log("userCreated with data: ", userExist);
  return res
    .status(201)
    .json(new ApiResponse(200, userExist, "User created Succesfully"));
});

const generateAccessAndRefereshTokens = async (userId) => {
  try {
    const user = await User.findById(userId);
    const accessToken = user.generateAcessToken();
    const refereshToken = user.generateRefreshToken();

    console.log(accessToken, refereshToken);
    user.refershToken = refereshToken;
    await user.save({ validateBeforeSave: false });

    return { accessToken, refereshToken };
  } catch (error) {
    console.log(error);
    throw new ApiError(
      500,
      "something went wrong while generating referesh and access token"
    );
  }
};

const loginUser = asyncHandler(async (req, res) => {
  // get data form req -> data
  // username and email get any one
  // find the user
  // if user validate password
  // if not user throw error
  // if password matches login user
  // if password does not matches then throw error
  // send cookie and send response
  console.log(req.body);

  const { email, username, password } = req.body;

  if (!email && !username) {
    throw new ApiError(400, "username and email is required");
  }

  if (email) {
    let userExist = await User.findOne({
      $or: [{ username }, { email }],
    });
    if (userExist) {
      const validPassword = await userExist.isPasswordCorrect(password);
      if (validPassword) {
        const { accessToken, refereshToken } =
          await generateAccessAndRefereshTokens(userExist._id);

        const loggedInUser = await User.findById(userExist._id).select(
          "-password -refereshToken"
        );

        const options = {
          httpOnly: true,
          secure: true,
        };

        return res
          .status(200)
          .cookie("accessToken", accessToken, options)
          .cookie("refershToken", refereshToken, options)
          .json(
            new ApiResponse(
              200,
              {
                user: loggedInUser,
                refereshToken,
                accessToken,
              },
              "User logedIN successfully "
            )
          );
      } else {
        throw new ApiError(400, "password is incorrect");
      }
    } else {
      throw new ApiError(400, "user does not exist");
    }
  }
});

const logoutUser = asyncHandler(async (req, res) => {
  const UserToLogout = await User.findByIdAndUpdate(
    req.user._id,
    {
      $set: {
        refreshToken: undefined,
      },
    },
    {
      new: true,
    }
  );

  const options = {
    httpOnly: true,
    secure: true,
  };

  consle.log(UserToLogout);

  return res
    .status(200)
    .clearCookie("accessToken", options)
    .clearCookie("refershToken", options)
    .json(new ApiResponse(200, {}, "user logged out"));
});

const refreshAccessToken = asyncHandler(async (req, res) => {
  try {
    const incomingRefreshToekn =
      req.cookies.refereshToken || req.body.refereshToken;
    if (!incomingRefreshToekn) {
      throw new ApiError(401, "unauthorized request");
    }

    const decodedToken = await jwt.verify(
      incomingRefreshToekn,
      process.env.REFRESH_TOKEN_SECRET
    );

    const user = await User.findById(decodedToken?._id);

    if (!user) {
      throw new ApiError(401, "Invalid refersh token");
    }

    if (user?.refreshToken !== incomingRefreshToekn) {
      throw new ApiError(401, "Refresh token is expired or used");
    }

    const options = {
      httpOnly: true,
      secure: true,
    };

    const { accessToken, newRefreshToken } =
      await generateAccessAndRefereshTokens(user._id);

    return res
      .status(200)
      .cookie("accessToken", accessToken)
      .cookie("refreshToken", newRefreshToken)
      .json(
        new ApiResponse(
          200,
          {
            accessToken: accessToken,
            refreshToken: newRefreshToken,
          },
          "Access token refresh"
        )
      );
  } catch (error) {
    console.log(error);
    throw new ApiError(
      401,
      error.message || "something went wrong when generating tokens"
    );
  }
});

const changeCurrentPassword = asyncHandler(async (req, res) => {
  const { oldPassword, newPassword } = req.body;
  const user = await User.findById(req.user?._id);
  const isPasswordCorrect = await user.isPasswordCorrect(oldPassword);

  if (!isPasswordCorrect) {
    throw new ApiError(401, "old password not correct");
  }

  user.password = newPassword;
  await user.save({ validateBeforeSave: false });

  return res
    .status(200)
    .json(new ApiResponse(200, {}, "password saved successfully"));
});

const getCurrentUser = asyncHandler(async (req, res) => {
  return res
    .status(200)
    .json(new ApiResponse(200, req.user, "current user fetched successfully"));
});

const updateAccontDetails = asyncHandler(async (req, res) => {
  const { fullName, email } = req.body;
  if (!fullName || !email) {
    throw new ApiError(400, "field are empty");
  }

  const user = await User.findByIdAndUpdate(
    req.user?._id,
    {
      $set: {
        fullName,
        email,
      },
    },
    { new: true }
  ).select("--password");

  return res
    .status(200)
    .json(new ApiResponse(200, user, "user details updated sucessfully"));
});

const updateUserAvatar = asyncHandler(async (req, res) => {
  const avatarLocalPath = req.files?.path;
  if (!avatarLocalPath) {
    throw new ApiError(400, "avatar file missing");
  }
  const avatar = await uploadOnCloudinary(avatarLocalPath);
  if (!avatar.url) {
    throw new ApiError(400, "Error while uploading on avatar");
  }
  const user = await User.findByIdAndUpdate(
    req.user?._id,
    {
      $set: {
        avatar: avatar.url,
      },
    },
    { new: true }
  ).select("-password,-refreshToken");

  return res
    .status(200)
    .json(new ApiResponse(200, user, "User Avatar Updated Successfully"));
});
const updateUserCoverImage = asyncHandler(async (req, res) => {
  const coverImageLocalPath = req.files?.path;
  if (!coverImageLocalPath) {
    throw new ApiError(400, "cover image file missing");
  }
  const coverImage = await uploadOnCloudinary(coverImageLocalPath);
  if (!coverImage.url) {
    throw new ApiError(400, "Error while uploading on avatar");
  }
  const user = await User.findByIdAndUpdate(
    req.user?._id,
    {
      $set: {
        coverImage: coverImage.url,
      },
    },
    { new: true }
  ).select("-password,-refreshToken");

  return res
    .status(200)
    .json(new ApiResponse(200, user, "user cover image updated succesfully"));
});

export {
  registerUser,
  loginUser,
  logoutUser,
  refreshAccessToken,
  changeCurrentPassword,
  getCurrentUser,
  updateUserAvatar,
  updateUserCoverImage
};