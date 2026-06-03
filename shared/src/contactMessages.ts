export type ContactMessageStatus = 'new' | 'read' | 'resolved';

export interface ContactMessageUser {
  id: string;
  _id?: string;
  name: string;
  email: string;
  avatarUrl: string;
}

export interface ContactMessage {
  id: string;
  _id: string;
  subject: string;
  message: string;
  status: ContactMessageStatus;
  createdAt: string;
  updatedAt: string;
  user: ContactMessageUser | null;
}

export interface ContactMessageResponse {
  message: ContactMessage;
}

export interface ContactMessagesResponse {
  messages: ContactMessage[];
}
