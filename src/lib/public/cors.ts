import { NextResponse } from 'next/server'

const ALLOWED_ORIGINS = new Set([
  'https://contact.sda-nord.com',
  'http://localhost:3003',
])

export function corsHeaders(origin: string | null): Record<string, string> {
  const allow = origin && ALLOWED_ORIGINS.has(origin) ? origin : 'https://contact.sda-nord.com'
  return {
    'Access-Control-Allow-Origin': allow,
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Accept',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin',
  }
}

export function jsonWithCors(data: unknown, origin: string | null, init?: { status?: number }) {
  return NextResponse.json(data, {
    status: init?.status ?? 200,
    headers: corsHeaders(origin),
  })
}

export function preflightWithCors(origin: string | null) {
  return new NextResponse(null, { status: 204, headers: corsHeaders(origin) })
}
