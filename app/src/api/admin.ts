import { apiClient } from './client';
import { AdminUserDetail, AdminUsersResponse } from '../types';

export async function fetchAdminUsers(search?: string): Promise<AdminUsersResponse> {
  const { data } = await apiClient.get<AdminUsersResponse>('/admin/users', {
    params: search ? { search } : undefined,
  });
  return data;
}

export async function fetchAdminUserDetail(userId: string): Promise<AdminUserDetail> {
  const { data } = await apiClient.get<AdminUserDetail>(`/admin/users/${userId}`);
  return data;
}

export async function deleteAdminUser(userId: string, confirmation: string): Promise<void> {
  await apiClient.delete(`/admin/users/${userId}`, { data: { confirmation } });
}
