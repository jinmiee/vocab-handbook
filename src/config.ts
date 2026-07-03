// 앱 이름. 다른 이름으로 쓰고 싶다면
// .env.local에 NEXT_PUBLIC_APP_TITLE=원하는이름 을 추가하면 된다.
export const APP_TITLE = process.env.NEXT_PUBLIC_APP_TITLE || '개발 단어장';
export const APP_SHORT_TITLE = process.env.NEXT_PUBLIC_APP_SHORT_TITLE || '단어장';
export const APP_DESCRIPTION = '아이폰 모바일 학습용 개발 용어 단어장';
