import { db } from '@/lib/backend/client';


// Determine user role after login
// admin > Trainer row by email > Director row by email > student
export async function determineUserRole(user) {
  if (!user) return 'student';
  
  // Check if admin
  if (user.role === 'admin') return 'admin';
  
  // Check if director by email match
  try {
    const directors = await db.entities.Director.filter({ email: user.email });
    if (directors && directors.length > 0) return 'director';
  } catch (e) { /* ignore */ }
  
  return 'student';
}

export function isAdmin(role) {
  return role === 'admin';
}

export function isDirector(role) {
  return role === 'director';
}