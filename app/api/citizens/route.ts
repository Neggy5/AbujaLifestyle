import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

async function ensureSchema(
  pool: NonNullable<ReturnType<typeof db>>
) {
  await pool.query(`
    CREATE EXTENSION IF NOT EXISTS pgcrypto;

    CREATE TABLE IF NOT EXISTS citizens (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      username VARCHAR(24) NOT NULL UNIQUE,
      avatar VARCHAR(8) NOT NULL DEFAULT '🧑🏾',
      district VARCHAR(32) NOT NULL DEFAULT 'Wuse',
      wallet INTEGER NOT NULL DEFAULT 25000 CHECK (wallet >= 0),
      job VARCHAR(80),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE INDEX IF NOT EXISTS citizens_district_idx
      ON citizens(district);
  `);
}

export async function GET() {
  const pool = db();

  if (!pool) {
    return NextResponse.json({
      citizens: [],
      database: false,
    });
  }

  try {
    await ensureSchema(pool);

    const { rows } = await pool.query(`
      SELECT
        id,
        username,
        avatar,
        district,
        wallet,
        job,
        created_at
      FROM citizens
      ORDER BY created_at DESC
      LIMIT 100
    `);

    return NextResponse.json({
      citizens: rows,
      database: true,
    });
  } catch (error) {
    console.error('[citizens GET]', error);

    return NextResponse.json(
      { error: 'Database unavailable.' },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);

  const username = String(body?.username ?? '')
    .trim()
    .slice(0, 24);

  const avatar = String(body?.avatar ?? '🧑🏾')
    .slice(0, 8);

  if (!username || username.length < 2) {
    return NextResponse.json(
      {
        error: 'Username must be at least 2 characters.',
      },
      { status: 400 }
    );
  }

  const pool = db();

  if (!pool) {
    return NextResponse.json(
      {
        citizen: {
          username,
          avatar,
          district: 'Wuse',
          wallet: 25000,
          job: null,
        },
        database: false,
      },
      { status: 201 }
    );
  }

  try {
    // Make sure the PostgreSQL table exists before inserting.
    await ensureSchema(pool);

    const { rows } = await pool.query(
      `
        INSERT INTO citizens (
          username,
          avatar
        )
        VALUES ($1, $2)
        RETURNING
          id,
          username,
          avatar,
          district,
          wallet,
          job,
          created_at
      `,
      [username, avatar]
    );

    return NextResponse.json(
      {
        citizen: rows[0],
        database: true,
      },
      { status: 201 }
    );
  } catch (error: any) {
    console.error('[citizens POST]', error);

    // PostgreSQL unique constraint.
    if (error?.code === '23505') {
      return NextResponse.json(
        {
          error: 'That citizen name is already taken.',
        },
        { status: 409 }
      );
    }

    return NextResponse.json(
      {
        error: 'Could not create citizen.',
      },
      { status: 500 }
    );
  }
}
