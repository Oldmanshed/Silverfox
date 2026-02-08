import { OpenClawStatus } from '@silverfox/shared-types';

const OPENCLAW_URL = process.env.OPENCLAW_URL || 'http://localhost:8080';
const SESSION_KEY = process.env.SESSION_KEY || 'agent:main:main';

interface SessionStatusResponse {
  runtime: string;
  channel?: string;
  model?: string;
  totalTokens: number;
}

export async function getSessionStatus(): Promise<OpenClawStatus | null> {
  try {
    const response = await fetch(`${OPENCLAW_URL}/api/sessions/${encodeURIComponent(SESSION_KEY)}/status`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const data = await response.json() as SessionStatusResponse;
    
    return {
      connected: true,
      sessionKey: SESSION_KEY,
      model: data.model,
      totalTokens: data.totalTokens || 0,
      runtime: data.runtime || 'unknown',
      channel: data.channel,
    };
  } catch (error) {
    console.error('Failed to fetch session status:', error);
    return {
      connected: false,
      sessionKey: SESSION_KEY,
      totalTokens: 0,
      runtime: 'unknown',
    };
  }
}

export async function sendMessage(content: string): Promise<boolean> {
  try {
    const response = await fetch(`${OPENCLAW_URL}/api/sessions/send`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sessionKey: SESSION_KEY,
        message: content,
      }),
    });

    return response.ok;
  } catch (error) {
    console.error('Failed to send message:', error);
    return false;
  }
}

interface HistoryMessage {
  role: string;
  content: string;
  tokens?: number;
}

interface SessionHistoryResponse {
  messages: HistoryMessage[];
}

export async function getSessionHistory(limit: number = 10): Promise<SessionHistoryResponse | null> {
  try {
    const response = await fetch(
      `${OPENCLAW_URL}/api/sessions/${encodeURIComponent(SESSION_KEY)}/history?limit=${limit}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      }
    );

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    return await response.json() as SessionHistoryResponse;
  } catch (error) {
    console.error('Failed to fetch history:', error);
    return null;
  }
}
