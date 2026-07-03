'use client';

import { useEffect } from 'react';
import { getTodayKey } from 'src/lib/study';

const ENABLED_KEY = 'vocab_notification_enabled';
const LAST_NOTIFIED_KEY = 'vocab_notification_last_date';

export function isNotificationSupported() {
  return typeof window !== 'undefined' && 'Notification' in window;
}

export function isReviewReminderEnabled() {
  if (typeof window === 'undefined') return false;
  return localStorage.getItem(ENABLED_KEY) === 'true';
}

// 알림 권한을 요청하고, 허용되면 옵트인 상태를 localStorage에 저장한다.
export async function enableReviewReminder(): Promise<boolean> {
  if (!isNotificationSupported()) return false;
  const permission = await Notification.requestPermission();
  const granted = permission === 'granted';
  localStorage.setItem(ENABLED_KEY, granted ? 'true' : 'false');
  return granted;
}

export function disableReviewReminder() {
  if (typeof window === 'undefined') return;
  localStorage.setItem(ENABLED_KEY, 'false');
}

// 오늘 처음 앱을 열었고 복습할 단어가 있을 때, 하루 한 번만 로컬 알림을 띄운다.
// 브라우저 Notification API 기반 로컬 알림이라 앱을 열어야 동작하며,
// 앱이 완전히 꺼진 상태에서 깨우려면 서버 푸시가 필요하다는 한계가 있다.
export function useReviewReminder(dueCount: number, isInitialized: boolean) {
  useEffect(() => {
    if (!isInitialized || dueCount <= 0) return;
    if (!isNotificationSupported() || Notification.permission !== 'granted') return;
    if (!isReviewReminderEnabled()) return;

    const today = getTodayKey();
    if (localStorage.getItem(LAST_NOTIFIED_KEY) === today) return;
    if (document.visibilityState !== 'visible') return;

    try {
      new Notification('오늘의 복습 단어가 있어요', {
        body: `${dueCount}개의 단어를 복습할 시간이에요.`,
        tag: 'vocab-review-reminder',
      });
      localStorage.setItem(LAST_NOTIFIED_KEY, today);
    } catch (e) {
      console.error('Failed to show review reminder notification:', e);
    }
  }, [dueCount, isInitialized]);
}
