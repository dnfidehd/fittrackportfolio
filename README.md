# 🏋️‍♂️ FitTrack AI: Intelligent Fitness Management SaaS
> **"AI가 설계하고 관리가 자동화되는, 2040 세대를 위한 차별화된 피트니스 센터 운영 솔루션"**

[![Stack](https://img.shields.io/badge/Stack-FastAPI%20%7C%20React%20%7C%20PostgreSQL-3182F6)](https://github.com/dnfidehd/fittrackportfolio)
[![AI-Powered](https://img.shields.io/badge/AI-Gemini%20Flash%201.5-brightgreen)](https://fittrack-dashboard.render.com)

---

## 🚀 프로젝트 개요
**FitTrack AI**는 기존의 수동적이고 단순한 피트니스 센터 관리 도구를 넘어, **인공지능(Gemini)**을 활용해 운영 공정을 자동화하고 데이터 기반의 인사이트를 제공하는 **B2B SaaS 플랫폼**입니다. 

주 소비 주도층인 **203040 세대**의 니즈(성장 체감, 데이터 대시보드, 스마트한 예약)와 센터 운영자의 고충(복잡한 코치 배정, 재등록 관리)을 동시에 해결합니다.

---

## 🤖 AI & Vibe Coding Experience (핵심 역량)
본 프로젝트는 **AI와 대화하며 코드를 설계하고 구현하는 '바이브코딩(Vibe Coding)'** 방식을 적극 채택하여 개발되었습니다.

*   **AI 자동 코칭 배정 (BETA)**: 관리자의 직관에 의존하던 코치 배정 공정을 소프트웨어화했습니다. Gemini API를 연동하여 사용자의 자연어 규칙(예: "오전은 A코치 위주, 오후는 로테이션")을 분석하고 한 달간의 스케줄을 5초 이내에 자동 생성합니다.
*   **개발 효율 극대화**: Cursor, Claude Code 등의 AI 도구를 활용하여 기획부터 배포까지의 개발 리드타임을 약 50% 단축했으며, 복잡한 REST API 명세와 DB 아키텍처를 AI와 협력하여 설계했습니다.

---

## ✨ 핵심 기능 (Key Features)

### 1. SaaS 기반 지점 통합 관리
*   **멀티 테넌시(Multi-tenancy)**: 슈퍼어드민을 통한 전국 지점(Gym) 구독 관리 및 지점별 매출 통계 시각화.
*   **RBAC 권한 제어**: 총관리자, 지점장, 코치, 일반 회원별 엄격한 API 접근 제어(Depends 기반 보안).

### 2. 비즈니스 자동화 & 보안
*   **스마트 CRM**: 회원 만료 예정 및 미출석 데이터를 기반으로 한 자동 알림 체계.
*   **보안 결제 검증**: 클라이언트가 전송한 결제 금액을 서버사이드에서 정가표(MembershipProduct)와 대조하여 변조 요청을 원천 차단하는 로직 구현.

### 3. 게스트 대항전 & 리더보드
*   **게스트 입장 시스템**: 별도의 회원가입 없이 패스코드를 통해 대회에 참여하고 자신의 기록을 실시간 리더보드로 확인하는 참여형 UI.
*   **데이터 무결성**: 수천 건의 기록 데이터를 정렬하고 성별/종별 필터링을 제공하는 고성능 리더보드 API.

---

## 🛠 기술 스택 (Tech Stack)

### Backend
- **Python / FastAPI**: 비동기 처리를 통한 빠른 API 응답성 확보
- **SQLAlchemy / Alembic**: PostgreSQL 및 SQLite 호환 DB 레이어 및 마이그레이션 관리
- **Google Gemini SDK**: 자연어 처리 기반의 스케줄링 엔진 구축

### Frontend
- **React / TypeScript**: 안정적인 타입 시스템 기반의 웹 애플리케이션
- **Tailwind CSS / Toss Design Style**: 심플하고 세련된 UI/UX 구현
- **Axios / React Hot Toast**: 효율적인 API 통신 및 사용자 피드백 알림

---
## 테스트
- **https://fittrack-gold.vercel.app/login**
- **테스트 코치 계정** : 01001234567
- **패스워드** : 4567
- **테스트 회원 계정** : 01001230001
- **패스워드** : 0001
---
Copyright © 2026 FitTrack Team. All rights reserved.
