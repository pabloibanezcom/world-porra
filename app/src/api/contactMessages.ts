import { ContactMessageResponse, ContactMessagesResponse, ContactMessageStatus } from '../types';
import { apiClient } from './client';

export async function createContactMessage(subject: string, message: string): Promise<ContactMessageResponse> {
  const { data } = await apiClient.post<ContactMessageResponse>('/contact-messages', { subject, message });
  return data;
}

export async function fetchMyContactMessages(): Promise<ContactMessagesResponse> {
  const { data } = await apiClient.get<ContactMessagesResponse>('/contact-messages');
  return data;
}

export async function replyToContactMessage(messageId: string, message: string): Promise<ContactMessageResponse> {
  const { data } = await apiClient.post<ContactMessageResponse>(`/contact-messages/${messageId}/replies`, { message });
  return data;
}

export async function fetchAdminContactMessages(status?: ContactMessageStatus): Promise<ContactMessagesResponse> {
  const { data } = await apiClient.get<ContactMessagesResponse>('/contact-messages/admin', {
    params: status ? { status } : undefined,
  });
  return data;
}

export async function updateAdminContactMessageStatus(
  messageId: string,
  status: ContactMessageStatus
): Promise<ContactMessageResponse> {
  const { data } = await apiClient.patch<ContactMessageResponse>(`/contact-messages/admin/${messageId}`, { status });
  return data;
}
