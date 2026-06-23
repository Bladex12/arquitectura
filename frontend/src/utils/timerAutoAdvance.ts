import { sessionsAPI } from '@/services';

export const advanceActivityOnTimerExpiration = async (gameSessionId: number | string) => {
  try {
    const response = await sessionsAPI.nextActivity(gameSessionId);

    if (typeof window !== 'undefined' && window.location.pathname.startsWith('/tablet')) {
      window.location.reload();
    }

    return response;
  } catch (error) {
    console.error('[timerAutoAdvance] Error advancing activity on timer expiration:', error);
    return null;
  }
};
