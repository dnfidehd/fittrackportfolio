import { Member } from '../types';

export type AppRole = 'user' | 'subcoach' | 'coach' | 'admin' | 'superadmin' | string;

const STAFF_ROLES = new Set<AppRole>(['subcoach', 'coach', 'admin', 'superadmin']);
const FULL_ACCESS_ROLES = new Set<AppRole>(['coach', 'admin', 'superadmin']);

export const isUserRole = (role?: AppRole | null): boolean => role === 'user';

export const isStaffRole = (role?: AppRole | null): boolean => Boolean(role && STAFF_ROLES.has(role));

export const hasFullAdminAccess = (role?: AppRole | null): boolean => Boolean(role && FULL_ACCESS_ROLES.has(role));

export const isSuperAdminRole = (role?: AppRole | null): boolean => role === 'superadmin';

export const isStaffMember = (user?: Member | null): boolean => isStaffRole(user?.role);

export const hasFullAccess = (user?: Member | null): boolean => hasFullAdminAccess(user?.role);
