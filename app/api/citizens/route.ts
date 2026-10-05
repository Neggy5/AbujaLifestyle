import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET() {
  const pool = db();
  if (!pool) return NextResponse.json({ citizens: [], database: false });
  const { rows } = await pool.query(`SELECT id, username, avatar, district, wallet, job, created_at FROM citizens ORDER BY created_at DESC LIMIT 100`);
  return NextResponse.json({ citizens: rows, database: true });
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const username = String(body?.username ?? '').trim().slice(0, 24);
  const avatar = String(body?.avatar ?? '🧑🏾').slice(0, 8);
  if (!username || username.length < 2) return NextResponse.json({ error: 'Username must be at least 2 characters.' }, { status: 400 });
  const pool = db();
  if (!pool) return NextResponse.json({ citizen: { username, avatar, district: 'Wuse', wallet: 25000, job: null }, database: false });
  try {
    const { rows } = await pool.query(`INSERT INTO citizens (username, avatar) VALUES ($1,$2) RETURNING id, username, avatar, district, wallet, job, created_at`, [username, avatar]);
    return NextResponse.json({ citizen: rows[0], database: true }, { status: 201 });
  } catch (e: any) {
    if (e?.code === '23505') return NextResponse.json({ error: 'That citizen name is already taken.' }, { status: 409 });
    return NextResponse.json({ error: 'Could not create citizen.' }, { status: 500 });
  }
}
