import { Mongoose, Schema } from "mongoose";
import mongooseAggregatePaginate from "mongoose-aggregate-paginate-v2";

const commentSchema = new Schema(
  {
    content: {
      type: String,
      required: true,
    },
    video: {
      type: Schema.Types.ObjectId,
      ref: "Video",
    },
    owner: {
      type: Schema.Types.ObjectId,
      ref: "User",
    },
  },
  { timestamps: true }
);

Mongoose.plugin(mongooseAggregatePaginate);
commentSchema.methods.isOwner = function (userId) {
  return String(this.owner) === String(userId);
};
export const Comment = Mongoose.model("Comment", commentSchema);
