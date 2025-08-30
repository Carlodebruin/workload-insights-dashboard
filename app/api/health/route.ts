import { NextRequest, NextResponse } from "next/server";
import { prisma, connectionPool } from "../../../lib/prisma";
import { db } from "../../../lib/db-wrapper";

export async function GET(request: NextRequest) {
  try {
    // Test database connection with resilience wrapper
    const startTime = Date.now();
    const isConnected = await db.healthCheck(3000);
    const connectionTime = Date.now() - startTime;
    
    return NextResponse.json({
      status: isConnected ? "healthy" : "unhealthy",
      database: {
        connected: isConnected,
        connectionTime: `${connectionTime}ms`
      },
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV || "unknown"
    }, { 
      status: isConnected ? 200 : 503,
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "no-cache"
      }
    });
  } catch (error) {
    return NextResponse.json({
      status: "error",
      error: error instanceof Error ? error.message : "Unknown error",
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
}
