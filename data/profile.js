/**
 * 분야 분포 프로필.
 *
 * 환경변수 `BOARD_PROFILE`로 고른다(기본 `balanced`). 프로필이 바뀌면 글 내용이 바뀌고,
 * 정답표는 같은 자료에서 만들어지므로 자동으로 따라온다.
 *
 *   node server.js                              # 고른 분포
 *   BOARD_PROFILE=adult PORT=3001 node server.js # 성인 쏠림
 *
 * 두 프로필은 쓰임이 다르다.
 *   balanced — 분야를 고르게 깔아 **유형별 재현율**을 잰다. 적격평가 점수를 가늠하는 쪽.
 *   adult    — 실제 신고 분포에 가깝게 성인 쪽으로 몰아 **현장에서 체감할 성능**을 본다.
 *              다른 분야는 건수가 적어 그쪽 재현율은 이 프로필로 재지 않는다.
 *
 * 성인 쏠림의 근거: 서울시 인터넷 시민감시단이 모니터링한 불법·유해정보 80,577건 가운데
 * 출장 마사지·조건 만남 알선 광고가 41,279건(82.7%)으로 가장 많았다. 다만 82.7%를 그대로
 * 쓰면 나머지 분야가 측정 불가능할 만큼 적어지므로 70%로 낮춰 잡았다.
 */
const PROFILES = {
  balanced: {
    label: '고른 분포',
    note: '분야를 고르게 깔아 유형별 재현율을 잰다',
    cycle: [
      'GAMBLE', 'ADULT', 'LOAN', 'DRUG', 'TRADE',
      'GAMBLE', 'ADULT', 'LOAN', 'DRUG', 'TRADE',
      'GAMBLE', 'ADULT', 'LOAN', 'DRUG', 'TRADE',
      'INVEST', 'JOB', 'HACK',
    ],
  },
  adult: {
    label: '실제 분포(성인 쏠림)',
    note: '서울시 시민감시단 신고 분포에 가깝게 성인 쪽으로 몰았다',
    cycle: [
      'ADULT', 'ADULT', 'ADULT', 'ADULT', 'ADULT', 'ADULT', 'ADULT',
      'ADULT', 'ADULT', 'ADULT', 'ADULT', 'ADULT', 'ADULT', 'ADULT',
      'GAMBLE', 'GAMBLE', 'GAMBLE',
      'LOAN', 'DRUG', 'TRADE',
    ],
  },
};

const NAME = PROFILES[process.env.BOARD_PROFILE] ? process.env.BOARD_PROFILE : 'balanced';
const PROFILE = { name: NAME, ...PROFILES[NAME] };

module.exports = { PROFILES, PROFILE };
