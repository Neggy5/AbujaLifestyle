import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
const jobs = [
  { id: 'tech', title: 'Tech Support', salary: 85000, district: 'Wuse' },
  { id: 'retail', title: 'Retail Associate', salary: 55000, district: 'Garki' },
  { id: 'hospitality', title: 'Hotel Crew', salary: 65000, district: 'Maitama' },
  { id: 'media', title: 'Media Assistant', salary: 70000, district: 'Jabi' },
  { id: 'shop', title: 'Shop Manager', salary: 60000, district: 'Gwarinpa' },
  { id: 'consultant', title: 'Consultant', salary: 100000, district: 'Asokoro' },
];
export async function GET() { return NextResponse.json({ jobs }); }
export async function POST(req: NextRequest) {
  const { citizenId, jobId } = await req.json().catch(() => ({}));
  const job = jobs.find(j => j.id === jobId);
  if (!job || !citizenId) return NextResponse.json({ error: 'Invalid job or citizen.' }, { status: 400 });
  const pool = db();
  if (!pool) return NextResponse.json({ job, database: false });
  const { rows } = await pool.query(`UPDATE citizens SET job=$1, updated_at=NOW() WHERE id=$2 RETURNING id, username, district, wallet, job`, [job.title, citizenId]);
  if (!rows[0]) return NextResponse.json({ error: 'Citizen not found.' }, { status: 404 });
  return NextResponse.json({ citizen: rows[0], job, database: true });
}
