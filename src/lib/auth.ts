// lib/auth.ts
import { cookies } from 'next/headers';
import { jwtVerify, SignJWT } from 'jose';
import ImageKit from 'imagekit';

const secretKey = new TextEncoder().encode(process.env.AUTH_SECRET);

export interface Session {
  user: {
    id: string;
    email: string;
    name: string;
    role: 'admin' | 'editor';
  };
}

// Session management
export async function getSession(): Promise<Session | null> {
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get('session')?.value;

  if (!sessionCookie) return null;

  try {
    const { payload } = await jwtVerify(sessionCookie, secretKey, {
      algorithms: ['HS256'],
    });

    return {
      user: {
        id: payload.id as string,
        email: payload.email as string,
        name: payload.name as string,
        role: payload.role as 'admin' | 'editor',
      },
    };
  } catch (error) {
    console.error('Session verification failed:', error);
    return null;
  }
}

export async function createSession(user: Session['user']) {
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

  const sessionToken = await new SignJWT({
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setExpirationTime('7d')
    .sign(secretKey);

  const cookieStore = await cookies();
  cookieStore.set('session', sessionToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    expires: expiresAt,
    sameSite: 'lax',
    path: '/',
  });
}

export async function destroySession() {
  const cookieStore = await cookies();
  cookieStore.delete('session');
}

// ImageKit authentication
export async function getImageKitClient(): Promise<ImageKit> {
  const session = await getSession();
  
  if (!session) {
    throw new Error('Unauthorized: No valid session');
  }

  if (!process.env.IMAGEKIT_PRIVATE_KEY || !process.env.IMAGEKIT_PUBLIC_KEY || !process.env.IMAGEKIT_URL_ENDPOINT) {
    throw new Error('ImageKit configuration missing');
  }

  return new ImageKit({
    publicKey: process.env.IMAGEKIT_PUBLIC_KEY,
    privateKey: process.env.IMAGEKIT_PRIVATE_KEY,
    urlEndpoint: process.env.IMAGEKIT_URL_ENDPOINT,
  });
}

export async function generateImageKitAuth() {
  const session = await getSession();
  if (!session) throw new Error('Unauthorized');

  const imagekit = await getImageKitClient();
  return imagekit.getAuthenticationParameters();
}