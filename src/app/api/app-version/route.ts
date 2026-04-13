import { NextResponse } from 'next/server'

export async function GET() {
  return NextResponse.json({
    minVersion: process.env.APP_MIN_VERSION ?? '1.0.0',
    downloadUrl: process.env.APP_DOWNLOAD_URL ?? '',
  })
}
