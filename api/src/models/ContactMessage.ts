import mongoose, { Document, Schema, Types } from 'mongoose';

export type ContactMessageStatus = 'new' | 'read' | 'resolved';

export interface IContactMessage extends Document {
  userId: Types.ObjectId;
  subject: string;
  message: string;
  status: ContactMessageStatus;
  createdAt: Date;
  updatedAt: Date;
}

const contactMessageSchema = new Schema<IContactMessage>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    subject: { type: String, required: true, trim: true, maxlength: 120 },
    message: { type: String, required: true, trim: true, maxlength: 2000 },
    status: {
      type: String,
      enum: ['new', 'read', 'resolved'],
      default: 'new',
      index: true,
    },
  },
  { timestamps: true }
);

contactMessageSchema.index({ createdAt: -1 });

export const ContactMessage = mongoose.model<IContactMessage>('ContactMessage', contactMessageSchema);
