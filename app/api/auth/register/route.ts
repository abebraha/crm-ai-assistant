import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/db';

export async function POST(req: NextRequest) {
  try {
    const { name, email, password } = await req.json() as {
      name?: string; email: string; password: string;
    };

    if (!email || !password) {
      return NextResponse.json({ error: 'Email and password are required' }, { status: 400 });
    }
    if (password.length < 8) {
      return NextResponse.json({ error: 'Password must be at least 8 characters' }, { status: 400 });
    }

    const existing = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
    if (existing) {
      return NextResponse.json({ error: 'An account with this email already exists' }, { status: 409 });
    }

    const hash = await bcrypt.hash(password, 12);
    const user = await prisma.user.create({
      data: { name, email: email.toLowerCase(), password: hash },
      select: { id: true, email: true, name: true },
    });

    return NextResponse.json({ user }, { status: 201 });
  } catch (err) {
    console.error('[register]', err);
    return NextResponse.json({ error: 'Registration failed' }, { status: 500 });
  }
}